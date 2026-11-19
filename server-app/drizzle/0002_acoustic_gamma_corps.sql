CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"category" text NOT NULL,
	"action" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_role" text NOT NULL,
	"actor_name" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"subject_label" text NOT NULL,
	"subject_email" text,
	"related_id" text,
	"related_label" text,
	"changed_fields" text[] DEFAULT '{}'::text[] NOT NULL,
	"reason" text,
	"new_role" text,
	"auto_declined" integer
);
--> statement-breakpoint
CREATE INDEX "audit_events_category_created_idx" ON "audit_events" USING btree ("category","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_role_created_idx" ON "audit_events" USING btree ("actor_role","created_at");