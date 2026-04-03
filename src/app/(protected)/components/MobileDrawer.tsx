"use client";

import type { CurrentUser } from "@/server/auth/types";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "@/app/(protected)/components/Sidebar";
import { UserMenu } from "@/app/(protected)/components/UserMenu";

type MobileDrawerProps = {
  currentUser: Pick<CurrentUser, "userId" | "email" | "role">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MobileDrawer({ currentUser, open, onOpenChange }: MobileDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[330px] flex flex-col p-0 bg-[var(--lc-bg-secondary)] border-r border-[var(--lc-border)] shadow-xl"
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <Sidebar />
        <div className="border-t border-[var(--lc-border)] p-3">
          <UserMenu currentUser={currentUser} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
