/**
 * useSession hook contract tests.
 * The hook owns browser route/session state so App can remain a route composer
 * while workspace and dashboard hooks reuse the authenticated API client.
 * Depends on Vitest/jsdom storage; used by SPEC-03 refactor verification.
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { persistSession } from "../api/client.js";
import type { AuthSession } from "../api/types.js";
import { useSession } from "./useSession.js";

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

const session: AuthSession = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  tenant: { id: "t-1", role: "ADMIN", slug: "demo" },
  user: { email: "demo.pm@codeworks.test", id: "u-1", name: "Demo PM" }
};

describe("useSession", () => {
  test("initializes route and session from browser state", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: new MemoryStorage()
    });
    persistSession(session);
    window.history.replaceState(null, "", "/workspace");

    const { result } = renderHook(() => useSession());

    expect(result.current.route).toBe("/workspace");
    expect(result.current.session).toEqual(session);
    expect(result.current.status).toBe("准备连接 Codeworks API");
  });
});
