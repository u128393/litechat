import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import "../load-env";

async function main() {
  const sqlitePath = path.join(os.tmpdir(), `litechat-model-verify-${process.pid}-${Date.now()}.db`);
  process.env.AUTH_SESSION_SECRET ??= "litechat-auth-verify-session-secret-1234567890";
  process.env.PROVIDER_KEY_ENCRYPTION_SECRET ??= "litechat-provider-encryption-secret-1234567890";
  process.env.DATABASE_TYPE ??= "sqlite";
  process.env.DATABASE_SQLITE_PATH ??= sqlitePath;

  const { createDatabaseConnection } = await import("../../src/server/db");
  const { createProviderConfig } = await import("../../src/server/providers");
  const { getModelConfigRepository } = await import("../../src/server/model-configs/repository");
    const { createModelConfig, listModelConfigs, listUserSelectableModels, reorderModelConfigs, updateModelConfig } = await import("../../src/server/model-configs");

  const database = createDatabaseConnection({
    type: "sqlite",
    sqlitePath
  });

  try {
    await database.migrate();

    const enabledProvider = await createProviderConfig(
      {
        name: "Enabled OpenAI",
        apiKey: "sk-enabled",
        enabled: true
      },
      database
    );
    const disabledProvider = await createProviderConfig(
      {
        name: "Disabled OpenAI",
        apiKey: "sk-disabled",
        enabled: false
      },
      database
    );

    const missingProviderResult = await createModelConfig(
      {
        providerConfigId: "missing-provider",
        modelId: "gpt-missing",
        displayName: "Missing Provider",
        enabled: true
      },
      database
    );

    assert(
      !missingProviderResult.success && missingProviderResult.error === "provider_config_not_found",
      "model config creation should reject missing provider references"
    );

    const enabledModelResult = await createModelConfig(
      {
        providerConfigId: enabledProvider.id,
        modelId: "gpt-4.1",
        displayName: "GPT 4.1",
        enabled: true,
        supportsWebSearch: true,
        sortOrder: 5
      },
      database
    );
    const disabledModelResult = await createModelConfig(
      {
        providerConfigId: enabledProvider.id,
        modelId: "gpt-disabled",
        displayName: "Disabled Model",
        enabled: false,
        supportsWebSearch: false,
        sortOrder: 10
      },
      database
    );
    const blockedByProviderResult = await createModelConfig(
      {
        providerConfigId: disabledProvider.id,
        modelId: "gpt-provider-off",
        displayName: "Provider Disabled Model",
        enabled: true,
        supportsWebSearch: false,
        sortOrder: 15
      },
      database
    );

    assert(enabledModelResult.success, "valid model config should be created");
    assert(disabledModelResult.success, "disabled model config should still be persisted");
    assert(blockedByProviderResult.success, "model config can be tied to an existing disabled provider");

    const repository = getModelConfigRepository(database);
    const storedEnabledModel = await repository.getModelConfigById(enabledModelResult.modelConfig.id);
    const listedModels = await listModelConfigs(database);
    const userSelectableModels = await listUserSelectableModels(database);
    const updatedModelResult = await updateModelConfig(
      enabledModelResult.modelConfig.id,
      {
        supportsWebSearch: false,
        sortOrder: 1
      },
      database
    );

    assert(storedEnabledModel?.supportsWebSearch === true, "web search support should persist on create");
    assert(listedModels.length === 3, "admin model listing should include all stored model configs");
    assert(userSelectableModels.length === 1, "user model listing should exclude disabled models and disabled providers");
    assert(userSelectableModels[0]?.id === enabledModelResult.modelConfig.id, "user model listing should include enabled model ids");
    assert(userSelectableModels[0]?.supportsWebSearch === true, "user model listing should expose web search support");
    assert(updatedModelResult.success, "model config update should succeed");
    assert(updatedModelResult.modelConfig.supportsWebSearch === false, "model config updates should persist web search support");
    assert(updatedModelResult.modelConfig.sortOrder === 1, "model config updates should persist sort order");

    const reorderResult = await reorderModelConfigs(
      {
        modelConfigIds: [
          blockedByProviderResult.modelConfig.id,
          enabledModelResult.modelConfig.id,
          disabledModelResult.modelConfig.id
        ]
      },
      database
    );
    const mismatchReorderResult = await reorderModelConfigs(
      {
        modelConfigIds: [enabledModelResult.modelConfig.id]
      },
      database
    );
    const defaultTopModelResult = await createModelConfig(
      {
        providerConfigId: enabledProvider.id,
        modelId: "gpt-default-top",
        displayName: "Default Top Model",
        enabled: true,
        supportsWebSearch: false
      },
      database
    );
    const reorderedModels = await listModelConfigs(database);
    const reorderedUserSelectableModels = await listUserSelectableModels(database);

    assert(reorderResult.success, "model config reorder should succeed");
    assert(defaultTopModelResult.success, "model config creation should default to the top of the list");
    assert(reorderedModels[0]?.id === defaultTopModelResult.modelConfig.id, "new model configs should default above existing models");
    assert(reorderedModels[1]?.id === blockedByProviderResult.modelConfig.id, "admin model listing should use reordered sort order");
    assert(reorderedModels[2]?.id === enabledModelResult.modelConfig.id, "admin model listing should persist middle reordered model");
    assert(reorderedModels[3]?.id === disabledModelResult.modelConfig.id, "admin model listing should persist last reordered model");
    assert(reorderedUserSelectableModels[0]?.id === defaultTopModelResult.modelConfig.id, "user model listing should expose newly created top model first");
    assert(reorderedUserSelectableModels[1]?.id === enabledModelResult.modelConfig.id, "user model listing should preserve reordered active model order");
    assert(!mismatchReorderResult.success && mismatchReorderResult.error === "model_config_order_mismatch", "model config reorder should reject incomplete order lists");

    process.stdout.write(`Verified model config storage, validation, updates, and active filtering using ${sqlitePath}.\n`);
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
