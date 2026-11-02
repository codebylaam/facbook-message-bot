import { createHmac, timingSafeEqual } from "node:crypto";

export type SignedRequestPayload = {
  algorithm?: string;
  user_id?: string;
  issued_at?: number;
  [key: string]: unknown;
};

/**
 * Meta signs a base64url payload with the app secret. The signature is compared
 * with a timing safe equality and the payload is only parsed after it matches.
 */
export function parseSignedRequest(
  appSecret: string,
  signedRequest: string,
): SignedRequestPayload | null {
  const [encodedSignature, encodedPayload] = signedRequest.split(".");

  if (!encodedSignature || !encodedPayload) {
    return null;
  }

  const expected = createHmac("sha256", appSecret).update(encodedPayload).digest("base64url");
  const received = Buffer.from(encodedSignature);
  const computed = Buffer.from(expected);

  if (received.length !== computed.length || !timingSafeEqual(received, computed)) {
    return null;
  }

  try {
    const decoded = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;

    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    return parsed as SignedRequestPayload;
  } catch {
    return null;
  }
}
