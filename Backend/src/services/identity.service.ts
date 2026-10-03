import fs from "fs";
import path from "path";
import crypto from "crypto";
import https from "https";
import FabricCAServices from "fabric-ca-client";
import { User } from "fabric-common";
import { prisma } from "../lib/prisma";
import { cryptoPath, orgConfig, OrgConfig } from "./fabric.orgs";

/*
  Per-user Fabric identities.

  Every MediLedger user gets an X.509 certificate from their hospital's Fabric CA
  (each hospital is its own Fabric organization) with their user ID and role
  embedded as certificate attributes. The chaincode reads those attributes and the
  issuing organization from the signing certificate, so the ledger knows who acted
  from the signature itself rather than from IDs the backend passes in.

  Keys are custodial: stored in Postgres, encrypted with WALLET_SECRET, and used
  by the backend to sign on the user's behalf.
*/

export interface LedgerIdentity {
  userId: number;
  mspId: string;
  certificate: string;
  privateKey: crypto.KeyObject;
}

// test-network bootstraps every CA with the same registrar
const registrarId = process.env.FABRIC_CA_ADMIN || "admin";
const registrarSecret = process.env.FABRIC_CA_ADMIN_SECRET || "adminpw";

/* =========================
   Key encryption at rest
========================= */

function walletKey(): Buffer {
  const secret = process.env.WALLET_SECRET;
  if (!secret) {
    throw new Error("WALLET_SECRET must be set to store blockchain identities");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptKey(pem: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", walletKey(), iv);
  const encrypted = Buffer.concat([cipher.update(pem, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

function decryptKey(stored: string): string {
  const data = Buffer.from(stored, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", walletKey(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
}

// Deterministic per-user enrollment secret, so an identity can always be
// re-issued (e.g. after the wallet row is lost) without storing the secret.
function enrollmentSecret(enrollmentId: string): string {
  return crypto.createHmac("sha256", walletKey()).update(`enroll:${enrollmentId}`).digest("hex");
}

/* =========================
   Fabric CA
========================= */

// One CA client and registrar per hospital, keyed by MSP ID
const cas = new Map<string, { ca: FabricCAServices; fingerprint: string }>();
const registrars = new Map<string, User>();

// fabric-ca-client adds a 'timeout' listener to the socket on every request and
// never removes it. Node's keep-alive agent reuses sockets, so listeners pile up
// (MaxListenersExceededWarning). Give each CA request its own connection instead.
const noKeepAlive = new https.Agent({ keepAlive: false });

function disableKeepAlive(service: FabricCAServices) {
  const client = (service as unknown as { _fabricCAClient?: { _httpClient?: unknown } })._fabricCAClient;
  if (client && client._httpClient === https) {
    client._httpClient = {
      request: (options: https.RequestOptions, callback?: (res: import("http").IncomingMessage) => void) =>
        https.request({ ...options, agent: noKeepAlive }, callback),
    };
  }
}

function getCA(org: OrgConfig): { ca: FabricCAServices; fingerprint: string } {
  let entry = cas.get(org.mspId);
  if (!entry) {
    const caCert = fs.readFileSync(path.join(cryptoPath, org.caCertFile), "utf8");
    const ca = new FabricCAServices(org.caUrl, { trustedRoots: [caCert], verify: true }, org.caName);
    disableKeepAlive(ca);
    entry = { ca, fingerprint: new crypto.X509Certificate(caCert).fingerprint256 };
    cas.set(org.mspId, entry);
  }
  return entry;
}

async function getRegistrar(org: OrgConfig): Promise<User> {
  let registrar = registrars.get(org.mspId);
  if (!registrar) {
    const enrollment = await getCA(org).ca.enroll({
      enrollmentID: registrarId,
      enrollmentSecret: registrarSecret,
    });
    registrar = User.createUser(
      registrarId,
      registrarSecret,
      org.mspId,
      enrollment.certificate,
      enrollment.key.toBytes()
    );
    registrars.set(org.mspId, registrar);
  }
  return registrar;
}

async function issueIdentity(userId: number, role: string, org: OrgConfig) {
  const { ca, fingerprint } = getCA(org);
  const enrollmentId = `mediledger-user-${userId}`;
  const secret = enrollmentSecret(enrollmentId);

  try {
    await ca.register(
      {
        enrollmentID: enrollmentId,
        enrollmentSecret: secret,
        role: "client",
        affiliation: org.affiliation,
        maxEnrollments: -1,
        // ecert: true puts the attribute into every certificate issued to this user
        attrs: [
          { name: "mediledger.userId", value: String(userId), ecert: true },
          { name: "mediledger.role", value: role, ecert: true },
        ],
      },
      await getRegistrar(org)
    );
  } catch (err) {
    // Already registered with this CA (concurrent request or lost wallet row): just enroll again
    if (!/already registered/i.test(String(err))) throw err;
  }

  const enrollment = await ca.enroll({ enrollmentID: enrollmentId, enrollmentSecret: secret });

  const data = {
    enrollmentId,
    mspId: org.mspId,
    certificate: enrollment.certificate,
    privateKey: encryptKey(enrollment.key.toBytes()),
    caFingerprint: fingerprint,
  };

  return prisma.fabricIdentity.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

/* =========================
   Public API
========================= */

// The Fabric organization (MSP) of the user's hospital
export async function hospitalMspOf(userId: number): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hospital: { select: { mspId: true } } },
  });
  if (!user) throw new Error(`User ${userId} not found`);
  return user.hospital.mspId;
}

// Returns the user's ledger identity, issuing one from their hospital's CA on
// first use, or again when the stored one came from a different CA (network
// reset) or a different hospital.
export async function getIdentity(userId: number): Promise<LedgerIdentity> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { hospital: true, fabricIdentity: true },
  });
  if (!user) throw new Error(`User ${userId} not found`);

  const org = orgConfig(user.hospital.mspId);
  const { fingerprint } = getCA(org);
  let stored = user.fabricIdentity;

  if (!stored || stored.mspId !== org.mspId || stored.caFingerprint !== fingerprint) {
    stored = await issueIdentity(user.id, user.role, org);
  }

  return {
    userId,
    mspId: stored.mspId,
    certificate: stored.certificate,
    privateKey: crypto.createPrivateKey(decryptKey(stored.privateKey)),
  };
}

// Called at signup so the identity exists before the user's first ledger action
export async function ensureIdentity(userId: number): Promise<void> {
  await getIdentity(userId);
}
