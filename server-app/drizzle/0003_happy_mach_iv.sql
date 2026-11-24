CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"visitor_id" text NOT NULL,
	"session_id" text NOT NULL,
	"ip_hash" text NOT NULL,
	"signed_in" boolean DEFAULT false NOT NULL,
	"path" text NOT NULL,
	"referrer" text,
	"language" text,
	"screen" text,
	"device" text,
	"browser" text,
	"name" text,
	"status" integer,
	"value" double precision
);
--> statement-breakpoint
CREATE TABLE "analytics_salts" (
	"day" text PRIMARY KEY NOT NULL,
	"salt" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "analytics_events_created_idx" ON "analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_type_created_idx" ON "analytics_events" USING btree ("type","created_at");