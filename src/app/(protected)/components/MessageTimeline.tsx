"use client";

import { useState } from "react";

import { useChatWorkspace } from "@/app/(protected)/ChatWorkspaceProvider";
import { useI18n } from "@/lib/i18n/provider";
import { Copy, Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function MessageTimeline() {
  const { messages: i18nMessages } = useI18n();
  const {
    activeConversationId,
    messages: conversationMessages,
    isLoadingWorkspace,
    isSendingMessage,
    retryMessage,
  } = useChatWorkspace();

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
    <div className="flex flex-1 flex-col overflow-y-auto py-4">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-3 md:gap-6 md:px-4">
        {conversationMessages.map((message, index) => {
          const isStreaming = isSendingMessage && message.role === "assistant" && index === conversationMessages.length - 1 && message.content === "";
          const isLastAssistantStreaming = isSendingMessage && message.role === "assistant" && index === conversationMessages.length - 1 && message.content !== "";

          if (message.role === "user") {
            return (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[80%] rounded-xl bg-[var(--lc-user-bubble)] px-[14px] py-[10px] md:px-4 md:py-3">
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
                <div className="flex items-center gap-2 text-[13px] text-[var(--lc-text-secondary)]">
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 animate-pulse rounded-full bg-[var(--lc-text-secondary)]" />
                    <span className="size-1.5 animate-pulse rounded-full bg-[var(--lc-text-secondary)] [animation-delay:120ms]" />
                    <span className="size-1.5 animate-pulse rounded-full bg-[var(--lc-text-secondary)] [animation-delay:240ms]" />
                  </span>
                  {i18nMessages.home.streamingLabel}
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-[15px] leading-[1.6] text-[var(--lc-text-primary)]">
                    {message.content}
                    {isLastAssistantStreaming && (
                      <span className="inline-block animate-pulse text-[var(--lc-text-primary)]">{"\u258A"}</span>
                    )}
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
