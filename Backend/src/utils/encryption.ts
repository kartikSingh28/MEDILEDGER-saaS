import crypto from "crypto";
import fs from "fs";

const key=crypto
.createHash("sha256")
.update(process.env.FILE_SECRET || "kartik_secret") 
.digest();

//encrypt file
export function encryptFile(input:string,output:string){
    const iv=crypto.randomBytes(16);

    const cipher=crypto.createCipheriv("aes-256-cbc",key,iv);

    const inputStream=fs.createReadStream(input);
    const outputStream=fs.createWriteStream(output);

    outputStream.write(iv);
    inputStream.pipe(cipher).pipe(outputStream);
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