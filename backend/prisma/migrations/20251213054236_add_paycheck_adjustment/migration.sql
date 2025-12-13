-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hourlyRate" REAL NOT NULL DEFAULT 0,
    "overtimeRate" REAL NOT NULL DEFAULT 1.5,
    "timeRoundingInterval" INTEGER NOT NULL DEFAULT 5,
    "profileImage" TEXT,
    "payPeriodType" TEXT NOT NULL DEFAULT 'monthly',
    "payPeriodEndDay" INTEGER NOT NULL DEFAULT 10,
    "paycheckAdjustment" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "hourlyRate", "id", "name", "overtimeRate", "password", "payPeriodEndDay", "payPeriodType", "profileImage", "timeRoundingInterval", "updatedAt") SELECT "createdAt", "email", "hourlyRate", "id", "name", "overtimeRate", "password", "payPeriodEndDay", "payPeriodType", "profileImage", "timeRoundingInterval", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
