import type { GraphApi } from "./graph.ts";

export type FacebookPageProfile = {
  about: string | null;
  description: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  emails: string[] | null;
  hours: Record<string, string> | null;
};

/**
 * A Page has no `address` field any more: asking for it fails the whole request
 * with "(#100) Tried accessing nonexisting field (address)", which used to leave
 * every Page stuck on the pending sync. `location` is the field that carries it.
 */
const PROFILE_FIELDS = "about,description,phone,location,website,emails,hours";

const LOCATION_PARTS = ["street", "city", "zip", "country"] as const;

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toEmails(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const emails = value.filter((item): item is string => typeof item === "string");

  return emails.length > 0 ? emails : null;
}

function toHours(value: unknown): Record<string, string> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const hours = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );

  return hours.length > 0 ? Object.fromEntries(hours) : null;
}

function toAddress(value: unknown): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const location = value as Record<string, unknown>;
  const parts = LOCATION_PARTS.map((part) => toNullableString(location[part])).filter(
    (part): part is string => part !== null,
  );

  return parts.length > 0 ? parts.join(", ") : null;
}

export async function fetchPageProfile(
  graphApi: GraphApi,
  options: { pageId: string; pageAccessToken: string },
): Promise<FacebookPageProfile> {
  const response = await graphApi.request<Record<string, unknown>>(`/${options.pageId}`, {
    accessToken: options.pageAccessToken,
    params: { fields: PROFILE_FIELDS },
  });

  return {
    about: toNullableString(response.about),
    description: toNullableString(response.description),
    phone: toNullableString(response.phone),
    address: toAddress(response.location),
    website: toNullableString(response.website),
    emails: toEmails(response.emails),
    hours: toHours(response.hours),
  };
}

export function profileLines(profile: FacebookPageProfile): string[] {
  const lines: string[] = [];

  if (profile.about) lines.push(`About: ${profile.about}`);
  if (profile.description) lines.push(`Description: ${profile.description}`);
  if (profile.phone) lines.push(`Phone: ${profile.phone}`);
  if (profile.address) lines.push(`Address: ${profile.address}`);
  if (profile.website) lines.push(`Website: ${profile.website}`);
  if (profile.emails) lines.push(`Email: ${profile.emails.join(", ")}`);

  if (profile.hours) {
    const hours = Object.entries(profile.hours)
      .map(([window, value]) => `${window}: ${value}`)
      .join(", ");

    if (hours.length > 0) {
      lines.push(`Opening hours: ${hours}`);
    }
  }

  return lines;
}
