CREATE TABLE "contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"pix_transaction_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "contributions_amount_cents_check" CHECK ("contributions"."amount_cents" > 0),
	CONSTRAINT "contributions_status_check" CHECK ("contributions"."status" in ('pending', 'confirmed', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_member_id_group_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."group_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contributions_pool_id_idx" ON "contributions" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "contributions_member_id_idx" ON "contributions" USING btree ("member_id");