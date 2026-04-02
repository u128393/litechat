const APP_NAME = "LiteChat";
const APP_DESCRIPTION = "A lightweight browser-based LLM chat workspace.";
const DEFAULT_SESSION_COOKIE_NAME = "litechat_session";
const DEFAULT_SESSION_TTL_HOURS = 24 * 30;
const MIN_SECRET_LENGTH = 32;

const DATABASE_TYPES = ["sqlite", "postgres", "mysql"] as const;
const DATABASE_SSL_MODES = ["disable", "require"] as const;

type DatabaseType = (typeof DATABASE_TYPES)[number];
type DatabaseSslMode = (typeof DATABASE_SSL_MODES)[number];
type RuntimeEnvironment = "development" | "test" | "production";

export type UrlDatabaseConnectionConfig = {
  kind: "url";
  url: string;
};

export type NetworkDatabaseConnectionConfig = {
  kind: "credentials";
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  sslMode: DatabaseSslMode;
};

export type SqliteDatabaseConfig = {
  type: "sqlite";
  sqlitePath: string;
};

export type PostgresDatabaseConfig = {
  type: "postgres";
  connection: UrlDatabaseConnectionConfig | NetworkDatabaseConnectionConfig;
};

export type MysqlDatabaseConfig = {
  type: "mysql";
  connection: UrlDatabaseConnectionConfig | NetworkDatabaseConnectionConfig;
};

export type DatabaseConfig =
  | SqliteDatabaseConfig
  | PostgresDatabaseConfig
  | MysqlDatabaseConfig;

export type AppConfig = {
  app: {
    name: string;
    description: string;
    environment: RuntimeEnvironment;
    isDevelopment: boolean;
    isProduction: boolean;
  };
  auth: {
    sessionSecret: string;
    sessionCookieName: string;
    sessionTtlHours: number;
    secureCookies: boolean;
  };
  database: DatabaseConfig;
  security: {
    providerKeyEncryptionSecret: string;
  };
};

export const appConfig = loadAppConfig(process.env);

function loadAppConfig(env: NodeJS.ProcessEnv): AppConfig {
  const issues: string[] = [];

  const environment = parseRuntimeEnvironment(env.NODE_ENV);
  const auth = {
    sessionSecret: readRequiredSecret(env, "AUTH_SESSION_SECRET", issues),
    sessionCookieName: readOptionalString(env, "AUTH_SESSION_COOKIE_NAME") ?? DEFAULT_SESSION_COOKIE_NAME,
    sessionTtlHours: readOptionalInteger(
      env,
      "AUTH_SESSION_TTL_HOURS",
      DEFAULT_SESSION_TTL_HOURS,
      issues,
      { min: 1 }
    ),
    secureCookies: environment === "production"
  };

  const providerKeyEncryptionSecret = readRequiredSecret(
    env,
    "PROVIDER_KEY_ENCRYPTION_SECRET",
    issues
  );

  const databaseType = readEnum(env.DATABASE_TYPE, "DATABASE_TYPE", DATABASE_TYPES, issues);

  let database: DatabaseConfig | undefined;

  if (databaseType === "sqlite") {
    database = {
      type: "sqlite",
      sqlitePath: readRequiredString(env, "DATABASE_SQLITE_PATH", issues)
    };
  }

  if (databaseType === "postgres" || databaseType === "mysql") {
    database = {
      type: databaseType,
      connection: parseNetworkDatabaseConnection(env, databaseType, issues)
    };
  }

  if (issues.length > 0) {
    throw new Error(formatIssues(issues));
  }

  if (!database) {
    throw new Error("Database configuration could not be resolved.");
  }

  return {
    app: {
      name: APP_NAME,
      description: APP_DESCRIPTION,
      environment,
      isDevelopment: environment === "development",
      isProduction: environment === "production"
    },
    auth,
    database,
    security: {
      providerKeyEncryptionSecret
    }
  };
}

function parseRuntimeEnvironment(value: string | undefined): RuntimeEnvironment {
  if (value === "production" || value === "test") {
    return value;
  }

  return "development";
}

function parseNetworkDatabaseConnection(
  env: NodeJS.ProcessEnv,
  databaseType: Extract<DatabaseType, "postgres" | "mysql">,
  issues: string[]
): UrlDatabaseConnectionConfig | NetworkDatabaseConnectionConfig {
  const url = readOptionalString(env, "DATABASE_URL");

  if (url) {
    return {
      kind: "url",
      url
    };
  }

  return {
    kind: "credentials",
    host: readRequiredString(env, "DATABASE_HOST", issues),
    port: readOptionalInteger(env, "DATABASE_PORT", defaultDatabasePort(databaseType), issues, {
      min: 1,
      max: 65535
    }),
    name: readRequiredString(env, "DATABASE_NAME", issues),
    user: readRequiredString(env, "DATABASE_USER", issues),
    password: readRequiredString(env, "DATABASE_PASSWORD", issues),
    sslMode:
      readEnum(readOptionalString(env, "DATABASE_SSL_MODE") ?? "disable", "DATABASE_SSL_MODE", DATABASE_SSL_MODES, issues) ??
      "disable"
  };
}

function defaultDatabasePort(databaseType: Extract<DatabaseType, "postgres" | "mysql">): number {
  return databaseType === "postgres" ? 5432 : 3306;
}

function readRequiredSecret(
  env: NodeJS.ProcessEnv,
  name: string,
  issues: string[]
): string {
  const value = readRequiredString(env, name, issues);

  if (value && value.length < MIN_SECRET_LENGTH) {
    issues.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters long.`);
  }

  return value;
}

function readRequiredString(env: NodeJS.ProcessEnv, name: string, issues: string[]): string {
  const value = readOptionalString(env, name);

  if (!value) {
    issues.push(`${name} is required.`);
    return "";
  }

  return value;
}

function readOptionalString(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();

  return value ? value : undefined;
}

function readOptionalInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  issues: string[],
  bounds?: { min?: number; max?: number }
): number {
  const rawValue = readOptionalString(env, name);

  if (!rawValue) {
    return fallback;
  }

  if (!/^\d+$/.test(rawValue)) {
    issues.push(`${name} must be a whole number.`);
    return fallback;
  }

  const value = Number.parseInt(rawValue, 10);

  if (bounds?.min !== undefined && value < bounds.min) {
    issues.push(`${name} must be at least ${bounds.min}.`);
  }

  if (bounds?.max !== undefined && value > bounds.max) {
    issues.push(`${name} must be at most ${bounds.max}.`);
  }

  return value;
}

function readEnum<const T extends readonly string[]>(
  value: string | undefined,
  name: string,
  allowedValues: T,
  issues: string[]
): T[number] | undefined {
  if (!value) {
    issues.push(`${name} is required.`);
    return undefined;
  }

  if ((allowedValues as readonly string[]).includes(value)) {
    return value as T[number];
  }

  issues.push(`${name} must be one of: ${allowedValues.join(", ")}.`);
  return undefined;
}

function formatIssues(issues: string[]): string {
  return `Invalid environment configuration:\n- ${issues.join("\n- ")}`;
}
