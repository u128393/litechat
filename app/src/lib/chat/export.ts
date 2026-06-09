import type { ChatMessageRecord, ChatMessageRole } from "@/lib/chat/local-store";

export type ConversationExportData = {
  conversation: {
    id: string | null;
    title: string;
  };
  exportedAt: string;
  roleLabels?: Partial<Record<ChatMessageRole, string>>;
  messages: ChatMessageRecord[];
};

export type ConversationExportFormat = "markdown" | "json";

const markdownFencePattern = /^[ \t]*(`{3,}|~{3,})/;

export function buildConversationMarkdownExport(data: ConversationExportData) {
  const lines = [`# ${data.conversation.title}`, ""];

  for (const message of data.messages) {
    const attachmentLines = message.attachments && message.attachments.length > 0
      ? [
          "Attachments:",
          ...message.attachments.map((attachment) => `- [${attachment.name}](${attachment.url})`),
          ""
        ]
      : [];
    const body = buildMessageMarkdownBody(message);

    lines.push(
      "---",
      "",
      `**${formatRole(message.role, data.roleLabels)}** · ${formatDateTime(message.createdAt)}`,
      "",
      ...attachmentLines,
      body,
      ""
    );
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function buildConversationJsonExport(data: ConversationExportData) {
  return `${JSON.stringify({
    title: data.conversation.title,
    messages: data.messages.map((message) => ({
      role: message.role,
      content: message.content,
      parts: message.parts ?? [],
      attachments: message.attachments ?? [],
      timestamp: message.createdAt
    }))
  }, null, 2)}\n`;
}

function buildMessageMarkdownBody(message: ChatMessageRecord) {
  if (!message.parts || message.parts.length === 0) {
    return withClosedMarkdownFences(normalizeLineEndings(message.content).trimEnd());
  }

  return message.parts
    .map((part) => {
      if (part.type === "text") {
        return withClosedMarkdownFences(normalizeLineEndings(part.text).trimEnd());
      }

      if (part.status === "completed" && part.image) {
        return `![${escapeMarkdownImageAlt(part.image.name)}](${part.image.url})`;
      }

      return "[Image generation in progress]";
    })
    .filter((part) => part.trim() !== "")
    .join("\n\n");
}

function escapeMarkdownImageAlt(value: string) {
  return value.replace(/[\]\\]/g, "").replace(/\[/g, "(").replace(/\]/g, ")");
}

export function downloadTextFile(fileName: string, content: string, type: string) {
  downloadBlob(fileName, new Blob([content], { type }));
}

export function getConversationExportFileName(title: string, exportedAt: string, extension: string) {
  return `${slugifyFileName(title)}-${formatTimestampForFileName(exportedAt)}.${extension}`;
}

function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function withClosedMarkdownFences(content: string) {
  const openFence = getOpenMarkdownFence(content);

  if (!openFence) {
    return content;
  }

  return `${content}\n\n${openFence}`;
}

function getOpenMarkdownFence(content: string) {
  let openFence: string | null = null;

  for (const line of normalizeLineEndings(content).split("\n")) {
    const match = markdownFencePattern.exec(line);

    if (!match?.[1]) {
      continue;
    }

    const fence = match[1];

    if (!openFence) {
      openFence = fence;
      continue;
    }

    if (fence[0] === openFence[0] && fence.length >= openFence.length) {
      openFence = null;
    }
  }

  return openFence;
}

function normalizeLineEndings(content: string) {
  return content.replace(/\r\n?/g, "\n");
}

function formatRole(role: ChatMessageRecord["role"], roleLabels?: Partial<Record<ChatMessageRole, string>>) {
  const label = roleLabels?.[role];

  if (label) {
    return label;
  }

  switch (role) {
    case "user":
      return "User";
    case "assistant":
      return "Assistant";
    case "system":
      return "System";
    case "tool":
      return "Tool";
  }
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function formatTimestampForFileName(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "export";
  }

  return date.toISOString().replace(/[:.]/g, "-").replace(/\.\d{3}Z$/, "Z").toLowerCase();
}

function slugifyFileName(title: string) {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/^-|-$/g, "");

  return slug || "conversation";
}
