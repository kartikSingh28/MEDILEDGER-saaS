import { Router, Request, Response } from "express";

import { requireAuth, requireRole } from "../../middleware/AuthMiddleware";

import { PermissionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import * as ledger from "../services/fabric.service";


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

      try {
        await ledger.requestAccess(doctorId, record.id);
      } catch (err) {
        await prisma.permission.delete({ where: { id: permission.id } });
        throw err;
      }

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
          // Which hospital the record belongs to (cross-hospital requests)
          record: {
            include: {
              patient: { select: { hospital: { select: { name: true } } } },
            },
          },
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

      const filtered = await prisma.permission.findMany({
        where: { patientId },
        include: {
          // Never send the whole user row: it includes the password hash
          doctor: {
            select: { id: true, name: true, hospital: { select: { name: true } } },
          },
          record: true,
        },
      });

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

      if (permission.status === PermissionStatus.APPROVED) {
        return res.status(400).json({ message: "Access already approved" });
      }

      // Ledger first: Postgres must never show consent the chain doesn't have
      await ledger.grantAccess(patientId, permission.recordId, permission.doctorId);

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

      if (permission.status === PermissionStatus.DENIED) {
        return res.status(400).json({ message: "Access already denied" });
      }

      // Denying an approved request revokes it on the ledger
      if (permission.status === PermissionStatus.APPROVED) {
        await ledger.revokeAccess(patientId, permission.recordId, permission.doctorId);
      } else {
        await ledger.denyAccess(patientId, permission.recordId, permission.doctorId);
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