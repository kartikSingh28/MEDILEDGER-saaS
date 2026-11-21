import fs from "fs";
import path from "path";
import * as grpc from "@grpc/grpc-js";
import { connect, Contract, Gateway, GatewayError, hash, signers } from "@hyperledger/fabric-gateway";
import { getIdentity, hospitalMspOf } from "./identity.service";
import { cryptoPath, orgConfig } from "./fabric.orgs";

/*
  Hyperledger Fabric ledger client.

  The ledger holds the record fingerprint (CID + hash), the consent state
  and an append-only audit trail. Postgres stays the query store for the UI.

  Every call takes the MediLedger user it acts for and is signed with that
  user's own Fabric identity (see identity.service.ts), submitted through their
  hospital's peer. The chaincode derives who is acting, and from which hospital,
  from the signing certificate.

  Set FABRIC_ENABLED=true once the network is up (blockchain/network/network.sh up).
  With it off, every call here is a no-op so the app runs without Fabric.
*/

export const fabricEnabled = process.env.FABRIC_ENABLED === "true";

const config = {
  channel: process.env.FABRIC_CHANNEL || "mediledger",
  chaincode: process.env.FABRIC_CHAINCODE || "consent",
};

export interface LedgerRecord {
  recordId: string;
  patientId: string;
  patientMsp: string;
  cid: string;
  hash: string;
  createdAt: string;
  txId: string;
}

export type ConsentStatus =
  | "PENDING"
  | "GRANTED"
  | "DENIED"
  | "REVOKED"
  | "EXPIRED"
  | "EXHAUSTED"
  | "INVALIDATED";

export type AccessPurpose = "TREATMENT" | "DIAGNOSIS" | "EMERGENCY" | "INSURANCE" | "RESEARCH";

export interface LedgerConsent {
  recordId: string;
  patientId: string;
  patientMsp: string;
  doctorId: string;
  doctorMsp: string;
  status: ConsentStatus;
  dataHash: string;
  purpose: AccessPurpose;
  expiresAt: string;
  maxAccesses: number;
  accessCount: number;
  emergency: boolean;
  reason: string;
  updatedAt: string;
  txId: string;
}

// What LogAccess returns. A refusal comes back as allowed:false rather than an
// error, because the chaincode has to commit the consent state change that goes
// with it (see ConsentContract.LogAccess).
export interface AccessResult {
  allowed: boolean;
  outcome: string;
  reason: string;
  recordId: string;
  cid: string;
  hash: string;
  accessCount: number;
  maxAccesses: number;
  expiresAt: string;
  txId: string;
}

export interface AuditEntry {
  recordId: string;
  actorId: string;
  actorRole: string;
  actorMsp: string;
  actorIdentity: string;
  action: string;
  targetId: string;
  targetMsp: string;
  purpose: string;
  detail: string;
  timestamp: string;
  txId: string;
}

// One gRPC connection per hospital peer, shared by that hospital's users
const clients = new Map<string, grpc.Client>();
const gateways = new Map<number, { certificate: string; gateway: Gateway; contract: Contract }>();

function getClient(mspId: string): grpc.Client {
  let client = clients.get(mspId);
  if (!client) {
    const org = orgConfig(mspId);
    const tlsRoot = fs.readFileSync(path.join(cryptoPath, org.peerTlsFile));
    client = new grpc.Client(org.peerEndpoint, grpc.credentials.createSsl(tlsRoot), {
      "grpc.ssl_target_name_override": org.peerHostAlias,
    });
    clients.set(mspId, client);
  }
  return client;
}

