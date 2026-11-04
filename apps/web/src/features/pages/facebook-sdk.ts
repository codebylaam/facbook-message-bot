import { isValidMetaAppId } from "@fb-bot/shared";

export type FacebookLoginResponse = {
  status: "connected" | "not_authorized" | "unknown";
  authResponse?: {
    accessToken: string;
    userID: string;
    expiresIn: number;
  };
};

export type FacebookSdk = {
  init(options: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }): void;
  login(
    callback: (response: FacebookLoginResponse) => void,
    options?: { scope: string; return_scopes?: boolean },
  ): void;
  getLoginStatus?(callback: (response: FacebookLoginResponse) => void): void;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

const SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";
const SDK_TIMEOUT_MS = 15_000;
const LOGIN_TIMEOUT_MS = 90_000;

let pending: Promise<FacebookSdk> | undefined;
let ready: FacebookSdk | undefined;

/**
 * sdk.js installs a buffering stub on window.FB as soon as it runs, before the
 * real SDK has loaded. Reusing that stub made FB.login run before FB.init, so
 * only an SDK that has reported ready through fbAsyncInit is trusted.
 *
 * A failed attempt is discarded completely, so the next click starts from a
 * clean load instead of reusing a script the SDK refuses to run twice.
 */
function discardSdk(): void {
  pending = undefined;
  document.querySelector(`script[src="${SDK_SRC}"]`)?.remove();
  delete window.FB;
}

/**
 * An init made inside fbAsyncInit did not stick: login then reported "called
 * before FB.init()" even though init had returned. Running init again right
 * before each login makes the call order independent of when the SDK settled.
 */
function withInitBeforeLogin(appId: string, graphVersion: string): FacebookSdk {
  // Read window.FB on every call: a reference captured earlier can point at an
  // object the SDK has since replaced, which is where init was going missing.
  const current = (): FacebookSdk => {
    if (!window.FB) {
      throw new Error("The Facebook SDK is not loaded");
    }

    return window.FB;
  };
  const init = () => current().init({ appId, cookie: true, xfbml: false, version: graphVersion });

  return {
    init,
    login: (callback, options) => {
      init();
      current().login(callback, options);
    },
  };
}

export function loadFacebookSdk(appId: string, graphVersion: string): Promise<FacebookSdk> {
  // FB.init drops an app id it does not recognise without a word, and every
  // later login then settles on nothing. Refusing up front turns that into the
  // message the seller can act on instead of a spinner that never stops.
  if (!isValidMetaAppId(appId)) {
    return Promise.reject(
      new Error(
        `"${appId}" is not a Facebook app id. Set META_APP_ID on the server to the numeric id from the app's Basic settings.`,
      ),
    );
  }

  if (ready) {
    return Promise.resolve(withInitBeforeLogin(appId, graphVersion));
  }

  pending ??= new Promise<FacebookSdk>((resolve, reject) => {
    let settled = false;

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      // A throw from init must not escape as an unhandled error: the promise
      // would be left pending and the caller would wait forever.
      try {
        callback();
      } catch (thrown: unknown) {
        pending = undefined;
        reject(thrown instanceof Error ? thrown : new Error(String(thrown)));
      }
    };

    const timer = setTimeout(() => {
      discardSdk();
      settle(() =>
        reject(
          new Error(
            "Loading the Facebook SDK timed out. Check that connect.facebook.net is reachable.",
          ),
        ),
      );
    }, SDK_TIMEOUT_MS);

    window.fbAsyncInit = () => {
      const sdk = window.FB;

      if (!sdk) {
        settle(() => reject(new Error("The Facebook SDK loaded but did not initialise")));
        return;
      }

      try {
        sdk.init({ appId, cookie: true, xfbml: false, version: graphVersion });
      } catch (thrown: unknown) {
        settle(() => reject(thrown instanceof Error ? thrown : new Error(String(thrown))));
        return;
      }

      // init is applied asynchronously: login called in the same tick fails with
      // "called before FB.init()". getLoginStatus only calls back once the SDK is
      // ready, so resolve from there.
      const finish = () =>
        settle(() => {
          ready = sdk;
          resolve(withInitBeforeLogin(appId, graphVersion));
        });

      if (sdk.getLoginStatus) {
        sdk.getLoginStatus(finish);
      } else {
        finish();
      }
    };

    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => {
      discardSdk();
      settle(() => reject(new Error("Could not load the Facebook SDK")));
    };
    document.body.appendChild(script);
  });

  return pending;
}

/**
 * Facebook refuses FB.login from an insecure page, and it only reports that to
 * the console: the callback never fires. Checking first turns a spinner that
 * never stops into a message the seller can act on.
 */
export function assertLoginOrigin(): void {
  if (window.location.protocol !== "https:") {
    throw new Error(
      "Facebook Login only works over HTTPS, and this page is on http. Serve the app over https (a tunnel such as cloudflared works) and try again.",
    );
  }
}

export function loginWithFacebook(sdk: FacebookSdk, scopes: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false;

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      callback();
    };

    const timer = setTimeout(() => {
      settle(() =>
        reject(
          new Error(
            "Facebook did not answer the sign-in prompt. Allow pop-ups for this site and try again.",
          ),
        ),
      );
    }, LOGIN_TIMEOUT_MS);

    try {
      // Facebook refuses this from an insecure page without calling back, so the
      // check has to happen before the call rather than as a timeout after it.
      assertLoginOrigin();

      sdk.login(
        (response) => {
          const accessToken = response.authResponse?.accessToken;

          if (response.status === "connected" && accessToken) {
            settle(() => resolve(accessToken));
            return;
          }

          settle(() =>
            reject(new Error("Facebook sign-in was cancelled or the permissions were not granted")),
          );
        },
        { scope: scopes.join(","), return_scopes: true },
      );
    } catch (thrown: unknown) {
      settle(() => reject(thrown instanceof Error ? thrown : new Error(String(thrown))));
    }
  });
}
