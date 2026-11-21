import { Object as DataType, Property } from "fabric-contract-api";

// A consent is live only while GRANTED. The four terminal states below it are
// set by the contract itself when a policy stops being satisfied, so the reason
// access ended is on the ledger rather than inferred from its absence.
export type ConsentStatus =
    | "PENDING"
    | "GRANTED"
    | "DENIED"
    | "REVOKED"
    | "EXPIRED"
    | "EXHAUSTED"
    | "INVALIDATED";

// Why the requester wants the record. Carried from the request through to every
// audit entry, so the trail shows the purpose each access was granted under.
export type AccessPurpose = "TREATMENT" | "DIAGNOSIS" | "EMERGENCY" | "INSURANCE" | "RESEARCH";

export const ACCESS_PURPOSES: AccessPurpose[] = [
    "TREATMENT",
    "DIAGNOSIS",
    "EMERGENCY",
    "INSURANCE",
    "RESEARCH",
];

export type AuditAction =
    | "RECORD_REGISTERED"
    | "ACCESS_REQUESTED"
    | "ACCESS_GRANTED"
    | "ACCESS_DENIED"
    | "ACCESS_REVOKED"
    | "RECORD_ACCESSED"
    // Break-glass: a doctor took access without waiting for consent
    | "EMERGENCY_ACCESS"
    // An access attempt the contract refused
    | "ACCESS_BLOCKED"
    // The contract ended a consent on its own
    | "CONSENT_EXPIRED"
    | "CONSENT_EXHAUSTED"
    | "CONSENT_INVALIDATED";

@DataType()
export class MedicalRecord {
    @Property()
    public docType: string = "record";

    @Property()
    public recordId: string = "";

    @Property()
    public patientId: string = "";

    // Hospital (Fabric MSP) whose CA issued the patient's identity
    @Property()
    public patientMsp: string = "";

    @Property()
    public cid: string = "";

    @Property()
    public hash: string = "";

    @Property()
    public createdAt: string = "";

    @Property()
    public txId: string = "";
}

@DataType()
export class Consent {
    @Property()
    public docType: string = "consent";

    @Property()
    public recordId: string = "";

    @Property()
    public patientId: string = "";

    @Property()
    public patientMsp: string = "";

    @Property()
    public doctorId: string = "";

    @Property()
    public doctorMsp: string = "";

    @Property()
    public status: ConsentStatus = "PENDING";

    // SHA-256 of the encrypted record this consent was granted over, copied from
    // the record when the patient grants. Consent is permission to read *these*
    // bytes: if the stored file stops hashing to this value the consent no longer
    // describes what would be handed over, and the contract invalidates it.
    @Property()
    public dataHash: string = "";

    @Property()
    public purpose: AccessPurpose = "TREATMENT";

    // ISO timestamp; "" means the grant does not expire
    @Property()
    public expiresAt: string = "";

    // 0 means unlimited
    @Property()
    public maxAccesses: number = 0;

    @Property()
    public accessCount: number = 0;

    // Break-glass grant: taken by the doctor, not given by the patient
    @Property()
    public emergency: boolean = false;

    // Justification recorded for an emergency grant
    @Property()
    public reason: string = "";

    @Property()
    public updatedAt: string = "";

    @Property()
    public txId: string = "";
}

@DataType()
export class AuditEntry {
    @Property()
    public docType: string = "audit";

    @Property()
    public recordId: string = "";

    @Property()
    public actorId: string = "";

    @Property()
    public actorRole: string = "";

    @Property()
    public action: AuditAction = "RECORD_REGISTERED";

    @Property()
    public targetId: string = "";

    // For consent actions the target is a doctor; this is their hospital
    @Property()
    public targetMsp: string = "";

    // MSP and X.509 identity (subject + issuer) of the certificate that signed the transaction
    @Property()
    public actorMsp: string = "";

    @Property()
    public actorIdentity: string = "";

    // Purpose the access was requested or granted under, where one applies
    @Property()
    public purpose: string = "";

    // Why the contract blocked or ended access, or an emergency justification
    @Property()
    public detail: string = "";

    @Property()
    public timestamp: string = "";

    @Property()
    public txId: string = "";
}

// Outcome of an access attempt.
//
// A refusal is returned, never thrown. Fabric discards the write set of a
// transaction that throws, and refusing often means writing: the consent moves
// to EXPIRED / EXHAUSTED / INVALIDATED and an audit entry is appended. Throwing
// would roll both back and leave no trace of the attempt, so the contract
// commits the refusal and lets the caller act on `allowed`.
@DataType()
export class AccessResult {
    @Property()
    public allowed: boolean = false;

    // Set when allowed is false: ACCESS_BLOCKED, CONSENT_EXPIRED, ...
    @Property()
    public outcome: string = "";

    @Property()
    public reason: string = "";

    @Property()
    public recordId: string = "";

    @Property()
    public cid: string = "";

    @Property()
    public hash: string = "";

    // Accesses used / allowed after this attempt, for display
    @Property()
    public accessCount: number = 0;

    @Property()
    public maxAccesses: number = 0;

    @Property()
    public expiresAt: string = "";

    @Property()
    public txId: string = "";
}
