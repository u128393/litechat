export type AppLocale = "en" | "zh-CN";

export const appLocaleStorageKey = "litechat.locale";
export const defaultAppLocale: AppLocale = "en";
export const supportedAppLocales: AppLocale[] = ["en", "zh-CN"];

export function resolveSupportedLocale(locale: string | null | undefined): AppLocale | null {
  if (!locale) {
    return null;
  }

  const normalizedLocale = locale.trim().toLowerCase();

  if (
    normalizedLocale === "zh" ||
    normalizedLocale === "zh-cn" ||
    normalizedLocale === "zh-hans" ||
    normalizedLocale.startsWith("zh-cn-") ||
    normalizedLocale.startsWith("zh-hans-")
  ) {
    return "zh-CN";
  }

  if (normalizedLocale === "en" || normalizedLocale.startsWith("en-")) {
    return "en";
  }

  return null;
}

export function detectBrowserLocale(): AppLocale {
  if (typeof navigator === "undefined") {
    return defaultAppLocale;
  }

  const browserLocales = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language
  ];

  for (const browserLocale of browserLocales) {
    const supportedLocale = resolveSupportedLocale(browserLocale);

    if (supportedLocale) {
      return supportedLocale;
    }
  }

  return defaultAppLocale;
}

export function getLocaleBootstrapScript(): string {
  return `(() => {
    try {
      const storedLocale = window.localStorage.getItem(${JSON.stringify(appLocaleStorageKey)});
      const browserLocales = [...(navigator.languages ?? []), navigator.language];
      const resolveLocale = (value) => {
        if (typeof value !== "string") {
          return null;
        }
        const normalizedValue = value.trim().toLowerCase();
        if (
          normalizedValue === "zh" ||
          normalizedValue === "zh-cn" ||
          normalizedValue === "zh-hans" ||
          normalizedValue.startsWith("zh-cn-") ||
          normalizedValue.startsWith("zh-hans-")
        ) {
          return "zh-CN";
        }
        if (normalizedValue === "en" || normalizedValue.startsWith("en-")) {
          return "en";
        }
        return null;
      };

      let nextLocale = resolveLocale(storedLocale);

      if (!nextLocale) {
        for (const browserLocale of browserLocales) {
          nextLocale = resolveLocale(browserLocale);
          if (nextLocale) {
            break;
          }
        }
      }

      document.documentElement.lang = nextLocale ?? ${JSON.stringify(defaultAppLocale)};
    } catch {
      document.documentElement.lang = ${JSON.stringify(defaultAppLocale)};
    }
  })();`;
}
