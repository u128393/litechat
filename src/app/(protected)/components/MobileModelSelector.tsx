"use client";

import { useState } from "react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useChatWorkspace } from "@/app/(protected)/ChatWorkspaceProvider";
import { useI18n } from "@/lib/i18n/provider";
import { ChevronDown, Check } from "lucide-react";

export function MobileModelSelector() {
  const { messages } = useI18n();
  const { models, selectedModelId, isLoadingModels, selectModel } = useChatWorkspace();
  const [open, setOpen] = useState(false);

  const selectedModel = models.find((model) => model.id === selectedModelId) ?? null;

  const displayText = isLoadingModels
    ? messages.shell.modelsLoading
    : selectedModel?.displayName ?? messages.shell.modelsEmpty;

  function handleSelect(modelId: string) {
    void selectModel(modelId);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="flex items-center gap-1 text-[14px] font-medium text-[var(--lc-text-primary)] outline-none disabled:opacity-60"
        disabled={isLoadingModels || models.length === 0}
        onClick={() => setOpen(true)}
      >
        {displayText}
        <ChevronDown className="size-[14px] text-[var(--lc-text-secondary)]" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-[16px] flex flex-col gap-0 border-t border-[var(--lc-border)] bg-[var(--lc-bg-primary)] p-0 shadow-xl"
          showCloseButton={false}
          closeLabel={messages.common.close}
        >
          <SheetTitle className="sr-only">{messages.chat.selectModel}</SheetTitle>

          {/* Drag handle */}
          <div className="flex flex-col items-center pb-2 pt-3">
            <div className="h-1 w-9 rounded-[2px] bg-[var(--lc-text-tertiary)]" />
          </div>

          {/* Title */}
          <div className="px-5 pb-3 pt-2">
            <span className="text-[16px] font-semibold text-[var(--lc-text-primary)]">
              {messages.chat.selectModel}
            </span>
          </div>

          {/* Divider */}
          <div className="h-px bg-[var(--lc-border)]" />

          {/* Model list */}
          <div className="flex flex-col gap-0 p-2">
            {models.map((model) => {
              const isSelected = model.id === selectedModelId;
              return (
                <button
                  key={model.id}
                  type="button"
                  className={`flex items-center gap-2 rounded-lg px-3 py-3 text-left text-[15px] transition-colors ${
                    isSelected
                      ? "bg-[var(--lc-bg-tertiary)] font-medium text-[var(--lc-text-primary)]"
                      : "font-normal text-[var(--lc-text-primary)] hover:bg-[var(--lc-bg-tertiary)]"
                  }`}
                  onClick={() => handleSelect(model.id)}
                >
                  <span className="flex-1">{model.displayName}</span>
                  {isSelected ? (
                    <Check className="size-[18px] text-[var(--lc-accent)]" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
