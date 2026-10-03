import { prisma } from "../lib/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { Prisma } from "@prisma/client";
import { SignInInput, SignUpInput } from "../Schemas/AuthSchema";
import { fabricEnabled } from "../services/fabric.service";
import { ensureIdentity } from "../services/identity.service";

const JWT_SECRET = process.env.JWT_SECRET as string;

export async function signup(data: SignUpInput) {
  return createUser(data);
}

// Shared by signup and the create-admin script. The role is not validated
// here; signup's schema only allows PATIENT and DOCTOR.
export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: "PATIENT" | "DOCTOR" | "ADMIN";
  hospitalId: number;
}) {
  try {
    const hospital = await prisma.hospital.findUnique({ where: { id: data.hospitalId } });
    if (!hospital) throw new Error("Unknown hospital");

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role,
        hospitalId: hospital.id,
      },
    });

    // Issue the user's blockchain identity now; without it they can't act on the ledger
    if (fabricEnabled) {
      try {
        await ensureIdentity(user.id);
      } catch (err) {
        await prisma.user.delete({ where: { id: user.id } });
        throw new Error(`Could not issue blockchain identity: ${err instanceof Error ? err.message : err}`);
      }
    }

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;

  } catch (err: any) {

    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error("User already exists");
    }

    throw err;
  }
}
export async function signin(data: SignInInput) {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
    include: { hospital: { select: { id: true, name: true } } },
  });

  if (!user) throw new Error("User not found");

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) throw new Error("Wrong password");

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: "2h" }
  );

  const { passwordHash, ...safeUser } = user;

  return { user: safeUser,token };
}
