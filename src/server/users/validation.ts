import type { UserRole } from "@/server/db";
import type { CreateManagedUserInput, UpdateManagedUserInput } from "@/server/users/service";

const USER_ROLES = ["user", "admin"] as const satisfies readonly UserRole[];
const MIN_PASSWORD_LENGTH = 8;

type ValidationResult<TValue> =
  | { success: true; data: TValue }
  | { success: false; error: string; code?: string };

export async function parseCreateManagedUserRequest(request: Request): Promise<ValidationResult<CreateManagedUserInput>> {
  const body = await parseJsonBody(request);

  if (!body || Array.isArray(body)) {
    return invalid("Request body must be a JSON object.");
  }

  const email = readRequiredString(body.email, "email");
  const password = readPassword(body.password);
  const role = readUserRole(body.role);
  const enabled = readOptionalBoolean(body.enabled, "enabled");

  if (email.error) return invalid(email.error);
  if (password.error) return invalid(password.error, password.code);
  if (role.error) return invalid(role.error);
  if (enabled.error) return invalid(enabled.error);

  return {
    success: true,
    data: {
      email: email.value!,
      password: password.value!,
      role: role.value!,
      enabled: enabled.value ?? true
    }
  };
}

export async function parseUpdateManagedUserRequest(request: Request): Promise<ValidationResult<UpdateManagedUserInput>> {
  const body = await parseJsonBody(request);

  if (!body || Array.isArray(body)) {
    return invalid("Request body must be a JSON object.");
  }

  const updates: UpdateManagedUserInput = {};

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

  return { success: true, data: updates };
}

export async function parseResetManagedUserPasswordRequest(request: Request): Promise<ValidationResult<{ password: string }>> {
  const body = await parseJsonBody(request);

  if (!body || Array.isArray(body)) {
    return invalid("Request body must be a JSON object.");
  }

  const password = readPassword(body.password);

  if (password.error) {
    return invalid(password.error, password.code);
  }

  return { success: true, data: { password: password.value! } };
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

function readPassword(value: unknown): { value: string; error?: undefined; code?: undefined } | { value?: undefined; error: string; code?: string } {
  const password = readRequiredString(value, "password");

  if (password.error) {
    return password;
  }

  const passwordValue = password.value!;

  if (passwordValue.length < MIN_PASSWORD_LENGTH) {
    return { error: "Password must be at least 8 characters.", code: "min_length" };
  }

  return { value: passwordValue };
}

function readUserRole(value: unknown): { value: UserRole; error?: undefined } | { value?: undefined; error: string } {
  if (value === undefined) {
    return { value: "user" };
  }

  if (typeof value !== "string" || !USER_ROLES.includes(value as UserRole)) {
    return { error: "role must be user or admin." };
  }

  return { value: value as UserRole };
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

function invalid(error: string, code?: string): ValidationResult<never> {
  return { success: false, error, code };
}
