import {
  Children,
  isValidElement,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type UIEvent,
  type WheelEvent,
} from "react";
import { Link } from "react-router-dom";
import rehypeHighlight from "rehype-highlight";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useChatWorkspace } from "@/features/chat/chat-workspace-context";
import type { ChatMessageAttachment, ChatMessageRecord } from "@/lib/chat";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";
import { Check, Copy, FileText, GitBranch, Pencil, RefreshCw } from "lucide-react";

const bottomResumeThreshold = 2;
const userLeaveBottomThreshold = 4;
const scrollDirectionTolerance = 1;
const hashTargetBottomPadding = 32;
const timelineBottomExtraPadding = 24;
const selectionMoveThreshold = 4;
const selectionUnlockDelayMs = 150;
const userScrollIntentWindowMs = 300;
const scrollKeys = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

type ScrollMode = "follow" | "manual" | "selecting" | "anchored";
type SelectionPhase = "idle" | "armed" | "locked";

type SelectionSnapshot = {
  text: string;
  blockSignature: string | null;
};

type StreamingRenderState = {
  visibleContent: string;
  pendingContent: string;
  frozenBlockSignature: string | null;
};

type MarkdownBlockData = {
  key: string;
  signature: string;
  content: string;
  mutable: boolean;
};

export function MessageTimeline({ composerOverlayHeight = 0 }: { composerOverlayHeight?: number }) {
  const { messages: i18nMessages } = useI18n();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const previousConversationIdRef = useRef<string | null>(null);
  const consumedHashRef = useRef<string | null>(null);
  const previousTimelineScrollRequestTokenRef = useRef<number | null>(null);
  const previousScrollTopRef = useRef(0);
  const unlockTimeoutRef = useRef<number | null>(null);
  const userScrollIntentTimeoutRef = useRef<number | null>(null);
  const hasRecentUserScrollIntentRef = useRef(false);
  const pointerStateRef = useRef<{ pointerId: number | null; x: number; y: number }>({ pointerId: null, x: 0, y: 0 });
  const selectionPhaseRef = useRef<SelectionPhase>("idle");
  const selectionSnapshotRef = useRef<SelectionSnapshot | null>(null);
  const [scrollMode, setScrollMode] = useState<ScrollMode>("follow");
  const [streamingRenderState, setStreamingRenderState] = useState<StreamingRenderState | null>(null);
  const {
    activeConversationId,
    messages: conversationMessages,
    branchContext,
    isSendingMessage,
    timelineScrollRequestToken,
    regenerateMessage,
    editUserMessage,
    openConversationBranch,
  } = useChatWorkspace();
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const streamingMessage = conversationMessages.length > 0 && isSendingMessage && conversationMessages.at(-1)?.role === "assistant"
    ? conversationMessages.at(-1) ?? null
    : null;
  const committedMessages = streamingMessage ? conversationMessages.slice(0, -1) : conversationMessages;
  const renderedStreamingContent = streamingRenderState?.visibleContent ?? streamingMessage?.content ?? "";

  const renderedMessages = useMemo(() => {
    if (!streamingMessage) {
      return committedMessages;
    }

    return [...committedMessages, { ...streamingMessage, content: renderedStreamingContent }];
  }, [committedMessages, renderedStreamingContent, streamingMessage]);

  useEffect(() => {
    const currentContent = streamingMessage?.content ?? "";

    if (!streamingMessage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStreamingRenderState(null);
      selectionSnapshotRef.current = null;
      return;
    }

    setStreamingRenderState((currentState) => {
      if (!currentState) {
        return {
          visibleContent: currentContent,
          pendingContent: currentContent,
          frozenBlockSignature: null,
        };
      }

      if (selectionPhaseRef.current === "locked" && selectionSnapshotRef.current?.blockSignature) {
        return {
          ...currentState,
          pendingContent: currentContent,
          frozenBlockSignature: selectionSnapshotRef.current.blockSignature,
        };
      }

      return {
        visibleContent: currentContent,
        pendingContent: currentContent,
        frozenBlockSignature: null,
      };
    });
  }, [streamingMessage?.content, streamingMessage]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const bottomSentinel = bottomSentinelRef.current;

    if (!scrollContainer || !bottomSentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) {
          return;
        }

        setScrollMode((currentMode) => {
          if (currentMode === "selecting" || currentMode === "anchored" || currentMode === "manual") {
            return currentMode;
          }

          return entry.isIntersecting ? "follow" : currentMode;
        });
      },
      {
        root: scrollContainer,
        threshold: 0.99,
      }
    );

    observer.observe(bottomSentinel);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const conversationChanged = previousConversationIdRef.current !== activeConversationId;

    previousConversationIdRef.current = activeConversationId;

    if (conversationChanged) {
      consumedHashRef.current = null;
      selectionPhaseRef.current = "idle";
      selectionSnapshotRef.current = null;
      setScrollMode("follow");
    }

    if (!scrollContainer) {
      return;
    }

    if (activeConversationId && scrollToHashMessage(scrollContainer, consumedHashRef, composerOverlayHeight)) {
      previousScrollTopRef.current = scrollContainer.scrollTop;
      setScrollMode("anchored");
      return;
    }

    if (scrollMode !== "follow") {
      return;
    }

    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    previousScrollTopRef.current = scrollContainer.scrollTop;
  }, [activeConversationId, composerOverlayHeight, renderedMessages, scrollMode]);

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    if (!scrollContainer) {
      return;
    }

    if (previousTimelineScrollRequestTokenRef.current === null) {
      previousTimelineScrollRequestTokenRef.current = timelineScrollRequestToken;
      return;
    }

    if (previousTimelineScrollRequestTokenRef.current === timelineScrollRequestToken) {
      return;
    }

    previousTimelineScrollRequestTokenRef.current = timelineScrollRequestToken;
    setScrollMode((currentMode) => {
      if (currentMode === "selecting") {
        return currentMode;
      }

      scrollContainer.scrollTop = scrollContainer.scrollHeight;
      previousScrollTopRef.current = scrollContainer.scrollTop;
      return "follow";
    });
  }, [timelineScrollRequestToken]);

  useEffect(() => {
    return () => {
      if (unlockTimeoutRef.current !== null) {
        window.clearTimeout(unlockTimeoutRef.current);
      }

      if (userScrollIntentTimeoutRef.current !== null) {
        window.clearTimeout(userScrollIntentTimeoutRef.current);
      }
    };
  }, []);

  function markUserScrollIntent() {
    hasRecentUserScrollIntentRef.current = true;

    if (userScrollIntentTimeoutRef.current !== null) {
      window.clearTimeout(userScrollIntentTimeoutRef.current);
    }

    userScrollIntentTimeoutRef.current = window.setTimeout(() => {
      hasRecentUserScrollIntentRef.current = false;
      userScrollIntentTimeoutRef.current = null;
    }, userScrollIntentWindowMs);
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (event.deltaY !== 0) {
      markUserScrollIntent();
    }
  }

  function handleTouchMove() {
    markUserScrollIntent();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (scrollKeys.has(event.key)) {
      markUserScrollIntent();
    }
  }

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const scrollContainer = event.currentTarget;
    const scrollDelta = scrollContainer.scrollTop - previousScrollTopRef.current;
    const distanceFromBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
    const isUserLeavingBottom =
      distanceFromBottom > userLeaveBottomThreshold &&
      (hasRecentUserScrollIntentRef.current || scrollDelta < -scrollDirectionTolerance);

    previousScrollTopRef.current = scrollContainer.scrollTop;

    if (selectionPhaseRef.current === "locked") {
      return;
    }

    setScrollMode((currentMode) => {
      if (distanceFromBottom <= bottomResumeThreshold) {
        return "follow";
      }

      if (currentMode === "anchored") {
        if (isUserLeavingBottom) {
          return "manual";
        }

        return currentMode;
      }

      if (isUserLeavingBottom) {
        return "manual";
      }

      return currentMode;
    });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isSelectionCandidateTarget(event.target)) {
      return;
    }

    if (unlockTimeoutRef.current !== null) {
      window.clearTimeout(unlockTimeoutRef.current);
      unlockTimeoutRef.current = null;
    }

    selectionPhaseRef.current = "armed";
    pointerStateRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (selectionPhaseRef.current !== "armed" || pointerStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    const dx = Math.abs(event.clientX - pointerStateRef.current.x);
    const dy = Math.abs(event.clientY - pointerStateRef.current.y);

    if (Math.max(dx, dy) < selectionMoveThreshold) {
      return;
    }

    lockSelection();
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    pointerStateRef.current.pointerId = null;

    if (selectionPhaseRef.current === "armed") {
      selectionPhaseRef.current = "idle";
      return;
    }

    if (selectionPhaseRef.current === "locked") {
      scheduleSelectionUnlockCheck();
    }
  }

  function handlePointerCancel() {
    pointerStateRef.current.pointerId = null;
    if (selectionPhaseRef.current === "locked") {
      scheduleSelectionUnlockCheck();
      return;
    }
    selectionPhaseRef.current = "idle";
  }

  function updateSelectionLockFromDocument() {
    const scrollContainer = scrollContainerRef.current;
    const selection = document.getSelection();

    if (!scrollContainer || !selection || selection.isCollapsed) {
      if (selectionPhaseRef.current === "locked") {
        scheduleSelectionUnlockCheck();
      }
      return;
    }

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;

    const contained = Boolean(anchorNode && focusNode && scrollContainer.contains(anchorNode) && scrollContainer.contains(focusNode));

    if (!contained) {
      if (selectionPhaseRef.current === "locked") {
        scheduleSelectionUnlockCheck();
      }
      return;
    }

    lockSelection();
  }

  function lockSelection() {
    if (selectionPhaseRef.current === "locked") {
      return;
    }

    selectionPhaseRef.current = "locked";
    selectionSnapshotRef.current = captureSelectionSnapshot();
    setScrollMode("selecting");

    setStreamingRenderState((currentState) => {
      if (!currentState) {
        return currentState;
      }

      return {
        ...currentState,
        frozenBlockSignature: selectionSnapshotRef.current?.blockSignature ?? null,
      };
    });
  }

  function scheduleSelectionUnlockCheck() {
    if (unlockTimeoutRef.current !== null) {
      window.clearTimeout(unlockTimeoutRef.current);
    }

    unlockTimeoutRef.current = window.setTimeout(() => {
      unlockTimeoutRef.current = null;

      const selection = document.getSelection();
      const scrollContainer = scrollContainerRef.current;

      const stillSelecting = Boolean(
        scrollContainer &&
        selection &&
        !selection.isCollapsed &&
        selection.anchorNode &&
        selection.focusNode &&
        scrollContainer.contains(selection.anchorNode) &&
        scrollContainer.contains(selection.focusNode)
      );

      if (stillSelecting) {
        selectionSnapshotRef.current = captureSelectionSnapshot();
        setStreamingRenderState((currentState) => {
          if (!currentState) {
            return currentState;
          }

          return {
            ...currentState,
            frozenBlockSignature: selectionSnapshotRef.current?.blockSignature ?? currentState.frozenBlockSignature,
          };
        });
        return;
      }

      selectionPhaseRef.current = "idle";
      selectionSnapshotRef.current = null;
      setStreamingRenderState((currentState) => {
        if (!currentState) {
          return currentState;
        }

        return {
          visibleContent: currentState.pendingContent,
          pendingContent: currentState.pendingContent,
          frozenBlockSignature: null,
        };
      });
      setScrollMode((currentMode) => (currentMode === "selecting" ? "manual" : currentMode));
    }, selectionUnlockDelayMs);
  }

  useEffect(() => {
    function handleSelectionChange() {
      updateSelectionLockFromDocument();
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function captureSelectionSnapshot(): SelectionSnapshot | null {
    const selection = document.getSelection();

    if (!selection || selection.isCollapsed) {
      return null;
    }

    const anchorElement = selection.anchorNode instanceof Element
      ? selection.anchorNode
      : selection.anchorNode?.parentElement ?? null;
    const block = anchorElement?.closest<HTMLElement>("[data-markdown-block-signature]") ?? null;

    return {
      text: selection.toString(),
      blockSignature: block?.dataset.markdownBlockSignature ?? null,
    };
  }

  if (renderedMessages.length === 0) {
    return (
      <div className="flex flex-col items-center">
        <h1 className="text-[24px] font-normal tracking-[-0.01em] text-[var(--lc-text-primary)]">
          {i18nMessages.chat.emptyState}
        </h1>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex min-w-0 flex-1 flex-col overflow-y-auto pt-8"
      style={{ paddingBottom: Math.max(128, composerOverlayHeight + timelineBottomExtraPadding) }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onWheel={handleWheel}
      onTouchMove={handleTouchMove}
      onKeyDown={handleKeyDown}
      onScroll={handleScroll}
    >
      <div className="mx-auto flex min-w-0 w-full max-w-[768px] flex-col gap-6 px-4">
        {renderedMessages.map((message, index) => {
          const isStreaming = streamingMessage?.id === message.id;
          const shouldShowBranchDivider = branchContext ? index === branchContext.prefixMessageCount - 1 : false;
          const isBranchPrefixMessage = branchContext ? index < branchContext.prefixMessageCount : false;
          const branchDividerSourceTitle = shouldShowBranchDivider ? branchContext?.sourceConversationTitle ?? null : null;
          const branchDividerHref = shouldShowBranchDivider && branchContext
            ? `/c/${branchContext.sourceConversationId}#${getMessageAnchorId(branchContext.sourceMessageId)}`
            : null;

          if (message.role === "user") {
            return (
              <div id={getMessageAnchorId(message.id)} key={message.id} className="flex min-w-0 w-full flex-col gap-6">
                <UserMessage
                  message={message}
                  isEditing={editingMessageId === message.id}
                  disabled={isSendingMessage || isBranchPrefixMessage}
                  onCopy={() => setEditingMessageId(null)}
                  onEdit={() => setEditingMessageId(message.id)}
                  onCancelEdit={() => setEditingMessageId(null)}
                  onSubmitEdit={async (nextContent) => {
                    setEditingMessageId(null);
                    await editUserMessage(message.id, nextContent);
                  }}
                />
                {branchDividerSourceTitle && branchDividerHref ? (
                  <BranchDivider href={branchDividerHref} sourceTitle={branchDividerSourceTitle} />
                ) : null}
              </div>
            );
          }

          return (
            <div id={getMessageAnchorId(message.id)} key={message.id} className="flex min-w-0 w-full flex-col gap-3">
              {isStreaming && message.content === "" ? (
                <div
                  className="flex min-h-[1.6em] items-center"
                  aria-label={i18nMessages.chat.streamingStatus}
                  role="status"
                >
                  <span className="size-2.5 animate-pulse rounded-full bg-[var(--lc-text-primary)]" />
                </div>
              ) : (
                <>
                  <AssistantMessage
                    message={message}
                    copyCodeLabel={i18nMessages.chat.copyCode}
                    isStreaming={isStreaming}
                    frozenBlockSignature={isStreaming ? streamingRenderState?.frozenBlockSignature ?? null : null}
                    pendingStreamingContent={isStreaming ? streamingRenderState?.pendingContent ?? message.content : null}
                  />
                  <div className="flex gap-1">
                    <CopyButton text={message.content} label={i18nMessages.chat.copyMessage} />
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-[6px] text-[var(--lc-text-tertiary)] transition-colors hover:bg-[var(--lc-bg-tertiary)]"
                      disabled={isSendingMessage || isBranchPrefixMessage}
                      onClick={() => {
                        void regenerateMessage(message.id);
                      }}
                    >
                      <RefreshCw className="size-4" />
                    </button>
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-[6px] text-[var(--lc-text-tertiary)] transition-colors hover:bg-[var(--lc-bg-tertiary)] hover:text-[var(--lc-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={isSendingMessage || isBranchPrefixMessage || !activeConversationId}
                      aria-label={i18nMessages.chat.branchMessage}
                      title={i18nMessages.chat.branchMessage}
                      onClick={() => {
                        void openConversationBranch(message.id);
                      }}
                    >
                      <GitBranch className="size-4" />
                    </button>
                  </div>
                </>
              )}
              {branchDividerSourceTitle && branchDividerHref ? (
                <BranchDivider href={branchDividerHref} sourceTitle={branchDividerSourceTitle} />
              ) : null}
            </div>
          );
        })}
      </div>
      <div ref={bottomSentinelRef} className="h-px w-full shrink-0" aria-hidden="true" />
    </div>
  );
}

function AssistantMessage({
  message,
  copyCodeLabel,
  isStreaming,
  frozenBlockSignature,
  pendingStreamingContent,
}: {
  message: ChatMessageRecord;
  copyCodeLabel: string;
  isStreaming: boolean;
  frozenBlockSignature: string | null;
  pendingStreamingContent: string | null;
}) {
  const visibleBlocks = useMemo(
    () => buildMarkdownBlocks(message.id, message.content),
    [message.content, message.id]
  );
  const pendingBlocks = useMemo(
    () => isStreaming && pendingStreamingContent !== null
      ? buildMarkdownBlocks(message.id, pendingStreamingContent)
      : visibleBlocks,
    [isStreaming, message.id, pendingStreamingContent, visibleBlocks]
  );
  const visibleBlocksBySignature = useMemo(
    () => new Map(visibleBlocks.map((block) => [block.signature, block] as const)),
    [visibleBlocks]
  );
  const renderBlocks = useMemo(
    () => pendingBlocks.map((block) => (
      isStreaming && frozenBlockSignature !== null && block.signature === frozenBlockSignature
        ? visibleBlocksBySignature.get(block.signature) ?? block
        : block
    )),
    [frozenBlockSignature, isStreaming, pendingBlocks, visibleBlocksBySignature]
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {renderBlocks.map((block) => (
        <MemoizedMarkdownBlock
          key={block.key}
          block={block}
          copyCodeLabel={copyCodeLabel}
        />
      ))}
    </div>
  );
}

const MemoizedMarkdownBlock = memo(
  function MarkdownBlock({
    block,
    copyCodeLabel,
  }: {
    block: MarkdownBlockData;
    copyCodeLabel: string;
  }) {
    return (
      <div
        className="lc-markdown min-w-0 text-[15px] leading-[1.6] text-[var(--lc-text-primary)]"
        data-markdown-block-signature={block.signature}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
          components={{
            pre({ children, className, ...props }: ComponentPropsWithoutRef<"pre">) {
              return (
                <div className="lc-code-block my-[0.85em]">
                  <CopyButton
                    text={normalizeCopiedText(extractTextContent(children))}
                    label={copyCodeLabel}
                    className="absolute top-3 right-2 z-10 bg-transparent hover:bg-transparent"
                  />
                  <pre className={className} {...props}>
                    {children}
                  </pre>
                </div>
              );
            },
          }}
        >
          {block.content}
        </ReactMarkdown>
      </div>
    );
  },
  (previousProps, nextProps) =>
    previousProps.copyCodeLabel === nextProps.copyCodeLabel &&
    previousProps.block.signature === nextProps.block.signature &&
    previousProps.block.content === nextProps.block.content
);

function buildMarkdownBlocks(messageId: string, content: string): MarkdownBlockData[] {
  const normalized = content.replace(/\r\n/g, "\n");

  if (normalized.trim() === "") {
    return [
      {
        key: `${messageId}:empty`,
        signature: `${messageId}:empty`,
        content: normalized,
        mutable: true,
      },
    ];
  }

  const lines = normalized.split("\n");
  const blocks: MarkdownBlockData[] = [];
  let start = 0;
  let codeFenceOpen = false;

  function pushBlock(endExclusive: number, mutable: boolean) {
    const blockContent = lines.slice(start, endExclusive).join("\n");
    if (blockContent === "") {
      start = endExclusive;
      return;
    }

    const signature = `${messageId}:${start}:${endExclusive}:${detectBlockType(blockContent)}`;
    blocks.push({
      key: signature,
      signature,
      content: blockContent,
      mutable,
    });
    start = endExclusive;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    const isFence = /^```|^~~~/.test(trimmed);

    if (isFence) {
      codeFenceOpen = !codeFenceOpen;
      continue;
    }

    if (!codeFenceOpen && trimmed === "") {
      pushBlock(index + 1, false);
    }
  }

  if (start < lines.length) {
    pushBlock(lines.length, true);
  }

  if (blocks.length === 0) {
    blocks.push({
      key: `${messageId}:single`,
      signature: `${messageId}:single`,
      content: normalized,
      mutable: true,
    });
  }

  return blocks.map((block, index) => ({
    ...block,
    mutable: index === blocks.length - 1,
  }));
}

function detectBlockType(content: string) {
  const firstLine = content.trimStart().split("\n", 1)[0] ?? "";
  if (/^```|^~~~/.test(firstLine)) return "code";
  if (/^#{1,6}\s/.test(firstLine)) return "heading";
  if (/^[-*+]\s|^\d+\.\s/.test(firstLine)) return "list";
  if (/^>\s/.test(firstLine)) return "quote";
  if (/^\|/.test(firstLine)) return "table";
  return "paragraph";
}

function isSelectionCandidateTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target.closest("button, a, textarea, input, select, [role='button']")) {
    return false;
  }

  return Boolean(target.closest(".lc-markdown, .lc-code-block, pre, code"));
}

function BranchDivider({ href, sourceTitle }: { href: string; sourceTitle: string }) {
  const { messages } = useI18n();

  return (
    <div className="flex items-center gap-3 py-2 text-[12px] text-[var(--lc-text-tertiary)]">
      <span className="h-px flex-1 bg-[var(--lc-border)]" />
      <span className="max-w-[70%] truncate rounded-full bg-[var(--lc-bg-tertiary)] px-3 py-1">
        {messages.chat.branchDividerStart}
        <Link
          to={href}
          className="font-medium text-[var(--lc-text-secondary)] underline underline-offset-2 transition-colors hover:text-[var(--lc-text-primary)]"
        >
          {sourceTitle}
        </Link>
        {messages.chat.branchDividerEnd}
      </span>
      <span className="h-px flex-1 bg-[var(--lc-border)]" />
    </div>
  );
}

function getMessageAnchorId(messageId: string) {
  return `message-${messageId}`;
}

function scrollToHashMessage(
  scrollContainer: HTMLDivElement,
  consumedHashRef: React.MutableRefObject<string | null>,
  composerOverlayHeight: number
) {
  const hash = window.location.hash.slice(1);

  if (!hash || consumedHashRef.current === hash) {
    return false;
  }

  const target = scrollContainer.querySelector<HTMLElement>(`#${CSS.escape(hash)}`);

  if (!target) {
    return false;
  }

  consumedHashRef.current = hash;
  const visibleHeight = Math.max(scrollContainer.clientHeight - composerOverlayHeight, 1);
  const desiredScrollTop = target.offsetTop + target.offsetHeight - visibleHeight + hashTargetBottomPadding;
  const nextMessage = target.nextElementSibling instanceof HTMLElement ? target.nextElementSibling : null;
  const maxScrollTopBeforeNextMessage = nextMessage
    ? nextMessage.offsetTop - visibleHeight - 1
    : Number.POSITIVE_INFINITY;

  scrollContainer.scrollTop = Math.max(0, Math.min(desiredScrollTop, maxScrollTopBeforeNextMessage));
  return true;
}

function UserMessage({
  message,
  isEditing,
  disabled,
  onCopy,
  onEdit,
  onCancelEdit,
  onSubmitEdit,
}: {
  message: ChatMessageRecord;
  isEditing: boolean;
  disabled: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (nextContent: string) => Promise<void>;
}) {
  const { messages } = useI18n();
  const [draft, setDraft] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!isEditing || !textarea) {
      return;
    }

    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [isEditing]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [draft, isEditing]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitEdit();
    }

    if (event.key === "Escape") {
      onCancelEdit();
    }
  }

  async function submitEdit() {
    const nextContent = draft.trim();

    if (nextContent === "" || disabled) {
      return;
    }

    if (nextContent === message.content.trim()) {
      onCancelEdit();
      return;
    }

    await onSubmitEdit(nextContent);
  }

  if (isEditing) {
    return (
      <div className="flex justify-end">
        <div className="flex w-full flex-col gap-4 rounded-[22px] bg-[var(--lc-user-bubble)] px-5 py-4">
          <textarea
            ref={textareaRef}
            className="min-h-12 w-full resize-none border-0 bg-transparent text-[15px] leading-6 text-[var(--lc-text-primary)] outline-none"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            value={draft}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-full bg-black px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[#2A2A2A] dark:bg-black dark:text-white dark:hover:bg-[#1F1F1F]"
              onClick={onCancelEdit}
            >
              {messages.common.cancel}
            </button>
            <button
              type="button"
              className="rounded-full bg-white px-4 py-2 text-[14px] font-medium text-[#111111] transition-colors hover:bg-[#E8E8E8] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-[#111111] dark:hover:bg-[#E5E5E5]"
              disabled={draft.trim() === "" || disabled}
              onClick={() => {
                void submitEdit();
              }}
            >
              {messages.chat.send}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex min-w-0 max-w-full flex-col items-end gap-1.5">
      <div className="min-w-0 max-w-full rounded-xl bg-[var(--lc-user-bubble)] px-4 py-3">
        {message.attachments && message.attachments.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              <MessageAttachmentCard key={attachment.id} attachment={attachment} />
            ))}
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <p className="whitespace-pre-wrap text-[15px] text-[var(--lc-text-primary)]">
            {message.content}
          </p>
        </div>
      </div>
      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <CopyButton text={message.content} onCopied={onCopy} label={messages.chat.copyMessage} />
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-[6px] text-[var(--lc-text-tertiary)] transition-colors hover:bg-[var(--lc-bg-tertiary)] hover:text-[var(--lc-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled}
          aria-label={messages.chat.editMessage}
          title={messages.chat.editMessage}
          onClick={onEdit}
        >
          <Pencil className="size-4" />
        </button>
      </div>
    </div>
  );
}

function MessageAttachmentCard({ attachment }: { attachment: ChatMessageAttachment }) {
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="flex min-w-0 max-w-full items-center gap-3 rounded-lg bg-[var(--lc-bg-primary)] px-3 py-2 text-[13px] text-[var(--lc-text-secondary)] transition-colors hover:text-[var(--lc-text-primary)] sm:max-w-[240px]"
    >
      <FileText className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate" title={attachment.name}>{attachment.name}</span>
      <span className="shrink-0 text-[12px] text-[var(--lc-text-tertiary)]">{formatFileSize(attachment.size)}</span>
    </a>
  );
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function extractTextContent(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }

      if (!isValidElement<{ children?: ReactNode }>(child)) {
        return "";
      }

      return extractTextContent(child.props.children);
    })
    .join("");
}

function normalizeCopiedText(text: string): string {
  return text.replace(/\r?\n$/, "");
}

function CopyButton({
  text,
  label,
  onCopied,
  className,
}: {
  text: string;
  label?: string;
  onCopied?: () => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      fallbackCopyText(text);
    }

    onCopied?.();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      className={cn(
        "flex size-8 items-center justify-center rounded-[6px] bg-transparent text-[var(--lc-text-tertiary)] transition-colors hover:text-[var(--lc-text-primary)]",
        className
      )}
      aria-label={label}
      title={label}
      onClick={() => {
        void handleCopy();
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}

function fallbackCopyText(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}
