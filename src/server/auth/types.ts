import type { UserRole } from "@/server/db/schema";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

export type SessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  invalidatedAt: string | null;
};

export type SessionUser = Pick<AuthUser, "id" | "email" | "role">;

export type AuthSession = {
  session: SessionRecord;
  user: SessionUser;
};

export type CurrentUser = {
  sessionId: string;
  userId: string;
  email: string;
  role: UserRole;
  expiresAt: string;
};
