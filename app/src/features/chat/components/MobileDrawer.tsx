import type { CurrentUser } from "@/shared/types";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "@/features/chat/components/Sidebar";
import { UserMenu } from "@/features/chat/components/UserMenu";
import { useI18n } from "@/lib/i18n/context";

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
        <Sidebar onSearchOpen={onSearchOpen} onNavigate={() => onOpenChange(false)} />
        <div className="p-3">
          <UserMenu currentUser={currentUser} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
