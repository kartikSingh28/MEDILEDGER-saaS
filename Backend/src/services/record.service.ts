import  fs from "fs";
import { prisma } from "../lib/prisma";
import { encryptFile,hashFile,decryptFile } from "../utils/encryption";

export async function uploadRecord(filePath:string,patientId:number){
    const encryptedPath=filePath+".enc";

    //encrypt
    await encryptFile(filePath,encryptedPath);
    //hash
    const hash= await hashFile(encryptedPath);

    //delete the original
    fs.unlinkSync(filePath);
    //savve in db
    const record=await prisma.record.create({
        data:{
            cid:encryptedPath,
            hash,
            patientId,
        },
    });
    return record;
}

//downlaoding funcn

export async function downloadRecord(recordId:number,userId:number){
    const record= await prisma.record.findUnique({
        where:{id:recordId},
    });

    if(!record){
        throw new Error("Record not found");

    }

    /*const decryptedPath=record.cid+".dec"*/
    const decryptedPath = record.cid.replace(".enc", "");
    
    await decryptFile(record.cid,decryptedPath);

    return decryptedPath;
}