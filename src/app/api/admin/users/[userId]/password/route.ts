import { NextResponse } from "next/server";

import { requireAdminApiUser } from "@/server/auth/api";
import { resetManagedUserPassword } from "@/server/users";
import { parseResetManagedUserPasswordRequest } from "@/server/users/validation";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const currentUser = await requireAdminApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const parsedRequest = await parseResetManagedUserPasswordRequest(request);

  if (!parsedRequest.success) {
    return NextResponse.json({ error: parsedRequest.error, code: parsedRequest.code }, { status: 400 });
  }

  const { userId } = await context.params;
  const result = await resetManagedUserPassword(userId, parsedRequest.data.password);

  if (!result.success) {
    return NextResponse.json({ error: "User not found.", code: result.error }, { status: 404 });
  }

  return NextResponse.json({ user: result.user });
}
