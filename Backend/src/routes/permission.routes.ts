import { Router, Request, Response } from "express";

import { requireAuth, requireRole } from "../../middleware/AuthMiddleware";

import { AccessPurpose, PermissionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import * as ledger from "../services/fabric.service";

const PermissionRouter = Router();

// Mirrors the caps the consent contract applies to break-glass access
const EMERGENCY_TTL_MINUTES = 60;
const EMERGENCY_MAX_ACCESSES = 3;

const PURPOSES = Object.values(AccessPurpose) as AccessPurpose[];

// How long a grant lasts when the patient doesn't choose
const DEFAULT_DURATION_DAYS = 30;
const MAX_DURATION_DAYS = 365;

// A doctor may re-request a record whose consent has ended; these are the
// states that no longer block a fresh request.
const CLOSED_STATUSES: PermissionStatus[] = [
  PermissionStatus.DENIED,
  PermissionStatus.EXPIRED,
  PermissionStatus.EXHAUSTED,
  PermissionStatus.INVALIDATED,
];

PermissionRouter.post(
  "/request",
  requireAuth,
  requireRole("DOCTOR"),
  async (req: Request, res: Response) => {
    try {
      const doctorId = Number((req as any).user.userId);
      const { recordId, purpose } = req.body;

      if (!recordId) {
        return res.status(400).json({ message: "Record ID required" });
      }

      const stated = String(purpose ?? "").toUpperCase() as AccessPurpose;
      if (!PURPOSES.includes(stated)) {
        return res.status(400).json({ message: `Purpose must be one of ${PURPOSES.join(", ")}` });
      }
      if (stated === AccessPurpose.EMERGENCY) {
        return res
          .status(400)
          .json({ message: "Use the emergency access route for emergency care" });
      }

      // Find record to get patientId
      const record = await prisma.record.findUnique({
        where: { id: Number(recordId) },
      });

      if (!record) {
        return res.status(404).json({ message: "Record not found" });
      }

      const existing = await prisma.permission.findFirst({
        where: {
          recordId: record.id,
          doctorId,
        },
      });

      // A request that was refused or that ran out can be made again; one that
      // is still open cannot.
      if (existing && !CLOSED_STATUSES.includes(existing.status)) {
        return res
          .status(400)
          .json({ message: "Access request already exists" });
      }

      const permission = existing
        ? await prisma.permission.update({
            where: { id: existing.id },
            data: {
              status: PermissionStatus.PENDING,
              allowed: false,
              purpose: stated,
              expiresAt: null,
              maxAccesses: 0,
              accessCount: 0,
              emergency: false,
              reason: null,
            },
          })
        : await prisma.permission.create({
            data: {
              recordId: record.id,
              doctorId,
              patientId: record.patientId,
              status: PermissionStatus.PENDING,
              allowed: false,
              purpose: stated,
            },
          });

      try {
        await ledger.requestAccess(doctorId, record.id, stated);
      } catch (err) {
        if (existing) {
          await prisma.permission.update({ where: { id: permission.id }, data: existing });
        } else {
          await prisma.permission.delete({ where: { id: permission.id } });
        }
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

/* =========================
   Emergency (break-glass) access
========================= */
// Taken by the doctor without the patient, so it is short, capped, flagged and
// audited as an emergency. The patient can revoke it like any other grant.
PermissionRouter.post(
  "/emergency",
  requireAuth,
  requireRole("DOCTOR"),
  async (req: Request, res: Response) => {
    try {
      const doctorId = Number((req as any).user.userId);
      const { recordId, reason } = req.body;

      if (!recordId) {
        return res.status(400).json({ message: "Record ID required" });
      }

      const justification = String(reason ?? "").trim();
      if (justification.length < 10) {
        return res
          .status(400)
          .json({ message: "Give a reason of at least 10 characters for emergency access" });
      }
      if (justification.length > 500) {
        return res.status(400).json({ message: "The reason must be at most 500 characters" });
      }

      const record = await prisma.record.findUnique({ where: { id: Number(recordId) } });
      if (!record) {
        return res.status(404).json({ message: "Record not found" });
      }

      const existing = await prisma.permission.findFirst({
        where: { recordId: record.id, doctorId },
      });

      if (existing?.status === PermissionStatus.APPROVED) {
        return res.status(400).json({ message: "You already have access to this record" });
      }

      // Ledger first: it is what actually permits the download
      const consent = await ledger.emergencyAccess(doctorId, record.id, justification);

      const expiresAt = consent?.expiresAt
        ? new Date(consent.expiresAt)
        : new Date(Date.now() + EMERGENCY_TTL_MINUTES * 60_000);

      const data = {
        status: PermissionStatus.APPROVED,
        allowed: true,
        purpose: AccessPurpose.EMERGENCY,
        expiresAt,
        maxAccesses: consent?.maxAccesses ?? EMERGENCY_MAX_ACCESSES,
        accessCount: 0,
        emergency: true,
        reason: justification,
      };

      const permission = existing
        ? await prisma.permission.update({ where: { id: existing.id }, data })
        : await prisma.permission.create({
            data: { ...data, recordId: record.id, doctorId, patientId: record.patientId },
          });

      res.status(201).json({
        message: `Emergency access granted until ${expiresAt.toISOString()}. The patient has been notified on the ledger.`,
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
        orderBy: { createdAt: "desc" },
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

      // Terms the patient puts on the grant. `durationDays: 0` means no expiry,
      // `maxAccesses: 0` means unlimited.
      const durationDays = numberOr(req.body?.durationDays, DEFAULT_DURATION_DAYS);
      const maxAccesses = numberOr(req.body?.maxAccesses, 0);

      if (durationDays === null || durationDays < 0 || durationDays > MAX_DURATION_DAYS) {
        return res
          .status(400)
          .json({ message: `Duration must be between 0 and ${MAX_DURATION_DAYS} days` });
      }
      if (maxAccesses === null || maxAccesses < 0) {
        return res.status(400).json({ message: "Access limit must be 0 or more" });
      }

      const permission = await prisma.permission.findUnique({
        where: { id: permissionId },
      });

      if (!permission || permission.patientId !== patientId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      if (permission.status === PermissionStatus.APPROVED) {
        return res.status(400).json({ message: "Access already approved" });
      }

      const expiresAt =
        durationDays > 0 ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000) : null;

      // Ledger first: Postgres must never show consent the chain doesn't have
      await ledger.grantAccess(patientId, permission.recordId, permission.doctorId, {
        expiresAt,
        maxAccesses,
      });

      const updated = await prisma.permission.update({
        where: { id: permissionId },
        data: {
          status: PermissionStatus.APPROVED,
          allowed: true,
          expiresAt,
          maxAccesses,
          accessCount: 0,
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

// Accepts a whole number from the request body, or the fallback when absent
function numberOr(value: unknown, fallback: number): number | null {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export default PermissionRouter;
