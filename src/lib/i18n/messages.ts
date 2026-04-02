import {
  adminMessagesByLocale,
  type AdminMessages
} from "@/app/(protected)/admin/messages";
import { type AppLocale } from "@/lib/i18n/locales";

export type AppMessages = {
  shell: {
    brand: string;
    description: string;
    newChat: string;
    conversationsLabel: string;
    conversationsMeta: string;
    conversationsLoading: string;
    conversationsEmpty: string;
    menu: string;
    adminArea: string;
    adminManage: string;
    logout: string;
    mobileHint: string;
    workspaceMenu: string;
    open: string;
    close: string;
    languageLabel: string;
    languageDescription: string;
    modelLabel: string;
    modelsLoading: string;
    modelsEmpty: string;
    languageStatus: string;
  };
  home: {
    title: string;
    description: string;
    timelineLabel: string;
    loading: string;
    loadingHint: string;
    emptyState: string;
    noConversation: string;
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
  };
  admin: AdminMessages;
};

export const messagesByLocale: Record<AppLocale, AppMessages> = {
  en: {
    shell: {
      brand: "LiteChat",
      description: "Shared app shell for chat and future admin tools.",
      newChat: "New chat",
      conversationsLabel: "Conversations",
      conversationsMeta: "Local",
      conversationsLoading: "Loading local conversations...",
      conversationsEmpty: "No local conversations yet.",
      menu: "Menu",
      adminArea: "Admin area",
      adminManage: "Manage",
      logout: "Log out",
      mobileHint: "Mobile navigation is collapsed into this drawer to preserve the chat workspace.",
      workspaceMenu: "Workspace menu",
      open: "Open",
      close: "Close",
      languageLabel: "Language",
      languageDescription: "Switch the authenticated workspace language instantly.",
      modelLabel: "Model",
      modelsLoading: "Loading models...",
      modelsEmpty: "No enabled models",
      languageStatus: "Language preference saved locally",
    },
    home: {
      title: "New conversation",
      description: "Local conversations stay in this browser while responses stream from your selected model.",
      timelineLabel: "Timeline",
      loading: "Loading your workspace...",
      loadingHint: "Restoring local conversations, drafts, and model choices.",
      emptyState: "Ready to chat",
      noConversation: "No conversation selected",
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
      errorUnknown: "Something went wrong while sending the message. Retry to continue."
    },
    admin: adminMessagesByLocale.en
  },
  "zh-CN": {
    shell: {
      brand: "LiteChat",
      description: "面向聊天与后续管理工具的共享应用外壳。",
      newChat: "新建聊天",
      conversationsLabel: "会话",
      conversationsMeta: "本地",
      conversationsLoading: "正在加载本地会话...",
      conversationsEmpty: "还没有本地会话。",
      menu: "菜单",
      adminArea: "管理区域",
      adminManage: "管理",
      logout: "退出登录",
      mobileHint: "移动端导航收纳在此抽屉中，以保留聊天工作区。",
      workspaceMenu: "工作区菜单",
      open: "打开",
      close: "关闭",
      languageLabel: "语言",
      languageDescription: "即时切换已登录工作区语言。",
      modelLabel: "模型",
      modelsLoading: "正在加载模型...",
      modelsEmpty: "没有已启用模型",
      languageStatus: "语言偏好已保存在本地",
    },
    home: {
      title: "新会话",
      description: "本地会话会保存在当前浏览器中，同时从所选模型接收流式回复。",
      timelineLabel: "时间线",
      loading: "正在加载你的工作区...",
      loadingHint: "正在恢复本地会话、草稿和模型选择。",
      emptyState: "准备开始聊天",
      noConversation: "尚未选择会话",
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
      errorUnknown: "发送消息时发生异常。请重试后继续。"
    },
    admin: adminMessagesByLocale["zh-CN"]
  }
};

export function getMessages(locale: AppLocale): AppMessages {
  return messagesByLocale[locale];
}
