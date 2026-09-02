import { boolean, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity";
import { businesses, locations } from "./tenancy";

export const serviceCategories = pgTable(
  "service_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("service_categories_business_name_unique").on(table.businessId, table.name),
    index("service_categories_business_idx").on(table.businessId),
  ],
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").notNull().references(() => serviceCategories.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    repeatPrice: numeric("repeat_price", { precision: 10, scale: 2 }),
    repeatPriceEnabled: boolean("repeat_price_enabled").notNull().default(false),
    repeatDurationMinutes: integer("repeat_duration_minutes"),
    active: boolean("active").notNull().default(true),
    onlineBookable: boolean("online_bookable").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("services_business_idx").on(table.businessId),
    index("services_category_idx").on(table.categoryId),
    uniqueIndex("services_business_name_unique").on(table.businessId, table.name),
  ],
);

export const staffMembers = pgTable(
  "staff_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    title: text("title"),
    imageUrl: text("image_url"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("staff_members_business_idx").on(table.businessId),
    index("staff_members_location_idx").on(table.locationId),
    uniqueIndex("staff_members_business_user_unique").on(table.businessId, table.userId),
  ],
);

export const staffServices = pgTable(
  "staff_services",
  {
    staffId: uuid("staff_id").notNull().references(() => staffMembers.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("staff_services_staff_service_unique").on(table.staffId, table.serviceId),
    index("staff_services_business_idx").on(table.businessId),
  ],
);

export const workingHours = pgTable(
  "working_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").notNull().references(() => staffMembers.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    startMinutes: integer("start_minutes").notNull(),
    endMinutes: integer("end_minutes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("working_hours_staff_weekday_idx").on(table.staffId, table.weekday),
    index("working_hours_business_idx").on(table.businessId),
    uniqueIndex("working_hours_staff_slot_unique").on(table.businessId, table.staffId, table.weekday, table.startMinutes, table.endMinutes),
  ],
);

export const staffAbsences = pgTable(
  "staff_absences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").notNull().references(() => staffMembers.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("staff_absences_staff_period_idx").on(table.staffId, table.startsAt, table.endsAt),
    index("staff_absences_business_idx").on(table.businessId),
  ],
);

