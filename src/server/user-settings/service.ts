import type { DatabaseConnection } from "@/server/db";
import { getUserSettingsRepository, type UserSettingsRow } from "@/server/user-settings/repository";

export const customInstructionsMaxLength = 8000;

export type UserSettings = {
  customInstructions: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type UpdateUserSettingsInput = {
  customInstructions: string;
};

export type UpdateUserSettingsResult =
  | { success: true; settings: UserSettings }
  | { success: false; error: "custom_instructions_too_long" };

export async function getCurrentUserSettings(userId: string, database?: DatabaseConnection): Promise<UserSettings> {
  const repository = getUserSettingsRepository(database);
  const settings = await repository.getUserSettings(userId);

  return settings ? toUserSettings(settings) : createDefaultUserSettings();
}

export async function getCustomInstructions(userId: string, database?: DatabaseConnection): Promise<string> {
  const settings = await getCurrentUserSettings(userId, database);
  return settings.customInstructions;
}

export async function updateCurrentUserSettings(
  userId: string,
  input: UpdateUserSettingsInput,
  database?: DatabaseConnection
): Promise<UpdateUserSettingsResult> {
  const customInstructions = normalizeCustomInstructions(input.customInstructions);

  if (customInstructions.length > customInstructionsMaxLength) {
    return { success: false, error: "custom_instructions_too_long" };
  }

  const repository = getUserSettingsRepository(database);
  const existingSettings = await repository.getUserSettings(userId);
  const now = new Date().toISOString();
  const settings = await repository.upsertUserSettings({
    userId,
    customInstructions,
    createdAt: existingSettings?.createdAt ?? now,
    updatedAt: now
  });

  return { success: true, settings: toUserSettings(settings) };
}

export function normalizeCustomInstructions(value: string): string {
  return value.trim();
}

function createDefaultUserSettings(): UserSettings {
  return {
    customInstructions: "",
    createdAt: null,
    updatedAt: null
  };
}

function toUserSettings(settings: UserSettingsRow): UserSettings {
  return {
    customInstructions: settings.customInstructions,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt
  };
}
