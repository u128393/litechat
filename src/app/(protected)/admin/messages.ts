import type { AppLocale } from "@/lib/i18n/locales";

export type AdminMessages = {
  badge: string;
  title: string;
  description: string;
  navigationLabel: string;
  usersNav: string;
  modelConfigNav: string;
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
  actionsLabel: string;
  users: {
    newAction: string;
    createAction: string;
    creatingAction: string;
    saveAction: string;
    savingAction: string;
    deleteAction: string;
    deletingAction: string;
    enableAction: string;
    disableAction: string;
    resetPasswordAction: string;
    createModeLabel: string;
    searchPlaceholder: string;
    emailLabel: string;
    initialPasswordLabel: string;
    randomPasswordAction: string;
    newPasswordLabel: string;
    confirmPasswordLabel: string;
    roleLabel: string;
    statusLabel: string;
    createdAtLabel: string;
    actionsLabel: string;
    enabledLabel: string;
    userRole: string;
    adminRole: string;
    successCreate: string;
    successPassword: string;
    successDelete: string;
    passwordMismatch: string;
    deleteTitle: string;
    deleteDescription: string;
    emptySearch: string;
    errorPrefix: string;
  };
  providers: {
    badge: string;
    title: string;
    description: string;
    emptyTitle: string;
    emptyDescription: string;
    createAction: string;
    updateAction: string;
    editAction: string;
    deleteAction: string;
    creatingAction: string;
    updatingAction: string;
    deletingAction: string;
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
    successDelete: string;
    deleteTitle: string;
    deleteConfirmation: string;
    deleteAssociatedModelsDescription: string;
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
    editAction: string;
    deleteAction: string;
    creatingAction: string;
    updatingAction: string;
    deletingAction: string;
    createModeLabel: string;
    editModeLabel: string;
    selectionLabel: string;
    newAction: string;
    providerLabel: string;
    modelIdLabel: string;
    displayNameLabel: string;
    visibleLabel: string;
    supportsWebSearchLabel: string;
    dragHandleLabel: string;
    successCreate: string;
    successUpdate: string;
    successDelete: string;
    deleteTitle: string;
    deleteConfirmation: string;
    errorPrefix: string;
  };
  settings: {
    titleGenerationTitle: string;
    titleGenerationModelLabel: string;
    useChatModel: string;
    errorPrefix: string;
  };
};

