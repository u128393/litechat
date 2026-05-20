"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MutableRefObject, type UIEvent } from "react";
import Link from "next/link";
import rehypeHighlight from "rehype-highlight";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useChatWorkspace } from "@/app/(protected)/ChatWorkspaceProvider";
import { useI18n } from "@/lib/i18n/provider";
import { Copy, Check, RefreshCw, Pencil, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessageRecord } from "@/lib/chat";

const bottomPinThreshold = 32;
const scrollDirectionTolerance = 1;
const hashTargetBottomPadding = 32;
const timelineBottomExtraPadding = 24;

export function MessageTimeline({ composerOverlayHeight = 0 }: { composerOverlayHeight?: number }) {
  const { messages: i18nMessages } = useI18n();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isPinnedToBottomRef = useRef(true);
  const previousScrollTopRef = useRef(0);
  const previousConversationIdRef = useRef<string | null>(null);
  const consumedHashRef = useRef<string | null>(null);
  const previousTimelineScrollRequestTokenRef = useRef<number | null>(null);
  const {
    activeConversationId,
    messages: conversationMessages,
    branchContext,
    isSendingMessage,
    timelineScrollRequestToken,
    regenerateMessage,
    editUserMessage,
    openConversationBranch,
  } = useChatWorkspace();
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const lastMessage = conversationMessages.at(-1);
  const scrollDependency = `${activeConversationId ?? ""}:${conversationMessages.length}:${lastMessage?.id ?? ""}:${lastMessage?.content.length ?? 0}`;

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const conversationChanged = previousConversationIdRef.current !== activeConversationId;

    previousConversationIdRef.current = activeConversationId;

    if (conversationChanged) {
      isPinnedToBottomRef.current = true;
      consumedHashRef.current = null;
    }

    if (scrollContainer && activeConversationId && window.location.hash && composerOverlayHeight === 0) {
      return;
    }

    if (scrollContainer && activeConversationId && scrollToHashMessage(scrollContainer, consumedHashRef, composerOverlayHeight)) {
      previousScrollTopRef.current = scrollContainer.scrollTop;
      return;
    }

    if (!scrollContainer || !isPinnedToBottomRef.current) {
      return;
    }

    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    previousScrollTopRef.current = scrollContainer.scrollTop;
  }, [activeConversationId, composerOverlayHeight, scrollDependency]);

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    if (!scrollContainer) {
      return;
    }

    if (previousTimelineScrollRequestTokenRef.current === null) {
      previousTimelineScrollRequestTokenRef.current = timelineScrollRequestToken;
      return;
    }

    if (previousTimelineScrollRequestTokenRef.current === timelineScrollRequestToken) {
      return;
    }

    previousTimelineScrollRequestTokenRef.current = timelineScrollRequestToken;

    isPinnedToBottomRef.current = true;
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    previousScrollTopRef.current = scrollContainer.scrollTop;
  }, [timelineScrollRequestToken]);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const scrollContainer = event.currentTarget;
    const distanceFromBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
    const scrollDelta = scrollContainer.scrollTop - previousScrollTopRef.current;

    previousScrollTopRef.current = scrollContainer.scrollTop;

    if (scrollDelta < -scrollDirectionTolerance) {
      isPinnedToBottomRef.current = false;
      return;
    }

    isPinnedToBottomRef.current = distanceFromBottom <= bottomPinThreshold;
  }

  if (conversationMessages.length === 0) {
    return (
      <div className="flex flex-col items-center">
        <h1 className="text-[24px] font-normal tracking-[-0.01em] text-[var(--lc-text-primary)]">
          {i18nMessages.chat.emptyState}
        </h1>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex min-w-0 flex-1 flex-col overflow-y-auto pt-4"
      style={{ paddingBottom: Math.max(128, composerOverlayHeight + timelineBottomExtraPadding) }}
      onScroll={handleScroll}
    >
      <div className="mx-auto flex min-w-0 w-full max-w-[768px] flex-col gap-6 px-4">
        {conversationMessages.map((message, index) => {
          const isStreaming = isSendingMessage && message.role === "assistant" && index === conversationMessages.length - 1 && message.content === "";
          const shouldShowBranchDivider = branchContext ? index === branchContext.prefixMessageCount - 1 : false;
          const isBranchPrefixMessage = branchContext ? index < branchContext.prefixMessageCount : false;
          const branchDividerSourceTitle = shouldShowBranchDivider ? branchContext?.sourceConversationTitle ?? null : null;
          const branchDividerHref = shouldShowBranchDivider && branchContext
            ? `/c/${branchContext.sourceConversationId}#${getMessageAnchorId(branchContext.sourceMessageId)}`
            : null;

          if (message.role === "user") {
            return (
              <div id={getMessageAnchorId(message.id)} key={message.id} className="flex min-w-0 w-full flex-col gap-6">
                <UserMessage
                  message={message}
                  isEditing={editingMessageId === message.id}
                  disabled={isSendingMessage || isBranchPrefixMessage}
                  onCopy={() => setEditingMessageId(null)}
                  onEdit={() => setEditingMessageId(message.id)}
                  onCancelEdit={() => setEditingMessageId(null)}
                  onSubmitEdit={async (nextContent) => {
                    setEditingMessageId(null);
                    await editUserMessage(message.id, nextContent);
                  }}
                />
                {branchDividerSourceTitle && branchDividerHref ? (
                  <BranchDivider href={branchDividerHref} sourceTitle={branchDividerSourceTitle} />
                ) : null}
              </div>
            );
          }

          return (
            <div id={getMessageAnchorId(message.id)} key={message.id} className="flex min-w-0 w-full flex-col gap-3">
              {isStreaming ? (
                <div
                  className="flex min-h-[1.6em] items-center"
                  aria-label={i18nMessages.chat.streamingStatus}
                  role="status"
                >
                  <span className="size-2.5 animate-pulse rounded-full bg-[var(--lc-text-primary)]" />
                </div>
              ) : (
                <>
                  <div className="lc-markdown min-w-0 text-[15px] leading-[1.6] text-[var(--lc-text-primary)]">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                  <div className="flex gap-1">
                    <CopyButton text={message.content} />
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-[6px] text-[var(--lc-text-tertiary)] transition-colors hover:bg-[var(--lc-bg-tertiary)]"
                      disabled={isSendingMessage || isBranchPrefixMessage}
                      onClick={() => {
                        void regenerateMessage(message.id);
                      }}
                    >
                      <RefreshCw className="size-4" />
                    </button>
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-[6px] text-[var(--lc-text-tertiary)] transition-colors hover:bg-[var(--lc-bg-tertiary)] hover:text-[var(--lc-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={isSendingMessage || isBranchPrefixMessage || !activeConversationId}
                      aria-label={i18nMessages.chat.branchMessage}
                      title={i18nMessages.chat.branchMessage}
                      onClick={() => {
                        void openConversationBranch(message.id);
                      }}
                    >
                      <GitBranch className="size-4" />
                    </button>
                  </div>
                </>
              )}
              {branchDividerSourceTitle && branchDividerHref ? (
                <BranchDivider href={branchDividerHref} sourceTitle={branchDividerSourceTitle} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BranchDivider({ href, sourceTitle }: { href: string; sourceTitle: string }) {
  const { messages } = useI18n();

  return (
    <div className="flex items-center gap-3 py-2 text-[12px] text-[var(--lc-text-tertiary)]">
      <span className="h-px flex-1 bg-[var(--lc-border)]" />
      <span className="max-w-[70%] truncate rounded-full bg-[var(--lc-bg-tertiary)] px-3 py-1">
        {messages.chat.branchDividerStart}
        <Link
          href={href}
          className="font-medium text-[var(--lc-text-secondary)] underline underline-offset-2 transition-colors hover:text-[var(--lc-text-primary)]"
        >
          {sourceTitle}
        </Link>
        {messages.chat.branchDividerEnd}
      </span>
      <span className="h-px flex-1 bg-[var(--lc-border)]" />
    </div>
  );
}

function getMessageAnchorId(messageId: string) {
  return `message-${messageId}`;
}

function scrollToHashMessage(
  scrollContainer: HTMLDivElement,
  consumedHashRef: MutableRefObject<string | null>,
  composerOverlayHeight: number
) {
  const hash = window.location.hash.slice(1);

  if (!hash || consumedHashRef.current === hash) {
    return false;
  }

  const target = scrollContainer.querySelector<HTMLElement>(`#${CSS.escape(hash)}`);

  if (!target) {
    return false;
  }

  consumedHashRef.current = hash;
  const visibleHeight = Math.max(scrollContainer.clientHeight - composerOverlayHeight, 1);
  const desiredScrollTop = target.offsetTop + target.offsetHeight - visibleHeight + hashTargetBottomPadding;
  const nextMessage = target.nextElementSibling instanceof HTMLElement ? target.nextElementSibling : null;
  const maxScrollTopBeforeNextMessage = nextMessage
    ? nextMessage.offsetTop - visibleHeight - 1
    : Number.POSITIVE_INFINITY;

  scrollContainer.scrollTop = Math.max(0, Math.min(desiredScrollTop, maxScrollTopBeforeNextMessage));
  return true;
}

function UserMessage({
  message,
  isEditing,
  disabled,
  onCopy,
  onEdit,
  onCancelEdit,
  onSubmitEdit
}: {
  message: ChatMessageRecord;
  isEditing: boolean;
  disabled: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (nextContent: string) => Promise<void>;
}) {
  const { messages } = useI18n();
  const [draft, setDraft] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraft(message.content);
    }
  }, [isEditing, message.content]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!isEditing || !textarea) {
      return;
    }

    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [isEditing]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [draft, isEditing]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitEdit();
    }

    if (event.key === "Escape") {
      onCancelEdit();
    }
  }

  async function submitEdit() {
    const nextContent = draft.trim();

    if (nextContent === "" || disabled) {
      return;
    }

    if (nextContent === message.content.trim()) {
      onCancelEdit();
      return;
    }

    await onSubmitEdit(nextContent);
  }

  if (isEditing) {
    return (
      <div className="flex justify-end">
        <div className="flex w-full flex-col gap-4 rounded-[22px] bg-[var(--lc-user-bubble)] px-5 py-4">
          <textarea
            ref={textareaRef}
            className="min-h-12 w-full resize-none border-0 bg-transparent text-[15px] leading-6 text-[var(--lc-text-primary)] outline-none"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            value={draft}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-full bg-black px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[#2A2A2A] dark:bg-black dark:text-white dark:hover:bg-[#1F1F1F]"
              onClick={onCancelEdit}
            >
              {messages.common.cancel}
            </button>
            <button
              type="button"
              className="rounded-full bg-white px-4 py-2 text-[14px] font-medium text-[#111111] transition-colors hover:bg-[#E8E8E8] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-[#111111] dark:hover:bg-[#E5E5E5]"
              disabled={draft.trim() === "" || disabled}
              onClick={() => {
                void submitEdit();
              }}
            >
              {messages.chat.send}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col items-end gap-1.5">
      <div className="rounded-xl bg-[var(--lc-user-bubble)] px-4 py-3">
        <p className="whitespace-pre-wrap text-[15px] text-[var(--lc-text-primary)]">
          {message.content}
        </p>
      </div>
      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <CopyButton text={message.content} onCopied={onCopy} label={messages.chat.copyMessage} />
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-[6px] text-[var(--lc-text-tertiary)] transition-colors hover:bg-[var(--lc-bg-tertiary)] hover:text-[var(--lc-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled}
          aria-label={messages.chat.editMessage}
          title={messages.chat.editMessage}
          onClick={onEdit}
        >
          <Pencil className="size-4" />
        </button>
      </div>
    </div>
  );
}

function CopyButton({ text, label, onCopied }: { text: string; label?: string; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={cn(
        "flex size-8 items-center justify-center rounded-[6px] text-[var(--lc-text-tertiary)] transition-colors hover:bg-[var(--lc-bg-tertiary)] hover:text-[var(--lc-text-primary)]"
      )}
      aria-label={label}
      title={label}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          onCopied?.();
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}
