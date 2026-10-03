import { Object as DataType, Property } from "fabric-contract-api";

export type ConsentStatus = "PENDING" | "GRANTED" | "DENIED" | "REVOKED";

export type AuditAction =
    | "RECORD_REGISTERED"
    | "ACCESS_REQUESTED"
    | "ACCESS_GRANTED"
    | "ACCESS_DENIED"
    | "ACCESS_REVOKED"
    | "RECORD_ACCESSED";

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

    @Property()
    public timestamp: string = "";

    @Property()
    public txId: string = "";
}
