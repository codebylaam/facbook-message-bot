import { describe, expect, test } from "bun:test";
import type { MetaConfig } from "./config.ts";
import { createGraphApi } from "./graph.ts";
import { fetchPageProfile, profileLines } from "./profile.ts";
import { createStubFetch } from "./test-support/stub-fetch.ts";

const config: MetaConfig = {
  appId: "app-1",
  appSecret: "secret-1",
  verifyToken: "verify-1",
  graphVersion: "v23.0",
  graphBaseUrl: "https://graph.test",
};

describe("fetchPageProfile", () => {
  test("maps the profile fields", async () => {
    const { fetchImpl, searchParams } = createStubFetch([
      {
        body: {
          about: "Handmade clothing",
          description: "We ship across Bangladesh",
          phone: "+8801000000000",
          location: { street: "Badda", city: "Dhaka", zip: "1212", country: "Bangladesh" },
          website: "https://shop.test",
          emails: ["shop@test.local"],
          hours: { mon_1_open: "09:00", mon_1_close: "21:00" },
        },
      },
    ]);

    const profile = await fetchPageProfile(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "page-token",
    });

    expect(profile.about).toBe("Handmade clothing");
    expect(profile.phone).toBe("+8801000000000");
    expect(profile.address).toBe("Badda, Dhaka, 1212, Bangladesh");
    expect(profile.emails).toEqual(["shop@test.local"]);
    expect(profile.hours).toEqual({ mon_1_open: "09:00", mon_1_close: "21:00" });
    expect(searchParams(0).get("access_token")).toBe("page-token");
    expect(searchParams(0).get("fields")).toContain("about");
  });

  test("asks for location, because asking for address fails the whole request", async () => {
    const { fetchImpl, searchParams } = createStubFetch([{ body: {} }]);

    await fetchPageProfile(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "t",
    });

    const fields = searchParams(0).get("fields") ?? "";

    expect(fields).toContain("location");
    expect(fields).not.toContain("address");
  });

  test("flattens only the location parts that are set", async () => {
    const { fetchImpl } = createStubFetch([{ body: { location: { city: "Dhaka", zip: "  " } } }]);

    const profile = await fetchPageProfile(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "t",
    });

    expect(profile.address).toBe("Dhaka");
  });

  test("turns blank strings into null", async () => {
    const { fetchImpl } = createStubFetch([{ body: { about: "   ", phone: "" } }]);

    const profile = await fetchPageProfile(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "t",
    });

    expect(profile.about).toBeNull();
    expect(profile.phone).toBeNull();
  });

  test("handles missing fields", async () => {
    const { fetchImpl } = createStubFetch([{ body: {} }]);

    const profile = await fetchPageProfile(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "t",
    });

    expect(profile).toEqual({
      about: null,
      description: null,
      phone: null,
      address: null,
      website: null,
      emails: null,
      hours: null,
    });
  });

  test("drops non string emails", async () => {
    const { fetchImpl } = createStubFetch([{ body: { emails: ["a@test.local", 42, null] } }]);

    const profile = await fetchPageProfile(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "t",
    });

    expect(profile.emails).toEqual(["a@test.local"]);
  });

  test("turns an empty email list into null", async () => {
    const { fetchImpl } = createStubFetch([{ body: { emails: [] } }]);

    const profile = await fetchPageProfile(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "t",
    });

    expect(profile.emails).toBeNull();
  });
});

describe("profileLines", () => {
  const profile = {
    about: "Handmade clothing",
    description: null,
    phone: "+8801000000000",
    address: "Dhaka",
    website: null,
    emails: ["shop@test.local"],
    hours: { mon_1_open: "09:00" },
  };

  test("renders only the fields that are set", () => {
    const lines = profileLines(profile);

    expect(lines).toContain("About: Handmade clothing");
    expect(lines).toContain("Address: Dhaka");
    expect(lines.some((line) => line.startsWith("Description:"))).toBe(false);
    expect(lines.some((line) => line.startsWith("Website:"))).toBe(false);
  });

  test("renders hours as a single line", () => {
    expect(profileLines(profile).some((line) => line.includes("mon_1_open: 09:00"))).toBe(true);
  });

  test("returns nothing for an empty profile", () => {
    expect(
      profileLines({
        about: null,
        description: null,
        phone: null,
        address: null,
        website: null,
        emails: null,
        hours: null,
      }),
    ).toEqual([]);
  });
});
