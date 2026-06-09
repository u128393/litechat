export type UserRole = "user" | "admin";

export type CurrentUser = {
  sessionId: string;
  userId: string;
  email: string;
  role: UserRole;
  expiresAt: string;
};

export type AppSettings = {
  titleGenerationModelConfigId: string | null;
};

export type ProviderConfig = {
  id: string;
  name: string;
  providerType: "openai-responses";
  baseUrl: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ModelConfig = {
  id: string;
  providerConfigId: string;
  modelId: string;
  displayName: string;
  visible: boolean;
  supportsWebSearch: boolean;
  supportsImageGeneration: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type UserSelectableModel = {
  id: string;
  modelId: string;
  displayName: string;
  supportsWebSearch: boolean;
  supportsImageGeneration: boolean;
};

export type FileUploadCapabilities = {
  enabled: boolean;
  maxFileSizeBytes: number | null;
};

export type ChatMessageAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
};

export type CreateUploadIntentResponse = {
  file: ChatMessageAttachment;
  upload: {
    method: string;
    url: string;
    headers: Record<string, string>;
  };
};

export type ManagedUser = {
  id: string;
  email: string;
  role: UserRole;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};
