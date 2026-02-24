import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "../../middleware/AuthMiddleware";
import { upload } from "../../config/multer";
import { uploadRecord, downloadRecord } from "../services/record.service";
import { prisma } from "../lib/prisma";

const recordRouter = Router();

/* =========================
   Upload Record (Patient Only)
========================= */
recordRouter.post(
  "/upload",
  requireAuth,
  requireRole("PATIENT"),
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = (req as any).user.userId;

      const record = await uploadRecord(
        req.file.buffer,
        req.file.originalname,
        userId
      );

      res.status(201).json({
        message: "Uploaded successfully",
        record,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
);

recordRouter.get(
  "/mine",
  requireAuth,
  requireRole("PATIENT"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;

      const records = await prisma.record.findMany({
        where: { patientId: userId },
        orderBy: { createdAt: "desc" },
      });

      res.json(records);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
);

recordRouter.get(
  "/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const recordId = Number(req.params.id);

      // Fetch record first
      const record = await prisma.record.findUnique({
        where: { id: recordId },
      });

      if (!record) {
        return res.status(404).json({ message: "Record not found" });
      }

      /* ----------------------------------
         CASE 1: PATIENT (Owner)
      ---------------------------------- */
      if (user.role === "PATIENT") {
        if (record.patientId !== user.userId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      /* ----------------------------------
         CASE 2: DOCTOR (Check Permission)
      ---------------------------------- */
      if (user.role === "DOCTOR") {
        const permission = await prisma.permission.findFirst({
          where: {
            recordId: record.id,
            doctorId: user.userId,
            allowed: true,
          },
        });

        if (!permission) {
          return res
            .status(403)
            .json({ message: "Access denied. Not approved by patient." });
        }
      }

      /* ----------------------------------
         CASE 3: ADMIN (optional)
      ---------------------------------- */
      if (user.role === "ADMIN") {
        // Allow access or restrict based on your logic
      }

      // If passed checks → decrypt & send
      const { buffer, filename } = await downloadRecord(
        recordId,
        user.userId
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename || "file"}"`
      );

      res.send(buffer);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }
);

export default recordRouter;