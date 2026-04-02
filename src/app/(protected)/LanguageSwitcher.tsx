"use client";

import { useI18n } from "@/lib/i18n/provider";
import { supportedAppLocales } from "@/lib/i18n/locales";

const languageNames = {
  en: "English",
  "zh-CN": "简体中文"
} as const;

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, messages, setLocale } = useI18n();

  return (
    <label
      className={compact ? "flex items-center gap-2" : "block rounded-2xl border border-[var(--app-shell-border)] bg-[var(--app-shell-panel-muted)] px-3 py-2.5"}
    >
      <span className={compact ? "text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-shell-subtle)]" : "text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-shell-subtle)]"}>
        {messages.shell.languageLabel}
      </span>
      <select
        aria-label={messages.shell.languageLabel}
        className={compact ? "rounded-full border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-3 py-1.5 text-sm font-medium text-[var(--app-shell-text)] outline-none" : "mt-2 w-full rounded-xl border border-[var(--app-shell-border)] bg-white px-3 py-2 text-sm font-medium text-[var(--app-shell-text)] outline-none"}
        onChange={(event) => {
          void setLocale(event.target.value as (typeof supportedAppLocales)[number]);
        }}
        value={locale}
      >
        {supportedAppLocales.map((supportedLocale) => (
          <option key={supportedLocale} value={supportedLocale}>
            {languageNames[supportedLocale]}
          </option>
        ))}
      </select>
      {compact ? null : <p className="mt-2 text-sm text-[var(--app-shell-subtle)]">{messages.shell.languageDescription}</p>}
    </label>
  );
}
