import { cookies } from "next/headers";

import { appConfig } from "@/server/config/app-config";
import type { DatabaseConnection } from "@/server/db";

import { createSession, invalidateSessionToken, resolveCurrentUserFromToken } from "@/server/auth/service";
import type { CurrentUser } from "@/server/auth/types";

type CookieValue = { value: string } | undefined;

export type SessionCookieReader = {
  get: (name: string) => CookieValue;
};

export type SessionCookieStore = SessionCookieReader & {
  set: (name: string, value: string, options: SessionCookieOptions) => void;
  delete: (name: string) => void;
};

type SessionCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  expires: Date;
};

export function readSessionToken(cookieStore: SessionCookieReader): string | null {
  return cookieStore.get(appConfig.auth.sessionCookieName)?.value ?? null;
}

export function setSessionCookie(cookieStore: SessionCookieStore, token: string, expiresAt: string): void {
  cookieStore.set(appConfig.auth.sessionCookieName, token, buildSessionCookieOptions(expiresAt));
}

export function clearSessionCookie(cookieStore: SessionCookieStore): void {
  cookieStore.delete(appConfig.auth.sessionCookieName);
}

export async function createSessionCookie(userId: string, cookieStore: SessionCookieStore, database?: DatabaseConnection) {
  const createdSession = await createSession(userId, database);
  setSessionCookie(cookieStore, createdSession.token, createdSession.session.expiresAt);
  return createdSession;
}

export async function getCurrentUserFromCookieStore(
  cookieStore: SessionCookieReader,
  database?: DatabaseConnection
): Promise<CurrentUser | null> {
  const token = readSessionToken(cookieStore);

  return token ? resolveCurrentUserFromToken(token, database) : null;
}

export async function getCurrentUser(database?: DatabaseConnection): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  return getCurrentUserFromCookieStore(cookieStore, database);
}

export async function logout(
  cookieStore: SessionCookieStore,
  database?: DatabaseConnection
): Promise<{ invalidated: boolean }> {
  const token = readSessionToken(cookieStore);
  const invalidated = token ? await invalidateSessionToken(token, database) : false;

  clearSessionCookie(cookieStore);

  return { invalidated };
}

function buildSessionCookieOptions(expiresAt: string): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: appConfig.auth.secureCookies,
    path: "/",
    expires: new Date(expiresAt)
  };
}
