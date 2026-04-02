import { randomUUID } from "node:crypto";

import type { DatabaseConnection } from "@/server/db";

import { getModelConfigRepository, type ModelConfigRow } from "@/server/model-configs/repository";
import { getProviderConfigRepository } from "@/server/providers/repository";

export type ModelConfig = {
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

export type UserSelectableModel = {
  id: string;
  modelId: string;
  displayName: string;
  supportsWebSearch: boolean;
};

export type CreateModelConfigInput = {
  providerConfigId: string;
  modelId: string;
  displayName: string;
  enabled?: boolean;
  supportsWebSearch?: boolean;
  sortOrder?: number;
};

export type UpdateModelConfigInput = {
  providerConfigId?: string;
  modelId?: string;
  displayName?: string;
  enabled?: boolean;
  supportsWebSearch?: boolean;
  sortOrder?: number;
};

type WriteResult =
  | { success: true; modelConfig: ModelConfig }
  | { success: false; error: "provider_config_not_found" };

type UpdateResult = WriteResult | { success: false; error: "model_config_not_found" };

export async function listModelConfigs(database?: DatabaseConnection): Promise<ModelConfig[]> {
  const repository = getModelConfigRepository(database);
  const modelConfigRows = await repository.listModelConfigs();

  return modelConfigRows.map(toModelConfig);
}

export async function listUserSelectableModels(database?: DatabaseConnection): Promise<UserSelectableModel[]> {
  const repository = getModelConfigRepository(database);
  const modelConfigRows = await repository.listUserSelectableModelConfigs();

  return modelConfigRows.map((modelConfig) => ({
    id: modelConfig.id,
    modelId: modelConfig.modelId,
    displayName: modelConfig.displayName,
    supportsWebSearch: modelConfig.supportsWebSearch
  }));
}

export async function createModelConfig(
  input: CreateModelConfigInput,
  database?: DatabaseConnection
): Promise<WriteResult> {
  const providerRepository = getProviderConfigRepository(database);
  const providerConfig = await providerRepository.getProviderConfigById(input.providerConfigId);

  if (!providerConfig) {
    return { success: false, error: "provider_config_not_found" };
  }

  const now = new Date().toISOString();
  const modelConfig: ModelConfigRow = {
    id: randomUUID(),
    providerConfigId: input.providerConfigId,
    modelId: input.modelId,
    displayName: input.displayName,
    enabled: input.enabled ?? true,
    supportsWebSearch: input.supportsWebSearch ?? false,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now
  };
  const repository = getModelConfigRepository(database);

  await repository.createModelConfig(modelConfig);

  return {
    success: true,
    modelConfig: toModelConfig(modelConfig)
  };
}

export async function updateModelConfig(
  modelConfigId: string,
  input: UpdateModelConfigInput,
  database?: DatabaseConnection
): Promise<UpdateResult> {
  const repository = getModelConfigRepository(database);

  if (input.providerConfigId !== undefined) {
    const providerRepository = getProviderConfigRepository(database);
    const providerConfig = await providerRepository.getProviderConfigById(input.providerConfigId);

    if (!providerConfig) {
      return { success: false, error: "provider_config_not_found" };
    }
  }

  const updates: Parameters<typeof repository.updateModelConfig>[1] = {
    updatedAt: new Date().toISOString()
  };

  if (input.providerConfigId !== undefined) {
    updates.providerConfigId = input.providerConfigId;
  }

  if (input.modelId !== undefined) {
    updates.modelId = input.modelId;
  }

  if (input.displayName !== undefined) {
    updates.displayName = input.displayName;
  }

  if (input.enabled !== undefined) {
    updates.enabled = input.enabled;
  }

  if (input.supportsWebSearch !== undefined) {
    updates.supportsWebSearch = input.supportsWebSearch;
  }

  if (input.sortOrder !== undefined) {
    updates.sortOrder = input.sortOrder;
  }

  const updated = await repository.updateModelConfig(modelConfigId, updates);

  if (!updated) {
    return { success: false, error: "model_config_not_found" };
  }

  const modelConfig = await repository.getModelConfigById(modelConfigId);

  if (!modelConfig) {
    return { success: false, error: "model_config_not_found" };
  }

  return {
    success: true,
    modelConfig: toModelConfig(modelConfig)
  };
}

function toModelConfig(modelConfig: ModelConfigRow): ModelConfig {
  return {
    id: modelConfig.id,
    providerConfigId: modelConfig.providerConfigId,
    modelId: modelConfig.modelId,
    displayName: modelConfig.displayName,
    enabled: modelConfig.enabled,
    supportsWebSearch: modelConfig.supportsWebSearch,
    sortOrder: modelConfig.sortOrder,
    createdAt: modelConfig.createdAt,
    updatedAt: modelConfig.updatedAt
  };
}
