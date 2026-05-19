import { eq } from "drizzle-orm";

import { appSettings, defineRepository } from "@/server/db";

export type AppSettingRow = {
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
};

export const getAppSettingsRepository = defineRepository(({ db }) => {
  const database = db as any;

  return {
    async getSetting(key: string): Promise<AppSettingRow | null> {
      const [setting] = await database.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
      return setting ?? null;
    },

    async upsertSetting(setting: AppSettingRow): Promise<AppSettingRow> {
      const [existingSetting] = await database
        .select({ key: appSettings.key })
        .from(appSettings)
        .where(eq(appSettings.key, setting.key))
        .limit(1);

      if (existingSetting) {
        await database
          .update(appSettings)
          .set({
            value: setting.value,
            updatedAt: setting.updatedAt
          })
          .where(eq(appSettings.key, setting.key));
      } else {
        await database.insert(appSettings).values(setting);
      }

      return setting;
    }
  };
});
