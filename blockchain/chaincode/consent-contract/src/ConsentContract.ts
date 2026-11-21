import { Context, Contract, Info, Returns, Transaction } from "fabric-contract-api";
import {
    ACCESS_PURPOSES,
    AccessPurpose,
    AccessResult,
    AuditAction,
    AuditEntry,
    Consent,
    ConsentStatus,
    MedicalRecord,
} from "./models";

const RECORD = "record";
const CONSENT = "consent";
const AUDIT = "audit";

// Certificate attributes set by the Fabric CA when a MediLedger user is enrolled
const ATTR_USER_ID = "mediledger.userId";
const ATTR_ROLE = "mediledger.role";

// Break-glass access is deliberately short and narrow: it is taken without the
// patient, so it buys enough time to treat someone, not ongoing access.
const EMERGENCY_TTL_MINUTES = 60;
const EMERGENCY_MAX_ACCESSES = 3;
const MAX_REASON_LENGTH = 500;

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

// What the policy chain decided about one access attempt.
interface Verdict {
    allowed: boolean;
    // Audit action to record, and for a refusal the status the consent moves to
    action: AuditAction;
    status?: ConsentStatus;
    reason: string;
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

function requirePurpose(value: string): AccessPurpose {
    const purpose = (value || "").trim().toUpperCase();
    if (!ACCESS_PURPOSES.includes(purpose as AccessPurpose)) {
        throw new Error(`purpose must be one of ${ACCESS_PURPOSES.join(", ")}`);
    }
    return purpose as AccessPurpose;
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
        record.createdAt = this.now(ctx).toISOString();
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

    // The purpose the doctor states here is carried through the grant and into
    // every audit entry, so the trail shows what each access was for.
    @Transaction()
    public async RequestAccess(ctx: Context, recordId: string, purpose: string): Promise<string> {
        const caller = this.caller(ctx, "DOCTOR");
        const stated = requirePurpose(purpose);
        const record = await this.getRecord(ctx, recordId);

        const existing = await this.findConsent(ctx, record.recordId, caller.msp, caller.userId);
        if (existing && (existing.status === "PENDING" || existing.status === "GRANTED")) {
            throw new Error(`Access request already ${existing.status.toLowerCase()}`);
        }

        const consent = this.newConsent(ctx, record, caller.msp, caller.userId, "PENDING");
        consent.purpose = stated;
        await this.saveConsent(ctx, consent);

        await this.audit(ctx, caller, record.recordId, "ACCESS_REQUESTED", caller.userId, caller.msp, {
            purpose: stated,
        });
        return JSON.stringify(consent);
    }

    // The patient sets the terms of the grant: when it lapses and how many times
    // it may be used. `expiresAt` is an ISO timestamp, or "" for no expiry;
    // `maxAccesses` is a count, or "0" for unlimited.
    @Transaction()
    public async GrantAccess(
        ctx: Context,
        recordId: string,
        doctorMsp: string,
        doctorId: string,
        expiresAt: string,
        maxAccesses: string
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
        if (existing.status === "GRANTED") {
            throw new Error("Access is already granted");
        }

        const expiry = this.parseExpiry(ctx, expiresAt);
        const limit = this.parseLimit(maxAccesses);

        const consent = this.newConsent(ctx, record, doctorMsp, doctorId, "GRANTED");
        consent.purpose = existing.purpose || "TREATMENT";
        // Bind the grant to the bytes it was given over. Re-granting after a
        // revoke starts the usage count again.
        consent.dataHash = record.hash;
        consent.expiresAt = expiry;
        consent.maxAccesses = limit;
        consent.accessCount = 0;
        await this.saveConsent(ctx, consent);

        await this.audit(ctx, caller, record.recordId, "ACCESS_GRANTED", doctorId, doctorMsp, {
            purpose: consent.purpose,
            detail: this.describeTerms(expiry, limit),
        });
        return JSON.stringify(consent);
    }

    @Transaction()
    public async DenyAccess(ctx: Context, recordId: string, doctorMsp: string, doctorId: string): Promise<string> {
        return this.transition(ctx, recordId, doctorMsp, doctorId, ["PENDING"], "DENIED", "ACCESS_DENIED");
    }

    @Transaction()
    public async RevokeAccess(ctx: Context, recordId: string, doctorMsp: string, doctorId: string): Promise<string> {
        return this.transition(ctx, recordId, doctorMsp, doctorId, ["GRANTED"], "REVOKED", "ACCESS_REVOKED");
    }

    // Break-glass. A doctor takes access without the patient, stating why.
    // The grant is short, capped, flagged as an emergency and audited as one, so
    // the patient sees exactly what was taken and can revoke it like any other.
    @Transaction()
    public async EmergencyAccess(ctx: Context, recordId: string, reason: string): Promise<string> {
        const caller = this.caller(ctx, "DOCTOR");
        const justification = (reason || "").trim();
        if (justification.length < 10) {
            throw new Error("An emergency access needs a reason of at least 10 characters");
        }
        if (justification.length > MAX_REASON_LENGTH) {
            throw new Error(`The reason must be at most ${MAX_REASON_LENGTH} characters`);
        }

        const record = await this.getRecord(ctx, recordId);
        const existing = await this.findConsent(ctx, record.recordId, caller.msp, caller.userId);
        if (existing && existing.status === "GRANTED") {
            throw new Error("You already have consent for this record");
        }

        const expiry = new Date(this.now(ctx).getTime() + EMERGENCY_TTL_MINUTES * 60_000).toISOString();

        const consent = this.newConsent(ctx, record, caller.msp, caller.userId, "GRANTED");
        consent.purpose = "EMERGENCY";
        consent.dataHash = record.hash;
        consent.expiresAt = expiry;
        consent.maxAccesses = EMERGENCY_MAX_ACCESSES;
        consent.accessCount = 0;
        consent.emergency = true;
        consent.reason = justification;
        await this.saveConsent(ctx, consent);

        await this.audit(ctx, caller, record.recordId, "EMERGENCY_ACCESS", caller.userId, caller.msp, {
            purpose: "EMERGENCY",
            detail: justification,
        });
        return JSON.stringify(consent);
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

    // Read-only pre-check, so the backend can refuse before fetching the file.
    // It reports the same verdict LogAccess would reach, but changes nothing.
    @Transaction(false)
    @Returns("boolean")
    public async CheckAccess(ctx: Context, recordId: string): Promise<boolean> {
        const caller = this.caller(ctx);
        const record = await this.getRecord(ctx, recordId);
        const consent = await this.consentFor(ctx, record, caller);
        return this.judge(ctx, record, consent, caller, "").allowed;
    }

    // Called on every download, signed by the downloader, with the SHA-256 of the
    // bytes actually retrieved from storage.
    //
    // This is where the claims meet: the contract re-checks consent, its expiry,
    // its usage cap and the integrity of the data against the hash the consent was
    // bound to. A refusal is committed, not thrown, so the consent's new state and
    // the blocked attempt both land on the ledger.
    @Transaction()
    public async LogAccess(ctx: Context, recordId: string, observedHash: string): Promise<string> {
        const caller = this.caller(ctx);
        const record = await this.getRecord(ctx, recordId);
        const consent = await this.consentFor(ctx, record, caller);
        const seen = (observedHash || "").trim();

        const verdict = this.judge(ctx, record, consent, caller, seen);

        const result = new AccessResult();
        result.recordId = record.recordId;
        result.allowed = verdict.allowed;
        result.txId = ctx.stub.getTxID();

        if (consent) {
            result.maxAccesses = consent.maxAccesses ?? 0;
            result.expiresAt = consent.expiresAt ?? "";
            result.accessCount = consent.accessCount ?? 0;
        }

        if (!verdict.allowed) {
            result.outcome = verdict.action;
            result.reason = verdict.reason;

            // End the consent when the policy that failed makes it unusable
            if (consent && verdict.status) {
                consent.status = verdict.status;
                consent.updatedAt = this.now(ctx).toISOString();
                consent.txId = ctx.stub.getTxID();
                await this.saveConsent(ctx, consent);
            }

            await this.audit(ctx, caller, record.recordId, verdict.action, caller.userId, caller.msp, {
                purpose: consent?.purpose ?? "",
                detail: verdict.reason,
            });
            return JSON.stringify(result);
        }

        // Count the access against the cap before handing anything over
        if (consent) {
            consent.accessCount = (consent.accessCount ?? 0) + 1;
            consent.updatedAt = this.now(ctx).toISOString();
            consent.txId = ctx.stub.getTxID();
            await this.saveConsent(ctx, consent);
            result.accessCount = consent.accessCount;
        }

        result.cid = record.cid;
        result.hash = record.hash;

        await this.audit(ctx, caller, record.recordId, "RECORD_ACCESSED", record.recordId, record.patientMsp, {
            purpose: consent?.purpose ?? "",
            detail: consent?.emergency ? "Emergency access" : "",
        });
        return JSON.stringify(result);
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
       Policy
    ========================= */

    // The access policy, in one place, used by both CheckAccess and LogAccess.
    // `observedHash` is "" for the read-only pre-check, which cannot see the file.
    private judge(
        ctx: Context,
        record: MedicalRecord,
        consent: Consent | null,
        caller: Caller,
        observedHash: string
    ): Verdict {
        const integrity = (expected: string): Verdict | null => {
            if (!observedHash || !expected || observedHash === expected) return null;
            return {
                allowed: false,
                action: "CONSENT_INVALIDATED",
                status: "INVALIDATED",
                reason: "The stored file no longer matches the hash on the ledger",
            };
        };

        if (caller.role === "PATIENT") {
            if (!this.isOwner(record, caller)) {
                return { allowed: false, action: "ACCESS_BLOCKED", reason: "Not the owner of this record" };
            }
            // The owner's own access cannot be revoked, but a corrupted file is
            // still reported rather than handed over.
            const tampered = integrity(record.hash);
            if (tampered) {
                return { allowed: false, action: "ACCESS_BLOCKED", reason: tampered.reason };
            }
            return { allowed: true, action: "RECORD_ACCESSED", reason: "" };
        }

        if (caller.role !== "DOCTOR") {
            return { allowed: false, action: "ACCESS_BLOCKED", reason: `Role ${caller.role} cannot access records` };
        }

        if (!consent) {
            return { allowed: false, action: "ACCESS_BLOCKED", reason: "No consent exists for this record" };
        }
        if (consent.status !== "GRANTED") {
            return {
                allowed: false,
                action: "ACCESS_BLOCKED",
                reason: `Consent is ${consent.status.toLowerCase()}`,
            };
        }

        // Time-bound. Compared against the transaction timestamp, which every
        // endorsing peer computes identically.
        if (consent.expiresAt && this.now(ctx).getTime() > Date.parse(consent.expiresAt)) {
            return {
                allowed: false,
                action: "CONSENT_EXPIRED",
                status: "EXPIRED",
                reason: `Consent expired on ${consent.expiresAt}`,
            };
        }

        // Access frequency.
        const limit = consent.maxAccesses ?? 0;
        const used = consent.accessCount ?? 0;
        if (limit > 0 && used >= limit) {
            return {
                allowed: false,
                action: "CONSENT_EXHAUSTED",
                status: "EXHAUSTED",
                reason: `Consent allowed ${limit} access${limit === 1 ? "" : "es"} and all have been used`,
            };
        }

        // Integrity, against the hash this consent was bound to at grant time.
        // Consents written before the binding existed have no dataHash; those
        // fall back to the record's own anchored hash.
        const bound = consent.dataHash || record.hash;
        const tampered = integrity(bound);
        if (tampered) return tampered;

        // The record's anchored hash drifting from the bound hash means the
        // consent no longer describes the record it was given over.
        if (consent.dataHash && record.hash !== consent.dataHash) {
            return {
                allowed: false,
                action: "CONSENT_INVALIDATED",
                status: "INVALIDATED",
                reason: "The record changed after consent was given",
            };
        }

        return { allowed: true, action: "RECORD_ACCESSED", reason: "" };
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

    private now(ctx: Context): Date {
        // Transaction timestamp, not Date.now(): every endorsing peer must compute the same value.
        return ctx.stub.getDateTimestamp();
    }

    private parseExpiry(ctx: Context, value: string): string {
        const raw = (value || "").trim();
        if (!raw) return "";

        const at = Date.parse(raw);
        if (Number.isNaN(at)) {
            throw new Error("expiresAt must be an ISO timestamp or empty");
        }
        if (at <= this.now(ctx).getTime()) {
            throw new Error("expiresAt must be in the future");
        }
        return new Date(at).toISOString();
    }

    private parseLimit(value: string): number {
        const raw = (value || "").trim();
        if (!raw) return 0;

        const limit = Number(raw);
        if (!Number.isInteger(limit) || limit < 0) {
            throw new Error("maxAccesses must be a whole number, or 0 for unlimited");
        }
        return limit;
    }

    private describeTerms(expiresAt: string, maxAccesses: number): string {
        const parts = [
            expiresAt ? `expires ${expiresAt}` : "no expiry",
            maxAccesses > 0 ? `${maxAccesses} access${maxAccesses === 1 ? "" : "es"}` : "unlimited accesses",
        ];
        return parts.join(", ");
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

    // The consent that governs this caller, if the caller needs one
    private async consentFor(ctx: Context, record: MedicalRecord, caller: Caller): Promise<Consent | null> {
        if (caller.role !== "DOCTOR") return null;
        return this.findConsent(ctx, record.recordId, caller.msp, caller.userId);
    }

    private async findConsent(ctx: Context, recordId: string, doctorMsp: string, doctorId: string): Promise<Consent | null> {
        const data = await ctx.stub.getState(ctx.stub.createCompositeKey(CONSENT, [recordId, doctorMsp, doctorId]));
        if (!data || data.length === 0) {
            return null;
        }
        return JSON.parse(Buffer.from(data).toString("utf8")) as Consent;
    }

    private newConsent(
        ctx: Context,
        record: MedicalRecord,
        doctorMsp: string,
        doctorId: string,
        status: ConsentStatus
    ): Consent {
        const consent = new Consent();
        consent.recordId = record.recordId;
        consent.patientId = record.patientId;
        consent.patientMsp = record.patientMsp;
        consent.doctorId = doctorId;
        consent.doctorMsp = doctorMsp;
        consent.status = status;
        consent.updatedAt = this.now(ctx).toISOString();
        consent.txId = ctx.stub.getTxID();
        return consent;
    }

    private async saveConsent(ctx: Context, consent: Consent): Promise<void> {
        await ctx.stub.putState(
            ctx.stub.createCompositeKey(CONSENT, [consent.recordId, consent.doctorMsp, consent.doctorId]),
            serialize(consent)
        );
        ctx.stub.setEvent(`Consent${consent.status}`, serialize(consent));
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

        existing.status = to;
        existing.updatedAt = this.now(ctx).toISOString();
        existing.txId = ctx.stub.getTxID();
        await this.saveConsent(ctx, existing);

        await this.audit(ctx, caller, record.recordId, action, doctorId, doctorMsp, {
            purpose: existing.purpose ?? "",
            detail: existing.emergency ? "Emergency access ended by the patient" : "",
        });
        return JSON.stringify(existing);
    }

    private async audit(
        ctx: Context,
        caller: Caller,
        recordId: string,
        action: AuditAction,
        targetId: string,
        targetMsp: string,
        extra: { purpose?: string; detail?: string } = {}
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
        entry.purpose = extra.purpose ?? "";
        entry.detail = extra.detail ?? "";
        entry.timestamp = this.now(ctx).toISOString();
        entry.txId = ctx.stub.getTxID();

        await ctx.stub.putState(ctx.stub.createCompositeKey(AUDIT, [recordId, entry.txId, action]), serialize(entry));
    }
}
