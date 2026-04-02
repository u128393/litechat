import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { loadLocalEnv } from "../load-env";

type DatabaseType = "sqlite" | "postgres" | "mysql";
type SslMode = "disable" | "require";

type ParsedArgs = {
  dbType?: DatabaseType;
  sqlitePath?: string;
  dbUrl?: string;
  dbHost?: string;
  dbPort?: string;
  dbName?: string;
  dbUser?: string;
  dbPassword?: string;
  dbSslMode?: SslMode;
  adminEmail?: string;
  adminPassword?: string;
  envFile?: string;
  nonInteractive: boolean;
  help: boolean;
};

type SetupValues = {
  dbType: DatabaseType;
  sqlitePath?: string;
  dbUrl?: string;
  dbHost?: string;
  dbPort?: number;
  dbName?: string;
  dbUser?: string;
  dbPassword?: string;
  dbSslMode?: SslMode;
  adminEmail: string;
  adminPassword: string;
  envFilePath: string;
};

type DatabaseConfig =
  | {
      type: "sqlite";
      sqlitePath: string;
    }
  | {
      type: "postgres" | "mysql";
      connection:
        | {
            kind: "url";
            url: string;
          }
        | {
            kind: "credentials";
            host: string;
            port: number;
            name: string;
            user: string;
            password: string;
            sslMode: SslMode;
          };
    };

type EnvUpdate = {
  key: string;
  value: string;
};

type PromptInterface = ReturnType<typeof createInterface>;

const DEFAULT_SQLITE_PATH = "./data/litechat.db";
const DEFAULT_COOKIE_NAME = "litechat_session";
const DEFAULT_SESSION_TTL_HOURS = "720";
const MIN_SECRET_LENGTH = 32;
const MIN_PASSWORD_LENGTH = 8;

