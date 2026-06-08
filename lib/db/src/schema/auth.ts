import {
  pgTable,
  serial,
  varchar,
  timestamp,
  boolean,
  text,
} from "drizzle-orm/pg-core";

export const appUsersTable = pgTable("app_users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

export type AppUser = typeof appUsersTable.$inferSelect;
export type NewAppUser = typeof appUsersTable.$inferInsert;
