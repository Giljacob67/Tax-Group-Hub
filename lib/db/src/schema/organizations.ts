import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { appUsersTable } from "./auth.js";

/**
 * Organizations — a fronteira de tenancy do Tax Group Hub.
 *
 * Antes do redesenho multiusuário, todo dado era isolado por `user_id`
 * (string = `String(app_users.id)`), o que impedia o time comercial de
 * compartilhar pipeline/CRM/configurações. A `org` passa a ser a fronteira:
 * todos os membros enxergam os mesmos dados; o RBAC (organization_members.role)
 * governa edição, não visão.
 *
 * Modelo atual: organização única ("Tax Group — Maringá", id = 1).
 */
export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // ex: "tax-group-maringa"
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(
  organizationsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type Organization = typeof organizationsTable.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

/**
 * Organization Members — fonte única de papéis (RBAC) por organização.
 *
 * Consolida o que antes vivia em `app_user_roles` (escopo por user, sem org).
 * Um usuário pertence a uma org com exatamente um papel. Papéis:
 *   'admin'      — controle total, incl. BYOK keys, membros e integrações
 *   'coordenador'— gestão comercial ampla, sem configs sensíveis
 *   'comercial'  — SDR/closer: opera CRM e agentes
 *   'marketing'  — agência virtual / conteúdo
 *   'leitura'    — somente visualização
 */
export const organizationMembersTable = pgTable(
  "organization_members",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => appUsersTable.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("comercial"), // admin | coordenador | comercial | marketing | leitura
    isActive: boolean("is_active").notNull().default(true),
    invitedBy: integer("invited_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // Um usuário aparece no máximo uma vez por organização.
    uniqueIndex("organization_members_org_user_idx").on(t.orgId, t.userId),
    index("idx_organization_members_user_id").on(t.userId),
  ],
);

export const insertOrganizationMemberSchema = createInsertSchema(
  organizationMembersTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type OrganizationMember = typeof organizationMembersTable.$inferSelect;
export type InsertOrganizationMember = z.infer<
  typeof insertOrganizationMemberSchema
>;
