"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Menu } from "lucide-react";

import { useChatWorkspace } from "@/app/(protected)/ChatWorkspaceProvider";
import { ChatSearchDialog } from "@/app/(protected)/components/ChatSearchDialog";
import type { CurrentUser } from "@/server/auth/types";
import { Sidebar } from "@/app/(protected)/components/Sidebar";
import { UserMenu } from "@/app/(protected)/components/UserMenu";
import { MobileDrawer } from "@/app/(protected)/components/MobileDrawer";
import { MobileModelSelector } from "@/app/(protected)/components/MobileModelSelector";
import { ConversationExportMenu } from "@/app/(protected)/components/ConversationExportMenu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { createBrowserPreferencesStore } from "@/lib/preferences";

type ProtectedShellProps = {
  currentUser: Pick<CurrentUser, "userId" | "email" | "role">;
  initialSidebarCollapsed: boolean;
  children: React.ReactNode;
};

export function ProtectedShell({ currentUser, initialSidebarCollapsed, children }: ProtectedShellProps) {
  const { messages } = useI18n();
  const { createNewConversation } = useChatWorkspace();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [shortcutPlatform, setShortcutPlatform] = useState<"mac" | "other">("other");
  const preferencesStore = useMemo(() => createBrowserPreferencesStore(currentUser.userId), [currentUser.userId]);

  useEffect(() => {
    const platform = navigator.platform.toLowerCase();
    const userAgent = navigator.userAgent.toLowerCase();
    setShortcutPlatform(platform.includes("mac") || userAgent.includes("mac") ? "mac" : "other");
  }, []);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) {
        return;
      }

      const key = event.key.toLowerCase();
      const hasCommandModifier = event.metaKey || event.ctrlKey;

      if (!hasCommandModifier || event.altKey) {
        return;
      }

      if (event.shiftKey && key === "o") {
        event.preventDefault();
        void createNewConversation();
        return;
      }

      if (!event.shiftKey && key === "k") {
        event.preventDefault();
        openSearchDialog();
        return;
      }

      if (event.shiftKey && key === "s") {
        event.preventDefault();
        toggleNavigation();
        return;
      }

      if (!event.shiftKey && (event.key === "/" || event.code === "Slash")) {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function handleSidebarCollapsedChange(nextCollapsed: boolean) {
    setSidebarCollapsed(nextCollapsed);
    void preferencesStore.setSidebarCollapsed(nextCollapsed);
  }

  function openSearchDialog() {
    setMobileMenuOpen(false);
    setSearchOpen(true);
  }

  function toggleNavigation() {
    if (window.matchMedia("(min-width: 768px)").matches) {
      handleSidebarCollapsedChange(!sidebarCollapsed);
      return;
    }

    setMobileMenuOpen((open) => !open);
  }

  return (
    <div className="flex h-dvh bg-[var(--lc-bg-primary)]">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-[var(--lc-border)] bg-[var(--lc-bg-secondary)] transition-[width] duration-200 ease-out md:flex",
          sidebarCollapsed ? "w-[48px]" : "w-[260px]"
        )}
      >
        <Sidebar
          className="flex-1 min-h-0"
          collapsed={sidebarCollapsed}
          onCollapsedChange={handleSidebarCollapsedChange}
          onSearchOpen={openSearchDialog}
        />
        <div className="px-1 py-3">
          <UserMenu currentUser={currentUser} collapsed={sidebarCollapsed} />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex h-12 items-center justify-between border-b border-[var(--lc-border)] px-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex size-8 items-center justify-center rounded-lg text-[var(--lc-text-primary)] hover:bg-[var(--lc-bg-tertiary)]"
          >
            <Menu className="size-5" />
          </button>
          <MobileModelSelector />
          <ConversationExportMenu />
        </div>

        {children}
      </div>

      {/* Mobile drawer */}
      <MobileDrawer
        currentUser={currentUser}
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        onSearchOpen={openSearchDialog}
      />

      <ChatSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        platform={shortcutPlatform}
      />
    </div>
  );
}

type KeyboardShortcutsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: "mac" | "other";
};

function KeyboardShortcutsDialog({ open, onOpenChange, platform }: KeyboardShortcutsDialogProps) {
  const { messages } = useI18n();
  const titleSectionRef = useRef<HTMLDivElement>(null);
  const shortcuts = [
    {
      label: messages.shell.newChat,
      keys: platform === "mac" ? ["⇧", "⌘", "O"] : ["Ctrl", "Shift", "O"]
    },
    {
      label: messages.shell.searchChat,
      keys: platform === "mac" ? ["⌘", "K"] : ["Ctrl", "K"]
    },
    {
      label: messages.shell.toggleSidebar,
      keys: platform === "mac" ? ["⇧", "⌘", "S"] : ["Ctrl", "Shift", "S"]
    },
    {
      label: messages.shell.showKeyboardShortcuts,
      keys: platform === "mac" ? ["⌘", "/"] : ["Ctrl", "/"]
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        initialFocus={titleSectionRef}
        className="max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-[20px] border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] p-0 shadow-2xl sm:max-w-[480px]"
        closeLabel={messages.common.close}
      >
        <div ref={titleSectionRef} tabIndex={-1} className="border-b border-[var(--lc-border)] px-5 py-4 outline-none">
          <DialogTitle className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--lc-text-primary)]">
            {messages.shell.keyboardShortcutsTitle}
          </DialogTitle>
          <p className="mt-1 text-[14px] leading-5 text-[var(--lc-text-secondary)]">
            {messages.shell.keyboardShortcutsDescription}
          </p>
        </div>

        <div className="flex flex-col gap-1 px-3 py-3">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.label}
              className="flex min-h-12 items-center justify-between gap-4 rounded-xl px-2 py-2 text-[15px] text-[var(--lc-text-primary)]"
            >
              <span>{shortcut.label}</span>
              <span className="flex shrink-0 items-center gap-1.5" aria-label={shortcut.keys.join(" + ")}>
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="flex h-7 min-w-7 items-center justify-center rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-secondary)] px-2 text-[13px] font-semibold text-[var(--lc-text-secondary)] shadow-sm"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
