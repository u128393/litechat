"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { useChatWorkspace } from "@/app/(protected)/ChatWorkspaceProvider";
import {
  buildConversationJsonExport,
  buildConversationMarkdownExport,
  downloadTextFile,
  getConversationExportFileName,
  type ConversationExportData,
  type ConversationExportFormat
} from "@/lib/chat/export";
import { getConversationDisplayTitle } from "@/lib/chat/presentation";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ConversationExportMenuProps = {
  className?: string;
};

export function ConversationExportMenu({ className }: ConversationExportMenuProps) {
  const { messages: i18nMessages } = useI18n();
  const {
    conversations,
    activeConversationId,
    messages,
    isSendingMessage,
  } = useChatWorkspace();
  const [isExporting, setIsExporting] = useState(false);
  const exportableMessages = messages.filter((message) => message.content.trim() !== "");
  const disabled = isExporting || isSendingMessage || exportableMessages.length === 0;

  async function handleExport(format: ConversationExportFormat) {
    if (disabled) {
      return;
    }

    setIsExporting(true);

    try {
      const exportedAt = new Date().toISOString();
      const data = createConversationExportData(exportedAt);

      if (format === "markdown") {
        downloadTextFile(
          getConversationExportFileName(data.conversation.title, exportedAt, "md"),
          buildConversationMarkdownExport(data),
          "text/markdown;charset=utf-8"
        );
      } else if (format === "json") {
        downloadTextFile(
          getConversationExportFileName(data.conversation.title, exportedAt, "json"),
          buildConversationJsonExport(data),
          "application/json;charset=utf-8"
        );
      }

      toast.success(i18nMessages.chat.exportSuccess);
    } catch {
      toast.error(i18nMessages.chat.exportFailed);
    } finally {
      setIsExporting(false);
    }
  }

  function createConversationExportData(exportedAt: string): ConversationExportData {
    const conversation = activeConversationId
      ? conversations.find((currentConversation) => currentConversation.id === activeConversationId) ?? null
      : null;
    const title = conversation
      ? getConversationDisplayTitle(conversation, { branchTitlePrefix: i18nMessages.chat.branchTitlePrefix })
      : i18nMessages.chat.title;

    return {
      conversation: {
        id: activeConversationId,
        title
      },
      exportedAt,
      roleLabels: {
        user: i18nMessages.chat.userMessageLabel,
        assistant: i18nMessages.chat.assistantMessageLabel,
        system: "System",
        tool: "Tool"
      },
      messages: exportableMessages
    };
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex size-8 items-center justify-center rounded-lg text-[var(--lc-text-secondary)] transition-colors hover:bg-[var(--lc-bg-tertiary)] hover:text-[var(--lc-text-primary)] outline-none disabled:cursor-not-allowed disabled:opacity-40",
          className
        )}
        disabled={disabled}
        aria-label={i18nMessages.chat.exportConversation}
        title={i18nMessages.chat.exportConversation}
      >
        <Download className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={4}
        className="w-[180px] rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] p-1 shadow-lg"
      >
        <DropdownMenuItem
          className="flex items-center rounded-[4px] px-3 py-2 text-[14px] text-[var(--lc-text-primary)]"
          onClick={() => {
            void handleExport("markdown");
          }}
        >
          {i18nMessages.chat.exportAsMarkdown}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex items-center rounded-[4px] px-3 py-2 text-[14px] text-[var(--lc-text-primary)]"
          onClick={() => {
            void handleExport("json");
          }}
        >
          {i18nMessages.chat.exportAsJson}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
