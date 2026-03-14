CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"currency" text NOT NULL,
	"initial_pool_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_name_length_check" CHECK (char_length("groups"."name") between 1 and 80),
	CONSTRAINT "groups_currency_check" CHECK ("groups"."currency" = 'BRL'),
	CONSTRAINT "groups_initial_pool_cents_check" CHECK ("groups"."initial_pool_cents" >= 0)
);
