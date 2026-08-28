CREATE TABLE "service_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_minutes" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"online_bookable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"image_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_services" (
	"staff_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"business_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "working_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_minutes" integer NOT NULL,
	"end_minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_absences" ADD CONSTRAINT "staff_absences_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_absences" ADD CONSTRAINT "staff_absences_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_categories_business_name_unique" ON "service_categories" USING btree ("business_id","name");--> statement-breakpoint
CREATE INDEX "service_categories_business_idx" ON "service_categories" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "services_business_idx" ON "services" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "services_category_idx" ON "services" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "services_business_name_unique" ON "services" USING btree ("business_id","name");--> statement-breakpoint
CREATE INDEX "staff_absences_staff_period_idx" ON "staff_absences" USING btree ("staff_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "staff_absences_business_idx" ON "staff_absences" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "staff_members_business_idx" ON "staff_members" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "staff_members_location_idx" ON "staff_members" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_services_staff_service_unique" ON "staff_services" USING btree ("staff_id","service_id");--> statement-breakpoint
CREATE INDEX "staff_services_business_idx" ON "staff_services" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "working_hours_staff_weekday_idx" ON "working_hours" USING btree ("staff_id","weekday");--> statement-breakpoint
CREATE INDEX "working_hours_business_idx" ON "working_hours" USING btree ("business_id");