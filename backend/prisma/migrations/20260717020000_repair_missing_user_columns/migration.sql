-- Repair columns that may be missing on databases patched outside Prisma
-- SQLite lacks IF NOT EXISTS for ADD COLUMN; use a tolerant approach via table recreate only if needed.
-- For existing DBs missing filingStatus / weeklySchedule:

-- Note: Prisma migrate will fail if columns already exist. This migration targets DBs that
-- reported add_state_tax_settings applied but never received filingStatus/weeklySchedule.

ALTER TABLE "User" ADD COLUMN "filingStatus" TEXT NOT NULL DEFAULT 'single';
ALTER TABLE "User" ADD COLUMN "weeklySchedule" TEXT;
