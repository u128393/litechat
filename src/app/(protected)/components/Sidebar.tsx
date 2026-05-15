"use client";

import { useChatWorkspace } from "@/app/(protected)/ChatWorkspaceProvider";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatConversationRecord } from "@/lib/chat/local-store";
import type { SVGProps } from "react";

type SidebarProps = {
  className?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

export function Sidebar({ className, collapsed = false, onCollapsedChange }: SidebarProps) {
  const { messages } = useI18n();
  const {
    conversations,
    activeConversationId,
    isLoadingWorkspace,
    isSendingMessage,
    createNewConversation,
    selectConversation,
  } = useChatWorkspace();

  const grouped = groupConversationsByDate(conversations);

  return (
    <div className={cn("flex h-full flex-col overflow-hidden bg-[var(--lc-bg-secondary)]", className)}>
      <div className={cn("flex h-14 items-center px-1 py-3 transition-[gap] duration-200 ease-out", collapsed ? "gap-0" : "gap-2")}>
        <div
          className={cn(
            "min-w-0 truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--lc-text-primary)] transition-[opacity,width,padding] duration-200 ease-out",
            collapsed ? "w-0 flex-none pl-0 opacity-0" : "flex-1 pl-2.5 opacity-100"
          )}
        >
          {messages.shell.brand}
        </div>
        {onCollapsedChange ? (
          <button
            type="button"
            className="ml-auto flex size-10 shrink-0 items-center justify-center rounded-lg text-[var(--lc-text-secondary)] transition-colors hover:bg-[var(--lc-bg-tertiary)] hover:text-[var(--lc-text-primary)]"
            aria-label={collapsed ? messages.shell.expandSidebar : messages.shell.collapseSidebar}
            title={collapsed ? messages.shell.expandSidebar : messages.shell.collapseSidebar}
            onClick={() => onCollapsedChange(!collapsed)}
          >
            <SidebarToggleIcon className="size-5" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 px-1 pb-3">
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-start gap-2 overflow-hidden rounded-lg px-2.5 text-[13px] font-medium text-[var(--lc-text-primary)] transition-colors duration-200 ease-out hover:bg-[var(--lc-bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-60"
          )}
          disabled={isSendingMessage}
          aria-label={messages.shell.newChat}
          title={collapsed ? messages.shell.newChat : undefined}
          onClick={() => {
            void createNewConversation();
          }}
        >
          <NewChatIcon className="size-5 shrink-0" />
          <span
            className={cn(
              "min-w-0 truncate transition-[opacity,max-width] duration-200 ease-out",
              collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"
            )}
          >
            {messages.shell.newChat}
          </span>
        </button>
      </div>

      <ScrollArea
        className={cn(
          "flex-1 min-h-0 transition-opacity duration-150 ease-out",
          collapsed ? "pointer-events-none opacity-0" : "opacity-100"
        )}
      >
        <div className="flex flex-col gap-1 px-1 pt-2 pb-3">
          {isLoadingWorkspace ? (
            <div className="px-2.5 py-2 text-[13px] text-[var(--lc-text-tertiary)]">
              {messages.shell.conversationsLoading}
            </div>
          ) : null}

          {!isLoadingWorkspace && conversations.length === 0 ? (
            <div className="px-2.5 py-2 text-[13px] text-[var(--lc-text-tertiary)]">
              {messages.shell.conversationsEmpty}
            </div>
          ) : null}

          {grouped.map((group) => (
            <div key={group.label} className={cn("flex flex-col gap-1", group !== grouped[0] && "mt-3")}>
              <span className="px-2.5 pt-1 text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--lc-text-tertiary)]">
                {group.label}
              </span>
              {group.items.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={cn(
                    "flex h-9 w-full items-center rounded-lg px-2.5 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    conversation.id === activeConversationId
                      ? "bg-[var(--lc-bg-tertiary)] font-medium text-[var(--lc-text-primary)]"
                      : "text-[var(--lc-text-primary)] hover:bg-[var(--lc-bg-tertiary)]"
                  )}
                  disabled={isSendingMessage}
                  onClick={() => {
                    void selectConversation(conversation.id);
                  }}
                >
                  <span className="truncate">{conversation.title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function SidebarToggleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <rect x="2.75" y="3" width="14.5" height="14" rx="3.25" stroke="currentColor" strokeWidth="1.35" />
      <path d="M7.75 3.5v13" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

function NewChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        d="M8.62 2.7H7.76c-.94 0-1.69 0-2.3.05-.64.05-1.19.17-1.69.43a4.1 4.1 0 0 0-1.79 1.79c-.26.5-.38 1.05-.43 1.69-.05.61-.05 1.36-.05 2.3v2.62c0 .94 0 1.69.05 2.3.05.64.17 1.19.43 1.69a4.1 4.1 0 0 0 1.79 1.79c.5.26 1.05.38 1.69.43.61.05 1.36.05 2.3.05h2.62c.94 0 1.69 0 2.3-.05.64-.05 1.19-.17 1.69-.43a4.1 4.1 0 0 0 1.79-1.79c.26-.5.38-1.05.43-1.69.05-.61.05-1.36.05-2.3v-.82a.72.72 0 0 0-1.44 0v.79c0 .97 0 1.66-.04 2.19-.04.5-.12.83-.26 1.1a2.68 2.68 0 0 1-1.17 1.17c-.27.14-.6.22-1.1.26-.53.04-1.22.04-2.19.04H7.7c-.97 0-1.66 0-2.19-.04-.5-.04-.83-.12-1.1-.26a2.68 2.68 0 0 1-1.17-1.17c-.14-.27-.22-.6-.26-1.1-.04-.53-.04-1.22-.04-2.19V8.98c0-.97 0-1.66.04-2.19.04-.5.12-.83.26-1.1a2.68 2.68 0 0 1 1.17-1.17c.27-.14.6-.22 1.1-.26.53-.04 1.22-.04 2.19-.04h.92a.76.76 0 0 0 0-1.52Z"
        fill="currentColor"
      />
      <path
        d="M12.95 3.26a2.56 2.56 0 0 1 3.62 3.62l-4.85 4.85a4.15 4.15 0 0 1-2.02 1.12l-1.78.26a.79.79 0 0 1-.9-.9l.26-1.78A4.15 4.15 0 0 1 8.4 8.41l4.55-4.55Zm2.58 1.04a1.09 1.09 0 0 0-1.54 0L9.44 8.86a2.7 2.7 0 0 0-.73 1.32l-.16 1.13 1.13-.16A2.7 2.7 0 0 0 11 10.42l4.53-4.53a1.09 1.09 0 0 0 0-1.59Z"
        fill="currentColor"
      />
    </svg>
  );
}

type ConversationGroup = {
  label: string;
  items: ChatConversationRecord[];
};

function groupConversationsByDate(conversations: ChatConversationRecord[]): ConversationGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);

  const todayItems: ChatConversationRecord[] = [];
  const yesterdayItems: ChatConversationRecord[] = [];
  const previousSevenDaysItems: ChatConversationRecord[] = [];
  const olderItems: ChatConversationRecord[] = [];

  for (const conversation of conversations) {
    const date = new Date(conversation.updatedAt);
    if (date >= today) {
      todayItems.push(conversation);
    } else if (date >= yesterday) {
      yesterdayItems.push(conversation);
    } else if (date >= sevenDaysAgo) {
      previousSevenDaysItems.push(conversation);
    } else {
      olderItems.push(conversation);
    }
  }

  const groups: ConversationGroup[] = [];

  if (todayItems.length > 0) {
    groups.push({ label: "Today", items: todayItems });
  }
  if (yesterdayItems.length > 0) {
    groups.push({ label: "Yesterday", items: yesterdayItems });
  }
  if (previousSevenDaysItems.length > 0) {
    groups.push({ label: "Previous 7 Days", items: previousSevenDaysItems });
  }
  if (olderItems.length > 0) {
    groups.push({ label: "Older", items: olderItems });
  }

  return groups;
}
