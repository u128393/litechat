"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

import {
  type ChatSearchResult,
  useChatWorkspace,
} from "@/app/(protected)/ChatWorkspaceProvider";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ChatConversationRecord } from "@/lib/chat/local-store";

type ChatSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type SearchListItem =
  | {
      type: "new";
      id: "new";
    }
  | {
      type: "conversation";
      id: string;
      conversation: ChatConversationRecord;
      matchedText: string | null;
      matchedAt: string;
    };

const dialogPanelClass =
  "top-0 left-0 right-0 bottom-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-[var(--lc-bg-primary)] p-0 shadow-none sm:top-1/2 sm:left-1/2 sm:right-auto sm:bottom-auto sm:h-[440px] sm:max-h-[calc(100dvh-4rem)] sm:w-[min(680px,calc(100vw-1.5rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[20px] sm:border sm:border-[var(--lc-border)] sm:shadow-2xl sm:max-w-none";
const searchRowClass =
  "flex min-h-12 w-full items-center gap-3 rounded-[14px] px-3 text-left text-[var(--lc-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lc-accent)]";
const searchGroupLabelClass =
  "px-3 pb-1 pt-2 text-[12px] font-medium text-[var(--lc-text-secondary)]";
const selectedRowClass = "bg-[var(--lc-bg-tertiary)]";
const mutedRowClass = "hover:bg-[var(--lc-bg-tertiary)]";

