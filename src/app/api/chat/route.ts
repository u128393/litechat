import { NextResponse } from "next/server";

import {
  ChatAdapterError,
  getChatProviderAdapter,
  resolveAutomaticChatTools,
  resolveChatModelTarget,
  toChatAdapterError
} from "@/server/chat";
import { parseCreateChatRouteRequest } from "@/server/chat/validation";
import { requireApiUser } from "@/server/auth/api";

const encoder = new TextEncoder();

export async function POST(request: Request) {
  const currentUser = await requireApiUser();

  if (currentUser instanceof NextResponse) {
    return currentUser;
  }

  const parsedRequest = await parseCreateChatRouteRequest(request);

  if (!parsedRequest.success) {
    return NextResponse.json({ error: parsedRequest.error, code: "invalid_request" }, { status: 400 });
  }

  try {
    const model = await resolveChatModelTarget(parsedRequest.data.modelConfigId);
    const adapter = getChatProviderAdapter(model.providerType);
    const tools = resolveAutomaticChatTools(model, adapter);
    const responseStream = await adapter.createResponseStream({
      model,
      messages: parsedRequest.data.messages,
      tools,
      signal: request.signal
    });

    return new Response(createTextStream(responseStream), {
      headers: {
        "cache-control": "no-store",
        "content-type": "text/plain; charset=utf-8"
      }
    });
  } catch (error) {
    const safeError = toChatAdapterError(error);
    return NextResponse.json({ error: safeError.message, code: safeError.code }, { status: toStatusCode(safeError) });
  }
}

function createTextStream(eventStream: ReadableStream<{ type: string; delta?: string }>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = eventStream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          if (value.type === "response.output_text.delta" && value.delta) {
            controller.enqueue(encoder.encode(value.delta));
          }
        }

        controller.close();
      } catch (error) {
        controller.error(toChatAdapterError(error));
      } finally {
        reader.releaseLock();
      }
    }
  });
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
