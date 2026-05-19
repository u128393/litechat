import {
  adminMessagesByLocale,
  type AdminMessages
} from "@/app/(protected)/admin/messages";
import { type AppLocale } from "@/lib/i18n/locales";

export type AppMessages = {
  common: {
    back: string;
    cancel: string;
    close: string;
    dismiss: string;
  };
  shell: {
    brand: string;
    description: string;
    newChat: string;
    searchChat: string;
    searchChatPlaceholder: string;
    searchResults: string;
    searching: string;
    searchNoResults: string;
    conversationsLabel: string;
    conversationsMeta: string;
    conversationsLoading: string;
    conversationsEmpty: string;
    conversationGroupToday: string;
    conversationGroupYesterday: string;
    conversationGroupPrevious7Days: string;
    conversationGroupOlder: string;
    menu: string;
    adminArea: string;
    adminManage: string;
    logout: string;
    mobileHint: string;
    workspaceMenu: string;
    open: string;
    close: string;
    cancel: string;
    collapseSidebar: string;
    expandSidebar: string;
    conversationActions: string;
    deleteConversation: string;
    deleteConversationTitle: string;
    deleteConversationBodyStart: string;
    deleteConversationBodyEnd: string;
    deleteConversationDescription: string;
    languageLabel: string;
    languageDescription: string;
    modelLabel: string;
    modelsLoading: string;
    modelsEmpty: string;
    languageStatus: string;
    passwordSettings: string;
    passwordManage: string;
    themeLight: string;
    themeDark: string;
    navigation: string;
    toggleSidebar: string;
    showKeyboardShortcuts: string;
    keyboardShortcutsTitle: string;
    keyboardShortcutsDescription: string;
  };
  login: {
    tagline: string;
    emailLabel: string;
    passwordLabel: string;
    invalidCredentials: string;
    passwordChanged: string;
    submit: string;
  };
  password: {
    badge: string;
    title: string;
    description: string;
    currentPasswordLabel: string;
    newPasswordLabel: string;
    confirmPasswordLabel: string;
    submit: string;
    saving: string;
    success: string;
    incorrectCurrentPassword: string;
    mismatch: string;
    required: string;
    minLength: string;
    unknownError: string;
    signInAgain: string;
    forgotPasswordOutOfScope: string;
    newPasswordPlaceholder: string;
    confirmPasswordPlaceholder: string;
  };
  chat: {
    title: string;
    description: string;
    timelineLabel: string;
    emptyState: string;
    heroTitle: string;
    heroDescription: string;
    heroTipModel: string;
    heroTipDrafts: string;
    heroTipRetry: string;
    userMessageLabel: string;
    assistantMessageLabel: string;
    streamingLabel: string;
    streamingStatus: string;
    composerLabel: string;
    composerPlaceholder: string;
    composerDescription: string;
    composerSending: string;
    composerError: string;
    composerNoModel: string;
    stop: string;
    retry: string;
    clearError: string;
    send: string;
    stopped: string;
    errorModelMissing: string;
    errorModelUnavailable: string;
    errorValidation: string;
    errorUpstream: string;
    errorInterrupted: string;
    errorUnknown: string;
    selectModel: string;
    composerKeyboardHint: string;
  };
  admin: AdminMessages;
};