loadLocalEnv();

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const setupValues = await collectSetupValues(args);
  const envUpdates = buildEnvUpdates(setupValues);

  writeMergedEnvFile(setupValues.envFilePath, envUpdates);
  applyEnvUpdates(envUpdates);

  const databaseConfig = toDatabaseConfig(setupValues);

  const [{ createDatabaseConnection }, { createUser }, { getAuthRepository }] = await Promise.all([
    import("../../src/server/db"),
    import("../../src/server/auth"),
    import("../../src/server/auth/repository")
  ]);

  const database = createDatabaseConnection(databaseConfig as never);

  try {
    await database.migrate();

    const repository = getAuthRepository(database);
    const existingUser = await repository.getUserByEmail(setupValues.adminEmail);

    if (existingUser) {
      throw new Error(`A user with email ${setupValues.adminEmail} already exists with role ${existingUser.role}.`);
    }

    const user = await createUser(
      {
        email: setupValues.adminEmail,
        password: setupValues.adminPassword,
        role: "admin"
      },
      database
    );

    process.stdout.write(
      [
        `Updated ${path.relative(process.cwd(), setupValues.envFilePath) || path.basename(setupValues.envFilePath)}.`,
        `Database: ${describeDatabaseTarget(setupValues)}.`,
        `Created admin user ${user.email}.`
      ].join("\n") + "\n"
    );
  } finally {
    await database.close();
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    nonInteractive: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const key = rawKey.trim();
    const expectsValue = !["non-interactive", "help"].includes(key);
    const value = inlineValue ?? (expectsValue ? argv[index + 1] : undefined);

    if (expectsValue && (!value || value.startsWith("--"))) {
      throw new Error(`Missing value for --${key}.`);
    }

    if (expectsValue && inlineValue === undefined) {
      index += 1;
    }

    switch (key) {
      case "db-type":
        args.dbType = parseDatabaseType(value);
        break;
      case "sqlite-path":
        args.sqlitePath = value;
        break;
      case "db-url":
        args.dbUrl = value;
        break;
      case "db-host":
        args.dbHost = value;
        break;
      case "db-port":
        args.dbPort = value;
        break;
      case "db-name":
        args.dbName = value;
        break;
      case "db-user":
        args.dbUser = value;
        break;
      case "db-password":
        args.dbPassword = value;
        break;
      case "db-ssl-mode":
        args.dbSslMode = parseSslMode(value);
        break;
      case "admin-email":
        args.adminEmail = value;
        break;
      case "admin-password":
        args.adminPassword = value;
        break;
      case "env-file":
        args.envFile = value;
        break;
      case "non-interactive":
        args.nonInteractive = true;
        break;
      case "help":
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: --${key}`);
    }
  }

  return args;
}

async function collectSetupValues(args: ParsedArgs): Promise<SetupValues> {
  const envFilePath = path.resolve(process.cwd(), args.envFile ?? ".env.local");
  const defaults = process.env;
  const canPrompt = !args.nonInteractive && input.isTTY && output.isTTY;
  const rl = canPrompt ? createInterface({ input, output }) : null;

  try {
    const dbType =
      args.dbType ??
      parseDatabaseType(defaults.DATABASE_TYPE) ??
      (canPrompt ? await promptDatabaseType(requirePrompt(rl)) : undefined) ??
      fail("--db-type is required in non-interactive mode.");

    const adminEmail = normalizeEmail(
      args.adminEmail ??
        (canPrompt
          ? await promptString(requirePrompt(rl), "Admin email", defaults.LITECHAT_ADMIN_EMAIL ?? "")
          : defaults.LITECHAT_ADMIN_EMAIL)
    );

    validateEmail(adminEmail);

    const adminPassword = args.adminPassword ?? (canPrompt ? await promptPassword(requirePrompt(rl)) : undefined) ?? fail(
      "--admin-password is required in non-interactive mode."
    );

    validatePassword(adminPassword);

    if (dbType === "sqlite") {
      const sqlitePath =
        args.sqlitePath ??
        (canPrompt
          ? await promptString(requirePrompt(rl), "SQLite database path", defaults.DATABASE_SQLITE_PATH ?? DEFAULT_SQLITE_PATH)
          : defaults.DATABASE_SQLITE_PATH ?? DEFAULT_SQLITE_PATH);

      validateNonEmpty(sqlitePath, "SQLite database path");

      return {
        dbType,
        sqlitePath,
        adminEmail,
        adminPassword,
        envFilePath
      };
    }

    const dbUrl =
      args.dbUrl ??
      (canPrompt
        ? await promptString(requirePrompt(rl), `${labelForDatabase(dbType)} connection string`, defaults.DATABASE_URL ?? "")
        : defaults.DATABASE_URL);

    if (dbUrl) {
      validateUrl(dbUrl, dbType);

      return {
        dbType,
        dbUrl,
        adminEmail,
        adminPassword,
        envFilePath
      };
    }

    const dbHost =
      args.dbHost ??
      (canPrompt
        ? await promptString(requirePrompt(rl), `${labelForDatabase(dbType)} host`, defaults.DATABASE_HOST ?? "127.0.0.1")
        : defaults.DATABASE_HOST) ??
      fail(`--db-host is required for ${dbType} when --db-url is not provided.`);
    const dbPortRaw =
      args.dbPort ??
      (canPrompt
        ? await promptString(requirePrompt(rl), `${labelForDatabase(dbType)} port`, defaults.DATABASE_PORT ?? String(defaultPort(dbType)))
        : defaults.DATABASE_PORT ?? String(defaultPort(dbType)));
    const dbName =
      args.dbName ??
      (canPrompt
        ? await promptString(requirePrompt(rl), `${labelForDatabase(dbType)} database name`, defaults.DATABASE_NAME ?? "litechat")
        : defaults.DATABASE_NAME) ??
      fail(`--db-name is required for ${dbType} when --db-url is not provided.`);
    const dbUser =
      args.dbUser ??
      (canPrompt
        ? await promptString(requirePrompt(rl), `${labelForDatabase(dbType)} user`, defaults.DATABASE_USER ?? "litechat")
        : defaults.DATABASE_USER) ??
      fail(`--db-user is required for ${dbType} when --db-url is not provided.`);
    const dbPassword =
      args.dbPassword ??
      (canPrompt
        ? await promptString(requirePrompt(rl), `${labelForDatabase(dbType)} password`, defaults.DATABASE_PASSWORD ?? "")
        : defaults.DATABASE_PASSWORD) ??
      fail(`--db-password is required for ${dbType} when --db-url is not provided.`);
    const dbSslMode =
      args.dbSslMode ??
      parseSslMode(defaults.DATABASE_SSL_MODE) ??
      (canPrompt
        ? parseSslMode(
            await promptString(requirePrompt(rl), `${labelForDatabase(dbType)} SSL mode`, defaults.DATABASE_SSL_MODE ?? "disable")
          )
        : undefined) ??
      "disable";

    validateNonEmpty(dbHost, `${labelForDatabase(dbType)} host`);
    validatePort(dbPortRaw);
    validateNonEmpty(dbName, `${labelForDatabase(dbType)} database name`);
    validateNonEmpty(dbUser, `${labelForDatabase(dbType)} user`);
    validateNonEmpty(dbPassword, `${labelForDatabase(dbType)} password`);

    return {
      dbType,
      dbHost,
      dbPort: Number.parseInt(dbPortRaw, 10),
      dbName,
      dbUser,
      dbPassword,
      dbSslMode,
      adminEmail,
      adminPassword,
      envFilePath
    };
  } finally {
    await rl?.close();
  }
}

function requirePrompt(rl: PromptInterface | null): PromptInterface {
  if (!rl) {
    throw new Error("Interactive prompts are unavailable in non-interactive mode.");
  }

  return rl;
}

function buildEnvUpdates(values: SetupValues): EnvUpdate[] {
  const sessionSecret = ensureSecret(process.env.AUTH_SESSION_SECRET);
  const providerSecret = ensureSecret(process.env.PROVIDER_KEY_ENCRYPTION_SECRET);
  const updates: EnvUpdate[] = [
    { key: "AUTH_SESSION_SECRET", value: sessionSecret },
    { key: "AUTH_SESSION_COOKIE_NAME", value: process.env.AUTH_SESSION_COOKIE_NAME?.trim() || DEFAULT_COOKIE_NAME },
    { key: "AUTH_SESSION_TTL_HOURS", value: process.env.AUTH_SESSION_TTL_HOURS?.trim() || DEFAULT_SESSION_TTL_HOURS },
    { key: "PROVIDER_KEY_ENCRYPTION_SECRET", value: providerSecret },
    { key: "DATABASE_TYPE", value: values.dbType }
  ];

  if (values.dbType === "sqlite") {
    updates.push(
      { key: "DATABASE_SQLITE_PATH", value: values.sqlitePath ?? DEFAULT_SQLITE_PATH },
      { key: "DATABASE_URL", value: "" },
      { key: "DATABASE_HOST", value: "" },
      { key: "DATABASE_PORT", value: "" },
      { key: "DATABASE_NAME", value: "" },
      { key: "DATABASE_USER", value: "" },
      { key: "DATABASE_PASSWORD", value: "" },
      { key: "DATABASE_SSL_MODE", value: "" }
    );
  } else if (values.dbUrl) {
    updates.push(
      { key: "DATABASE_SQLITE_PATH", value: "" },
      { key: "DATABASE_URL", value: values.dbUrl },
      { key: "DATABASE_HOST", value: "" },
      { key: "DATABASE_PORT", value: "" },
      { key: "DATABASE_NAME", value: "" },
      { key: "DATABASE_USER", value: "" },
      { key: "DATABASE_PASSWORD", value: "" },
      { key: "DATABASE_SSL_MODE", value: "" }
    );
  } else {
    updates.push(
      { key: "DATABASE_SQLITE_PATH", value: "" },
      { key: "DATABASE_URL", value: "" },
      { key: "DATABASE_HOST", value: values.dbHost ?? "" },
      { key: "DATABASE_PORT", value: String(values.dbPort ?? "") },
      { key: "DATABASE_NAME", value: values.dbName ?? "" },
      { key: "DATABASE_USER", value: values.dbUser ?? "" },
      { key: "DATABASE_PASSWORD", value: values.dbPassword ?? "" },
      { key: "DATABASE_SSL_MODE", value: values.dbSslMode ?? "disable" }
    );
  }

  return updates;
}

function writeMergedEnvFile(filePath: string, updates: EnvUpdate[]): void {
  const nextValues = new Map(updates.map((entry) => [entry.key, entry.value]));
  const originalContent = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  const lines = originalContent === "" ? [] : originalContent.split(/\r?\n/);
  const seen = new Set<string>();
  const renderedLines = lines.map((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);

    if (!match) {
      return line;
    }

    const key = match[1];

    if (!nextValues.has(key)) {
      return line;
    }

    seen.add(key);
    return renderEnvLine(key, nextValues.get(key) ?? "");
  });

  const missingEntries = updates.filter((entry) => !seen.has(entry.key));

  if (renderedLines.length === 0) {
    renderedLines.push("# Generated by scripts/setup/init-admin.ts");
  }

  if (missingEntries.length > 0 && renderedLines.at(-1) !== "") {
    renderedLines.push("");
  }

  for (const entry of missingEntries) {
    renderedLines.push(renderEnvLine(entry.key, entry.value));
  }

  const content = `${renderedLines.join("\n").replace(/\n*$/u, "")}\n`;
  writeFileSync(filePath, content, "utf8");
}

function applyEnvUpdates(updates: EnvUpdate[]): void {
  for (const entry of updates) {
    process.env[entry.key] = entry.value;
  }
}

function toDatabaseConfig(values: SetupValues): DatabaseConfig {
  if (values.dbType === "sqlite") {
    return {
      type: "sqlite",
      sqlitePath: values.sqlitePath ?? DEFAULT_SQLITE_PATH
    };
  }

  if (values.dbUrl) {
    return {
      type: values.dbType,
      connection: {
        kind: "url",
        url: values.dbUrl
      }
    };
  }

  return {
    type: values.dbType,
    connection: {
      kind: "credentials",
      host: values.dbHost ?? "",
      port: values.dbPort ?? defaultPort(values.dbType),
      name: values.dbName ?? "",
      user: values.dbUser ?? "",
      password: values.dbPassword ?? "",
      sslMode: values.dbSslMode ?? "disable"
    }
  };
}

async function promptDatabaseType(rl: PromptInterface): Promise<DatabaseType> {
  const answer = await promptString(rl, "Database type (sqlite/postgres/mysql)", process.env.DATABASE_TYPE ?? "sqlite");
  return parseDatabaseType(answer) ?? fail("Database type must be sqlite, postgres, or mysql.");
}

async function promptString(rl: PromptInterface, label: string, defaultValue: string): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const value = await rl.question(`${label}${suffix}: `);
  return value.trim() || defaultValue;
}

async function promptPassword(rl: PromptInterface): Promise<string> {
  const password = await rl.question("Admin password: ");
  const confirmation = await rl.question("Confirm admin password: ");

  if (password !== confirmation) {
    throw new Error("Admin password confirmation did not match.");
  }

  return password;
}

function validateEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Admin email must be a valid email address.");
  }
}

function validatePassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Admin password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  if (password.trim().length !== password.length) {
    throw new Error("Admin password must not start or end with whitespace.");
  }
}

function validateUrl(value: string, dbType: Extract<DatabaseType, "postgres" | "mysql">): void {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${labelForDatabase(dbType)} connection string is not a valid URL.`);
  }

  const allowedProtocols = dbType === "postgres" ? ["postgres:", "postgresql:"] : ["mysql:"];

  if (!allowedProtocols.includes(url.protocol)) {
    throw new Error(`${labelForDatabase(dbType)} connection string must use ${allowedProtocols.join(" or ")}.`);
  }
}

