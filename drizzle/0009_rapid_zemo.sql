CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"group_id" uuid NOT NULL,
	"inviter_member_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"max_uses" integer,
	"use_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_code_unique" UNIQUE("code"),
	CONSTRAINT "invites_status_check" CHECK ("invites"."status" in ('active', 'revoked', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"avatar_url" text,
	"token_generation" integer DEFAULT 1 NOT NULL,
	"profile_setup_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "max_members" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "withdrawal_fast_track_cents" integer;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "vote_window_hours" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "challenge_cooldown_hours" integer DEFAULT 48 NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "withdrawal_vote_timeout_hours" integer DEFAULT 48 NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "rules" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_inviter_member_id_group_members_id_fk" FOREIGN KEY ("inviter_member_id") REFERENCES "public"."group_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invites_code_idx" ON "invites" USING btree ("code");--> statement-breakpoint
CREATE INDEX "invites_group_id_idx" ON "invites" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_max_members_check" CHECK ("groups"."max_members" between 3 and 50);--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_vote_window_hours_check" CHECK ("groups"."vote_window_hours" between 6 and 72);--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_challenge_cooldown_hours_check" CHECK ("groups"."challenge_cooldown_hours" between 12 and 168);--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_withdrawal_vote_timeout_hours_check" CHECK ("groups"."withdrawal_vote_timeout_hours" between 12 and 168);