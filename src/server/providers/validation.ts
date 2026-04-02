import type { ProviderType } from "@/server/db/schema";

import type { CreateProviderConfigInput, UpdateProviderConfigInput } from "@/server/providers/service";

const PROVIDER_TYPE: ProviderType = "openai-responses";

type ValidationResult<TValue> =
  | { success: true; data: TValue }
  | { success: false; error: string };

export async function parseCreateProviderConfigRequest(request: Request): Promise<ValidationResult<CreateProviderConfigInput>> {
  const body = await parseJsonBody(request);

  if (!body || Array.isArray(body)) {
    return invalid("Request body must be a JSON object.");
  }

  const name = readRequiredString(body.name, "name");
  const providerType = readProviderType(body.providerType);
  const baseUrl = readBaseUrl(body.baseUrl);
  const apiKey = readRequiredString(body.apiKey, "apiKey");
  const enabled = readOptionalBoolean(body.enabled, "enabled");

  if (name.error) {
    return invalid(name.error);
  }

  if (providerType.error) {
    return invalid(providerType.error);
  }

  if (baseUrl.error) {
    return invalid(baseUrl.error);
  }

  if (apiKey.error) {
    return invalid(apiKey.error);
  }

  if (enabled.error) {
    return invalid(enabled.error);
  }

  return {
    success: true,
    data: {
      name: name.value!,
      providerType: providerType.value!,
      baseUrl: baseUrl.value!,
      apiKey: apiKey.value!,
      enabled: enabled.value ?? true
    }
  };
}

export async function parseUpdateProviderConfigRequest(request: Request): Promise<ValidationResult<UpdateProviderConfigInput>> {
  const body = await parseJsonBody(request);

  if (!body || Array.isArray(body)) {
    return invalid("Request body must be a JSON object.");
  }

  const updates: UpdateProviderConfigInput = {};

  if (Object.hasOwn(body, "name")) {
    const name = readRequiredString(body.name, "name");

    if (name.error) {
      return invalid(name.error);
    }

    updates.name = name.value!;
  }

  if (Object.hasOwn(body, "providerType")) {
    const providerType = readProviderType(body.providerType);

    if (providerType.error) {
      return invalid(providerType.error);
    }

    updates.providerType = providerType.value!;
  }

  if (Object.hasOwn(body, "baseUrl")) {
    const baseUrl = readBaseUrl(body.baseUrl);

    if (baseUrl.error) {
      return invalid(baseUrl.error);
    }

    updates.baseUrl = baseUrl.value!;
  }

  if (Object.hasOwn(body, "apiKey")) {
    const apiKey = readRequiredString(body.apiKey, "apiKey");

    if (apiKey.error) {
      return invalid(apiKey.error);
    }

    updates.apiKey = apiKey.value!;
  }

  if (Object.hasOwn(body, "enabled")) {
    const enabled = readOptionalBoolean(body.enabled, "enabled");

    if (enabled.error || enabled.value === undefined) {
      return invalid(enabled.error ?? "enabled must be a boolean.");
    }

    updates.enabled = enabled.value;
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

function readProviderType(value: unknown): { value: ProviderType; error?: undefined } | { value?: undefined; error: string } {
  if (value === undefined) {
    return { value: PROVIDER_TYPE };
  }

  if (value !== PROVIDER_TYPE) {
    return { error: `providerType must be \`${PROVIDER_TYPE}\`.` };
  }

  return { value };
}

function readBaseUrl(value: unknown): { value: string | null; error?: undefined } | { value?: undefined; error: string } {
  if (value === undefined || value === null) {
    return { value: null };
  }

  if (typeof value !== "string") {
    return { error: "baseUrl must be a valid URL string or null." };
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    return { value: null };
  }

  try {
    const parsedUrl = new URL(normalizedValue);
    return { value: parsedUrl.toString() };
  } catch {
    return { error: "baseUrl must be a valid URL string or null." };
  }
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

function invalid(error: string): ValidationResult<never> {
  return {
    success: false,
    error
  };
}
