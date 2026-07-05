CREATE TABLE "attachments" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "storage_provider" TEXT NOT NULL,
  "storage_key" TEXT NOT NULL,
  "checksum_sha256" TEXT,
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attachments_tenant_id_idx" ON "attachments"("tenant_id");
CREATE INDEX "attachments_target_type_target_id_idx" ON "attachments"("target_type", "target_id");
CREATE INDEX "attachments_storage_provider_idx" ON "attachments"("storage_provider");
CREATE INDEX "attachments_deleted_at_idx" ON "attachments"("deleted_at");

ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
