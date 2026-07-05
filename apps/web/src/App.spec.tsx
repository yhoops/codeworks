import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });

describe("Codeworks front-end foundation", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: new MemoryStorage()
    });
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("redirects unauthenticated protected routes to login", async () => {
    window.history.replaceState(null, "", "/projects");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "登录 Codeworks" })).toBeTruthy();
    expect(window.location.pathname).toBe("/login");
  });

  test("enters the shell after login and sends the access token through the API client", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          accessToken: "access-token",
          refreshToken: "refresh-token",
          user: { id: "u-1", email: "pm@example.com", name: "项目经理" },
          tenant: { id: "t-1", slug: "acme", role: "OWNER" }
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ id: "u-1", email: "pm@example.com", name: "项目经理" })
      );

    render(<App />);

    await userEvent.type(screen.getByLabelText("邮箱"), "pm@example.com");
    await userEvent.type(screen.getByLabelText("密码"), "correct horse battery staple");
    await userEvent.click(screen.getByRole("button", { name: "进入工作台" }));

    expect(await screen.findByRole("heading", { name: "经营中枢" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "校验会话" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/auth/me",
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: "Bearer access-token"
          })
        })
      );
    });
  });

  test("refreshes an expired token before retrying protected API calls", async () => {
    window.localStorage.setItem(
      "codeworks.auth",
      JSON.stringify({
        accessToken: "expired-token",
        refreshToken: "refresh-token",
        user: { id: "u-1", email: "pm@example.com", name: "项目经理" },
        tenant: { id: "t-1", slug: "acme", role: "OWNER" }
      })
    );
    window.history.replaceState(null, "", "/workspace");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ message: "expired" }, 401))
      .mockResolvedValueOnce(
        jsonResponse({
          accessToken: "fresh-token",
          refreshToken: "new-refresh-token",
          user: { id: "u-1", email: "pm@example.com", name: "项目经理" },
          tenant: { id: "t-1", slug: "acme", role: "OWNER" }
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ id: "u-1", email: "pm@example.com", name: "项目经理" })
      );

    render(<App />);

    expect(await screen.findByRole("heading", { name: "经营中枢" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "校验会话" }));

    expect(await screen.findByText("会话已刷新")).toBeTruthy();
    expect(fetchSpy).toHaveBeenLastCalledWith(
      "/api/auth/me",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer fresh-token"
        })
      })
    );
  });
});
