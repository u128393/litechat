import {
  Fragment,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  GripVertical,
  Globe,
  Image,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";

import { useI18n } from "@/lib/i18n/context";
import type { AppSettings, ManagedUser, ModelConfig, ProviderConfig, UserRole } from "@/shared/types";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChatWorkspace } from "@/features/chat/chat-workspace-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AdminManagementClientProps = {
  activeSection: AdminSection;
  currentUserId: string;
  initialUsers: ManagedUser[];
  initialProviderConfigs: ProviderConfig[];
  initialModelConfigs: ModelConfig[];
  initialAppSettings: AppSettings;
};

type AdminSection = "users" | "model-config";

type UserFormState = {
  email: string;
  password: string;
  role: UserRole;
  enabled: boolean;
};

type ResetPasswordFormState = {
  password: string;
  confirmPassword: string;
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
  visible: boolean;
  supportsWebSearch: boolean;
  supportsImageGeneration: boolean;
};

type DraggingModelState = {
  modelConfig: ModelConfig;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  width: number;
  x: number;
  y: number;
  insertionIndex: number;
};

const DEFAULT_PROVIDER_FORM: ProviderFormState = {
  name: "",
  providerType: "openai-responses",
  baseUrl: "",
  apiKey: "",
  enabled: true,
};

const DEFAULT_USER_FORM: UserFormState = {
  email: "",
  password: "",
  role: "user",
  enabled: true,
};

const DEFAULT_RESET_PASSWORD_FORM: ResetPasswordFormState = {
  password: "",
  confirmPassword: "",
};

const adminDialogContentClass =
  "gap-0 overflow-hidden border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] p-0";
const adminDialogHeaderClass = "border-b border-[var(--lc-border)] px-4 py-4";
const adminDialogTitleClass =
  "text-[18px] font-semibold text-[var(--lc-text-primary)]";
const adminDialogBodyClass = "flex flex-col gap-5 px-4 py-5";
const adminDialogFormBodyClass = "flex flex-col gap-5 px-4 pt-5 pb-8";
const dragPreviewOffset = 6;
const chatModelTitleGenerationValue = "__litechat_chat_model__";
const randomPasswordCharacterGroups = [
  "0123456789",
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "abcdefghijklmnopqrstuvwxyz",
  "!@#$%^&*_-+=?",
] as const;
const randomPasswordCharacters = randomPasswordCharacterGroups.join("");
const randomPasswordLength = 12;

function createDefaultModelForm(
  providerConfigs: ProviderConfig[],
): ModelFormState {
  return {
    providerConfigId: providerConfigs[0]?.id ?? "",
    modelId: "",
    displayName: "",
    visible: true,
    supportsWebSearch: false,
    supportsImageGeneration: false,
  };
}

