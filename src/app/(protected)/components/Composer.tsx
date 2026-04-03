"use client";

import { useRef, useEffect, type KeyboardEvent } from "react";

import { useChatWorkspace } from "@/app/(protected)/ChatWorkspaceProvider";
import { useI18n } from "@/lib/i18n/provider";
import { ArrowUp, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function Composer() {
  const { messages } = useI18n();
  const {
    draft,
    selectedModelId,
    isLoadingWorkspace,
    isSendingMessage,
    chatError,
    updateDraft,
    sendMessage,
    stopMessage,
    retryMessage,
    clearChatError,
  } = useChatWorkspace();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [draft]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  const canSend = draft.trim() !== "" && selectedModelId && !isSendingMessage && !isLoadingWorkspace;

  return (
    <div className="w-full px-0 pb-4 md:pb-6">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-2 px-3 md:px-4">
        {/* Error banner */}
        {chatError ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-[13px] text-[#991B1B] dark:border-[#7F1D1D] dark:bg-[#450A0A] dark:text-[#FCA5A5]">
            <CircleAlert className="size-4 shrink-0" />
            <span className="flex-1">{chatError.message}</span>
            {chatError.canRetry ? (
              <button
                type="button"
                className="shrink-0 rounded-md px-2 py-0.5 text-[13px] font-medium text-[#991B1B] transition-colors hover:bg-[#FEE2E2] dark:text-[#FCA5A5] dark:hover:bg-[#7F1D1D]"
                disabled={isSendingMessage}
                onClick={() => {
                  void retryMessage();
                }}
              >
                {messages.home.retry}
              </button>
            ) : (
              <button
                type="button"
                className="shrink-0 rounded-md px-2 py-0.5 text-[13px] font-medium text-[#991B1B] transition-colors hover:bg-[#FEE2E2] dark:text-[#FCA5A5] dark:hover:bg-[#7F1D1D]"
                onClick={clearChatError}
              >
                {messages.home.clearError}
              </button>
            )}
          </div>
        ) : null}

        {/* Textarea box */}
        <div className="flex items-end gap-2 rounded-[20px] border border-[var(--lc-border)] bg-[var(--lc-bg-tertiary)] px-[14px] py-[10px] md:border-0 md:px-4 md:py-3">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder={messages.home.composerPlaceholder}
            className="flex-1 resize-none border-0 bg-transparent text-[15px] text-[var(--lc-text-primary)] outline-none placeholder:text-[var(--lc-text-tertiary)]"
            disabled={isLoadingWorkspace}
            onChange={(event) => {
              void updateDraft(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            value={draft}
          />

          {isSendingMessage ? (
            <button
              type="button"
              className="flex size-[34px] md:size-9 shrink-0 items-center justify-center rounded-full bg-[var(--lc-text-primary)] text-white transition-colors"
              onClick={stopMessage}
            >
              <div className="size-3 rounded-[2px] bg-white" />
            </button>
          ) : (
            <button
              type="button"
              className={cn(
                "flex size-[34px] md:size-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-60",
                canSend
                  ? "bg-[var(--lc-text-primary)] text-white"
                  : "bg-[var(--lc-border)] text-[var(--lc-text-tertiary)]"
              )}
              disabled={!canSend}
              onClick={() => {
                void sendMessage();
              }}
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </div>

        {/* Hint text */}
        <p className="hidden px-1 text-[11px] text-[var(--lc-text-tertiary)] md:block">
          Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
