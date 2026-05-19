import { createUser, invalidateSessionsByUserId } from "@/server/auth";
import { hashPassword } from "@/server/auth/password";
import { getAuthRepository, type UserRow } from "@/server/auth/repository";
import type { DatabaseConnection, UserRole } from "@/server/db";

export type ManagedUser = {
  id: string;
  email: string;
  role: UserRole;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateManagedUserInput = {
  email: string;
  password: string;
  role: UserRole;
  enabled?: boolean;
};

export type UpdateManagedUserInput = {
  enabled?: boolean;
};

export type CreateManagedUserResult =
  | { success: true; user: ManagedUser }
  | { success: false; error: "email_exists" };

export type UpdateManagedUserResult =
  | { success: true; user: ManagedUser }
  | { success: false; error: "user_not_found" | "cannot_disable_self" };

export type DeleteManagedUserResult =
  | { success: true }
  | { success: false; error: "user_not_found" | "cannot_delete_self" };

export type ResetManagedUserPasswordResult =
  | { success: true; user: ManagedUser }
  | { success: false; error: "user_not_found" };

export async function listManagedUsers(database?: DatabaseConnection): Promise<ManagedUser[]> {
  const repository = getAuthRepository(database);
  const users = await repository.listUsers();

  return users.map(toManagedUser);
}

export async function createManagedUser(
  input: CreateManagedUserInput,
  database?: DatabaseConnection
): Promise<CreateManagedUserResult> {
  const repository = getAuthRepository(database);
  const existingUser = await repository.getUserByEmail(normalizeEmail(input.email));

  if (existingUser) {
    return { success: false, error: "email_exists" };
  }

  const user = await createUser(
    {
      email: input.email,
      password: input.password,
      role: input.role
    },
    database
  );

  if (input.enabled === false) {
    const now = new Date().toISOString();
    await repository.updateUser(user.id, { enabled: false, updatedAt: now });
    return {
      success: true,
      user: {
        ...user,
        enabled: false,
        updatedAt: now
      }
    };
  }

  return {
    success: true,
    user
  };
}

export async function updateManagedUser(
  userId: string,
  actorUserId: string,
  input: UpdateManagedUserInput,
  database?: DatabaseConnection
): Promise<UpdateManagedUserResult> {
  const repository = getAuthRepository(database);
  const existingUser = await repository.getUserById(userId);

  if (!existingUser) {
    return { success: false, error: "user_not_found" };
  }

  if (input.enabled === false && userId === actorUserId) {
    return { success: false, error: "cannot_disable_self" };
  }

  const updates: Parameters<typeof repository.updateUser>[1] = {
    updatedAt: new Date().toISOString()
  };

  if (input.enabled !== undefined) {
    updates.enabled = input.enabled;
  }

  const updated = await repository.updateUser(userId, updates);

  if (!updated) {
    return { success: false, error: "user_not_found" };
  }

  if (input.enabled === false) {
    await invalidateSessionsByUserId(userId, database);
  }

  const user = await repository.getUserById(userId);

  return user ? { success: true, user: toManagedUser(user) } : { success: false, error: "user_not_found" };
}

export async function deleteManagedUser(
  userId: string,
  actorUserId: string,
  database?: DatabaseConnection
): Promise<DeleteManagedUserResult> {
  if (userId === actorUserId) {
    return { success: false, error: "cannot_delete_self" };
  }

  const repository = getAuthRepository(database);
  const deleted = await repository.deleteUser(userId);

  return deleted ? { success: true } : { success: false, error: "user_not_found" };
}

export async function resetManagedUserPassword(
  userId: string,
  password: string,
  database?: DatabaseConnection
): Promise<ResetManagedUserPasswordResult> {
  const repository = getAuthRepository(database);
  const now = new Date().toISOString();
  const updated = await repository.updateUserPassword(userId, await hashPassword(password), now);

  if (!updated) {
    return { success: false, error: "user_not_found" };
  }

  await invalidateSessionsByUserId(userId, database);

  const user = await repository.getUserById(userId);

  return user ? { success: true, user: toManagedUser(user) } : { success: false, error: "user_not_found" };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toManagedUser(user: UserRow): ManagedUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    enabled: user.enabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
