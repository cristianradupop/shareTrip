CREATE TYPE "public"."trip_request_status" AS ENUM('pending', 'approved', 'declined');--> statement-breakpoint
CREATE TABLE "trip_requests" (
	"trip_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" "trip_request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	CONSTRAINT "trip_requests_trip_id_user_id_pk" PRIMARY KEY("trip_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "trip_requests" ADD CONSTRAINT "trip_requests_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_requests" ADD CONSTRAINT "trip_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_requests_trip_status_idx" ON "trip_requests" USING btree ("trip_id","status");--> statement-breakpoint
CREATE INDEX "trip_requests_user_idx" ON "trip_requests" USING btree ("user_id");