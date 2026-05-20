"use client";

import { useRef, useEffect, useLayoutEffect, type KeyboardEvent } from "react";

import { useChatWorkspace } from "@/app/(protected)/ChatWorkspaceProvider";
import { useI18n } from "@/lib/i18n/provider";
import { ArrowUp, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type ComposerProps = {
  placement?: "bottom" | "center";
};

export function Composer({ placement = "bottom" }: ComposerProps) {
  const { messages } = useI18n();
  const {
    draft,
    selectedModelId,
    isSendingMessage,
    chatError,
    composerFocusRequestToken,
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

  useLayoutEffect(() => {
    if (composerFocusRequestToken === 0) {
      return;
    }

    textareaRef.current?.focus({ preventScroll: true });

    const animationFrame = window.requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [composerFocusRequestToken]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  const canSend = draft.trim() !== "" && selectedModelId && !isSendingMessage;
  const actionButtonClass =
    "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--lc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lc-bg-tertiary)]";
  const enabledActionButtonClass =
    "bg-[#111111] text-white hover:bg-[#2A2A2A] dark:bg-white dark:text-[#111111] dark:hover:bg-[#E5E5E5]";
  const disabledActionButtonClass =
    "bg-[#D4D4D8] text-[#8A8A8A] dark:bg-[#4A4A4A] dark:text-[#9B9B9B]";
  const isBottomPlacement = placement === "bottom";

  return (
    <div className={cn("pointer-events-none relative w-full px-4", isBottomPlacement && "pb-6")}>
      {isBottomPlacement ? (
        <div className="absolute top-[26px] bottom-0 left-1/2 w-[calc(100%-2rem)] max-w-[768px] -translate-x-1/2 bg-[var(--lc-bg-primary)]" />
      ) : null}
      <div className="pointer-events-auto relative mx-auto flex w-full max-w-[768px] flex-col gap-2">
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
                {messages.chat.retry}
              </button>
            ) : (
              <button
                type="button"
                className="shrink-0 rounded-md px-2 py-0.5 text-[13px] font-medium text-[#991B1B] transition-colors hover:bg-[#FEE2E2] dark:text-[#FCA5A5] dark:hover:bg-[#7F1D1D]"
                onClick={clearChatError}
              >
                {messages.chat.clearError}
              </button>
            )}
          </div>
        ) : null}

        {/* Textarea box */}
        <div className="flex items-end gap-2 rounded-[20px] bg-[var(--lc-bg-tertiary)] px-3 py-2">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder={messages.chat.composerPlaceholder}
            className="ml-2 min-h-9 flex-1 resize-none border-0 bg-transparent py-2 text-[15px] leading-5 text-[var(--lc-text-primary)] outline-none placeholder:text-[var(--lc-text-tertiary)]"
            onChange={(event) => {
              void updateDraft(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            value={draft}
          />

          {isSendingMessage ? (
            <button
              type="button"
              className={cn(actionButtonClass, enabledActionButtonClass)}
              onClick={stopMessage}
            >
              <div className="size-3 rounded-[2px] bg-current" />
            </button>
          ) : (
            <button
              type="button"
              className={cn(
                actionButtonClass,
                canSend ? enabledActionButtonClass : disabledActionButtonClass
              )}
              disabled={!canSend}
              onClick={() => {
                void sendMessage();
              }}
            >
              <ArrowUp className="size-5" />
            </button>
          )}
        </div>

        {/* Hint text */}
        {isBottomPlacement ? (
          <p className="hidden px-1 text-[11px] text-[var(--lc-text-tertiary)] md:block">
            {messages.chat.composerKeyboardHint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
