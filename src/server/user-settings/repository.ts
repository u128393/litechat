import { eq } from "drizzle-orm";

import { defineRepository } from "@/server/db";
import { userSettings } from "@/server/db/schema";

export type UserSettingsRow = {
  userId: string;
  customInstructions: string;
  createdAt: string;
  updatedAt: string;
};

export const getUserSettingsRepository = defineRepository(({ db }) => {
  const database = db as any;

  return {
    async getUserSettings(userId: string): Promise<UserSettingsRow | null> {
      const [settings] = await database.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
      return settings ?? null;
    },

    async upsertUserSettings(settings: UserSettingsRow): Promise<UserSettingsRow> {
      const [existingSettings] = await database
        .select({ userId: userSettings.userId })
        .from(userSettings)
        .where(eq(userSettings.userId, settings.userId))
        .limit(1);

      if (existingSettings) {
        await database
          .update(userSettings)
          .set({
            customInstructions: settings.customInstructions,
            updatedAt: settings.updatedAt
          })
          .where(eq(userSettings.userId, settings.userId));
      } else {
        await database.insert(userSettings).values(settings);
      }

      return settings;
    }
  };
});
