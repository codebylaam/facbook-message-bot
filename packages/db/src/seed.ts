import { parseEnv, serverEnvSchema } from "@fb-bot/shared";
import { eq } from "drizzle-orm";
import { createDb } from "./client.ts";
import { upsertPlan } from "./repositories/billing.ts";
import { users } from "./schema/auth.ts";

const PLANS = [
  { name: "Starter", aiRepliesPerMonth: 500, pageLimit: 1, price: "0" },
  { name: "Growth", aiRepliesPerMonth: 3000, pageLimit: 3, price: "1500" },
  { name: "Pro", aiRepliesPerMonth: 10000, pageLimit: 10, price: "4000" },
];

const env = parseEnv(serverEnvSchema, process.env);
const { db, close } = createDb(env.DATABASE_URL, { max: 1 });

for (const plan of PLANS) {
  const stored = await upsertPlan(db, plan);
  console.log(
    `plan ${stored?.name}: ${stored?.aiRepliesPerMonth} replies, ${stored?.pageLimit} page(s), ${stored?.price} BDT`,
  );
}

const adminEmail = process.env.ADMIN_EMAIL?.trim();

if (adminEmail) {
  const [promoted] = await db
    .update(users)
    .set({ role: "admin", updatedAt: new Date() })
    .where(eq(users.email, adminEmail))
    .returning();

  console.log(
    promoted
      ? `${adminEmail} can now open the admin screens`
      : `${adminEmail} has not signed up yet, so nothing was promoted`,
  );
}

await close();
