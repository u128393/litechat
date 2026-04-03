"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import type { CurrentUser } from "@/server/auth/types";
import { Sidebar } from "@/app/(protected)/components/Sidebar";
import { UserMenu } from "@/app/(protected)/components/UserMenu";
import { MobileDrawer } from "@/app/(protected)/components/MobileDrawer";
import { MobileModelSelector } from "@/app/(protected)/components/MobileModelSelector";

type ProtectedShellProps = {
  currentUser: Pick<CurrentUser, "userId" | "email" | "role">;
  children: React.ReactNode;
};

export function ProtectedShell({ currentUser, children }: ProtectedShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const initials = currentUser.email.slice(0, 2).toUpperCase();

  return (
    <div className="flex h-dvh bg-[var(--lc-bg-primary)]">
      {/* Desktop Sidebar */}
      <aside className="hidden w-[280px] shrink-0 flex-col border-r border-[var(--lc-border)] bg-[var(--lc-bg-secondary)] md:flex">
        <Sidebar className="flex-1 min-h-0" />
        <div className="border-t border-[var(--lc-border)] p-3">
          <UserMenu currentUser={currentUser} />
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
