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

const PROFILE_FIELDS = "about,description,phone,address,website,emails,hours";

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
    address: toNullableString(response.address),
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
