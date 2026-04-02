import os from "node:os";
import path from "node:path";

import "../load-env";

import type { DatabaseConfig } from "../../src/server/config/app-config";

const sampleConfigs: DatabaseConfig[] = [
  {
    type: "sqlite",
    sqlitePath: path.join(os.tmpdir(), "litechat-drizzle-factory-check.db")
  },
  {
    type: "postgres",
    connection: {
      kind: "url",
      url: "postgres://litechat:litechat@127.0.0.1:5432/litechat"
    }
  },
  {
    type: "mysql",
    connection: {
      kind: "credentials",
      host: "127.0.0.1",
      port: 3306,
      name: "litechat",
      user: "litechat",
      password: "litechat",
      sslMode: "disable"
    }
  }
];

async function main() {
  const { createDatabaseConnection } = await import("../../src/server/db");

  for (const config of sampleConfigs) {
    const database = createDatabaseConnection(config);

    process.stdout.write(
      `${database.dialect}: client=${database.clientKind}; migrationDialect=${database.migrationDialect}\n`
    );

    await database.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
