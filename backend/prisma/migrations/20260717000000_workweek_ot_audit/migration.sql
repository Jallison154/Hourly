-- AlterTable
ALTER TABLE "User" ADD COLUMN "overtimeThresholdHours" REAL NOT NULL DEFAULT 40;
ALTER TABLE "User" ADD COLUMN "workweekStartDay" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminSubject" TEXT NOT NULL,
    "affectedUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousValues" TEXT,
    "newValues" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AdminAuditLog_affectedUserId_idx" ON "AdminAuditLog"("affectedUserId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
