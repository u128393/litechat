import { cookies, headers } from "next/headers";

import { ChatWorkspaceProvider } from "@/app/(protected)/ChatWorkspaceProvider";
import { ProtectedShell } from "@/app/(protected)/ProtectedShell";
import { appLocaleRequestHeaderName, resolveRequestLocale } from "@/lib/i18n/locales";
import { LocaleProvider } from "@/lib/i18n/provider";
import { resolveSidebarCollapsedPreference, sidebarCollapsedCookieName } from "@/lib/preferences";
import { requireCurrentUser } from "@/server/auth/guards";

type ProtectedLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const currentUser = await requireCurrentUser();
  const requestHeaders = await headers();
  const requestCookies = await cookies();
  const initialLocale = resolveRequestLocale({
    headerLocale: requestHeaders.get(appLocaleRequestHeaderName),
    acceptLanguage: requestHeaders.get("accept-language")
  });
  const initialSidebarCollapsed =
    resolveSidebarCollapsedPreference(requestCookies.get(sidebarCollapsedCookieName)?.value) ?? false;

  return (
    <LocaleProvider userId={currentUser.userId} initialLocale={initialLocale}>
      <ChatWorkspaceProvider userId={currentUser.userId}>
        <ProtectedShell currentUser={currentUser} initialSidebarCollapsed={initialSidebarCollapsed}>
          {children}
        </ProtectedShell>
      </ChatWorkspaceProvider>
    </LocaleProvider>
  );
}
