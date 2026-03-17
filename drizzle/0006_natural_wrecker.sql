CREATE TABLE "pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"title" text NOT NULL,
	"target_cents" integer NOT NULL,
	"collected_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"deadline" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pools_target_cents_check" CHECK ("pools"."target_cents" > 0),
	CONSTRAINT "pools_collected_cents_check" CHECK ("pools"."collected_cents" >= 0),
	CONSTRAINT "pools_status_check" CHECK ("pools"."status" in ('open', 'closed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "pools" ADD CONSTRAINT "pools_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pools_group_id_idx" ON "pools" USING btree ("group_id");