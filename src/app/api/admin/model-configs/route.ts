import { NextResponse } from "next/server";

import { requireAdminApiUser } from "@/server/auth/api";
import { createModelConfig, listModelConfigs, reorderModelConfigs } from "@/server/model-configs";
import { parseCreateModelConfigRequest, parseReorderModelConfigsRequest } from "@/server/model-configs/validation";

export async function GET() {
  const currentUser = await requireAdminApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const modelConfigs = await listModelConfigs();

  return NextResponse.json({ modelConfigs });
}

export async function POST(request: Request) {
  const currentUser = await requireAdminApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const parsedRequest = await parseCreateModelConfigRequest(request);

  if (!parsedRequest.success) {
    return NextResponse.json({ error: parsedRequest.error }, { status: 400 });
  }

  const result = await createModelConfig(parsedRequest.data);

  if (!result.success) {
    return NextResponse.json({ error: "Provider config not found." }, { status: 400 });
  }

  return NextResponse.json({ modelConfig: result.modelConfig }, { status: 201 });
}

export async function PATCH(request: Request) {
  const currentUser = await requireAdminApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const parsedRequest = await parseReorderModelConfigsRequest(request);

  if (!parsedRequest.success) {
    return NextResponse.json({ error: parsedRequest.error }, { status: 400 });
  }

  const result = await reorderModelConfigs(parsedRequest.data);

  if (!result.success) {
    return NextResponse.json({ error: "Model order no longer matches the stored models." }, { status: 409 });
  }

  return NextResponse.json({ modelConfigs: result.modelConfigs });
}
