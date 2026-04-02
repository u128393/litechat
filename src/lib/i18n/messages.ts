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
    modelStatus: string;
    languageStatus: string;
    conversationItems: { id: string; title: string; meta: string }[];
  };
  home: {
    title: string;
    description: string;
    timelineLabel: string;
    emptyState: string;
    heroTitle: string;
    heroDescription: string;
    timelineCardTitle: string;
    timelineCardDescription: string;
    localizationCardTitle: string;
    localizationCardDescription: string;
    adminCardTitle: string;
    adminCardDescription: string;
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
      conversationsMeta: "Local only",
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
      modelStatus: "Ready for local conversation state",
      languageStatus: "Language preference saved locally",
      conversationItems: [
        { id: "welcome", title: "Welcome to LiteChat", meta: "Shell placeholder" },
        { id: "ideas", title: "Prompt ideas", meta: "Local history soon" },
        { id: "notes", title: "Release notes draft", meta: "Recent conversations" }
      ]
    },
    home: {
      title: "New conversation",
      description: "Message history will appear here once local conversation storage is wired.",
      timelineLabel: "Timeline",
      emptyState: "Empty state",
      heroTitle: "Start a new chat in the shared workspace.",
      heroDescription:
        "This shell now includes the responsive sidebar, model header, timeline region, and composer frame shared by regular users and admins.",
      timelineCardTitle: "Chat timeline",
      timelineCardDescription: "Reserved for message history and streaming output.",
      localizationCardTitle: "Localization",
      localizationCardDescription: "The shell-level language switcher is now active and persists locally.",
      adminCardTitle: "Admin entry",
      adminCardDescription: "User menu reserves a lightweight management entry for admins.",
      composerLabel: "Message",
      composerPlaceholder: "Message LiteChat",
      composerDescription: "Multiline composer with reserved stop-generation control.",
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
      conversationsMeta: "仅本地",
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
      modelStatus: "已为本地会话状态预留",
      languageStatus: "语言偏好已保存在本地",
      conversationItems: [
        { id: "welcome", title: "欢迎使用 LiteChat", meta: "外壳占位内容" },
        { id: "ideas", title: "提示词灵感", meta: "本地历史即将支持" },
        { id: "notes", title: "发布说明草稿", meta: "最近会话" }
      ]
    },
    home: {
      title: "新会话",
      description: "接入本地会话存储后，消息历史会显示在这里。",
      timelineLabel: "时间线",
      emptyState: "空状态",
      heroTitle: "在共享工作区开始新的聊天。",
      heroDescription: "这个外壳现在已经包含响应式侧边栏、模型头部、时间线区域，以及供普通用户和管理员共用的输入框框架。",
      timelineCardTitle: "聊天时间线",
      timelineCardDescription: "预留给消息历史与流式输出。",
      localizationCardTitle: "本地化",
      localizationCardDescription: "外壳级语言切换器现已启用，并会在本地持久化。",
      adminCardTitle: "管理入口",
      adminCardDescription: "管理员可从用户菜单进入轻量管理入口。",
      composerLabel: "消息",
      composerPlaceholder: "向 LiteChat 发送消息",
      composerDescription: "支持多行输入，并预留停止生成控制。",
      stop: "停止",
      send: "发送"
    },
    admin: adminMessagesByLocale["zh-CN"]
  }
};

export function getMessages(locale: AppLocale): AppMessages {
  return messagesByLocale[locale];
}