export function AdminManagementClient({
  activeSection,
  currentUserId,
  initialUsers,
  initialProviderConfigs,
  initialModelConfigs,
  initialAppSettings,
}: AdminManagementClientProps) {
  const navigate = useNavigate();
  const { refreshModels } = useChatWorkspace();
  const { messages } = useI18n();
  const adminMessages = messages.admin;
  const [users, setUsers] = useState(sortUsers(initialUsers));
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const filteredUsers = useMemo(
    () => filterUsers(users, userSearchQuery),
    [users, userSearchQuery],
  );
  const sortedInitialProviderConfigs = sortProviderConfigs(
    initialProviderConfigs,
  );
  const sortedInitialModelConfigs = sortModelConfigs(initialModelConfigs);
  const providerTypeSelectItems: Record<
    ProviderFormState["providerType"],
    string
  > = {
    "openai-responses": adminMessages.providers.defaultProviderType,
  };

  const [providerConfigs, setProviderConfigs] = useState(
    sortedInitialProviderConfigs,
  );
  const [modelConfigs, setModelConfigs] = useState(sortedInitialModelConfigs);
  const [titleGenerationModelConfigId, setTitleGenerationModelConfigId] = useState(
    initialAppSettings.titleGenerationModelConfigId
  );
  const selectedTitleGenerationModelConfigId = modelConfigs.some(
    (modelConfig) => modelConfig.id === titleGenerationModelConfigId
  )
    ? titleGenerationModelConfigId
    : null;

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userForm, setUserForm] = useState<UserFormState>(DEFAULT_USER_FORM);
  const [userPasswordVisible, setUserPasswordVisible] = useState(false);
  const [userPending, setUserPending] = useState(false);
  const [userFeedback, setUserFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [resettingPasswordUser, setResettingPasswordUser] =
    useState<ManagedUser | null>(null);
  const [resetPasswordForm, setResetPasswordForm] =
    useState<ResetPasswordFormState>(DEFAULT_RESET_PASSWORD_FORM);
  const [resetPasswordPending, setResetPasswordPending] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<ManagedUser | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(
    null,
  );
  const [providerForm, setProviderForm] = useState<ProviderFormState>(
    DEFAULT_PROVIDER_FORM,
  );
  const [providerPending, setProviderPending] = useState(false);
  const [providerFeedback, setProviderFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [providerDeleteDialogOpen, setProviderDeleteDialogOpen] =
    useState(false);
  const [deletingProvider, setDeletingProvider] =
    useState<ProviderConfig | null>(null);
  const [providerDeletePending, setProviderDeletePending] = useState(false);

  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [modelForm, setModelForm] = useState<ModelFormState>(() =>
    createDefaultModelForm(sortedInitialProviderConfigs),
  );
  const [modelPending, setModelPending] = useState(false);
  const [modelFeedback, setModelFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [modelDeleteDialogOpen, setModelDeleteDialogOpen] = useState(false);
  const [deletingModel, setDeletingModel] = useState<ModelConfig | null>(null);
  const [modelDeletePending, setModelDeletePending] = useState(false);
  const [draggingModel, setDraggingModel] = useState<DraggingModelState | null>(
    null,
  );
  const [reorderingModels, setReorderingModels] = useState(false);
  const [updatingTitleGenerationModel, setUpdatingTitleGenerationModel] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [togglingProviderId, setTogglingProviderId] = useState<string | null>(
    null,
  );
  const [togglingModelId, setTogglingModelId] = useState<string | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  function openAddUser() {
    setUserForm(DEFAULT_USER_FORM);
    setUserPasswordVisible(false);
    setUserFeedback(null);
    setUserDialogOpen(true);
  }

  function generateUserPassword() {
    setUserForm((form) => ({ ...form, password: generateRandomPassword() }));
    setUserPasswordVisible(true);
  }

  function openResetPassword(user: ManagedUser) {
    setResettingPasswordUser(user);
    setResetPasswordForm(DEFAULT_RESET_PASSWORD_FORM);
    setUserFeedback(null);
    setResetPasswordDialogOpen(true);
  }

  function openDeleteUser(user: ManagedUser) {
    setDeletingUser(user);
    setUserFeedback(null);
    setDeleteDialogOpen(true);
  }

  async function submitUserForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setUserPending(true);
    setUserFeedback(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(userForm),
      });
      const payload = await readJsonResponse(response);

      if (
        !response.ok ||
        !payload ||
        typeof payload.user !== "object" ||
        payload.user === null
      ) {
        setUserFeedback({
          type: "error",
          message: `${adminMessages.users.errorPrefix} ${readErrorMessage(payload, adminMessages.unexpectedResponse)}`,
        });
        return;
      }

      const nextUser = payload.user as ManagedUser;
      setUsers(sortUsers(upsertById(users, nextUser)));
      setUserDialogOpen(false);
      setUserFeedback({
        type: "success",
        message: adminMessages.users.successCreate,
      });
    } catch {
      setUserFeedback({
        type: "error",
        message: `${adminMessages.users.errorPrefix} ${adminMessages.unexpectedResponse}`,
      });
    } finally {
      setUserPending(false);
    }
  }

  async function toggleUserEnabled(user: ManagedUser) {
    setTogglingUserId(user.id);
    setUserFeedback(null);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !user.enabled }),
      });
      const payload = await readJsonResponse(response);

      if (
        !response.ok ||
        !payload ||
        typeof payload.user !== "object" ||
        payload.user === null
      ) {
        setUserFeedback({
          type: "error",
          message: `${adminMessages.users.errorPrefix} ${readErrorMessage(payload, adminMessages.unexpectedResponse)}`,
        });
        return;
      }

      const nextUser = payload.user as ManagedUser;
      setUsers(sortUsers(upsertById(users, nextUser)));
    } catch {
      setUserFeedback({
        type: "error",
        message: `${adminMessages.users.errorPrefix} ${adminMessages.unexpectedResponse}`,
      });
    } finally {
      setTogglingUserId(null);
    }
  }

  async function submitResetPasswordForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!resettingPasswordUser) {
      return;
    }

    if (resetPasswordForm.password !== resetPasswordForm.confirmPassword) {
      setUserFeedback({
        type: "error",
        message: adminMessages.users.passwordMismatch,
      });
      return;
    }

    setResetPasswordPending(true);
    setUserFeedback(null);

    try {
      const response = await fetch(
        `/api/admin/users/${resettingPasswordUser.id}/password`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password: resetPasswordForm.password }),
        },
      );
      const payload = await readJsonResponse(response);

      if (
        !response.ok ||
        !payload ||
        typeof payload.user !== "object" ||
        payload.user === null
      ) {
        setUserFeedback({
          type: "error",
          message: `${adminMessages.users.errorPrefix} ${readErrorMessage(payload, adminMessages.unexpectedResponse)}`,
        });
        return;
      }

      const nextUser = payload.user as ManagedUser;
      setUsers(sortUsers(upsertById(users, nextUser)));
      setResetPasswordDialogOpen(false);
      setUserFeedback({
        type: "success",
        message: adminMessages.users.successPassword,
      });
    } catch {
      setUserFeedback({
        type: "error",
        message: `${adminMessages.users.errorPrefix} ${adminMessages.unexpectedResponse}`,
      });
    } finally {
      setResetPasswordPending(false);
    }
  }

  async function confirmDeleteUser() {
    if (!deletingUser) {
      return;
    }

    setDeletePending(true);
    setUserFeedback(null);

    try {
      const response = await fetch(`/api/admin/users/${deletingUser.id}`, {
        method: "DELETE",
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        setUserFeedback({
          type: "error",
          message: `${adminMessages.users.errorPrefix} ${readErrorMessage(payload, adminMessages.unexpectedResponse)}`,
        });
        return;
      }

      setUsers(users.filter((user) => user.id !== deletingUser.id));
      setDeleteDialogOpen(false);
      setUserFeedback({
        type: "success",
        message: adminMessages.users.successDelete,
      });
    } catch {
      setUserFeedback({
        type: "error",
        message: `${adminMessages.users.errorPrefix} ${adminMessages.unexpectedResponse}`,
      });
    } finally {
      setDeletePending(false);
    }
  }

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

  function openDeleteProvider(providerConfig: ProviderConfig) {
    setDeletingProvider(providerConfig);
    setProviderFeedback(null);
    setProviderDeleteDialogOpen(true);
  }

  async function toggleProviderEnabled(providerConfig: ProviderConfig) {
    setTogglingProviderId(providerConfig.id);
    try {
      const response = await fetch(
        `/api/admin/provider-configs/${providerConfig.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled: !providerConfig.enabled }),
        },
      );
      const payload = await readJsonResponse(response);
      if (
        !response.ok ||
        !payload ||
        typeof payload.providerConfig !== "object" ||
        payload.providerConfig === null
      ) {
        return;
      }
      const nextProviderConfig = payload.providerConfig as ProviderConfig;
      setProviderConfigs(
        sortProviderConfigs(upsertById(providerConfigs, nextProviderConfig)),
      );
      await refreshModels();
    } catch {
      setProviderFeedback({
        type: "error",
        message: `${adminMessages.providers.errorPrefix} ${adminMessages.unexpectedResponse}`,
      });
    } finally {
      setTogglingProviderId(null);
    }
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
      enabled: providerForm.enabled,
    };

    if (!isEditing || providerForm.apiKey.trim() !== "") {
      requestBody.apiKey = providerForm.apiKey;
    }

    try {
      const response = await fetch(
        isEditing
          ? `/api/admin/provider-configs/${editingProvider!.id}`
          : "/api/admin/provider-configs",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(requestBody),
        },
      );

      const payload = await readJsonResponse(response);

      if (
        !response.ok ||
        !payload ||
        typeof payload.providerConfig !== "object" ||
        payload.providerConfig === null
      ) {
        setProviderPending(false);
        setProviderFeedback({
          type: "error",
          message: `${adminMessages.providers.errorPrefix} ${readErrorMessage(payload, adminMessages.unexpectedResponse)}`,
        });
        return;
      }

      const nextProviderConfig = payload.providerConfig as ProviderConfig;
      const nextProviderConfigs = sortProviderConfigs(
        upsertById(providerConfigs, nextProviderConfig),
      );

      setProviderConfigs(nextProviderConfigs);
      setEditingProvider(nextProviderConfig);
      setProviderForm(createProviderForm(nextProviderConfig));
      setProviderFeedback({
        type: "success",
        message: isEditing
          ? adminMessages.providers.successUpdate
          : adminMessages.providers.successCreate,
      });

      if (modelForm.providerConfigId === "") {
        setModelForm((currentForm) => ({
          ...currentForm,
          providerConfigId: nextProviderConfig.id,
        }));
      }

      setProviderDialogOpen(false);
      await refreshModels();
    } catch {
      setProviderPending(false);
      setProviderFeedback({
        type: "error",
        message: `${adminMessages.providers.errorPrefix} ${adminMessages.unexpectedResponse}`,
      });
      return;
    }

    setProviderPending(false);
  }

  async function confirmDeleteProvider() {
    if (!deletingProvider) {
      return;
    }

    setProviderDeletePending(true);
    setProviderFeedback(null);

    try {
      const response = await fetch(
        `/api/admin/provider-configs/${deletingProvider.id}`,
        {
          method: "DELETE",
        },
      );
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        setProviderFeedback({
          type: "error",
          message: `${adminMessages.providers.errorPrefix} ${readErrorMessage(payload, adminMessages.unexpectedResponse)}`,
        });
        return;
      }

      setProviderConfigs(
        providerConfigs.filter(
          (providerConfig) => providerConfig.id !== deletingProvider.id,
        ),
      );
      setModelConfigs(
        modelConfigs.filter(
          (modelConfig) =>
            modelConfig.providerConfigId !== deletingProvider.id,
        ),
      );
      setProviderDeleteDialogOpen(false);
      setProviderFeedback({
        type: "success",
        message: adminMessages.providers.successDelete,
      });
      await refreshModels();
    } catch {
      setProviderFeedback({
        type: "error",
        message: `${adminMessages.providers.errorPrefix} ${adminMessages.unexpectedResponse}`,
      });
    } finally {
      setProviderDeletePending(false);
    }
  }

  function openAddModel() {
    if (providerConfigs.length === 0) return;
    setEditingModel(null);
    setModelForm(createDefaultModelForm(providerConfigs));
    setModelFeedback(null);
    setModelDialogOpen(true);
  }

  function openDeleteModel(modelConfig: ModelConfig) {
    setDeletingModel(modelConfig);
    setModelFeedback(null);
    setModelDeleteDialogOpen(true);
  }

  function openEditModel(modelConfig: ModelConfig) {
    setEditingModel(modelConfig);
    setModelForm(createModelForm(modelConfig, providerConfigs));
    setModelFeedback(null);
    setModelDialogOpen(true);
  }

  async function toggleModelVisible(modelConfig: ModelConfig) {
    setTogglingModelId(modelConfig.id);
    try {
      const response = await fetch(
        `/api/admin/model-configs/${modelConfig.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ visible: !modelConfig.visible }),
        },
      );
      const payload = await readJsonResponse(response);
      if (
        !response.ok ||
        !payload ||
        typeof payload.modelConfig !== "object" ||
        payload.modelConfig === null
      ) {
        return;
      }
      const nextModelConfig = payload.modelConfig as ModelConfig;
      setModelConfigs(
        sortModelConfigs(upsertById(modelConfigs, nextModelConfig)),
      );
      await refreshModels();
    } catch {
      setModelFeedback({
        type: "error",
        message: `${adminMessages.models.errorPrefix} ${adminMessages.unexpectedResponse}`,
      });
    } finally {
      setTogglingModelId(null);
    }
  }

  async function submitModelForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setModelPending(true);
    setModelFeedback(null);

    const isEditing = editingModel !== null;

    try {
      const response = await fetch(
        isEditing
          ? `/api/admin/model-configs/${editingModel!.id}`
          : "/api/admin/model-configs",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            providerConfigId: modelForm.providerConfigId,
            modelId: modelForm.modelId,
            displayName: modelForm.displayName,
            visible: modelForm.visible,
            supportsWebSearch: modelForm.supportsWebSearch,
            supportsImageGeneration: modelForm.supportsImageGeneration,
          }),
        },
      );

      const payload = await readJsonResponse(response);

      if (
        !response.ok ||
        !payload ||
        typeof payload.modelConfig !== "object" ||
        payload.modelConfig === null
      ) {
        setModelPending(false);
        setModelFeedback({
          type: "error",
          message: `${adminMessages.models.errorPrefix} ${readErrorMessage(payload, adminMessages.unexpectedResponse)}`,
        });
        return;
      }

      const nextModelConfig = payload.modelConfig as ModelConfig;
      const nextModelConfigs = sortModelConfigs(
        upsertById(modelConfigs, nextModelConfig),
      );

      setModelConfigs(nextModelConfigs);
      setEditingModel(nextModelConfig);
      setModelForm(createModelForm(nextModelConfig, providerConfigs));
      setModelFeedback({
        type: "success",
        message: isEditing
          ? adminMessages.models.successUpdate
          : adminMessages.models.successCreate,
      });

      setModelDialogOpen(false);
      await refreshModels();
    } catch {
      setModelPending(false);
      setModelFeedback({
        type: "error",
        message: `${adminMessages.models.errorPrefix} ${adminMessages.unexpectedResponse}`,
      });
      return;
    }

    setModelPending(false);
  }

  async function confirmDeleteModel() {
    if (!deletingModel) {
      return;
    }

    setModelDeletePending(true);
    setModelFeedback(null);

    try {
      const response = await fetch(
        `/api/admin/model-configs/${deletingModel.id}`,
        {
          method: "DELETE",
        },
      );
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        setModelFeedback({
          type: "error",
          message: `${adminMessages.models.errorPrefix} ${readErrorMessage(payload, adminMessages.unexpectedResponse)}`,
        });
        return;
      }

      setModelConfigs(
        modelConfigs.filter((modelConfig) => modelConfig.id !== deletingModel.id),
      );
      setModelDeleteDialogOpen(false);
      setModelFeedback({
        type: "success",
        message: adminMessages.models.successDelete,
      });
      await refreshModels();
    } catch {
      setModelFeedback({
        type: "error",
        message: `${adminMessages.models.errorPrefix} ${adminMessages.unexpectedResponse}`,
      });
    } finally {
      setModelDeletePending(false);
    }
  }

  function handleModelPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    modelConfig: ModelConfig,
  ) {
    if (reorderingModels || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const row = event.currentTarget.closest<HTMLElement>("[data-model-row]");
    const rowRect = row?.getBoundingClientRect();

    if (!rowRect) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingModel({
      modelConfig,
      pointerId: event.pointerId,
      offsetX: event.clientX - rowRect.left,
      offsetY: event.clientY - rowRect.top,
      width: rowRect.width,
      x: event.clientX + dragPreviewOffset,
      y: event.clientY + dragPreviewOffset,
      insertionIndex: modelConfigs.findIndex(
        (currentModelConfig) => currentModelConfig.id === modelConfig.id,
      ),
    });
  }

  function handleModelPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!draggingModel || draggingModel.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDraggingModel((currentDraggingModel) => {
      if (
        !currentDraggingModel ||
        currentDraggingModel.pointerId !== event.pointerId
      ) {
        return currentDraggingModel;
      }

      return {
        ...currentDraggingModel,
        x: event.clientX + dragPreviewOffset,
        y: event.clientY + dragPreviewOffset,
        insertionIndex: getModelInsertionIndex(
          event.clientY,
          currentDraggingModel.modelConfig.id,
        ),
      };
    });
  }

  function handleModelPointerCancel(event: PointerEvent<HTMLButtonElement>) {
    if (!draggingModel || draggingModel.pointerId !== event.pointerId) {
      return;
    }

    setDraggingModel(null);
  }

  async function handleModelPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (
      !draggingModel ||
      draggingModel.pointerId !== event.pointerId ||
      reorderingModels
    ) {
      setDraggingModel(null);
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const sourceModelConfigId = draggingModel.modelConfig.id;
    const nextModelConfigs = moveItemToIndex(
      modelConfigs,
      sourceModelConfigId,
      draggingModel.insertionIndex,
    );
    setDraggingModel(null);

    if (nextModelConfigs === modelConfigs) {
      return;
    }

    const previousModelConfigs = modelConfigs;
    setModelConfigs(applySequentialSortOrders(nextModelConfigs));
    setModelFeedback(null);
    setReorderingModels(true);

    try {
      const response = await fetch("/api/admin/model-configs", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          modelConfigIds: nextModelConfigs.map((modelConfig) => modelConfig.id),
        }),
      });
      const payload = await readJsonResponse(response);

      if (!response.ok || !payload || !Array.isArray(payload.modelConfigs)) {
        setModelConfigs(previousModelConfigs);
        setModelFeedback({
          type: "error",
          message: `${adminMessages.models.errorPrefix} ${readErrorMessage(payload, adminMessages.unexpectedResponse)}`,
        });
        return;
      }

      setModelConfigs(sortModelConfigs(payload.modelConfigs as ModelConfig[]));
      await refreshModels();
    } catch {
      setModelConfigs(previousModelConfigs);
      setModelFeedback({
        type: "error",
        message: `${adminMessages.models.errorPrefix} ${adminMessages.unexpectedResponse}`,
      });
    } finally {
      setReorderingModels(false);
    }
  }

  function getModelInsertionIndex(
    pointerY: number,
    sourceModelConfigId: string,
  ): number {
    const modelRows = Array.from(
      document.querySelectorAll<HTMLElement>("[data-model-row-id]"),
    );

    for (let index = 0; index < modelRows.length; index += 1) {
      const row = modelRows[index];

      if (row.dataset.modelRowId === sourceModelConfigId) {
        continue;
      }

      const rowRect = row.getBoundingClientRect();

      if (pointerY < rowRect.top + rowRect.height / 2) {
        return index;
      }
    }

    return modelRows.length;
  }

  function getProviderName(providerConfigId: string): string {
    return (
      providerConfigs.find((p) => p.id === providerConfigId)?.name ?? "\u2014"
    );
  }

  function getProviderTypeName(
    providerType: ProviderConfig["providerType"],
  ): string {
    return providerTypeSelectItems[providerType] ?? providerType;
  }

  function getProviderModels(providerConfigId: string): ModelConfig[] {
    return modelConfigs.filter(
      (modelConfig) => modelConfig.providerConfigId === providerConfigId,
    );
  }

  async function updateTitleGenerationModelConfig(nextModelConfigId: string | null) {
    if (updatingTitleGenerationModel || nextModelConfigId === selectedTitleGenerationModelConfigId) {
      return;
    }

    const previousModelConfigId = selectedTitleGenerationModelConfigId;

    setTitleGenerationModelConfigId(nextModelConfigId);
    setUpdatingTitleGenerationModel(true);
    setSettingsFeedback(null);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          titleGenerationModelConfigId: nextModelConfigId
        })
      });
      const payload = (await response.json().catch(() => null)) as { settings?: AppSettings } | null;

      if (!response.ok || !payload?.settings) {
        setTitleGenerationModelConfigId(previousModelConfigId);
        setSettingsFeedback({
          type: "error",
          message: `${adminMessages.settings.errorPrefix} ${adminMessages.unexpectedResponse}`
        });
        return;
      }

      setTitleGenerationModelConfigId(payload.settings.titleGenerationModelConfigId);
    } catch {
      setTitleGenerationModelConfigId(previousModelConfigId);
      setSettingsFeedback({
        type: "error",
        message: `${adminMessages.settings.errorPrefix} ${adminMessages.unexpectedResponse}`
      });
    } finally {
      setUpdatingTitleGenerationModel(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--lc-bg-primary)]">
      <div className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-[var(--lc-border)] px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--lc-text-secondary)] transition-colors hover:bg-[var(--lc-bg-secondary)] hover:text-[var(--lc-text-primary)]"
            aria-label={messages.common.back}
          >
            <ArrowLeft className="size-[18px]" />
          </button>
          <h1 className="truncate text-[20px] font-semibold text-[var(--lc-text-primary)]">
            {adminMessages.title}
          </h1>
        </div>
        <div className="flex rounded-lg bg-[var(--lc-bg-secondary)] p-1">
          <AdminSectionButton
            active={activeSection === "users"}
            onClick={() => navigate("/admin/users")}
          >
            {adminMessages.usersNav}
          </AdminSectionButton>
          <AdminSectionButton
            active={activeSection === "model-config"}
            onClick={() => navigate("/admin/models")}
          >
            {adminMessages.modelConfigNav}
          </AdminSectionButton>
        </div>
        <div aria-hidden="true" />
      </div>

      <div className="flex-1 overflow-y-auto px-0 py-8">
        <div className="mx-auto flex max-w-[920px] flex-col gap-8 px-4 sm:px-6">
          {activeSection === "users" ? (
            <>
              {userFeedback && (
                <FeedbackBanner
                  feedback={userFeedback}
                  dismissLabel={messages.common.dismiss}
                  onDismiss={() => setUserFeedback(null)}
                />
              )}
              <div className="flex items-center gap-3">
                <div className="relative min-w-0 flex-1 sm:flex-none sm:w-[280px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--lc-text-tertiary)]" />
                  <Input
                    value={userSearchQuery}
                    onChange={(event) => setUserSearchQuery(event.target.value)}
                    placeholder={adminMessages.users.searchPlaceholder}
                    className="h-9 pl-9"
                  />
                </div>
                <button
                  type="button"
                  onClick={openAddUser}
                  className="ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--lc-accent)] px-3.5 text-[13px] font-medium text-[var(--lc-accent)] transition-colors hover:bg-[var(--lc-accent)]/5"
                >
                  <Plus className="size-3.5" />
                  {adminMessages.users.newAction}
                </button>
              </div>

              <UsersTable
                users={filteredUsers}
                currentUserId={currentUserId}
                adminMessages={adminMessages}
                togglingUserId={togglingUserId}
                onToggleUser={(user) => void toggleUserEnabled(user)}
                onResetPassword={openResetPassword}
                onDeleteUser={openDeleteUser}
              />
            </>
          ) : (
            <>
              {providerFeedback && (
                <FeedbackBanner
                  feedback={providerFeedback}
                  dismissLabel={messages.common.dismiss}
                  onDismiss={() => setProviderFeedback(null)}
                />
              )}
              {modelFeedback && (
                <FeedbackBanner
                  feedback={modelFeedback}
                  dismissLabel={messages.common.dismiss}
                  onDismiss={() => setModelFeedback(null)}
                />
              )}
              {settingsFeedback && (
                <FeedbackBanner
                  feedback={settingsFeedback}
                  dismissLabel={messages.common.dismiss}
                  onDismiss={() => setSettingsFeedback(null)}
                />
              )}

              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-[var(--lc-text-primary)]">
                    {adminMessages.providersNav}
                  </h2>
                  <button
                    type="button"
                    onClick={openAddProvider}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--lc-accent)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--lc-accent)] transition-colors hover:bg-[var(--lc-accent)]/5"
                  >
                    <Plus className="size-3.5" />
                    {adminMessages.providers.newAction}
                  </button>
                </div>

                <div className="overflow-hidden rounded-lg border border-[var(--lc-border)]">
                  <div className="flex items-center bg-[var(--lc-bg-secondary)] px-4 py-2.5">
                    <span className="w-[200px] text-xs font-medium text-[var(--lc-text-secondary)]">
                      {adminMessages.providers.nameLabel}
                    </span>
                    <span className="w-[180px] text-xs font-medium text-[var(--lc-text-secondary)]">
                      {adminMessages.providers.providerTypeLabel}
                    </span>
                    <span className="flex-1 text-xs font-medium text-[var(--lc-text-secondary)]">
                      {adminMessages.providers.baseUrlLabel}
                    </span>
                    <span className="w-[50px]" aria-hidden="true" />
                    <span className="w-20 text-center text-xs font-medium text-[var(--lc-text-secondary)]">
                      {adminMessages.providers.enabledLabel}
                    </span>
                    <span className="w-16 text-center text-xs font-medium text-[var(--lc-text-secondary)]">
                      {adminMessages.actionsLabel}
                    </span>
                  </div>

                  {providerConfigs.length > 0 ? (
                    providerConfigs.map((providerConfig, index) => (
                      <div
                        key={providerConfig.id}
                        role="button"
                        tabIndex={0}
                        className={`flex items-center px-4 py-3 transition-colors hover:bg-[var(--lc-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--lc-accent)] ${
                          index < providerConfigs.length - 1
                            ? "border-b border-[var(--lc-border)]"
                            : ""
                        }`}
                        onClick={() => openEditProvider(providerConfig)}
                        onKeyDown={(event) =>
                          handleRowKeyDown(event, () =>
                            openEditProvider(providerConfig),
                          )
                        }
                      >
                        <span className="w-[200px] text-sm font-medium text-[var(--lc-text-primary)]">
                          {providerConfig.name}
                        </span>
                        <span className="w-[180px]">
                          <TypeBadge
                            type={getProviderTypeName(
                              providerConfig.providerType,
                            )}
                          />
                        </span>
                        <span className="flex-1 text-sm text-[var(--lc-text-secondary)]">
                          {providerConfig.baseUrl ?? adminMessages.defaultValue}
                        </span>
                        <span className="w-[50px]" aria-hidden="true" />
                        <span
                          className="flex w-20 justify-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SwitchToggle
                            checked={providerConfig.enabled}
                            disabled={togglingProviderId === providerConfig.id}
                            onChange={() =>
                              void toggleProviderEnabled(providerConfig)
                            }
                          />
                        </span>
                        <span
                          className="flex w-16 justify-center"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="flex size-8 items-center justify-center rounded-lg text-[var(--lc-text-secondary)] hover:bg-[var(--lc-bg-secondary)] hover:text-[var(--lc-text-primary)]"
                              aria-label={adminMessages.actionsLabel}
                            >
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-40 border border-[var(--lc-border)] bg-[var(--lc-bg-primary)]"
                            >
                              <DropdownMenuItem
                                onClick={() => openEditProvider(providerConfig)}
                              >
                                {adminMessages.providers.editAction}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => openDeleteProvider(providerConfig)}
                              >
                                {adminMessages.providers.deleteAction}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm font-medium text-[var(--lc-text-primary)]">
                        {adminMessages.providers.emptyTitle}
                      </p>
                      <p className="mt-1 text-sm text-[var(--lc-text-secondary)]">
                        {adminMessages.providers.emptyDescription}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-[var(--lc-text-primary)]">
                    {adminMessages.modelsNav}
                  </h2>
                  <button
                    type="button"
                    onClick={openAddModel}
                    disabled={providerConfigs.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--lc-accent)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--lc-accent)] transition-colors hover:bg-[var(--lc-accent)]/5 disabled:opacity-50"
                  >
                    <Plus className="size-3.5" />
                    {adminMessages.models.newAction}
                  </button>
                </div>

                <div className="overflow-hidden rounded-lg border border-[var(--lc-border)]">
                  <div className="flex items-center bg-[var(--lc-bg-secondary)] px-4 py-2.5">
                    <span
                      className="w-8 text-xs font-medium text-[var(--lc-text-secondary)]"
                      aria-hidden="true"
                    />
                    <span className="w-[168px] text-xs font-medium text-[var(--lc-text-secondary)]">
                      {adminMessages.models.displayNameLabel}
                    </span>
                    <span className="w-[180px] text-xs font-medium text-[var(--lc-text-secondary)]">
                      {adminMessages.models.modelIdLabel}
                    </span>
                    <span className="flex-1 text-xs font-medium text-[var(--lc-text-secondary)]">
                      {adminMessages.models.providerLabel}
                    </span>
                    <span className="w-[50px] text-center text-xs font-medium text-[var(--lc-text-secondary)]">
                      {adminMessages.webSearchShortLabel}
                    </span>
                    <span className="w-20 text-center text-xs font-medium text-[var(--lc-text-secondary)]">
                      {adminMessages.models.visibleLabel}
                    </span>
                    <span className="w-16 text-center text-xs font-medium text-[var(--lc-text-secondary)]">
                      {adminMessages.actionsLabel}
                    </span>
                  </div>

                  {modelConfigs.length > 0 ? (
                    <>
                      {modelConfigs.map((modelConfig, index) => (
                        <Fragment key={modelConfig.id}>
                          {draggingModel?.insertionIndex === index ? (
                            <ModelDropIndicator />
                          ) : null}
                          <div
                            data-model-row
                            data-model-row-id={modelConfig.id}
                            role="button"
                            tabIndex={0}
                            className={`flex items-center px-4 py-3 transition-colors hover:bg-[var(--lc-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--lc-accent)] ${
                              index < modelConfigs.length - 1
                                ? "border-b border-[var(--lc-border)]"
                                : ""
                            } ${draggingModel?.modelConfig.id === modelConfig.id ? "opacity-35" : ""}`}
                            onClick={() => openEditModel(modelConfig)}
                            onKeyDown={(event) =>
                              handleRowKeyDown(event, () =>
                                openEditModel(modelConfig),
                              )
                            }
                          >
                            <button
                              type="button"
                              disabled={reorderingModels}
                              onClick={(event) => event.stopPropagation()}
                              onPointerDown={(event) =>
                                handleModelPointerDown(event, modelConfig)
                              }
                              onPointerMove={handleModelPointerMove}
                              onPointerUp={(event) =>
                                void handleModelPointerUp(event)
                              }
                              onPointerCancel={handleModelPointerCancel}
                              className="mr-2 flex size-6 shrink-0 touch-none cursor-grab items-center justify-center rounded-md text-[var(--lc-text-tertiary)] transition-colors hover:bg-[var(--lc-bg-secondary)] hover:text-[var(--lc-text-primary)] active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={adminMessages.models.dragHandleLabel}
                            >
                              <GripVertical className="size-4" />
                            </button>
                            <span className="w-[168px] text-sm font-medium text-[var(--lc-text-primary)]">
                              {modelConfig.displayName}
                            </span>
                            <span className="w-[180px] text-[13px] text-[var(--lc-text-secondary)]">
                              {modelConfig.modelId}
                            </span>
                            <span className="flex-1 text-sm text-[var(--lc-text-primary)]">
                              {getProviderName(modelConfig.providerConfigId)}
                            </span>
                            <span className="flex w-[50px] justify-center">
                              <ModelCapabilityIcons modelConfig={modelConfig} />
                            </span>
                            <span
                              className="flex w-20 justify-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <SwitchToggle
                                checked={modelConfig.visible}
                                disabled={togglingModelId === modelConfig.id}
                                onChange={() =>
                                  void toggleModelVisible(modelConfig)
                                }
                              />
                            </span>
                            <span
                              className="flex w-16 justify-center"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  className="flex size-8 items-center justify-center rounded-lg text-[var(--lc-text-secondary)] hover:bg-[var(--lc-bg-secondary)] hover:text-[var(--lc-text-primary)]"
                                  aria-label={adminMessages.actionsLabel}
                                >
                                  <MoreHorizontal className="size-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="w-40 border border-[var(--lc-border)] bg-[var(--lc-bg-primary)]"
                                >
                                  <DropdownMenuItem
                                    onClick={() => openEditModel(modelConfig)}
                                  >
                                    {adminMessages.models.editAction}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => openDeleteModel(modelConfig)}
                                  >
                                    {adminMessages.models.deleteAction}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </span>
                          </div>
                        </Fragment>
                      ))}
                      {draggingModel?.insertionIndex === modelConfigs.length ? (
                        <ModelDropIndicator />
                      ) : null}
                    </>
                  ) : providerConfigs.length > 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm font-medium text-[var(--lc-text-primary)]">
                        {adminMessages.models.emptyTitle}
                      </p>
                      <p className="mt-1 text-sm text-[var(--lc-text-secondary)]">
                        {adminMessages.models.emptyDescription}
                      </p>
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm font-medium text-[var(--lc-text-primary)]">
                        {adminMessages.models.blockedTitle}
                      </p>
                      <p className="mt-1 text-sm text-[var(--lc-text-secondary)]">
                        {adminMessages.models.blockedDescription}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-[var(--lc-text-primary)]">
                    {adminMessages.settings.titleGenerationTitle}
                  </h2>
                </div>

                <div className="rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] px-4 py-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--lc-text-primary)]">
                        {adminMessages.settings.titleGenerationModelLabel}
                      </p>
                    </div>
                    <div className="w-full shrink-0 sm:w-[280px]">
                      <Select
                        items={toTitleGenerationModelItems(modelConfigs, adminMessages.settings.useChatModel)}
                        value={selectedTitleGenerationModelConfigId ?? chatModelTitleGenerationValue}
                        onValueChange={(value) => {
                          void updateTitleGenerationModelConfig(
                            value === chatModelTitleGenerationValue ? null : value
                          );
                        }}
                        disabled={updatingTitleGenerationModel}
                      >
                        <SelectTrigger className="w-full" id="title-generation-model">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={chatModelTitleGenerationValue}>
                            {adminMessages.settings.useChatModel}
                          </SelectItem>
                          {modelConfigs.map((modelConfig) => (
                            <SelectItem key={modelConfig.id} value={modelConfig.id}>
                              {modelConfig.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      <Dialog
        open={userDialogOpen}
        onOpenChange={(open) => setUserDialogOpen(open)}
      >
        <DialogContent
          className={`${adminDialogContentClass} sm:max-w-[420px]`}
          closeLabel={messages.common.close}
        >
          <DialogHeader className={adminDialogHeaderClass}>
            <DialogTitle className={adminDialogTitleClass}>
              {adminMessages.users.createModeLabel}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitUserForm}>
            <div className={adminDialogFormBodyClass}>
              <FormField id="user-email" label={adminMessages.users.emailLabel}>
                <Input
                  id="user-email"
                  type="email"
                  value={userForm.email}
                  onChange={(event) =>
                    setUserForm((f) => ({ ...f, email: event.target.value }))
                  }
                  required
                />
              </FormField>
              <FormField
                id="user-password"
                label={adminMessages.users.initialPasswordLabel}
              >
                <div className="relative">
                  <Input
                    id="user-password"
                    type={userPasswordVisible ? "text" : "password"}
                    className="pr-14"
                    value={userForm.password}
                    onChange={(event) =>
                      setUserForm((f) => ({
                        ...f,
                        password: event.target.value,
                      }))
                    }
                    minLength={8}
                    required
                  />
                  <Button
                    type="button"
                    variant="link"
                    className="absolute top-1/2 right-3 h-auto -translate-y-1/2 px-0 text-xs active:!-translate-y-1/2"
                    onClick={generateUserPassword}
                    disabled={userPending}
                  >
                    {adminMessages.users.randomPasswordAction}
                  </Button>
                </div>
              </FormField>
              <FormField id="user-role" label={adminMessages.users.roleLabel}>
                <Select
                  items={userRoleSelectItems(adminMessages)}
                  value={userForm.role}
                  onValueChange={(value) =>
                    setUserForm((f) => ({
                      ...f,
                      role: (value ?? "user") as UserRole,
                    }))
                  }
                >
                  <SelectTrigger className="w-full" id="user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">
                      {adminMessages.users.userRole}
                    </SelectItem>
                    <SelectItem value="admin">
                      {adminMessages.users.adminRole}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <AdminDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setUserDialogOpen(false)}
                disabled={userPending}
              >
                {messages.common.cancel}
              </Button>
              <AdminPrimaryButton type="submit" disabled={userPending}>
                {userPending
                  ? adminMessages.users.creatingAction
                  : adminMessages.users.createAction}
              </AdminPrimaryButton>
            </AdminDialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={resetPasswordDialogOpen}
        onOpenChange={(open) => setResetPasswordDialogOpen(open)}
      >
        <DialogContent
          className={`${adminDialogContentClass} sm:max-w-[420px]`}
          closeLabel={messages.common.close}
        >
          <DialogHeader className={adminDialogHeaderClass}>
            <DialogTitle className={adminDialogTitleClass}>
              {adminMessages.users.resetPasswordAction}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitResetPasswordForm}>
            <div className={adminDialogBodyClass}>
              {resettingPasswordUser ? (
                <p className="text-sm font-medium text-[var(--lc-text-primary)]">
                  {resettingPasswordUser.email}
                </p>
              ) : null}
              <FormField
                id="reset-password"
                label={adminMessages.users.newPasswordLabel}
              >
                <Input
                  id="reset-password"
                  type="password"
                  value={resetPasswordForm.password}
                  onChange={(event) =>
                    setResetPasswordForm((f) => ({
                      ...f,
                      password: event.target.value,
                    }))
                  }
                  minLength={8}
                  required
                />
              </FormField>
              <FormField
                id="reset-password-confirm"
                label={adminMessages.users.confirmPasswordLabel}
              >
                <Input
                  id="reset-password-confirm"
                  type="password"
                  value={resetPasswordForm.confirmPassword}
                  onChange={(event) =>
                    setResetPasswordForm((f) => ({
                      ...f,
                      confirmPassword: event.target.value,
                    }))
                  }
                  minLength={8}
                  required
                />
              </FormField>
            </div>
            <AdminDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetPasswordDialogOpen(false)}
                disabled={resetPasswordPending}
              >
                {messages.common.cancel}
              </Button>
              <AdminPrimaryButton type="submit" disabled={resetPasswordPending}>
                {resetPasswordPending
                  ? adminMessages.users.savingAction
                  : adminMessages.users.saveAction}
              </AdminPrimaryButton>
            </AdminDialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => setDeleteDialogOpen(open)}
      >
        <DialogContent
          className={`${adminDialogContentClass} sm:max-w-[400px]`}
          closeLabel={messages.common.close}
        >
          <DialogHeader className={adminDialogHeaderClass}>
            <DialogTitle className={adminDialogTitleClass}>
              {adminMessages.users.deleteTitle}
            </DialogTitle>
          </DialogHeader>
          <div
            className={`${adminDialogBodyClass} text-sm text-[var(--lc-text-primary)]`}
          >
            {deletingUser ? (
              <p className="font-medium">{deletingUser.email}</p>
            ) : null}
            <p className="text-[var(--lc-text-secondary)]">
              {adminMessages.users.deleteDescription}
            </p>
          </div>
          <AdminDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deletePending}
            >
              {messages.common.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDeleteUser()}
              disabled={deletePending}
            >
              {deletePending
                ? adminMessages.users.deletingAction
                : adminMessages.users.deleteAction}
            </Button>
          </AdminDialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={providerDialogOpen}
        onOpenChange={(open) => setProviderDialogOpen(open)}
      >
        <DialogContent
          className={`${adminDialogContentClass} sm:max-w-[520px]`}
          closeLabel={messages.common.close}
        >
          <DialogHeader className={adminDialogHeaderClass}>
            <DialogTitle className={adminDialogTitleClass}>
              {editingProvider
                ? adminMessages.providers.editModeLabel
                : adminMessages.providers.createModeLabel}
            </DialogTitle>
          </DialogHeader>

          <form className="flex flex-col" onSubmit={submitProviderForm}>
            <div className={adminDialogFormBodyClass}>
              <FormField
                id="provider-name"
                label={adminMessages.providers.nameLabel}
              >
                <Input
                  id="provider-name"
                  value={providerForm.name}
                  onChange={(event) =>
                    setProviderForm((f) => ({ ...f, name: event.target.value }))
                  }
                  name="name"
                  required
                />
              </FormField>

              <FormField
                id="provider-type"
                label={adminMessages.providers.providerTypeLabel}
              >
                <Select
                  items={providerTypeSelectItems}
                  value={providerForm.providerType}
                  onValueChange={(value) =>
                    setProviderForm((f) => ({
                      ...f,
                      providerType: value as "openai-responses",
                    }))
                  }
                >
                  <SelectTrigger className="w-full" id="provider-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai-responses">
                      {adminMessages.providers.defaultProviderType}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                id="provider-base-url"
                label={adminMessages.providers.baseUrlLabel}
              >
                <Input
                  id="provider-base-url"
                  value={providerForm.baseUrl}
                  onChange={(event) =>
                    setProviderForm((f) => ({
                      ...f,
                      baseUrl: event.target.value,
                    }))
                  }
                  name="baseUrl"
                  type="url"
                />
              </FormField>

              <FormField
                id="provider-api-key"
                label={adminMessages.providers.apiKeyLabel}
              >
                <Input
                  id="provider-api-key"
                  value={providerForm.apiKey}
                  onChange={(event) =>
                    setProviderForm((f) => ({
                      ...f,
                      apiKey: event.target.value,
                    }))
                  }
                  name="apiKey"
                  type="password"
                  required={!editingProvider}
                />
              </FormField>

              <div className="flex items-center justify-between">
                <Label>{adminMessages.providers.enabledLabel}</Label>
                <SwitchToggle
                  checked={providerForm.enabled}
                  onChange={() =>
                    setProviderForm((f) => ({ ...f, enabled: !f.enabled }))
                  }
                />
              </div>
            </div>

            <AdminDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setProviderDialogOpen(false)}
                disabled={providerPending}
              >
                {messages.common.cancel}
              </Button>
              <AdminPrimaryButton type="submit" disabled={providerPending}>
                {providerPending
                  ? editingProvider
                    ? adminMessages.providers.updatingAction
                    : adminMessages.providers.creatingAction
                  : editingProvider
                    ? adminMessages.providers.updateAction
                    : adminMessages.providers.createAction}
              </AdminPrimaryButton>
            </AdminDialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={modelDialogOpen}
        onOpenChange={(open) => setModelDialogOpen(open)}
      >
        <DialogContent
          className={`${adminDialogContentClass} sm:max-w-[520px]`}
          closeLabel={messages.common.close}
        >
          <DialogHeader className={adminDialogHeaderClass}>
            <DialogTitle className={adminDialogTitleClass}>
              {editingModel
                ? adminMessages.models.editModeLabel
                : adminMessages.models.createModeLabel}
            </DialogTitle>
          </DialogHeader>

          <form className="flex flex-col" onSubmit={submitModelForm}>
            <div className={adminDialogFormBodyClass}>
              <fieldset
                disabled={providerConfigs.length === 0 || modelPending}
                className="contents disabled:opacity-70"
              >
                <FormField
                  id="model-provider"
                  label={adminMessages.models.providerLabel}
                >
                  <Select
                    items={providerConfigs.map((providerConfig) => ({
                      label: providerConfig.name,
                      value: providerConfig.id,
                    }))}
                    value={modelForm.providerConfigId}
                    onValueChange={(value: string | null) =>
                      setModelForm((f) => ({
                        ...f,
                        providerConfigId: value ?? "",
                      }))
                    }
                  >
                    <SelectTrigger className="w-full" id="model-provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providerConfigs.map((providerConfig) => (
                        <SelectItem
                          key={providerConfig.id}
                          value={providerConfig.id}
                        >
                          {providerConfig.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField
                  id="model-id"
                  label={adminMessages.models.modelIdLabel}
                >
                  <Input
                    id="model-id"
                    value={modelForm.modelId}
                    onChange={(event) =>
                      setModelForm((f) => ({
                        ...f,
                        modelId: event.target.value,
                      }))
                    }
                    name="modelId"
                    required
                  />
                </FormField>

                <FormField
                  id="model-display-name"
                  label={adminMessages.models.displayNameLabel}
                >
                  <Input
                    id="model-display-name"
                    value={modelForm.displayName}
                    onChange={(event) =>
                      setModelForm((f) => ({
                        ...f,
                        displayName: event.target.value,
                      }))
                    }
                    name="displayName"
                    required
                  />
                </FormField>

                <div className="flex items-center justify-between">
                  <Label>{adminMessages.models.supportsWebSearchLabel}</Label>
                  <SwitchToggle
                    checked={modelForm.supportsWebSearch}
                    onChange={() =>
                      setModelForm((f) => ({
                        ...f,
                        supportsWebSearch: !f.supportsWebSearch,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>{adminMessages.models.supportsImageGenerationLabel}</Label>
                  <SwitchToggle
                    checked={modelForm.supportsImageGeneration}
                    onChange={() =>
                      setModelForm((f) => ({
                        ...f,
                        supportsImageGeneration: !f.supportsImageGeneration,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>{adminMessages.models.visibleLabel}</Label>
                  <SwitchToggle
                    checked={modelForm.visible}
                    onChange={() =>
                      setModelForm((f) => ({ ...f, visible: !f.visible }))
                    }
                  />
                </div>
              </fieldset>
            </div>

            <AdminDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModelDialogOpen(false)}
                disabled={modelPending}
              >
                {messages.common.cancel}
              </Button>
              <AdminPrimaryButton
                type="submit"
                disabled={providerConfigs.length === 0 || modelPending}
              >
                {modelPending
                  ? editingModel
                    ? adminMessages.models.updatingAction
                    : adminMessages.models.creatingAction
                  : editingModel
                    ? adminMessages.models.updateAction
                    : adminMessages.models.createAction}
              </AdminPrimaryButton>
            </AdminDialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={providerDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!providerDeletePending) {
            setProviderDeleteDialogOpen(open);
          }
        }}
      >
        <DialogContent
          className={`${adminDialogContentClass} sm:max-w-[420px]`}
          closeLabel={messages.common.close}
        >
          <DialogHeader className={adminDialogHeaderClass}>
            <DialogTitle className={adminDialogTitleClass}>
              {adminMessages.providers.deleteTitle}
            </DialogTitle>
          </DialogHeader>
          <div
            className={`${adminDialogBodyClass} text-sm text-[var(--lc-text-primary)]`}
          >
            {deletingProvider ? (
              <>
                <p className="font-medium">
                  {adminMessages.providers.deleteConfirmation.replace(
                    "{provider}",
                    deletingProvider.name,
                  )}
                </p>
                {getProviderModels(deletingProvider.id).length > 0 ? (
                  <p className="text-[var(--lc-text-secondary)]">
                    {adminMessages.providers.deleteAssociatedModelsDescription.replace(
                      "{count}",
                      String(getProviderModels(deletingProvider.id).length),
                    )}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
          <AdminDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setProviderDeleteDialogOpen(false)}
              disabled={providerDeletePending}
            >
              {messages.common.cancel}
            </Button>
            <Button
              type="button"
              className="bg-[var(--lc-danger)] text-white hover:bg-[var(--lc-danger)]/90 hover:text-white focus-visible:border-[var(--lc-danger)]/40 focus-visible:ring-[var(--lc-danger)]/20"
              onClick={() => void confirmDeleteProvider()}
              disabled={providerDeletePending}
            >
              {providerDeletePending
                ? adminMessages.providers.deletingAction
                : adminMessages.providers.deleteAction}
            </Button>
          </AdminDialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={modelDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!modelDeletePending) {
            setModelDeleteDialogOpen(open);
          }
        }}
      >
        <DialogContent
          className={`${adminDialogContentClass} sm:max-w-[420px]`}
          closeLabel={messages.common.close}
        >
          <DialogHeader className={adminDialogHeaderClass}>
            <DialogTitle className={adminDialogTitleClass}>
              {adminMessages.models.deleteTitle}
            </DialogTitle>
          </DialogHeader>
          <div
            className={`${adminDialogBodyClass} text-sm text-[var(--lc-text-primary)]`}
          >
            {deletingModel ? (
              <p className="font-medium">
                {adminMessages.models.deleteConfirmation
                  .replace("{modelName}", deletingModel.displayName)
                  .replace(
                    "{provider}",
                    getProviderName(deletingModel.providerConfigId),
                  )}
              </p>
            ) : null}
          </div>
          <AdminDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModelDeleteDialogOpen(false)}
              disabled={modelDeletePending}
            >
              {messages.common.cancel}
            </Button>
            <Button
              type="button"
              className="bg-[var(--lc-danger)] text-white hover:bg-[var(--lc-danger)]/90 hover:text-white focus-visible:border-[var(--lc-danger)]/40 focus-visible:ring-[var(--lc-danger)]/20"
              onClick={() => void confirmDeleteModel()}
              disabled={modelDeletePending}
            >
              {modelDeletePending
                ? adminMessages.models.deletingAction
                : adminMessages.models.deleteAction}
            </Button>
          </AdminDialogFooter>
        </DialogContent>
      </Dialog>

      {draggingModel ? (
        <ModelDragPreview
          modelConfig={draggingModel.modelConfig}
          providerName={getProviderName(
            draggingModel.modelConfig.providerConfigId,
          )}
          x={draggingModel.x}
          y={draggingModel.y}
          width={draggingModel.width}
        />
      ) : null}
    </div>
  );
}

function AdminSectionButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
        active
          ? "bg-[var(--lc-bg-primary)] text-[var(--lc-text-primary)] shadow-sm"
          : "text-[var(--lc-text-secondary)] hover:text-[var(--lc-text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

function FormField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[6px]">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function AdminDialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end gap-2 border-t border-[var(--lc-border)] bg-[var(--lc-bg-primary)] px-4 py-4">
      {children}
    </div>
  );
}

function AdminPrimaryButton({
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      className="bg-[var(--lc-accent)] text-white hover:bg-[var(--lc-accent)] hover:text-white hover:opacity-90"
      {...props}
    >
      {children}
    </Button>
  );
}

function UsersTable({
  users,
  currentUserId,
  adminMessages,
  togglingUserId,
  onToggleUser,
  onResetPassword,
  onDeleteUser,
}: {
  users: ManagedUser[];
  currentUserId: string;
  adminMessages: ReturnType<typeof useI18n>["messages"]["admin"];
  togglingUserId: string | null;
  onToggleUser: (user: ManagedUser) => void;
  onResetPassword: (user: ManagedUser) => void;
  onDeleteUser: (user: ManagedUser) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--lc-border)]">
      <div className="hidden items-center bg-[var(--lc-bg-secondary)] px-4 py-2.5 sm:flex">
        <span className="flex-1 text-xs font-medium text-[var(--lc-text-secondary)]">
          {adminMessages.users.emailLabel}
        </span>
        <span className="w-[100px] text-xs font-medium text-[var(--lc-text-secondary)]">
          {adminMessages.users.roleLabel}
        </span>
        <span className="w-[100px] text-center text-xs font-medium text-[var(--lc-text-secondary)]">
          {adminMessages.users.statusLabel}
        </span>
        <span className="w-[130px] text-xs font-medium text-[var(--lc-text-secondary)]">
          {adminMessages.users.createdAtLabel}
        </span>
        <span className="w-16 text-center text-xs font-medium text-[var(--lc-text-secondary)]">
          {adminMessages.users.actionsLabel}
        </span>
      </div>
      {users.length > 0 ? (
        users.map((user, index) => (
          <div
            key={user.id}
            className={`flex items-center gap-3 px-4 py-3 sm:gap-0 ${index < users.length - 1 ? "border-b border-[var(--lc-border)]" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--lc-text-primary)]">
                {user.email}
              </p>
              <p className="mt-0.5 text-xs text-[var(--lc-text-secondary)] sm:hidden">
                {formatUserRole(user.role, adminMessages)} ·{" "}
                {formatUserStatus(user.enabled, adminMessages)}
              </p>
            </div>
            <span className="hidden w-[100px] text-sm text-[var(--lc-text-secondary)] sm:block">
              {formatUserRole(user.role, adminMessages)}
            </span>
            <span className="hidden w-[100px] justify-center sm:flex">
              <StatusBadge
                enabled={user.enabled}
                enabledLabel={adminMessages.enabledStatus}
                disabledLabel={adminMessages.disabledStatus}
              />
            </span>
            <span className="hidden w-[130px] text-sm text-[var(--lc-text-secondary)] sm:block">
              {formatDate(user.createdAt)}
            </span>
            <div className="flex w-16 justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex size-8 items-center justify-center rounded-lg text-[var(--lc-text-secondary)] hover:bg-[var(--lc-bg-secondary)] hover:text-[var(--lc-text-primary)]"
                  aria-label={adminMessages.users.actionsLabel}
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-40 border border-[var(--lc-border)] bg-[var(--lc-bg-primary)]"
                >
                  <DropdownMenuItem onClick={() => onResetPassword(user)}>
                    {adminMessages.users.resetPasswordAction}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={
                      user.id === currentUserId || togglingUserId === user.id
                    }
                    onClick={() => onToggleUser(user)}
                  >
                    {user.enabled
                      ? adminMessages.users.disableAction
                      : adminMessages.users.enableAction}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={user.id === currentUserId}
                    onClick={() => onDeleteUser(user)}
                  >
                    {adminMessages.users.deleteAction}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))
      ) : (
        <div className="px-4 py-8 text-center text-sm text-[var(--lc-text-secondary)]">
          {adminMessages.users.emptySearch}
        </div>
      )}
    </div>
  );
}

function SwitchToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-[20px] w-[36px] shrink-0 rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lc-accent)] focus-visible:ring-offset-2 disabled:opacity-50 ${
        checked ? "bg-[var(--lc-accent)]" : "bg-[var(--lc-border)]"
      }`}
    >
      <span
        className={`pointer-events-none block size-[16px] rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-[2px]"
        } mt-[1px]`}
      />
    </button>
  );
}

function ModelDropIndicator() {
  return (
    <div className="relative h-0" aria-hidden="true">
      <div className="absolute left-0 right-0 top-[-1px] z-10 h-0.5 rounded-full bg-[var(--lc-accent)]" />
    </div>
  );
}

function ModelDragPreview({
  modelConfig,
  providerName,
  x,
  y,
  width,
}: {
  modelConfig: ModelConfig;
  providerName: string;
  x: number;
  y: number;
  width: number;
}) {
  return (
    <div
      className="pointer-events-none fixed z-50 flex items-center rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] px-4 py-3 opacity-80 shadow-2xl ring-1 ring-black/5"
      style={{
        left: x,
        top: y,
        width,
      }}
      aria-hidden="true"
    >
      <span className="mr-2 flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--lc-text-tertiary)]">
        <GripVertical className="size-4" />
      </span>
      <span className="w-[150px] truncate text-sm font-medium text-[var(--lc-text-primary)]">
        {modelConfig.displayName}
      </span>
      <span className="w-[180px] truncate text-[13px] text-[var(--lc-text-secondary)]">
        {modelConfig.modelId}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-[var(--lc-text-primary)]">
        {providerName}
      </span>
      <span className="flex w-[50px] justify-center">
        <ModelCapabilityIcons modelConfig={modelConfig} />
      </span>
      <span className="flex w-20 justify-center">
        <span
          className={`relative inline-flex h-[20px] w-[36px] shrink-0 rounded-full border border-transparent ${
            modelConfig.visible
              ? "bg-[var(--lc-accent)]"
              : "bg-[var(--lc-border)]"
          }`}
        >
          <span
            className={`pointer-events-none block size-[16px] rounded-full bg-white shadow-sm ${
              modelConfig.visible ? "translate-x-[18px]" : "translate-x-[2px]"
            } mt-[1px]`}
          />
        </span>
      </span>
      <span className="w-10" />
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-[var(--lc-bg-secondary)] px-2 py-0.5 text-xs font-normal text-[var(--lc-text-secondary)]">
      {type}
    </span>
  );
}

function FeedbackBanner({
  feedback,
  dismissLabel,
  onDismiss,
}: {
  feedback: { type: "success" | "error"; message: string };
  dismissLabel: string;
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
        aria-label={dismissLabel}
      >
        &times;
      </button>
    </div>
  );
}

function handleRowKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  action: () => void,
) {
  if (event.target !== event.currentTarget) {
    return;
  }

  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  action();
}

function createProviderForm(
  providerConfig: ProviderConfig | null,
): ProviderFormState {
  if (!providerConfig) {
    return DEFAULT_PROVIDER_FORM;
  }

  return {
    name: providerConfig.name,
    providerType: providerConfig.providerType,
    baseUrl: providerConfig.baseUrl ?? "",
    apiKey: "",
    enabled: providerConfig.enabled,
  };
}

function createModelForm(
  modelConfig: ModelConfig | null,
  providerConfigs: ProviderConfig[],
): ModelFormState {
  if (!modelConfig) {
    return createDefaultModelForm(providerConfigs);
  }

  return {
    providerConfigId: modelConfig.providerConfigId,
    modelId: modelConfig.modelId,
    displayName: modelConfig.displayName,
    visible: modelConfig.visible,
    supportsWebSearch: modelConfig.supportsWebSearch,
    supportsImageGeneration: modelConfig.supportsImageGeneration,
  };
}

function ModelCapabilityIcons({ modelConfig }: { modelConfig: ModelConfig }) {
  return (
    <span className="flex items-center gap-1">
      {modelConfig.supportsWebSearch ? (
        <Globe className="size-[14px] text-[var(--lc-text-tertiary)]" />
      ) : null}
      {modelConfig.supportsImageGeneration ? (
        <Image className="size-[14px] text-[var(--lc-text-tertiary)]" />
      ) : null}
    </span>
  );
}

function generateRandomPassword(): string {
  const characters = randomPasswordCharacterGroups.map(getRandomCharacter);

  while (characters.length < randomPasswordLength) {
    characters.push(getRandomCharacter(randomPasswordCharacters));
  }

  return shuffleCharacters(characters).join("");
}

function getRandomCharacter(characters: string): string {
  return characters[generateRandomIndex(characters.length)]!;
}

function generateRandomIndex(max: number): number {
  const value = new Uint32Array(1);
  globalThis.crypto.getRandomValues(value);

  return value[0]! % max;
}

function shuffleCharacters(characters: string[]): string[] {
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const randomIndex = generateRandomIndex(index + 1);
    [characters[index], characters[randomIndex]] = [
      characters[randomIndex]!,
      characters[index]!,
    ];
  }

  return characters;
}

function sortProviderConfigs(
  providerConfigs: ProviderConfig[],
): ProviderConfig[] {
  return [...providerConfigs].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function sortModelConfigs(modelConfigs: ModelConfig[]): ModelConfig[] {
  return [...modelConfigs].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.displayName.localeCompare(right.displayName);
  });
}

function sortUsers(users: ManagedUser[]): ManagedUser[] {
  return [...users].sort((left, right) =>
    left.email.localeCompare(right.email),
  );
}

function filterUsers(users: ManagedUser[], query: string): ManagedUser[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return users;
  }

  return users.filter((user) =>
    user.email.toLowerCase().includes(normalizedQuery),
  );
}

