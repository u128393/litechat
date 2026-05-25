import { useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useI18n } from "@/lib/i18n/context";
import {
  ChatWorkspaceContext,
  type ChatBranchContext,
  type ConversationRevealRequest,
  type SearchConversationsOptions,
  type SelectConversationSource,
} from "@/features/chat/chat-workspace-context";
import {
  createBrowserConversationStore,
  type ChatConversationBranchRecord,
  type ChatConversationPageCursor,
  type ChatConversationRecord,
  type ChatMessageRecord
} from "@/lib/chat/local-store";
import { createBrowserPreferencesStore } from "@/lib/preferences";
import { getConversationDisplayTitle } from "@/lib/chat/presentation";
import type { UserSelectableModel } from "@/shared/types";

const conversationPageSize = 25;
const conversationWindowNewerSize = 12;
const conversationWindowOlderSize = 12;
const defaultDocumentTitle = "LiteChat";

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

type ChatRouteState =
  | { kind: "new" }
  | { kind: "conversation"; conversationId: string }
  | { kind: "branch"; sourceConversationId: string; sourceMessageId: string };

const searchConversationPageSize = 25;

export function ChatWorkspaceProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const { messages: i18nMessages } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
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
  const branchDraftRef = useRef("");
  const routeState = useMemo(() => getChatRouteStateFromPathname(pathname), [pathname]);
  const routeConversationId = routeState.kind === "conversation" ? routeState.conversationId : null;

  const [conversations, setConversations] = useState<ChatConversationRecord[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [branchContext, setBranchContext] = useState<ChatBranchContext | null>(null);
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
  const [timelineScrollRequestToken, setTimelineScrollRequestToken] = useState(0);
  const hasSendingMessage = sendingConversationIds.length > 0;
  const isSendingMessage = activeConversationId !== null && sendingConversationIds.includes(activeConversationId);
  const chatError = chatErrorsByConversationId[getChatErrorKey(activeConversationId)] ?? null;
  const activeConversation = activeConversationId
    ? conversations.find((conversation) => conversation.id === activeConversationId) ?? null
    : null;
  const activeConversationTitle = activeConversation
    ? getConversationDisplayTitle(activeConversation, { branchTitlePrefix: i18nMessages.chat.branchTitlePrefix })
    : null;

  activeConversationIdRef.current = activeConversationId;

  function requestComposerFocus() {
    setComposerFocusRequestToken((currentToken) => currentToken + 1);
  }

  function requestTimelineScrollToBottom() {
    setTimelineScrollRequestToken((currentToken) => currentToken + 1);
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
    document.title = activeConversationTitle || defaultDocumentTitle;

    return () => {
      document.title = defaultDocumentTitle;
    };
  }, [activeConversationTitle]);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      try {
        const targetRouteState = routeState;
        const targetConversationId = targetRouteState.kind === "conversation" ? targetRouteState.conversationId : null;
        const selectionSource = pendingConversationSelectionSourceRef.current;
        pendingConversationSelectionSourceRef.current = null;

        if (targetRouteState.kind === "branch") {
          const page = await conversationStore.listOlderConversationsPage({ limit: conversationPageSize });
          const sourceConversation = await conversationStore.getConversation(targetRouteState.sourceConversationId);

          if (!active) {
            return;
          }

          if (!sourceConversation) {
            olderConversationCursorRef.current = page.nextCursor;
            newerConversationCursorRef.current = null;
            setConversations(page.items);
            setHasOlderConversations(Boolean(page.nextCursor));
            setHasNewerConversations(false);
            setActiveConversation(null);
            setBranchContext(null);
            setMessages([]);
            setDraft("");
            setHasLoadedConversations(true);
              navigate("/", { replace: true });
            return;
          }

          const sourceMessages = await conversationStore.listMessages(sourceConversation.id);
          const sourceMessageIndex = sourceMessages.findIndex(
            (message) => message.id === targetRouteState.sourceMessageId && message.role === "assistant"
          );

          if (!active) {
            return;
          }

          if (sourceMessageIndex === -1) {
            olderConversationCursorRef.current = page.nextCursor;
            newerConversationCursorRef.current = null;
            setConversations(page.items);
            setHasOlderConversations(Boolean(page.nextCursor));
            setHasNewerConversations(false);
            setActiveConversation(null);
            setBranchContext(null);
            setMessages([]);
            setDraft("");
            setHasLoadedConversations(true);
              navigate(`/c/${sourceConversation.id}`, { replace: true });
            return;
          }

          const branchMessages = sourceMessages.slice(0, sourceMessageIndex + 1);

          olderConversationCursorRef.current = page.nextCursor;
          newerConversationCursorRef.current = null;
          setConversations(page.items);
          setHasOlderConversations(Boolean(page.nextCursor));
          setHasNewerConversations(false);
          setActiveConversation(null);
            setBranchContext({
              isPreview: true,
              sourceConversationId: sourceConversation.id,
              sourceMessageId: targetRouteState.sourceMessageId,
              sourceConversationTitle: sourceConversation.title,
              prefixMessageCount: branchMessages.length
            });
            setMessages(branchMessages);
            setDraft(branchDraftRef.current);
            clearChatErrorForConversation(null);
            setHasLoadedConversations(true);
            requestComposerFocus();
            return;
        }

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
          setBranchContext(null);
          setMessages([]);
          setDraft("");
          branchDraftRef.current = "";
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
          setBranchContext(
            toConversationBranchContext(
              conversations.find((conversation) => conversation.id === targetConversationId) ?? null
            )
          );
        setMessages(storedMessages);
        setDraft(storedDraft?.text ?? "");
        branchDraftRef.current = "";
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
          setBranchContext(null);
          setMessages([]);
          setDraft("");
          setHasLoadedConversations(true);
          navigate("/", { replace: true });
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
        setBranchContext(toConversationBranchContext(window.items.find((conversation) => conversation.id === targetConversationId) ?? null));
        setMessages(storedMessages);
        setDraft(storedDraft?.text ?? "");
        branchDraftRef.current = "";
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
        setBranchContext(null);
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
    // Workspace route loading intentionally snapshots the current window helpers and conversation list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationStore, routeState, navigate]);

  useEffect(() => {
    void refreshModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setBranchContext(null);
      setMessages([]);
      setDraft("");
      return;
    }

    const [storedConversation, storedMessages, storedDraft] = await Promise.all([
      conversationStore.getConversation(conversationId),
      conversationStore.listMessages(conversationId),
      conversationStore.getDraft(conversationId)
    ]);

    setActiveConversation(conversationId);
    setBranchContext(toConversationBranchContext(storedConversation));
    setMessages(storedMessages);
    setDraft(storedDraft?.text ?? "");
  }

  async function createConversationRecord(initialDraft: string, branch?: ChatConversationBranchRecord) {
    const now = new Date().toISOString();
    const conversation: ChatConversationRecord = {
      id: crypto.randomUUID(),
      title: branch?.sourceConversationTitle || buildConversationTitle(initialDraft, i18nMessages.chat.title),
      createdAt: now,
      updatedAt: now,
      branch
    };

    await conversationStore.saveConversation(conversation);

    setConversations((currentConversations) => sortConversations([conversation, ...currentConversations]));
    newerConversationCursorRef.current = null;
    setHasNewerConversations(false);
    setActiveConversation(conversation.id);
    setBranchContext(toConversationBranchContext(conversation));
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
      const branch = branchContext?.isPreview ? toConversationBranchRecord(branchContext) : undefined;
      pendingConversationPromiseRef.current = createConversationRecord(initialDraft, branch).finally(() => {
        pendingConversationPromiseRef.current = null;
      });
    }

    return pendingConversationPromiseRef.current;
  }

  async function createNewConversation() {
    clearChatErrorForConversation(null);
    setActiveConversation(null);
    setBranchContext(null);
    setMessages([]);
    setDraft("");
    branchDraftRef.current = "";
    requestComposerFocus();
    navigate("/");
  }

  async function selectConversation(conversationId: string, options?: { source?: SelectConversationSource }) {
    clearChatErrorForConversation(conversationId);
    setBranchContext(null);
    pendingConversationSelectionSourceRef.current = options?.source ?? "sidebar";
    requestComposerFocus();
    navigate(`/c/${conversationId}`);
  }

  async function updateDraft(nextDraft: string) {
    setDraft(nextDraft);

    if (branchContext?.isPreview) {
      branchDraftRef.current = nextDraft;
    }

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
    const isBranchPreview = branchContext?.isPreview === true;
    const prefixMessages = isBranchPreview ? cloneBranchPrefixMessages(messages, conversation.id) : [];
    const baseMessageHistory = isBranchPreview ? prefixMessages : messages;
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
      title: baseMessageHistory.length === 0 && !conversation.branch
        ? buildConversationTitle(trimmedDraft, i18nMessages.chat.title)
        : conversation.title,
      updatedAt: now
    };
    const assistantMessageId = crypto.randomUUID();
    const messageHistory = [...baseMessageHistory, message];

    requestTimelineScrollToBottom();
    setMessages(messageHistory);
    setDraft("");
    branchDraftRef.current = "";
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
        conversationStore.saveMessages(messageHistory),
        conversationStore.deleteDraft(conversation.id)
      ]);

      if (!activeConversationId) {
        skippedRouteConversationLoadRef.current = conversation.id;
        navigate(`/c/${conversation.id}`, { replace: true });
      }

      await continueAssistantResponse({
        assistantMessageId,
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
      requestTimelineScrollToBottom();
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
    requestTimelineScrollToBottom();
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

  async function editUserMessage(messageId: string, nextContent: string) {
    const trimmedContent = nextContent.trim();

    if (!activeConversationId || trimmedContent === "") {
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

    const targetMessageIndex = messages.findIndex((message) => message.id === messageId && message.role === "user");

    if (targetMessageIndex === -1) {
      return;
    }

    const conversation =
      conversations.find((currentConversation) => currentConversation.id === activeConversationId) ??
      await conversationStore.getConversation(activeConversationId);

    if (!conversation) {
      return;
    }

    const now = new Date().toISOString();
    const editedMessage: ChatMessageRecord = {
      ...messages[targetMessageIndex]!,
      content: trimmedContent,
      updatedAt: now
    };
    const messageHistory = [
      ...messages.slice(0, targetMessageIndex),
      editedMessage
    ];
    const removedMessages = messages.slice(targetMessageIndex + 1);
    const updatedConversation: ChatConversationRecord = {
      ...conversation,
      title: targetMessageIndex === 0 ? buildConversationTitle(trimmedContent, i18nMessages.chat.title) : conversation.title,
      updatedAt: now
    };

    clearChatErrorForConversation(conversation.id);
    requestTimelineScrollToBottom();
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
        conversationStore.saveMessage(editedMessage),
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
      navigate(`/c/${nextActiveConversationId}`, { replace: true });
    } else {
      navigate("/", { replace: true });
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

        const displayTitle = getConversationDisplayTitle(conversation, {
          branchTitlePrefix: i18nMessages.chat.branchTitlePrefix
        });

        if (normalizeSearchQuery(displayTitle).includes(normalizedQuery)) {
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

  async function openConversationBranch(messageId: string) {
    if (!activeConversationId || isConversationSending(activeConversationId)) {
      return;
    }

    const targetMessage = messages.find((message) => message.id === messageId && message.role === "assistant");

    if (!targetMessage) {
      return;
    }

    clearChatErrorForConversation(null);
    navigate(`/branch/${activeConversationId}/${messageId}`);
  }

  return (
    <ChatWorkspaceContext.Provider
      value={{
        conversations,
        routeConversationId,
        activeConversationId,
        messages,
        branchContext,
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
        timelineScrollRequestToken,
        createNewConversation,
        selectConversation,
        updateDraft,
        sendMessage,
        stopMessage,
        retryMessage,
        regenerateMessage,
        editUserMessage,
        openConversationBranch,
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

function getChatRouteStateFromPathname(pathname: string): ChatRouteState {
  const conversationMatch = /^\/c\/([^/]+)$/.exec(pathname);

  if (conversationMatch?.[1]) {
    return { kind: "conversation", conversationId: decodeURIComponent(conversationMatch[1]) };
  }

  const branchMatch = /^\/branch\/([^/]+)\/([^/]+)$/.exec(pathname);

  if (branchMatch?.[1] && branchMatch[2]) {
    return {
      kind: "branch",
      sourceConversationId: decodeURIComponent(branchMatch[1]),
      sourceMessageId: decodeURIComponent(branchMatch[2])
    };
  }

  return { kind: "new" };
}

function toConversationBranchContext(conversation: ChatConversationRecord | null): ChatBranchContext | null {
  if (!conversation?.branch) {
    return null;
  }

  return {
    ...conversation.branch,
    isPreview: false
  };
}

function toConversationBranchRecord(branchContext: ChatBranchContext): ChatConversationBranchRecord {
  return {
    sourceConversationId: branchContext.sourceConversationId,
    sourceMessageId: branchContext.sourceMessageId,
    sourceConversationTitle: branchContext.sourceConversationTitle,
    prefixMessageCount: branchContext.prefixMessageCount
  };
}

function cloneBranchPrefixMessages(messages: ChatMessageRecord[], conversationId: string) {
  return messages.map((message) => ({
    ...message,
    id: crypto.randomUUID(),
    conversationId
  }));
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
  const payload = (await response.json().catch(() => null)) as { error?: unknown; code?: unknown } | null;

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
