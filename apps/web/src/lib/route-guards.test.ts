import { describe, expect, test } from "bun:test";
import { needsConnectedPage } from "./route-guards.ts";

describe("needsConnectedPage", () => {
  test("guards the Page scoped pages", () => {
    // These all reached the API without a Page and rendered the error boundary.
    for (const pathname of ["/products", "/knowledge", "/inbox", "/comments", "/playground"]) {
      expect(needsConnectedPage(pathname)).toBe(true);
    }
  });

  test("lets the pages that must work without a Page through", () => {
    for (const pathname of ["/", "/pages", "/onboarding", "/billing", "/admin"]) {
      expect(needsConnectedPage(pathname)).toBe(false);
    }
  });

  test("treats a nested route as its parent", () => {
    expect(needsConnectedPage("/pages/something")).toBe(false);
    expect(needsConnectedPage("/billing/plans")).toBe(false);
  });

  test("does not mistake a route that merely starts with a page free path", () => {
    expect(needsConnectedPage("/pagesomething")).toBe(true);
    expect(needsConnectedPage("/adminish")).toBe(true);
  });

  test("guards an unknown route rather than assuming it is safe", () => {
    expect(needsConnectedPage("/whatever")).toBe(true);
  });
});
