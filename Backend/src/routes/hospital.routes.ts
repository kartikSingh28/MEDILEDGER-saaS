import { Router } from "express";
import { prisma } from "../lib/prisma";

const hospitalRouter = Router();

// Public: the signup form lists hospitals to register with
hospitalRouter.get("/", async (_req, res) => {
  try {
    const hospitals = await prisma.hospital.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });
    res.json({ hospitals });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default hospitalRouter;
