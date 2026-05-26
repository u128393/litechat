import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { getMessages } from "@/lib/i18n/messages";
import { detectBrowserLocale } from "@/lib/i18n/locales";
import { apiFetch, readJson } from "@/shared/api-client";
import { useAuth } from "@/shared/auth/auth-context";
import { BrandLogo } from "@/components/brand-logo";

type LoginResponse = {
  error?: string;
  code?: string;
  redirectTo?: string;
};

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, refreshCurrentUser, setCurrentUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInvalidCredentials, setShowInvalidCredentials] = useState(searchParams.get("error") === "invalid_credentials");
  const locale = useMemo(() => detectBrowserLocale(), []);
  const messages = useMemo(() => getMessages(locale), [locale]);
  const nextPath = useMemo(() => getSafeRedirectPath(searchParams.get("next")), [searchParams]);
  const showPasswordChanged = searchParams.get("password_changed") === "1";

  useEffect(() => {
    if (currentUser && !showPasswordChanged) {
      navigate(nextPath, { replace: true });
    }
  }, [currentUser, navigate, nextPath, showPasswordChanged]);

  useEffect(() => {
    if (currentUser && showPasswordChanged) {
      setCurrentUser(null);
    }
  }, [currentUser, setCurrentUser, showPasswordChanged]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setShowInvalidCredentials(false);

    try {
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ email, password, next: nextPath })
      });
      const payload = await readJson<LoginResponse>(response);

      if (!response.ok) {
        setShowInvalidCredentials(payload?.code === "invalid_credentials");
        return;
      }

      await refreshCurrentUser();
      navigate(payload?.redirectTo ?? nextPath, { replace: true });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background font-sans">
      <div className="flex w-[400px] flex-col">
        <div className="flex flex-col gap-2">
          <BrandLogo
            label={messages.shell.brand}
            markClassName="size-8"
            textClassName="text-2xl font-semibold tracking-[-0.02em] text-[var(--lc-text-primary)]"
          />
          <span className="text-sm font-normal text-[var(--lc-text-secondary)]">{messages.login.tagline}</span>
        </div>

        <div className="h-8" />

        <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-[var(--lc-text-primary)]">
              {messages.login.emailLabel}
            </label>
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] px-3 py-2.5 text-sm text-[var(--lc-text-primary)] outline-none placeholder:text-[var(--lc-text-tertiary)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-[var(--lc-text-primary)]">
              {messages.login.passwordLabel}
            </label>
            <input
              id="password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] px-3 py-2.5 text-sm text-[var(--lc-text-primary)] outline-none placeholder:text-[var(--lc-text-tertiary)]"
            />
          </div>

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

          <div className="h-2" />

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-10 w-full rounded-lg bg-[var(--lc-accent)] text-center text-sm font-medium text-white disabled:opacity-60"
          >
            {messages.login.submit}
          </button>
        </form>
      </div>
    </main>
  );
}

function getSafeRedirectPath(value: string | null, fallback = "/") {
  if (typeof value !== "string" || value.length === 0) {
    return fallback;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}