async function contractFor(userId: number): Promise<Contract> {
  const identity = await getIdentity(userId);
  const cached = gateways.get(userId);
  if (cached && cached.certificate === identity.certificate) {
    return cached.contract;
  }
  cached?.gateway.close();

  const gateway = connect({
    client: getClient(identity.mspId),
    identity: { mspId: identity.mspId, credentials: Buffer.from(identity.certificate) },
    signer: signers.newPrivateKeySigner(identity.privateKey),
    hash: hash.sha256,
    evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
    endorseOptions: () => ({ deadline: Date.now() + 15000 }),
    submitOptions: () => ({ deadline: Date.now() + 5000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
  });

  const contract = gateway.getNetwork(config.channel).getContract(config.chaincode);
  gateways.set(userId, { certificate: identity.certificate, gateway, contract });
  return contract;
}

// Surface the chaincode's own error message instead of a gRPC wrapper.
function ledgerError(err: unknown): Error {
  if (err instanceof GatewayError) {
    const detail = err.details.find((d) => d.message)?.message;
    const message = (detail || err.message).replace(/^chaincode response \d+, /, "");
    return new Error(`Ledger: ${message}`);
  }
  return err instanceof Error ? err : new Error(String(err));
}

async function submit(actorId: number, fn: string, ...args: (string | number)[]): Promise<string> {
  try {
    const contract = await contractFor(actorId);
    const result = await contract.submitTransaction(fn, ...args.map(String));
    return Buffer.from(result).toString("utf8");
  } catch (err) {
    throw ledgerError(err);
  }
}

async function evaluate(actorId: number, fn: string, ...args: (string | number)[]): Promise<string> {
  try {
    const contract = await contractFor(actorId);
    const result = await contract.evaluateTransaction(fn, ...args.map(String));
    return Buffer.from(result).toString("utf8");
  } catch (err) {
    throw ledgerError(err);
  }
}

/* =========================
   Writes (signed by the acting user)
========================= */

export async function registerRecord(patientId: number, recordId: number, cid: string, fileHash: string) {
  if (!fabricEnabled) return;
  await submit(patientId, "RegisterRecord", recordId, cid, fileHash);
}

export async function requestAccess(doctorId: number, recordId: number, purpose: AccessPurpose) {
  if (!fabricEnabled) return;
  await submit(doctorId, "RequestAccess", recordId, purpose);
}

// `expiresAt` is an ISO timestamp or null for no expiry; `maxAccesses` is 0 for unlimited.
export async function grantAccess(
  patientId: number,
  recordId: number,
  doctorId: number,
  terms: { expiresAt: Date | null; maxAccesses: number }
) {
  if (!fabricEnabled) return;
  await submit(
    patientId,
    "GrantAccess",
    recordId,
    await hospitalMspOf(doctorId),
    doctorId,
    terms.expiresAt ? terms.expiresAt.toISOString() : "",
    terms.maxAccesses
  );
}

// Break-glass: the doctor takes short, capped access without the patient.
export async function emergencyAccess(doctorId: number, recordId: number, reason: string): Promise<LedgerConsent | null> {
  if (!fabricEnabled) return null;
  return JSON.parse(await submit(doctorId, "EmergencyAccess", recordId, reason));
}

export async function denyAccess(patientId: number, recordId: number, doctorId: number) {
  if (!fabricEnabled) return;
  await submit(patientId, "DenyAccess", recordId, await hospitalMspOf(doctorId), doctorId);
}

export async function revokeAccess(patientId: number, recordId: number, doctorId: number) {
  if (!fabricEnabled) return;
  await submit(patientId, "RevokeAccess", recordId, await hospitalMspOf(doctorId), doctorId);
}

// Re-checks consent, expiry, the usage cap and the integrity of the bytes the
// caller actually fetched, then appends an access entry. `observedHash` is the
// SHA-256 of those bytes: the chaincode compares it to the hash the consent was
// bound to, and ends the consent if they differ.
//
// A refusal comes back as allowed:false, not an exception — the caller decides.
export async function logAccess(
  userId: number,
  recordId: number,
  observedHash: string
): Promise<AccessResult | null> {
  if (!fabricEnabled) return null;
  return JSON.parse(await submit(userId, "LogAccess", recordId, observedHash));
}

/* =========================
   Reads
========================= */

// Read-only pre-check, so a download can be refused before the file is fetched
export async function checkAccess(userId: number, recordId: number): Promise<boolean | null> {
  if (!fabricEnabled) return null;
  return JSON.parse(await evaluate(userId, "CheckAccess", recordId));
}

export async function getRecord(userId: number, recordId: number): Promise<LedgerRecord | null> {
  if (!fabricEnabled) return null;
  try {
    return JSON.parse(await evaluate(userId, "GetRecord", recordId));
  } catch (err) {
    if (err instanceof Error && /not registered on the ledger/.test(err.message)) return null;
    throw err;
  }
}

export async function getConsent(userId: number, recordId: number, doctorId: number): Promise<LedgerConsent | null> {
  if (!fabricEnabled) return null;
  try {
    return JSON.parse(await evaluate(userId, "GetConsent", recordId, await hospitalMspOf(doctorId), doctorId));
  } catch (err) {
    if (err instanceof Error && /No consent found/.test(err.message)) return null;
    throw err;
  }
}

// Owner-only: the chaincode checks the caller's certificate
export async function getAuditTrail(patientId: number, recordId: number): Promise<AuditEntry[] | null> {
  if (!fabricEnabled) return null;
  return JSON.parse(await evaluate(patientId, "GetAuditTrail", recordId));
}

export function closeFabric() {
  for (const { gateway } of gateways.values()) gateway.close();
  gateways.clear();
  for (const client of clients.values()) client.close();
  clients.clear();
}
