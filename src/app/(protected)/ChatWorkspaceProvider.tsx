"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/lib/i18n/provider";
import {
  createBrowserConversationStore,
  type ChatConversationRecord,
  type ChatMessageRecord,
  type ChatDraftRecord
} from "@/lib/chat/local-store";
import { createBrowserPreferencesStore } from "@/lib/preferences";
import type { UserSelectableModel } from "@/server/model-configs/service";

const activeConversationUiStateKey = "activeConversationId";

type ChatFailureState = {
  code: string;
  message: string;
  canRetry: boolean;
};

type ChatRetryState = {
  conversation: ChatConversationRecord;
  updatedConversation: ChatConversationRecord;
  messageHistory: ChatMessageRecord[];
  modelConfigId: string;
};

type ChatWorkspaceContextValue = {
  conversations: ChatConversationRecord[];
  activeConversationId: string | null;
  messages: ChatMessageRecord[];
  draft: string;
  models: UserSelectableModel[];
  selectedModelId: string | null;
  isLoadingWorkspace: boolean;
  isLoadingModels: boolean;
  isSendingMessage: boolean;
  chatError: ChatFailureState | null;
  createNewConversation(): Promise<void>;
  selectConversation(conversationId: string): Promise<void>;
  updateDraft(nextDraft: string): Promise<void>;
  sendMessage(): Promise<void>;
  stopMessage(): void;
  retryMessage(): Promise<void>;
  clearChatError(): void;
  selectModel(modelId: string): Promise<void>;
};

const ChatWorkspaceContext = createContext<ChatWorkspaceContextValue | null>(null);

