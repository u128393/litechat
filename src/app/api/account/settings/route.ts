import { NextResponse } from "next/server";

import { requireApiUser } from "@/server/auth/api";
import { getCurrentUserSettings, updateCurrentUserSettings } from "@/server/user-settings";
import { parseUpdateUserSettingsRequest } from "@/server/user-settings/validation";

export async function GET() {
  const currentUser = await requireApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const settings = await getCurrentUserSettings(currentUser.userId);

  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const currentUser = await requireApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const parsedRequest = await parseUpdateUserSettingsRequest(request);

  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: parsedRequest.error, code: parsedRequest.code ?? "invalid_request" },
      { status: 400 }
    );
  }

  const result = await updateCurrentUserSettings(currentUser.userId, parsedRequest.data);

  if (!result.success) {
    return NextResponse.json({ error: result.error, code: result.error }, { status: 400 });
  }

  return NextResponse.json({ settings: result.settings });
}
