import path from "node:path";

import type {
  DatabaseConfig,
  MysqlDatabaseConfig,
  NetworkDatabaseConnectionConfig,
  PostgresDatabaseConfig,
  SqliteDatabaseConfig
} from "@/server/config/app-config";

type PostgresCredentials = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: false | "require";
};

type MysqlCredentials = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: "true";
};

type DrizzleKitCredentials =
  | { url: string }
  | { host: string; port: number; user: string; password: string; database: string; ssl?: false | "require" | "true" };

export function resolveDrizzleKitDialect(database: DatabaseConfig): "sqlite" | "postgresql" | "mysql" {
  switch (database.type) {
    case "sqlite":
      return "sqlite";
    case "postgres":
      return "postgresql";
    case "mysql":
      return "mysql";
  }
}

export function resolveDrizzleKitCredentials(database: DatabaseConfig): DrizzleKitCredentials {
  switch (database.type) {
    case "sqlite":
      return { url: resolveSqlitePath(database) };
    case "postgres":
      return resolvePostgresConnection(database);
    case "mysql":
      return resolveMysqlConnection(database);
  }
}

export function resolveSqlitePath(database: SqliteDatabaseConfig): string {
  return path.resolve(process.cwd(), database.sqlitePath);
}

export function resolvePostgresConnection(database: PostgresDatabaseConfig): { url: string } | PostgresCredentials {
  if (database.connection.kind === "url") {
    return { url: database.connection.url };
  }

  return {
    host: database.connection.host,
    port: database.connection.port,
    user: database.connection.user,
    password: database.connection.password,
    database: database.connection.name,
    ssl: database.connection.sslMode === "require" ? "require" : false
  };
}

export function resolveMysqlConnection(database: MysqlDatabaseConfig): { url: string } | MysqlCredentials {
  if (database.connection.kind === "url") {
    return { url: database.connection.url };
  }

  return {
    host: database.connection.host,
    port: database.connection.port,
    user: database.connection.user,
    password: database.connection.password,
    database: database.connection.name,
    ssl: database.connection.sslMode === "require" ? "true" : undefined
  };
}

export function describeDatabaseConnection(database: DatabaseConfig): string {
  if (database.type === "sqlite") {
    return database.sqlitePath;
  }

  if (database.connection.kind === "url") {
    return "connection string";
  }

  return `${database.connection.host}:${database.connection.port}/${database.connection.name}`;
}

export function networkConnectionToUrl(
  dialect: "postgres" | "mysql",
  connection: NetworkDatabaseConnectionConfig
): string {
  const protocol = dialect === "postgres" ? "postgres" : "mysql";
  const url = new URL(`${protocol}://placeholder`);

  url.username = connection.user;
  url.password = connection.password;
  url.hostname = connection.host;
  url.port = String(connection.port);
  url.pathname = `/${connection.name}`;

  if (connection.sslMode === "require") {
    url.searchParams.set(dialect === "postgres" ? "sslmode" : "ssl", dialect === "postgres" ? "require" : "true");
  }

  return url.toString();
}
