import Link from "next/link";

import { isAdminUser } from "@/lib/auth/roles";
import { requireCurrentUser } from "@/server/auth/guards";

type ProtectedLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

const sidebarConversations = [
  {
    id: "welcome",
    title: "Welcome to LiteChat",
    meta: "Shell placeholder"
  },
  {
    id: "ideas",
    title: "Prompt ideas",
    meta: "Local history soon"
  },
  {
    id: "notes",
    title: "Release notes draft",
    meta: "Recent conversations"
  }
];

function SidebarNavigation({
  currentUser,
  mobile = false
}: {
  currentUser: Awaited<ReturnType<typeof requireCurrentUser>>;
  mobile?: boolean;
}) {
  return (
    <div className="flex h-full flex-col gap-5">
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-shell-accent)]">LiteChat</p>
          <p className="mt-2 text-sm text-[var(--app-shell-subtle)]">
            Shared app shell for chat and future admin tools.
          </p>
        </div>

        <button
          type="button"
          className="flex w-full items-center justify-center rounded-2xl bg-[var(--app-shell-accent)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(37,99,235,0.28)] transition hover:bg-blue-500"
        >
          New chat
        </button>
      </div>

      <nav aria-label="Conversations" className="min-h-0 flex-1">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-shell-subtle)]">
            Conversations
          </h2>
          <span className="text-xs text-slate-400">Local only</span>
        </div>

        <ul className="space-y-2">
          {sidebarConversations.map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                className="flex w-full flex-col rounded-2xl border border-transparent bg-[var(--app-shell-panel-muted)] px-4 py-3 text-left transition hover:border-[var(--app-shell-border)] hover:bg-white"
              >
                <span className="text-sm font-medium text-[var(--app-shell-text)]">{conversation.title}</span>
                <span className="mt-1 text-xs text-[var(--app-shell-subtle)]">{conversation.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-3 rounded-[1.75rem] border border-[var(--app-shell-border)] bg-white/88 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--app-shell-text)]">{currentUser.email}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[var(--app-shell-subtle)]">
              {currentUser.role}
            </p>
          </div>
          <span className="rounded-full border border-[var(--app-shell-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--app-shell-subtle)]">
            Menu
          </span>
        </div>

        <div className="rounded-2xl border border-dashed border-[var(--app-shell-border)] bg-[var(--app-shell-panel-muted)] px-3 py-2.5 text-sm text-[var(--app-shell-subtle)]">
          Language control slot
        </div>

        {isAdminUser(currentUser) ? (
          <Link
            href="/admin"
            className="flex items-center justify-between rounded-2xl border border-[var(--app-shell-border)] px-3 py-2.5 text-sm font-medium text-[var(--app-shell-text)] transition hover:bg-[var(--app-shell-panel-muted)]"
          >
            <span>Admin area</span>
            <span className="text-xs text-[var(--app-shell-subtle)]">Manage</span>
          </Link>
        ) : null}

        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="w-full rounded-2xl border border-[var(--app-shell-border)] px-3 py-2.5 text-sm font-medium text-[var(--app-shell-text)] transition hover:bg-[var(--app-shell-panel-muted)]"
          >
            Log out
          </button>
        </form>
      </div>

      {mobile ? (
        <p className="text-xs text-[var(--app-shell-subtle)]">
          Mobile navigation is collapsed into this drawer to preserve the chat workspace.
        </p>
      ) : null}
    </div>
  );
}

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const currentUser = await requireCurrentUser();

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
                <span>Workspace menu</span>
                <span className="text-xs text-[var(--app-shell-subtle)] group-open:hidden">Open</span>
                <span className="hidden text-xs text-[var(--app-shell-subtle)] group-open:inline">Close</span>
              </summary>
              <div className="mt-4 border-t border-[var(--app-shell-border)] pt-4">
                <SidebarNavigation currentUser={currentUser} mobile />
              </div>
            </details>
          </div>

          <header className="border-b border-[var(--app-shell-border)] bg-white/72 px-4 py-4 backdrop-blur sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-shell-subtle)]" htmlFor="model-selector">
                  Model
                </label>
                <select
                  id="model-selector"
                  name="model-selector"
                  defaultValue="gpt-4.1"
                  className="rounded-full border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-4 py-2 text-sm font-medium text-[var(--app-shell-text)] shadow-[0_10px_24px_rgba(15,23,42,0.05)] outline-none"
                >
                  <option value="gpt-4.1">GPT-4.1</option>
                  <option value="gpt-4.1-mini">GPT-4.1 mini</option>
                  <option value="o4-mini">o4-mini</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--app-shell-subtle)]">
                <span className="rounded-full border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-3 py-1.5">
                  Ready for local conversation state
                </span>
                <span className="rounded-full border border-dashed border-[var(--app-shell-border)] px-3 py-1.5">
                  Language switcher slot
                </span>
              </div>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}
