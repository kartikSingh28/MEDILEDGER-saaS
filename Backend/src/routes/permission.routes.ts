import { Router, Request, Response } from "express";

import { requireAuth, requireRole } from "../../middleware/AuthMiddleware";

import { PermissionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";


const PermissionRouter = Router();

PermissionRouter.post(
  "/request",
  requireAuth,
  requireRole("DOCTOR"),
  async (req: Request, res: Response) => {
    try {
      const doctorId = Number((req as any).user.userId);
      const { recordId } = req.body;

      if (!recordId) {
        return res.status(400).json({ message: "Record ID required" });
      }

      // Find record to get patientId
      const record = await prisma.record.findUnique({
        where: { id: Number(recordId) },
      });

      if (!record) {
        return res.status(404).json({ message: "Record not found" });
      }

      // Prevent duplicate request
      const existing = await prisma.permission.findFirst({
        where: {
          recordId: record.id,
          doctorId,
        },
      });

      if (existing) {
        return res
          .status(400)
          .json({ message: "Access request already exists" });
      }

      const permission = await prisma.permission.create({
        data: {
          recordId: record.id,
          doctorId,
          patientId: record.patientId,
          status: PermissionStatus.PENDING,
          allowed: false,
        },
      });

      res.status(201).json({
        message: "Access request sent successfully",
        permission,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

PermissionRouter.get(
  "/mine",
  requireAuth,
  requireRole("DOCTOR"),
  async (req: Request, res: Response) => {
    try {
      const doctorId = Number((req as any).user.userId);

      const requests = await prisma.permission.findMany({
        where: { doctorId },
        include: {
          record: true,
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({ requests });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

PermissionRouter.get(
  "/for-patient",
  requireAuth,
  requireRole("PATIENT"),
  async (req: Request, res: Response) => {
    try {
      const patientId = Number((req as any).user.userId);

      console.log("🔵 Logged in patient:", patientId);

      const allPermissions = await prisma.permission.findMany();
      console.log("🔴 ALL PERMISSIONS:", allPermissions);

      const filtered = await prisma.permission.findMany({
        where: { patientId },
        include: {
          doctor: true,
          record: true,
        },
      });

      console.log("🟢 FILTERED PERMISSIONS:", filtered);

      res.json({ requests: filtered });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);
PermissionRouter.post(
  "/approve/:id",
  requireAuth,
  requireRole("PATIENT"),
  async (req: Request, res: Response) => {
    try {
      const patientId = Number((req as any).user.userId);
      const permissionId = Number(req.params.id);

      const permission = await prisma.permission.findUnique({
        where: { id: permissionId },
      });

      if (!permission || permission.patientId !== patientId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updated = await prisma.permission.update({
        where: { id: permissionId },
        data: {
          status: PermissionStatus.APPROVED,
          allowed: true,
        },
      });

      res.json({
        message: "Access approved",
        permission: updated,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

PermissionRouter.post(
  "/deny/:id",
  requireAuth,
  requireRole("PATIENT"),
  async (req: Request, res: Response) => {
    try {
      const patientId = Number((req as any).user.userId);
      const permissionId = Number(req.params.id);

      const permission = await prisma.permission.findUnique({
        where: { id: permissionId },
      });

      if (!permission || permission.patientId !== patientId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updated = await prisma.permission.update({
        where: { id: permissionId },
        data: {
          status: PermissionStatus.DENIED,
          allowed: false,
        },
      });

      res.json({
        message: "Access denied",
        permission: updated,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);
export default PermissionRouter;