function moveItemToIndex<TValue extends { id: string }>(
  items: TValue[],
  sourceId: string,
  insertionIndex: number,
): TValue[] {
  const sourceIndex = items.findIndex((item) => item.id === sourceId);

  if (sourceIndex === -1) {
    return items;
  }

  const nextItems = [...items];
  const [sourceItem] = nextItems.splice(sourceIndex, 1);
  const adjustedInsertionIndex =
    sourceIndex < insertionIndex ? insertionIndex - 1 : insertionIndex;
  const nextInsertionIndex = Math.max(
    0,
    Math.min(adjustedInsertionIndex, nextItems.length),
  );
  nextItems.splice(nextInsertionIndex, 0, sourceItem);

  return nextItems.every((item, index) => item.id === items[index]?.id)
    ? items
    : nextItems;
}

function applySequentialSortOrders(modelConfigs: ModelConfig[]): ModelConfig[] {
  return modelConfigs.map((modelConfig, index) => ({
    ...modelConfig,
    sortOrder: index,
  }));
}

function userRoleSelectItems(
  adminMessages: ReturnType<typeof useI18n>["messages"]["admin"],
) {
  return {
    user: adminMessages.users.userRole,
    admin: adminMessages.users.adminRole,
  };
}

function toTitleGenerationModelItems(modelConfigs: ModelConfig[], useChatModelLabel: string) {
  return {
    [chatModelTitleGenerationValue]: useChatModelLabel,
    ...Object.fromEntries(modelConfigs.map((modelConfig) => [modelConfig.id, modelConfig.displayName]))
  };
}

