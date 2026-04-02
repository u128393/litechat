import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { logout } from "@/server/auth";

export async function POST(request: Request) {
  await logout(await cookies());

  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
