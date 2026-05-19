import { NextResponse } from "next/server";

import { requireAdminApiUser } from "@/server/auth/api";
import { createManagedUser, listManagedUsers } from "@/server/users";
import { parseCreateManagedUserRequest } from "@/server/users/validation";

export async function GET() {
  const currentUser = await requireAdminApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const users = await listManagedUsers();

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const currentUser = await requireAdminApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const parsedRequest = await parseCreateManagedUserRequest(request);

  if (!parsedRequest.success) {
    return NextResponse.json({ error: parsedRequest.error, code: parsedRequest.code }, { status: 400 });
  }

  const result = await createManagedUser(parsedRequest.data);

  if (!result.success) {
    return NextResponse.json({ error: "Email already exists.", code: result.error }, { status: 409 });
  }

  return NextResponse.json({ user: result.user }, { status: 201 });
}
