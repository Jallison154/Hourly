-- CreateTable Company
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Hourly Company',
    "logoUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Denver',
    "workWeekStartDay" INTEGER NOT NULL DEFAULT 0,
    "overtimeThresholdMinutes" INTEGER NOT NULL DEFAULT 2400,
    "overtimeMultiplier" REAL NOT NULL DEFAULT 1.5,
    "defaultPayPeriodType" TEXT NOT NULL DEFAULT 'monthly',
    "payPeriodEndDay" INTEGER NOT NULL DEFAULT 10,
    "longShiftWarningMinutes" INTEGER NOT NULL DEFAULT 720,
    "allowEmployeeManualEntries" BOOLEAN NOT NULL DEFAULT true,
    "allowEmployeeEditing" BOOLEAN NOT NULL DEFAULT true,
    "requireTimesheetApproval" BOOLEAN NOT NULL DEFAULT false,
    "registrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "paycheckEstimatesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "taxEstimatesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "scheduleEnabled" BOOLEAN NOT NULL DEFAULT true,
    "importEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed singleton company
INSERT INTO "Company" ("id", "name", "createdAt", "updatedAt")
VALUES ('default-company', 'Hourly Company', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable User: roles + company + manager
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'EMPLOYEE';
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "companyId" TEXT;
ALTER TABLE "User" ADD COLUMN "managerId" TEXT;
ALTER TABLE "User" ADD COLUMN "mustResetPassword" BOOLEAN NOT NULL DEFAULT false;

-- Attach existing users to default company
UPDATE "User" SET "companyId" = 'default-company' WHERE "companyId" IS NULL;

-- AlterTable TimeEntry
ALTER TABLE "TimeEntry" ADD COLUMN "companyId" TEXT;
UPDATE "TimeEntry" SET "companyId" = 'default-company' WHERE "companyId" IS NULL;

-- CreateTable Invitation
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "companyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "acceptedAt" DATETIME,
    "invitedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateTable Timesheet
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "submittedAt" DATETIME,
    "submittedById" TEXT,
    "approvedAt" DATETIME,
    "approvedById" TEXT,
    "rejectedAt" DATETIME,
    "rejectedById" TEXT,
    "rejectionReason" TEXT,
    "lockedAt" DATETIME,
    "lockedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Timesheet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Timesheet_userId_periodStart_periodEnd_key" ON "Timesheet"("userId", "periodStart", "periodEnd");
CREATE INDEX "Timesheet_userId_idx" ON "Timesheet"("userId");
CREATE INDEX "Timesheet_status_idx" ON "Timesheet"("status");
CREATE INDEX "Timesheet_companyId_idx" ON "Timesheet"("companyId");

-- CreateTable CorrectionRequest
CREATE TABLE "CorrectionRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT,
    "timeEntryId" TEXT,
    "timesheetId" TEXT,
    "requestedChange" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CorrectionRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CorrectionRequest_employeeId_idx" ON "CorrectionRequest"("employeeId");
CREATE INDEX "CorrectionRequest_status_idx" ON "CorrectionRequest"("status");

-- CreateTable AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "companyId" TEXT,
    "targetUserId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "previousValues" TEXT,
    "newValues" TEXT,
    "reason" TEXT,
    "requestId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX "AuditLog_targetUserId_idx" ON "AuditLog"("targetUserId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_companyId_idx" ON "AuditLog"("companyId");

CREATE INDEX "TimeEntry_companyId_idx" ON "TimeEntry"("companyId");