function formatUserRole(
  role: UserRole,
  adminMessages: ReturnType<typeof useI18n>["messages"]["admin"],
): string {
  return role === "admin"
    ? adminMessages.users.adminRole
    : adminMessages.users.userRole;
}

function formatUserStatus(
  enabled: boolean,
  adminMessages: ReturnType<typeof useI18n>["messages"]["admin"],
): string {
  return enabled ? adminMessages.enabledStatus : adminMessages.disabledStatus;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

function StatusBadge({
  enabled,
  enabledLabel,
  disabledLabel,
}: {
  enabled: boolean;
  enabledLabel: string;
  disabledLabel: string;
}) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
        enabled
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
          : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
      }`}
    >
      {enabled ? enabledLabel : disabledLabel}
    </span>
  );
}

function upsertById<TValue extends { id: string }>(
  items: TValue[],
  nextItem: TValue,
): TValue[] {
  const itemExists = items.some((item) => item.id === nextItem.id);

  if (!itemExists) {
    return [...items, nextItem];
  }

  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}

async function readJsonResponse(
  response: Response,
): Promise<Record<string, unknown> | null> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readErrorMessage(
  payload: Record<string, unknown> | null,
  fallbackMessage: string,
): string {
  if (!payload) {
    return fallbackMessage;
  }

  const error = payload.error;

  return typeof error === "string" && error.trim() !== ""
    ? error
    : fallbackMessage;
}
