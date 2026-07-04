import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

function readUtf8(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("SPEC-02 adds Prisma, schema, seed, and local database helpers", () => {
  const requiredPaths = [
    ".env.example",
    "prisma.config.ts",
    "prisma/schema.prisma",
    "prisma/seed.ts",
    "scripts/db-local.ps1",
    "apps/api/src/platform/database/prisma.client.ts"
  ];

  for (const relativePath of requiredPaths) {
    assert.equal(
      existsSync(path.join(repoRoot, relativePath)),
      true,
      `${relativePath} should exist`
    );
  }
});

test("SPEC-02 schema captures base fields, Decimal money, and default currency", () => {
  const schema = readUtf8("prisma/schema.prisma");

  assert.match(schema, /model Tenant\b/, "schema should define Tenant");
  assert.match(schema, /model Budget\b/, "schema should define Budget");
  assert.match(schema, /tenantId\s+String/, "models should carry tenantId");
  assert.match(schema, /deletedAt\s+DateTime\?/, "models should carry deletedAt");
  assert.match(schema, /Decimal/, "money should use Prisma Decimal");
  assert.match(schema, /currency\s+String\s+@default\("CNY"\)/, "currency should default to CNY");
});
