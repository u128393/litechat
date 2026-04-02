const setupChecklist = [
  "Next.js App Router is configured with TypeScript.",
  "Tailwind CSS is available through the global stylesheet.",
  "The src layout leaves room for shared libraries and future app features."
];

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center px-6 py-16 sm:px-10">
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[1.3fr_0.9fr]">
        <section className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-blue-600">
            LiteChat Workspace
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Next.js is bootstrapped and ready for the first product tasks.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            This baseline app intentionally stays small while setting up the App Router,
            Tailwind CSS, and a source layout that can grow into authentication, admin,
            and chat features without a major restructure.
          </p>
        </section>

        <section className="rounded-[2rem] border border-slate-200/70 bg-slate-950 p-8 text-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
          <h2 className="text-lg font-semibold tracking-tight">Bootstrap checklist</h2>
          <ul className="mt-6 space-y-4 text-sm leading-6 text-slate-300 sm:text-base">
            {setupChecklist.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            Next steps will add environment config, database setup, auth, and the shared app shell.
          </div>
        </section>
      </div>
    </main>
  );
}
