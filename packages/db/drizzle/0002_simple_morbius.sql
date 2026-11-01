CREATE TYPE "public"."webhook_event_status" AS ENUM('received', 'processed', 'failed', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."webhook_field" AS ENUM('messages', 'feed', 'unknown');--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid,
	"fb_page_id" text NOT NULL,
	"object" text NOT NULL,
	"field" "webhook_field" DEFAULT 'unknown' NOT NULL,
	"raw" jsonb NOT NULL,
	"status" "webhook_event_status" DEFAULT 'received' NOT NULL,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_page_id_fb_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."fb_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_events_fb_page_id_idx" ON "webhook_events" USING btree ("fb_page_id");--> statement-breakpoint
CREATE INDEX "webhook_events_status_idx" ON "webhook_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webhook_events_received_at_idx" ON "webhook_events" USING btree ("received_at");