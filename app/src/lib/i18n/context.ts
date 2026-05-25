import { createContext, useContext } from "react";

import type { AppMessages } from "@/lib/i18n/messages";
import type { AppLocale } from "@/lib/i18n/locales";

export type LocaleContextValue = {
  locale: AppLocale;
  messages: AppMessages;
  setLocale(locale: AppLocale): Promise<void>;
};

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useI18n(): LocaleContextValue {
  const contextValue = useContext(LocaleContext);

  if (!contextValue) {
    throw new Error("useI18n must be used within LocaleProvider.");
  }

  return contextValue;
}
