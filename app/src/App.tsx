import { useMemo } from "react";
import { BrowserRouter } from "react-router-dom";

import { AppRouter } from "@/router/AppRouter";
import { ThemeProvider } from "@/shared/theme/ThemeProvider";
import { AuthProvider } from "@/shared/auth/AuthProvider";
import { useAuth } from "@/shared/auth/auth-context";
import { LocaleProvider } from "@/lib/i18n/provider";
import { Toaster } from "@/components/ui/sonner";
import { detectBrowserLocale } from "@/lib/i18n/locales";

export function App() {
  const initialLocale = useMemo(() => detectBrowserLocale(), []);

  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppProviders initialLocale={initialLocale} />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

function AppProviders({ initialLocale }: { initialLocale: ReturnType<typeof detectBrowserLocale> }) {
  const { currentUser } = useAuth();

  return (
    <LocaleProvider key={currentUser?.userId ?? "anonymous"} userId={currentUser?.userId ?? "anonymous"} initialLocale={initialLocale}>
      <AppRouter />
      <Toaster />
    </LocaleProvider>
  );
}
