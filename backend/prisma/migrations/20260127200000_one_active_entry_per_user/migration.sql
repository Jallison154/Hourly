-- Enforce at most one open entry per user.
-- If this fails with "UNIQUE constraint failed", fix duplicate open entries first, e.g.:
--   For each user with multiple open entries, set clockOut = clockIn on all but the
--   one with the latest clockIn, then re-run the migration.
CREATE UNIQUE INDEX "TimeEntry_userId_clockOut_null_key"
ON "TimeEntry"("userId") WHERE "clockOut" IS NULL;
