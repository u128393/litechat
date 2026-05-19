import { and, asc, eq, gt, isNull } from "drizzle-orm";

import { defineRepository } from "@/server/db";
import { sessions, users, type UserRole } from "@/server/db/schema";

export type UserRow = {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type SessionRow = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  invalidatedAt: string | null;
};

export const getAuthRepository = defineRepository(({ db }) => {
  const database = db as any;

  return {
    async createUser(user: UserRow): Promise<void> {
      await database.insert(users).values(user);
    },

    async listUsers(): Promise<UserRow[]> {
      return database.select().from(users).orderBy(asc(users.createdAt), asc(users.email));
    },

    async getUserById(userId: string): Promise<UserRow | null> {
      const [user] = await database.select().from(users).where(eq(users.id, userId)).limit(1);
      return user ?? null;
    },

    async getUserByEmail(email: string): Promise<UserRow | null> {
      const [user] = await database.select().from(users).where(eq(users.email, email)).limit(1);
      return user ?? null;
    },

    async updateUserPassword(userId: string, passwordHash: string, updatedAt: string): Promise<boolean> {
      const [user] = await database.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);

      if (!user) {
        return false;
      }

      await database.update(users).set({ passwordHash, updatedAt }).where(eq(users.id, userId));

      return true;
    },

    async updateUser(userId: string, updates: Partial<Pick<UserRow, "email" | "passwordHash" | "role" | "enabled" | "updatedAt">>): Promise<boolean> {
      const [user] = await database.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);

      if (!user) {
        return false;
      }

      await database.update(users).set(updates).where(eq(users.id, userId));

      return true;
    },

    async deleteUser(userId: string): Promise<boolean> {
      const [user] = await database.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);

      if (!user) {
        return false;
      }

      await database.delete(users).where(eq(users.id, userId));

      return true;
    },

    async createSession(session: SessionRow): Promise<void> {
      await database.insert(sessions).values(session);
    },

    async getSessionByTokenHash(tokenHash: string, now: string): Promise<{ session: SessionRow; user: UserRow } | null> {
      const [result] = await database
        .select({
          session: sessions,
          user: users
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(
          and(
            eq(sessions.tokenHash, tokenHash),
            isNull(sessions.invalidatedAt),
            gt(sessions.expiresAt, now)
          )
        )
        .limit(1);

      return result ?? null;
    },

    async invalidateSessionById(sessionId: string, invalidatedAt: string): Promise<boolean> {
      const [session] = await database
        .select({ id: sessions.id })
        .from(sessions)
        .where(and(eq(sessions.id, sessionId), isNull(sessions.invalidatedAt)))
        .limit(1);

      if (!session) {
        return false;
      }

      await database.update(sessions).set({ invalidatedAt }).where(eq(sessions.id, sessionId));

      return true;
    },

    async invalidateSessionByTokenHash(tokenHash: string, invalidatedAt: string): Promise<boolean> {
      const [session] = await database
        .select({ id: sessions.id })
        .from(sessions)
        .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.invalidatedAt)))
        .limit(1);

      if (!session) {
        return false;
      }

      await database.update(sessions).set({ invalidatedAt }).where(eq(sessions.id, session.id));

      return true;
    },

    async invalidateSessionsByUserId(userId: string, invalidatedAt: string): Promise<number> {
      const activeSessions = await database
        .select({ id: sessions.id })
        .from(sessions)
        .where(and(eq(sessions.userId, userId), isNull(sessions.invalidatedAt)));

      if (activeSessions.length === 0) {
        return 0;
      }

      await database.update(sessions).set({ invalidatedAt }).where(and(eq(sessions.userId, userId), isNull(sessions.invalidatedAt)));

      return activeSessions.length;
    }
  };
});
