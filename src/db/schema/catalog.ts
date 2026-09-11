import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./identity";
import { businesses, locations } from "./tenancy";

export const serviceCategories = pgTable(
  "service_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("service_categories_business_name_unique").on(
      table.businessId,
      table.name,
    ),
    index("service_categories_business_idx").on(table.businessId),
  ],
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => serviceCategories.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    repeatPrice: numeric("repeat_price", { precision: 10, scale: 2 }),
    repeatPriceEnabled: boolean("repeat_price_enabled")
      .notNull()
      .default(false),
    repeatDurationMinutes: integer("repeat_duration_minutes"),
    active: boolean("active").notNull().default(true),
    onlineBookable: boolean("online_bookable").notNull().default(true),
    capacity: integer("capacity").notNull().default(1),
    waitlistEnabled: boolean("waitlist_enabled").notNull().default(false),
    waitlistConfirmationMinutes: integer("waitlist_confirmation_minutes")
      .notNull()
      .default(120),
    addsDuration: boolean("adds_duration").notNull().default(true),
    additionalServiceMode: text("additional_service_mode").notNull().default("ALL"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("services_business_idx").on(table.businessId),
    index("services_category_idx").on(table.categoryId),
    uniqueIndex("services_business_name_unique").on(
      table.businessId,
      table.name,
    ),
  ],
);

export const serviceAdditionalCompatibilities = pgTable("service_additional_compatibilities", {
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  primaryServiceId: uuid("primary_service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  additionalServiceId: uuid("additional_service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
}, table => [uniqueIndex("service_additional_compatibility_unique").on(table.primaryServiceId, table.additionalServiceId), index("service_additional_compatibility_business_idx").on(table.businessId)]);

export const serviceOccurrences = pgTable("service_occurrences", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  staffId: uuid("staff_id").notNull().references(() => staffMembers.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  capacity: integer("capacity").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("service_occurrence_unique").on(table.businessId, table.serviceId, table.staffId, table.startsAt), index("service_occurrence_period_idx").on(table.businessId, table.startsAt)]);

export const staffMembers = pgTable(
  "staff_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    title: text("title"),
    imageUrl: text("image_url"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("staff_members_business_idx").on(table.businessId),
    index("staff_members_location_idx").on(table.locationId),
    uniqueIndex("staff_members_business_user_unique").on(
      table.businessId,
      table.userId,
    ),
  ],
);

export const staffServices = pgTable(
  "staff_services",
  {
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("staff_services_staff_service_unique").on(
      table.staffId,
      table.serviceId,
    ),
    index("staff_services_business_idx").on(table.businessId),
  ],
);

export const workingHours = pgTable(
  "working_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    startMinutes: integer("start_minutes").notNull(),
    endMinutes: integer("end_minutes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("working_hours_staff_weekday_idx").on(table.staffId, table.weekday),
    index("working_hours_business_idx").on(table.businessId),
    uniqueIndex("working_hours_staff_slot_unique").on(
      table.businessId,
      table.staffId,
      table.weekday,
      table.startMinutes,
      table.endMinutes,
    ),
  ],
);

export const staffAbsences = pgTable(
  "staff_absences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("staff_absences_staff_period_idx").on(
      table.staffId,
      table.startsAt,
      table.endsAt,
    ),
    index("staff_absences_business_idx").on(table.businessId),
  ],
);
