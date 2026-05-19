import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";

import "./globals.css";
import { appConfig } from "@/server/config/app-config";
import { appLocaleRequestHeaderName, defaultAppLocale, resolveRequestLocale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

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
    <html lang={locale ?? defaultAppLocale} suppressHydrationWarning className={cn(inter.variable)}>
      <body className="font-sans antialiased">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
