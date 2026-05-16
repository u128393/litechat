import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { getCurrentUser } from "@/server/auth";
import { getSafeRedirectPath } from "@/server/auth/guards";
import { getMessages } from "@/lib/i18n/messages";
import { appLocaleRequestHeaderName, resolveRequestLocale } from "@/lib/i18n/locales";

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
  const requestHeaders = await headers();
  const locale = resolveRequestLocale({
    headerLocale: requestHeaders.get(appLocaleRequestHeaderName),
    acceptLanguage: requestHeaders.get("accept-language")
  });
  const messages = getMessages(locale);
  const nextPath = getSafeRedirectPath(params.next);

  if (currentUser) {
    redirect(nextPath);
  }

  const showInvalidCredentials = params.error === "invalid_credentials";
  const showPasswordChanged = params.password_changed === "1";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background font-sans">
      <div className="flex w-[400px] flex-col">
        {/* Brand section */}
        <div className="flex flex-col gap-2">
          <span className="text-2xl font-semibold text-[var(--lc-text-primary)]">
            LiteChat
          </span>
          <span className="text-sm font-normal text-[var(--lc-text-secondary)]">
            {messages.login.tagline}
          </span>
        </div>

        {/* Spacer */}
        <div className="h-8" />

        {/* Form */}
        <form action="/api/auth/login" method="post" className="flex flex-col gap-4">
          <input type="hidden" name="next" value={nextPath} />

          {/* Email group */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium text-[var(--lc-text-primary)]"
            >
              {messages.login.emailLabel}
            </label>
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              required
              placeholder="name@example.com"
              className="w-full rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] px-3 py-2.5 text-sm text-[var(--lc-text-primary)] outline-none placeholder:text-[var(--lc-text-tertiary)]"
            />
          </div>

          {/* Password group */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-[var(--lc-text-primary)]"
            >
              {messages.login.passwordLabel}
            </label>
            <input
              id="password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="w-full rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] px-3 py-2.5 text-sm text-[var(--lc-text-primary)] outline-none placeholder:text-[var(--lc-text-tertiary)]"
            />
          </div>

          {/* Messages */}
          {showInvalidCredentials ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {messages.login.invalidCredentials}
            </p>
          ) : null}

          {showPasswordChanged ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
              {messages.login.passwordChanged}
            </p>
          ) : null}

          {/* Spacer */}
          <div className="h-2" />

          {/* Sign in button */}
          <button
            type="submit"
            className="h-10 w-full rounded-lg bg-[var(--lc-accent)] text-center text-sm font-medium text-white"
          >
            {messages.login.submit}
          </button>
        </form>
      </div>
    </main>
  );
}
