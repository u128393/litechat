"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChatWorkspace } from "@/app/(protected)/ChatWorkspaceProvider";
import { useI18n } from "@/lib/i18n/provider";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type ModelSelectorProps = {
  className?: string;
};

export function ModelSelector({ className }: ModelSelectorProps) {
  const { messages } = useI18n();
  const { models, selectedModelId, isLoadingModels, selectModel } = useChatWorkspace();
  const selectedModel = models.find((model) => model.id === selectedModelId) ?? null;

  const displayText = isLoadingModels
    ? messages.shell.modelsLoading
    : selectedModel?.displayName ?? messages.shell.modelsEmpty;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-[var(--lc-text-primary)] transition-colors hover:bg-[var(--lc-bg-tertiary)] outline-none disabled:opacity-60",
          className
        )}
        disabled={isLoadingModels || models.length === 0}
      >
        {displayText}
        <ChevronDown className="size-3.5 text-[var(--lc-text-secondary)]" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-[220px] rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] p-1 shadow-lg"
      >
        {models.map((model) => (
          <DropdownMenuItem
            key={model.id}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-[13px] text-[var(--lc-text-primary)]",
              model.id === selectedModelId && "font-medium"
            )}
            onClick={() => {
              void selectModel(model.id);
            }}
          >
            {model.displayName}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