export function ChatWorkspaceProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const { messages: i18nMessages } = useI18n();
  const conversationStore = useMemo(() => createBrowserConversationStore(userId), [userId]);
  const preferencesStore = useMemo(() => createBrowserPreferencesStore(userId), [userId]);
  const pendingConversationPromiseRef = useRef<Promise<ChatConversationRecord> | null>(null);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const retryStateRef = useRef<ChatRetryState | null>(null);

  const [conversations, setConversations] = useState<ChatConversationRecord[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [draft, setDraft] = useState("");
  const [models, setModels] = useState<UserSelectableModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatError, setChatError] = useState<ChatFailureState | null>(null);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      try {
        const [storedConversations, storedActiveConversation] = await Promise.all([
          conversationStore.listConversations(),
          conversationStore.getUiState<string>(activeConversationUiStateKey)
        ]);

        if (!active) {
          return;
        }

        const nextActiveConversationId = resolveActiveConversationId(
          storedConversations,
          typeof storedActiveConversation?.value === "string" ? storedActiveConversation.value : null
        );

        setConversations(storedConversations);
        setActiveConversationId(nextActiveConversationId);

        if (!nextActiveConversationId) {
          setMessages([]);
          setDraft("");
          return;
        }

        const [storedMessages, storedDraft] = await Promise.all([
          conversationStore.listMessages(nextActiveConversationId),
          conversationStore.getDraft(nextActiveConversationId)
        ]);

        if (!active) {
          return;
        }

        setMessages(storedMessages);
        setDraft(storedDraft?.text ?? "");
      } catch {
        if (!active) {
          return;
        }

        setConversations([]);
        setActiveConversationId(null);
        setMessages([]);
        setDraft("");
      } finally {
        if (active) {
          setIsLoadingWorkspace(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      active = false;
    };
  }, [conversationStore]);

  useEffect(() => {
    let active = true;

    async function loadModels() {
      try {
        const [response, savedModelId] = await Promise.all([
          fetch("/api/models", { credentials: "same-origin" }),
          preferencesStore.getLastSelectedModelConfigId()
        ]);

        if (!response.ok) {
          throw new Error("Unable to load enabled models.");
        }

        const payload = (await response.json()) as { models?: UserSelectableModel[] };
        const nextModels = Array.isArray(payload.models) ? payload.models : [];
        const nextSelectedModelId = resolveSelectedModelId(nextModels, savedModelId);

        if (!active) {
          return;
        }

        setModels(nextModels);
        setSelectedModelId(nextSelectedModelId);

        if (nextSelectedModelId !== savedModelId) {
          void preferencesStore.setLastSelectedModelConfigId(nextSelectedModelId);
        }
      } catch {
        if (!active) {
          return;
        }

        setModels([]);
        setSelectedModelId(null);
      } finally {
        if (active) {
          setIsLoadingModels(false);
        }
      }
    }

    void loadModels();

    return () => {
      active = false;
    };
  }, [preferencesStore]);

  async function loadConversationState(conversationId: string | null) {
    if (!conversationId) {
      setMessages([]);
      setDraft("");
      return;
    }

    const [storedMessages, storedDraft] = await Promise.all([
      conversationStore.listMessages(conversationId),
      conversationStore.getDraft(conversationId)
    ]);

    setMessages(storedMessages);
    setDraft(storedDraft?.text ?? "");
  }

  async function persistActiveConversation(conversationId: string | null) {
    if (!conversationId) {
      await conversationStore.deleteUiState(activeConversationUiStateKey);
      return;
    }

    await conversationStore.saveUiState({
      key: activeConversationUiStateKey,
      value: conversationId,
      updatedAt: new Date().toISOString()
    });
  }

  async function createConversationRecord(initialDraft?: string) {
    const now = new Date().toISOString();
    const conversation: ChatConversationRecord = {
      id: crypto.randomUUID(),
      title: buildConversationTitle(initialDraft, i18nMessages.home.title),
      createdAt: now,
      updatedAt: now
    };

    await conversationStore.saveConversation(conversation);
    await persistActiveConversation(conversation.id);

    if (initialDraft !== undefined && initialDraft !== "") {
      const nextDraft: ChatDraftRecord = {
        conversationId: conversation.id,
        text: initialDraft,
        updatedAt: now
      };

      await conversationStore.saveDraft(nextDraft);
    }

    setConversations((currentConversations) => sortConversations([conversation, ...currentConversations]));
    setActiveConversationId(conversation.id);
    setMessages([]);
    setDraft(initialDraft ?? "");

    return conversation;
  }

  async function ensureConversation(initialDraft?: string) {
    if (activeConversationId) {
      return conversations.find((conversation) => conversation.id === activeConversationId) ?? {
        id: activeConversationId,
        title: i18nMessages.home.title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    if (!pendingConversationPromiseRef.current) {
      pendingConversationPromiseRef.current = createConversationRecord(initialDraft).finally(() => {
        pendingConversationPromiseRef.current = null;
      });
    }

    return pendingConversationPromiseRef.current;
  }

  async function createNewConversation() {
    if (isSendingMessage) {
      return;
    }

    setChatError(null);
    await createConversationRecord();
  }

  async function selectConversation(conversationId: string) {
    if (isSendingMessage) {
      return;
    }

    setChatError(null);
    setActiveConversationId(conversationId);

    try {
      await Promise.all([persistActiveConversation(conversationId), loadConversationState(conversationId)]);
    } catch {
      setMessages([]);
      setDraft("");
    }
  }

  async function updateDraft(nextDraft: string) {
    setDraft(nextDraft);

    let conversationId = activeConversationId;

    if (!conversationId && nextDraft.trim() !== "") {
      conversationId = (await ensureConversation(nextDraft)).id;
    }

    if (!conversationId) {
      return;
    }

    const now = new Date().toISOString();

    try {
      const currentConversation = conversations.find((conversation) => conversation.id === conversationId);

      if (nextDraft === "") {
        await conversationStore.deleteDraft(conversationId);
      } else {
        await conversationStore.saveDraft({
          conversationId,
          text: nextDraft,
          updatedAt: now
        });
      }

      if (currentConversation) {
        await conversationStore.saveConversation({
          ...currentConversation,
          updatedAt: now
        });
      }

      setConversations((currentConversations) =>
        sortConversations(
          currentConversations.map((conversation) =>
            conversation.id === conversationId ? { ...conversation, updatedAt: now } : conversation
          )
        )
      );
    } catch {
      return;
    }
  }

  async function sendMessage() {
    const trimmedDraft = draft.trim();

    if (trimmedDraft === "" || isSendingMessage) {
      return;
    }

    if (!selectedModelId) {
      setChatError({
        code: "model_missing",
        message: i18nMessages.home.errorModelMissing,
        canRetry: false
      });
      return;
    }

    const conversation = await ensureConversation(trimmedDraft);
    const now = new Date().toISOString();
    const message: ChatMessageRecord = {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      role: "user",
      content: trimmedDraft,
      createdAt: now,
      updatedAt: now
    };
    const updatedConversation: ChatConversationRecord = {
      ...conversation,
      title: messages.length === 0 ? buildConversationTitle(trimmedDraft, i18nMessages.home.title) : conversation.title,
      updatedAt: now
    };
    const assistantMessageId = crypto.randomUUID();

    setMessages((currentMessages) => [...currentMessages, message]);
    setDraft("");
    setConversations((currentConversations) =>
      sortConversations(upsertConversation(currentConversations, updatedConversation))
    );
    retryStateRef.current = {
      conversation,
      updatedConversation,
      messageHistory: [...messages, message],
      modelConfigId: selectedModelId
    };

    try {
      await Promise.all([
        conversationStore.saveConversation(updatedConversation),
        conversationStore.saveMessage(message),
        conversationStore.deleteDraft(conversation.id),
        persistActiveConversation(conversation.id)
      ]);

      await continueAssistantResponse({
        assistantMessageId,
        conversation,
        updatedConversation,
        modelConfigId: selectedModelId,
        messageHistory: [...messages, message]
      });
    } catch {
      setChatError({
        code: "unknown",
        message: i18nMessages.home.errorUnknown,
        canRetry: true
      });
      return;
    }
  }

  function stopMessage() {
    activeAbortControllerRef.current?.abort();
  }

  async function retryMessage() {
    if (isSendingMessage || !retryStateRef.current) {
      return;
    }

    const retryState = retryStateRef.current;

    setActiveConversationId(retryState.conversation.id);
    setChatError(null);

    try {
      await Promise.all([persistActiveConversation(retryState.conversation.id), loadConversationState(retryState.conversation.id)]);
      await continueAssistantResponse({
        assistantMessageId: crypto.randomUUID(),
        conversation: retryState.conversation,
        updatedConversation: retryState.updatedConversation,
        modelConfigId: retryState.modelConfigId,
        messageHistory: retryState.messageHistory
      });
    } catch {
      setChatError({
        code: "unknown",
        message: i18nMessages.home.errorUnknown,
        canRetry: true
      });
    }
  }

  function clearChatError() {
    setChatError(null);
  }

  async function continueAssistantResponse({
    assistantMessageId,
    conversation,
    updatedConversation,
    modelConfigId,
    messageHistory
  }: {
    assistantMessageId: string;
    conversation: ChatConversationRecord;
    updatedConversation: ChatConversationRecord;
    modelConfigId: string;
    messageHistory: ChatMessageRecord[];
  }) {
    setChatError(null);
    setIsSendingMessage(true);

    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;

    try {
      let streamResult:
        | Awaited<ReturnType<typeof streamAssistantMessage>>
        | null = null;

      try {
        streamResult = await streamAssistantMessage({
          assistantMessageId,
          conversationId: conversation.id,
          modelConfigId,
          messageHistory,
          signal: abortController.signal,
          setMessages
        });
      } catch (error) {
        setChatError(resolveChatFailure(error, i18nMessages.home));
        return;
      }

      if (streamResult.assistantMessage) {
        await persistAssistantMessage(updatedConversation, streamResult.assistantMessage);
      }

      if (streamResult.status === "success") {
        retryStateRef.current = null;
        return;
      }

      if (streamResult.status === "aborted") {
        setChatError({
          code: "aborted",
          message: i18nMessages.home.stopped,
          canRetry: true
        });
        return;
      }

      if (streamResult.status === "empty") {
        setChatError({
          code: "empty",
          message: i18nMessages.home.errorInterrupted,
          canRetry: true
        });
        return;
      }

      setChatError(resolveChatFailure(streamResult.error, i18nMessages.home));
    } finally {
      if (activeAbortControllerRef.current === abortController) {
        activeAbortControllerRef.current = null;
      }

      setIsSendingMessage(false);
    }
  }

  async function persistAssistantMessage(updatedConversation: ChatConversationRecord, assistantMessage: ChatMessageRecord) {
    await Promise.all([
      conversationStore.saveMessage(assistantMessage),
      conversationStore.saveConversation({
        ...updatedConversation,
        updatedAt: assistantMessage.updatedAt
      })
    ]);

    setConversations((currentConversations) =>
      sortConversations(
        upsertConversation(currentConversations, {
          ...updatedConversation,
          updatedAt: assistantMessage.updatedAt
        })
      )
    );
  }

  async function selectModel(modelId: string) {
    const nextModelId = models.some((model) => model.id === modelId) ? modelId : null;
    setSelectedModelId(nextModelId);
    setChatError(null);
    await preferencesStore.setLastSelectedModelConfigId(nextModelId);
  }

  return (
    <ChatWorkspaceContext.Provider
      value={{
        conversations,
        activeConversationId,
        messages,
        draft,
        models,
        selectedModelId,
        isLoadingWorkspace,
        isLoadingModels,
        isSendingMessage,
        chatError,
        createNewConversation,
        selectConversation,
        updateDraft,
        sendMessage,
        stopMessage,
        retryMessage,
        clearChatError,
        selectModel
      }}
    >
      {children}
    </ChatWorkspaceContext.Provider>
  );
}

export function useChatWorkspace() {
  const contextValue = useContext(ChatWorkspaceContext);

  if (!contextValue) {
    throw new Error("useChatWorkspace must be used within ChatWorkspaceProvider.");
  }

  return contextValue;
}

function resolveActiveConversationId(conversations: ChatConversationRecord[], storedConversationId: string | null) {
  if (storedConversationId && conversations.some((conversation) => conversation.id === storedConversationId)) {
    return storedConversationId;
  }

  return conversations[0]?.id ?? null;
}

function resolveSelectedModelId(models: UserSelectableModel[], storedModelId: string | null) {
  if (storedModelId && models.some((model) => model.id === storedModelId)) {
    return storedModelId;
  }

  return models[0]?.id ?? null;
}

function buildConversationTitle(text: string | undefined, fallbackTitle: string) {
  const normalized = text?.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return fallbackTitle;
  }

  return normalized.slice(0, 60);
}

