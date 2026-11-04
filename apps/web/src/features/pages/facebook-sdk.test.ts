import { afterEach, describe, expect, test } from "bun:test";
import {
  assertLoginOrigin,
  type FacebookSdk,
  loadFacebookSdk,
  loginWithFacebook,
} from "./facebook-sdk.ts";

const realWindow = globalThis.window;

function setOrigin(protocol: string): void {
  Object.defineProperty(globalThis, "window", {
    value: { location: { protocol } },
    configurable: true,
    writable: true,
  });
}

function sdkThat(login: FacebookSdk["login"]): FacebookSdk {
  return { init: () => {}, login };
}

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    value: realWindow,
    configurable: true,
    writable: true,
  });
});

describe("loadFacebookSdk", () => {
  test("refuses a placeholder app id, which FB.init accepts in silence", async () => {
    await expect(loadFacebookSdk("local-app-id", "v23.0")).rejects.toThrow(
      /is not a Facebook app id/,
    );
  });
});

describe("assertLoginOrigin", () => {
  test("refuses an http page, which is what left the button spinning", () => {
    setOrigin("http:");

    expect(() => assertLoginOrigin()).toThrow(/only works over HTTPS/);
  });

  test("allows an https page", () => {
    setOrigin("https:");

    expect(() => assertLoginOrigin()).not.toThrow();
  });
});

describe("loginWithFacebook", () => {
  test("rejects rather than hangs when the page is not https", async () => {
    setOrigin("http:");

    let called = false;

    await expect(
      loginWithFacebook(
        sdkThat(() => {
          called = true;
        }),
        ["pages_manage_metadata"],
      ),
    ).rejects.toThrow(/HTTPS/);

    // Facebook must never be reached: it fails silently and the caller waits forever.
    expect(called).toBe(false);
  });

  test("rejects when Facebook throws instead of calling back", async () => {
    setOrigin("https:");

    await expect(
      loginWithFacebook(
        sdkThat(() => {
          throw new Error("FB.login() called before FB.init().");
        }),
        ["pages_manage_metadata"],
      ),
    ).rejects.toThrow("FB.login() called before FB.init().");
  });

  test("resolves the token when Facebook answers with one", async () => {
    setOrigin("https:");

    const token = await loginWithFacebook(
      sdkThat((callback) =>
        callback({
          status: "connected",
          authResponse: { accessToken: "EAAG-token", userID: "1", expiresIn: 3600 },
        }),
      ),
      ["pages_manage_metadata"],
    );

    expect(token).toBe("EAAG-token");
  });

  test("rejects when the seller cancels the prompt", async () => {
    setOrigin("https:");

    await expect(
      loginWithFacebook(
        sdkThat((callback) => callback({ status: "unknown" })),
        ["pages_manage_metadata"],
      ),
    ).rejects.toThrow(/cancelled/);
  });
});
