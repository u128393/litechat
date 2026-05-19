import { NextResponse } from "next/server";

import { requireAdminApiUser } from "@/server/auth/api";
import { deleteModelConfig, updateModelConfig } from "@/server/model-configs";
import { parseUpdateModelConfigRequest } from "@/server/model-configs/validation";

type RouteContext = {
  params: Promise<{
    modelConfigId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const currentUser = await requireAdminApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const parsedRequest = await parseUpdateModelConfigRequest(request);

  if (!parsedRequest.success) {
    return NextResponse.json({ error: parsedRequest.error }, { status: 400 });
  }

  const { modelConfigId } = await context.params;
  const result = await updateModelConfig(modelConfigId, parsedRequest.data);

  if (!result.success) {
    if (result.error === "provider_config_not_found") {
      return NextResponse.json({ error: "Provider config not found." }, { status: 400 });
    }

    return NextResponse.json({ error: "Model config not found." }, { status: 404 });
  }

  return NextResponse.json({ modelConfig: result.modelConfig });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const currentUser = await requireAdminApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const { modelConfigId } = await context.params;
  const deleted = await deleteModelConfig(modelConfigId);

  if (!deleted) {
    return NextResponse.json({ error: "Model config not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
