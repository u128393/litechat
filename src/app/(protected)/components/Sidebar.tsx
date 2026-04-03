"use client";

import { useChatWorkspace } from "@/app/(protected)/ChatWorkspaceProvider";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatConversationRecord } from "@/lib/chat/local-store";

type SidebarProps = {
  className?: string;
};

export function Sidebar({ className }: SidebarProps) {
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
    <div className={cn("flex h-full flex-col bg-[var(--lc-bg-secondary)]", className)}>
      {/* New Chat button */}
      <div className="flex flex-col gap-2 p-3">
        <button
          type="button"
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--lc-border)] text-[13px] font-medium text-[var(--lc-text-primary)] transition-colors hover:bg-[var(--lc-bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSendingMessage}
          onClick={() => {
            void createNewConversation();
          }}
        >
          <Plus className="size-4" />
          {messages.shell.newChat}
        </button>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-1 px-3 pb-3">
          {isLoadingWorkspace ? (
            <div className="px-3 py-2 text-[13px] text-[var(--lc-text-tertiary)]">
              {messages.shell.conversationsLoading}
            </div>
          ) : null}

          {!isLoadingWorkspace && conversations.length === 0 ? (
            <div className="px-3 py-2 text-[13px] text-[var(--lc-text-tertiary)]">
              {messages.shell.conversationsEmpty}
            </div>
          ) : null}

          {grouped.map((group) => (
            <div key={group.label} className={cn("flex flex-col gap-1", group !== grouped[0] && "mt-3")}>
              <span className="px-3 pt-1 text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--lc-text-tertiary)]">
                {group.label}
              </span>
              {group.items.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={cn(
                    "flex h-9 w-full items-center rounded-lg px-3 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-60",
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
