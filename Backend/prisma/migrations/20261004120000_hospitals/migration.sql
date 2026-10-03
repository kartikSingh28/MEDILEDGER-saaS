-- CreateTable
CREATE TABLE "Hospital" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "mspId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Hospital_name_key" ON "Hospital"("name");
CREATE UNIQUE INDEX "Hospital_mspId_key" ON "Hospital"("mspId");

-- One hospital per Fabric organization in the network
INSERT INTO "Hospital" ("name", "mspId") VALUES
    ('City General Hospital', 'Org1MSP'),
    ('Metro Care Hospital', 'Org2MSP');

-- Existing users join the first hospital
ALTER TABLE "User" ADD COLUMN "hospitalId" INTEGER;
UPDATE "User" SET "hospitalId" = (SELECT "id" FROM "Hospital" WHERE "mspId" = 'Org1MSP');
ALTER TABLE "User" ALTER COLUMN "hospitalId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
