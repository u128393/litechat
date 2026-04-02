import type { Metadata } from "next";
import "./globals.css";
import { appConfig } from "@/server/config/app-config";

export const metadata: Metadata = {
  title: appConfig.app.name,
  description: appConfig.app.description
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
