import { and, asc, eq } from "drizzle-orm";

import { defineRepository } from "@/server/db";
import { modelConfigs, providerConfigs } from "@/server/db/schema";

export type ModelConfigRow = {
  id: string;
  providerConfigId: string;
  modelId: string;
  displayName: string;
  enabled: boolean;
  supportsWebSearch: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateModelConfigRow = ModelConfigRow;

export type UpdateModelConfigRow = Partial<Pick<
  ModelConfigRow,
  "providerConfigId" | "modelId" | "displayName" | "enabled" | "supportsWebSearch" | "sortOrder" | "updatedAt"
>>;

export const getModelConfigRepository = defineRepository(({ db, dialect }) => {
  const database = db as any;

  return {
    async createModelConfig(modelConfig: CreateModelConfigRow): Promise<void> {
      await database.insert(modelConfigs).values(modelConfig);
    },

    async listModelConfigs(): Promise<ModelConfigRow[]> {
      return database
        .select()
        .from(modelConfigs)
        .orderBy(asc(modelConfigs.sortOrder), asc(modelConfigs.createdAt));
    },

    async listUserSelectableModelConfigs(): Promise<ModelConfigRow[]> {
      const rows = await database
        .select({
          id: modelConfigs.id,
          providerConfigId: modelConfigs.providerConfigId,
          modelId: modelConfigs.modelId,
          displayName: modelConfigs.displayName,
          enabled: modelConfigs.enabled,
          supportsWebSearch: modelConfigs.supportsWebSearch,
          sortOrder: modelConfigs.sortOrder,
          createdAt: modelConfigs.createdAt,
          updatedAt: modelConfigs.updatedAt
        })
        .from(modelConfigs)
        .innerJoin(providerConfigs, eq(modelConfigs.providerConfigId, providerConfigs.id))
        .where(and(eq(modelConfigs.enabled, true), eq(providerConfigs.enabled, true)))
        .orderBy(asc(modelConfigs.sortOrder), asc(modelConfigs.displayName), asc(modelConfigs.createdAt));

      return rows;
    },

    async getModelConfigById(modelConfigId: string): Promise<ModelConfigRow | null> {
      const [modelConfig] = await database.select().from(modelConfigs).where(eq(modelConfigs.id, modelConfigId)).limit(1);

      return modelConfig ?? null;
    },

    async updateModelConfig(modelConfigId: string, updates: UpdateModelConfigRow): Promise<boolean> {
      const existingModelConfig = await this.getModelConfigById(modelConfigId);

      if (!existingModelConfig) {
        return false;
      }

      await database.update(modelConfigs).set(updates).where(eq(modelConfigs.id, modelConfigId));

      return true;
    },

    async deleteModelConfig(modelConfigId: string): Promise<boolean> {
      const existingModelConfig = await this.getModelConfigById(modelConfigId);

      if (!existingModelConfig) {
        return false;
      }

      await database.delete(modelConfigs).where(eq(modelConfigs.id, modelConfigId));

      return true;
    },

    async updateModelConfigOrders(modelConfigOrders: Array<{ id: string; sortOrder: number }>, updatedAt: string): Promise<void> {
      if (dialect === "sqlite") {
        database.transaction((tx: any) => {
          for (const modelConfigOrder of modelConfigOrders) {
            tx
              .update(modelConfigs)
              .set({ sortOrder: modelConfigOrder.sortOrder, updatedAt })
              .where(eq(modelConfigs.id, modelConfigOrder.id))
              .run();
          }
        });
        return;
      }

      await database.transaction(async (tx: any) => {
        for (const modelConfigOrder of modelConfigOrders) {
          await tx
            .update(modelConfigs)
            .set({ sortOrder: modelConfigOrder.sortOrder, updatedAt })
            .where(eq(modelConfigs.id, modelConfigOrder.id));
        }
      });
    }
  };
});
