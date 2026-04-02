"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import type { AppMessages } from "@/lib/i18n/messages";
import { useI18n } from "@/lib/i18n/provider";

export default function PasswordSettingsPage() {
  const router = useRouter();
  const { messages } = useI18n();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);
    setSuccessMessage(null);

    const formData = new FormData(event.currentTarget);
    const currentPassword = formData.get("currentPassword");
    const newPassword = formData.get("newPassword");
    const confirmPassword = formData.get("confirmPassword");

    if (typeof currentPassword !== "string" || typeof newPassword !== "string" || typeof confirmPassword !== "string") {
      setErrorMessage(messages.password.required);
      return;
    }

    if (currentPassword.length === 0 || newPassword.length === 0) {
      setErrorMessage(messages.password.required);
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage(messages.password.minLength);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage(messages.password.mismatch);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const payload = (await response.json().catch(() => null)) as { code?: string; redirectTo?: string } | null;

      if (!response.ok) {
        setErrorMessage(resolveErrorMessage(payload?.code, messages));
        return;
      }

      event.currentTarget.reset();
      setSuccessMessage(messages.password.success);

      startTransition(() => {
        router.replace(payload?.redirectTo ?? "/login?password_changed=1");
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-2xl rounded-[2rem] border border-[var(--app-shell-border)] bg-white/82 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.10)] backdrop-blur sm:p-8">
        <div className="rounded-full bg-[var(--app-shell-accent)]/12 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-shell-accent)] inline-flex">
          {messages.password.badge}
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[var(--app-shell-text)]">{messages.password.title}</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--app-shell-subtle)]">{messages.password.description}</p>

        <form className="mt-8 space-y-5" onSubmit={(event) => void handleSubmit(event)}>
          <label className="block text-sm font-medium text-[var(--app-shell-text)]">
            {messages.password.currentPasswordLabel}
            <input
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              required
              className="mt-2 w-full rounded-2xl border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-4 py-3 text-base text-[var(--app-shell-text)] outline-none transition focus:border-[var(--app-shell-accent)]"
            />
          </label>

          <label className="block text-sm font-medium text-[var(--app-shell-text)]">
            {messages.password.newPasswordLabel}
            <input
              type="password"
              name="newPassword"
              autoComplete="new-password"
              minLength={8}
              required
              className="mt-2 w-full rounded-2xl border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-4 py-3 text-base text-[var(--app-shell-text)] outline-none transition focus:border-[var(--app-shell-accent)]"
            />
          </label>

          <label className="block text-sm font-medium text-[var(--app-shell-text)]">
            {messages.password.confirmPasswordLabel}
            <input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={8}
              required
              className="mt-2 w-full rounded-2xl border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-4 py-3 text-base text-[var(--app-shell-text)] outline-none transition focus:border-[var(--app-shell-accent)]"
            />
          </label>

          {errorMessage ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
          ) : null}

          {successMessage ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</p>
          ) : null}

          <div className="rounded-[1.5rem] border border-dashed border-[var(--app-shell-border)] bg-[var(--app-shell-panel-muted)] px-4 py-3 text-sm text-[var(--app-shell-subtle)]">
            {messages.password.signInAgain}
          </div>

          <div className="rounded-[1.5rem] border border-dashed border-[var(--app-shell-border)] bg-[var(--app-shell-panel-muted)] px-4 py-3 text-sm text-[var(--app-shell-subtle)]">
            {messages.password.forgotPasswordOutOfScope}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isPending}
            className="rounded-full bg-[var(--app-shell-accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting || isPending ? messages.password.saving : messages.password.submit}
          </button>
        </form>
      </div>
    </main>
  );
}

function resolveErrorMessage(code: string | undefined, messages: AppMessages) {
  switch (code) {
    case "invalid_credentials":
      return messages.password.incorrectCurrentPassword;
    case "min_length":
      return messages.password.minLength;
    default:
      return messages.password.unknownError;
  }
}
