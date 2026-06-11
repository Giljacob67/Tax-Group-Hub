import {
  pgTable,
  serial,
  varchar,
  timestamp,
  boolean,
  text,
  integer,
  jsonb,
  index,
  uniqueIndex,
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
  totpSecret: varchar("totp_secret", { length: 255 }),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  totpVerifiedAt: timestamp("totp_verified_at"),
  backupCodes: jsonb("backup_codes").$type<string[]>(),
});

export type AppUser = typeof appUsersTable.$inferSelect;
export type NewAppUser = typeof appUsersTable.$inferInsert;

export const passwordResetTokensTable = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => appUsersTable.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("idx_password_reset_tokens_user_id").on(t.userId),
  index("idx_password_reset_tokens_expires_at").on(t.expiresAt),
]);

export type PasswordResetToken = typeof passwordResetTokensTable.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokensTable.$inferInsert;

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").references(() => appUsersTable.id, { onDelete: "set null" }),
  actorEmail: varchar("actor_email", { length: 255 }),
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resource_type", { length: 50 }).notNull(),
  resourceId: varchar("resource_id", { length: 100 }),
  details: jsonb("details"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("idx_audit_logs_actor_id").on(t.actorId),
  index("idx_audit_logs_action").on(t.action),
  index("idx_audit_logs_resource_type").on(t.resourceType),
  index("idx_audit_logs_created_at").on(t.createdAt),
]);

export type AuditLog = typeof auditLogsTable.$inferSelect;
export type NewAuditLog = typeof auditLogsTable.$inferInsert;

export const schemaMigrationsTable = pgTable("_schema_migrations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  appliedAt: timestamp("applied_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("idx_schema_migrations_name").on(t.name),
]);

export type SchemaMigration = typeof schemaMigrationsTable.$inferSelect;
