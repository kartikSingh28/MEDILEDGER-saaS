/*
  Backfill the Fabric ledger from Postgres.

  Records and permissions created before FABRIC_ENABLED was turned on
  (or while the network was down / reset) are not on the ledger, so
  downloads and consent changes for them would fail. This brings the
  ledger up to the Postgres state. It reads the ledger first and only
  writes what is missing, so re-running it adds nothing to the audit trail.

  Usage: npm run fabric:sync
*/
import "dotenv/config";
import { PermissionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import * as ledger from "../services/fabric.service";

async function main() {
  if (!ledger.fabricEnabled) {
    throw new Error("FABRIC_ENABLED is not true; nothing to sync");
  }

  const records = await prisma.record.findMany({ orderBy: { id: "asc" } });
  const permissions = await prisma.permission.findMany({ orderBy: { id: "asc" } });
  let written = 0;
  const conflicts: string[] = [];

  console.log(`Checking ${records.length} records`);
  for (const r of records) {
    const anchored = await ledger.getRecord(r.id);

    if (!anchored) {
      await ledger.registerRecord(r.id, r.patientId, r.cid, r.hash);
      console.log(`  + record ${r.id} registered`);
      written++;
    } else if (anchored.cid !== r.cid || anchored.hash !== r.hash || anchored.patientId !== String(r.patientId)) {
      conflicts.push(`record ${r.id}: Postgres metadata differs from the ledger`);
    }
  }

  console.log(`Checking ${permissions.length} permissions`);
  for (const p of permissions) {
    const label = `permission ${p.id} (record ${p.recordId}, doctor ${p.doctorId})`;
    let consent = await ledger.getConsent(p.recordId, p.doctorId);

    if (!consent) {
      await ledger.requestAccess(p.recordId, p.doctorId);
      consent = await ledger.getConsent(p.recordId, p.doctorId);
      console.log(`  + ${label} requested`);
      written++;
    }

    const onChain = consent!.status;

    if (p.status === PermissionStatus.APPROVED && onChain !== "GRANTED") {
      if (onChain === "PENDING") {
        await ledger.grantAccess(p.recordId, p.doctorId, p.patientId);
        console.log(`  + ${label} granted`);
        written++;
      } else {
        // Never widen access past what the ledger says was refused
        conflicts.push(`${label}: APPROVED in Postgres but ${onChain} on the ledger`);
      }
    } else if (p.status === PermissionStatus.DENIED && onChain === "PENDING") {
      await ledger.denyAccess(p.recordId, p.doctorId, p.patientId);
      console.log(`  + ${label} denied`);
      written++;
    } else if (p.status === PermissionStatus.DENIED && onChain === "GRANTED") {
      await ledger.revokeAccess(p.recordId, p.doctorId, p.patientId);
      console.log(`  + ${label} revoked`);
      written++;
    } else if (p.status === PermissionStatus.PENDING && onChain !== "PENDING") {
      conflicts.push(`${label}: PENDING in Postgres but ${onChain} on the ledger`);
    }
  }

  console.log(`Done: ${written} ledger writes`);
  if (conflicts.length) {
    console.warn(`${conflicts.length} conflicts need a manual look (left unchanged):`);
    conflicts.forEach((c) => console.warn(`  ! ${c}`));
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("Sync failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    ledger.closeFabric();
    await prisma.$disconnect();
  });
