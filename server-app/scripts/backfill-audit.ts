// Writes the creation event of every account and trip that existed before the audit log. Run once after migration 0002; safe to repeat.
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

async function main() {
  const accounts = await db.execute(sql`
    INSERT INTO "audit_events" ("created_at", "category", "action", "actor_id", "actor_role", "actor_name",
      "subject_type", "subject_id", "subject_label", "subject_email")
    SELECT u."created_at", 'account', 'account.created', u."id", 'holder', u."name", 'user', u."id", u."name", u."email"
    FROM "user" u
    WHERE NOT EXISTS (
      SELECT 1 FROM "audit_events" e
      WHERE e."action" = 'account.created' AND e."subject_type" = 'user' AND e."subject_id" = u."id"
    )`);
  const tripEvents = await db.execute(sql`
    INSERT INTO "audit_events" ("created_at", "category", "action", "actor_id", "actor_role", "actor_name",
      "subject_type", "subject_id", "subject_label")
    SELECT t."created_at", 'trip', 'trip.created', o."id", 'user', o."name", 'trip', t."id"::text,
      t."destination_city" || ', ' || t."destination_country"
    FROM "trips" t
    JOIN "user" o ON o."id" = t."organizer_id"
    WHERE NOT EXISTS (
      SELECT 1 FROM "audit_events" e
      WHERE e."action" = 'trip.created' AND e."subject_type" = 'trip' AND e."subject_id" = t."id"::text
    )`);
  console.log(`Audit backfilled: ${accounts.count} account event(s), ${tripEvents.count} trip event(s)`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
