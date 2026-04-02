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
    emptyState: string;
    noConversation: string;
    heroTitle: string;
    heroDescription: string;
    userMessageLabel: string;
    assistantMessageLabel: string;
    composerLabel: string;
    composerPlaceholder: string;
    composerDescription: string;
    stop: string;
    send: string;
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
      description: "Local drafts and messages stay in this browser until streaming is connected.",
      timelineLabel: "Timeline",
      loading: "Loading local workspace...",
      emptyState: "Empty state",
      noConversation: "No conversation selected",
      heroTitle: "Start a local chat in the shared workspace.",
      heroDescription:
        "Choose an enabled model, save drafts locally, and send messages into a timeline that is ready to connect to streaming responses.",
      userMessageLabel: "You",
      assistantMessageLabel: "Assistant",
      composerLabel: "Message",
      composerPlaceholder: "Message LiteChat",
      composerDescription: "Drafts persist locally for the active conversation.",
      stop: "Stop",
      send: "Send"
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
      description: "在接入流式后端之前，本地草稿和消息会保存在当前浏览器中。",
      timelineLabel: "时间线",
      loading: "正在加载本地工作区...",
      emptyState: "空状态",
      noConversation: "尚未选择会话",
      heroTitle: "在共享工作区开始本地聊天。",
      heroDescription: "选择一个已启用模型，在本地保存草稿，并把消息发送到一个已为后续流式响应准备好的时间线中。",
      userMessageLabel: "你",
      assistantMessageLabel: "助手",
      composerLabel: "消息",
      composerPlaceholder: "向 LiteChat 发送消息",
      composerDescription: "当前会话的草稿会保存在本地。",
      stop: "停止",
      send: "发送"
    },
    admin: adminMessagesByLocale["zh-CN"]
  }
};

export function getMessages(locale: AppLocale): AppMessages {
  return messagesByLocale[locale];
}