async function streamAssistantMessage({
  assistantMessageId,
  conversationId,
  modelConfigId,
  messageHistory,
  signal,
  setMessages
}: {
  assistantMessageId: string;
  conversationId: string;
  modelConfigId: string;
  messageHistory: ChatMessageRecord[];
  signal: AbortSignal;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageRecord[]>>;
}): Promise<
  | { status: "success"; assistantMessage: ChatMessageRecord }
  | { status: "aborted"; assistantMessage: ChatMessageRecord | null }
  | { status: "empty"; assistantMessage: null }
  | { status: "failed"; assistantMessage: ChatMessageRecord | null; error: unknown }
> {
  const createdAt = new Date().toISOString();
  const initialAssistantMessage: ChatMessageRecord = {
    id: assistantMessageId,
    conversationId,
    role: "assistant",
    content: "",
    createdAt,
    updatedAt: createdAt
  };

  setMessages((currentMessages) => [...currentMessages, initialAssistantMessage]);

  const response = await fetch("/api/chat", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json"
    },
    signal,
    body: JSON.stringify({
      modelConfigId,
      messages: messageHistory.map((message) => ({
        role: message.role,
        content: message.content
      }))
    })
  });

  if (!response.ok || !response.body) {
    setMessages((currentMessages) => currentMessages.filter((message) => message.id !== assistantMessageId));
    throw await createChatRequestError(response);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let content = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      content += decoder.decode(value, { stream: true });
      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                content,
                updatedAt: new Date().toISOString()
              }
            : message
        )
      );
    }

    content += decoder.decode();
  } catch (error) {
    const assistantMessage = finalizeAssistantMessage(initialAssistantMessage, content);

    if (isAbortError(error)) {
      if (!assistantMessage) {
        setMessages((currentMessages) => currentMessages.filter((message) => message.id !== assistantMessageId));
      } else {
        setMessages((currentMessages) =>
          currentMessages.map((message) => (message.id === assistantMessageId ? assistantMessage : message))
        );
      }

      return { status: "aborted", assistantMessage };
    }

    if (!assistantMessage) {
      setMessages((currentMessages) => currentMessages.filter((message) => message.id !== assistantMessageId));
    } else {
      setMessages((currentMessages) =>
        currentMessages.map((message) => (message.id === assistantMessageId ? assistantMessage : message))
      );
    }

    return { status: "failed", assistantMessage, error };
  } finally {
    reader.releaseLock();
  }

  if (content === "") {
    setMessages((currentMessages) => currentMessages.filter((message) => message.id !== assistantMessageId));
    return { status: "empty", assistantMessage: null };
  }

  const assistantMessage = finalizeAssistantMessage(initialAssistantMessage, content);

  if (!assistantMessage) {
    return { status: "empty", assistantMessage: null };
  }

  setMessages((currentMessages) =>
    currentMessages.map((message) => (message.id === assistantMessageId ? assistantMessage : message))
  );

  return { status: "success", assistantMessage };
}

