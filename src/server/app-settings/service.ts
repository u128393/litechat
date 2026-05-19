import type { DatabaseConnection } from "@/server/db";
import { getAppSettingsRepository } from "@/server/app-settings/repository";
import { getModelConfigRepository } from "@/server/model-configs/repository";

const titleGenerationModelConfigIdKey = "titleGenerationModelConfigId";

export type AppSettings = {
  titleGenerationModelConfigId: string | null;
};

export type UpdateAppSettingsInput = {
  titleGenerationModelConfigId: string | null;
};

export type UpdateAppSettingsResult =
  | { success: true; settings: AppSettings }
  | { success: false; error: "title_generation_model_config_not_found" };

export async function getAppSettings(database?: DatabaseConnection): Promise<AppSettings> {
  const repository = getAppSettingsRepository(database);
  const titleGenerationModelConfigId = await repository.getSetting(titleGenerationModelConfigIdKey);

  return {
    titleGenerationModelConfigId: normalizeOptionalSettingValue(titleGenerationModelConfigId?.value ?? null)
  };
}

export async function getTitleGenerationModelConfigId(database?: DatabaseConnection): Promise<string | null> {
  const settings = await getAppSettings(database);
  return settings.titleGenerationModelConfigId;
}

export async function updateAppSettings(
  input: UpdateAppSettingsInput,
  database?: DatabaseConnection
): Promise<UpdateAppSettingsResult> {
  const titleGenerationModelConfigId = normalizeOptionalSettingValue(input.titleGenerationModelConfigId);

  if (titleGenerationModelConfigId) {
    const modelConfig = await getModelConfigRepository(database).getModelConfigById(titleGenerationModelConfigId);

    if (!modelConfig) {
      return { success: false, error: "title_generation_model_config_not_found" };
    }

  }

  const repository = getAppSettingsRepository(database);
  const existingSetting = await repository.getSetting(titleGenerationModelConfigIdKey);
  const now = new Date().toISOString();

  await repository.upsertSetting({
    key: titleGenerationModelConfigIdKey,
    value: titleGenerationModelConfigId ?? "",
    createdAt: existingSetting?.createdAt ?? now,
    updatedAt: now
  });

  return {
    success: true,
    settings: {
      titleGenerationModelConfigId
    }
  };
}

function normalizeOptionalSettingValue(value: string | null): string | null {
  const normalizedValue = value?.trim() ?? "";
  return normalizedValue === "" ? null : normalizedValue;
}
