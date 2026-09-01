CREATE TABLE "appointment_reschedule_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"proposed_staff_id" uuid NOT NULL,
	"proposed_starts_at" timestamp with time zone NOT NULL,
	"proposed_ends_at" timestamp with time zone NOT NULL,
	"appointment_version" integer NOT NULL,
	"proposer_type" text NOT NULL,
	"proposed_by" uuid,
	"customer_token_hash" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment_reschedule_requests" ADD CONSTRAINT "appointment_reschedule_requests_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_reschedule_requests" ADD CONSTRAINT "appointment_reschedule_requests_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_reschedule_requests" ADD CONSTRAINT "appointment_reschedule_requests_proposed_staff_id_staff_members_id_fk" FOREIGN KEY ("proposed_staff_id") REFERENCES "public"."staff_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_reschedule_requests" ADD CONSTRAINT "appointment_reschedule_requests_proposed_by_users_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reschedule_appointment_status_idx" ON "appointment_reschedule_requests" USING btree ("appointment_id","status");--> statement-breakpoint
CREATE INDEX "reschedule_staff_period_idx" ON "appointment_reschedule_requests" USING btree ("proposed_staff_id","proposed_starts_at","proposed_ends_at");--> statement-breakpoint
CREATE INDEX "reschedule_token_idx" ON "appointment_reschedule_requests" USING btree ("customer_token_hash");