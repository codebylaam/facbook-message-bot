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
};

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

const SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";
const SDK_TIMEOUT_MS = 15_000;

let pending: Promise<FacebookSdk> | undefined;

export function loadFacebookSdk(appId: string, graphVersion: string): Promise<FacebookSdk> {
  const existing = window.FB;

  if (existing) {
    existing.init({ appId, cookie: true, xfbml: false, version: graphVersion });
    return Promise.resolve(existing);
  }

  pending ??= new Promise<FacebookSdk>((resolve, reject) => {
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
      pending = undefined;
      settle(() =>
        reject(
          new Error(
            "Loading the Facebook SDK timed out. Check that connect.facebook.net is reachable.",
          ),
        ),
      );
    }, SDK_TIMEOUT_MS);

    window.fbAsyncInit = () => {
      settle(() => {
        const sdk = window.FB;

        if (!sdk) {
          reject(new Error("The Facebook SDK loaded but did not initialise"));
          return;
        }

        sdk.init({ appId, cookie: true, xfbml: false, version: graphVersion });
        resolve(sdk);
      });
    };

    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => settle(() => reject(new Error("Could not load the Facebook SDK")));
    document.body.appendChild(script);
  });

  return pending;
}

export function loginWithFacebook(sdk: FacebookSdk, scopes: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    sdk.login(
      (response) => {
        const accessToken = response.authResponse?.accessToken;

        if (response.status === "connected" && accessToken) {
          resolve(accessToken);
          return;
        }

        reject(new Error("Facebook sign-in was cancelled or the permissions were not granted"));
      },
      { scope: scopes.join(","), return_scopes: true },
    );
  });
}
