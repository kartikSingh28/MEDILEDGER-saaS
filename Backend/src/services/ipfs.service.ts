import { create } from "ipfs-http-client";

const client = create({
  url: process.env.IPFS_NODE_URL || "http://127.0.0.1:5001"
});

export async function uploadToIPFS(buffer: Buffer) {
  try {
    const { cid } = await client.add(buffer);
    return cid.toString();
  } catch (err) {
    console.error("IPFS upload failed:", err);
    throw err;
  }
}

export async function downloadFromIPFS(cid: string) {
  try {
    const chunks: Uint8Array[] = [];

    for await (const chunk of client.cat(cid)) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (err) {
    console.error("IPFS download failed:", err);
    throw err;
  }
}
