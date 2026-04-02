import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import "../load-env";

class MemoryCookieStore {
  private values = new Map<string, string>();

  get(name: string) {
    const value = this.values.get(name);
    return value ? { value } : undefined;
  }

  set(name: string, value: string, _options?: unknown) {
    this.values.set(name, value);
  }

  delete(name: string) {
    this.values.delete(name);
  }
}

async function main() {
  const sqlitePath = path.join(os.tmpdir(), `litechat-auth-verify-${process.pid}-${Date.now()}.db`);
  process.env.AUTH_SESSION_SECRET ??= "litechat-auth-verify-session-secret-1234567890";
  process.env.PROVIDER_KEY_ENCRYPTION_SECRET ??= "litechat-provider-encryption-secret-1234567890";
  process.env.DATABASE_TYPE ??= "sqlite";
  process.env.DATABASE_SQLITE_PATH ??= sqlitePath;

  const { appConfig } = await import("../../src/server/config/app-config");
  const { createDatabaseConnection } = await import("../../src/server/db");
  const { createSessionCookie, getCurrentUserFromCookieStore, hashPassword, logout, verifyPassword } = await import(
    "../../src/server/auth"
  );
  const { createUser, verifyUserPassword } = await import("../../src/server/auth/service");

  const database = createDatabaseConnection({
    type: "sqlite",
    sqlitePath
  });

  try {
    await database.migrate();

    const rawPasswordHash = await hashPassword("correct horse battery staple");
    assert(await verifyPassword(rawPasswordHash, "correct horse battery staple"), "password hash should verify");
    assert(!(await verifyPassword(rawPasswordHash, "not it")), "password hash should reject invalid passwords");

    const user = await createUser(
      {
        email: "admin@example.com",
        password: "correct horse battery staple",
        role: "admin"
      },
      database
    );
    const authenticatedUser = await verifyUserPassword("admin@example.com", "correct horse battery staple", database);

    assert(authenticatedUser?.id === user.id, "service password verification should resolve the created user");
    assert(authenticatedUser?.role === "admin", "service password verification should preserve role data");

    const cookieStore = new MemoryCookieStore();
    const createdSession = await createSessionCookie(user.id, cookieStore, database);
    const currentUser = await getCurrentUserFromCookieStore(cookieStore, database);

    assert(Boolean(createdSession.token), "session creation should return a browser token");
    assert(currentUser?.userId === user.id, "current-user resolution should find the session owner");
    assert(currentUser?.role === "admin", "current-user resolution should include the user role");

    const logoutResult = await logout(cookieStore, database);
    const currentUserAfterLogout = await getCurrentUserFromCookieStore(cookieStore, database);

    assert(logoutResult.invalidated, "logout should invalidate the stored session");
    assert(currentUserAfterLogout === null, "invalidated sessions should no longer resolve to a current user");
    assert(
      cookieStore.get(appConfig.auth.sessionCookieName) === undefined,
      "logout should clear the session cookie"
    );

    process.stdout.write(`Verified password hashing, session lifecycle, and logout invalidation using ${sqlitePath}.\n`);
  } finally {
    await database.close();

    if (existsSync(sqlitePath)) {
      rmSync(sqlitePath);
    }
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
