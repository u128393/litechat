import { redirect } from "next/navigation";

import { isAdminUser } from "@/lib/auth/roles";
import { getCurrentUser } from "@/server/auth/cookies";
import type { CurrentUser } from "@/server/auth/types";

export async function requireCurrentUser(): Promise<CurrentUser> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  return currentUser;
}

export async function requireAdminUser(): Promise<CurrentUser> {
  const currentUser = await requireCurrentUser();

  if (!isAdminUser(currentUser)) {
    redirect("/");
  }

  return currentUser;
}

export function getSafeRedirectPath(value: FormDataEntryValue | string | null | undefined, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0) {
    return fallback;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}
