/**
 * mainline 浏览器端到端规格。
 * 通过真实页面和 API 服务验证主线流程，补足组件测试看不到的布局与集成风险。
 * 依赖：Playwright 与本地 Web/API 服务；被用于：pnpm test:e2e。
 */
import { expect, test } from "@playwright/test";
import { execSync } from "node:child_process";

import { Prisma, PrismaClient } from "@prisma/client";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://codeworks@127.0.0.1:55432/codeworks?schema=public";
const DEMO_LOGIN = {
  email: "demo.pm@codeworks.test",
  password: "CodeworksDemo2026!",
  tenantSlug: "demo"
} as const;

function seedDemoData() {
  execSync("pnpm db:seed", {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl
    },
    shell: true,
    stdio: "inherit"
  });
}

async function createForeignTask() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    }
  });

  try {
    const tenant = await prisma.tenant.upsert({
      where: { slug: "foreign-e2e" },
      update: { name: "Foreign E2E Tenant", seatLimit: 2, deletedAt: null },
      create: { name: "Foreign E2E Tenant", slug: "foreign-e2e", seatLimit: 2 }
    });
    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: `Foreign Customer ${Date.now()}`,
        status: "ACTIVE"
      }
    });
    const project = await prisma.project.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        name: `Foreign Project ${Date.now()}`,
        status: "ACTIVE",
        projectManagerId: "foreign-user"
      }
    });
    const task = await prisma.backlogTask.create({
      data: {
        tenantId: tenant.id,
        projectId: project.id,
        title: `Foreign Task ${Date.now()}`,
        estimateHours: new Prisma.Decimal("4.00"),
        status: "TODO",
        boardColumn: "TODO"
      }
    });

    return task.id;
  } finally {
    await prisma.$disconnect();
  }
}

test.beforeEach(async ({ page }) => {
  await seedDemoData();
  await page.goto("/login");
  await page.evaluate(() => window.localStorage.clear());
});

test("runs the real project-to-PnL mainline through the UI", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(DEMO_LOGIN.email);
  await page.getByLabel("密码").fill(DEMO_LOGIN.password);
  const loginResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/auth/login")
  );
  await page.getByRole("button", { name: "进入工作台" }).click();
  const loginResponse = await loginResponsePromise;
  await expect(loginResponse.status(), await loginResponse.text()).toBe(200);

  await expect(page.getByRole("heading", { name: "经营中枢" })).toBeVisible();

  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "项目作战台" })).toBeVisible();
  await expect(page.getByText("Acme ERP Launch")).toBeVisible();
  await expect(page.getByText("Confirm implementation scope")).toBeVisible();

  await page.getByLabel("计划排期").fill("42");
  await page.getByRole("button", { name: "保存排期" }).click();
  await expect(page.getByRole("status")).toHaveText("产能过载");

  await page.getByLabel("实际工时").fill("10");
  await page.getByRole("button", { name: "校正工时" }).click();
  await expect(page.getByRole("status")).toHaveText("成本信号已更新");

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "实时盈亏" })).toBeVisible();
  await expect(page.getByText("Acme ERP Launch")).toBeVisible();
  await expect(page.getByText("¥100,000")).toBeVisible();
  await expect(page.getByText("¥3,200")).toBeVisible();
  await expect(page.getByText("¥96,800")).toBeVisible();
  await expect(page.getByText("86h / 40h")).toBeVisible();
});

test("rejects cross-tenant project workflow access through the real API", async ({
  request
}) => {
  await seedDemoData();
  const foreignTaskId = await createForeignTask();
  const login = await request.post("/api/auth/login", {
    data: {
      email: DEMO_LOGIN.email,
      password: DEMO_LOGIN.password,
      tenantSlug: DEMO_LOGIN.tenantSlug
    }
  });
  expect(login.status(), await login.text()).toBe(200);
  const session = await login.json();

  const response = await request.patch(`/api/core/tasks/${foreignTaskId}/move`, {
    data: { boardColumn: "DONE" },
    headers: {
      authorization: `Bearer ${session.accessToken}`
    }
  });

  expect(response.status()).toBeGreaterThanOrEqual(400);
  expect(response.status()).toBeLessThan(500);
});
