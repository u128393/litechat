import { headers } from "next/headers";

import { ChatWorkspaceProvider } from "@/app/(protected)/ChatWorkspaceProvider";
import { ProtectedShell } from "@/app/(protected)/ProtectedShell";
import { appLocaleRequestHeaderName, resolveRequestLocale } from "@/lib/i18n/locales";
import { LocaleProvider } from "@/lib/i18n/provider";
import { requireCurrentUser } from "@/server/auth/guards";

type ProtectedLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const currentUser = await requireCurrentUser();
  const requestHeaders = await headers();
  const initialLocale = resolveRequestLocale({
    headerLocale: requestHeaders.get(appLocaleRequestHeaderName),
    acceptLanguage: requestHeaders.get("accept-language")
  });

  return (
    <LocaleProvider userId={currentUser.userId} initialLocale={initialLocale}>
      <ChatWorkspaceProvider userId={currentUser.userId}>
        <ProtectedShell currentUser={currentUser}>{children}</ProtectedShell>
      </ChatWorkspaceProvider>
    </LocaleProvider>
  );
}
