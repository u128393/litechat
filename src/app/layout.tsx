import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiteChat",
  description: "A lightweight browser-based LLM chat workspace."
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
