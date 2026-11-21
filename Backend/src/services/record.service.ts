import crypto from "crypto";
import { PermissionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { uploadToIPFS, downloadFromIPFS } from "./ipfs.service";
import { encryptBuffer, decryptBuffer } from "../utils/encryption";
import * as ledger from "./fabric.service";

// The consent contract ends a grant on its own when a policy stops holding.
// Mirror that into Postgres so the dashboards show why access stopped.
const outcomeToStatus: Record<string, PermissionStatus> = {
  CONSENT_EXPIRED: PermissionStatus.EXPIRED,
  CONSENT_EXHAUSTED: PermissionStatus.EXHAUSTED,
  CONSENT_INVALIDATED: PermissionStatus.INVALIDATED,
};

export async function uploadRecord(
  fileBuffer: Buffer,
  filename: string,
  patientId: number
) {

  const encryptedBuffer = encryptBuffer(fileBuffer);


  const cid = await uploadToIPFS(encryptedBuffer);


  const hash = crypto
    .createHash("sha256")
    .update(encryptedBuffer)
    .digest("hex");

  const record = await prisma.record.create({
    data: {
      filename,
      cid,
      hash,
      patientId
    }
  });

  // Anchor CID + hash on the ledger; roll back the DB row if that fails
  try {
    await ledger.registerRecord(patientId, record.id, cid, hash);
  } catch (err) {
    await prisma.record.delete({ where: { id: record.id } });
    throw err;
  }

  return record;
}

export async function downloadRecord(
  recordId: number,
  userId: number
) {
  const record = await prisma.record.findUnique({
    where: { id: recordId }
  });

  if (!record) {
    throw new Error("Record not found");
  }

  // Cheap gate: refuse before fetching the file if the ledger already says no.
  // This writes nothing, so a blocked attempt is still logged by LogAccess below.
  const permitted = await ledger.checkAccess(userId, recordId);
  if (permitted === false) {
    throw new Error("You have no consent to access this record");
  }

  // Read the anchored CID rather than trusting the Postgres row
  const anchored = await ledger.getRecord(userId, recordId);
  if (anchored && (anchored.cid !== record.cid || anchored.hash !== record.hash)) {
    throw new Error("Record metadata does not match the ledger");
  }

  const cid = anchored?.cid ?? record.cid;
  const encryptedBuffer = await downloadFromIPFS(cid);

  const observedHash = crypto
    .createHash("sha256")
    .update(encryptedBuffer)
    .digest("hex");

  // The contract re-checks consent, expiry, the usage cap and this hash against
  // the one the consent was bound to. It commits its decision either way.
  const result = await ledger.logAccess(userId, recordId, observedHash);

  if (result) {
    if (!result.allowed) {
      await mirrorOutcome(recordId, userId, result.outcome);
      throw new Error(result.reason || "The ledger refused this access");
    }
    await mirrorAccess(recordId, userId, result.accessCount);
  } else if (observedHash !== record.hash) {
    // Ledger disabled: fall back to checking against the stored hash
    throw new Error("File tampered");
  }

  const decrypted = decryptBuffer(encryptedBuffer);

  return {
    buffer: decrypted,
    filename: record.filename
  };
}

// Reflect a contract-ended consent in the permission row the UI reads
async function mirrorOutcome(recordId: number, doctorId: number, outcome: string) {
  const status = outcomeToStatus[outcome];
  if (!status) return;

  await prisma.permission.updateMany({
    where: { recordId, doctorId },
    data: { status, allowed: false },
  });
}

async function mirrorAccess(recordId: number, doctorId: number, accessCount: number) {
  if (!accessCount) return;

  await prisma.permission.updateMany({
    where: { recordId, doctorId },
    data: { accessCount },
  });
}

export async function getAuditTrail(patientId: number, recordId: number) {
  return ledger.getAuditTrail(patientId, recordId);
}