export const adminMessagesByLocale: Record<AppLocale, AdminMessages> = {
  en: {
    badge: "Admin only",
    title: "Admin Console",
    description: "Configure providers and models for the shared chat workspace.",
    navigationLabel: "Management sections",
    usersNav: "Users",
    modelConfigNav: "Models",
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
    actionsLabel: "Actions",
    users: {
      newAction: "New user",
      createAction: "Create",
      creatingAction: "Creating...",
      saveAction: "Save",
      savingAction: "Saving...",
      deleteAction: "Delete",
      deletingAction: "Deleting...",
      enableAction: "Enable user",
      disableAction: "Disable user",
      resetPasswordAction: "Reset password",
      createModeLabel: "New user",
      searchPlaceholder: "Search email",
      emailLabel: "Email",
      initialPasswordLabel: "Initial password",
      randomPasswordAction: "Random",
      newPasswordLabel: "New password",
      confirmPasswordLabel: "Confirm new password",
      roleLabel: "Role",
      statusLabel: "Status",
      createdAtLabel: "Created",
      actionsLabel: "Actions",
      enabledLabel: "Enabled",
      userRole: "User",
      adminRole: "Admin",
      successCreate: "User created.",
      successPassword: "Password updated.",
      successDelete: "User deleted.",
      passwordMismatch: "Password confirmation does not match.",
      deleteTitle: "Delete user?",
      deleteDescription: "Deleted users can no longer sign in.",
      emptySearch: "No users found.",
      errorPrefix: "User request failed:"
    },
    providers: {
      badge: "Providers",
      title: "Provider management",
      description: "Create and update API provider connections used by shared models.",
      emptyTitle: "No providers configured yet.",
      emptyDescription: "Create a provider before enabling shared models.",
      createAction: "Create provider",
      updateAction: "Save provider",
      editAction: "Edit",
      deleteAction: "Delete",
      creatingAction: "Creating...",
      updatingAction: "Saving...",
      deletingAction: "Deleting...",
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
      successDelete: "Provider deleted.",
      deleteTitle: "Delete provider?",
      deleteConfirmation: "This will delete \"{provider}\".",
      deleteAssociatedModelsDescription:
        "{count} associated models will also be deleted.",
      errorPrefix: "Provider request failed:",
      defaultProviderType: "OpenAI Responses"
    },
    models: {
      badge: "Models",
      title: "Models",
      description: "Create and update the selectable models backed by configured providers.",
      emptyTitle: "No models configured yet.",
      emptyDescription: "Create at least one visible model to make it available in the app.",
      blockedTitle: "Create a provider first.",
      blockedDescription: "Models require an existing provider configuration.",
      createAction: "Create model",
      updateAction: "Save model",
      editAction: "Edit",
      deleteAction: "Delete",
      creatingAction: "Creating...",
      updatingAction: "Saving...",
      deletingAction: "Deleting...",
      createModeLabel: "New model",
      editModeLabel: "Editing model",
      selectionLabel: "Configured models",
      newAction: "New model",
      providerLabel: "Provider",
      modelIdLabel: "Model ID",
      displayNameLabel: "Display name",
      visibleLabel: "Visible",
      supportsWebSearchLabel: "Supports web search",
      dragHandleLabel: "Reorder model",
      successCreate: "Model created.",
      successUpdate: "Model updated.",
      successDelete: "Model deleted.",
      deleteTitle: "Delete model?",
      deleteConfirmation: "This will delete \"{modelName} ({provider})\".",
      errorPrefix: "Model request failed:"
    },
    settings: {
      titleGenerationTitle: "Title generation",
      titleGenerationModelLabel: "Model",
      useChatModel: "Follow chat",
      errorPrefix: "Settings request failed:"
    }
  },
  "zh-CN": {
    badge: "仅管理员",
    title: "管理",
    description: "为共享聊天工作区配置提供商与模型。",
    navigationLabel: "管理分区",
    usersNav: "用户管理",
    modelConfigNav: "模型管理",
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
    actionsLabel: "操作",
    users: {
      newAction: "新建用户",
      createAction: "创建",
      creatingAction: "创建中...",
      saveAction: "保存",
      savingAction: "保存中...",
      deleteAction: "删除",
      deletingAction: "删除中...",
      enableAction: "启用用户",
      disableAction: "禁用用户",
      resetPasswordAction: "重置密码",
      createModeLabel: "新建用户",
      searchPlaceholder: "搜索邮箱",
      emailLabel: "邮箱",
      initialPasswordLabel: "初始密码",
      randomPasswordAction: "随机",
      newPasswordLabel: "新密码",
      confirmPasswordLabel: "确认新密码",
      roleLabel: "角色",
      statusLabel: "状态",
      createdAtLabel: "创建时间",
      actionsLabel: "操作",
      enabledLabel: "已启用",
      userRole: "用户",
      adminRole: "管理员",
      successCreate: "用户已创建。",
      successPassword: "密码已更新。",
      successDelete: "用户已删除。",
      passwordMismatch: "两次输入的密码不一致。",
      deleteTitle: "删除用户？",
      deleteDescription: "删除后该用户将无法登录。",
      emptySearch: "没有找到用户。",
      errorPrefix: "用户请求失败："
    },
    providers: {
      badge: "提供商",
      title: "提供商管理",
      description: "创建并更新共享模型使用的 API 提供商连接。",
      emptyTitle: "尚未配置提供商。",
      emptyDescription: "启用共享模型前，请先创建提供商。",
      createAction: "创建提供商",
      updateAction: "保存提供商",
      editAction: "编辑",
      deleteAction: "删除",
      creatingAction: "创建中...",
      updatingAction: "保存中...",
      deletingAction: "删除中...",
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
      successDelete: "提供商已删除。",
      deleteTitle: "删除提供商？",
      deleteConfirmation: "这会删除“{provider}”。",
      deleteAssociatedModelsDescription: "关联的 {count} 个模型也会被删除。",
      errorPrefix: "提供商请求失败：",
      defaultProviderType: "OpenAI Responses"
    },
    models: {
      badge: "模型",
      title: "模型管理",
      description: "创建并更新由已配置提供商支持的可选模型。",
      emptyTitle: "尚未配置模型。",
      emptyDescription: "请至少创建一个可见模型，应用内才可选择。",
      blockedTitle: "请先创建提供商。",
      blockedDescription: "模型依赖现有提供商配置。",
      createAction: "创建模型",
      updateAction: "保存模型",
      editAction: "编辑",
      deleteAction: "删除",
      creatingAction: "创建中...",
      updatingAction: "保存中...",
      deletingAction: "删除中...",
      createModeLabel: "新建模型",
      editModeLabel: "编辑模型",
      selectionLabel: "已配置模型",
      newAction: "新建模型",
      providerLabel: "提供商",
      modelIdLabel: "模型 ID",
      displayNameLabel: "显示名称",
      visibleLabel: "可见",
      supportsWebSearchLabel: "支持网页搜索",
      dragHandleLabel: "调整模型顺序",
      successCreate: "模型已创建。",
      successUpdate: "模型已更新。",
      successDelete: "模型已删除。",
      deleteTitle: "删除模型？",
      deleteConfirmation: "这会删除“{modelName} ({provider})”。",
      errorPrefix: "模型请求失败："
    },
    settings: {
      titleGenerationTitle: "标题生成",
      titleGenerationModelLabel: "模型",
      useChatModel: "跟随会话",
      errorPrefix: "设置请求失败："
    }
  }
};
