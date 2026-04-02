"use client";

import Link from "next/link";

import { useChatWorkspace } from "@/app/(protected)/ChatWorkspaceProvider";
import { LanguageSwitcher } from "@/app/(protected)/LanguageSwitcher";
import { isAdminUser } from "@/lib/auth/roles";
import { useI18n } from "@/lib/i18n/provider";
import type { CurrentUser } from "@/server/auth/types";

type ProtectedShellProps = {
  currentUser: Pick<CurrentUser, "userId" | "email" | "role">;
  children: React.ReactNode;
};

function SidebarNavigation({ currentUser, mobile = false }: { currentUser: ProtectedShellProps["currentUser"]; mobile?: boolean }) {
  const { locale, messages } = useI18n();
  const { conversations, activeConversationId, isLoadingWorkspace, isSendingMessage, createNewConversation, selectConversation } = useChatWorkspace();

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-shell-accent)]">{messages.shell.brand}</p>
          <p className="mt-2 text-sm text-[var(--app-shell-subtle)]">{messages.shell.description}</p>
        </div>

        <button
          type="button"
          className="flex w-full items-center justify-center rounded-2xl bg-[var(--app-shell-accent)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(37,99,235,0.28)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSendingMessage}
          onClick={() => {
            void createNewConversation();
          }}
        >
          {messages.shell.newChat}
        </button>
      </div>

      <nav aria-label={messages.shell.conversationsLabel} className="min-h-0 flex-1">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-shell-subtle)]">
            {messages.shell.conversationsLabel}
          </h2>
          <span className="text-xs text-slate-400">{messages.shell.conversationsMeta}</span>
        </div>

        <ul className="space-y-2">
          {isLoadingWorkspace ? (
            <li className="rounded-2xl border border-[var(--app-shell-border)] bg-[var(--app-shell-panel-muted)] px-4 py-3 text-sm text-[var(--app-shell-subtle)]">
              {messages.shell.conversationsLoading}
            </li>
          ) : null}

          {!isLoadingWorkspace && conversations.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-[var(--app-shell-border)] bg-[var(--app-shell-panel-muted)] px-4 py-3 text-sm text-[var(--app-shell-subtle)]">
              {messages.shell.conversationsEmpty}
            </li>
          ) : null}

          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                className={`flex w-full flex-col rounded-2xl border px-4 py-3 text-left transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 ${
                  conversation.id === activeConversationId
                    ? "border-[var(--app-shell-accent)] bg-white"
                    : "border-transparent bg-[var(--app-shell-panel-muted)] hover:border-[var(--app-shell-border)]"
                }`}
                disabled={isSendingMessage}
                onClick={() => {
                  void selectConversation(conversation.id);
                }}
              >
                <span className="text-sm font-medium text-[var(--app-shell-text)]">{conversation.title}</span>
                <span className="mt-1 text-xs text-[var(--app-shell-subtle)]">{formatConversationTimestamp(conversation.updatedAt, locale)}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-3 rounded-[1.75rem] border border-[var(--app-shell-border)] bg-white/88 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--app-shell-text)]">{currentUser.email}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[var(--app-shell-subtle)]">{currentUser.role}</p>
          </div>
          <span className="rounded-full border border-[var(--app-shell-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--app-shell-subtle)]">
            {messages.shell.menu}
          </span>
        </div>

        <LanguageSwitcher />

        <Link
          href="/account/password"
          className="flex items-center justify-between rounded-2xl border border-[var(--app-shell-border)] px-3 py-2.5 text-sm font-medium text-[var(--app-shell-text)] transition hover:bg-[var(--app-shell-panel-muted)]"
        >
          <span>{messages.shell.passwordSettings}</span>
          <span className="text-xs text-[var(--app-shell-subtle)]">{messages.shell.passwordManage}</span>
        </Link>

        {isAdminUser({ role: currentUser.role }) ? (
          <Link
            href="/admin"
            className="flex items-center justify-between rounded-2xl border border-[var(--app-shell-border)] px-3 py-2.5 text-sm font-medium text-[var(--app-shell-text)] transition hover:bg-[var(--app-shell-panel-muted)]"
          >
            <span>{messages.shell.adminArea}</span>
            <span className="text-xs text-[var(--app-shell-subtle)]">{messages.shell.adminManage}</span>
          </Link>
        ) : null}

        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="w-full rounded-2xl border border-[var(--app-shell-border)] px-3 py-2.5 text-sm font-medium text-[var(--app-shell-text)] transition hover:bg-[var(--app-shell-panel-muted)]"
          >
            {messages.shell.logout}
          </button>
        </form>
      </div>

      {mobile ? <p className="text-xs text-[var(--app-shell-subtle)]">{messages.shell.mobileHint}</p> : null}
    </div>
  );
}

export function ProtectedShell({ currentUser, children }: ProtectedShellProps) {
  const { messages } = useI18n();
  const { models, selectedModelId, isLoadingModels } = useChatWorkspace();
  const selectedModel = models.find((model) => model.id === selectedModelId) ?? null;

  return (
    <div className="min-h-dvh bg-[var(--app-shell-bg)] text-[var(--app-shell-text)]">
      <div className="flex min-h-dvh flex-col md:flex-row">
        <aside className="hidden w-full max-w-80 shrink-0 border-r border-[var(--app-shell-border)] bg-white/74 px-5 py-5 backdrop-blur md:flex md:min-h-dvh md:flex-col">
          <SidebarNavigation currentUser={currentUser} />
        </aside>

        <div className="flex min-h-dvh flex-1 flex-col">
          <div className="border-b border-[var(--app-shell-border)] bg-white/78 px-4 py-3 backdrop-blur md:hidden">
            <details className="group rounded-[1.5rem] border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-4 py-3 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-[var(--app-shell-text)]">
                <span>{messages.shell.workspaceMenu}</span>
                <span className="text-xs text-[var(--app-shell-subtle)] group-open:hidden">{messages.shell.open}</span>
                <span className="hidden text-xs text-[var(--app-shell-subtle)] group-open:inline">{messages.shell.close}</span>
              </summary>
              <div className="mt-4 border-t border-[var(--app-shell-border)] pt-4">
                <SidebarNavigation currentUser={currentUser} mobile />
              </div>
            </details>
          </div>

          <header className="border-b border-[var(--app-shell-border)] bg-white/72 px-4 py-4 backdrop-blur sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--app-shell-subtle)]">
                <span className="rounded-full border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-3 py-1.5">
                  {isLoadingModels
                    ? messages.shell.modelsLoading
                    : selectedModel?.displayName ?? messages.shell.modelsEmpty}
                </span>
                <LanguageSwitcher compact />
              </div>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}

function formatConversationTimestamp(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}
