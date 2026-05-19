import { NextResponse } from "next/server";

import { requireAdminApiUser } from "@/server/auth/api";
import { getAppSettings, updateAppSettings } from "@/server/app-settings";
import { parseUpdateAppSettingsRequest } from "@/server/app-settings/validation";

export async function GET() {
  const currentUser = await requireAdminApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const settings = await getAppSettings();

  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const currentUser = await requireAdminApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const parsedRequest = await parseUpdateAppSettingsRequest(request);

  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: parsedRequest.error, code: parsedRequest.code ?? "invalid_request" },
      { status: 400 }
    );
  }

  const result = await updateAppSettings(parsedRequest.data);

  if (!result.success) {
    return NextResponse.json({ error: result.error, code: result.error }, { status: 400 });
  }

  return NextResponse.json({ settings: result.settings });
}