export const messagesByLocale: Record<AppLocale, AppMessages> = {
  en: {
    common: {
      back: "Back",
      cancel: "Cancel",
      close: "Close",
      dismiss: "Dismiss"
    },
    shell: {
      brand: "LiteChat",
      description: "Shared app shell for chat and future admin tools.",
      newChat: "New chat",
      searchChat: "Search chats",
      searchChatPlaceholder: "Search chats...",
      searchResults: "Search results",
      searching: "Searching",
      searchNoResults: "No matching chats found.",
      conversationsLabel: "Conversations",
      conversationsMeta: "Local",
      conversationsLoading: "Loading local conversations...",
      conversationsEmpty: "No local conversations yet.",
      conversationGroupToday: "Today",
      conversationGroupYesterday: "Yesterday",
      conversationGroupPrevious7Days: "Previous 7 Days",
      conversationGroupOlder: "Older",
      menu: "Menu",
      adminArea: "Admin area",
      adminManage: "Manage",
      logout: "Log out",
      mobileHint: "Mobile navigation is collapsed into this drawer to preserve the chat workspace.",
      workspaceMenu: "Workspace menu",
      open: "Open",
      close: "Close",
      cancel: "Cancel",
      collapseSidebar: "Collapse sidebar",
      expandSidebar: "Expand sidebar",
      conversationActions: "Conversation actions",
      deleteConversation: "Delete",
      deleteConversationTitle: "Delete chat?",
      deleteConversationBodyStart: "This will delete ",
      deleteConversationBodyEnd: ".",
      deleteConversationDescription: "This action cannot be undone.",
      languageLabel: "Language",
      languageDescription: "Switch the authenticated workspace language instantly.",
      modelLabel: "Model",
      modelsLoading: "Loading models...",
      modelsEmpty: "No enabled models",
      languageStatus: "Language preference saved locally",
      passwordSettings: "Password",
      passwordManage: "Update",
      themeLight: "Light",
      themeDark: "Dark",
      navigation: "Navigation",
      toggleSidebar: "Toggle sidebar",
      showKeyboardShortcuts: "Show keyboard shortcuts",
      keyboardShortcutsTitle: "Keyboard shortcuts",
      keyboardShortcutsDescription: "Use shortcuts to move faster around your workspace.",
    },
    login: {
      tagline: "Your team's AI assistant",
      emailLabel: "Email",
      passwordLabel: "Password",
      invalidCredentials: "Invalid email or password.",
      passwordChanged: "Password updated. Sign in again with your new password.",
      submit: "Sign in",
    },
    password: {
      badge: "Account security",
      title: "Change your password",
      description: "Confirm your current password before setting a new one. Email-based forgot-password recovery is out of scope.",
      currentPasswordLabel: "Current password",
      newPasswordLabel: "New password",
      confirmPasswordLabel: "Confirm new password",
      submit: "Save new password",
      saving: "Saving...",
      success: "Password updated. Sign in again with your new password.",
      incorrectCurrentPassword: "Current password is incorrect.",
      mismatch: "New password confirmation does not match.",
      required: "Enter your current password and a new password.",
      minLength: "Use at least 8 characters for the new password.",
      unknownError: "Could not update the password. Try again.",
      signInAgain: "All active sessions are cleared after a password change.",
      forgotPasswordOutOfScope: "Forgot-password email recovery is not included in this app yet.",
      newPasswordPlaceholder: "Enter new password",
      confirmPasswordPlaceholder: "Confirm new password",
    },
    chat: {
      title: "New conversation",
      description: "Local conversations stay in this browser while responses stream from your selected model.",
      timelineLabel: "Timeline",
      emptyState: "Ready to chat",
      heroTitle: "Start a conversation with your shared workspace.",
      heroDescription: "Pick an enabled model, keep drafts locally, and continue from recoverable streaming replies.",
      heroTipModel: "Choose a model before sending your first message.",
      heroTipDrafts: "Drafts are saved locally for the active conversation.",
      heroTipRetry: "If a response fails, retry or stop without losing your place.",
      userMessageLabel: "You",
      assistantMessageLabel: "Assistant",
      streamingLabel: "Streaming",
      streamingStatus: "Assistant response in progress",
      composerLabel: "Message",
      composerPlaceholder: "Message LiteChat",
      composerDescription: "Drafts persist locally for the active conversation.",
      composerSending: "Streaming a response. You can stop at any time.",
      composerError: "The last response did not finish. Retry or clear the error to continue.",
      composerNoModel: "Select an enabled model to start chatting.",
      stop: "Stop",
      retry: "Retry",
      clearError: "Clear error",
      send: "Send",
      stopped: "Response stopped. You can retry from the latest user message.",
      errorModelMissing: "Select an enabled model before sending.",
      errorModelUnavailable: "The selected model is no longer available. Choose another model and try again.",
      errorValidation: "The request could not be sent. Check the message and try again.",
      errorUpstream: "The model provider could not complete the request. Retry in a moment.",
      errorInterrupted: "The response stream was interrupted before completion. Retry to continue.",
      errorUnknown: "Something went wrong while sending the message. Retry to continue.",
      selectModel: "Select Model",
      composerKeyboardHint: "Enter to send, Shift+Enter for new line"
    },
    admin: adminMessagesByLocale.en
  },
  "zh-CN": {
    common: {
      back: "返回",
      cancel: "取消",
      close: "关闭",
      dismiss: "关闭提示"
    },
    shell: {
      brand: "LiteChat",
      description: "面向聊天与后续管理工具的共享应用外壳。",
      newChat: "新聊天",
      searchChat: "搜索聊天",
      searchChatPlaceholder: "搜索聊天...",
      searchResults: "搜索结果",
      searching: "正在搜索",
      searchNoResults: "没有找到匹配的聊天。",
      conversationsLabel: "会话",
      conversationsMeta: "本地",
      conversationsLoading: "正在加载本地会话...",
      conversationsEmpty: "还没有本地会话。",
      conversationGroupToday: "今天",
      conversationGroupYesterday: "昨天",
      conversationGroupPrevious7Days: "过去 7 天",
      conversationGroupOlder: "更早",
      menu: "菜单",
      adminArea: "后台管理",
      adminManage: "管理",
      logout: "退出登录",
      mobileHint: "移动端导航收纳在此抽屉中，以保留聊天工作区。",
      workspaceMenu: "工作区菜单",
      open: "打开",
      close: "关闭",
      cancel: "取消",
      collapseSidebar: "收起侧边栏",
      expandSidebar: "展开侧边栏",
      conversationActions: "会话操作",
      deleteConversation: "删除",
      deleteConversationTitle: "删除聊天？",
      deleteConversationBodyStart: "这会删除",
      deleteConversationBodyEnd: "。",
      deleteConversationDescription: "此操作无法撤销。",
      languageLabel: "语言",
      languageDescription: "即时切换已登录工作区语言。",
      modelLabel: "模型",
      modelsLoading: "正在加载模型...",
      modelsEmpty: "没有已启用模型",
      languageStatus: "语言偏好已保存在本地",
      passwordSettings: "修改密码",
      passwordManage: "修改",
      themeLight: "浅色模式",
      themeDark: "深色模式",
      navigation: "导航",
      toggleSidebar: "切换侧边栏",
      showKeyboardShortcuts: "显示快捷键列表",
      keyboardShortcutsTitle: "快捷键",
      keyboardShortcutsDescription: "使用快捷键快速操作当前工作区。",
    },
    login: {
      tagline: "你的团队 AI 助手",
      emailLabel: "邮箱",
      passwordLabel: "密码",
      invalidCredentials: "邮箱或密码不正确。",
      passwordChanged: "密码已更新。请使用新密码重新登录。",
      submit: "登录",
    },
    password: {
      badge: "账户安全",
      title: "修改密码",
      description: "设置新密码前，请先确认当前密码。邮件找回密码不在当前范围内。",
      currentPasswordLabel: "当前密码",
      newPasswordLabel: "新密码",
      confirmPasswordLabel: "确认新密码",
      submit: "保存新密码",
      saving: "保存中...",
      success: "密码已更新。请使用新密码重新登录。",
      incorrectCurrentPassword: "当前密码不正确。",
      mismatch: "两次输入的新密码不一致。",
      required: "请输入当前密码和新密码。",
      minLength: "新密码至少需要 8 个字符。",
      unknownError: "密码更新失败，请重试。",
      signInAgain: "修改密码后会清除所有活跃会话。",
      forgotPasswordOutOfScope: "当前应用暂不提供忘记密码邮件找回。",
      newPasswordPlaceholder: "输入新密码",
      confirmPasswordPlaceholder: "确认新密码",
    },
    chat: {
      title: "新会话",
      description: "本地会话会保存在当前浏览器中，同时从所选模型接收流式回复。",
      timelineLabel: "时间线",
      emptyState: "准备开始聊天",
      heroTitle: "在共享工作区中开始一段对话。",
      heroDescription: "选择一个已启用模型，在本地保留草稿，并在可恢复的流式回复中继续交流。",
      heroTipModel: "发送第一条消息前先选择一个模型。",
      heroTipDrafts: "当前会话的草稿会保存在本地。",
      heroTipRetry: "如果回复失败，可以重试或停止，而不会丢失当前进度。",
      userMessageLabel: "你",
      assistantMessageLabel: "助手",
      streamingLabel: "生成中",
      streamingStatus: "助手正在生成回复",
      composerLabel: "消息",
      composerPlaceholder: "向 LiteChat 发送消息",
      composerDescription: "当前会话的草稿会保存在本地。",
      composerSending: "正在流式生成回复，你可以随时停止。",
      composerError: "上一条回复未完成。你可以重试或清除错误后继续。",
      composerNoModel: "请选择一个已启用模型后再开始聊天。",
      stop: "停止",
      retry: "重试",
      clearError: "清除错误",
      send: "发送",
      stopped: "回复已停止。你可以基于最新的用户消息重新生成。",
      errorModelMissing: "请先选择一个已启用模型后再发送。",
      errorModelUnavailable: "当前所选模型已不可用。请选择其他模型后重试。",
      errorValidation: "请求无法发送。请检查消息内容后重试。",
      errorUpstream: "模型提供商暂时无法完成请求，请稍后重试。",
      errorInterrupted: "回复流在完成前中断了。请重试继续。",
      errorUnknown: "发送消息时发生异常。请重试后继续。",
      selectModel: "选择模型",
      composerKeyboardHint: "按 Enter 发送，按 Shift+Enter 换行"
    },
    admin: adminMessagesByLocale["zh-CN"]
  }
};

export function getMessages(locale: AppLocale): AppMessages {
  return messagesByLocale[locale];
}
