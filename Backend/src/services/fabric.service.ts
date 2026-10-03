import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as grpc from "@grpc/grpc-js";
import { connect, Contract, Gateway, GatewayError, hash, signers } from "@hyperledger/fabric-gateway";

/*
  Hyperledger Fabric ledger client.

  The ledger holds the record fingerprint (CID + hash), the consent state
  and an append-only audit trail. Postgres stays the query store for the UI.

  Set FABRIC_ENABLED=true once the network is up (blockchain/network/network.sh up).
  With it off, every call here is a no-op so the app runs without Fabric.
*/

export const fabricEnabled = process.env.FABRIC_ENABLED === "true";

const config = {
  peerEndpoint: process.env.FABRIC_PEER_ENDPOINT || "localhost:7051",
  peerHostAlias: process.env.FABRIC_PEER_HOST_ALIAS || "peer0.org1.example.com",
  mspId: process.env.FABRIC_MSP_ID || "Org1MSP",
  channel: process.env.FABRIC_CHANNEL || "mediledger",
  chaincode: process.env.FABRIC_CHAINCODE || "consent",
  cryptoPath: path.resolve(process.env.FABRIC_CRYPTO_PATH || "fabric/crypto"),
};

export interface LedgerRecord {
  recordId: string;
  patientId: string;
  cid: string;
  hash: string;
  createdAt: string;
  txId: string;
}

export interface AuditEntry {
  recordId: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetId: string;
  timestamp: string;
  txId: string;
}

let gateway: Gateway | undefined;
let contract: Contract | undefined;

function getContract(): Contract {
  if (contract) return contract;

  const read = (file: string) => fs.readFileSync(path.join(config.cryptoPath, file));

  const client = new grpc.Client(
    config.peerEndpoint,
    grpc.credentials.createSsl(read("tls-ca.crt")),
    { "grpc.ssl_target_name_override": config.peerHostAlias }
  );

  gateway = connect({
    client,
    identity: { mspId: config.mspId, credentials: read("cert.pem") },
    signer: signers.newPrivateKeySigner(crypto.createPrivateKey(read("key.pem"))),
    hash: hash.sha256,
    evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
    endorseOptions: () => ({ deadline: Date.now() + 15000 }),
    submitOptions: () => ({ deadline: Date.now() + 5000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
  });

  contract = gateway.getNetwork(config.channel).getContract(config.chaincode);
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

async function submit(fn: string, ...args: (string | number)[]): Promise<string> {
  try {
    const result = await getContract().submitTransaction(fn, ...args.map(String));
    return Buffer.from(result).toString("utf8");
  } catch (err) {
    throw ledgerError(err);
  }
}

async function evaluate(fn: string, ...args: (string | number)[]): Promise<string> {
  try {
    const result = await getContract().evaluateTransaction(fn, ...args.map(String));
    return Buffer.from(result).toString("utf8");
  } catch (err) {
    throw ledgerError(err);
  }
}

export async function registerRecord(recordId: number, patientId: number, cid: string, fileHash: string) {
  if (!fabricEnabled) return;
  await submit("RegisterRecord", recordId, patientId, cid, fileHash);
}

export async function requestAccess(recordId: number, doctorId: number) {
  if (!fabricEnabled) return;
  await submit("RequestAccess", recordId, doctorId);
}

export async function grantAccess(recordId: number, doctorId: number, patientId: number) {
  if (!fabricEnabled) return;
  await submit("GrantAccess", recordId, doctorId, patientId);
}

export async function denyAccess(recordId: number, doctorId: number, patientId: number) {
  if (!fabricEnabled) return;
  await submit("DenyAccess", recordId, doctorId, patientId);
}

export async function revokeAccess(recordId: number, doctorId: number, patientId: number) {
  if (!fabricEnabled) return;
  await submit("RevokeAccess", recordId, doctorId, patientId);
}

// Checks consent on-chain and appends an access entry. Throws if the ledger denies access.
export async function logAccess(recordId: number, userId: number, role: string): Promise<LedgerRecord | null> {
  if (!fabricEnabled) return null;
  return JSON.parse(await submit("LogAccess", recordId, userId, role));
}

export interface LedgerConsent {
  recordId: string;
  patientId: string;
  doctorId: string;
  status: "PENDING" | "GRANTED" | "DENIED" | "REVOKED";
  updatedAt: string;
  txId: string;
}

export async function getRecord(recordId: number): Promise<LedgerRecord | null> {
  if (!fabricEnabled) return null;
  try {
    return JSON.parse(await evaluate("GetRecord", recordId));
  } catch (err: any) {
    if (/not registered on the ledger/.test(err.message)) return null;
    throw err;
  }
}

export async function getConsent(recordId: number, doctorId: number): Promise<LedgerConsent | null> {
  if (!fabricEnabled) return null;
  try {
    return JSON.parse(await evaluate("GetConsent", recordId, doctorId));
  } catch (err: any) {
    if (/No consent found/.test(err.message)) return null;
    throw err;
  }
}

export async function getAuditTrail(recordId: number): Promise<AuditEntry[] | null> {
  if (!fabricEnabled) return null;
  return JSON.parse(await evaluate("GetAuditTrail", recordId));
}

export function closeFabric() {
  gateway?.close();
  gateway = undefined;
  contract = undefined;
}
