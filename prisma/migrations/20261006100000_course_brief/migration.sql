-- Brief lié (app briefs-photorunning)
ALTER TABLE "course" ADD COLUMN IF NOT EXISTS "briefId" TEXT;
ALTER TABLE "course" ADD COLUMN IF NOT EXISTS "briefUrl" TEXT;
