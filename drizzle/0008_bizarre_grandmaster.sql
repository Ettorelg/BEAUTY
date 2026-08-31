CREATE TABLE "fidelity_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"customer_relation_id" uuid NOT NULL,
	"card_number" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"points_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fidelity_promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"discount_percent" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fidelity_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"customer_relation_id" uuid NOT NULL,
	"rule_id" uuid,
	"appointment_id" uuid,
	"points_spent" integer NOT NULL,
	"reward_type" text NOT NULL,
	"reward_value" integer DEFAULT 0 NOT NULL,
	"service_id" uuid,
	"reversed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fidelity_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"type" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"service_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fidelity_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"spend_cents" integer DEFAULT 1000 NOT NULL,
	"points_award" integer DEFAULT 1 NOT NULL,
	"points_validity_months" integer DEFAULT 12 NOT NULL,
	"allow_reward_stacking" boolean DEFAULT false NOT NULL,
	"reward_points" integer DEFAULT 10 NOT NULL,
	"reward_type" text DEFAULT 'DISCOUNT_EUR' NOT NULL,
	"reward_value" integer DEFAULT 500 NOT NULL,
	"reward_service_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "instagram" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "logo_key" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "cover_key" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "gallery_keys" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "instagram" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "logo_key" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "cover_key" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "gallery_keys" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "fidelity_cards" ADD CONSTRAINT "fidelity_cards_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fidelity_cards" ADD CONSTRAINT "fidelity_cards_customer_relation_id_customer_relations_id_fk" FOREIGN KEY ("customer_relation_id") REFERENCES "public"."customer_relations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fidelity_promotions" ADD CONSTRAINT "fidelity_promotions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fidelity_promotions" ADD CONSTRAINT "fidelity_promotions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fidelity_redemptions" ADD CONSTRAINT "fidelity_redemptions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fidelity_redemptions" ADD CONSTRAINT "fidelity_redemptions_customer_relation_id_customer_relations_id_fk" FOREIGN KEY ("customer_relation_id") REFERENCES "public"."customer_relations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fidelity_redemptions" ADD CONSTRAINT "fidelity_redemptions_rule_id_fidelity_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."fidelity_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fidelity_redemptions" ADD CONSTRAINT "fidelity_redemptions_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fidelity_redemptions" ADD CONSTRAINT "fidelity_redemptions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fidelity_rules" ADD CONSTRAINT "fidelity_rules_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fidelity_rules" ADD CONSTRAINT "fidelity_rules_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fidelity_settings" ADD CONSTRAINT "fidelity_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fidelity_settings" ADD CONSTRAINT "fidelity_settings_reward_service_id_services_id_fk" FOREIGN KEY ("reward_service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fidelity_cards_business_customer_unique" ON "fidelity_cards" USING btree ("business_id","customer_relation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fidelity_cards_number_unique" ON "fidelity_cards" USING btree ("card_number");--> statement-breakpoint
CREATE INDEX "fidelity_cards_business_idx" ON "fidelity_cards" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "fidelity_promotions_business_idx" ON "fidelity_promotions" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "fidelity_redemptions_business_customer_idx" ON "fidelity_redemptions" USING btree ("business_id","customer_relation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fidelity_redemptions_appointment_unique" ON "fidelity_redemptions" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "fidelity_rules_business_idx" ON "fidelity_rules" USING btree ("business_id");