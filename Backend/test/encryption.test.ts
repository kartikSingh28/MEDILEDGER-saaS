/*
  Record file encryption tests.

  Covers the AES-256-GCM round trip, rejection of modified ciphertext, and the
  read path for records written before GCM — those cannot be re-encrypted
  because their hashes are anchored on the ledger.

  Run: npm test
*/
import assert from "assert";
import crypto from "crypto";

process.env.FILE_SECRET = process.env.FILE_SECRET || "test-secret";

import { decryptBuffer, encryptBuffer, hashBuffer } from "../src/utils/encryption";

let pass = 0;
let fail = 0;

function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok   ${label}`);
    pass++;
  } catch (err) {
    console.log(` FAIL  ${label}\n         ${(err as Error).message}`);
    fail++;
  }
}

// Writes a file the way the old AES-256-CBC path did: [iv 16][ciphertext]
function legacyCbcEncrypt(plaintext: Buffer, secret: string): Buffer {
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([iv, cipher.update(plaintext), cipher.final()]);
}

const plaintext = Buffer.from("Patient 1 — blood panel, 2026-11-21. Hb 13.4 g/dL.", "utf8");

console.log("\nAES-256-GCM");

check("round trips", () => {
  assert.deepStrictEqual(decryptBuffer(encryptBuffer(plaintext)), plaintext);
});

check("writes the versioned format", () => {
  assert.strictEqual(encryptBuffer(plaintext).subarray(0, 4).toString("ascii"), "MLG1");
});

check("ciphertext does not contain the plaintext", () => {
  assert.strictEqual(encryptBuffer(plaintext).includes(plaintext), false);
});

check("a fresh IV each time, so two encryptions differ", () => {
  assert.notDeepStrictEqual(encryptBuffer(plaintext), encryptBuffer(plaintext));
});

check("handles an empty file", () => {
  assert.deepStrictEqual(decryptBuffer(encryptBuffer(Buffer.alloc(0))), Buffer.alloc(0));
});

check("handles a file larger than one block", () => {
  const big = crypto.randomBytes(1024 * 64);
  assert.deepStrictEqual(decryptBuffer(encryptBuffer(big)), big);
});

console.log("\ntamper detection");

check("a flipped ciphertext byte is rejected", () => {
  const sealed = encryptBuffer(plaintext);
  sealed[sealed.length - 1] ^= 0xff;
  assert.throws(() => decryptBuffer(sealed), /authentication check/);
});

check("a flipped authentication tag is rejected", () => {
  const sealed = encryptBuffer(plaintext);
  sealed[4 + 12] ^= 0xff; // first byte of the tag
  assert.throws(() => decryptBuffer(sealed), /authentication check/);
});

check("a wrong key is rejected", () => {
  const sealed = encryptBuffer(plaintext);
  const original = process.env.FILE_SECRET;
  process.env.FILE_SECRET = "a-different-secret";
  try {
    assert.throws(() => decryptBuffer(sealed), /authentication check/);
  } finally {
    process.env.FILE_SECRET = original;
  }
});

console.log("\nlegacy AES-256-CBC records");

check("records written before GCM still decrypt", () => {
  const legacy = legacyCbcEncrypt(plaintext, process.env.FILE_SECRET!);
  assert.deepStrictEqual(decryptBuffer(legacy), plaintext);
});

check("a legacy record is not mistaken for the new format", () => {
  const legacy = legacyCbcEncrypt(plaintext, process.env.FILE_SECRET!);
  assert.notStrictEqual(legacy.subarray(0, 4).toString("ascii"), "MLG1");
});

console.log("\nhashing and configuration");

check("hashBuffer is stable and 64 hex characters", () => {
  const a = hashBuffer(plaintext);
  assert.strictEqual(a, hashBuffer(plaintext));
  assert.match(a, /^[0-9a-f]{64}$/);
});

check("encryption refuses to run without FILE_SECRET", () => {
  const original = process.env.FILE_SECRET;
  delete process.env.FILE_SECRET;
  try {
    assert.throws(() => encryptBuffer(plaintext), /FILE_SECRET must be set/);
  } finally {
    process.env.FILE_SECRET = original;
  }
});

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exitCode = 1;
