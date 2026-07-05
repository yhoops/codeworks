/**
 * Frontend visual quality regression checks for SPEC-05.
 * The tests exercise the real Vite/Nest pipeline and assert layout geometry
 * that screenshots alone can miss, especially dashboard spacing and overflow.
 * Depends on Playwright webServer config and seeded demo data.
 */
import { expect, test } from "@playwright/test";
import { execSync } from "node:child_process";

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

async function login(page: Parameters<typeof test>[0]["page"]) {
  const response = await page.request.post("/api/auth/login", {
    data: DEMO_LOGIN
  });
  expect(response.status(), await response.text()).toBe(200);
  const session = await response.json();
  await page.addInitScript((authSession) => {
    window.localStorage.setItem("codeworks.auth", JSON.stringify(authSession));
  }, session);
}

test.beforeEach(async ({ page }) => {
  seedDemoData();
  await login(page);
});

for (const viewport of [
  { height: 1024, name: "desktop", width: 1440 },
  { height: 844, name: "mobile", width: 390 }
]) {
  test(`keeps all core routes inside the ${viewport.name} viewport`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const route of ["/login", "/workspace", "/projects", "/dashboard"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const hasHorizontalOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
            document.documentElement.clientWidth + 1 ||
          document.body.scrollWidth > document.documentElement.clientWidth + 1
      );

      expect(hasHorizontalOverflow, `${route} should not horizontally overflow`).toBe(
        false
      );
    }
  });
}

test("keeps dashboard action and bullet bars within their visual containers", async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  const geometry = await page.evaluate(() => {
    const refresh = document.querySelector(".refresh-action")?.getBoundingClientRect();
    const canvas = document.querySelector(".finance-canvas")?.getBoundingClientRect();
    const status = document.querySelector(".finance-canvas .status-line");
    const bulletBars = Array.from(document.querySelectorAll(".bullet-chart span")).map(
      (bar) => {
        const barRect = bar.getBoundingClientRect();
        const parentRect = bar.parentElement?.getBoundingClientRect();
        return {
          barRight: barRect.right,
          parentRight: parentRect?.right ?? 0
        };
      }
    );

    return {
      bulletBars,
      canvasTop: canvas?.top ?? 0,
      refreshBottom: refresh?.bottom ?? 0,
      statusColor: status ? getComputedStyle(status).color : ""
    };
  });

  expect(geometry.canvasTop - geometry.refreshBottom).toBeGreaterThanOrEqual(16);
  expect(geometry.statusColor).toBe("rgba(255, 255, 255, 0.78)");
  for (const bar of geometry.bulletBars) {
    expect(bar.barRight).toBeLessThanOrEqual(bar.parentRight + 1);
  }
});
