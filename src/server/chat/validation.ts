import type { ChatRequestMessage } from "@/server/chat/adapter";

type ValidationResult<TValue> =
  | { success: true; data: TValue }
  | { success: false; error: string };

export type CreateChatRouteRequest = {
  modelConfigId: string;
  messages: ChatRequestMessage[];
};

export async function parseCreateChatRouteRequest(request: Request): Promise<ValidationResult<CreateChatRouteRequest>> {
  const body = await parseJsonBody(request);

  if (!body || Array.isArray(body)) {
    return invalid("Request body must be a JSON object.");
  }

  const modelConfigId = readRequiredString(body.modelConfigId, "modelConfigId");
  const messages = readMessages(body.messages);

  if (modelConfigId.error) {
    return invalid(modelConfigId.error);
  }

  if (messages.error) {
    return invalid(messages.error);
  }

  return {
    success: true,
    data: {
      modelConfigId: modelConfigId.value!,
      messages: messages.value!
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

function readMessages(value: unknown): { value: ChatRequestMessage[]; error?: undefined } | { value?: undefined; error: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: "messages must be a non-empty array." };
  }

  const messages: ChatRequestMessage[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { error: "messages must contain objects with role and content." };
    }

    const role = readMessageRole(entry.role);
    const content = readRequiredString(entry.content, "messages[].content");

    if (role.error) {
      return { error: role.error };
    }

    if (content.error) {
      return { error: content.error };
    }

    messages.push({
      role: role.value!,
      content: content.value!
    });
  }

  return { value: messages };
}

function readMessageRole(value: unknown): { value: ChatRequestMessage["role"]; error?: undefined } | { value?: undefined; error: string } {
  if (value === "system" || value === "user" || value === "assistant" || value === "tool") {
    return { value };
  }

  return { error: "messages[].role must be one of system, user, assistant, or tool." };
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

function invalid(error: string): ValidationResult<never> {
  return {
    success: false,
    error
  };
}
