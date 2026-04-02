"use client";

import { useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n/provider";
import { createBrowserPreferencesStore } from "@/lib/preferences";

const modelOptions = [
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
  { id: "o4-mini", label: "o4-mini" }
] as const;

export function ModelPreferenceSelect({ userId }: { userId: string }) {
  const { messages } = useI18n();
  const [selectedModelId, setSelectedModelId] = useState<(typeof modelOptions)[number]["id"]>(modelOptions[0].id);

  useEffect(() => {
    let active = true;

    void createBrowserPreferencesStore(userId)
      .getLastSelectedModelConfigId()
      .then((savedModelId) => {
        if (!active || !savedModelId || !modelOptions.some((modelOption) => modelOption.id === savedModelId)) {
          return;
        }

        setSelectedModelId(savedModelId as (typeof modelOptions)[number]["id"]);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <>
      <label className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-shell-subtle)]" htmlFor="model-selector">
        {messages.shell.modelLabel}
      </label>
      <select
        id="model-selector"
        name="model-selector"
        className="rounded-full border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-4 py-2 text-sm font-medium text-[var(--app-shell-text)] shadow-[0_10px_24px_rgba(15,23,42,0.05)] outline-none"
        onChange={(event) => {
          const nextModelId = event.target.value as (typeof modelOptions)[number]["id"];
          setSelectedModelId(nextModelId);
          void createBrowserPreferencesStore(userId).setLastSelectedModelConfigId(nextModelId);
        }}
        value={selectedModelId}
      >
        {modelOptions.map((modelOption) => (
          <option key={modelOption.id} value={modelOption.id}>
            {modelOption.label}
          </option>
        ))}
      </select>
    </>
  );
}
