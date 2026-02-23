import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "../../middleware/AuthMiddleware";
import { upload } from "../../config/multer";
import { uploadRecord, downloadRecord } from "../services/record.service";
import { prisma } from "../lib/prisma";

const recordRouter = Router();

recordRouter.post(
  "/upload",
  requireAuth,
  requireRole("PATIENT"),
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      console.log(" Upload route hit");

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = (req as any).user.userId;

      const record = await uploadRecord(
        req.file.buffer,
        req.file.originalname,
        userId
      );

      console.log(" Record saved:", record);

      res.status(201).json({
        message: "Uploaded successfully",
        record,
      });
    } catch (e: any) {
      console.error(" Upload error:", e.message);
      res.status(500).json({ error: e.message });
    }
  }
);
recordRouter.get(
  "/mine",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;

      const records = await prisma.record.findMany({
        where: { patientId: userId },
        orderBy: { createdAt: "desc" }
      });

      res.json(records);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
);


/* =========================
   Download Record
========================= */
recordRouter.get(
  "/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { buffer, filename } = await downloadRecord(
        Number(req.params.id),
        (req as any).user.userId
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