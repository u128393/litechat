import { NextResponse, type NextRequest } from "next/server";

import {
  appLocaleCookieMaxAgeSeconds,
  appLocaleCookieName,
  appLocaleRequestHeaderName,
  resolveRequestLocale,
  resolveSupportedLocale
} from "@/lib/i18n/locales";

export function proxy(request: NextRequest) {
  const resolvedLocale = resolveRequestLocale({
    cookieLocale: request.cookies.get(appLocaleCookieName)?.value,
    acceptLanguage: request.headers.get("accept-language")
  });
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set(appLocaleRequestHeaderName, resolvedLocale);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
  const cookieLocale = resolveSupportedLocale(request.cookies.get(appLocaleCookieName)?.value);

  if (cookieLocale !== resolvedLocale) {
    response.cookies.set(appLocaleCookieName, resolvedLocale, {
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: appLocaleCookieMaxAgeSeconds
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
