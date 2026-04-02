import { getDatabase, type DatabaseConnection, type DatabaseDialect } from "@/server/db/client";

export type RepositoryContext = {
  db: DatabaseConnection["db"];
  dialect: DatabaseDialect;
};

export function createRepositoryContext(database = getDatabase()): RepositoryContext {
  return {
    db: database.db,
    dialect: database.dialect
  };
}

export function defineRepository<TRepository>(
  createRepository: (context: RepositoryContext) => TRepository
): (database?: DatabaseConnection) => TRepository {
  return (database = getDatabase()) => createRepository(createRepositoryContext(database));
}
