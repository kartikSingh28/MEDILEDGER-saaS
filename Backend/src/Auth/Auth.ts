import { prisma } from "../lib/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { SignInInput, SignUpInput } from "../src/Schemas/auth.schema";

const JWT_SECRET = process.env.JWT_SECRET as string;

export async function signup(data: SignUpInput) {
  try {
    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role,
      },
    });

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
