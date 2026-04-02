import { createHmac, randomBytes, randomUUID } from "node:crypto";

import { appConfig } from "@/server/config/app-config";
import type { DatabaseConnection } from "@/server/db";
import type { UserRole } from "@/server/db/schema";

import { hashPassword, verifyPassword } from "@/server/auth/password";
import { getAuthRepository } from "@/server/auth/repository";
import type { AuthSession, AuthUser, CurrentUser, SessionRecord } from "@/server/auth/types";

type CreateUserInput = {
  email: string;
  password: string;
  role?: UserRole;
};

type CreateSessionResult = {
  session: SessionRecord;
  token: string;
};

export async function createUser(input: CreateUserInput, database?: DatabaseConnection): Promise<AuthUser> {
  const repository = getAuthRepository(database);
  const now = new Date().toISOString();
  const normalizedEmail = normalizeEmail(input.email);
  const user = {
    id: randomUUID(),
    email: normalizedEmail,
    passwordHash: await hashPassword(input.password),
    role: input.role ?? "user",
    createdAt: now,
    updatedAt: now
  };

  await repository.createUser(user);

  return toAuthUser(user);
}

export async function verifyUserPassword(email: string, password: string, database?: DatabaseConnection): Promise<AuthUser | null> {
  const repository = getAuthRepository(database);
  const user = await repository.getUserByEmail(normalizeEmail(email));

  if (!user) {
    return null;
  }

  const passwordMatches = await verifyPassword(user.passwordHash, password);

  return passwordMatches ? toAuthUser(user) : null;
}

export async function getUserById(userId: string, database?: DatabaseConnection): Promise<AuthUser | null> {
  const repository = getAuthRepository(database);
  const user = await repository.getUserById(userId);

  return user ? toAuthUser(user) : null;
}

export async function createSession(userId: string, database?: DatabaseConnection): Promise<CreateSessionResult> {
  const repository = getAuthRepository(database);
  const now = new Date();
  const token = randomBytes(32).toString("base64url");
  const session = {
    id: randomUUID(),
    userId,
    tokenHash: hashSessionToken(token),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + appConfig.auth.sessionTtlHours * 60 * 60 * 1000).toISOString(),
    invalidatedAt: null
  };

  await repository.createSession(session);

  return {
    session,
    token
  };
}

export async function getAuthSession(token: string, database?: DatabaseConnection): Promise<AuthSession | null> {
  const repository = getAuthRepository(database);
  const result = await repository.getSessionByTokenHash(hashSessionToken(token), new Date().toISOString());

  if (!result) {
    return null;
  }

  return {
    session: result.session,
    user: {
      id: result.user.id,
      email: result.user.email,
      role: result.user.role
    }
  };
}

export async function resolveCurrentUserFromToken(token: string, database?: DatabaseConnection): Promise<CurrentUser | null> {
  const authSession = await getAuthSession(token, database);

  if (!authSession) {
    return null;
  }

  return {
    sessionId: authSession.session.id,
    userId: authSession.user.id,
    email: authSession.user.email,
    role: authSession.user.role,
    expiresAt: authSession.session.expiresAt
  };
}

export async function invalidateSession(sessionId: string, database?: DatabaseConnection): Promise<boolean> {
  const repository = getAuthRepository(database);
  return repository.invalidateSessionById(sessionId, new Date().toISOString());
}

export async function invalidateSessionToken(token: string, database?: DatabaseConnection): Promise<boolean> {
  const repository = getAuthRepository(database);
  return repository.invalidateSessionByTokenHash(hashSessionToken(token), new Date().toISOString());
}

export function hashSessionToken(token: string): string {
  return createHmac("sha256", appConfig.auth.sessionSecret).update(token).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toAuthUser(user: {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
