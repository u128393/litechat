import { NextResponse } from "next/server";

import { requireAdminApiUser } from "@/server/auth/api";
import { createProviderConfig, listProviderConfigs } from "@/server/providers";
import { parseCreateProviderConfigRequest } from "@/server/providers/validation";

export async function GET() {
  const currentUser = await requireAdminApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const providerConfigs = await listProviderConfigs();

  return NextResponse.json({ providerConfigs });
}

export async function POST(request: Request) {
  const currentUser = await requireAdminApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const parsedRequest = await parseCreateProviderConfigRequest(request);

  if (!parsedRequest.success) {
    return NextResponse.json({ error: parsedRequest.error }, { status: 400 });
  }

  const providerConfig = await createProviderConfig(parsedRequest.data);

  return NextResponse.json({ providerConfig }, { status: 201 });
}
