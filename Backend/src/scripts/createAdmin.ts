/*
  Create an ADMIN account. Public signup only allows PATIENT and DOCTOR.

  Usage: npm run create-admin -- <email> <name> <password> <hospitalId>
  (Docker: docker compose exec backend npm run create-admin -- <email> <name> <password> <hospitalId>)
  Hospital IDs: GET /hospitals
*/
import "dotenv/config";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { createUser } from "../Auth/Auth";
import { closeFabric } from "../services/fabric.service";

const args = z
  .tuple([
    z.string().email(),
    z.string().min(2).max(50).trim(),
    z.string().min(6).max(100),
    z.coerce.number().int().positive(),
  ])
  .safeParse(process.argv.slice(2));

if (!args.success) {
  console.error("Usage: npm run create-admin -- <email> <name> <password> <hospitalId>  (password min 6 chars)");
  process.exit(1);
}

const [email, name, password, hospitalId] = args.data;

createUser({ email, name, password, role: "ADMIN", hospitalId })
  .then((user) => console.log(`Created admin ${user.email} (id ${user.id})`))
  .catch((err) => {
    console.error("Failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    closeFabric();
    await prisma.$disconnect();
  });
