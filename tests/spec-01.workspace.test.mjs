/**
 * spec-01.workspace workspace 级结构测试。
 * 验证仓库脚本、迁移或文档约定，补足单个应用包无法覆盖的集成规则。
 * 依赖：Node test runner；被用于：pnpm test:workspace。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

function readUtf8(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("SPEC-01 creates the monorepo workspace layout", () => {
  const requiredPaths = [
    "package.json",
    "pnpm-workspace.yaml",
    "tsconfig.base.json",
    "docker-compose.yml",
    "eslint.config.mjs",
    "playwright.config.ts",
    "apps/api/package.json",
    "apps/api/src/main.ts",
    "apps/api/src/app.module.ts",
    "apps/web/package.json",
    "apps/web/index.html",
    "apps/web/src/main.tsx",
    "apps/web/src/App.tsx",
    "apps/web/src/styles.css",
    "packages/shared/package.json",
    "packages/shared/src/index.ts",
  ];

  for (const relativePath of requiredPaths) {
    assert.equal(
      existsSync(path.join(repoRoot, relativePath)),
      true,
      `${relativePath} should exist`,
    );
  }
});

test("SPEC-01 declares pnpm workspaces for apps and packages", () => {
  const workspaceFile = readUtf8("pnpm-workspace.yaml");

  assert.match(workspaceFile, /apps\/\*/, "workspace should include apps/*");
  assert.match(
    workspaceFile,
    /packages\/\*/,
    "workspace should include packages/*",
  );
});
