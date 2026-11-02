import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { META_SCOPES } from "./oauth.ts";
import { SUBSCRIBED_FIELDS } from "./pages.ts";

const RUNBOOK = new URL("../../../docs/meta-app-review.md", import.meta.url).pathname;

/**
 * The runbook is what gets submitted to Meta, so it must list exactly what the code
 * asks for. If one changes without the other, this fails rather than shipping a
 * submission that does not match the app.
 */
describe("app review runbook", () => {
  const runbook = readFileSync(RUNBOOK, "utf8");

  test("lists every scope the code requests", () => {
    for (const scope of META_SCOPES) {
      expect(runbook).toContain(`\`${scope}\``);
    }
  });

  test("does not ask for a scope the code never uses", () => {
    const documented = [...runbook.matchAll(/`(pages_[a-z_]+)`/g)].map((match) => match[1]);
    const unique = [...new Set(documented)];

    for (const scope of unique) {
      expect(META_SCOPES).toContain(scope as (typeof META_SCOPES)[number]);
    }
  });

  test("lists every webhook field the code subscribes to", () => {
    for (const field of SUBSCRIBED_FIELDS) {
      expect(runbook).toContain(`\`${field}\``);
    }
  });

  test("names the endpoints Meta has to reach", () => {
    expect(runbook).toContain("/webhooks/meta");
    expect(runbook).toContain("/data-deletion");
    expect(runbook).toContain("/privacy");
  });

  test("documents the environment the server needs", () => {
    for (const key of [
      "META_APP_ID",
      "META_APP_SECRET",
      "META_VERIFY_TOKEN",
      "META_GRAPH_VERSION",
    ]) {
      expect(runbook).toContain(key);
    }
  });
});

describe("scope set", () => {
  test("asks for no more than the six documented permissions", () => {
    const scopes: string[] = [...META_SCOPES];

    expect(scopes.sort()).toEqual(
      [
        "pages_manage_engagement",
        "pages_manage_metadata",
        "pages_messaging",
        "pages_read_engagement",
        "pages_read_user_content",
        "pages_show_list",
      ].sort(),
    );
  });

  test("subscribes to the four documented fields", () => {
    expect([...SUBSCRIBED_FIELDS]).toEqual([
      "messages",
      "messaging_postbacks",
      "message_echoes",
      "feed",
    ]);
  });
});
