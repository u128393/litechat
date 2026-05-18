"use client";

import type { CurrentUser } from "@/server/auth/types";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "@/app/(protected)/components/Sidebar";
import { UserMenu } from "@/app/(protected)/components/UserMenu";
import { useI18n } from "@/lib/i18n/provider";

type MobileDrawerProps = {
  currentUser: Pick<CurrentUser, "userId" | "email" | "role">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearchOpen: () => void;
};

export function MobileDrawer({ currentUser, open, onOpenChange, onSearchOpen }: MobileDrawerProps) {
  const { messages } = useI18n();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[330px] flex flex-col p-0 bg-[var(--lc-bg-secondary)] border-r border-[var(--lc-border)] shadow-xl"
        showCloseButton={false}
        closeLabel={messages.common.close}
      >
        <SheetTitle className="sr-only">{messages.shell.navigation}</SheetTitle>
        <Sidebar onSearchOpen={onSearchOpen} />
        <div className="p-3">
          <UserMenu currentUser={currentUser} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
