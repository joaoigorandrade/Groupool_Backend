CREATE TABLE "group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"external_user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_members_role_check" CHECK ("group_members"."role" in ('owner', 'member')),
	CONSTRAINT "group_members_status_check" CHECK ("group_members"."status" in ('active', 'invited', 'removed'))
);
--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "group_members_group_user_unique" ON "group_members" USING btree ("group_id","external_user_id");