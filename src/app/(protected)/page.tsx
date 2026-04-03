"use client";

import { ModelSelector } from "@/app/(protected)/components/ModelSelector";
import { MessageTimeline } from "@/app/(protected)/components/MessageTimeline";
import { Composer } from "@/app/(protected)/components/Composer";

export default function HomePage() {
  return (
    <>
      {/* Desktop top bar with model selector */}
      <div className="hidden h-12 items-center border-b border-[var(--lc-border)] px-4 md:flex">
        <ModelSelector />
      </div>

      {/* Chat content */}
      <MessageTimeline />

      {/* Composer */}
      <Composer />
    </>
  );
}
