import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import "../load-env";

async function main() {
  const sqlitePath = path.join(os.tmpdir(), `litechat-chat-verify-${process.pid}-${Date.now()}.db`);
  process.env.AUTH_SESSION_SECRET ??= "litechat-auth-verify-session-secret-1234567890";
  process.env.PROVIDER_KEY_ENCRYPTION_SECRET ??= "litechat-provider-encryption-secret-1234567890";
  process.env.DATABASE_TYPE ??= "sqlite";
  process.env.DATABASE_SQLITE_PATH ??= sqlitePath;

  const { createDatabaseConnection } = await import("../../src/server/db");
  const { createProviderConfig } = await import("../../src/server/providers");
  const { createModelConfig } = await import("../../src/server/model-configs");
  const { ChatAdapterError, getChatProviderAdapter, resolveAutomaticChatTools, resolveChatModelTarget } = await import(
    "../../src/server/chat"
  );
  type ChatResponseStreamEvent = import("../../src/server/chat").ChatResponseStreamEvent;

  const database = createDatabaseConnection({
    type: "sqlite",
    sqlitePath
  });

  try {
    await database.migrate();

    const providerConfig = await createProviderConfig(
      {
        name: "OpenAI Proxy",
        baseUrl: "https://example.test/openai",
        apiKey: "sk-test-adapter",
        enabled: true
      },
      database
    );
    const modelResult = await createModelConfig(
      {
        providerConfigId: providerConfig.id,
        modelId: "gpt-4.1-mini",
        displayName: "GPT 4.1 Mini",
        enabled: true,
        supportsWebSearch: true
      },
      database
    );

    assert(modelResult.success, "model config should be created for adapter verification");

    const target = await resolveChatModelTarget(modelResult.modelConfig.id, database);
    const adapter = getChatProviderAdapter(target.providerType);
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const originalFetch = globalThis.fetch;

    assert(
      resolveAutomaticChatTools(target, adapter)?.[0]?.type === "web_search_preview",
      "automatic tools should enable model-native web search when supported"
    );

    try {
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        fetchCalls.push({ input, init });

        return new Response(
          createSseStream([
            'data: {"type":"response.created","response":{"id":"resp_test_123"}}\n\n',
            'data: {"type":"response.output_text.delta","delta":"Hello"}\n\n',
            'data: {"type":"response.output_text.delta","delta":" world"}\n\n',
            'data: {"type":"response.completed","response":{"id":"resp_test_123"}}\n\n',
            'data: [DONE]\n\n'
          ]),
          {
            status: 200,
            headers: {
              "content-type": "text/event-stream"
            }
          }
        );
      }) as typeof fetch;

      const stream = await adapter.createResponseStream({
        model: target,
        messages: [
          { role: "system", content: "You are concise." },
          { role: "user", content: "Say hello." }
        ],
        tools: [{ type: "web_search_preview" }]
      });
      const events = await readStream<ChatResponseStreamEvent>(stream);

      assert(target.baseUrl === "https://example.test/openai", "resolved target should include provider base URL");
      assert(target.apiKey === "sk-test-adapter", "resolved target should include decrypted provider API key");
      assert(fetchCalls.length === 1, "adapter should issue one upstream request");
      assert(String(fetchCalls[0]?.input) === "https://example.test/openai/responses", "adapter should use configured base URL");

      const headers = fetchCalls[0]?.init?.headers as Record<string, string> | undefined;
      const body = JSON.parse(String(fetchCalls[0]?.init?.body ?? "{}")) as {
        model?: string;
        stream?: boolean;
        input?: Array<{ role: string; content: Array<{ type: string; text: string }> }>;
        tools?: Array<{ type: string }>;
      };

      assert(headers?.authorization === "Bearer sk-test-adapter", "adapter should send decrypted bearer token");
      assert(body.model === "gpt-4.1-mini", "adapter should send configured model id");
      assert(body.stream === true, "adapter should request streaming responses");
      assert(body.input?.length === 2, "adapter should map local messages into Responses input");
      assert(body.input?.[0]?.role === "system", "adapter should preserve supported message roles");
      assert(body.input?.[1]?.content[0]?.text === "Say hello.", "adapter should map text message content");
      assert(body.tools?.[0]?.type === "web_search_preview", "adapter should map request tools when supported");
      assert(events.length === 4, "adapter should emit normalized stream events");
      assert(events[0]?.type === "response.started", "stream should start with a response.started event");
      assert(events[1]?.type === "response.output_text.delta", "stream should include text delta events");
      assert(events[2]?.type === "response.output_text.delta", "stream should include multiple text deltas");
      assert(events[3]?.type === "response.completed", "stream should end with a response.completed event");
      assert(events[3]?.type !== "response.completed" || events[3].outputText === "Hello world", "completed event should include accumulated output text");

      globalThis.fetch = (async () => new Response("unauthorized", { status: 401 })) as typeof fetch;

      let capturedError: unknown;

      try {
        await adapter.createResponseStream({
          model: target,
          messages: [{ role: "user", content: "Hello again." }]
        });
      } catch (error) {
        capturedError = error;
      }

      assert(capturedError instanceof ChatAdapterError, "adapter failures should surface as ChatAdapterError");
      assert(capturedError instanceof ChatAdapterError && capturedError.code === "upstream_request_failed", "adapter should convert upstream failures into safe application errors");
    } finally {
      globalThis.fetch = originalFetch;
    }

    process.stdout.write(`Verified OpenAI adapter resolution, request mapping, and streaming using ${sqlitePath}.\n`);
  } finally {
    await database.close();

    if (existsSync(sqlitePath)) {
      rmSync(sqlitePath);
    }
  }
}

function createSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();

      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    }
  });
}

async function readStream<TValue>(stream: ReadableStream<TValue>) {
  const reader = stream.getReader();
  const events: TValue[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      events.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return events;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
