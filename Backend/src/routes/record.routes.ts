import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "../../middleware/AuthMiddleware";
import { upload } from "../../config/multer";
import { uploadRecord,downloadRecord } from "../services/record.service";

const recordRouter = Router();

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

      const record = await uploadRecord(
        req.file.path,
        (req as any).user.userId
      );

      res.status(201).json({
        message: "Uploaded successfully",
        record,
      });
    } catch (e: any) {
      res.status(500).json({
        error: e.message,
      });
    }
  }
);

//download route
recordRouter.get("/:id", requireAuth, async (req, res) => {
  try {
    const path = await downloadRecord(
      Number(req.params.id),
      (req as any).user.userId
    );

    return res.download(path);   // ⭐ THIS IS CRITICAL
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});



export default recordRouter;
