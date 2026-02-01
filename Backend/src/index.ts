import express from "express";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

const app = express();
app.use(express.json());

app.get("/", async (_req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

app.listen(5000, () => {
  console.log(" Server running on http://localhost:5000");
});
