import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { uploadToIPFS, downloadFromIPFS } from "./ipfs.service";
import { encryptBuffer, decryptBuffer } from "../utils/encryption";
import * as ledger from "./fabric.service";



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

  // Signed by the downloader: the ledger re-checks their consent and logs the access
  const anchored = await ledger.logAccess(userId, recordId);

  if (anchored && (anchored.cid !== record.cid || anchored.hash !== record.hash)) {
    throw new Error("Record metadata does not match the ledger");
  }

  const cid = anchored?.cid ?? record.cid;
  const expectedHash = anchored?.hash ?? record.hash;

  const encryptedBuffer = await downloadFromIPFS(cid);

  const newHash = crypto
    .createHash("sha256")
    .update(encryptedBuffer)
    .digest("hex");

  if (newHash !== expectedHash) {
    throw new Error("File tampered");
  }

  const decrypted = decryptBuffer(encryptedBuffer);

  return {
    buffer: decrypted,
    filename: record.filename
  };
}

export async function getAuditTrail(patientId: number, recordId: number) {
  return ledger.getAuditTrail(patientId, recordId);
}
