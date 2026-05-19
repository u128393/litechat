import {
  normalizePersonalization,
  personalizationMaxLength,
  type UpdateUserSettingsInput
} from "@/server/user-settings/service";

type ValidationResult<TValue> =
  | { success: true; data: TValue }
  | { success: false; error: string; code?: string };

export async function parseUpdateUserSettingsRequest(request: Request): Promise<ValidationResult<UpdateUserSettingsInput>> {
  const body = await parseJsonBody(request);

  if (!body || Array.isArray(body)) {
    return invalid("Request body must be a JSON object.");
  }

  if (typeof body.personalization !== "string") {
    return invalid("personalization must be a string.");
  }

  const personalization = normalizePersonalization(body.personalization);

  if (personalization.length > personalizationMaxLength) {
    return invalid(
      `personalization must be at most ${personalizationMaxLength} characters.`,
      "personalization_too_long"
    );
  }

  return {
    success: true,
    data: { personalization }
  };
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function invalid(error: string, code?: string): ValidationResult<never> {
  return { success: false, error, code };
}
