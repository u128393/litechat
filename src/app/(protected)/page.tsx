"use client";

import { useChatWorkspace } from "@/app/(protected)/ChatWorkspaceProvider";
import { ModelPreferenceSelect } from "@/app/(protected)/ModelPreferenceSelect";
import { useI18n } from "@/lib/i18n/provider";

export default function HomePage() {
  const { messages } = useI18n();
  const {
    activeConversationId,
    messages: conversationMessages,
    draft,
    selectedModelId,
    isLoadingWorkspace,
    createNewConversation,
    updateDraft,
    sendMessage
  } = useChatWorkspace();

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <section className="min-h-0 flex-1 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex h-full min-h-[24rem] flex-col overflow-hidden rounded-[2rem] border border-[var(--app-shell-border)] bg-white/78 shadow-[0_28px_80px_rgba(15,23,42,0.10)] backdrop-blur">
          <div className="border-b border-[var(--app-shell-border)] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--app-shell-text)]">{messages.home.title}</p>
                <p className="text-sm text-[var(--app-shell-subtle)]">{messages.home.description}</p>
              </div>
              <ModelPreferenceSelect />
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 sm:p-6">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-[var(--app-shell-subtle)]">
              <span>{messages.home.timelineLabel}</span>
              <button
                type="button"
                className="rounded-full border border-[var(--app-shell-border)] px-3 py-1.5 text-[11px] font-medium normal-case tracking-normal text-[var(--app-shell-text)] transition hover:bg-[var(--app-shell-panel)]"
                onClick={() => {
                  void createNewConversation();
                }}
              >
                {messages.shell.newChat}
              </button>
            </div>

            {isLoadingWorkspace ? (
              <div className="flex min-h-[16rem] items-center justify-center rounded-[2rem] border border-dashed border-[var(--app-shell-border)] bg-[var(--app-shell-panel-muted)] px-6 text-center text-sm text-[var(--app-shell-subtle)]">
                {messages.home.loading}
              </div>
            ) : null}

            {!isLoadingWorkspace && conversationMessages.length === 0 ? (
              <div className="mx-auto flex min-h-[16rem] w-full max-w-3xl flex-col items-center justify-center rounded-[2rem] border border-dashed border-[var(--app-shell-border)] bg-[var(--app-shell-panel-muted)] px-6 py-12 text-center sm:px-10">
                <div className="rounded-full bg-[var(--app-shell-accent)]/12 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-shell-accent)]">
                  {activeConversationId ? messages.home.emptyState : messages.home.noConversation}
                </div>
                <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[var(--app-shell-text)] sm:text-4xl">
                  {messages.home.heroTitle}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--app-shell-subtle)] sm:text-base">
                  {messages.home.heroDescription}
                </p>
              </div>
            ) : null}

            {conversationMessages.length > 0 ? (
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                {conversationMessages.map((message) => (
                  <article
                    key={message.id}
                    className={`max-w-3xl rounded-[1.75rem] px-5 py-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] ${
                      message.role === "user"
                        ? "self-end bg-[var(--app-shell-accent)] text-white"
                        : "border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] text-[var(--app-shell-text)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
                      <span>{message.role === "user" ? messages.home.userMessageLabel : messages.home.assistantMessageLabel}</span>
                      <time dateTime={message.createdAt}>{formatMessageTimestamp(message.createdAt)}</time>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 sm:text-[15px]">{message.content}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--app-shell-border)] bg-white/72 px-4 py-4 backdrop-blur sm:px-6 sm:py-5">
        <div className="mx-auto w-full max-w-4xl rounded-[1.75rem] border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] p-3 shadow-[0_18px_48px_rgba(15,23,42,0.08)] sm:p-4">
          <label className="sr-only" htmlFor="chat-message">
            {messages.home.composerLabel}
          </label>
          <textarea
            id="chat-message"
            name="chat-message"
            rows={4}
            placeholder={messages.home.composerPlaceholder}
            className="min-h-28 w-full resize-none border-0 bg-transparent px-2 py-2 text-base text-[var(--app-shell-text)] outline-none placeholder:text-slate-400"
            onChange={(event) => {
              void updateDraft(event.target.value);
            }}
            value={draft}
          />
          <div className="mt-3 flex flex-col gap-3 border-t border-[var(--app-shell-border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--app-shell-subtle)]">{messages.home.composerDescription}</p>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                className="rounded-full border border-dashed border-[var(--app-shell-border)] px-4 py-2 text-sm font-medium text-[var(--app-shell-subtle)]"
                disabled
              >
                {messages.home.stop}
              </button>
              <button
                type="button"
                className="rounded-full bg-[var(--app-shell-accent)] px-5 py-2 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={draft.trim() === "" || !selectedModelId}
                onClick={() => {
                  void sendMessage();
                }}
              >
                {messages.home.send}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function formatMessageTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}
