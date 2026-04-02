import type { CreateModelConfigInput, UpdateModelConfigInput } from "@/server/model-configs/service";

type ValidationResult<TValue> =
  | { success: true; data: TValue }
  | { success: false; error: string };

export async function parseCreateModelConfigRequest(request: Request): Promise<ValidationResult<CreateModelConfigInput>> {
  const body = await parseJsonBody(request);

  if (!body || Array.isArray(body)) {
    return invalid("Request body must be a JSON object.");
  }

  const providerConfigId = readRequiredString(body.providerConfigId, "providerConfigId");
  const modelId = readRequiredString(body.modelId, "modelId");
  const displayName = readRequiredString(body.displayName, "displayName");
  const enabled = readOptionalBoolean(body.enabled, "enabled");
  const supportsWebSearch = readOptionalBoolean(body.supportsWebSearch, "supportsWebSearch");
  const sortOrder = readOptionalInteger(body.sortOrder, "sortOrder");

  if (providerConfigId.error) {
    return invalid(providerConfigId.error);
  }

  if (modelId.error) {
    return invalid(modelId.error);
  }

  if (displayName.error) {
    return invalid(displayName.error);
  }

  if (enabled.error) {
    return invalid(enabled.error);
  }

  if (supportsWebSearch.error) {
    return invalid(supportsWebSearch.error);
  }

  if (sortOrder.error) {
    return invalid(sortOrder.error);
  }

  return {
    success: true,
    data: {
      providerConfigId: providerConfigId.value!,
      modelId: modelId.value!,
      displayName: displayName.value!,
      enabled: enabled.value ?? true,
      supportsWebSearch: supportsWebSearch.value ?? false,
      sortOrder: sortOrder.value ?? 0
    }
  };
}

export async function parseUpdateModelConfigRequest(request: Request): Promise<ValidationResult<UpdateModelConfigInput>> {
  const body = await parseJsonBody(request);

  if (!body || Array.isArray(body)) {
    return invalid("Request body must be a JSON object.");
  }

  const updates: UpdateModelConfigInput = {};

  if (Object.hasOwn(body, "providerConfigId")) {
    const providerConfigId = readRequiredString(body.providerConfigId, "providerConfigId");

    if (providerConfigId.error) {
      return invalid(providerConfigId.error);
    }

    updates.providerConfigId = providerConfigId.value!;
  }

  if (Object.hasOwn(body, "modelId")) {
    const modelId = readRequiredString(body.modelId, "modelId");

    if (modelId.error) {
      return invalid(modelId.error);
    }

    updates.modelId = modelId.value!;
  }

  if (Object.hasOwn(body, "displayName")) {
    const displayName = readRequiredString(body.displayName, "displayName");

    if (displayName.error) {
      return invalid(displayName.error);
    }

    updates.displayName = displayName.value!;
  }

  if (Object.hasOwn(body, "enabled")) {
    const enabled = readOptionalBoolean(body.enabled, "enabled");

    if (enabled.error || enabled.value === undefined) {
      return invalid(enabled.error ?? "enabled must be a boolean.");
    }

    updates.enabled = enabled.value;
  }

  if (Object.hasOwn(body, "supportsWebSearch")) {
    const supportsWebSearch = readOptionalBoolean(body.supportsWebSearch, "supportsWebSearch");

    if (supportsWebSearch.error || supportsWebSearch.value === undefined) {
      return invalid(supportsWebSearch.error ?? "supportsWebSearch must be a boolean.");
    }

    updates.supportsWebSearch = supportsWebSearch.value;
  }

  if (Object.hasOwn(body, "sortOrder")) {
    const sortOrder = readOptionalInteger(body.sortOrder, "sortOrder");

    if (sortOrder.error || sortOrder.value === undefined) {
      return invalid(sortOrder.error ?? "sortOrder must be an integer.");
    }

    updates.sortOrder = sortOrder.value;
  }

  if (Object.keys(updates).length === 0) {
    return invalid("At least one updatable field is required.");
  }

  return {
    success: true,
    data: updates
  };
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function readRequiredString(value: unknown, fieldName: string): { value: string; error?: undefined } | { value?: undefined; error: string } {
  if (typeof value !== "string") {
    return { error: `${fieldName} must be a non-empty string.` };
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    return { error: `${fieldName} must be a non-empty string.` };
  }

  return { value: normalizedValue };
}

function readOptionalBoolean(value: unknown, fieldName: string): { value: boolean | undefined; error?: undefined } | { value?: undefined; error: string } {
  if (value === undefined) {
    return { value: undefined };
  }

  if (typeof value !== "boolean") {
    return { error: `${fieldName} must be a boolean.` };
  }

  return { value };
}

function readOptionalInteger(value: unknown, fieldName: string): { value: number | undefined; error?: undefined } | { value?: undefined; error: string } {
  if (value === undefined) {
    return { value: undefined };
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { error: `${fieldName} must be an integer.` };
  }

  return { value };
}

function invalid(error: string): ValidationResult<never> {
  return {
    success: false,
    error
  };
}
