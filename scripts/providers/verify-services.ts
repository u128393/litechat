import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import "../load-env";

async function main() {
  const sqlitePath = path.join(os.tmpdir(), `litechat-provider-verify-${process.pid}-${Date.now()}.db`);
  process.env.AUTH_SESSION_SECRET ??= "litechat-auth-verify-session-secret-1234567890";
  process.env.PROVIDER_KEY_ENCRYPTION_SECRET ??= "litechat-provider-encryption-secret-1234567890";
  process.env.DATABASE_TYPE ??= "sqlite";
  process.env.DATABASE_SQLITE_PATH ??= sqlitePath;

  const { createDatabaseConnection } = await import("../../src/server/db");
  const { getProviderConfigRepository } = await import("../../src/server/providers/repository");
  const {
    createProviderConfig,
    getProviderConfigWithSecret,
    listEnabledProviderConfigs,
    updateProviderConfig
  } = await import("../../src/server/providers/service");

  const database = createDatabaseConnection({
    type: "sqlite",
    sqlitePath
  });

  try {
    await database.migrate();

    const createdProviderConfig = await createProviderConfig(
      {
        name: "Primary OpenAI",
        apiKey: "sk-test-created",
        baseUrl: "https://api.openai.com/v1",
        enabled: true
      },
      database
    );
    const repository = getProviderConfigRepository(database);
    const storedProviderConfig = await repository.getProviderConfigById(createdProviderConfig.id);

    assert(storedProviderConfig, "created provider config should be persisted");
    assert(
      storedProviderConfig.apiKeyEncrypted !== "sk-test-created",
      "provider API key should be encrypted before database storage"
    );

    const providerConfigWithSecret = await getProviderConfigWithSecret(createdProviderConfig.id, database);

    assert(providerConfigWithSecret?.apiKey === "sk-test-created", "stored provider API key should decrypt correctly");

    const updatedProviderConfig = await updateProviderConfig(
      createdProviderConfig.id,
      {
        enabled: false,
        apiKey: "sk-test-updated"
      },
      database
    );
    const activeProviderConfigs = await listEnabledProviderConfigs(database);
    const updatedStoredProviderConfig = await repository.getProviderConfigById(createdProviderConfig.id);
    const updatedProviderConfigWithSecret = await getProviderConfigWithSecret(createdProviderConfig.id, database);

    assert(updatedProviderConfig?.enabled === false, "provider config updates should persist enabled state");
    assert(activeProviderConfigs.length === 0, "disabled provider configs should be excluded from active listings");
    assert(
      updatedStoredProviderConfig?.apiKeyEncrypted !== storedProviderConfig.apiKeyEncrypted,
      "provider API key updates should rewrite ciphertext"
    );
    assert(
      updatedProviderConfigWithSecret?.apiKey === "sk-test-updated",
      "updated provider API key should decrypt correctly"
    );

    process.stdout.write(`Verified provider config storage, encryption, updates, and active filtering using ${sqlitePath}.\n`);
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
