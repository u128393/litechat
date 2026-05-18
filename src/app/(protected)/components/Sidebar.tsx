"use client";

import { useLayoutEffect, useRef, useState, type UIEvent } from "react";
import { usePathname } from "next/navigation";
import { MoreHorizontal, Search, Trash2 } from "lucide-react";

import { useChatWorkspace } from "@/app/(protected)/ChatWorkspaceProvider";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatConversationRecord } from "@/lib/chat/local-store";
import type { ButtonHTMLAttributes, ReactNode, SVGProps } from "react";

const sidebarSectionXClass = "px-1";
const sidebarMotionClass = "duration-200 ease-out";
const sidebarHeaderClass = "flex h-14 items-center px-1 py-3 transition-[gap] duration-200 ease-out";
const sidebarHeaderBrandClass =
  "min-w-0 truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--lc-text-primary)] transition-[opacity,width,padding] duration-200 ease-out";
const sidebarToggleButtonClass =
  "ml-auto flex size-10 shrink-0 items-center justify-center rounded-lg text-[var(--lc-text-secondary)] transition-colors hover:bg-[var(--lc-bg-tertiary)] hover:text-[var(--lc-text-primary)]";
const sidebarItemClass =
  "flex h-9 w-full items-center justify-start gap-2 overflow-hidden rounded-lg px-2.5 text-[13px] font-medium text-[var(--lc-text-primary)] transition-colors duration-200 ease-out hover:bg-[var(--lc-bg-tertiary)] disabled:opacity-60";
const sidebarItemLabelClass = "min-w-0 truncate transition-[opacity,max-width] duration-200 ease-out";
const sidebarListStatusClass = "px-2.5 py-2 text-[13px] text-[var(--lc-text-tertiary)]";
const sidebarListGroupLabelClass =
  "mb-1 px-2.5 pt-1 text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--lc-text-tertiary)]";
const sidebarConversationRowClass =
  "group relative flex h-9 w-full items-center overflow-hidden text-[13px] disabled:opacity-60";
const sidebarConversationBackgroundClass = "pointer-events-none absolute inset-x-0 inset-y-[0.5px] rounded-lg";
const sidebarConversationButtonClass =
  "relative z-10 flex h-full min-w-0 flex-1 items-center px-2.5 text-left transition-[padding] disabled:opacity-60";
const sidebarConversationMenuButtonClass =
  "relative z-10 flex h-9 w-0 shrink-0 items-center justify-center overflow-hidden rounded-lg text-[var(--lc-text-secondary)] opacity-0 hover:text-[var(--lc-text-primary)] focus-visible:w-9 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lc-accent)] group-hover:w-9 group-hover:opacity-100";
const sidebarScrollAreaClass =
  "[&_[data-slot=scroll-area-scrollbar]]:opacity-0 [&_[data-slot=scroll-area-scrollbar]]:transition-opacity [&_[data-slot=scroll-area-scrollbar]]:duration-300 [&_[data-slot=scroll-area-scrollbar]]:delay-300 [&_[data-slot=scroll-area-scrollbar]]:ease-out [&_[data-slot=scroll-area-scrollbar][data-scrolling]]:opacity-100 [&_[data-slot=scroll-area-scrollbar][data-scrolling]]:duration-150 [&_[data-slot=scroll-area-scrollbar][data-scrolling]]:delay-0 focus-within:[&_[data-slot=scroll-area-scrollbar]]:opacity-100 focus-within:[&_[data-slot=scroll-area-scrollbar]]:delay-0";

type SidebarProps = {
  className?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onSearchOpen?: () => void;
  onNavigate?: () => void;
};

