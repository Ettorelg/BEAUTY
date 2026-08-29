ALTER TABLE "staff_members" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_members_business_user_unique" ON "staff_members" USING btree ("business_id","user_id");