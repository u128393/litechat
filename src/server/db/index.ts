export {
  createDatabaseConnection,
  getDatabase,
  migrateDatabase,
  shutdownDatabase,
  type DatabaseConnection,
  type DatabaseDialect
} from "@/server/db/client";
export {
  createRepositoryContext,
  defineRepository,
  type RepositoryContext
} from "@/server/db/repository";
export { describeDatabaseConnection, resolveDrizzleKitCredentials, resolveDrizzleKitDialect } from "@/server/db/config";
export { modelConfigs, providerConfigs, schema, sessions, users, type UserRole } from "@/server/db/schema";
