import type { Metadata } from "next";
import "./globals.css";
import { appConfig } from "@/server/config/app-config";
import { defaultAppLocale, getLocaleBootstrapScript } from "@/lib/i18n/locales";

export const metadata: Metadata = {
  title: appConfig.app.name,
  description: appConfig.app.description
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang={defaultAppLocale} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: getLocaleBootstrapScript() }} />
        {children}
      </body>
    </html>
  );
}
