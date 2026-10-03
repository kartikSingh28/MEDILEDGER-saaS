import { Context, Contract, Info, Returns, Transaction } from "fabric-contract-api";
import { AuditAction, AuditEntry, Consent, ConsentStatus, MedicalRecord } from "./models";

const RECORD = "record";
const CONSENT = "consent";
const AUDIT = "audit";

// Fabric endorsement compares write sets byte-for-byte across peers,
// so state must be serialized with a stable key order.
function serialize(value: object): Uint8Array {
    const sorted = Object.keys(value)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
            acc[key] = (value as Record<string, unknown>)[key];
            return acc;
        }, {});
    return Buffer.from(JSON.stringify(sorted));
}

function requireId(name: string, value: string): string {
    if (!value || !value.trim() || value.includes("\u0000")) {
        throw new Error(`${name} is required`);
    }
    return value.trim();
}

@Info({
    title: "ConsentContract",
    description: "MediLedger patient consent, record integrity and access audit",
})
export class ConsentContract extends Contract {
    constructor() {
        super("ConsentContract");
    }

    /* =========================
       Records
    ========================= */

    @Transaction()
    public async RegisterRecord(
        ctx: Context,
        recordId: string,
        patientId: string,
        cid: string,
        hash: string
    ): Promise<string> {
        recordId = requireId("recordId", recordId);
        patientId = requireId("patientId", patientId);
        cid = requireId("cid", cid);
        hash = requireId("hash", hash);

        const key = ctx.stub.createCompositeKey(RECORD, [recordId]);
        const existing = await ctx.stub.getState(key);
        if (existing && existing.length > 0) {
            throw new Error(`Record ${recordId} is already registered`);
        }

        const record = new MedicalRecord();
        record.recordId = recordId;
        record.patientId = patientId;
        record.cid = cid;
        record.hash = hash;
        record.createdAt = this.now(ctx);
        record.txId = ctx.stub.getTxID();

        await ctx.stub.putState(key, serialize(record));
        await this.audit(ctx, recordId, patientId, "PATIENT", "RECORD_REGISTERED", recordId);

        return JSON.stringify(record);
    }

    @Transaction(false)
    @Returns("string")
    public async GetRecord(ctx: Context, recordId: string): Promise<string> {
        const record = await this.getRecord(ctx, recordId);
        return JSON.stringify(record);
    }

    @Transaction(false)
    @Returns("boolean")
    public async VerifyRecordHash(ctx: Context, recordId: string, hash: string): Promise<boolean> {
        const record = await this.getRecord(ctx, recordId);
        return record.hash === hash;
    }

    /* =========================
       Consent lifecycle
    ========================= */

    @Transaction()
    public async RequestAccess(ctx: Context, recordId: string, doctorId: string): Promise<string> {
        doctorId = requireId("doctorId", doctorId);
        const record = await this.getRecord(ctx, recordId);

        if (record.patientId === doctorId) {
            throw new Error("Patients cannot request access to their own record");
        }

        const existing = await this.findConsent(ctx, record.recordId, doctorId);
        if (existing && (existing.status === "PENDING" || existing.status === "GRANTED")) {
            throw new Error(`Access request already ${existing.status.toLowerCase()}`);
        }

        const consent = await this.saveConsent(ctx, record, doctorId, "PENDING");
        await this.audit(ctx, record.recordId, doctorId, "DOCTOR", "ACCESS_REQUESTED", doctorId);
        return JSON.stringify(consent);
    }

    @Transaction()
    public async GrantAccess(
        ctx: Context,
        recordId: string,
        doctorId: string,
        patientId: string
    ): Promise<string> {
        return this.transition(ctx, recordId, doctorId, patientId, ["PENDING", "DENIED", "REVOKED"], "GRANTED", "ACCESS_GRANTED");
    }

    @Transaction()
    public async DenyAccess(
        ctx: Context,
        recordId: string,
        doctorId: string,
        patientId: string
    ): Promise<string> {
        return this.transition(ctx, recordId, doctorId, patientId, ["PENDING"], "DENIED", "ACCESS_DENIED");
    }

    @Transaction()
    public async RevokeAccess(
        ctx: Context,
        recordId: string,
        doctorId: string,
        patientId: string
    ): Promise<string> {
        return this.transition(ctx, recordId, doctorId, patientId, ["GRANTED"], "REVOKED", "ACCESS_REVOKED");
    }

    @Transaction(false)
    @Returns("string")
    public async GetConsent(ctx: Context, recordId: string, doctorId: string): Promise<string> {
        const consent = await this.findConsent(ctx, requireId("recordId", recordId), requireId("doctorId", doctorId));
        if (!consent) {
            throw new Error(`No consent found for record ${recordId} and doctor ${doctorId}`);
        }
        return JSON.stringify(consent);
    }

    /* =========================
       Access enforcement + audit
    ========================= */

