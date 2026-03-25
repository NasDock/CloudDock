-- CreateTable
CREATE TABLE "request_devices" (
  "request_device_id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "name" TEXT,
  "platform" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "last_seen" DATETIME,
  "last_ip" TEXT,
  "user_agent" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "request_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("userId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "request_devices_user_id_device_id_key" ON "request_devices"("user_id", "device_id");

-- CreateIndex
CREATE INDEX "request_devices_user_id_idx" ON "request_devices"("user_id");

-- CreateIndex
CREATE INDEX "request_devices_status_idx" ON "request_devices"("status");
