"use client";

import { useMemo, useState } from "react";
import { Menu } from "lucide-react";

import type { CurrentUser } from "@/server/auth/types";
import { Sidebar } from "@/app/(protected)/components/Sidebar";
import { UserMenu } from "@/app/(protected)/components/UserMenu";
import { MobileDrawer } from "@/app/(protected)/components/MobileDrawer";
import { MobileModelSelector } from "@/app/(protected)/components/MobileModelSelector";
import { cn } from "@/lib/utils";
import { createBrowserPreferencesStore } from "@/lib/preferences";

type ProtectedShellProps = {
  currentUser: Pick<CurrentUser, "userId" | "email" | "role">;
  initialSidebarCollapsed: boolean;
  children: React.ReactNode;
};

export function ProtectedShell({ currentUser, initialSidebarCollapsed, children }: ProtectedShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed);
  const preferencesStore = useMemo(() => createBrowserPreferencesStore(currentUser.userId), [currentUser.userId]);
  const initials = currentUser.email.slice(0, 2).toUpperCase();

  function handleSidebarCollapsedChange(nextCollapsed: boolean) {
    setSidebarCollapsed(nextCollapsed);
    void preferencesStore.setSidebarCollapsed(nextCollapsed);
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
        />
        <div className="px-1 py-3">
          <UserMenu currentUser={currentUser} collapsed={sidebarCollapsed} />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex min-h-0 flex-1 flex-col">
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
          <div className="flex size-7 items-center justify-center rounded-full bg-[var(--lc-accent)] text-[10px] font-semibold text-white">
            {initials}
          </div>
        </div>

        {children}
      </div>

      {/* Mobile drawer */}
      <MobileDrawer
        currentUser={currentUser}
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
      />
    </div>
  );
}
