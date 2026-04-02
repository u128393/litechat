import { loadLocalEnv } from "../load-env";

loadLocalEnv();

async function main() {
  const { getDatabase, migrateDatabase, shutdownDatabase } = await import("../../src/server/db");
  const database = getDatabase();

  await migrateDatabase(database);
  await shutdownDatabase(database);

  process.stdout.write(`Applied migrations for ${database.dialect}.\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
