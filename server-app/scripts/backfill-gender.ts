// Gives every account without a gender a random one (male/female). Run once after migration 0001; safe to repeat.
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

async function main() {
  const result = await db.execute(
    sql`UPDATE "user" SET "gender" = CASE WHEN random() < 0.5 THEN 'male' ELSE 'female' END WHERE "gender" IS NULL`,
  );
  console.log(`Gender backfilled for ${result.count} user(s)`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
