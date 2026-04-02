import { NextResponse } from "next/server";

import { requireApiUser } from "@/server/auth/api";
import { listUserSelectableModels } from "@/server/model-configs";

export async function GET() {
  const currentUser = await requireApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const models = await listUserSelectableModels();

  return NextResponse.json({ models });
}