async function createChatRequestError(response: Response) {
  let payload: { error?: unknown; code?: unknown } | null = null;

  try {
    payload = (await response.json()) as { error?: unknown; code?: unknown };
  } catch {
    payload = null;
  }

  const message = typeof payload?.error === "string" && payload.error.trim() !== "" ? payload.error : "Request failed.";
  const code = typeof payload?.code === "string" && payload.code.trim() !== "" ? payload.code : "unknown";

  return new ChatRequestError(code, message);
}

function finalizeAssistantMessage(initialAssistantMessage: ChatMessageRecord, content: string) {
  if (content === "") {
    return null;
  }

  return {
    ...initialAssistantMessage,
    content,
    updatedAt: new Date().toISOString()
  } satisfies ChatMessageRecord;
}

function resolveChatFailure(error: unknown, homeMessages: ReturnType<typeof useI18n>["messages"]["home"]): ChatFailureState {
  if (error instanceof ChatRequestError) {
    switch (error.code) {
      case "invalid_request":
        return { code: error.code, message: homeMessages.errorValidation, canRetry: true };
      case "model_config_not_found":
      case "provider_config_not_found":
      case "model_not_available":
      case "provider_not_available":
      case "unsupported_provider":
        return { code: error.code, message: homeMessages.errorModelUnavailable, canRetry: false };
      case "upstream_request_failed":
      case "upstream_response_invalid":
      case "upstream_stream_failed":
        return { code: error.code, message: homeMessages.errorUpstream, canRetry: true };
      default:
        return { code: error.code, message: error.message || homeMessages.errorUnknown, canRetry: true };
    }
  }

  if (isAbortError(error)) {
    return { code: "aborted", message: homeMessages.stopped, canRetry: true };
  }

  return { code: "unknown", message: homeMessages.errorInterrupted, canRetry: true };
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

class ChatRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ChatRequestError";
    this.code = code;
  }
}

function sortConversations(conversations: ChatConversationRecord[]) {
  return [...conversations].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function upsertConversation(conversations: ChatConversationRecord[], updatedConversation: ChatConversationRecord) {
  const remainingConversations = conversations.filter((conversation) => conversation.id !== updatedConversation.id);
  return [updatedConversation, ...remainingConversations];
}
