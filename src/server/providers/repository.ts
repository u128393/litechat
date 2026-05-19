import { asc, eq } from "drizzle-orm";

import { defineRepository } from "@/server/db";
import { providerConfigs, type ProviderType } from "@/server/db/schema";

export type ProviderConfigRow = {
  id: string;
  name: string;
  providerType: ProviderType;
  baseUrl: string | null;
  apiKeyEncrypted: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateProviderConfigRow = ProviderConfigRow;

export type UpdateProviderConfigRow = Partial<Pick<
  ProviderConfigRow,
  "name" | "providerType" | "baseUrl" | "apiKeyEncrypted" | "enabled" | "updatedAt"
>>;

export const getProviderConfigRepository = defineRepository(({ db }) => {
  const database = db as any;

  return {
    async createProviderConfig(providerConfig: CreateProviderConfigRow): Promise<void> {
      await database.insert(providerConfigs).values(providerConfig);
    },

    async listProviderConfigs(): Promise<ProviderConfigRow[]> {
      return database.select().from(providerConfigs).orderBy(asc(providerConfigs.createdAt));
    },

    async listEnabledProviderConfigs(): Promise<ProviderConfigRow[]> {
      return database
        .select()
        .from(providerConfigs)
        .where(eq(providerConfigs.enabled, true))
        .orderBy(asc(providerConfigs.createdAt));
    },

    async getProviderConfigById(providerConfigId: string): Promise<ProviderConfigRow | null> {
      const [providerConfig] = await database
        .select()
        .from(providerConfigs)
        .where(eq(providerConfigs.id, providerConfigId))
        .limit(1);

      return providerConfig ?? null;
    },

    async updateProviderConfig(providerConfigId: string, updates: UpdateProviderConfigRow): Promise<boolean> {
      const existingProviderConfig = await this.getProviderConfigById(providerConfigId);

      if (!existingProviderConfig) {
        return false;
      }

      await database.update(providerConfigs).set(updates).where(eq(providerConfigs.id, providerConfigId));

      return true;
    },

    async deleteProviderConfig(providerConfigId: string): Promise<boolean> {
      const existingProviderConfig = await this.getProviderConfigById(providerConfigId);

      if (!existingProviderConfig) {
        return false;
      }

      await database.delete(providerConfigs).where(eq(providerConfigs.id, providerConfigId));

      return true;
    }
  };
});
