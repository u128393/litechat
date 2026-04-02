import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { changePassword, clearSessionCookie } from "@/server/auth";
import { jsonError, requireApiUser } from "@/server/auth/api";

export async function POST(request: Request) {
  const currentUser = await requireApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const parsedRequest = await parseRequest(request);

  if (!parsedRequest.success) {
    return jsonError(parsedRequest.error, 400);
  }

  if (parsedRequest.data.newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters.", code: "min_length" }, { status: 400 });
  }

  const result = await changePassword({
    userId: currentUser.userId,
    currentPassword: parsedRequest.data.currentPassword,
    nextPassword: parsedRequest.data.newPassword
  });

  if (!result.success) {
    if (result.reason === "invalid_credentials") {
      return NextResponse.json({ error: "Current password is incorrect.", code: "invalid_credentials" }, { status: 400 });
    }

    return jsonError("User not found.", 404);
  }

  clearSessionCookie(await cookies());

  return NextResponse.json({ success: true, redirectTo: "/login?password_changed=1" });
}

async function parseRequest(request: Request): Promise<
  | { success: true; data: { currentPassword: string; newPassword: string } }
  | { success: false; error: string }
> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return { success: false, error: "Invalid request body." };
  }

  if (!body || typeof body !== "object") {
    return { success: false, error: "Invalid request body." };
  }

  const { currentPassword, newPassword } = body as Record<string, unknown>;

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return { success: false, error: "Current and new passwords are required." };
  }

  if (currentPassword.length === 0 || newPassword.length === 0) {
    return { success: false, error: "Current and new passwords are required." };
  }

  return {
    success: true,
    data: {
      currentPassword,
      newPassword
    }
  };
}
