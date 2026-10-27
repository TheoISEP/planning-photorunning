-- App mobile équipe (iPhone / Android) : téléphones connectés et versions
CREATE TABLE IF NOT EXISTS "mobile_device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT '',
    "deviceName" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "osVersion" TEXT NOT NULL DEFAULT '',
    "appVersion" TEXT NOT NULL DEFAULT '',
    "buildNumber" TEXT NOT NULL DEFAULT '',
    "updateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    CONSTRAINT "mobile_device_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mobile_device_tokenHash_key" ON "mobile_device"("tokenHash");
CREATE INDEX IF NOT EXISTS "mobile_device_userId_idx" ON "mobile_device"("userId");
CREATE INDEX IF NOT EXISTS "mobile_device_revokedAt_lastSeenAt_idx" ON "mobile_device"("revokedAt", "lastSeenAt");

DO $$ BEGIN
  ALTER TABLE "mobile_device" ADD CONSTRAINT "mobile_device_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "mobile_app_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "latestVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "minVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "message" TEXT NOT NULL DEFAULT '',
    "iosUrl" TEXT NOT NULL DEFAULT '',
    "androidUrl" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    CONSTRAINT "mobile_app_config_pkey" PRIMARY KEY ("id")
);
