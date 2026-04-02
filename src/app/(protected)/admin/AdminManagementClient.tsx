"use client";

import { useState, type FormEvent } from "react";

import { useI18n } from "@/lib/i18n/provider";
import type { ModelConfig } from "@/server/model-configs";
import type { ProviderConfig } from "@/server/providers";

type AdminManagementClientProps = {
  initialProviderConfigs: ProviderConfig[];
  initialModelConfigs: ModelConfig[];
};

type ProviderFormState = {
  name: string;
  providerType: "openai-responses";
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
};

type ModelFormState = {
  providerConfigId: string;
  modelId: string;
  displayName: string;
  enabled: boolean;
  supportsWebSearch: boolean;
  sortOrder: string;
};

const DEFAULT_PROVIDER_FORM: ProviderFormState = {
  name: "",
  providerType: "openai-responses",
  baseUrl: "",
  apiKey: "",
  enabled: true
};

function createDefaultModelForm(providerConfigs: ProviderConfig[]): ModelFormState {
  return {
    providerConfigId: providerConfigs[0]?.id ?? "",
    modelId: "",
    displayName: "",
    enabled: true,
    supportsWebSearch: false,
    sortOrder: "0"
  };
}

export function AdminManagementClient({ initialProviderConfigs, initialModelConfigs }: AdminManagementClientProps) {
  const { messages } = useI18n();
  const adminMessages = messages.admin;
  const sortedInitialProviderConfigs = sortProviderConfigs(initialProviderConfigs);
  const sortedInitialModelConfigs = sortModelConfigs(initialModelConfigs);

  const [providerConfigs, setProviderConfigs] = useState(sortedInitialProviderConfigs);
  const [modelConfigs, setModelConfigs] = useState(sortedInitialModelConfigs);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(sortedInitialProviderConfigs[0]?.id ?? null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(sortedInitialModelConfigs[0]?.id ?? null);
  const [providerForm, setProviderForm] = useState<ProviderFormState>(() => createProviderForm(sortedInitialProviderConfigs[0] ?? null));
  const [modelForm, setModelForm] = useState<ModelFormState>(() =>
    createModelForm(sortedInitialModelConfigs[0] ?? null, sortedInitialProviderConfigs)
  );
  const [providerPending, setProviderPending] = useState(false);
  const [modelPending, setModelPending] = useState(false);
  const [providerFeedback, setProviderFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [modelFeedback, setModelFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const selectedProvider = providerConfigs.find((providerConfig) => providerConfig.id === selectedProviderId) ?? null;
  const selectedModel = modelConfigs.find((modelConfig) => modelConfig.id === selectedModelId) ?? null;

  async function submitProviderForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setProviderPending(true);
    setProviderFeedback(null);

    const isEditing = selectedProvider !== null;
    const requestBody: Record<string, unknown> = {
      name: providerForm.name,
      providerType: providerForm.providerType,
      baseUrl: providerForm.baseUrl.trim() === "" ? null : providerForm.baseUrl,
      enabled: providerForm.enabled
    };

    if (!isEditing || providerForm.apiKey.trim() !== "") {
      requestBody.apiKey = providerForm.apiKey;
    }

    try {
      const response = await fetch(
        isEditing ? `/api/admin/provider-configs/${selectedProvider.id}` : "/api/admin/provider-configs",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(requestBody)
        }
      );

      const payload = await readJsonResponse(response);

      if (!response.ok || !payload || typeof payload.providerConfig !== "object" || payload.providerConfig === null) {
        setProviderPending(false);
        setProviderFeedback({
          type: "error",
          message: `${adminMessages.providers.errorPrefix} ${readErrorMessage(payload, adminMessages.unexpectedResponse)}`
        });
        return;
      }

      const nextProviderConfig = payload.providerConfig as ProviderConfig;
      const nextProviderConfigs = sortProviderConfigs(upsertById(providerConfigs, nextProviderConfig));

      setProviderConfigs(nextProviderConfigs);
      setSelectedProviderId(nextProviderConfig.id);
      setProviderForm(createProviderForm(nextProviderConfig));
      setProviderFeedback({
        type: "success",
        message: isEditing ? adminMessages.providers.successUpdate : adminMessages.providers.successCreate
      });

      if (!selectedModelId && modelForm.providerConfigId === "") {
        setModelForm((currentForm) => ({
          ...currentForm,
          providerConfigId: nextProviderConfig.id
        }));
      }
    } catch {
      setProviderPending(false);
      setProviderFeedback({
        type: "error",
        message: `${adminMessages.providers.errorPrefix} ${adminMessages.unexpectedResponse}`
      });
      return;
    }

    setProviderPending(false);
  }

  async function submitModelForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setModelPending(true);
    setModelFeedback(null);

    const isEditing = selectedModel !== null;
    try {
      const response = await fetch(
        isEditing ? `/api/admin/model-configs/${selectedModel.id}` : "/api/admin/model-configs",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            providerConfigId: modelForm.providerConfigId,
            modelId: modelForm.modelId,
            displayName: modelForm.displayName,
            enabled: modelForm.enabled,
            supportsWebSearch: modelForm.supportsWebSearch,
            sortOrder: Number(modelForm.sortOrder)
          })
        }
      );

      const payload = await readJsonResponse(response);

      if (!response.ok || !payload || typeof payload.modelConfig !== "object" || payload.modelConfig === null) {
        setModelPending(false);
        setModelFeedback({
          type: "error",
          message: `${adminMessages.models.errorPrefix} ${readErrorMessage(payload, adminMessages.unexpectedResponse)}`
        });
        return;
      }

      const nextModelConfig = payload.modelConfig as ModelConfig;
      const nextModelConfigs = sortModelConfigs(upsertById(modelConfigs, nextModelConfig));

      setModelConfigs(nextModelConfigs);
      setSelectedModelId(nextModelConfig.id);
      setModelForm(createModelForm(nextModelConfig, providerConfigs));
      setModelFeedback({
        type: "success",
        message: isEditing ? adminMessages.models.successUpdate : adminMessages.models.successCreate
      });
    } catch {
      setModelPending(false);
      setModelFeedback({
        type: "error",
        message: `${adminMessages.models.errorPrefix} ${adminMessages.unexpectedResponse}`
      });
      return;
    }

    setModelPending(false);
  }

  function startNewProvider() {
    setSelectedProviderId(null);
    setProviderForm(DEFAULT_PROVIDER_FORM);
    setProviderFeedback(null);
  }

  function startNewModel() {
    setSelectedModelId(null);
    setModelForm(createDefaultModelForm(providerConfigs));
    setModelFeedback(null);
  }

  function selectProvider(providerConfig: ProviderConfig) {
    setSelectedProviderId(providerConfig.id);
    setProviderForm(createProviderForm(providerConfig));
    setProviderFeedback(null);
  }

  function selectModel(modelConfig: ModelConfig) {
    setSelectedModelId(modelConfig.id);
    setModelForm(createModelForm(modelConfig, providerConfigs));
    setModelFeedback(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6">
      <div className="overflow-hidden rounded-[2rem] border border-[var(--app-shell-border)] bg-white/78 shadow-[0_28px_80px_rgba(15,23,42,0.10)] backdrop-blur">
        <div className="border-b border-[var(--app-shell-border)] px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--app-shell-text)]">{adminMessages.title}</p>
              <p className="text-sm text-[var(--app-shell-subtle)]">{adminMessages.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.22em] text-[var(--app-shell-subtle)]">{adminMessages.badge}</span>
              <nav aria-label={adminMessages.navigationLabel} className="flex items-center gap-2">
                <a
                  href="#providers"
                  className="rounded-full border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-3 py-1.5 text-sm font-medium text-[var(--app-shell-text)] transition hover:bg-[var(--app-shell-panel-muted)]"
                >
                  {adminMessages.providersNav}
                </a>
                <a
                  href="#models"
                  className="rounded-full border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-3 py-1.5 text-sm font-medium text-[var(--app-shell-text)] transition hover:bg-[var(--app-shell-panel-muted)]"
                >
                  {adminMessages.modelsNav}
                </a>
              </nav>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-2">
          <section id="providers" className="flex flex-col gap-4 rounded-[1.75rem] border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] p-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)] sm:p-5">
            <SectionHeading
              badge={adminMessages.providers.badge}
              title={adminMessages.providers.title}
              description={adminMessages.providers.description}
            />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-shell-subtle)]">
                    {adminMessages.providers.selectionLabel}
                  </p>
                  <button
                    type="button"
                    onClick={startNewProvider}
                    className="rounded-full border border-[var(--app-shell-border)] px-3 py-1.5 text-sm font-medium text-[var(--app-shell-text)] transition hover:bg-[var(--app-shell-panel-muted)]"
                  >
                    {adminMessages.providers.newAction}
                  </button>
                </div>

                {providerConfigs.length > 0 ? (
                  <ul className="space-y-2">
                    {providerConfigs.map((providerConfig) => {
                      const isSelected = providerConfig.id === selectedProviderId;

                      return (
                        <li key={providerConfig.id}>
                          <button
                            type="button"
                            onClick={() => selectProvider(providerConfig)}
                            className={`flex w-full flex-col rounded-2xl border px-4 py-3 text-left transition ${
                              isSelected
                                ? "border-[var(--app-shell-accent)] bg-white shadow-[0_16px_32px_rgba(37,99,235,0.10)]"
                                : "border-[var(--app-shell-border)] bg-[var(--app-shell-panel-muted)] hover:bg-white"
                            }`}
                          >
                            <span className="text-sm font-semibold text-[var(--app-shell-text)]">{providerConfig.name}</span>
                              <span className="mt-1 text-xs text-[var(--app-shell-subtle)]">
                              {providerConfig.providerType} {providerConfig.enabled ? `- ${adminMessages.listEnabledStatus}` : `- ${adminMessages.listDisabledStatus}`}
                              </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyState title={adminMessages.providers.emptyTitle} description={adminMessages.providers.emptyDescription} />
                )}
              </div>

              <div className="rounded-[1.5rem] border border-[var(--app-shell-border)] bg-white/84 p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-shell-subtle)]">
                      {selectedProvider ? adminMessages.providers.editModeLabel : adminMessages.providers.createModeLabel}
                    </p>
                    <p className="mt-2 text-sm text-[var(--app-shell-subtle)]">
                      {selectedProvider?.name ?? adminMessages.providers.defaultProviderType}
                    </p>
                  </div>
                  {selectedProvider ? (
                    <StatusBadge
                      disabledLabel={adminMessages.disabledStatus}
                      enabled={selectedProvider.enabled}
                      enabledLabel={adminMessages.enabledStatus}
                    />
                  ) : null}
                </div>

                <FeedbackBanner feedback={providerFeedback} />

                <form className="space-y-4" onSubmit={submitProviderForm}>
                  <label className="block text-sm font-medium text-[var(--app-shell-text)]">
                    {adminMessages.providers.nameLabel}
                    <input
                      value={providerForm.name}
                      onChange={(event) => setProviderForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm text-[var(--app-shell-text)] outline-none"
                      name="name"
                      required
                    />
                  </label>

                  <label className="block text-sm font-medium text-[var(--app-shell-text)]">
                    {adminMessages.providers.providerTypeLabel}
                    <select
                      value={providerForm.providerType}
                      onChange={(event) =>
                        setProviderForm((currentForm) => ({
                          ...currentForm,
                          providerType: event.target.value as "openai-responses"
                        }))
                      }
                      className="mt-2 w-full rounded-2xl border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm text-[var(--app-shell-text)] outline-none"
                      name="providerType"
                    >
                      <option value="openai-responses">{adminMessages.providers.defaultProviderType}</option>
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-[var(--app-shell-text)]">
                    {adminMessages.providers.baseUrlLabel}
                    <input
                      value={providerForm.baseUrl}
                      onChange={(event) => setProviderForm((currentForm) => ({ ...currentForm, baseUrl: event.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm text-[var(--app-shell-text)] outline-none"
                      name="baseUrl"
                      type="url"
                    />
                  </label>

                  <label className="block text-sm font-medium text-[var(--app-shell-text)]">
                    {adminMessages.providers.apiKeyLabel}
                    <input
                      value={providerForm.apiKey}
                      onChange={(event) => setProviderForm((currentForm) => ({ ...currentForm, apiKey: event.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm text-[var(--app-shell-text)] outline-none"
                      name="apiKey"
                      type="password"
                      required={!selectedProvider}
                    />
                    <p className="mt-2 text-xs text-[var(--app-shell-subtle)]">
                      {selectedProvider ? adminMessages.providers.apiKeyUpdateHint : adminMessages.providers.apiKeyCreateHint}
                    </p>
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm text-[var(--app-shell-text)]">
                    <input
                      checked={providerForm.enabled}
                      onChange={(event) => setProviderForm((currentForm) => ({ ...currentForm, enabled: event.target.checked }))}
                      name="enabled"
                      type="checkbox"
                    />
                    <span>{adminMessages.providers.enabledLabel}</span>
                  </label>

                  <button
                    type="submit"
                    disabled={providerPending}
                    className="w-full rounded-2xl bg-[var(--app-shell-accent)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(37,99,235,0.24)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {providerPending
                      ? selectedProvider
                        ? adminMessages.providers.updatingAction
                        : adminMessages.providers.creatingAction
                      : selectedProvider
                        ? adminMessages.providers.updateAction
                        : adminMessages.providers.createAction}
                  </button>
                </form>
              </div>
            </div>
          </section>

          <section id="models" className="flex flex-col gap-4 rounded-[1.75rem] border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] p-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)] sm:p-5">
            <SectionHeading badge={adminMessages.models.badge} title={adminMessages.models.title} description={adminMessages.models.description} />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-shell-subtle)]">
                    {adminMessages.models.selectionLabel}
                  </p>
                  <button
                    type="button"
                    onClick={startNewModel}
                    disabled={providerConfigs.length === 0}
                    className="rounded-full border border-[var(--app-shell-border)] px-3 py-1.5 text-sm font-medium text-[var(--app-shell-text)] transition hover:bg-[var(--app-shell-panel-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {adminMessages.models.newAction}
                  </button>
                </div>

                {modelConfigs.length > 0 ? (
                  <ul className="space-y-2">
                    {modelConfigs.map((modelConfig) => {
                      const isSelected = modelConfig.id === selectedModelId;

                      return (
                        <li key={modelConfig.id}>
                          <button
                            type="button"
                            onClick={() => selectModel(modelConfig)}
                            className={`flex w-full flex-col rounded-2xl border px-4 py-3 text-left transition ${
                              isSelected
                                ? "border-[var(--app-shell-accent)] bg-white shadow-[0_16px_32px_rgba(37,99,235,0.10)]"
                                : "border-[var(--app-shell-border)] bg-[var(--app-shell-panel-muted)] hover:bg-white"
                            }`}
                          >
                            <span className="text-sm font-semibold text-[var(--app-shell-text)]">{modelConfig.displayName}</span>
                              <span className="mt-1 text-xs text-[var(--app-shell-subtle)]">
                              {modelConfig.modelId} - {adminMessages.listSortOrderPrefix} {modelConfig.sortOrder}
                              </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : providerConfigs.length > 0 ? (
                  <EmptyState title={adminMessages.models.emptyTitle} description={adminMessages.models.emptyDescription} />
                ) : (
                  <EmptyState title={adminMessages.models.blockedTitle} description={adminMessages.models.blockedDescription} />
                )}
              </div>

              <div className="rounded-[1.5rem] border border-[var(--app-shell-border)] bg-white/84 p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-shell-subtle)]">
                      {selectedModel ? adminMessages.models.editModeLabel : adminMessages.models.createModeLabel}
                    </p>
                    <p className="mt-2 text-sm text-[var(--app-shell-subtle)]">
                      {selectedModel?.modelId ?? adminMessages.models.description}
                    </p>
                  </div>
                  {selectedModel ? (
                    <StatusBadge
                      disabledLabel={adminMessages.disabledStatus}
                      enabled={selectedModel.enabled}
                      enabledLabel={adminMessages.enabledStatus}
                    />
                  ) : null}
                </div>

                <FeedbackBanner feedback={modelFeedback} />

                <form className="space-y-4" onSubmit={submitModelForm}>
                  <fieldset disabled={providerConfigs.length === 0 || modelPending} className="space-y-4 disabled:opacity-70">
                    <label className="block text-sm font-medium text-[var(--app-shell-text)]">
                      {adminMessages.models.providerLabel}
                      <select
                        value={modelForm.providerConfigId}
                        onChange={(event) =>
                          setModelForm((currentForm) => ({ ...currentForm, providerConfigId: event.target.value }))
                        }
                        className="mt-2 w-full rounded-2xl border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm text-[var(--app-shell-text)] outline-none"
                        name="providerConfigId"
                        required
                      >
                        {providerConfigs.map((providerConfig) => (
                          <option key={providerConfig.id} value={providerConfig.id}>
                            {providerConfig.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm font-medium text-[var(--app-shell-text)]">
                      {adminMessages.models.modelIdLabel}
                      <input
                        value={modelForm.modelId}
                        onChange={(event) => setModelForm((currentForm) => ({ ...currentForm, modelId: event.target.value }))}
                        className="mt-2 w-full rounded-2xl border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm text-[var(--app-shell-text)] outline-none"
                        name="modelId"
                        required
                      />
                    </label>

                    <label className="block text-sm font-medium text-[var(--app-shell-text)]">
                      {adminMessages.models.displayNameLabel}
                      <input
                        value={modelForm.displayName}
                        onChange={(event) => setModelForm((currentForm) => ({ ...currentForm, displayName: event.target.value }))}
                        className="mt-2 w-full rounded-2xl border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm text-[var(--app-shell-text)] outline-none"
                        name="displayName"
                        required
                      />
                    </label>

                    <label className="block text-sm font-medium text-[var(--app-shell-text)]">
                      {adminMessages.models.sortOrderLabel}
                      <input
                        value={modelForm.sortOrder}
                        onChange={(event) => setModelForm((currentForm) => ({ ...currentForm, sortOrder: event.target.value }))}
                        className="mt-2 w-full rounded-2xl border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm text-[var(--app-shell-text)] outline-none"
                        name="sortOrder"
                        type="number"
                        step="1"
                        required
                      />
                    </label>

                    <label className="flex items-center gap-3 rounded-2xl border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm text-[var(--app-shell-text)]">
                      <input
                        checked={modelForm.enabled}
                        onChange={(event) => setModelForm((currentForm) => ({ ...currentForm, enabled: event.target.checked }))}
                        name="enabled"
                        type="checkbox"
                      />
                      <span>{adminMessages.models.enabledLabel}</span>
                    </label>

                    <label className="flex items-center gap-3 rounded-2xl border border-[var(--app-shell-border)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm text-[var(--app-shell-text)]">
                      <input
                        checked={modelForm.supportsWebSearch}
                        onChange={(event) =>
                          setModelForm((currentForm) => ({ ...currentForm, supportsWebSearch: event.target.checked }))
                        }
                        name="supportsWebSearch"
                        type="checkbox"
                      />
                      <span>{adminMessages.models.supportsWebSearchLabel}</span>
                    </label>

                    <button
                      type="submit"
                      disabled={providerConfigs.length === 0 || modelPending}
                      className="w-full rounded-2xl bg-[var(--app-shell-accent)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(37,99,235,0.24)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {modelPending
                        ? selectedModel
                          ? adminMessages.models.updatingAction
                          : adminMessages.models.creatingAction
                        : selectedModel
                          ? adminMessages.models.updateAction
                          : adminMessages.models.createAction}
                    </button>
                  </fieldset>
                </form>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ badge, title, description }: { badge: string; title: string; description: string }) {
  return (
    <div>
      <div className="inline-flex rounded-full bg-[var(--app-shell-accent)]/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-shell-accent)]">
        {badge}
      </div>
      <h2 className="mt-3 text-xl font-semibold tracking-tight text-[var(--app-shell-text)]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--app-shell-subtle)]">{description}</p>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-[var(--app-shell-border)] bg-[var(--app-shell-panel-muted)] px-4 py-6">
      <p className="text-sm font-semibold text-[var(--app-shell-text)]">{title}</p>
      <p className="mt-2 text-sm text-[var(--app-shell-subtle)]">{description}</p>
    </div>
  );
}

function FeedbackBanner({ feedback }: { feedback: { type: "success" | "error"; message: string } | null }) {
  if (!feedback) {
    return null;
  }

  return (
    <div
      className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
        feedback.type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {feedback.message}
    </div>
  );
}

function StatusBadge({
  enabled,
  enabledLabel,
  disabledLabel
}: {
  enabled: boolean;
  enabledLabel: string;
  disabledLabel: string;
}) {
  return (
    <span className="rounded-full border border-[var(--app-shell-border)] px-3 py-1 text-xs font-medium text-[var(--app-shell-subtle)]">
      {enabled ? enabledLabel : disabledLabel}
    </span>
  );
}

function createProviderForm(providerConfig: ProviderConfig | null): ProviderFormState {
  if (!providerConfig) {
    return DEFAULT_PROVIDER_FORM;
  }

  return {
    name: providerConfig.name,
    providerType: providerConfig.providerType,
    baseUrl: providerConfig.baseUrl ?? "",
    apiKey: "",
    enabled: providerConfig.enabled
  };
}

function createModelForm(modelConfig: ModelConfig | null, providerConfigs: ProviderConfig[]): ModelFormState {
  if (!modelConfig) {
    return createDefaultModelForm(providerConfigs);
  }

  return {
    providerConfigId: modelConfig.providerConfigId,
    modelId: modelConfig.modelId,
    displayName: modelConfig.displayName,
    enabled: modelConfig.enabled,
    supportsWebSearch: modelConfig.supportsWebSearch,
    sortOrder: String(modelConfig.sortOrder)
  };
}

function sortProviderConfigs(providerConfigs: ProviderConfig[]): ProviderConfig[] {
  return [...providerConfigs].sort((left, right) => left.name.localeCompare(right.name));
}

function sortModelConfigs(modelConfigs: ModelConfig[]): ModelConfig[] {
  return [...modelConfigs].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.displayName.localeCompare(right.displayName);
  });
}

function upsertById<TValue extends { id: string }>(items: TValue[], nextItem: TValue): TValue[] {
  const itemExists = items.some((item) => item.id === nextItem.id);

  if (!itemExists) {
    return [...items, nextItem];
  }

  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readErrorMessage(payload: Record<string, unknown> | null, fallbackMessage: string): string {
  if (!payload) {
    return fallbackMessage;
  }

  const error = payload.error;

  return typeof error === "string" && error.trim() !== "" ? error : fallbackMessage;
}
