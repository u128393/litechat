import { appConfig } from "@/server/config/app-config";

import { index as mysqlIndex, mysqlTable, uniqueIndex as mysqlUniqueIndex, varchar as mysqlVarchar } from "drizzle-orm/mysql-core";
import { index as pgIndex, pgTable, uniqueIndex as pgUniqueIndex, varchar as pgVarchar } from "drizzle-orm/pg-core";
import { index as sqliteIndex, sqliteTable, text as sqliteText } from "drizzle-orm/sqlite-core";

const USER_ROLE_VALUES = ["user", "admin"] as const;

export type UserRole = (typeof USER_ROLE_VALUES)[number];

function defineSqliteSchema() {
  const users = sqliteTable("users", {
    id: sqliteText("id").primaryKey(),
    email: sqliteText("email").notNull().unique(),
    passwordHash: sqliteText("password_hash").notNull(),
    role: sqliteText("role", { enum: USER_ROLE_VALUES }).notNull(),
    createdAt: sqliteText("created_at").notNull(),
    updatedAt: sqliteText("updated_at").notNull()
  });

  const sessions = sqliteTable("sessions", {
    id: sqliteText("id").primaryKey(),
    userId: sqliteText("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: sqliteText("token_hash").notNull().unique(),
    expiresAt: sqliteText("expires_at").notNull(),
    createdAt: sqliteText("created_at").notNull(),
    invalidatedAt: sqliteText("invalidated_at")
  }, (table) => ({
    userIdIdx: sqliteIndex("sessions_user_id_idx").on(table.userId)
  }));

  return { users, sessions };
}

function definePostgresSchema() {
  const users = pgTable(
    "users",
    {
      id: pgVarchar("id", { length: 191 }).primaryKey(),
      email: pgVarchar("email", { length: 320 }).notNull(),
      passwordHash: pgVarchar("password_hash", { length: 512 }).notNull(),
      role: pgVarchar("role", { length: 32 }).notNull(),
      createdAt: pgVarchar("created_at", { length: 64 }).notNull(),
      updatedAt: pgVarchar("updated_at", { length: 64 }).notNull()
    },
    (table) => ({
      emailIdx: pgUniqueIndex("users_email_idx").on(table.email)
    })
  );

  const sessions = pgTable(
    "sessions",
    {
      id: pgVarchar("id", { length: 191 }).primaryKey(),
      userId: pgVarchar("user_id", { length: 191 })
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
      tokenHash: pgVarchar("token_hash", { length: 128 }).notNull(),
      expiresAt: pgVarchar("expires_at", { length: 64 }).notNull(),
      createdAt: pgVarchar("created_at", { length: 64 }).notNull(),
      invalidatedAt: pgVarchar("invalidated_at", { length: 64 })
    },
    (table) => ({
      tokenHashIdx: pgUniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
      userIdIdx: pgIndex("sessions_user_id_idx").on(table.userId)
    })
  );

  return { users, sessions };
}

function defineMysqlSchema() {
  const users = mysqlTable(
    "users",
    {
      id: mysqlVarchar("id", { length: 191 }).primaryKey(),
      email: mysqlVarchar("email", { length: 320 }).notNull(),
      passwordHash: mysqlVarchar("password_hash", { length: 512 }).notNull(),
      role: mysqlVarchar("role", { length: 32 }).notNull(),
      createdAt: mysqlVarchar("created_at", { length: 64 }).notNull(),
      updatedAt: mysqlVarchar("updated_at", { length: 64 }).notNull()
    },
    (table) => ({
      emailIdx: mysqlUniqueIndex("users_email_idx").on(table.email)
    })
  );

  const sessions = mysqlTable(
    "sessions",
    {
      id: mysqlVarchar("id", { length: 191 }).primaryKey(),
      userId: mysqlVarchar("user_id", { length: 191 })
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
      tokenHash: mysqlVarchar("token_hash", { length: 128 }).notNull(),
      expiresAt: mysqlVarchar("expires_at", { length: 64 }).notNull(),
      createdAt: mysqlVarchar("created_at", { length: 64 }).notNull(),
      invalidatedAt: mysqlVarchar("invalidated_at", { length: 64 })
    },
    (table) => ({
      tokenHashIdx: mysqlUniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
      userIdIdx: mysqlIndex("sessions_user_id_idx").on(table.userId)
    })
  );

  return { users, sessions };
}

const activeSchema =
  appConfig.database.type === "sqlite"
    ? defineSqliteSchema()
    : appConfig.database.type === "postgres"
      ? definePostgresSchema()
      : defineMysqlSchema();

export const users = activeSchema.users;
export const sessions = activeSchema.sessions;
export const schema = {
  users,
  sessions
};
