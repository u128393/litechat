import type { AppLocale } from "@/lib/i18n/locales";

export type AdminMessages = {
  badge: string;
  title: string;
  description: string;
  navigationLabel: string;
  providersNav: string;
  modelsNav: string;
  unexpectedResponse: string;
  enabledStatus: string;
  disabledStatus: string;
  listEnabledStatus: string;
  listDisabledStatus: string;
  listSortOrderPrefix: string;
  defaultValue: string;
  webSearchShortLabel: string;
  providers: {
    badge: string;
    title: string;
    description: string;
    emptyTitle: string;
    emptyDescription: string;
    createAction: string;
    updateAction: string;
    creatingAction: string;
    updatingAction: string;
    createModeLabel: string;
    editModeLabel: string;
    selectionLabel: string;
    newAction: string;
    nameLabel: string;
    providerTypeLabel: string;
    baseUrlLabel: string;
    apiKeyLabel: string;
    apiKeyCreateHint: string;
    apiKeyUpdateHint: string;
    enabledLabel: string;
    successCreate: string;
    successUpdate: string;
    errorPrefix: string;
    defaultProviderType: string;
  };
  models: {
    badge: string;
    title: string;
    description: string;
    emptyTitle: string;
    emptyDescription: string;
    blockedTitle: string;
    blockedDescription: string;
    createAction: string;
    updateAction: string;
    creatingAction: string;
    updatingAction: string;
    createModeLabel: string;
    editModeLabel: string;
    selectionLabel: string;
    newAction: string;
    providerLabel: string;
    modelIdLabel: string;
    displayNameLabel: string;
    enabledLabel: string;
    supportsWebSearchLabel: string;
    sortOrderLabel: string;
    successCreate: string;
    successUpdate: string;
    errorPrefix: string;
  };
};

export const adminMessagesByLocale: Record<AppLocale, AdminMessages> = {
  en: {
    badge: "Admin only",
    title: "Admin management",
    description: "Configure providers and models for the shared chat workspace.",
    navigationLabel: "Management sections",
    providersNav: "Providers",
    modelsNav: "Models",
    unexpectedResponse: "Unexpected response.",
    enabledStatus: "Enabled",
    disabledStatus: "Disabled",
    listEnabledStatus: "enabled",
    listDisabledStatus: "disabled",
    listSortOrderPrefix: "sort",
    defaultValue: "Default",
    webSearchShortLabel: "Web",
    providers: {
      badge: "Providers",
      title: "Provider management",
      description: "Create and update API provider connections used by shared models.",
      emptyTitle: "No providers configured yet.",
      emptyDescription: "Create a provider before enabling shared models.",
      createAction: "Create provider",
      updateAction: "Save provider",
      creatingAction: "Creating...",
      updatingAction: "Saving...",
      createModeLabel: "New provider",
      editModeLabel: "Editing provider",
      selectionLabel: "Configured providers",
      newAction: "New provider",
      nameLabel: "Provider name",
      providerTypeLabel: "Provider type",
      baseUrlLabel: "Base URL",
      apiKeyLabel: "API key",
      apiKeyCreateHint: "Required for new providers.",
      apiKeyUpdateHint: "Leave blank to keep the current API key.",
      enabledLabel: "Enabled",
      successCreate: "Provider created.",
      successUpdate: "Provider updated.",
      errorPrefix: "Provider request failed:",
      defaultProviderType: "OpenAI Responses"
    },
    models: {
      badge: "Models",
      title: "Model management",
      description: "Create and update the selectable models backed by configured providers.",
      emptyTitle: "No models configured yet.",
      emptyDescription: "Create at least one enabled model to make it available in the app.",
      blockedTitle: "Create a provider first.",
      blockedDescription: "Models require an existing provider configuration.",
      createAction: "Create model",
      updateAction: "Save model",
      creatingAction: "Creating...",
      updatingAction: "Saving...",
      createModeLabel: "New model",
      editModeLabel: "Editing model",
      selectionLabel: "Configured models",
      newAction: "New model",
      providerLabel: "Provider",
      modelIdLabel: "Model ID",
      displayNameLabel: "Display name",
      enabledLabel: "Enabled",
      supportsWebSearchLabel: "Supports web search",
      sortOrderLabel: "Sort order",
      successCreate: "Model created.",
      successUpdate: "Model updated.",
      errorPrefix: "Model request failed:"
    }
  },
  "zh-CN": {
    badge: "仅管理员",
    title: "管理控制台",
    description: "为共享聊天工作区配置提供商与模型。",
    navigationLabel: "管理分区",
    providersNav: "提供商",
    modelsNav: "模型",
    unexpectedResponse: "响应异常。",
    enabledStatus: "已启用",
    disabledStatus: "已禁用",
    listEnabledStatus: "已启用",
    listDisabledStatus: "已禁用",
    listSortOrderPrefix: "排序",
    defaultValue: "默认",
    webSearchShortLabel: "联网",
    providers: {
      badge: "提供商",
      title: "提供商管理",
      description: "创建并更新共享模型使用的 API 提供商连接。",
      emptyTitle: "尚未配置提供商。",
      emptyDescription: "启用共享模型前，请先创建提供商。",
      createAction: "创建提供商",
      updateAction: "保存提供商",
      creatingAction: "创建中...",
      updatingAction: "保存中...",
      createModeLabel: "新建提供商",
      editModeLabel: "编辑提供商",
      selectionLabel: "已配置提供商",
      newAction: "新建提供商",
      nameLabel: "提供商名称",
      providerTypeLabel: "提供商类型",
      baseUrlLabel: "基础 URL",
      apiKeyLabel: "API 密钥",
      apiKeyCreateHint: "新建提供商时必填。",
      apiKeyUpdateHint: "留空可保留当前 API 密钥。",
      enabledLabel: "已启用",
      successCreate: "提供商已创建。",
      successUpdate: "提供商已更新。",
      errorPrefix: "提供商请求失败：",
      defaultProviderType: "OpenAI Responses"
    },
    models: {
      badge: "模型",
      title: "模型管理",
      description: "创建并更新由已配置提供商支持的可选模型。",
      emptyTitle: "尚未配置模型。",
      emptyDescription: "请至少创建一个启用中的模型，应用内才可选择。",
      blockedTitle: "请先创建提供商。",
      blockedDescription: "模型依赖现有提供商配置。",
      createAction: "创建模型",
      updateAction: "保存模型",
      creatingAction: "创建中...",
      updatingAction: "保存中...",
      createModeLabel: "新建模型",
      editModeLabel: "编辑模型",
      selectionLabel: "已配置模型",
      newAction: "新建模型",
      providerLabel: "提供商",
      modelIdLabel: "模型 ID",
      displayNameLabel: "显示名称",
      enabledLabel: "已启用",
      supportsWebSearchLabel: "支持网页搜索",
      sortOrderLabel: "排序值",
      successCreate: "模型已创建。",
      successUpdate: "模型已更新。",
      errorPrefix: "模型请求失败："
    }
  }
};
