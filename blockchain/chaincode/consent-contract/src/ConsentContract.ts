import { Context, Contract, Info, Returns, Transaction } from "fabric-contract-api";
import { AuditAction, AuditEntry, Consent, ConsentStatus, MedicalRecord } from "./models";

const RECORD = "record";
const CONSENT = "consent";
const AUDIT = "audit";

// Certificate attributes set by the Fabric CA when a MediLedger user is enrolled
const ATTR_USER_ID = "mediledger.userId";
const ATTR_ROLE = "mediledger.role";

type Role = "PATIENT" | "DOCTOR" | "ADMIN";

// Who signed the transaction, read from their X.509 certificate.
// The backend cannot claim to act for someone else without that user's private key.
// A user is identified by (msp, userId): each hospital is its own Fabric org with its
// own CA, so one hospital's CA cannot issue a certificate that passes as another
// hospital's user.
interface Caller {
    userId: string;
    role: Role;
    msp: string;
    identity: string;
}

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
    public async RegisterRecord(ctx: Context, recordId: string, cid: string, hash: string): Promise<string> {
        const caller = this.caller(ctx, "PATIENT");
        recordId = requireId("recordId", recordId);
        cid = requireId("cid", cid);
        hash = requireId("hash", hash);

        const key = ctx.stub.createCompositeKey(RECORD, [recordId]);
        const existing = await ctx.stub.getState(key);
        if (existing && existing.length > 0) {
            throw new Error(`Record ${recordId} is already registered`);
        }

        const record = new MedicalRecord();
        record.recordId = recordId;
        record.patientId = caller.userId;
        record.patientMsp = caller.msp;
        record.cid = cid;
        record.hash = hash;
        record.createdAt = this.now(ctx);
        record.txId = ctx.stub.getTxID();

        await ctx.stub.putState(key, serialize(record));
        await this.audit(ctx, caller, recordId, "RECORD_REGISTERED", recordId, caller.msp);

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
    public async RequestAccess(ctx: Context, recordId: string): Promise<string> {
        const caller = this.caller(ctx, "DOCTOR");
        const record = await this.getRecord(ctx, recordId);

        const existing = await this.findConsent(ctx, record.recordId, caller.msp, caller.userId);
        if (existing && (existing.status === "PENDING" || existing.status === "GRANTED")) {
            throw new Error(`Access request already ${existing.status.toLowerCase()}`);
        }

        const consent = await this.saveConsent(ctx, record, caller.msp, caller.userId, "PENDING");
        await this.audit(ctx, caller, record.recordId, "ACCESS_REQUESTED", caller.userId, caller.msp);
        return JSON.stringify(consent);
    }

    @Transaction()
    public async GrantAccess(ctx: Context, recordId: string, doctorMsp: string, doctorId: string): Promise<string> {
        return this.transition(ctx, recordId, doctorMsp, doctorId, ["PENDING", "DENIED", "REVOKED"], "GRANTED", "ACCESS_GRANTED");
    }

    @Transaction()
    public async DenyAccess(ctx: Context, recordId: string, doctorMsp: string, doctorId: string): Promise<string> {
        return this.transition(ctx, recordId, doctorMsp, doctorId, ["PENDING"], "DENIED", "ACCESS_DENIED");
    }

    @Transaction()
    public async RevokeAccess(ctx: Context, recordId: string, doctorMsp: string, doctorId: string): Promise<string> {
        return this.transition(ctx, recordId, doctorMsp, doctorId, ["GRANTED"], "REVOKED", "ACCESS_REVOKED");
    }

    @Transaction(false)
    @Returns("string")
    public async GetConsent(ctx: Context, recordId: string, doctorMsp: string, doctorId: string): Promise<string> {
        const consent = await this.findConsent(
            ctx,
            requireId("recordId", recordId),
            requireId("doctorMsp", doctorMsp),
            requireId("doctorId", doctorId)
        );
        if (!consent) {
            throw new Error(`No consent found for record ${recordId} and doctor ${doctorMsp}/${doctorId}`);
        }
        return JSON.stringify(consent);
    }

    /* =========================
       Access enforcement + audit
    ========================= */

    @Transaction(false)
    @Returns("boolean")
    public async CheckAccess(ctx: Context, recordId: string): Promise<boolean> {
        const caller = this.caller(ctx);
        const record = await this.getRecord(ctx, recordId);
        return this.hasAccess(ctx, record, caller);
    }

    // Called on every download, signed by the downloader. Fails if the ledger
    // does not show access, so a tampered permission row in Postgres cannot unlock a file.
    @Transaction()
    public async LogAccess(ctx: Context, recordId: string): Promise<string> {
        const caller = this.caller(ctx);
        const record = await this.getRecord(ctx, recordId);

        if (!(await this.hasAccess(ctx, record, caller))) {
            throw new Error(`User ${caller.userId} has no consent to access record ${record.recordId}`);
        }

        await this.audit(ctx, caller, record.recordId, "RECORD_ACCESSED", record.recordId, record.patientMsp);
        return JSON.stringify(record);
    }

    // Only the record owner can read its audit trail
    @Transaction(false)
    @Returns("string")
    public async GetAuditTrail(ctx: Context, recordId: string): Promise<string> {
        const caller = this.caller(ctx, "PATIENT");
        const record = await this.getRecord(ctx, recordId);
        if (!this.isOwner(record, caller)) {
            throw new Error("Only the record owner can read its audit trail");
        }

        const entries: AuditEntry[] = [];
        for await (const { value } of ctx.stub.getStateByPartialCompositeKey(AUDIT, [record.recordId])) {
            entries.push(JSON.parse(Buffer.from(value).toString("utf8")) as AuditEntry);
        }

        entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        return JSON.stringify(entries);
    }

    /* =========================
       Helpers
    ========================= */

    private caller(ctx: Context, requiredRole?: Role): Caller {
        const userId = ctx.clientIdentity.getAttributeValue(ATTR_USER_ID);
        const role = ctx.clientIdentity.getAttributeValue(ATTR_ROLE) as Role | null;

        if (!userId || !role) {
            throw new Error("Caller certificate is not a MediLedger user identity");
        }
        if (requiredRole && role !== requiredRole) {
            throw new Error(`Only a ${requiredRole.toLowerCase()} can do this (caller is ${role.toLowerCase()})`);
        }

        return {
            userId,
            role,
            msp: ctx.clientIdentity.getMSPID(),
            identity: ctx.clientIdentity.getID(),
        };
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

    private isOwner(record: MedicalRecord, caller: Caller): boolean {
        return record.patientId === caller.userId && record.patientMsp === caller.msp;
    }

    private async findConsent(ctx: Context, recordId: string, doctorMsp: string, doctorId: string): Promise<Consent | null> {
        const data = await ctx.stub.getState(ctx.stub.createCompositeKey(CONSENT, [recordId, doctorMsp, doctorId]));
        if (!data || data.length === 0) {
            return null;
        }
        return JSON.parse(Buffer.from(data).toString("utf8")) as Consent;
    }

    private async saveConsent(
        ctx: Context,
        record: MedicalRecord,
        doctorMsp: string,
        doctorId: string,
        status: ConsentStatus
    ): Promise<Consent> {
        const consent = new Consent();
        consent.recordId = record.recordId;
        consent.patientId = record.patientId;
        consent.patientMsp = record.patientMsp;
        consent.doctorId = doctorId;
        consent.doctorMsp = doctorMsp;
        consent.status = status;
        consent.updatedAt = this.now(ctx);
        consent.txId = ctx.stub.getTxID();

        await ctx.stub.putState(
            ctx.stub.createCompositeKey(CONSENT, [record.recordId, doctorMsp, doctorId]),
            serialize(consent)
        );
        ctx.stub.setEvent(`Consent${status}`, serialize(consent));
        return consent;
    }

    // Consent changes must be signed by the patient who owns the record
    private async transition(
        ctx: Context,
        recordId: string,
        doctorMsp: string,
        doctorId: string,
        from: ConsentStatus[],
        to: ConsentStatus,
        action: AuditAction
    ): Promise<string> {
        const caller = this.caller(ctx, "PATIENT");
        doctorMsp = requireId("doctorMsp", doctorMsp);
        doctorId = requireId("doctorId", doctorId);
        const record = await this.getRecord(ctx, recordId);

        if (!this.isOwner(record, caller)) {
            throw new Error("Only the record owner can change consent");
        }

        const existing = await this.findConsent(ctx, record.recordId, doctorMsp, doctorId);
        if (!existing) {
            throw new Error(`Doctor ${doctorMsp}/${doctorId} has not requested access to record ${record.recordId}`);
        }
        if (!from.includes(existing.status)) {
            throw new Error(`Cannot change consent from ${existing.status} to ${to}`);
        }

        const consent = await this.saveConsent(ctx, record, doctorMsp, doctorId, to);
        await this.audit(ctx, caller, record.recordId, action, doctorId, doctorMsp);
        return JSON.stringify(consent);
    }

    private async hasAccess(ctx: Context, record: MedicalRecord, caller: Caller): Promise<boolean> {
        if (caller.role === "PATIENT") {
            return this.isOwner(record, caller);
        }
        if (caller.role === "DOCTOR") {
            const consent = await this.findConsent(ctx, record.recordId, caller.msp, caller.userId);
            return consent?.status === "GRANTED";
        }
        return false;
    }

    private async audit(
        ctx: Context,
        caller: Caller,
        recordId: string,
        action: AuditAction,
        targetId: string,
        targetMsp: string
    ): Promise<void> {
        const entry = new AuditEntry();
        entry.recordId = recordId;
        entry.actorId = caller.userId;
        entry.actorRole = caller.role;
        entry.actorMsp = caller.msp;
        entry.actorIdentity = caller.identity;
        entry.action = action;
        entry.targetId = targetId;
        entry.targetMsp = targetMsp;
        entry.timestamp = this.now(ctx);
        entry.txId = ctx.stub.getTxID();

        await ctx.stub.putState(ctx.stub.createCompositeKey(AUDIT, [recordId, entry.txId, action]), serialize(entry));
    }
}
