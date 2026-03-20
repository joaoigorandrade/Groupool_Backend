CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"creator_member_id" uuid NOT NULL,
	"challenged_member_id" uuid NOT NULL,
	"title" text NOT NULL,
	"details" text,
	"stake_cents" integer NOT NULL,
	"status" text NOT NULL,
	"event_deadline" timestamp with time zone NOT NULL,
	"vote_deadline" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenges_title_length_check" CHECK (char_length("challenges"."title") between 1 and 160),
	CONSTRAINT "challenges_stake_cents_check" CHECK ("challenges"."stake_cents" >= 0),
	CONSTRAINT "challenges_status_check" CHECK ("challenges"."status" in ('pending', 'active', 'voting', 'resolved', 'voided', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "member_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"available_cents" integer DEFAULT 0 NOT NULL,
	"frozen_cents" integer DEFAULT 0 NOT NULL,
	"debt_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_balances_available_cents_check" CHECK ("member_balances"."available_cents" >= 0),
	CONSTRAINT "member_balances_frozen_cents_check" CHECK ("member_balances"."frozen_cents" >= 0),
	CONSTRAINT "member_balances_debt_cents_check" CHECK ("member_balances"."debt_cents" >= 0),
	CONSTRAINT "member_balances_status_check" CHECK ("member_balances"."status" in ('ok', 'restricted', 'observer'))
);
--> statement-breakpoint
ALTER TABLE "group_members" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "group_members" ADD COLUMN "reputation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "group_members" ADD COLUMN "reliability_percent" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_creator_member_id_group_members_id_fk" FOREIGN KEY ("creator_member_id") REFERENCES "public"."group_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_challenged_member_id_group_members_id_fk" FOREIGN KEY ("challenged_member_id") REFERENCES "public"."group_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_balances" ADD CONSTRAINT "member_balances_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_balances" ADD CONSTRAINT "member_balances_member_id_group_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."group_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "challenges_group_id_idx" ON "challenges" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "challenges_status_idx" ON "challenges" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "member_balances_group_member_unique" ON "member_balances" USING btree ("group_id","member_id");--> statement-breakpoint
INSERT INTO "member_balances" ("group_id", "member_id", "available_cents", "frozen_cents", "debt_cents", "status")
SELECT "group_id", "id", 0, 0, 0, 'ok'
FROM "group_members"
WHERE "status" = 'active';--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_reputation_check" CHECK ("group_members"."reputation" >= 0);--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_reliability_percent_check" CHECK ("group_members"."reliability_percent" between 0 and 100);
