import type { DatabaseConnection } from "@/server/db";
import type { ProviderType } from "@/server/db/schema";
import { getModelConfigRepository } from "@/server/model-configs/repository";
import { getProviderConfigWithSecret } from "@/server/providers";

import { createOpenAIResponsesAdapter } from "@/server/chat/openai-responses-adapter";

export type ChatRequestMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type ChatAdapterTool = {
  type: "web_search";
};

export type ChatModelTarget = {
  modelConfigId: string;
  providerConfigId: string;
  providerType: ProviderType;
  modelId: string;
  baseUrl: string | null;
  apiKey: string;
  supportsWebSearch: boolean;
};

export type ChatAdapterCapabilities = {
  supportsStreaming: boolean;
  supportsWebSearch: boolean;
};

export type ChatResponseStreamEvent =
  | { type: "response.started"; responseId: string | null }
  | { type: "response.output_text.delta"; delta: string }
  | { type: "response.completed"; responseId: string | null; outputText: string };

export type CreateChatResponseRequest = {
  model: ChatModelTarget;
  messages: ChatRequestMessage[];
  tools?: ChatAdapterTool[];
  signal?: AbortSignal;
};

export type ChatProviderAdapter = {
  readonly providerType: ProviderType;
  validateModel(model: ChatModelTarget): void;
  getCapabilities(model: ChatModelTarget): ChatAdapterCapabilities;
  createResponseStream(request: CreateChatResponseRequest): Promise<ReadableStream<ChatResponseStreamEvent>>;
};

export type ChatAdapterErrorCode =
  | "invalid_request"
  | "model_config_not_found"
  | "model_not_available"
  | "provider_config_not_found"
  | "provider_not_available"
  | "unsupported_provider"
  | "upstream_request_failed"
  | "upstream_response_invalid"
  | "upstream_stream_failed";

export class ChatAdapterError extends Error {
  readonly code: ChatAdapterErrorCode;
  readonly cause: unknown;

  constructor(code: ChatAdapterErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "ChatAdapterError";
    this.code = code;
    this.cause = cause;
  }
}

const adaptersByProviderType: Record<ProviderType, ChatProviderAdapter> = {
  "openai-responses": createOpenAIResponsesAdapter()
};

export function getChatProviderAdapter(providerType: ProviderType): ChatProviderAdapter {
  const adapter = adaptersByProviderType[providerType];

  if (!adapter) {
    throw new ChatAdapterError("unsupported_provider", "The selected model provider is not supported.");
  }

  return adapter;
}

export function resolveAutomaticChatTools(model: ChatModelTarget, adapter: ChatProviderAdapter): ChatAdapterTool[] | undefined {
  const capabilities = adapter.getCapabilities(model);

  if (!capabilities.supportsWebSearch) {
    return undefined;
  }

  return [{ type: "web_search" }];
}

export async function resolveChatModelTarget(
  modelConfigId: string,
  database?: DatabaseConnection
): Promise<ChatModelTarget> {
  return resolveModelTarget(modelConfigId, { allowHidden: false }, database);
}

export async function resolveTitleGenerationModelTarget(
  modelConfigId: string,
  database?: DatabaseConnection
): Promise<ChatModelTarget> {
  return resolveModelTarget(modelConfigId, { allowHidden: true }, database);
}

async function resolveModelTarget(
  modelConfigId: string,
  options: { allowHidden: boolean },
  database?: DatabaseConnection
): Promise<ChatModelTarget> {
  const modelRepository = getModelConfigRepository(database);
  const modelConfig = await modelRepository.getModelConfigById(modelConfigId);

  if (!modelConfig) {
    throw new ChatAdapterError("model_config_not_found", "The selected model could not be found.");
  }

  if (!options.allowHidden && !modelConfig.visible) {
    throw new ChatAdapterError("model_not_available", "The selected model is not available.");
  }

  const providerConfig = await getProviderConfigWithSecret(modelConfig.providerConfigId, database);

  if (!providerConfig) {
    throw new ChatAdapterError("provider_config_not_found", "The selected model provider could not be found.");
  }

  if (!providerConfig.enabled) {
    throw new ChatAdapterError("provider_not_available", "The selected model provider is not available.");
  }

  return {
    modelConfigId: modelConfig.id,
    providerConfigId: providerConfig.id,
    providerType: providerConfig.providerType,
    modelId: modelConfig.modelId,
    baseUrl: providerConfig.baseUrl,
    apiKey: providerConfig.apiKey,
    supportsWebSearch: modelConfig.supportsWebSearch
  };
}

export function toChatAdapterError(error: unknown): ChatAdapterError {
  if (error instanceof ChatAdapterError) {
    return error;
  }

  return new ChatAdapterError("upstream_request_failed", "The model provider request failed.", error);
}
