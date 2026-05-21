"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { ModelSelector } from "@/app/(protected)/components/ModelSelector";
import { MessageTimeline } from "@/app/(protected)/components/MessageTimeline";
import { Composer } from "@/app/(protected)/components/Composer";
import { ConversationExportMenu } from "@/app/(protected)/components/ConversationExportMenu";
import { useChatWorkspace } from "@/app/(protected)/ChatWorkspaceProvider";

export function ChatPage() {
  const { routeConversationId, messages, branchContext } = useChatWorkspace();
  const composerOverlayRef = useRef<HTMLDivElement>(null);
  const [composerOverlayHeight, setComposerOverlayHeight] = useState(0);
  const isNewConversationEmpty = routeConversationId === null && !branchContext && messages.length === 0;

  useLayoutEffect(() => {
    const composerOverlay = composerOverlayRef.current;

    if (!composerOverlay) {
      setComposerOverlayHeight(0);
      return;
    }

    function updateComposerOverlayHeight() {
      setComposerOverlayHeight(composerOverlay?.getBoundingClientRect().height ?? 0);
    }

    updateComposerOverlayHeight();

    const resizeObserver = new ResizeObserver(updateComposerOverlayHeight);
    resizeObserver.observe(composerOverlay);

    return () => resizeObserver.disconnect();
  }, [isNewConversationEmpty]);

  return (
    <>
      <div className="hidden h-12 items-center justify-between border-b border-[var(--lc-border)] px-4 md:flex">
        <ModelSelector />
        <ConversationExportMenu />
      </div>

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {isNewConversationEmpty ? (
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
            {messages.length > 0 ? (
              <MessageTimeline composerOverlayHeight={composerOverlayHeight} />
            ) : (
              <div className="flex min-h-0 flex-1" />
            )}

            <div ref={composerOverlayRef} className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
              <Composer />
            </div>
          </>
        )}
      </div>
    </>
  );
}
