"use client";

import { useLayoutEffect, useRef, useState, type UIEvent } from "react";

import { useChatWorkspace } from "@/app/(protected)/ChatWorkspaceProvider";
import { useI18n } from "@/lib/i18n/provider";
import { Copy, Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function MessageTimeline() {
  const { messages: i18nMessages } = useI18n();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isPinnedToBottomRef = useRef(true);
  const previousConversationIdRef = useRef<string | null>(null);
  const {
    activeConversationId,
    messages: conversationMessages,
    isLoadingWorkspace,
    isSendingMessage,
    retryMessage,
  } = useChatWorkspace();
  const lastMessage = conversationMessages.at(-1);
  const scrollDependency = `${activeConversationId ?? ""}:${conversationMessages.length}:${lastMessage?.id ?? ""}:${lastMessage?.content.length ?? 0}`;

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const conversationChanged = previousConversationIdRef.current !== activeConversationId;

    previousConversationIdRef.current = activeConversationId;

    if (conversationChanged) {
      isPinnedToBottomRef.current = true;
    }

    if (!scrollContainer || !isPinnedToBottomRef.current) {
      return;
    }

    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }, [scrollDependency]);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const scrollContainer = event.currentTarget;
    const distanceFromBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;

    isPinnedToBottomRef.current = distanceFromBottom <= 32;
  }

  if (isLoadingWorkspace) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-[13px] text-[var(--lc-text-tertiary)]">
          {i18nMessages.home.loading}
        </div>
      </div>
    );
  }

  if (conversationMessages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-semibold text-[var(--lc-text-primary)]">
            LiteChat
          </h1>
          <p className="text-[15px] text-[var(--lc-text-secondary)]">
            {activeConversationId ? i18nMessages.home.emptyState : i18nMessages.home.noConversation}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex flex-1 flex-col overflow-y-auto py-4"
      onScroll={handleScroll}
    >
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
        {conversationMessages.map((message, index) => {
          const isStreaming = isSendingMessage && message.role === "assistant" && index === conversationMessages.length - 1 && message.content === "";

          if (message.role === "user") {
            return (
              <div key={message.id} className="flex justify-end">
                <div className="rounded-xl bg-[var(--lc-user-bubble)] px-4 py-3">
                  <p className="whitespace-pre-wrap text-[15px] text-[var(--lc-text-primary)]">
                    {message.content}
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div key={message.id} className="flex w-full flex-col gap-3">
              {isStreaming ? (
                <div
                  className="flex min-h-[1.6em] items-center"
                  aria-label={i18nMessages.home.streamingStatus}
                  role="status"
                >
                  <span className="size-2.5 animate-pulse rounded-full bg-[var(--lc-text-primary)]" />
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-[15px] leading-[1.6] text-[var(--lc-text-primary)]">
                    {message.content}
                  </p>
                  <div className="flex gap-1">
                    <CopyButton text={message.content} />
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-[6px] text-[var(--lc-text-tertiary)] transition-colors hover:bg-[var(--lc-bg-tertiary)]"
                      disabled={isSendingMessage}
                      onClick={() => {
                        void retryMessage();
                      }}
                    >
                      <RefreshCw className="size-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={cn(
        "flex size-8 items-center justify-center rounded-[6px] text-[var(--lc-text-tertiary)] transition-colors hover:bg-[var(--lc-bg-tertiary)]"
      )}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}
