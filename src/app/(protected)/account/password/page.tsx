"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";

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
    <main className="flex min-h-0 flex-1 flex-col bg-[var(--lc-bg-primary)] font-sans">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--lc-border)] px-4 sm:px-6">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--lc-text-secondary)] transition-colors hover:bg-[var(--lc-bg-secondary)] hover:text-[var(--lc-text-primary)]"
          aria-label={messages.common.back}
        >
          <ArrowLeft className="size-[18px]" />
        </button>
        <h1 className="truncate text-[20px] font-semibold text-[var(--lc-text-primary)]">
          {messages.password.title}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
        <div className="mx-auto flex w-full max-w-[400px] flex-col gap-6">
          <form className="flex flex-col gap-4" onSubmit={(event) => void handleSubmit(event)}>
          {/* Current Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--lc-text-primary)]">
              {messages.password.currentPasswordLabel}
            </label>
            <input
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="w-full rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] px-3 py-2.5 text-sm text-[var(--lc-text-primary)] outline-none transition placeholder:text-[var(--lc-text-tertiary)] focus:border-[var(--lc-accent)]"
            />
          </div>

          {/* New Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--lc-text-primary)]">
              {messages.password.newPasswordLabel}
            </label>
            <input
              type="password"
              name="newPassword"
              autoComplete="new-password"
              minLength={8}
              required
              placeholder={messages.password.newPasswordPlaceholder}
              className="w-full rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] px-3 py-2.5 text-sm text-[var(--lc-text-primary)] outline-none transition placeholder:text-[var(--lc-text-tertiary)] focus:border-[var(--lc-accent)]"
            />
          </div>

          {/* Confirm New Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--lc-text-primary)]">
              {messages.password.confirmPasswordLabel}
            </label>
            <input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={8}
              required
              placeholder={messages.password.confirmPasswordPlaceholder}
              className="w-full rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] px-3 py-2.5 text-sm text-[var(--lc-text-primary)] outline-none transition placeholder:text-[var(--lc-text-tertiary)] focus:border-[var(--lc-accent)]"
            />
          </div>

          {/* Error / Success messages */}
          {errorMessage ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{errorMessage}</p>
          ) : null}

          {successMessage ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">{successMessage}</p>
          ) : null}

          {/* Spacer */}
          <div className="h-2" />

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || isPending}
            className="h-10 w-full rounded-lg bg-[var(--lc-accent)] text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting || isPending ? messages.password.saving : messages.password.submit}
          </button>
          </form>
        </div>
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
