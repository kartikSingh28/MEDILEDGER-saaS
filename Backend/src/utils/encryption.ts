import crypto from "crypto";

/*
  Record file encryption.

  Files are encrypted with AES-256-GCM before they leave the backend, so the
  IPFS node only ever holds ciphertext. GCM is authenticated: decryption fails
  on a tag mismatch, which means a modified file is rejected here as well as by
  the hash check the consent contract performs.

  Stored layout, new files:

      "MLG1" | iv (12 bytes) | tag (16 bytes) | ciphertext

  Records uploaded before this used AES-256-CBC with a 16-byte IV and no tag.
  Those cannot be re-encrypted: the SHA-256 of their ciphertext is anchored on
  the ledger, and consents are bound to that hash, so new bytes would break the
  anchor and invalidate every grant over them. They are still readable through
  the legacy branch below, and nothing is written in that format any more.
*/

const MAGIC = Buffer.from("MLG1", "ascii");
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

// Legacy AES-256-CBC records
const LEGACY_IV_LENGTH = 16;

function fileKey(): Buffer {
  const secret = process.env.FILE_SECRET;
  if (!secret) {
    throw new Error("FILE_SECRET must be set to encrypt and read record files");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptBuffer(buffer: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", fileKey(), iv);

  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);

  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptBuffer(buffer: Buffer): Buffer {
  if (!isCurrentFormat(buffer)) {
    return decryptLegacyCbc(buffer);
  }

  const iv = buffer.subarray(MAGIC.length, MAGIC.length + IV_LENGTH);
  const tag = buffer.subarray(MAGIC.length + IV_LENGTH, MAGIC.length + IV_LENGTH + TAG_LENGTH);
  const ciphertext = buffer.subarray(MAGIC.length + IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv("aes-256-gcm", fileKey(), iv);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    // final() throws when the tag does not verify
    throw new Error("Record failed its authentication check and may have been modified");
  }
}

export function hashBuffer(buffer: Buffer): string {
  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");
}

// A legacy file opens with a random IV, so it could in principle begin with
// these four bytes; the chance is about 1 in 4 billion, and such a file would
// fail its tag check rather than decrypt to anything.
function isCurrentFormat(buffer: Buffer): boolean {
  return (
    buffer.length >= MAGIC.length + IV_LENGTH + TAG_LENGTH &&
    buffer.subarray(0, MAGIC.length).equals(MAGIC)
  );
}

// Read-only: kept so records uploaded before AES-GCM stay downloadable
function decryptLegacyCbc(buffer: Buffer): Buffer {
  const iv = buffer.subarray(0, LEGACY_IV_LENGTH);
  const ciphertext = buffer.subarray(LEGACY_IV_LENGTH);

  const decipher = crypto.createDecipheriv("aes-256-cbc", fileKey(), iv);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