function validateNonEmpty(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`${label} is required.`);
  }
}

function validatePort(value: string): void {
  if (!/^\d+$/.test(value)) {
    throw new Error("Database port must be a whole number.");
  }

  const port = Number.parseInt(value, 10);

  if (port < 1 || port > 65535) {
    throw new Error("Database port must be between 1 and 65535.");
  }
}

function normalizeEmail(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function parseDatabaseType(value: string | undefined): DatabaseType | undefined {
  if (value === "sqlite" || value === "postgres" || value === "mysql") {
    return value;
  }

  return undefined;
}

function parseSslMode(value: string | undefined): SslMode | undefined {
  if (value === "disable" || value === "require") {
    return value;
  }

  return undefined;
}

function defaultPort(dbType: Extract<DatabaseType, "postgres" | "mysql">): number {
  return dbType === "postgres" ? 5432 : 3306;
}

function ensureSecret(value: string | undefined): string {
  return value && value.trim().length >= MIN_SECRET_LENGTH ? value.trim() : randomBytes(32).toString("base64url");
}

function renderEnvLine(key: string, value: string): string {
  if (value === "") {
    return `${key}=`;
  }

  if (/^[A-Za-z0-9_./:@+-]+$/.test(value)) {
    return `${key}=${value}`;
  }

  return `${key}="${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function describeDatabaseTarget(values: SetupValues): string {
  if (values.dbType === "sqlite") {
    return values.sqlitePath ?? DEFAULT_SQLITE_PATH;
  }

  if (values.dbUrl) {
    return `${values.dbType} connection string`;
  }

  return `${values.dbType} ${values.dbHost}:${values.dbPort}/${values.dbName}`;
}

function labelForDatabase(dbType: Extract<DatabaseType, "postgres" | "mysql">): string {
  return dbType === "postgres" ? "PostgreSQL" : "MySQL";
}

function fail(message: string): never {
  throw new Error(message);
}

function printHelp(): void {
  process.stdout.write(`Usage: npm run setup:init-admin -- [options]\n\nOptions:\n  --db-type <sqlite|postgres|mysql>\n  --sqlite-path <path>\n  --db-url <url>\n  --db-host <host>\n  --db-port <port>\n  --db-name <database>\n  --db-user <user>\n  --db-password <password>\n  --db-ssl-mode <disable|require>\n  --admin-email <email>\n  --admin-password <password>\n  --env-file <path>\n  --non-interactive\n  --help\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
