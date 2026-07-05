/**
 * Dashboard Web 前端模块。
 * 保留页面、状态或入口的单一职责，让路由壳、数据 hooks 与组件可以独立演进。
 * 依赖：React/Vite 应用层；被用于：Web UI 与前端测试。
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { App } from "./App.js";

class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

const dashboard = (totalCost: number) => ({
  projects: [
    {
      id: "p-1",
      name: "MVP 交付",
      revenue: 10_000,
      totalCost,
      grossProfit: 10_000 - totalCost,
      grossMargin: (10_000 - totalCost) / 10_000,
      overBudget: totalCost > 10_000,
      utilization: {
        plannedHours: 45,
        availableHours: 40,
        utilizationRatio: 1.125,
        isOverloaded: true
      }
    }
  ]
});

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" }
  });

describe("Realtime PnL dashboard", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: new MemoryStorage()
    });
    window.localStorage.setItem(
      "codeworks.auth",
      JSON.stringify({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user: { id: "u-1", email: "pm@example.com", name: "项目经理" },
        tenant: { id: "t-1", slug: "acme", role: "ADMIN" }
      })
    );
    window.history.replaceState(null, "", "/dashboard");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("renders PnL and utilization charts and refreshes over-budget warnings", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(dashboard(8_000)))
      .mockResolvedValueOnce(jsonResponse(dashboard(12_000)));

    render(<App />);

    expect(await screen.findByRole("heading", { name: "实时盈亏" })).toBeTruthy();
    expect(screen.getByText("MVP 交付")).toBeTruthy();
    expect(screen.getByText("¥10,000")).toBeTruthy();
    expect(screen.getByText("¥8,000")).toBeTruthy();
    expect(screen.getByText("45h / 40h")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "刷新看板" }));

    expect(await screen.findByText("¥12,000")).toBeTruthy();
    expect(screen.getByText("超预算")).toBeTruthy();
  });
});
