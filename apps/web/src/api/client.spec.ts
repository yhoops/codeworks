/**
 * API client split contract tests.
 * These tests pin the public imports that App and future hooks should use after
 * api-client.ts is separated into type-only and runtime client modules.
 * Depends on Vitest/jsdom fetch globals; used by SPEC-02 refactor verification.
 */
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  AUTH_STORAGE_KEY,
  createApiClient,
  persistSession,
  readStoredSession
} from "./client.js";
import type { AuthSession } from "./types.js";

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

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status
  });

describe("split API client module", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("persists and reads typed sessions through the runtime client module", () => {
    const storage = new MemoryStorage();

    persistSession(session, storage);

    expect(storage.getItem(AUTH_STORAGE_KEY)).toBe(JSON.stringify(session));
    expect(readStoredSession(storage)).toEqual(session);
  });

  test("logs in and sends the persisted access token on protected requests", async () => {
    const storage = new MemoryStorage();
    const setSession = vi.fn((nextSession: AuthSession) =>
      persistSession(nextSession, storage)
    );
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(session))
      .mockResolvedValueOnce(
        jsonResponse({ email: session.user.email, id: session.user.id, name: session.user.name })
      );

    const api = createApiClient({
      clearSession: () => storage.removeItem(AUTH_STORAGE_KEY),
      getSession: () => readStoredSession(storage),
      onReloginRequired: vi.fn(),
      setSession
    });

    await api.login(session.user.email, "CodeworksDemo2026!", session.tenant?.slug);
    await api.me();

    expect(setSession).toHaveBeenCalledWith(session);
    expect(fetchSpy).toHaveBeenLastCalledWith(
      "/api/auth/me",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer access-token"
        })
      })
    );
  });
});
