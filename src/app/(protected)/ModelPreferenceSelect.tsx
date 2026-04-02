"use client";

import { useChatWorkspace } from "@/app/(protected)/ChatWorkspaceProvider";
import { useI18n } from "@/lib/i18n/provider";

export function ModelPreferenceSelect() {
  const { messages } = useI18n();
  const { models, selectedModelId, isLoadingModels, selectModel } = useChatWorkspace();

  return (
    <div className="flex items-center gap-3">
      <label className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-shell-subtle)]" htmlFor="model-selector">
        {messages.shell.modelLabel}
      </label>
      <select
        id="model-selector"
        name="model-selector"
        className="rounded-full border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-4 py-2 text-sm font-medium text-[var(--app-shell-text)] shadow-[0_10px_24px_rgba(15,23,42,0.05)] outline-none disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isLoadingModels || models.length === 0}
        onChange={(event) => {
          void selectModel(event.target.value);
        }}
        value={selectedModelId ?? ""}
      >
        {isLoadingModels ? <option value="">{messages.shell.modelsLoading}</option> : null}
        {!isLoadingModels && models.length === 0 ? <option value="">{messages.shell.modelsEmpty}</option> : null}
        {models.map((modelOption) => (
          <option key={modelOption.id} value={modelOption.id}>
            {modelOption.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}
