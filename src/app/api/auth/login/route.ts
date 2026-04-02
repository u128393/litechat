import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createSessionCookie, verifyUserPassword } from "@/server/auth";
import { getSafeRedirectPath } from "@/server/auth/guards";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const nextPath = getSafeRedirectPath(formData.get("next"));

  if (typeof email !== "string" || typeof password !== "string") {
    return redirectToLogin(request, nextPath);
  }

  const user = await verifyUserPassword(email, password);

  if (!user) {
    return redirectToLogin(request, nextPath);
  }

  await createSessionCookie(user.id, await cookies());

  return NextResponse.redirect(new URL(nextPath, request.url), { status: 303 });
}

function redirectToLogin(request: Request, nextPath: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", "invalid_credentials");

  if (nextPath !== "/") {
    loginUrl.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(loginUrl, { status: 303 });
}
