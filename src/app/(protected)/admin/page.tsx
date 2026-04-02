export default function AdminPage() {
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <section className="min-h-0 flex-1 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex h-full min-h-[24rem] flex-col overflow-hidden rounded-[2rem] border border-[var(--app-shell-border)] bg-white/78 shadow-[0_28px_80px_rgba(15,23,42,0.10)] backdrop-blur">
          <div className="border-b border-[var(--app-shell-border)] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--app-shell-text)]">Admin management</p>
                <p className="text-sm text-[var(--app-shell-subtle)]">
                  This area is reserved for configuration and management tools.
                </p>
              </div>
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--app-shell-subtle)]">Admin only</div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center p-5 sm:p-8">
            <div className="mx-auto flex w-full max-w-3xl flex-col items-center rounded-[2rem] border border-dashed border-[var(--app-shell-border)] bg-[var(--app-shell-panel-muted)] px-6 py-12 text-center sm:px-10">
              <div className="rounded-full bg-[var(--app-shell-accent)]/12 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-shell-accent)]">
                Placeholder
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[var(--app-shell-text)] sm:text-4xl">
                Admin tools will land here.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--app-shell-subtle)] sm:text-base">
                T008 adds the entry point and the server-side role guard so later management pages can build on the same protected shell.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
