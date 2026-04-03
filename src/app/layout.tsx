import type { Metadata } from "next";
import { headers } from "next/headers";

import "./globals.css";
import { appConfig } from "@/server/config/app-config";
import { appLocaleRequestHeaderName, defaultAppLocale, resolveRequestLocale } from "@/lib/i18n/locales";

export const metadata: Metadata = {
  title: appConfig.app.name,
  description: appConfig.app.description
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default async function RootLayout({ children }: RootLayoutProps) {
  const requestHeaders = await headers();
  const locale = resolveRequestLocale({
    headerLocale: requestHeaders.get(appLocaleRequestHeaderName),
    acceptLanguage: requestHeaders.get("accept-language")
  });

  return (
    <html lang={locale ?? defaultAppLocale} suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  );
}
