import { mkdirSync } from "node:fs";
import path from "node:path";

import BetterSqlite3 from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { migrate as migrateSqlite } from "drizzle-orm/better-sqlite3/migrator";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import { migrate as migrateMysql } from "drizzle-orm/mysql2/migrator";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { migrate as migratePostgres } from "drizzle-orm/node-postgres/migrator";
import { createPool as createMysqlPool, type Pool as MysqlPool } from "mysql2/promise";
import { Pool as PostgresPool } from "pg";

import { appConfig, type DatabaseConfig } from "@/server/config/app-config";
import { resolveMysqlConnection, resolvePostgresConnection, resolveSqlitePath } from "@/server/db/config";
import { schema } from "@/server/db/schema";

const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");

type AppSchema = typeof schema;
type SqliteDatabase = BetterSQLite3Database<AppSchema>;
type PostgresDatabase = NodePgDatabase<AppSchema>;
type MysqlDatabase = MySql2Database<AppSchema>;
type DatabaseClient = SqliteDatabase | PostgresDatabase | MysqlDatabase;
type SqliteClient = InstanceType<typeof BetterSqlite3>;
type DatabaseDriver = SqliteClient | PostgresPool | MysqlPool;

export type DatabaseDialect = DatabaseConfig["type"];

export type DatabaseConnection = {
  dialect: DatabaseDialect;
  migrationDialect: "sqlite" | "postgresql" | "mysql";
  clientKind: "better-sqlite3" | "pg" | "mysql2";
  db: DatabaseClient;
  client: DatabaseDriver;
  close: () => Promise<void>;
  migrate: () => Promise<void>;
};

declare global {
  var __litechatDatabase__: DatabaseConnection | undefined;
}

export function createDatabaseConnection(databaseConfig: DatabaseConfig = appConfig.database): DatabaseConnection {
  switch (databaseConfig.type) {
    case "sqlite": {
      const sqlitePath = resolveSqlitePath(databaseConfig);

      mkdirSync(path.dirname(sqlitePath), { recursive: true });

      const client = new BetterSqlite3(sqlitePath);
      const db = drizzleSqlite(client, { schema });

      return {
        dialect: "sqlite",
        migrationDialect: "sqlite",
        clientKind: "better-sqlite3",
        db,
        client,
        close: async () => {
          client.close();
        },
        migrate: async () => {
          migrateSqlite(db, { migrationsFolder: MIGRATIONS_FOLDER });
        }
      };
    }
    case "postgres": {
      const connection = resolvePostgresConnection(databaseConfig);
      const client = new PostgresPool(
        "url" in connection
          ? { connectionString: connection.url }
          : {
              host: connection.host,
              port: connection.port,
              user: connection.user,
              password: connection.password,
              database: connection.database,
              ssl: connection.ssl === "require" ? { rejectUnauthorized: false } : undefined
            }
      );
      const db = drizzlePostgres(client, { schema });

      return {
        dialect: "postgres",
        migrationDialect: "postgresql",
        clientKind: "pg",
        db,
        client,
        close: async () => {
          await client.end();
        },
        migrate: async () => {
          await migratePostgres(db, { migrationsFolder: MIGRATIONS_FOLDER });
        }
      };
    }
    case "mysql": {
      const connection = resolveMysqlConnection(databaseConfig);
      const client =
        "url" in connection
          ? createMysqlPool(connection.url)
          : createMysqlPool({
              host: connection.host,
              port: connection.port,
              user: connection.user,
              password: connection.password,
              database: connection.database,
              ssl: connection.ssl
            });
      const db = drizzleMysql(client, { schema, mode: "default" });

      return {
        dialect: "mysql",
        migrationDialect: "mysql",
        clientKind: "mysql2",
        db,
        client,
        close: async () => {
          await client.end();
        },
        migrate: async () => {
          await migrateMysql(db, { migrationsFolder: MIGRATIONS_FOLDER });
        }
      };
    }
  }
}

export function getDatabase(): DatabaseConnection {
  if (!globalThis.__litechatDatabase__) {
    globalThis.__litechatDatabase__ = createDatabaseConnection();
  }

  return globalThis.__litechatDatabase__;
}

export async function migrateDatabase(database = getDatabase()): Promise<void> {
  await database.migrate();
}

export async function shutdownDatabase(database = getDatabase()): Promise<void> {
  if (globalThis.__litechatDatabase__ === database) {
    globalThis.__litechatDatabase__ = undefined;
  }

  await database.close();
}
