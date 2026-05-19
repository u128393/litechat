"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useI18n } from "@/lib/i18n/provider";
import {
  createBrowserConversationStore,
  type ChatConversationPageCursor,
  type ChatConversationRecord,
  type ChatMessageRecord
} from "@/lib/chat/local-store";
import { createBrowserPreferencesStore } from "@/lib/preferences";
import type { UserSelectableModel } from "@/server/model-configs/service";

const conversationPageSize = 25;
const conversationWindowNewerSize = 12;
const conversationWindowOlderSize = 12;

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

export type ChatSearchResult = {
  conversation: ChatConversationRecord;
  matchedText: string | null;
  matchedAt: string;
};

type SearchConversationsOptions = {
  query: string;
  signal: AbortSignal;
  onResult: (result: ChatSearchResult) => void;
};

type SelectConversationSource = "sidebar" | "search";

type ConversationRevealRequest = {
  conversationId: string;
  token: number;
};

const searchConversationPageSize = 25;

type ChatWorkspaceContextValue = {
  conversations: ChatConversationRecord[];
  activeConversationId: string | null;
  messages: ChatMessageRecord[];
  draft: string;
  models: UserSelectableModel[];
  selectedModelId: string | null;
  hasLoadedConversations: boolean;
  hasOlderConversations: boolean;
  hasNewerConversations: boolean;
  isLoadingOlderConversations: boolean;
  isLoadingNewerConversations: boolean;
  isLoadingModels: boolean;
  isSendingMessage: boolean;
  hasSendingMessage: boolean;
  sendingConversationIds: string[];
  chatError: ChatFailureState | null;
  activeConversationRevealRequest: ConversationRevealRequest | null;
  composerFocusRequestToken: number;
  createNewConversation(): Promise<void>;
  selectConversation(conversationId: string, options?: { source?: SelectConversationSource }): Promise<void>;
  updateDraft(nextDraft: string): Promise<void>;
  sendMessage(): Promise<void>;
  stopMessage(): void;
  retryMessage(): Promise<void>;
  regenerateMessage(messageId: string): Promise<void>;
  clearChatError(): void;
  deleteConversation(conversationId: string): Promise<void>;
  selectModel(modelId: string): Promise<void>;
  refreshModels(): Promise<void>;
  loadOlderConversations(): Promise<void>;
  loadNewerConversations(): Promise<void>;
  listRecentConversations(limit: number): Promise<ChatConversationRecord[]>;
  searchConversations(options: SearchConversationsOptions): Promise<void>;
};

const ChatWorkspaceContext = createContext<ChatWorkspaceContextValue | null>(null);

