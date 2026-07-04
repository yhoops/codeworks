ALTER TABLE "tenants"
ADD COLUMN "seat_limit" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "memberships_tenant_id_user_id_key" ON "memberships"("tenant_id", "user_id");
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");
CREATE INDEX "memberships_tenant_id_status_idx" ON "memberships"("tenant_id", "status");

ALTER TABLE "memberships"
ADD CONSTRAINT "memberships_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "memberships"
ADD CONSTRAINT "memberships_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
