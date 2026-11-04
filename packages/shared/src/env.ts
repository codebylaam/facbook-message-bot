import { z } from "zod";

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined>,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

/**
 * The allowed web origins. A single value is the common case; a comma separated
 * list allows more than one, such as several domains in production.
 */
export function parseOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/**
 * What FB.init accepts as an app id: the numeric id from the app's Basic
 * settings, or the longer hex id newer apps use. The JavaScript SDK accepts
 * anything else in silence and later fails FB.login with "FB.login() called
 * before FB.init().", so a non-empty placeholder looked configured while no
 * login could ever succeed.
 */
export function isValidMetaAppId(appId: string): boolean {
  return /^[0-9a-f]{21,}$|^[0-9]{1,21}$/.test(appId);
}
