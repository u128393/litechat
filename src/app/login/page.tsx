import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth";
import { getSafeRedirectPath } from "@/server/auth/guards";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
    password_changed?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const currentUser = await getCurrentUser();
  const params = await searchParams;
  const nextPath = getSafeRedirectPath(params.next);

  if (currentUser) {
    redirect(nextPath);
  }

  const showInvalidCredentials = params.error === "invalid_credentials";
  const showPasswordChanged = params.password_changed === "1";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-16 sm:px-10">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-10">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-blue-600">LiteChat Login</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Sign in with your admin account</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Use the email and password provisioned through the setup script.
        </p>

        <form action="/api/auth/login" method="post" className="mt-8 space-y-5">
          <input type="hidden" name="next" value={nextPath} />

          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none transition focus:border-blue-500"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none transition focus:border-blue-500"
            />
          </label>

          {showInvalidCredentials ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Invalid email or password.
            </p>
          ) : null}

          {showPasswordChanged ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Password updated. Sign in again with your new password.
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
