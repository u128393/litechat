"use client";

import { ModelSelector } from "@/app/(protected)/components/ModelSelector";
import { MessageTimeline } from "@/app/(protected)/components/MessageTimeline";
import { Composer } from "@/app/(protected)/components/Composer";
import { useChatWorkspace } from "@/app/(protected)/ChatWorkspaceProvider";

export function ChatPage() {
  const { messages } = useChatWorkspace();
  const isEmptyConversation = messages.length === 0;

  return (
    <>
      <div className="hidden h-12 items-center border-b border-[var(--lc-border)] px-4 md:flex">
        <ModelSelector />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {isEmptyConversation ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-16">
            <div className="relative w-full">
              <div className="absolute inset-x-0 bottom-full mb-12">
                <MessageTimeline />
              </div>
              <Composer placement="center" />
            </div>
          </div>
        ) : (
          <>
            <MessageTimeline />

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
              <Composer />
            </div>
          </>
        )}
      </div>
    </>
  );
}
