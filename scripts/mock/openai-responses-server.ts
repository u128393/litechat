import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const port = parseInteger(process.env.MOCK_OPENAI_PORT, 11434);
const host = process.env.MOCK_OPENAI_HOST?.trim() || "127.0.0.1";
const responseText = process.env.MOCK_OPENAI_RESPONSE_TEXT?.trim() || "Local mock response from LiteChat.";
let lastRequest: Record<string, unknown> | null = null;

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.method === "GET" && request.url === "/requests/latest") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ request: lastRequest }));
    return;
  }

  if (request.method !== "POST" || request.url !== "/responses") {
    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "Not found." }));
    return;
  }

  const body = await readBody(request);
  lastRequest = parseJson(body);

  response.writeHead(200, {
    "cache-control": "no-store",
    connection: "keep-alive",
    "content-type": "text/event-stream; charset=utf-8"
  });

  const requestId = `resp_mock_${Date.now()}`;
  const prompt = readPromptText(lastRequest);
  const finalText = prompt ? `${responseText} Prompt: ${prompt}` : responseText;
  const chunks = splitIntoChunks(finalText, 18);

  writeSse(response, { type: "response.created", response: { id: requestId } });

  for (const chunk of chunks) {
    writeSse(response, { type: "response.output_text.delta", delta: chunk });
    await delay(15);
  }

  writeSse(response, { type: "response.completed", response: { id: requestId } });
  response.write("data: [DONE]\n\n");
  response.end();
});

server.listen(port, host, () => {
  process.stdout.write(`Mock OpenAI Responses server listening on http://${host}:${port}.\n`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      process.exit(0);
    });
  });
}

function parseInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let rawBody = "";

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      rawBody += chunk;
    });
    request.on("end", () => {
      resolve(rawBody);
    });
    request.on("error", reject);
  });
}

function parseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readPromptText(payload: Record<string, unknown> | null) {
  const input = payload?.input;

  if (!Array.isArray(input)) {
    return "";
  }

  const textParts: string[] = [];

  for (const message of input) {
    if (!message || typeof message !== "object") {
      continue;
    }

    const content = (message as { content?: unknown }).content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const item of content) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const type = (item as { type?: unknown }).type;
      const text = (item as { text?: unknown }).text;

      if ((type === "input_text" || type === "output_text") && typeof text === "string" && text.trim() !== "") {
        textParts.push(text.trim());
      }
    }
  }

  return textParts.join(" ");
}

function splitIntoChunks(value: string, chunkSize: number) {
  const chunks: string[] = [];

  for (let index = 0; index < value.length; index += chunkSize) {
    chunks.push(value.slice(index, index + chunkSize));
  }

  return chunks;
}

function writeSse(response: ServerResponse<IncomingMessage>, payload: Record<string, unknown>) {
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function delay(timeoutMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
}
