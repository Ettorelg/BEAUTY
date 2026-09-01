import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { appointments } from "./booking";
import { staffMembers } from "./catalog";
import { users } from "./identity";
import { businesses } from "./tenancy";

export const appointmentRescheduleRequests = pgTable("appointment_reschedule_requests", {
  id: uuid("id").primaryKey().defaultRandom(), appointmentId: uuid("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }), proposedStaffId: uuid("proposed_staff_id").notNull().references(() => staffMembers.id, { onDelete: "cascade" }),
  proposedStartsAt: timestamp("proposed_starts_at", { withTimezone: true }).notNull(), proposedEndsAt: timestamp("proposed_ends_at", { withTimezone: true }).notNull(), appointmentVersion: integer("appointment_version").notNull(),
  proposerType: text("proposer_type").notNull(), proposedBy: uuid("proposed_by").references(() => users.id, { onDelete: "set null" }), customerTokenHash: text("customer_token_hash"),
  status: text("status").notNull().default("PENDING"), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), respondedAt: timestamp("responded_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("reschedule_appointment_status_idx").on(table.appointmentId, table.status), index("reschedule_staff_period_idx").on(table.proposedStaffId, table.proposedStartsAt, table.proposedEndsAt), index("reschedule_token_idx").on(table.customerTokenHash)]);
