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
  createNewConversation(): Promise<void>;
  selectConversation(conversationId: string): Promise<void>;
  updateDraft(nextDraft: string): Promise<void>;
  sendMessage(): Promise<void>;
  selectModel(modelId: string): Promise<void>;
};

const ChatWorkspaceContext = createContext<ChatWorkspaceContextValue | null>(null);

export function ChatWorkspaceProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const { messages: i18nMessages } = useI18n();
  const conversationStore = useMemo(() => createBrowserConversationStore(userId), [userId]);
  const preferencesStore = useMemo(() => createBrowserPreferencesStore(userId), [userId]);
  const pendingConversationPromiseRef = useRef<Promise<ChatConversationRecord> | null>(null);

  const [conversations, setConversations] = useState<ChatConversationRecord[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [draft, setDraft] = useState("");
  const [models, setModels] = useState<UserSelectableModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

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
    await createConversationRecord();
  }

  async function selectConversation(conversationId: string) {
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

    if (trimmedDraft === "" || !selectedModelId || isSendingMessage) {
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
    setIsSendingMessage(true);

    try {
      await Promise.all([
        conversationStore.saveConversation(updatedConversation),
        conversationStore.saveMessage(message),
        conversationStore.deleteDraft(conversation.id),
        persistActiveConversation(conversation.id)
      ]);

      const assistantMessage = await streamAssistantMessage({
        assistantMessageId,
        conversationId: conversation.id,
        modelConfigId: selectedModelId,
        messageHistory: [...messages, message],
        setMessages
      });

      if (!assistantMessage) {
        return;
      }

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
    } catch {
      return;
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function selectModel(modelId: string) {
    const nextModelId = models.some((model) => model.id === modelId) ? modelId : null;
    setSelectedModelId(nextModelId);
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
        createNewConversation,
        selectConversation,
        updateDraft,
        sendMessage,
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
  setMessages
}: {
  assistantMessageId: string;
  conversationId: string;
  modelConfigId: string;
  messageHistory: ChatMessageRecord[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageRecord[]>>;
}): Promise<ChatMessageRecord | null> {
  const response = await fetch("/api/chat", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      modelConfigId,
      messages: messageHistory.map((message) => ({
        role: message.role,
        content: message.content
      }))
    })
  });

  if (!response.ok || !response.body) {
    throw new Error("Unable to stream assistant response.");
  }

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
    setMessages((currentMessages) => currentMessages.filter((message) => message.id !== assistantMessageId));
    throw error;
  } finally {
    reader.releaseLock();
  }

  if (content === "") {
    setMessages((currentMessages) => currentMessages.filter((message) => message.id !== assistantMessageId));
    return null;
  }

  const completedAt = new Date().toISOString();
  const assistantMessage: ChatMessageRecord = {
    ...initialAssistantMessage,
    content,
    updatedAt: completedAt
  };

  setMessages((currentMessages) =>
    currentMessages.map((message) => (message.id === assistantMessageId ? assistantMessage : message))
  );

  return assistantMessage;
}

function sortConversations(conversations: ChatConversationRecord[]) {
  return [...conversations].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function upsertConversation(conversations: ChatConversationRecord[], updatedConversation: ChatConversationRecord) {
  const remainingConversations = conversations.filter((conversation) => conversation.id !== updatedConversation.id);
  return [updatedConversation, ...remainingConversations];
}