export function ChatSearchDialog({ open, onOpenChange }: ChatSearchDialogProps) {
  const { messages } = useI18n();
  const {
    createNewConversation,
    selectConversation,
    listRecentConversations,
    searchConversations,
  } = useChatWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [query, setQuery] = useState("");
  const [recentConversations, setRecentConversations] = useState<ChatConversationRecord[]>([]);
  const [results, setResults] = useState<ChatSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchingDots, setSearchingDots] = useState(3);
  const trimmedQuery = query.trim();
  const isQuerying = trimmedQuery !== "";

  const defaultConversationItems = useMemo(
    () => recentConversations.map<SearchListItem>((conversation) => ({
      type: "conversation",
      id: conversation.id,
      conversation,
      matchedText: null,
      matchedAt: conversation.updatedAt,
    })),
    [recentConversations]
  );
  const searchItems = useMemo(
    () => results.map<SearchListItem>((result) => ({
      type: "conversation",
      id: result.conversation.id,
      conversation: result.conversation,
      matchedText: result.matchedText,
      matchedAt: result.matchedAt,
    })),
    [results]
  );
  const listItems = isQuerying
    ? searchItems
    : [{ type: "new", id: "new" } satisfies SearchListItem, ...defaultConversationItems];
  const groupedDefaultItems = useMemo(
    () => groupConversationItemsByDate(defaultConversationItems, {
      today: messages.shell.conversationGroupToday,
      yesterday: messages.shell.conversationGroupYesterday,
      previousSevenDays: messages.shell.conversationGroupPrevious7Days,
      older: messages.shell.conversationGroupOlder,
    }),
    [defaultConversationItems, messages.shell]
  );
  const activeItem = listItems[activeIndex];

  useEffect(() => {
    if (!open) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setQuery("");
      setRecentConversations([]);
      setResults([]);
      setIsSearching(false);
      setHasSearched(false);
      setActiveIndex(0);
      return;
    }

    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;

    listRecentConversations(30)
      .then((conversations) => {
        if (active) {
          setRecentConversations(conversations);
        }
      })
      .catch(() => {
        if (active) {
          setRecentConversations([]);
        }
      });

    return () => {
      active = false;
    };
  }, [listRecentConversations, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    abortControllerRef.current?.abort();
    setActiveIndex(0);

    if (!trimmedQuery) {
      setResults([]);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setResults([]);
    setIsSearching(true);
    setHasSearched(false);

    const timer = window.setTimeout(() => {
      void searchConversations({
        query: trimmedQuery,
        signal: abortController.signal,
        onResult: (result) => {
          if (abortController.signal.aborted) {
            return;
          }

          setResults((currentResults) => {
            if (currentResults.some((currentResult) => currentResult.conversation.id === result.conversation.id)) {
              return currentResults;
            }

            return [...currentResults, result];
          });
        },
      }).finally(() => {
        if (abortController.signal.aborted) {
          return;
        }

        setIsSearching(false);
        setHasSearched(true);
      });
    }, 120);

    return () => {
      window.clearTimeout(timer);
      abortController.abort();
    };
  }, [open, searchConversations, trimmedQuery]);

  useEffect(() => {
    if (!isSearching) {
      setSearchingDots(3);
      return;
    }

    const timer = window.setInterval(() => {
      setSearchingDots((currentDots) => (currentDots >= 3 ? 1 : currentDots + 1));
    }, 400);

    return () => window.clearInterval(timer);
  }, [isSearching]);

  useEffect(() => {
    if (activeIndex > Math.max(listItems.length - 1, 0)) {
      setActiveIndex(Math.max(listItems.length - 1, 0));
    }
  }, [activeIndex, listItems.length]);

  function closeDialog() {
    abortControllerRef.current?.abort();
    onOpenChange(false);
  }

  async function activateItem(item: SearchListItem | undefined) {
    if (!item) {
      return;
    }

    closeDialog();

    if (item.type === "new") {
      await createNewConversation();
      return;
    }

    await selectConversation(item.conversation.id, { source: "search" });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((currentIndex) => Math.min(currentIndex + 1, Math.max(listItems.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((currentIndex) => Math.max(currentIndex - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      void activateItem(activeItem);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogPanelClass} showCloseButton={false}>
        <DialogTitle className="sr-only">{messages.shell.searchChat}</DialogTitle>

        <div className="flex h-[64px] items-center border-b border-[var(--lc-border)] px-2">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={messages.shell.searchChatPlaceholder}
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-[16px] leading-none text-[var(--lc-text-primary)] outline-none placeholder:text-[var(--lc-text-tertiary)] sm:text-[18px]"
            aria-label={messages.shell.searchChat}
            aria-activedescendant={activeItem ? `chat-search-${activeItem.id}` : undefined}
            aria-controls="chat-search-results"
            role="combobox"
            aria-expanded="true"
            autoComplete="off"
          />
          <button
            type="button"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--lc-text-secondary)] transition-colors hover:bg-[var(--lc-bg-tertiary)] hover:text-[var(--lc-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lc-accent)]"
            aria-label={messages.common.close}
            onClick={closeDialog}
          >
            <X className="size-5" />
          </button>
        </div>

        <div
          id="chat-search-results"
          role="listbox"
          aria-label={messages.shell.searchResults}
          className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:h-[376px] sm:flex-none"
        >
          {!isQuerying ? (
            <div className="flex flex-col gap-1">
              <SearchItemRow
                item={{ type: "new", id: "new" }}
                selected={activeIndex === 0}
                onMouseEnter={() => setActiveIndex(0)}
                onClick={() => {
                  void activateItem({ type: "new", id: "new" });
                }}
              />
              {groupedDefaultItems.map((group) => (
                <div key={group.label} className="flex flex-col gap-1">
                  <div className={searchGroupLabelClass}>{group.label}</div>
                  {group.items.map(({ item, index }) => (
                    <SearchItemRow
                      key={item.id}
                      item={item}
                      selected={index === activeIndex}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => {
                        void activateItem(item);
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : null}

          {isQuerying ? (
            <div className="flex flex-col gap-1">
              {searchItems.map((item, index) => (
                <SearchItemRow
                  key={item.id}
                  item={item}
                  query={trimmedQuery}
                  selected={index === activeIndex}
                  resultMode
                  showDate={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    void activateItem(item);
                  }}
                />
              ))}

              {isSearching ? (
                <div className="px-3 py-4 text-[14px] text-[var(--lc-text-secondary)]">
                  {messages.shell.searching}
                  {".".repeat(searchingDots)}
                </div>
              ) : null}

              {!isSearching && hasSearched && searchItems.length === 0 ? (
                <div className="px-3 py-10 text-center text-[14px] text-[var(--lc-text-secondary)]">
                  {messages.shell.searchNoResults}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type SearchItemRowProps = {
  item: SearchListItem;
  query?: string;
  selected: boolean;
  resultMode?: boolean;
  showDate?: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
};

function SearchItemRow({ item, query, selected, resultMode = false, showDate = false, onMouseEnter, onClick }: SearchItemRowProps) {
  const { messages } = useI18n();
  const title = item.type === "new" ? messages.shell.newChat : item.conversation.title;
  const snippet = item.type === "conversation" && item.matchedText
    ? buildSnippet(item.matchedText, query ?? "")
    : null;

  return (
    <button
      id={`chat-search-${item.id}`}
      type="button"
      role="option"
      aria-selected={selected}
      className={cn(searchRowClass, resultMode && "min-h-16", selected ? selectedRowClass : mutedRowClass)}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      {item.type === "new" ? <NewChatIcon className="size-5 shrink-0" /> : <ChatIcon className="size-5 shrink-0" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium leading-5">{title}</span>
        {snippet ? (
          <span className="mt-1 block truncate text-[13px] leading-5 text-[var(--lc-text-secondary)]">
            {snippet}
          </span>
        ) : null}
      </span>
      {item.type === "conversation" ? (
        <span className="hidden shrink-0 text-[13px] text-[var(--lc-text-secondary)] sm:block">
          {showDate ? formatExactDate(item.conversation.updatedAt) : null}
        </span>
      ) : null}
    </button>
  );
}

function buildSnippet(text: string, query: string) {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  const normalizedQuery = query.toLocaleLowerCase().trim();

  if (!normalizedText) {
    return "";
  }

  const matchIndex = normalizedText.toLocaleLowerCase().indexOf(normalizedQuery);
  const start = Math.max(matchIndex - 36, 0);
  const end = Math.min((matchIndex >= 0 ? matchIndex : 0) + normalizedQuery.length + 96, normalizedText.length);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalizedText.length ? "..." : "";

  return `${prefix}${normalizedText.slice(start, end)}${suffix}`;
}

type GroupedSearchItems = {
  label: string;
  items: Array<{
    item: SearchListItem & { type: "conversation" };
    index: number;
  }>;
};

type ConversationGroupLabels = {
  today: string;
  yesterday: string;
  previousSevenDays: string;
  older: string;
};

function groupConversationItemsByDate(
  items: SearchListItem[],
  labels: ConversationGroupLabels
): GroupedSearchItems[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);

  const todayItems: GroupedSearchItems["items"] = [];
  const yesterdayItems: GroupedSearchItems["items"] = [];
  const previousSevenDaysItems: GroupedSearchItems["items"] = [];
  const olderItems: GroupedSearchItems["items"] = [];

  items.forEach((item, itemOffset) => {
    if (item.type !== "conversation") {
      return;
    }

    const date = new Date(item.conversation.updatedAt);
    const groupedItem = {
      item,
      index: itemOffset + 1,
    };

    if (date >= today) {
      todayItems.push(groupedItem);
    } else if (date >= yesterday) {
      yesterdayItems.push(groupedItem);
    } else if (date >= sevenDaysAgo) {
      previousSevenDaysItems.push(groupedItem);
    } else {
      olderItems.push(groupedItem);
    }
  });

  const groups: GroupedSearchItems[] = [];

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

function formatExactDate(dateText: string) {
  const date = new Date(dateText);
  const now = new Date();

  if (date.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(date);
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "2-digit",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function NewChatIcon(props: React.SVGProps<SVGSVGElement>) {
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

function ChatIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        d="M10 2.25c-4.72 0-8.5 3.1-8.5 6.98 0 2.14 1.14 4.05 2.95 5.33l-.43 2.22a.8.8 0 0 0 1.17.84l2.48-1.36c.73.16 1.51.24 2.33.24 4.72 0 8.5-3.1 8.5-6.98S14.72 2.25 10 2.25Zm0 1.45c3.94 0 7.05 2.54 7.05 5.53s-3.11 5.53-7.05 5.53c-.76 0-1.48-.08-2.14-.25a.76.76 0 0 0-.55.07l-1.55.85.28-1.43a.73.73 0 0 0-.32-.76C4.03 12.19 2.95 10.74 2.95 9.23 2.95 6.24 6.06 3.7 10 3.7Z"
        fill="currentColor"
      />
    </svg>
  );
}