export function Sidebar({ className, collapsed = false, onCollapsedChange, onSearchOpen, onNavigate }: SidebarProps) {
  const { messages } = useI18n();
  const pathname = usePathname();
  const {
    conversations,
    activeConversationId,
    hasLoadedConversations,
    activeConversationRevealRequest,
    hasOlderConversations,
    hasNewerConversations,
    isLoadingOlderConversations,
    isLoadingNewerConversations,
    sendingConversationIds,
    createNewConversation,
    selectConversation,
    deleteConversation,
    loadOlderConversations,
    loadNewerConversations,
  } = useChatWorkspace();
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const previousScrollHeightRef = useRef<number | null>(null);
  const loadOlderConversationsRef = useRef(loadOlderConversations);
  const loadNewerConversationsRef = useRef(loadNewerConversations);
  const consumedRevealTokenRef = useRef<number | null>(null);
  const isNewChatActive = pathname === "/";

  const grouped = groupConversationsByDate(conversations, {
    today: messages.shell.conversationGroupToday,
    yesterday: messages.shell.conversationGroupYesterday,
    previousSevenDays: messages.shell.conversationGroupPrevious7Days,
    older: messages.shell.conversationGroupOlder
  });

  loadOlderConversationsRef.current = loadOlderConversations;
  loadNewerConversationsRef.current = loadNewerConversations;

  useLayoutEffect(() => {
    const viewport = scrollViewportRef.current;
    const previousScrollHeight = previousScrollHeightRef.current;

    if (!viewport || previousScrollHeight === null || isLoadingNewerConversations) {
      return;
    }

    viewport.scrollTop += viewport.scrollHeight - previousScrollHeight;
    previousScrollHeightRef.current = null;
  }, [conversations.length, isLoadingNewerConversations]);

  useLayoutEffect(() => {
    const viewport = scrollViewportRef.current;
    const revealRequest = activeConversationRevealRequest;

    if (
      !viewport ||
      collapsed ||
      !hasLoadedConversations ||
      !revealRequest ||
      consumedRevealTokenRef.current === revealRequest.token
    ) {
      return;
    }

    const row = viewport.querySelector<HTMLElement>(
      `[data-conversation-id="${CSS.escape(revealRequest.conversationId)}"]`
    );

    if (!row) {
      return;
    }

    consumedRevealTokenRef.current = revealRequest.token;

    if (isElementFullyVisible(row, viewport)) {
      return;
    }

    row.scrollIntoView({ block: "center" });
  }, [
    activeConversationRevealRequest,
    collapsed,
    conversations.length,
    hasLoadedConversations
  ]);

  useLayoutEffect(() => {
    const viewport = scrollViewportRef.current;

    if (!viewport || collapsed || isLoadingOlderConversations || isLoadingNewerConversations) {
      return;
    }

    if (viewport.scrollHeight > viewport.clientHeight + 1) {
      return;
    }

    if (hasOlderConversations) {
      void loadOlderConversationsRef.current();
      return;
    }

    if (hasNewerConversations) {
      previousScrollHeightRef.current = viewport.scrollHeight;
      void loadNewerConversationsRef.current();
    }
  }, [
    collapsed,
    conversations.length,
    hasOlderConversations,
    hasNewerConversations,
    isLoadingOlderConversations,
    isLoadingNewerConversations
  ]);

  function handleHistoryScroll(event: UIEvent<HTMLDivElement>) {
    const viewport = event.currentTarget;
    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    if (viewport.scrollTop <= 48 && hasNewerConversations && !isLoadingNewerConversations) {
      previousScrollHeightRef.current = viewport.scrollHeight;
      void loadNewerConversations();
    }

    if (distanceFromBottom <= 96 && hasOlderConversations && !isLoadingOlderConversations) {
      void loadOlderConversations();
    }
  }

  return (
    <div className={cn("flex h-full flex-col overflow-hidden bg-[var(--lc-bg-secondary)]", className)}>
      <div className={cn(sidebarHeaderClass, collapsed ? "gap-0" : "gap-2")}>
        <div
          className={cn(
            sidebarHeaderBrandClass,
            collapsed ? "w-0 flex-none pl-0 opacity-0" : "flex-1 pl-2.5 opacity-100"
          )}
        >
          {messages.shell.brand}
        </div>
        {onCollapsedChange ? (
          <button
            type="button"
            className={sidebarToggleButtonClass}
            aria-label={collapsed ? messages.shell.expandSidebar : messages.shell.collapseSidebar}
            title={collapsed ? messages.shell.expandSidebar : messages.shell.collapseSidebar}
            onClick={() => onCollapsedChange(!collapsed)}
          >
            <SidebarToggleIcon className="size-5" />
          </button>
        ) : null}
      </div>

      <div className={cn("flex flex-col gap-2 pb-3", sidebarSectionXClass)}>
        <SidebarItem
          collapsed={collapsed}
          aria-current={isNewChatActive ? "page" : undefined}
          aria-label={messages.shell.newChat}
          title={collapsed ? messages.shell.newChat : undefined}
          className={isNewChatActive ? "bg-[var(--lc-bg-tertiary)]" : undefined}
          onClick={() => {
            onNavigate?.();
            void createNewConversation();
          }}
          icon={<NewChatIcon className="size-5 shrink-0" />}
          label={messages.shell.newChat}
        />
        <SidebarItem
          collapsed={collapsed}
          aria-label={messages.shell.searchChat}
          title={collapsed ? messages.shell.searchChat : undefined}
          onClick={onSearchOpen}
          icon={<Search className="size-5 shrink-0" />}
          label={messages.shell.searchChat}
        />
      </div>

      <ScrollArea
        viewportRef={scrollViewportRef}
        viewportProps={{ onScroll: handleHistoryScroll }}
        className={cn(
          "flex-1 min-h-0 transition-opacity",
          sidebarMotionClass,
          sidebarScrollAreaClass,
          collapsed ? "pointer-events-none opacity-0" : "opacity-100"
        )}
      >
        <div className={cn("flex flex-col gap-1 pt-2 pb-3", sidebarSectionXClass)}>
          {hasLoadedConversations && conversations.length === 0 ? (
            <div className={sidebarListStatusClass}>{messages.shell.conversationsEmpty}</div>
          ) : null}

          {grouped.map((group) => (
            <div key={group.label} className={cn("flex flex-col", group !== grouped[0] && "mt-1")}>
              <span className={sidebarListGroupLabelClass}>{group.label}</span>
              {group.items.map((conversation) => (
                <SidebarConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isActive={conversation.id === activeConversationId}
                  isGenerating={sendingConversationIds.includes(conversation.id)}
                  onSelect={selectConversation}
                  onDelete={deleteConversation}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

type SidebarConversationItemProps = {
  conversation: ChatConversationRecord;
  isActive: boolean;
  isGenerating: boolean;
  onSelect: (conversationId: string, options?: { source?: "sidebar" | "search" }) => Promise<void>;
  onDelete: (conversationId: string) => Promise<void>;
  onNavigate?: () => void;
};

function SidebarConversationItem({
  conversation,
  isActive,
  isGenerating,
  onSelect,
  onDelete,
  onNavigate,
}: SidebarConversationItemProps) {
  const { messages } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (isDeleting || isGenerating) {
      return;
    }

    setIsDeleting(true);

    try {
      await onDelete(conversation.id);
      setConfirmOpen(false);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <div
        data-conversation-id={conversation.id}
        className={cn(
          sidebarConversationRowClass,
          isActive
            ? "font-medium text-[var(--lc-text-primary)]"
            : "text-[var(--lc-text-primary)]"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            sidebarConversationBackgroundClass,
            isActive
              ? "bg-[var(--lc-bg-tertiary)]"
              : "bg-black/[0.035] opacity-0 group-hover:opacity-100 dark:bg-white/[0.055]"
          )}
        />

        <button
          type="button"
          className={sidebarConversationButtonClass}
          onClick={() => {
            onNavigate?.();
            void onSelect(conversation.id, { source: "sidebar" });
          }}
        >
          <span className="min-w-0 truncate">{conversation.title}</span>
          {isGenerating ? (
            <span className="ml-2 size-1.5 shrink-0 animate-pulse rounded-full bg-[var(--lc-accent)]" aria-hidden="true" />
          ) : null}
        </button>

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            className={cn(
              sidebarConversationMenuButtonClass,
              menuOpen && "w-9 opacity-100"
            )}
            disabled={isGenerating}
            aria-label={messages.shell.conversationActions}
            title={messages.shell.conversationActions}
          >
            <MoreHorizontal className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="bottom"
            sideOffset={4}
            className="w-[136px] rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] p-1 shadow-lg"
          >
            <DropdownMenuItem
              variant="destructive"
              className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-[14px] text-[var(--lc-danger)] focus:bg-[var(--lc-danger)]/10 focus:text-[var(--lc-danger)]"
              onClick={() => {
                setMenuOpen(false);
                setConfirmOpen(true);
              }}
            >
              <Trash2 className="size-4" />
              {messages.shell.deleteConversation}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DialogContent className="max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-[20px] border border-white/10 bg-[var(--lc-bg-primary)] p-0 shadow-2xl sm:max-w-[448px]" showCloseButton={false}>
        <DialogHeader className="gap-4 px-4 pt-4 pb-3 text-left">
          <DialogTitle className="text-[20px] font-medium leading-6 tracking-[-0.01em] text-[var(--lc-text-primary)]">
            {messages.shell.deleteConversationTitle}
          </DialogTitle>
          <DialogDescription className="space-y-1.5 text-[15px] leading-6 text-[var(--lc-text-secondary)]">
            <span className="block text-[var(--lc-text-primary)]">
              {messages.shell.deleteConversationBodyStart}
              <strong className="font-semibold">“{conversation.title}”</strong>
              {messages.shell.deleteConversationBodyEnd}
            </span>
            <span className="block">{messages.shell.deleteConversationDescription}</span>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mx-0 mb-0 gap-3 rounded-none border-t border-[var(--lc-border)] bg-transparent px-4 py-3 sm:justify-end">
          <DialogClose
            render={
              <Button
                variant="outline"
                className="h-11 rounded-xl border-[var(--lc-border)] px-6 text-[15px] font-semibold"
                disabled={isDeleting}
              />
            }
          >
            {messages.shell.cancel}
          </DialogClose>
          <Button
            type="button"
            className="h-11 rounded-xl bg-[var(--lc-danger)] px-6 text-[15px] font-semibold text-white hover:bg-[var(--lc-danger)]/90 focus-visible:border-[var(--lc-danger)]/40 focus-visible:ring-[var(--lc-danger)]/20"
            disabled={isDeleting || isGenerating}
            onClick={() => {
              void handleDelete();
            }}
          >
            {messages.shell.deleteConversation}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function isElementFullyVisible(element: HTMLElement, container: HTMLElement) {
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  return elementRect.top >= containerRect.top && elementRect.bottom <= containerRect.bottom;
}

type SidebarItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  collapsed: boolean;
  icon: ReactNode;
  label: string;
};

function SidebarItem({ collapsed, icon, label, className, type = "button", ...props }: SidebarItemProps) {
  return (
    <button type={type} className={cn(sidebarItemClass, className)} {...props}>
      {icon}
      <span className={cn(sidebarItemLabelClass, collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100")}>
        {label}
      </span>
    </button>
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

type ConversationGroupLabels = {
  today: string;
  yesterday: string;
  previousSevenDays: string;
  older: string;
};

function groupConversationsByDate(
  conversations: ChatConversationRecord[],
  labels: ConversationGroupLabels
): ConversationGroup[] {
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
    groups.push({ label: labels.today, items: todayItems });
  }
  if (yesterdayItems.length > 0) {
    groups.push({ label: labels.yesterday, items: yesterdayItems });
  }
  if (previousSevenDaysItems.length > 0) {
    groups.push({ label: labels.previousSevenDays, items: previousSevenDaysItems });
  }
  if (olderItems.length > 0) {
    groups.push({ label: labels.older, items: olderItems });
  }

  return groups;
}
