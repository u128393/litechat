import type { DatabaseConnection } from "@/server/db";
import { getUserSettingsRepository, type UserSettingsRow } from "@/server/user-settings/repository";

export const personalizationMaxLength = 8000;

export type UserSettings = {
  personalization: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type UpdateUserSettingsInput = {
  personalization: string;
};

export type UpdateUserSettingsResult =
  | { success: true; settings: UserSettings }
  | { success: false; error: "personalization_too_long" };

export async function getCurrentUserSettings(userId: string, database?: DatabaseConnection): Promise<UserSettings> {
  const repository = getUserSettingsRepository(database);
  const settings = await repository.getUserSettings(userId);

  return settings ? toUserSettings(settings) : createDefaultUserSettings();
}

export async function getPersonalization(userId: string, database?: DatabaseConnection): Promise<string> {
  const settings = await getCurrentUserSettings(userId, database);
  return settings.personalization;
}

export async function updateCurrentUserSettings(
  userId: string,
  input: UpdateUserSettingsInput,
  database?: DatabaseConnection
): Promise<UpdateUserSettingsResult> {
  const personalization = normalizePersonalization(input.personalization);

  if (personalization.length > personalizationMaxLength) {
    return { success: false, error: "personalization_too_long" };
  }

  const repository = getUserSettingsRepository(database);
  const existingSettings = await repository.getUserSettings(userId);
  const now = new Date().toISOString();
  const settings = await repository.upsertUserSettings({
    userId,
    personalization,
    createdAt: existingSettings?.createdAt ?? now,
    updatedAt: now
  });

  return { success: true, settings: toUserSettings(settings) };
}

export function normalizePersonalization(value: string): string {
  return value.trim();
}

function createDefaultUserSettings(): UserSettings {
  return {
    personalization: "",
    createdAt: null,
    updatedAt: null
  };
}

function toUserSettings(settings: UserSettingsRow): UserSettings {
  return {
    personalization: settings.personalization,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt
  };
}
