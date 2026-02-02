import crypto from "crypto";
import fs from "fs";

const key=crypto
.createHash("sha256")
.update(process.env.FILE_SECRET || "kartik_secret") 
.digest();

//encrypt file
export function encryptFile(input: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

    const inputStream = fs.createReadStream(input);
    const outputStream = fs.createWriteStream(output);

    outputStream.write(iv);

    inputStream
      .pipe(cipher)
      .pipe(outputStream)
      .on("finish", resolve)
      .on("error", reject);
  });
}


//Sha256 hash
export function hashFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");

    fs.createReadStream(path)
      .on("data", d => hash.update(d))
      .on("end", () => resolve(hash.digest("hex")))
      .on("error", reject);
  });
}

export function decryptFile(input: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iv = Buffer.alloc(16);

    const fd = fs.openSync(input, "r");
    fs.readSync(fd, iv, 0, 16, 0);
    fs.closeSync(fd);

    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

    fs.createReadStream(input, { start: 16 })
      .pipe(decipher)
      .pipe(fs.createWriteStream(output))
      .on("finish", resolve)
      .on("error", reject);
  });
}

