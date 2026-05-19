"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import type { AppMessages } from "@/lib/i18n/messages";
import { useI18n } from "@/lib/i18n/provider";

type AccountSettingsResponse = {
  settings?: {
    customInstructions?: unknown;
  };
  code?: string;
};

export default function InstructionsSettingsPage() {
  const router = useRouter();
  const { messages } = useI18n();
  const [customInstructions, setCustomInstructions] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const response = await fetch("/api/account/settings", {
          method: "GET",
          credentials: "same-origin"
        });
        const payload = (await response.json().catch(() => null)) as AccountSettingsResponse | null;

        if (!active) {
          return;
        }

        if (!response.ok) {
          toast.error(resolveErrorMessage(payload?.code, messages));
          return;
        }

        setCustomInstructions(
          typeof payload?.settings?.customInstructions === "string" ? payload.settings.customInstructions : ""
        );
      } catch {
        if (active) {
          toast.error(messages.instructions.unknownError);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      active = false;
    };
  }, [messages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (customInstructions.trim().length > 8000) {
      toast.error(messages.instructions.tooLong);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/account/settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ customInstructions })
      });
      const payload = (await response.json().catch(() => null)) as AccountSettingsResponse | null;

      if (!response.ok) {
        toast.error(resolveErrorMessage(payload?.code, messages));
        return;
      }

      const savedInstructions =
        typeof payload?.settings?.customInstructions === "string" ? payload.settings.customInstructions : customInstructions.trim();
      setCustomInstructions(savedInstructions);
      toast.success(messages.instructions.success);
    } catch {
      toast.error(messages.instructions.unknownError);
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
          {messages.instructions.title}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
          {isLoading ? (
            <p className="rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-secondary)] px-3 py-2.5 text-sm text-[var(--lc-text-secondary)]">
              {messages.instructions.loading}
            </p>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={(event) => void handleSubmit(event)}>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-[var(--lc-text-primary)]">
                    {messages.instructions.label}
                  </label>
                </div>
                <div className="relative">
                  <textarea
                    value={customInstructions}
                    onChange={(event) => {
                      setCustomInstructions(event.target.value);
                    }}
                    rows={12}
                    maxLength={8000}
                    placeholder={messages.instructions.placeholder}
                    className="min-h-[320px] w-full resize-y rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] px-3 py-2.5 text-sm leading-6 text-[var(--lc-text-primary)] outline-none transition placeholder:text-[var(--lc-text-tertiary)] focus:border-[var(--lc-accent)]"
                  />
                  <span className="pointer-events-none absolute left-0 top-full mt-0.5 text-xs text-[var(--lc-text-tertiary)]">
                    {customInstructions.trim().length}/8000
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 rounded-lg bg-[var(--lc-accent)] px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {isSubmitting ? messages.instructions.saving : messages.instructions.submit}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

function resolveErrorMessage(code: string | undefined, messages: AppMessages) {
  switch (code) {
    case "custom_instructions_too_long":
      return messages.instructions.tooLong;
    default:
      return messages.instructions.unknownError;
  }
}
