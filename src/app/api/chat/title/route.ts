import { NextResponse } from "next/server";

import { requireApiUser } from "@/server/auth/api";
import { getTitleGenerationModelConfigId } from "@/server/app-settings";
import {
  ChatAdapterError,
  getChatProviderAdapter,
  resolveChatModelTarget,
  resolveTitleGenerationModelTarget,
  toChatAdapterError,
  type ChatRequestMessage
} from "@/server/chat";
import { parseCreateChatTitleRouteRequest } from "@/server/chat/validation";

const titleSystemPrompt = [
  "Generate a short title for the conversation.",
  "Return only the title, with no explanation and no surrounding quotes.",
  "Use the same language as the conversation when possible.",
  "Keep it concise: 3 to 8 words, maximum 60 characters."
].join(" ");

export async function POST(request: Request) {
  const currentUser = await requireApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const parsedRequest = await parseCreateChatTitleRouteRequest(request);

  if (!parsedRequest.success) {
    return NextResponse.json({ error: parsedRequest.error, code: "invalid_request" }, { status: 400 });
  }

  try {
    const model = await resolveTitleGenerationModel(parsedRequest.data.fallbackModelConfigId);
    const adapter = getChatProviderAdapter(model.providerType);
    const responseStream = await adapter.createResponseStream({
      model,
      messages: buildTitleMessages(parsedRequest.data.messages),
      signal: request.signal
    });
    const title = sanitizeGeneratedTitle(await readOutputText(responseStream));

    if (!title) {
      return NextResponse.json({ error: "The model did not return a title.", code: "empty_title" }, { status: 502 });
    }

    return NextResponse.json({ title });
  } catch (error) {
    const safeError = toChatAdapterError(error);
    return NextResponse.json({ error: safeError.message, code: safeError.code }, { status: toStatusCode(safeError) });
  }
}

async function resolveTitleGenerationModel(fallbackModelConfigId: string) {
  const configuredModelConfigId = await getTitleGenerationModelConfigId();

  if (configuredModelConfigId) {
    try {
      return await resolveTitleGenerationModelTarget(configuredModelConfigId);
    } catch (error) {
      if (!shouldFallbackFromConfiguredModel(error)) {
        throw error;
      }
    }
  }

  return resolveChatModelTarget(fallbackModelConfigId);
}

function shouldFallbackFromConfiguredModel(error: unknown) {
  if (!(error instanceof ChatAdapterError)) {
    return false;
  }

  return [
    "model_config_not_found",
    "model_not_available",
    "provider_config_not_found",
    "provider_not_available",
    "unsupported_provider"
  ].includes(error.code);
}

function buildTitleMessages(messages: ChatRequestMessage[]): ChatRequestMessage[] {
  return [
    {
      role: "system",
      content: titleSystemPrompt
    },
    ...messages.map((message) => ({
      role: message.role,
      content: message.content.slice(0, 4000)
    }))
  ];
}

async function readOutputText(eventStream: ReadableStream<{ type: string; delta?: string; outputText?: string }>) {
  const reader = eventStream.getReader();
  let outputText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (value.type === "response.output_text.delta" && value.delta) {
        outputText += value.delta;
      }
    }
  } finally {
    reader.releaseLock();
  }

  return outputText;
}

function sanitizeGeneratedTitle(value: string) {
  const firstLine = value.trim().split(/\r?\n/)[0]?.replace(/\s+/g, " ").trim() ?? "";
  const unquoted = firstLine.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();

  return unquoted.slice(0, 60).trim();
}

function toStatusCode(error: ChatAdapterError): number {
  switch (error.code) {
    case "invalid_request":
      return 400;
    case "model_config_not_found":
    case "provider_config_not_found":
      return 404;
    case "model_not_available":
    case "provider_not_available":
    case "unsupported_provider":
      return 409;
    case "upstream_request_failed":
    case "upstream_response_invalid":
    case "upstream_stream_failed":
      return 502;
  }
}
