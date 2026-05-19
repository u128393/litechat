import { randomUUID } from "node:crypto";

import type { DatabaseConnection } from "@/server/db";
import type { ProviderType } from "@/server/db/schema";

import { decryptProviderApiKey, encryptProviderApiKey } from "@/server/providers/crypto";
import { getProviderConfigRepository, type ProviderConfigRow } from "@/server/providers/repository";

const DEFAULT_PROVIDER_TYPE: ProviderType = "openai-responses";

export type ProviderConfig = {
  id: string;
  name: string;
  providerType: ProviderType;
  baseUrl: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProviderConfigWithSecret = ProviderConfig & {
  apiKey: string;
};

export type CreateProviderConfigInput = {
  name: string;
  providerType?: ProviderType;
  baseUrl?: string | null;
  apiKey: string;
  enabled?: boolean;
};

export type UpdateProviderConfigInput = {
  name?: string;
  providerType?: ProviderType;
  baseUrl?: string | null;
  apiKey?: string;
  enabled?: boolean;
};

export async function listProviderConfigs(database?: DatabaseConnection): Promise<ProviderConfig[]> {
  const repository = getProviderConfigRepository(database);
  const providerConfigRows = await repository.listProviderConfigs();

  return providerConfigRows.map(toProviderConfig);
}

export async function listEnabledProviderConfigs(database?: DatabaseConnection): Promise<ProviderConfig[]> {
  const repository = getProviderConfigRepository(database);
  const providerConfigRows = await repository.listEnabledProviderConfigs();

  return providerConfigRows.map(toProviderConfig);
}

export async function createProviderConfig(
  input: CreateProviderConfigInput,
  database?: DatabaseConnection
): Promise<ProviderConfig> {
  const repository = getProviderConfigRepository(database);
  const now = new Date().toISOString();
  const providerConfig: ProviderConfigRow = {
    id: randomUUID(),
    name: input.name,
    providerType: input.providerType ?? DEFAULT_PROVIDER_TYPE,
    baseUrl: input.baseUrl ?? null,
    apiKeyEncrypted: encryptProviderApiKey(input.apiKey),
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now
  };

  await repository.createProviderConfig(providerConfig);

  return toProviderConfig(providerConfig);
}

export async function updateProviderConfig(
  providerConfigId: string,
  input: UpdateProviderConfigInput,
  database?: DatabaseConnection
): Promise<ProviderConfig | null> {
  const repository = getProviderConfigRepository(database);
  const updates: Parameters<typeof repository.updateProviderConfig>[1] = {
    updatedAt: new Date().toISOString()
  };

  if (input.name !== undefined) {
    updates.name = input.name;
  }

  if (input.providerType !== undefined) {
    updates.providerType = input.providerType;
  }

  if (input.baseUrl !== undefined) {
    updates.baseUrl = input.baseUrl;
  }

  if (input.apiKey !== undefined) {
    updates.apiKeyEncrypted = encryptProviderApiKey(input.apiKey);
  }

  if (input.enabled !== undefined) {
    updates.enabled = input.enabled;
  }

  const updated = await repository.updateProviderConfig(providerConfigId, updates);

  if (!updated) {
    return null;
  }

  const providerConfig = await repository.getProviderConfigById(providerConfigId);

  return providerConfig ? toProviderConfig(providerConfig) : null;
}

export async function deleteProviderConfig(
  providerConfigId: string,
  database?: DatabaseConnection
): Promise<boolean> {
  const repository = getProviderConfigRepository(database);

  return repository.deleteProviderConfig(providerConfigId);
}

export async function getProviderConfigWithSecret(
  providerConfigId: string,
  database?: DatabaseConnection
): Promise<ProviderConfigWithSecret | null> {
  const repository = getProviderConfigRepository(database);
  const providerConfig = await repository.getProviderConfigById(providerConfigId);

  if (!providerConfig) {
    return null;
  }

  return {
    ...toProviderConfig(providerConfig),
    apiKey: decryptProviderApiKey(providerConfig.apiKeyEncrypted)
  };
}

function toProviderConfig(providerConfig: ProviderConfigRow): ProviderConfig {
  return {
    id: providerConfig.id,
    name: providerConfig.name,
    providerType: providerConfig.providerType,
    baseUrl: providerConfig.baseUrl,
    enabled: providerConfig.enabled,
    createdAt: providerConfig.createdAt,
    updatedAt: providerConfig.updatedAt
  };
}
