/**
 * CorePages Web 前端模块。
 * 保留页面、状态或入口的单一职责，让路由壳、数据 hooks 与组件可以独立演进。
 * 依赖：React/Vite 应用层；被用于：Web UI 与前端测试。
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const workspace = {
  projects: [{ id: "p-1", name: "MVP 交付", status: "ACTIVE" }],
  tasks: [
    {
      id: "task-1",
      projectId: "p-1",
      sprintId: "s-1",
      title: "接入客户项目",
      status: "TODO",
      boardColumn: "TODO",
      estimateHours: 8,
      assigneeUserId: "emp-1"
    }
  ],
  employees: [{ id: "emp-1", name: "林工程师", email: "lin@example.test" }],
  timeEntries: [],
  allocations: []
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });

describe("Core project pages", () => {
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
    window.history.replaceState(null, "", "/projects");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("moves a task by drag-and-drop and syncs the board through the API", async () => {
    const pendingMove = Promise.withResolvers<Response>();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(workspace))
      .mockReturnValueOnce(pendingMove.promise);

    render(<App />);

    const task = await screen.findByText("接入客户项目");
    const doneColumn = await screen.findByRole("region", { name: "Done" });

    fireEvent.dragStart(task);
    fireEvent.drop(doneColumn);

    expect(await screen.findByText("同步中")).toBeTruthy();
    expect(doneColumn.textContent).toContain("接入客户项目");

    pendingMove.resolve(
      jsonResponse({
        task: { ...workspace.tasks[0], status: "DONE", boardColumn: "DONE" },
        timeEntry: {
          id: "te-1",
          taskId: "task-1",
          employeeId: "emp-1",
          hours: 8,
          source: "AUTO",
          note: null
        }
      })
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/core/tasks/task-1/move",
        expect.objectContaining({
          body: JSON.stringify({ boardColumn: "DONE" }),
          method: "PATCH"
        })
      );
    });
    expect(await screen.findByText("已同步")).toBeTruthy();
  });

  test("corrects actual hours and reflects the updated cost signal", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(workspace))
      .mockResolvedValueOnce(
        jsonResponse({
          timeEntry: {
            id: "te-1",
            taskId: "task-1",
            employeeId: "emp-1",
            hours: 6,
            source: "MANUAL",
            note: "实际返工少于估算"
          }
        })
      );

    render(<App />);

    await screen.findByText("接入客户项目");
    await userEvent.clear(screen.getByLabelText("实际工时"));
    await userEvent.type(screen.getByLabelText("实际工时"), "6");
    await userEvent.click(screen.getByRole("button", { name: "校正工时" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/core/time-entries",
        expect.objectContaining({
          body: JSON.stringify({
            employeeId: "emp-1",
            hours: 6,
            note: "前端校正",
            taskId: "task-1"
          }),
          method: "PATCH"
        })
      );
    });
    expect(await screen.findByText("实际工时 6h")).toBeTruthy();
    expect(screen.getByText("成本信号已更新")).toBeTruthy();
  });

  test("schedules resource allocation and warns when capacity is overloaded", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(workspace))
      .mockResolvedValueOnce(
        jsonResponse({
          allocation: {
            id: "alloc-1",
            employeeId: "emp-1",
            projectId: "p-1",
            taskId: "task-1",
            weekStart: "2026-07-06T00:00:00.000Z",
            plannedHours: 45,
            availableHoursOverride: null,
            isOverloaded: true
          },
          utilization: {
            employeeId: "emp-1",
            plannedHours: 45,
            availableHours: 40,
            utilizationRatio: 1.125,
            isOverloaded: true
          }
        })
      );

    render(<App />);

    await screen.findByText("接入客户项目");
    await userEvent.clear(screen.getByLabelText("计划排期"));
    await userEvent.type(screen.getByLabelText("计划排期"), "45");
    await userEvent.click(screen.getByRole("button", { name: "保存排期" }));

    expect(await screen.findByText("产能过载")).toBeTruthy();
    expect(screen.getByText("45h / 40h")).toBeTruthy();
  });
});
