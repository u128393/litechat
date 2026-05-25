import { useEffect, useMemo, useState } from "react";

import { getMessages } from "@/lib/i18n/messages";
import { writeLocaleCookie, type AppLocale } from "@/lib/i18n/locales";
import { createBrowserPreferencesStore } from "@/lib/preferences";
import { LocaleContext, type LocaleContextValue } from "@/lib/i18n/context";

export function LocaleProvider({
  userId,
  initialLocale,
  children
}: {
  userId: string;
  initialLocale: AppLocale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);

  useEffect(() => {
    let active = true;

    void createBrowserPreferencesStore(userId)
      .resolveLanguagePreference()
      .then((resolvedLocale) => {
        if (!active) {
          return;
        }

        setLocaleState(resolvedLocale);
        writeLocaleCookie(resolvedLocale);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const contextValue = useMemo<LocaleContextValue>(
    () => ({
      locale,
      messages: getMessages(locale),
      async setLocale(nextLocale) {
        setLocaleState(nextLocale);
        document.documentElement.lang = nextLocale;
        await createBrowserPreferencesStore(userId).setLanguagePreference(nextLocale);
      }
    }),
    [locale, userId]
  );

  return <LocaleContext.Provider value={contextValue}>{children}</LocaleContext.Provider>;
}
