import { accounts, sessions, users, verifications } from "@fb-bot/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db.ts";
import { env, webOrigins } from "./env.ts";

export const auth = betterAuth({
  appName: "FB Bot",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: webOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "seller",
        input: false,
      },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
