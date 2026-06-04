import { useRef, useEffect, useLayoutEffect, useState, type ChangeEvent, type KeyboardEvent } from "react";

import { useChatWorkspace } from "@/features/chat/chat-workspace-context";
import { useI18n } from "@/lib/i18n/context";
import { ArrowUp, CircleAlert, FileText, LoaderCircle, Paperclip, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessageAttachment, CreateUploadIntentResponse } from "@/shared/types";

type ComposerProps = {
  placement?: "bottom" | "center";
};

type ComposerAttachmentStatus = "pending" | "uploading" | "uploaded" | "failed";

type ComposerAttachment = {
  localId: string;
  name: string;
  size: number;
  status: ComposerAttachmentStatus;
  file?: File;
  attachment?: ChatMessageAttachment;
  error?: string;
};

type UploadAttachmentErrorCode =
  | "create_failed"
  | "disabled"
  | "unauthorized"
  | "storage_network_failed"
  | "storage_rejected"
  | "complete_failed"
  | "file_not_found";

class UploadAttachmentError extends Error {
  readonly code: UploadAttachmentErrorCode;

  constructor(code: UploadAttachmentErrorCode) {
    super(code);
    this.code = code;
  }
}

export function Composer({ placement = "bottom" }: ComposerProps) {
  const { messages } = useI18n();
  const {
    draft,
    selectedModelId,
    isSendingMessage,
    chatError,
    fileUploadCapabilities,
    composerFocusRequestToken,
    updateDraft,
    sendMessage,
    stopMessage,
    retryMessage,
    clearChatError,
  } = useChatWorkspace();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [draft]);

  useLayoutEffect(() => {
    if (composerFocusRequestToken === 0) {
      return;
    }

    textareaRef.current?.focus({ preventScroll: true });

    const animationFrame = window.requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [composerFocusRequestToken]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0 || !fileUploadCapabilities.enabled) {
      return;
    }

    const queuedAttachments = files.map((file) => createComposerAttachment(file));
    setAttachments((currentAttachments) => [...currentAttachments, ...queuedAttachments]);
    void uploadQueuedAttachments(queuedAttachments);
  }

  async function uploadQueuedAttachments(queuedAttachments: ComposerAttachment[]) {
    for (const attachment of queuedAttachments) {
      if (!attachment.file) {
        continue;
      }

      await uploadSingleAttachment(attachment.localId, attachment.file);
    }
  }

  async function uploadSingleAttachment(localId: string, file: File) {
    if (fileUploadCapabilities.maxFileSizeBytes !== null && file.size > fileUploadCapabilities.maxFileSizeBytes) {
      setAttachmentFailed(localId, messages.chat.fileTooLarge);
      return;
    }

    setAttachments((currentAttachments) => updateAttachmentStatus(currentAttachments, localId, { status: "uploading", error: undefined }));

    try {
      const uploadedAttachment = await uploadAttachment(file);
      setAttachments((currentAttachments) =>
        updateAttachmentStatus(currentAttachments, localId, {
          status: "uploaded",
          attachment: uploadedAttachment,
          file: undefined,
          name: uploadedAttachment.name,
          size: uploadedAttachment.size,
          error: undefined
        })
      );
    } catch (error) {
      setAttachmentFailed(localId, getUploadAttachmentErrorMessage(error, messages.chat));
    }
  }

  function setAttachmentFailed(localId: string, error: string) {
    setAttachments((currentAttachments) => updateAttachmentStatus(currentAttachments, localId, { status: "failed", error }));
  }

  function retryAttachment(localId: string) {
    const attachment = attachments.find((item) => item.localId === localId);
    if (!attachment?.file) {
      return;
    }

    void uploadSingleAttachment(localId, attachment.file);
  }

  async function handleSend() {
    if (!canSend) {
      return;
    }

    const currentAttachments = attachments;
    const attachmentsToSend = currentAttachments.flatMap((attachment) =>
      attachment.status === "uploaded" && attachment.attachment ? [attachment.attachment] : []
    );
    setAttachments([]);
    const sent = await sendMessage(attachmentsToSend);
    if (!sent) {
      setAttachments(currentAttachments);
    }
  }

  const hasUnsentAttachments = attachments.some((attachment) => attachment.status !== "uploaded");
  const canSend = draft.trim() !== "" && Boolean(selectedModelId) && !isSendingMessage && !hasUnsentAttachments;
  const actionButtonClass =
    "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--lc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lc-bg-tertiary)]";
  const enabledActionButtonClass =
    "bg-[#111111] text-white hover:bg-[#2A2A2A] dark:bg-white dark:text-[#111111] dark:hover:bg-[#E5E5E5]";
  const disabledActionButtonClass =
    "bg-[#D4D4D8] text-[#8A8A8A] dark:bg-[#4A4A4A] dark:text-[#9B9B9B]";
  const isBottomPlacement = placement === "bottom";

  return (
    <div className={cn("pointer-events-none relative w-full px-4", isBottomPlacement && "pb-6")}>
      {isBottomPlacement ? (
        <div className="absolute top-[26px] bottom-0 left-1/2 w-[calc(100%-2rem)] max-w-[768px] -translate-x-1/2 bg-[var(--lc-bg-primary)]" />
      ) : null}
      <div className="pointer-events-auto relative mx-auto flex w-full max-w-[768px] flex-col gap-2">
        {/* Error banner */}
        {chatError ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-[13px] text-[#991B1B] dark:border-[#7F1D1D] dark:bg-[#450A0A] dark:text-[#FCA5A5]">
            <CircleAlert className="size-4 shrink-0" />
            <span className="flex-1">{chatError.message}</span>
            {chatError.canRetry ? (
              <button
                type="button"
                className="shrink-0 rounded-md px-2 py-0.5 text-[13px] font-medium text-[#991B1B] transition-colors hover:bg-[#FEE2E2] dark:text-[#FCA5A5] dark:hover:bg-[#7F1D1D]"
                disabled={isSendingMessage}
                onClick={() => {
                  void retryMessage();
                }}
              >
                {messages.chat.retry}
              </button>
            ) : (
              <button
                type="button"
                className="shrink-0 rounded-md px-2 py-0.5 text-[13px] font-medium text-[#991B1B] transition-colors hover:bg-[#FEE2E2] dark:text-[#FCA5A5] dark:hover:bg-[#7F1D1D]"
                onClick={clearChatError}
              >
                {messages.chat.clearError}
              </button>
            )}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 rounded-[20px] bg-[var(--lc-bg-tertiary)] px-3 py-2">
          {attachments.length > 0 ? (
            <div className="flex flex-wrap gap-2 px-1 pt-1">
              {attachments.map((attachment) => (
                <AttachmentChip
                  key={attachment.localId}
                  attachment={attachment}
                  messages={messages.chat}
                  onRetry={() => retryAttachment(attachment.localId)}
                  onRemove={() => setAttachments((currentAttachments) => currentAttachments.filter((item) => item.localId !== attachment.localId))}
                />
              ))}
            </div>
          ) : null}

          <div className="flex items-end gap-2">
            {fileUploadCapabilities.enabled ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={(event) => {
                    void handleFileChange(event);
                  }}
                />
                <button
                  type="button"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--lc-text-tertiary)] transition-colors hover:bg-[var(--lc-bg-primary)] hover:text-[var(--lc-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSendingMessage}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label={messages.chat.attachFile}
                  title={messages.chat.attachFile}
                >
                  <Paperclip className="size-5" />
                </button>
              </>
            ) : null}

            <textarea
              ref={textareaRef}
              rows={1}
              placeholder={messages.chat.composerPlaceholder}
              className="min-h-9 flex-1 resize-none border-0 bg-transparent py-2 text-[15px] leading-5 text-[var(--lc-text-primary)] outline-none placeholder:text-[var(--lc-text-tertiary)]"
              onChange={(event) => {
                void updateDraft(event.target.value);
              }}
              onKeyDown={handleKeyDown}
              value={draft}
            />

            {isSendingMessage ? (
              <button
                type="button"
                className={cn(actionButtonClass, enabledActionButtonClass)}
                onClick={stopMessage}
              >
                <div className="size-3 rounded-[2px] bg-current" />
              </button>
            ) : (
              <button
                type="button"
                className={cn(
                  actionButtonClass,
                  canSend ? enabledActionButtonClass : disabledActionButtonClass
                )}
                disabled={!canSend}
                onClick={() => {
                  void handleSend();
                }}
              >
                <ArrowUp className="size-5" />
              </button>
            )}
          </div>
        </div>

        {/* Hint text */}
        {isBottomPlacement ? (
          <p className="hidden px-1 text-[11px] text-[var(--lc-text-tertiary)] md:block">
            {messages.chat.composerKeyboardHint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AttachmentChip({
  attachment,
  messages,
  onRetry,
  onRemove,
}: {
  attachment: ComposerAttachment;
  messages: ReturnType<typeof useI18n>["messages"]["chat"];
  onRetry: () => void;
  onRemove: () => void;
}) {
  const isFailed = attachment.status === "failed";
  const statusLabel = getAttachmentStatusLabel(attachment, messages);
  const statusTitle = isFailed ? attachment.error : undefined;

  return (
    <div
      className={cn(
        "flex max-w-full items-center gap-2 rounded-full bg-[var(--lc-bg-primary)] px-3 py-1.5 text-[13px] text-[var(--lc-text-secondary)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--lc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lc-bg-tertiary)]",
        isFailed && "bg-[#FEF2F2] text-[#991B1B] dark:bg-[#450A0A] dark:text-[#FCA5A5]"
      )}
    >
      <FileText className="size-4 shrink-0" />
      <span className="min-w-0 truncate" title={attachment.name}>{attachment.name}</span>
      <span className={cn("shrink-0 text-[12px] text-[var(--lc-text-tertiary)]", isFailed && "text-[#B91C1C] dark:text-[#FCA5A5]")} title={statusTitle}>{statusLabel}</span>

      {attachment.status === "uploading" ? <LoaderCircle className="size-3.5 shrink-0 animate-spin text-[var(--lc-text-tertiary)]" /> : null}

      {attachment.status === "uploaded" ? (
        <button
          type="button"
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-[var(--lc-text-tertiary)] transition-colors hover:bg-[var(--lc-bg-tertiary)] hover:text-[var(--lc-text-primary)]"
          onClick={onRemove}
          aria-label={`${messages.removeAttachment}: ${attachment.name}`}
          title={messages.removeAttachment}
        >
          <X className="size-3.5" />
        </button>
      ) : null}

      {isFailed ? (
        <span className="ml-0.5 flex shrink-0 items-center">
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded-full text-[var(--lc-text-tertiary)] transition-colors hover:bg-[var(--lc-bg-tertiary)] hover:text-[var(--lc-text-primary)]"
            onClick={onRetry}
            aria-label={`${messages.retryFileUpload}: ${attachment.name}`}
            title={messages.retryFileUpload}
          >
            <RotateCcw className="size-3.5" />
          </button>
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded-full text-[var(--lc-text-tertiary)] transition-colors hover:bg-[var(--lc-bg-tertiary)] hover:text-[var(--lc-text-primary)]"
            onClick={onRemove}
            aria-label={`${messages.removeAttachment}: ${attachment.name}`}
            title={messages.removeAttachment}
          >
            <X className="size-3.5" />
          </button>
        </span>
      ) : null}
    </div>
  );
}

function createComposerAttachment(file: File): ComposerAttachment {
  return {
    localId: createLocalAttachmentId(),
    name: file.name,
    size: file.size,
    status: "pending",
    file
  };
}

function createLocalAttachmentId() {
  return `attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function updateAttachmentStatus(
  attachments: ComposerAttachment[],
  localId: string,
  updates: Partial<ComposerAttachment>
) {
  return attachments.map((attachment) => (attachment.localId === localId ? { ...attachment, ...updates } : attachment));
}

function getAttachmentStatusLabel(
  attachment: ComposerAttachment,
  messages: ReturnType<typeof useI18n>["messages"]["chat"]
) {
  if (attachment.status === "pending") return messages.fileUploadPending;
  if (attachment.status === "uploading") return messages.fileUploading;
  if (attachment.status === "failed") return messages.fileUploadFailed;
  return formatFileSize(attachment.size);
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function getUploadAttachmentErrorMessage(
  error: unknown,
  messages: ReturnType<typeof useI18n>["messages"]["chat"]
) {
  if (!(error instanceof UploadAttachmentError)) {
    return messages.fileUploadFailed;
  }

  switch (error.code) {
    case "disabled":
      return messages.fileUploadDisabled;
    case "unauthorized":
      return messages.fileUploadUnauthorized;
    case "storage_network_failed":
      return messages.fileUploadStorageNetworkFailed;
    case "storage_rejected":
      return messages.fileUploadStorageRejected;
    case "complete_failed":
      return messages.fileUploadCompleteFailed;
    case "file_not_found":
      return messages.fileUploadFileNotFound;
    case "create_failed":
      return messages.fileUploadPrepareFailed;
  }
}

async function uploadAttachment(file: File): Promise<ChatMessageAttachment> {
  const intentResponse = await fetch("/api/files/upload-intent", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || null,
      size: file.size
    })
  });

  if (!intentResponse.ok) {
    throw await createUploadIntentError(intentResponse);
  }

  const intent = (await intentResponse.json()) as CreateUploadIntentResponse;
  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(intent.upload.url, {
      method: intent.upload.method,
      headers: intent.upload.headers,
      body: file
    });
  } catch (error) {
    console.error("File upload request failed", {
      error,
      upload: toUploadLogPayload(intent.upload)
    });
    throw new UploadAttachmentError("storage_network_failed");
  }

  if (!uploadResponse.ok) {
    const body = await uploadResponse.text().catch((error) => {
      console.error("File upload error response is not readable", {
        error,
        upload: toUploadLogPayload(intent.upload)
      });
      return "";
    });

    console.error("File upload failed", {
      status: uploadResponse.status,
      statusText: uploadResponse.statusText,
      headers: Object.fromEntries(uploadResponse.headers.entries()),
      body,
      upload: toUploadLogPayload(intent.upload)
    });

    throw new UploadAttachmentError("storage_rejected");
  }

  const completeResponse = await fetch(`/api/files/${encodeURIComponent(intent.file.id)}/complete`, {
    method: "POST",
    credentials: "same-origin"
  });

  if (!completeResponse.ok) {
    throw await createCompleteUploadError(completeResponse);
  }

  const complete = (await completeResponse.json()) as { file: ChatMessageAttachment };
  return complete.file;
}

async function createUploadIntentError(response: Response) {
  const payload = await readApiErrorPayload(response);

  if (response.status === 401 || response.status === 403) {
    return new UploadAttachmentError("unauthorized");
  }

  if (response.status === 503 || payload?.code === "file_upload_disabled") {
    return new UploadAttachmentError("disabled");
  }

  return new UploadAttachmentError("create_failed");
}

async function createCompleteUploadError(response: Response) {
  if (response.status === 401 || response.status === 403) {
    return new UploadAttachmentError("unauthorized");
  }

  if (response.status === 404) {
    return new UploadAttachmentError("file_not_found");
  }

  return new UploadAttachmentError("complete_failed");
}

async function readApiErrorPayload(response: Response): Promise<{ code?: string } | null> {
  try {
    const payload = (await response.clone().json()) as unknown;
    if (!payload || typeof payload !== "object" || !("code" in payload)) {
      return null;
    }

    const code = (payload as { code?: unknown }).code;
    return typeof code === "string" ? { code } : null;
  } catch {
    return null;
  }
}

function toUploadLogPayload(upload: CreateUploadIntentResponse["upload"]) {
  return {
    method: upload.method,
    url: redactUploadUrl(upload.url),
    headers: upload.headers
  };
}

function redactUploadUrl(value: string) {
  try {
    const url = new URL(value);
    url.search = url.searchParams.size > 0 ? "?REDACTED" : "";
    return url.toString();
  } catch {
    return "[invalid upload url]";
  }
}
