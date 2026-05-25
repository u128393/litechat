export type AppLocale = "en" | "zh-CN";

export const appLocaleCookieName = "litechat.locale";
export const appLocaleStorageKey = "litechat.locale";
export const appLocaleRequestHeaderName = "x-litechat-locale";
export const appLocaleCookieMaxAgeSeconds = 60 * 60 * 24 * 365;
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

export function resolveAcceptLanguageLocale(headerValue: string | null | undefined): AppLocale | null {
  if (!headerValue) {
    return null;
  }

  for (const entry of headerValue.split(",")) {
    const acceptedLocale = resolveSupportedLocale(entry.split(";")[0]);

    if (acceptedLocale) {
      return acceptedLocale;
    }
  }

  return null;
}

export function resolveRequestLocale({
  cookieLocale,
  headerLocale,
  acceptLanguage
}: {
  cookieLocale?: string | null;
  headerLocale?: string | null;
  acceptLanguage?: string | null;
}): AppLocale {
  return (
    resolveSupportedLocale(headerLocale) ??
    resolveSupportedLocale(cookieLocale) ??
    resolveAcceptLanguageLocale(acceptLanguage) ??
    defaultAppLocale
  );
}

export function writeLocaleCookie(locale: AppLocale): void {
  if (typeof document === "undefined") {
    return;
  }

  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${appLocaleCookieName}=${encodeURIComponent(locale)}; Path=/; Max-Age=${appLocaleCookieMaxAgeSeconds}; SameSite=Lax${secure}`;
}
