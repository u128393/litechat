"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Pencil } from "lucide-react";

import { useI18n } from "@/lib/i18n/provider";
import type { ModelConfig } from "@/server/model-configs";
import type { ProviderConfig } from "@/server/providers";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from "@/components/ui/side-panel";

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
  const router = useRouter();
  const { messages } = useI18n();
  const adminMessages = messages.admin;
  const sortedInitialProviderConfigs = sortProviderConfigs(initialProviderConfigs);
  const sortedInitialModelConfigs = sortModelConfigs(initialModelConfigs);

  const [providerConfigs, setProviderConfigs] = useState(sortedInitialProviderConfigs);
  const [modelConfigs, setModelConfigs] = useState(sortedInitialModelConfigs);

  // Provider dialog state
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null);
  const [providerForm, setProviderForm] = useState<ProviderFormState>(DEFAULT_PROVIDER_FORM);
  const [providerPending, setProviderPending] = useState(false);
  const [providerFeedback, setProviderFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Model dialog state
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [modelForm, setModelForm] = useState<ModelFormState>(() =>
    createDefaultModelForm(sortedInitialProviderConfigs)
  );
  const [modelPending, setModelPending] = useState(false);
  const [modelFeedback, setModelFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // --- Provider handlers ---

  function openAddProvider() {
    setEditingProvider(null);
    setProviderForm(DEFAULT_PROVIDER_FORM);
    setProviderFeedback(null);
    setProviderDialogOpen(true);
  }

  function openEditProvider(providerConfig: ProviderConfig) {
    setEditingProvider(providerConfig);
    setProviderForm(createProviderForm(providerConfig));
    setProviderFeedback(null);
    setProviderDialogOpen(true);
  }

  async function submitProviderForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setProviderPending(true);
    setProviderFeedback(null);

    const isEditing = editingProvider !== null;
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
        isEditing ? `/api/admin/provider-configs/${editingProvider!.id}` : "/api/admin/provider-configs",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
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
      setEditingProvider(nextProviderConfig);
      setProviderForm(createProviderForm(nextProviderConfig));
      setProviderFeedback({
        type: "success",
        message: isEditing ? adminMessages.providers.successUpdate : adminMessages.providers.successCreate
      });

      // Update model form if its provider was just created
      if (modelForm.providerConfigId === "") {
        setModelForm((currentForm) => ({
          ...currentForm,
          providerConfigId: nextProviderConfig.id
        }));
      }

      setProviderDialogOpen(false);
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

  // --- Model handlers ---

  function openAddModel() {
    if (providerConfigs.length === 0) return;
    setEditingModel(null);
    setModelForm(createDefaultModelForm(providerConfigs));
    setModelFeedback(null);
    setModelDialogOpen(true);
  }

  function openEditModel(modelConfig: ModelConfig) {
    setEditingModel(modelConfig);
    setModelForm(createModelForm(modelConfig, providerConfigs));
    setModelFeedback(null);
    setModelDialogOpen(true);
  }

  async function submitModelForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setModelPending(true);
    setModelFeedback(null);

    const isEditing = editingModel !== null;

    try {
      const response = await fetch(
        isEditing ? `/api/admin/model-configs/${editingModel!.id}` : "/api/admin/model-configs",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
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
      setEditingModel(nextModelConfig);
      setModelForm(createModelForm(nextModelConfig, providerConfigs));
      setModelFeedback({
        type: "success",
        message: isEditing ? adminMessages.models.successUpdate : adminMessages.models.successCreate
      });

      setModelDialogOpen(false);
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

  // Helper to get provider name by id (for model table display)
  function getProviderName(providerConfigId: string): string {
    return providerConfigs.find((p) => p.id === providerConfigId)?.name ?? "\u2014";
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--lc-bg-primary)]">
      {/* Top Bar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--lc-border)] px-6">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex size-8 items-center justify-center rounded-lg text-[var(--lc-text-secondary)] transition-colors hover:bg-[var(--lc-bg-secondary)] hover:text-[var(--lc-text-primary)]"
          aria-label="Back"
        >
          <ArrowLeft className="size-[18px]" />
        </button>
        <h1 className="text-[20px] font-semibold text-[var(--lc-text-primary)]">{adminMessages.title}</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-0 py-8">
        <div className="mx-auto flex max-w-[800px] flex-col gap-8">

          {/* Feedback banners */}
          {providerFeedback && (
            <FeedbackBanner feedback={providerFeedback} onDismiss={() => setProviderFeedback(null)} />
          )}
          {modelFeedback && (
            <FeedbackBanner feedback={modelFeedback} onDismiss={() => setModelFeedback(null)} />
          )}

          {/* Providers Section */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--lc-text-primary)]">
                {adminMessages.providersNav}
              </h2>
              <button
                type="button"
                onClick={openAddProvider}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--lc-accent)] px-3.5 py-1.5 text-sm font-medium text-[var(--lc-accent)] transition-colors hover:bg-[var(--lc-accent)]/5"
              >
                <Plus className="size-3.5" />
                {adminMessages.providers.newAction}
              </button>
            </div>

            <div className="overflow-hidden rounded-lg border border-[var(--lc-border)]">
              {/* Table Header */}
              <div className="flex items-center bg-[var(--lc-bg-secondary)] px-4 py-2.5">
                <span className="flex-1 text-xs font-medium text-[var(--lc-text-secondary)]">{adminMessages.providers.nameLabel}</span>
                <span className="flex-1 text-xs font-medium text-[var(--lc-text-secondary)]">{adminMessages.providers.providerTypeLabel}</span>
                <span className="w-24 text-xs font-medium text-[var(--lc-text-secondary)]">Status</span>
                <span className="w-20" />
              </div>

              {/* Table Body */}
              {providerConfigs.length > 0 ? (
                providerConfigs.map((providerConfig, index) => (
                  <div
                    key={providerConfig.id}
                    className={`flex items-center px-4 py-3 ${
                      index < providerConfigs.length - 1 ? "border-b border-[var(--lc-border)]" : ""
                    }`}
                  >
                    <span className="flex-1 text-sm font-medium text-[var(--lc-text-primary)]">
                      {providerConfig.name}
                    </span>
                    <span className="flex-1 text-sm text-[var(--lc-text-secondary)]">
                      {providerConfig.providerType}
                    </span>
                    <span className="w-24">
                      <StatusBadge enabled={providerConfig.enabled} />
                    </span>
                    <span className="flex w-20 justify-end">
                      <button
                        type="button"
                        onClick={() => openEditProvider(providerConfig)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-[var(--lc-text-secondary)] transition-colors hover:bg-[var(--lc-bg-secondary)] hover:text-[var(--lc-text-primary)]"
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </button>
                    </span>
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-medium text-[var(--lc-text-primary)]">{adminMessages.providers.emptyTitle}</p>
                  <p className="mt-1 text-sm text-[var(--lc-text-secondary)]">{adminMessages.providers.emptyDescription}</p>
                </div>
              )}
            </div>
          </section>

          {/* Models Section */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--lc-text-primary)]">
                {adminMessages.modelsNav}
              </h2>
              <button
                type="button"
                onClick={openAddModel}
                disabled={providerConfigs.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--lc-accent)] px-3.5 py-1.5 text-sm font-medium text-[var(--lc-accent)] transition-colors hover:bg-[var(--lc-accent)]/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="size-3.5" />
                {adminMessages.models.newAction}
              </button>
            </div>

            <div className="overflow-hidden rounded-lg border border-[var(--lc-border)]">
              {/* Table Header */}
              <div className="flex items-center bg-[var(--lc-bg-secondary)] px-4 py-2.5">
                <span className="flex-1 text-xs font-medium text-[var(--lc-text-secondary)]">{adminMessages.models.displayNameLabel}</span>
                <span className="flex-1 text-xs font-medium text-[var(--lc-text-secondary)]">{adminMessages.models.modelIdLabel}</span>
                <span className="w-32 text-xs font-medium text-[var(--lc-text-secondary)]">{adminMessages.models.providerLabel}</span>
                <span className="w-24 text-xs font-medium text-[var(--lc-text-secondary)]">Status</span>
                <span className="w-20" />
              </div>

              {/* Table Body */}
              {modelConfigs.length > 0 ? (
                modelConfigs.map((modelConfig, index) => (
                  <div
                    key={modelConfig.id}
                    className={`flex items-center px-4 py-3 ${
                      index < modelConfigs.length - 1 ? "border-b border-[var(--lc-border)]" : ""
                    }`}
                  >
                    <span className="flex-1 text-sm font-medium text-[var(--lc-text-primary)]">
                      {modelConfig.displayName}
                    </span>
                    <span className="flex-1 text-sm text-[var(--lc-text-secondary)]">
                      {modelConfig.modelId}
                    </span>
                    <span className="w-32 text-sm text-[var(--lc-text-secondary)]">
                      {getProviderName(modelConfig.providerConfigId)}
                    </span>
                    <span className="w-24">
                      <StatusBadge enabled={modelConfig.enabled} />
                    </span>
                    <span className="flex w-20 justify-end">
                      <button
                        type="button"
                        onClick={() => openEditModel(modelConfig)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-[var(--lc-text-secondary)] transition-colors hover:bg-[var(--lc-bg-secondary)] hover:text-[var(--lc-text-primary)]"
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </button>
                    </span>
                  </div>
                ))
              ) : providerConfigs.length > 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-medium text-[var(--lc-text-primary)]">{adminMessages.models.emptyTitle}</p>
                  <p className="mt-1 text-sm text-[var(--lc-text-secondary)]">{adminMessages.models.emptyDescription}</p>
                </div>
              ) : (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-medium text-[var(--lc-text-primary)]">{adminMessages.models.blockedTitle}</p>
                  <p className="mt-1 text-sm text-[var(--lc-text-secondary)]">{adminMessages.models.blockedDescription}</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Provider Side Panel */}
      <SidePanel open={providerDialogOpen} onOpenChange={(open) => setProviderDialogOpen(open)}>
        <SidePanelContent>
          <SidePanelHeader>
            <SidePanelTitle>
              {editingProvider ? adminMessages.providers.editModeLabel : adminMessages.providers.createModeLabel}
            </SidePanelTitle>
          </SidePanelHeader>

          <form className="flex flex-col" onSubmit={submitProviderForm}>
            <SidePanelBody className="flex flex-col gap-5">
              <div className="flex flex-col gap-[6px]">
                <Label htmlFor="provider-name">{adminMessages.providers.nameLabel}</Label>
                <Input
                  id="provider-name"
                  value={providerForm.name}
                  onChange={(event) => setProviderForm((f) => ({ ...f, name: event.target.value }))}
                  name="name"
                  required
                />
              </div>

            <div className="flex flex-col gap-[6px]">
              <Label htmlFor="provider-type">{adminMessages.providers.providerTypeLabel}</Label>
              <Select
                value={providerForm.providerType}
                onValueChange={(value) =>
                  setProviderForm((f) => ({ ...f, providerType: value as "openai-responses" }))
                }
              >
                <SelectTrigger className="w-full" id="provider-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai-responses">{adminMessages.providers.defaultProviderType}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-[6px]">
              <Label htmlFor="provider-base-url">{adminMessages.providers.baseUrlLabel}</Label>
              <Input
                id="provider-base-url"
                value={providerForm.baseUrl}
                onChange={(event) => setProviderForm((f) => ({ ...f, baseUrl: event.target.value }))}
                name="baseUrl"
                type="url"
              />
            </div>

            <div className="flex flex-col gap-[6px]">
              <Label htmlFor="provider-api-key">{adminMessages.providers.apiKeyLabel}</Label>
              <Input
                id="provider-api-key"
                value={providerForm.apiKey}
                onChange={(event) => setProviderForm((f) => ({ ...f, apiKey: event.target.value }))}
                name="apiKey"
                type="password"
                required={!editingProvider}
              />
              <p className="text-xs text-[var(--lc-text-secondary)]">
                {editingProvider ? adminMessages.providers.apiKeyUpdateHint : adminMessages.providers.apiKeyCreateHint}
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-[var(--lc-text-primary)]">
              <input
                checked={providerForm.enabled}
                onChange={(event) => setProviderForm((f) => ({ ...f, enabled: event.target.checked }))}
                name="enabled"
                type="checkbox"
                className="size-4 rounded border-[var(--lc-border)] accent-[var(--lc-accent)]"
              />
              {adminMessages.providers.enabledLabel}
            </label>
            </SidePanelBody>

            <SidePanelFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setProviderDialogOpen(false)}
                disabled={providerPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={providerPending}>
                {providerPending
                  ? editingProvider
                    ? adminMessages.providers.updatingAction
                    : adminMessages.providers.creatingAction
                  : editingProvider
                    ? adminMessages.providers.updateAction
                    : adminMessages.providers.createAction}
              </Button>
            </SidePanelFooter>
          </form>
        </SidePanelContent>
      </SidePanel>

      {/* Model Side Panel */}
      <SidePanel open={modelDialogOpen} onOpenChange={(open) => setModelDialogOpen(open)}>
        <SidePanelContent>
          <SidePanelHeader>
            <SidePanelTitle>
              {editingModel ? adminMessages.models.editModeLabel : adminMessages.models.createModeLabel}
            </SidePanelTitle>
          </SidePanelHeader>

          <form className="flex flex-col" onSubmit={submitModelForm}>
            <SidePanelBody className="flex flex-col gap-5">
              <fieldset disabled={providerConfigs.length === 0 || modelPending} className="contents disabled:opacity-70">
              <div className="flex flex-col gap-[6px]">
                <Label htmlFor="model-provider">{adminMessages.models.providerLabel}</Label>
                <Select
                  value={modelForm.providerConfigId}
                  onValueChange={(value: string | null) =>
                    setModelForm((f) => ({ ...f, providerConfigId: value ?? "" }))
                  }
                >
                  <SelectTrigger className="w-full" id="model-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providerConfigs.map((providerConfig) => (
                      <SelectItem key={providerConfig.id} value={providerConfig.id}>
                        {providerConfig.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-[6px]">
                <Label htmlFor="model-id">{adminMessages.models.modelIdLabel}</Label>
                <Input
                  id="model-id"
                  value={modelForm.modelId}
                  onChange={(event) => setModelForm((f) => ({ ...f, modelId: event.target.value }))}
                  name="modelId"
                  required
                />
              </div>

              <div className="flex flex-col gap-[6px]">
                <Label htmlFor="model-display-name">{adminMessages.models.displayNameLabel}</Label>
                <Input
                  id="model-display-name"
                  value={modelForm.displayName}
                  onChange={(event) => setModelForm((f) => ({ ...f, displayName: event.target.value }))}
                  name="displayName"
                  required
                />
              </div>

              <div className="flex flex-col gap-[6px]">
                <Label htmlFor="model-sort-order">{adminMessages.models.sortOrderLabel}</Label>
                <Input
                  id="model-sort-order"
                  value={modelForm.sortOrder}
                  onChange={(event) => setModelForm((f) => ({ ...f, sortOrder: event.target.value }))}
                  name="sortOrder"
                  type="number"
                  step="1"
                  required
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-[var(--lc-text-primary)]">
                <input
                  checked={modelForm.enabled}
                  onChange={(event) => setModelForm((f) => ({ ...f, enabled: event.target.checked }))}
                  name="enabled"
                  type="checkbox"
                  className="size-4 rounded border-[var(--lc-border)] accent-[var(--lc-accent)]"
                />
                {adminMessages.models.enabledLabel}
              </label>

              <label className="flex items-center gap-2 text-sm text-[var(--lc-text-primary)]">
                <input
                  checked={modelForm.supportsWebSearch}
                  onChange={(event) => setModelForm((f) => ({ ...f, supportsWebSearch: event.target.checked }))}
                  name="supportsWebSearch"
                  type="checkbox"
                  className="size-4 rounded border-[var(--lc-border)] accent-[var(--lc-accent)]"
                />
                {adminMessages.models.supportsWebSearchLabel}
              </label>
              </fieldset>
            </SidePanelBody>

            <SidePanelFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModelDialogOpen(false)}
                disabled={modelPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={providerConfigs.length === 0 || modelPending}>
                {modelPending
                  ? editingModel
                    ? adminMessages.models.updatingAction
                    : adminMessages.models.creatingAction
                  : editingModel
                    ? adminMessages.models.updateAction
                    : adminMessages.models.createAction}
              </Button>
            </SidePanelFooter>
          </form>
        </SidePanelContent>
      </SidePanel>
    </div>
  );
}

// --- Shared sub-components ---

function StatusBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <span className="inline-flex items-center rounded-full bg-[var(--lc-success)]/10 px-2 py-0.5 text-xs font-medium text-[var(--lc-success)]">
      {enabled ? "Enabled" : "Disabled"}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-[var(--lc-danger)]/10 px-2 py-0.5 text-xs font-medium text-[var(--lc-danger)]">
      Disabled
    </span>
  );
}

function FeedbackBanner({
  feedback,
  onDismiss,
}: {
  feedback: { type: "success" | "error"; message: string };
  onDismiss: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
        feedback.type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400"
          : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-400"
      }`}
    >
      <span>{feedback.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-2 text-current opacity-60 transition-opacity hover:opacity-100"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}

// --- Pure helper functions ---

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