    @Transaction(false)
    @Returns("boolean")
    public async CheckAccess(ctx: Context, recordId: string, userId: string, role: string): Promise<boolean> {
        const record = await this.getRecord(ctx, recordId);
        return this.hasAccess(ctx, record, requireId("userId", userId), role);
    }

    // Called on every download. Fails if the ledger does not show access,
    // so a tampered permission row in Postgres cannot unlock a file.
    @Transaction()
    public async LogAccess(ctx: Context, recordId: string, userId: string, role: string): Promise<string> {
        userId = requireId("userId", userId);
        const record = await this.getRecord(ctx, recordId);

        if (!(await this.hasAccess(ctx, record, userId, role))) {
            throw new Error(`User ${userId} has no consent to access record ${record.recordId}`);
        }

        await this.audit(ctx, record.recordId, userId, role, "RECORD_ACCESSED", record.recordId);
        return JSON.stringify(record);
    }

    @Transaction(false)
    @Returns("string")
    public async GetAuditTrail(ctx: Context, recordId: string): Promise<string> {
        recordId = requireId("recordId", recordId);
        const entries: AuditEntry[] = [];

        for await (const { value } of ctx.stub.getStateByPartialCompositeKey(AUDIT, [recordId])) {
            entries.push(JSON.parse(Buffer.from(value).toString("utf8")) as AuditEntry);
        }

        entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        return JSON.stringify(entries);
    }

   

    private now(ctx: Context): string {
        // Transaction timestamp, not Date.now(): every endorsing peer must compute the same value.
        return ctx.stub.getDateTimestamp().toISOString();
    }

    private async getRecord(ctx: Context, recordId: string): Promise<MedicalRecord> {
        recordId = requireId("recordId", recordId);
        const data = await ctx.stub.getState(ctx.stub.createCompositeKey(RECORD, [recordId]));
        if (!data || data.length === 0) {
            throw new Error(`Record ${recordId} is not registered on the ledger`);
        }
        return JSON.parse(Buffer.from(data).toString("utf8")) as MedicalRecord;
    }

    private async findConsent(ctx: Context, recordId: string, doctorId: string): Promise<Consent | null> {
        const data = await ctx.stub.getState(ctx.stub.createCompositeKey(CONSENT, [recordId, doctorId]));
        if (!data || data.length === 0) {
            return null;
        }
        return JSON.parse(Buffer.from(data).toString("utf8")) as Consent;
    }

    private async saveConsent(
        ctx: Context,
        record: MedicalRecord,
        doctorId: string,
        status: ConsentStatus
    ): Promise<Consent> {
        const consent = new Consent();
        consent.recordId = record.recordId;
        consent.patientId = record.patientId;
        consent.doctorId = doctorId;
        consent.status = status;
        consent.updatedAt = this.now(ctx);
        consent.txId = ctx.stub.getTxID();

        await ctx.stub.putState(ctx.stub.createCompositeKey(CONSENT, [record.recordId, doctorId]), serialize(consent));
        ctx.stub.setEvent(`Consent${status}`, serialize(consent));
        return consent;
    }

    private async transition(
        ctx: Context,
        recordId: string,
        doctorId: string,
        patientId: string,
        from: ConsentStatus[],
        to: ConsentStatus,
        action: AuditAction
    ): Promise<string> {
        doctorId = requireId("doctorId", doctorId);
        patientId = requireId("patientId", patientId);
        const record = await this.getRecord(ctx, recordId);

        if (record.patientId !== patientId) {
            throw new Error("Only the record owner can change consent");
        }

        const existing = await this.findConsent(ctx, record.recordId, doctorId);
        if (!existing) {
            throw new Error(`Doctor ${doctorId} has not requested access to record ${record.recordId}`);
        }
        if (!from.includes(existing.status)) {
            throw new Error(`Cannot change consent from ${existing.status} to ${to}`);
        }

        const consent = await this.saveConsent(ctx, record, doctorId, to);
        await this.audit(ctx, record.recordId, patientId, "PATIENT", action, doctorId);
        return JSON.stringify(consent);
    }

    private async hasAccess(ctx: Context, record: MedicalRecord, userId: string, role: string): Promise<boolean> {
        if (role === "PATIENT") {
            return record.patientId === userId;
        }
        if (role === "DOCTOR") {
            const consent = await this.findConsent(ctx, record.recordId, userId);
            return consent?.status === "GRANTED";
        }
        return false;
    }

    private async audit(
        ctx: Context,
        recordId: string,
        actorId: string,
        actorRole: string,
        action: AuditAction,
        targetId: string
    ): Promise<void> {
        const entry = new AuditEntry();
        entry.recordId = recordId;
        entry.actorId = actorId;
        entry.actorRole = actorRole;
        entry.action = action;
        entry.targetId = targetId;
        entry.timestamp = this.now(ctx);
        entry.txId = ctx.stub.getTxID();

        await ctx.stub.putState(ctx.stub.createCompositeKey(AUDIT, [recordId, entry.txId, action]), serialize(entry));
    }
}
