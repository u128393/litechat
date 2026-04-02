import { ChatWorkspaceProvider } from "@/app/(protected)/ChatWorkspaceProvider";
import { ProtectedShell } from "@/app/(protected)/ProtectedShell";
import { LocaleProvider } from "@/lib/i18n/provider";
import { requireCurrentUser } from "@/server/auth/guards";

type ProtectedLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const currentUser = await requireCurrentUser();

  return (
    <LocaleProvider userId={currentUser.userId}>
      <ChatWorkspaceProvider userId={currentUser.userId}>
        <ProtectedShell currentUser={currentUser}>{children}</ProtectedShell>
      </ChatWorkspaceProvider>
    </LocaleProvider>
  );
}
