-- Consent terms: purpose, expiry, usage cap and break-glass access.
-- The ledger enforces all of these; these columns mirror it for the dashboards.

-- CreateEnum
CREATE TYPE "AccessPurpose" AS ENUM ('TREATMENT', 'DIAGNOSIS', 'EMERGENCY', 'INSURANCE', 'RESEARCH');

-- AlterEnum
-- Statuses the consent contract sets on its own when a grant stops being valid
ALTER TYPE "PermissionStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "PermissionStatus" ADD VALUE 'EXHAUSTED';
ALTER TYPE "PermissionStatus" ADD VALUE 'INVALIDATED';

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "purpose" "AccessPurpose" NOT NULL DEFAULT 'TREATMENT',
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "maxAccesses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "accessCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emergency" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reason" TEXT;
