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

export type ManagedUser = {
  id: string;
  email: string;
  role: UserRole;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};
