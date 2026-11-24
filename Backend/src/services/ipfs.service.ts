/*
  IPFS storage, with two drivers.

  - Local / self-hosted: a kubo node over its HTTP API (docker compose runs one).
  - Hosted: Pinata, for platforms like Railway where you cannot run a kubo
    sidecar. Selected automatically when PINATA_JWT is set.

  Files are already encrypted with AES-256-GCM before they reach here, so what
  is pinned is ciphertext. That is what makes a public pinning service
  acceptable: a gateway operator holds bytes they cannot read.
*/

const PINATA_API = "https://api.pinata.cloud";

const pinataJwt = process.env.PINATA_JWT;
const pinataGateway = (process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud").replace(/\/$/, "");

export const usingPinata = Boolean(pinataJwt);

/* =========================
   kubo (local node)
========================= */

// Imported lazily so a Pinata deployment never opens a connection to a node
// that isn't there.
type KuboClient = {
  add(data: Buffer): Promise<{ cid: { toString(): string } }>;
  cat(cid: string): AsyncIterable<Uint8Array>;
};

let kubo: KuboClient | null = null;

async function kuboClient(): Promise<KuboClient> {
  if (!kubo) {
    const { create } = await import("ipfs-http-client");
    kubo = create({ url: process.env.IPFS_NODE_URL || "http://127.0.0.1:5001" }) as unknown as KuboClient;
  }
  return kubo;
}

/* =========================
   Pinata (hosted)
========================= */

async function pinataUpload(buffer: Buffer): Promise<string> {
  const form = new FormData();
  // The name is cosmetic — it only labels the pin in Pinata's dashboard.
  form.append("file", new Blob([new Uint8Array(buffer)]), "record.enc");

  const res = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
    method: "POST",
    headers: { Authorization: `Bearer ${pinataJwt}` },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Pinata upload failed (${res.status}): ${await res.text()}`);
  }

  const { IpfsHash } = (await res.json()) as { IpfsHash?: string };
  if (!IpfsHash) {
    throw new Error("Pinata upload returned no CID");
  }
  return IpfsHash;
}

async function pinataDownload(cid: string): Promise<Buffer> {
  const res = await fetch(`${pinataGateway}/ipfs/${cid}`);

  if (!res.ok) {
    throw new Error(`Pinata fetch failed (${res.status}) for ${cid}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/* =========================
   Public API
========================= */

export async function uploadToIPFS(buffer: Buffer): Promise<string> {
  try {
    if (pinataJwt) {
      return await pinataUpload(buffer);
    }
    const { cid } = await (await kuboClient()).add(buffer);
    return cid.toString();
  } catch (err) {
    console.error("IPFS upload failed:", err);
    throw err;
  }
}

export async function downloadFromIPFS(cid: string): Promise<Buffer> {
  try {
    if (pinataJwt) {
      return await pinataDownload(cid);
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of (await kuboClient()).cat(cid)) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (err) {
    console.error("IPFS download failed:", err);
    throw err;
  }
}
