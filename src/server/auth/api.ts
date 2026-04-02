import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth/roles";
import { getCurrentUser } from "@/server/auth";
import type { CurrentUser } from "@/server/auth/types";

export async function requireAdminApiUser(): Promise<CurrentUser | NextResponse> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return jsonError("Authentication required.", 401);
  }

  if (!isAdminUser(currentUser)) {
    return jsonError("Admin access required.", 403);
  }

  return currentUser;
}

export async function requireApiUser(): Promise<CurrentUser | NextResponse> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return jsonError("Authentication required.", 401);
  }

  return currentUser;
}

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