export function ChatWorkspaceProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const { messages: i18nMessages } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const conversationStore = useMemo(() => createBrowserConversationStore(userId), [userId]);
  const preferencesStore = useMemo(() => createBrowserPreferencesStore(userId), [userId]);
  const pendingConversationPromiseRef = useRef<Promise<ChatConversationRecord> | null>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const retryStatesRef = useRef<Map<string, ChatRetryState>>(new Map());
  const activeConversationIdRef = useRef<string | null>(null);
  const olderConversationCursorRef = useRef<ChatConversationPageCursor | null>(null);
  const newerConversationCursorRef = useRef<ChatConversationPageCursor | null>(null);
  const skippedRouteConversationLoadRef = useRef<string | null>(null);
  const pendingConversationSelectionSourceRef = useRef<SelectConversationSource | null>(null);
  const isLoadingOlderConversationsRef = useRef(false);
  const isLoadingNewerConversationsRef = useRef(false);
  const routeConversationId = useMemo(() => getConversationIdFromPathname(pathname), [pathname]);

  const [conversations, setConversations] = useState<ChatConversationRecord[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [draft, setDraft] = useState("");
  const [models, setModels] = useState<UserSelectableModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [hasLoadedConversations, setHasLoadedConversations] = useState(false);
  const [hasOlderConversations, setHasOlderConversations] = useState(false);
  const [hasNewerConversations, setHasNewerConversations] = useState(false);
  const [isLoadingOlderConversations, setIsLoadingOlderConversations] = useState(false);
  const [isLoadingNewerConversations, setIsLoadingNewerConversations] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [sendingConversationIds, setSendingConversationIds] = useState<string[]>([]);
  const [chatErrorsByConversationId, setChatErrorsByConversationId] = useState<Record<string, ChatFailureState>>({});
  const [activeConversationRevealRequest, setActiveConversationRevealRequest] = useState<ConversationRevealRequest | null>(null);
  const [composerFocusRequestToken, setComposerFocusRequestToken] = useState(1);
  const hasSendingMessage = sendingConversationIds.length > 0;
  const isSendingMessage = activeConversationId !== null && sendingConversationIds.includes(activeConversationId);
  const chatError = chatErrorsByConversationId[getChatErrorKey(activeConversationId)] ?? null;

  activeConversationIdRef.current = activeConversationId;

  function requestComposerFocus() {
    setComposerFocusRequestToken((currentToken) => currentToken + 1);
  }

  function setActiveConversation(conversationId: string | null) {
    activeConversationIdRef.current = conversationId;
    setActiveConversationId(conversationId);
  }

  function clearChatErrorForConversation(conversationId: string | null) {
    setChatErrorsByConversationId((currentErrors) => {
      const errorKey = getChatErrorKey(conversationId);

      if (!currentErrors[errorKey]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[errorKey];
      return nextErrors;
    });
  }

  function setChatErrorForConversation(conversationId: string | null, failure: ChatFailureState) {
    setChatErrorsByConversationId((currentErrors) => ({
      ...currentErrors,
      [getChatErrorKey(conversationId)]: failure
    }));
  }

  function updateActiveConversationMessages(
    conversationId: string,
    updater: SetStateAction<ChatMessageRecord[]>
  ) {
    setMessages((currentMessages) => {
      if (activeConversationIdRef.current !== conversationId) {
        return currentMessages;
      }

      return typeof updater === "function"
        ? (updater as (messages: ChatMessageRecord[]) => ChatMessageRecord[])(currentMessages)
        : updater;
    });
  }

  function isConversationSending(conversationId: string | null) {
    return Boolean(conversationId && abortControllersRef.current.has(conversationId));
  }

  function addSendingConversation(conversationId: string) {
    setSendingConversationIds((currentIds) =>
      currentIds.includes(conversationId) ? currentIds : [...currentIds, conversationId]
    );
  }

  function removeSendingConversation(conversationId: string) {
    setSendingConversationIds((currentIds) => currentIds.filter((currentId) => currentId !== conversationId));
  }

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      try {
        const targetConversationId = routeConversationId;
        const selectionSource = pendingConversationSelectionSourceRef.current;
        pendingConversationSelectionSourceRef.current = null;

        if (!targetConversationId) {
          const page = await conversationStore.listOlderConversationsPage({ limit: conversationPageSize });

          if (!active) {
            return;
          }

          olderConversationCursorRef.current = page.nextCursor;
          newerConversationCursorRef.current = null;
          setConversations(page.items);
          setHasOlderConversations(Boolean(page.nextCursor));
          setHasNewerConversations(false);
          setActiveConversation(null);
          setMessages([]);
          setDraft("");
          clearChatErrorForConversation(null);
          setHasLoadedConversations(true);
          return;
        }

        if (skippedRouteConversationLoadRef.current === targetConversationId) {
          skippedRouteConversationLoadRef.current = null;
          setActiveConversation(targetConversationId);
          setHasLoadedConversations(true);
          return;
        }

        if (
          selectionSource === "sidebar" &&
          conversations.some((conversation) => conversation.id === targetConversationId)
        ) {
          const [storedMessages, storedDraft] = await Promise.all([
            conversationStore.listMessages(targetConversationId),
            conversationStore.getDraft(targetConversationId)
          ]);

          if (!active) {
            return;
          }

          setActiveConversation(targetConversationId);
          setMessages(storedMessages);
          setDraft(storedDraft?.text ?? "");
          clearChatErrorForConversation(targetConversationId);
          setHasLoadedConversations(true);
          return;
        }

        const window = await conversationStore.listConversationWindow({
          conversationId: targetConversationId,
          newerLimit: conversationWindowNewerSize,
          olderLimit: conversationWindowOlderSize
        });

        if (!active) {
          return;
        }

        if (!window) {
          olderConversationCursorRef.current = null;
          newerConversationCursorRef.current = null;
          setConversations([]);
          setHasOlderConversations(false);
          setHasNewerConversations(false);
          setActiveConversation(null);
          setMessages([]);
          setDraft("");
          setHasLoadedConversations(true);
          router.replace("/");
          return;
        }

        const [storedMessages, storedDraft] = await Promise.all([
          conversationStore.listMessages(targetConversationId),
          conversationStore.getDraft(targetConversationId)
        ]);

        const expandedWindow = await expandConversationWindowToMinimum({
          items: window.items,
          newerCursor: window.newerCursor,
          olderCursor: window.olderCursor,
          minimumCount: conversationPageSize
        });

        if (!active) {
          return;
        }

        olderConversationCursorRef.current = expandedWindow.olderCursor;
        newerConversationCursorRef.current = expandedWindow.newerCursor;
        setConversations(expandedWindow.items);
        setHasOlderConversations(Boolean(expandedWindow.olderCursor));
        setHasNewerConversations(Boolean(expandedWindow.newerCursor));
        setActiveConversation(targetConversationId);
        setMessages(storedMessages);
        setDraft(storedDraft?.text ?? "");
        clearChatErrorForConversation(targetConversationId);
        setHasLoadedConversations(true);
        setActiveConversationRevealRequest({
          conversationId: targetConversationId,
          token: Date.now()
        });
      } catch {
        if (!active) {
          return;
        }

        setConversations([]);
        setActiveConversation(null);
        setMessages([]);
        setDraft("");
        setHasOlderConversations(false);
        setHasNewerConversations(false);
        olderConversationCursorRef.current = null;
        newerConversationCursorRef.current = null;
        setHasLoadedConversations(true);
      }
    }

    void loadWorkspace();

    return () => {
      active = false;
    };
  }, [conversationStore, routeConversationId, router]);

  useEffect(() => {
    void refreshModels();
  }, [preferencesStore]);

  async function refreshModels() {
    setIsLoadingModels(true);

    try {
      const [response, savedModelId] = await Promise.all([
        fetch("/api/models", { credentials: "same-origin" }),
        preferencesStore.getLastSelectedModelConfigId()
      ]);

      if (!response.ok) {
        throw new Error("Unable to load available models.");
      }

      const payload = (await response.json()) as { models?: UserSelectableModel[] };
      const nextModels = Array.isArray(payload.models) ? payload.models : [];
      const nextSelectedModelId = resolveSelectedModelId(nextModels, savedModelId);

      setModels(nextModels);
      setSelectedModelId(nextSelectedModelId);

      if (nextSelectedModelId !== savedModelId) {
        void preferencesStore.setLastSelectedModelConfigId(nextSelectedModelId);
      }
    } catch {
      setModels([]);
      setSelectedModelId(null);
    } finally {
      setIsLoadingModels(false);
    }
  }

  async function loadConversationState(conversationId: string | null) {
    if (!conversationId) {
      setActiveConversation(null);
      setMessages([]);
      setDraft("");
      return;
    }

    const [storedMessages, storedDraft] = await Promise.all([
      conversationStore.listMessages(conversationId),
      conversationStore.getDraft(conversationId)
    ]);

    setActiveConversation(conversationId);
    setMessages(storedMessages);
    setDraft(storedDraft?.text ?? "");
  }

  async function createConversationRecord(initialDraft: string) {
    const now = new Date().toISOString();
    const conversation: ChatConversationRecord = {
      id: crypto.randomUUID(),
      title: buildConversationTitle(initialDraft, i18nMessages.chat.title),
      createdAt: now,
      updatedAt: now
    };

    await conversationStore.saveConversation(conversation);

    setConversations((currentConversations) => sortConversations([conversation, ...currentConversations]));
    newerConversationCursorRef.current = null;
    setHasNewerConversations(false);
    setActiveConversation(conversation.id);
    setMessages([]);

    return conversation;
  }

  async function ensureConversation(initialDraft: string) {
    if (activeConversationId) {
      const loadedConversation = conversations.find((conversation) => conversation.id === activeConversationId);

      if (loadedConversation) {
        return loadedConversation;
      }

      const storedConversation = await conversationStore.getConversation(activeConversationId);

      if (storedConversation) {
        return storedConversation;
      }
    }

    if (!pendingConversationPromiseRef.current) {
      pendingConversationPromiseRef.current = createConversationRecord(initialDraft).finally(() => {
        pendingConversationPromiseRef.current = null;
      });
    }

    return pendingConversationPromiseRef.current;
  }

  async function createNewConversation() {
    clearChatErrorForConversation(null);
    setActiveConversation(null);
    setMessages([]);
    setDraft("");
    requestComposerFocus();
    router.push("/");
  }

  async function selectConversation(conversationId: string, options?: { source?: SelectConversationSource }) {
    clearChatErrorForConversation(conversationId);
    pendingConversationSelectionSourceRef.current = options?.source ?? "sidebar";
    requestComposerFocus();
    router.push(`/c/${conversationId}`);
  }

  async function updateDraft(nextDraft: string) {
    setDraft(nextDraft);

    const conversationId = activeConversationId;

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

    if (trimmedDraft === "" || isConversationSending(activeConversationId)) {
      return;
    }

    if (!selectedModelId) {
      setChatErrorForConversation(activeConversationId, {
        code: "model_missing",
        message: i18nMessages.chat.errorModelMissing,
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
      title: messages.length === 0 ? buildConversationTitle(trimmedDraft, i18nMessages.chat.title) : conversation.title,
      updatedAt: now
    };
    const assistantMessageId = crypto.randomUUID();

    setMessages((currentMessages) => [...currentMessages, message]);
    setDraft("");
    setConversations((currentConversations) =>
      sortConversations(upsertConversation(currentConversations, updatedConversation))
    );
    retryStatesRef.current.set(conversation.id, {
      conversation,
      updatedConversation,
      messageHistory: [...messages, message],
      modelConfigId: selectedModelId
    });

    try {
      await Promise.all([
        conversationStore.saveConversation(updatedConversation),
        conversationStore.saveMessage(message),
        conversationStore.deleteDraft(conversation.id)
      ]);

      if (!activeConversationId) {
        skippedRouteConversationLoadRef.current = conversation.id;
        router.replace(`/c/${conversation.id}`);
      }

      await continueAssistantResponse({
        assistantMessageId,
        conversation,
        updatedConversation,
        modelConfigId: selectedModelId,
        messageHistory: [...messages, message]
      });
    } catch {
      setChatErrorForConversation(conversation.id, {
        code: "unknown",
        message: i18nMessages.chat.errorUnknown,
        canRetry: true
      });
      return;
    }
  }

  function stopMessage() {
    if (!activeConversationId) {
      return;
    }

    abortControllersRef.current.get(activeConversationId)?.abort();
  }

  async function retryMessage() {
    if (!activeConversationId || isConversationSending(activeConversationId)) {
      return;
    }

    const retryState = retryStatesRef.current.get(activeConversationId);

    if (!retryState) {
      return;
    }

    clearChatErrorForConversation(retryState.conversation.id);

    try {
      await loadConversationState(retryState.conversation.id);
      await continueAssistantResponse({
        assistantMessageId: crypto.randomUUID(),
        conversation: retryState.conversation,
        updatedConversation: retryState.updatedConversation,
        modelConfigId: retryState.modelConfigId,
        messageHistory: retryState.messageHistory
      });
    } catch {
      setChatErrorForConversation(retryState.conversation.id, {
        code: "unknown",
        message: i18nMessages.chat.errorUnknown,
        canRetry: true
      });
    }
  }

  async function regenerateMessage(messageId: string) {
    if (!activeConversationId) {
      return;
    }

    if (isConversationSending(activeConversationId)) {
      return;
    }

    if (!selectedModelId) {
      setChatErrorForConversation(activeConversationId, {
        code: "model_missing",
        message: i18nMessages.chat.errorModelMissing,
        canRetry: false
      });
      return;
    }

    const targetMessageIndex = messages.findIndex((message) => message.id === messageId && message.role === "assistant");

    if (targetMessageIndex === -1) {
      return;
    }

    const messageHistory = messages.slice(0, targetMessageIndex);

    if (messageHistory.length === 0) {
      return;
    }

    const conversation =
      conversations.find((currentConversation) => currentConversation.id === activeConversationId) ??
      await conversationStore.getConversation(activeConversationId);

    if (!conversation) {
      return;
    }

    const removedMessages = messages.slice(targetMessageIndex);
    const updatedConversation: ChatConversationRecord = {
      ...conversation,
      updatedAt: new Date().toISOString()
    };

    clearChatErrorForConversation(conversation.id);
    setMessages(messageHistory);
    setConversations((currentConversations) =>
      sortConversations(upsertConversation(currentConversations, updatedConversation))
    );
    retryStatesRef.current.set(conversation.id, {
      conversation,
      updatedConversation,
      messageHistory,
      modelConfigId: selectedModelId
    });

    try {
      await Promise.all([
        conversationStore.saveConversation(updatedConversation),
        ...removedMessages.map((message) => conversationStore.deleteMessage(message.id))
      ]);

      await continueAssistantResponse({
        assistantMessageId: crypto.randomUUID(),
        conversation,
        updatedConversation,
        modelConfigId: selectedModelId,
        messageHistory
      });
    } catch {
      setChatErrorForConversation(conversation.id, {
        code: "unknown",
        message: i18nMessages.chat.errorUnknown,
        canRetry: true
      });
    }
  }

  function clearChatError() {
    clearChatErrorForConversation(activeConversationId);
  }

  async function deleteConversation(conversationId: string) {
    if (isConversationSending(conversationId)) {
      return;
    }

    const nextConversations = conversations.filter((conversation) => conversation.id !== conversationId);
    const nextActiveConversationId =
      activeConversationId === conversationId ? nextConversations[0]?.id ?? null : activeConversationId;

    await conversationStore.deleteConversation(conversationId);

    retryStatesRef.current.delete(conversationId);

    clearChatErrorForConversation(conversationId);
    setConversations(nextConversations);

    if (activeConversationId !== conversationId) {
      return;
    }

    setActiveConversation(nextActiveConversationId);

    if (nextActiveConversationId) {
      router.replace(`/c/${nextActiveConversationId}`);
    } else {
      router.replace("/");
    }
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
    clearChatErrorForConversation(conversation.id);
    addSendingConversation(conversation.id);

    const abortController = new AbortController();
    abortControllersRef.current.set(conversation.id, abortController);

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
          setMessages: (updater) => updateActiveConversationMessages(conversation.id, updater),
          savePartialMessage: persistPartialAssistantMessage
        });
      } catch (error) {
        setChatErrorForConversation(conversation.id, resolveChatFailure(error, i18nMessages.chat));
        return;
      }

      if (streamResult.assistantMessage) {
        await persistFinalAssistantMessage(updatedConversation, streamResult.assistantMessage);
      }

      if (streamResult.status === "success") {
        if (shouldGenerateConversationTitle(messageHistory)) {
          void generateAndPersistConversationTitle({
            conversationId: conversation.id,
            fallbackModelConfigId: modelConfigId,
            messageHistory: [...messageHistory, streamResult.assistantMessage]
          });
        }

        retryStatesRef.current.delete(conversation.id);
        return;
      }

      if (streamResult.status === "aborted") {
        setChatErrorForConversation(conversation.id, {
          code: "aborted",
          message: i18nMessages.chat.stopped,
          canRetry: true
        });
        return;
      }

      if (streamResult.status === "empty") {
        setChatErrorForConversation(conversation.id, {
          code: "empty",
          message: i18nMessages.chat.errorInterrupted,
          canRetry: true
        });
        return;
      }

      setChatErrorForConversation(conversation.id, resolveChatFailure(streamResult.error, i18nMessages.chat));
    } finally {
      if (abortControllersRef.current.get(conversation.id) === abortController) {
        abortControllersRef.current.delete(conversation.id);
      }

      removeSendingConversation(conversation.id);
    }
  }

  async function persistPartialAssistantMessage(assistantMessage: ChatMessageRecord) {
    await conversationStore.saveMessage(assistantMessage);
  }

  async function persistFinalAssistantMessage(updatedConversation: ChatConversationRecord, assistantMessage: ChatMessageRecord) {
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

  async function generateAndPersistConversationTitle({
    conversationId,
    fallbackModelConfigId,
    messageHistory
  }: {
    conversationId: string;
    fallbackModelConfigId: string;
    messageHistory: ChatMessageRecord[];
  }) {
    try {
      const title = await generateConversationTitle({
        fallbackModelConfigId,
        messageHistory
      });

      if (!title) {
        return;
      }

      const currentConversation = await conversationStore.getConversation(conversationId);

      if (!currentConversation) {
        return;
      }

      const updatedConversation = {
        ...currentConversation,
        title
      };

      await conversationStore.saveConversation(updatedConversation);
      setConversations((currentConversations) =>
        sortConversations(upsertConversation(currentConversations, updatedConversation))
      );
    } catch {
      return;
    }
  }

  async function selectModel(modelId: string) {
    const nextModelId = models.some((model) => model.id === modelId) ? modelId : null;
    setSelectedModelId(nextModelId);
    clearChatErrorForConversation(activeConversationId);
    await preferencesStore.setLastSelectedModelConfigId(nextModelId);
  }

  async function expandConversationWindowToMinimum({
    items,
    newerCursor,
    olderCursor,
    minimumCount
  }: {
    items: ChatConversationRecord[];
    newerCursor: ChatConversationPageCursor | null;
    olderCursor: ChatConversationPageCursor | null;
    minimumCount: number;
  }) {
    let expandedItems = items;
    let nextNewerCursor = newerCursor;
    let nextOlderCursor = olderCursor;

    if (expandedItems.length < minimumCount && nextOlderCursor) {
      const page = await conversationStore.listOlderConversationsPage({
        limit: minimumCount - expandedItems.length,
        cursor: nextOlderCursor
      });

      expandedItems = mergeConversations(expandedItems, page.items);
      nextOlderCursor = page.nextCursor;
    }

    if (expandedItems.length < minimumCount && nextNewerCursor) {
      const page = await conversationStore.listNewerConversationsPage({
        limit: minimumCount - expandedItems.length,
        cursor: nextNewerCursor
      });

      expandedItems = mergeConversations(page.items, expandedItems);
      nextNewerCursor = page.nextCursor;
    }

    return {
      items: expandedItems,
      newerCursor: nextNewerCursor,
      olderCursor: nextOlderCursor
    };
  }

  async function loadOlderConversations() {
    if (!hasOlderConversations || isLoadingOlderConversationsRef.current) {
      return;
    }

    const cursor = olderConversationCursorRef.current;

    if (!cursor) {
      setHasOlderConversations(false);
      return;
    }

    isLoadingOlderConversationsRef.current = true;
    setIsLoadingOlderConversations(true);

    try {
      const page = await conversationStore.listOlderConversationsPage({
        limit: conversationPageSize,
        cursor
      });

      olderConversationCursorRef.current = page.nextCursor;
      setHasOlderConversations(Boolean(page.nextCursor));
      setConversations((currentConversations) => mergeConversations(currentConversations, page.items));
    } finally {
      isLoadingOlderConversationsRef.current = false;
      setIsLoadingOlderConversations(false);
    }
  }

  async function loadNewerConversations() {
    if (!hasNewerConversations || isLoadingNewerConversationsRef.current) {
      return;
    }

    const cursor = newerConversationCursorRef.current;

    if (!cursor) {
      setHasNewerConversations(false);
      return;
    }

    isLoadingNewerConversationsRef.current = true;
    setIsLoadingNewerConversations(true);

    try {
      const page = await conversationStore.listNewerConversationsPage({
        limit: conversationPageSize,
        cursor
      });

      newerConversationCursorRef.current = page.nextCursor;
      setHasNewerConversations(Boolean(page.nextCursor));
      setConversations((currentConversations) => mergeConversations(page.items, currentConversations));
    } finally {
      isLoadingNewerConversationsRef.current = false;
      setIsLoadingNewerConversations(false);
    }
  }

  async function listRecentConversations(limit: number) {
    const page = await conversationStore.listOlderConversationsPage({ limit });
    return page.items;
  }

  async function searchConversations({ query, signal, onResult }: SearchConversationsOptions) {
    const normalizedQuery = normalizeSearchQuery(query);

    if (!normalizedQuery) {
      return;
    }

    let cursor = null;

    do {
      if (signal.aborted) {
        return;
      }

      const page = await conversationStore.listOlderConversationsPage({
        limit: searchConversationPageSize,
        cursor
      });

      if (signal.aborted) {
        return;
      }

      for (const conversation of page.items) {
        if (signal.aborted) {
          return;
        }

        if (normalizeSearchQuery(conversation.title).includes(normalizedQuery)) {
          onResult({
            conversation,
            matchedText: null,
            matchedAt: conversation.updatedAt
          });
          continue;
        }

        let conversationMessages: ChatMessageRecord[];

        try {
          conversationMessages = await conversationStore.listMessages(conversation.id);
        } catch {
          continue;
        }

        if (signal.aborted) {
          return;
        }

        const matchedMessage = conversationMessages.find((message) =>
          normalizeSearchQuery(message.content).includes(normalizedQuery)
        );

        if (!matchedMessage) {
          continue;
        }

        onResult({
          conversation,
          matchedText: matchedMessage.content,
          matchedAt: matchedMessage.updatedAt
        });
      }

      cursor = page.nextCursor;
    } while (cursor);
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
        hasLoadedConversations,
        hasOlderConversations,
        hasNewerConversations,
        isLoadingOlderConversations,
        isLoadingNewerConversations,
        isLoadingModels,
        isSendingMessage,
        hasSendingMessage,
        sendingConversationIds,
        chatError,
        activeConversationRevealRequest,
        composerFocusRequestToken,
        createNewConversation,
        selectConversation,
        updateDraft,
        sendMessage,
        stopMessage,
        retryMessage,
        regenerateMessage,
        clearChatError,
        deleteConversation,
        selectModel,
        refreshModels,
        loadOlderConversations,
        loadNewerConversations,
        listRecentConversations,
        searchConversations
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

function getConversationIdFromPathname(pathname: string) {
  const match = /^\/c\/([^/]+)$/.exec(pathname);
  return match?.[1] ?? null;
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

function shouldGenerateConversationTitle(messageHistory: ChatMessageRecord[]) {
  return messageHistory.length === 1 && messageHistory[0]?.role === "user";
}

function normalizeSearchQuery(text: string) {
  return text.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function getChatErrorKey(conversationId: string | null) {
  return conversationId ?? "new";
}

async function streamAssistantMessage({
  assistantMessageId,
  conversationId,
  modelConfigId,
  messageHistory,
  signal,
  setMessages,
  savePartialMessage
}: {
  assistantMessageId: string;
  conversationId: string;
  modelConfigId: string;
  messageHistory: ChatMessageRecord[];
  signal: AbortSignal;
  setMessages: (updater: SetStateAction<ChatMessageRecord[]>) => void;
  savePartialMessage: (assistantMessage: ChatMessageRecord) => Promise<void>;
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
  let lastPersistedContent = "";

  async function persistPartialAssistantMessage() {
    const assistantMessage = finalizeAssistantMessage(initialAssistantMessage, content);

    if (!assistantMessage || assistantMessage.content === lastPersistedContent) {
      return;
    }

    lastPersistedContent = assistantMessage.content;
    await savePartialMessage(assistantMessage);
  }

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      content += decoder.decode(value, { stream: true });

      if (content === "") {
        continue;
      }

      const updatedAt = new Date().toISOString();
      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                content,
                updatedAt
              }
            : message
        )
      );
      await persistPartialAssistantMessage();
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
  await savePartialMessage(assistantMessage);

  return { status: "success", assistantMessage };
}

async function generateConversationTitle({
  fallbackModelConfigId,
  messageHistory
}: {
  fallbackModelConfigId: string;
  messageHistory: ChatMessageRecord[];
}) {
  const response = await fetch("/api/chat/title", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      fallbackModelConfigId,
      messages: messageHistory.map((message) => ({
        role: message.role,
        content: message.content
      }))
    })
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as { title?: unknown } | null;
  const title = typeof payload?.title === "string" ? payload.title.trim() : "";

  return title === "" ? null : title;
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

function resolveChatFailure(error: unknown, chatMessages: ReturnType<typeof useI18n>["messages"]["chat"]): ChatFailureState {
  if (error instanceof ChatRequestError) {
    switch (error.code) {
      case "invalid_request":
        return { code: error.code, message: chatMessages.errorValidation, canRetry: true };
      case "model_config_not_found":
      case "provider_config_not_found":
      case "model_not_available":
      case "provider_not_available":
      case "unsupported_provider":
        return { code: error.code, message: chatMessages.errorModelUnavailable, canRetry: false };
      case "upstream_request_failed":
      case "upstream_response_invalid":
      case "upstream_stream_failed":
        return { code: error.code, message: chatMessages.errorUpstream, canRetry: true };
      default:
        return { code: error.code, message: error.message || chatMessages.errorUnknown, canRetry: true };
    }
  }

  if (isAbortError(error)) {
    return { code: "aborted", message: chatMessages.stopped, canRetry: true };
  }

  return { code: "unknown", message: chatMessages.errorInterrupted, canRetry: true };
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

function mergeConversations(
  leftConversations: ChatConversationRecord[],
  rightConversations: ChatConversationRecord[]
) {
  const conversationsById = new Map<string, ChatConversationRecord>();

  for (const conversation of [...leftConversations, ...rightConversations]) {
    conversationsById.set(conversation.id, conversation);
  }

  return sortConversations([...conversationsById.values()]);
}

function upsertConversation(conversations: ChatConversationRecord[], updatedConversation: ChatConversationRecord) {
  const remainingConversations = conversations.filter((conversation) => conversation.id !== updatedConversation.id);
  return [updatedConversation, ...remainingConversations];
}
