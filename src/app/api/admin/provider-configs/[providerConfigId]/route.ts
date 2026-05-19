import { NextResponse } from "next/server";

import { requireAdminApiUser } from "@/server/auth/api";
import { deleteProviderConfig, updateProviderConfig } from "@/server/providers";
import { parseUpdateProviderConfigRequest } from "@/server/providers/validation";

type RouteContext = {
  params: Promise<{
    providerConfigId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const currentUser = await requireAdminApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const parsedRequest = await parseUpdateProviderConfigRequest(request);

  if (!parsedRequest.success) {
    return NextResponse.json({ error: parsedRequest.error }, { status: 400 });
  }

  const { providerConfigId } = await context.params;
  const providerConfig = await updateProviderConfig(providerConfigId, parsedRequest.data);

  if (!providerConfig) {
    return NextResponse.json({ error: "Provider config not found." }, { status: 404 });
  }

  return NextResponse.json({ providerConfig });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const currentUser = await requireAdminApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const { providerConfigId } = await context.params;
  const deleted = await deleteProviderConfig(providerConfigId);

  if (!deleted) {
    return NextResponse.json({ error: "Provider config not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
