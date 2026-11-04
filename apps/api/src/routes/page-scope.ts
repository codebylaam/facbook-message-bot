import { type Db, listPagesForOwner } from "@fb-bot/db";
import { HTTPException } from "hono/http-exception";

export async function resolveOwnedPageId(
  db: Db,
  ownerId: string,
  requested: string | undefined,
): Promise<string> {
  const pages = await listPagesForOwner(db, ownerId);

  if (requested) {
    const match = pages.find((page) => page.id === requested);

    if (!match) {
      throw new HTTPException(404, { message: "Page not found" });
    }

    return match.id;
  }

  const [first] = pages;

  if (!first) {
    throw new HTTPException(400, { message: "Connect a Facebook Page first" });
  }

  return first.id;
}

/**
 * For pages that must render before a Page is connected, such as the overview a
 * seller lands on straight after signing up.
 */
export async function resolveOptionalPageId(
  db: Db,
  ownerId: string,
  requested: string | undefined,
): Promise<string | null> {
  const pages = await listPagesForOwner(db, ownerId);

  if (requested) {
    const match = pages.find((page) => page.id === requested);

    if (!match) {
      throw new HTTPException(404, { message: "Page not found" });
    }

    return match.id;
  }

  return pages[0]?.id ?? null;
}

export function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}
