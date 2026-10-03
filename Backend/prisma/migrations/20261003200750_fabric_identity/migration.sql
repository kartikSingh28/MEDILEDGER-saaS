-- CreateTable
CREATE TABLE "FabricIdentity" (
    "userId" INTEGER NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "mspId" TEXT NOT NULL,
    "certificate" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "caFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FabricIdentity_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "FabricIdentity_enrollmentId_key" ON "FabricIdentity"("enrollmentId");

-- AddForeignKey
ALTER TABLE "FabricIdentity" ADD CONSTRAINT "FabricIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
