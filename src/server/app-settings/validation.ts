import type { UpdateAppSettingsInput } from "@/server/app-settings/service";

type ValidationResult<TValue> =
  | { success: true; data: TValue }
  | { success: false; error: string; code?: string };

export async function parseUpdateAppSettingsRequest(request: Request): Promise<ValidationResult<UpdateAppSettingsInput>> {
  const body = await parseJsonBody(request);

  if (!body || Array.isArray(body)) {
    return invalid("Request body must be a JSON object.");
  }

  if (!Object.hasOwn(body, "titleGenerationModelConfigId")) {
    return invalid("titleGenerationModelConfigId is required.");
  }

  if (body.titleGenerationModelConfigId !== null && typeof body.titleGenerationModelConfigId !== "string") {
    return invalid("titleGenerationModelConfigId must be a string or null.");
  }

  return {
    success: true,
    data: {
      titleGenerationModelConfigId: normalizeOptionalString(body.titleGenerationModelConfigId)
    }
  };
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue === "" ? null : normalizedValue;
}

function invalid(error: string, code?: string): ValidationResult<never> {
  return { success: false, error, code };
}
