import { defineConfig } from "drizzle-kit";

import "./scripts/load-env";
import { appConfig } from "./src/server/config/app-config";
import { resolveMysqlConnection, resolvePostgresConnection, resolveSqlitePath } from "./src/server/db/config";

const baseConfig = {
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true
} as const;

const config =
  appConfig.database.type === "sqlite"
    ? defineConfig({
        ...baseConfig,
        dialect: "sqlite",
        dbCredentials: {
          url: resolveSqlitePath(appConfig.database)
        }
      })
    : appConfig.database.type === "postgres"
      ? defineConfig({
          ...baseConfig,
          dialect: "postgresql",
          dbCredentials: resolvePostgresConnection(appConfig.database)
        })
      : defineConfig({
          ...baseConfig,
          dialect: "mysql",
          dbCredentials: resolveMysqlConnection(appConfig.database)
        });

export default config;
