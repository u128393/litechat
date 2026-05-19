import { NextResponse } from "next/server";

import { requireAdminApiUser } from "@/server/auth/api";
import { deleteManagedUser, updateManagedUser } from "@/server/users";
import { parseUpdateManagedUserRequest } from "@/server/users/validation";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const currentUser = await requireAdminApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const parsedRequest = await parseUpdateManagedUserRequest(request);

  if (!parsedRequest.success) {
    return NextResponse.json({ error: parsedRequest.error, code: parsedRequest.code }, { status: 400 });
  }

  const { userId } = await context.params;
  const result = await updateManagedUser(userId, currentUser.userId, parsedRequest.data);

  if (!result.success) {
    if (result.error === "cannot_disable_self") {
      return NextResponse.json({ error: "You cannot disable your own account.", code: result.error }, { status: 400 });
    }

    return NextResponse.json({ error: "User not found.", code: result.error }, { status: 404 });
  }

  return NextResponse.json({ user: result.user });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const currentUser = await requireAdminApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const { userId } = await context.params;
  const result = await deleteManagedUser(userId, currentUser.userId);

  if (!result.success) {
    if (result.error === "cannot_delete_self") {
      return NextResponse.json({ error: "You cannot delete your own account.", code: result.error }, { status: 400 });
    }

    return NextResponse.json({ error: "User not found.", code: result.error }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
