/**
 * AppShell contract tests.
 * The shell should own the authenticated workspace frame so route pages can focus
 * on their content instead of repeating navigation markup.
 * Depends on Testing Library render; used by SPEC-04 split verification.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { AppShell } from "./AppShell.js";

describe("AppShell", () => {
  test("renders the shared navigation frame around route content", () => {
    render(
      <AppShell>
        <section aria-label="route content">Route body</section>
      </AppShell>
    );

    expect(screen.getByLabelText("主导航")).toBeTruthy();
    expect(screen.getByLabelText("route content").textContent).toBe("Route body");
  });
});
