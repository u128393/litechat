import { requireCurrentUser } from "@/server/auth/guards";

type ProtectedLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const currentUser = await requireCurrentUser();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4 sm:px-10">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-blue-600">LiteChat</p>
            <p className="mt-1 text-sm text-slate-600">
              Signed in as <span className="font-medium text-slate-900">{currentUser.email}</span>
            </p>
          </div>

          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      {children}
    </div>
  );
}
