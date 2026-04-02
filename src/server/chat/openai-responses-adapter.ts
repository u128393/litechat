import {
  ChatAdapterError,
  type ChatAdapterCapabilities,
  type ChatAdapterTool,
  type ChatModelTarget,
  type ChatProviderAdapter,
  type ChatRequestMessage,
  type ChatResponseStreamEvent,
  type CreateChatResponseRequest
} from "@/server/chat/adapter";

const OPENAI_PROVIDER_TYPE = "openai-responses";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1/";

type OpenAIResponsesStreamEvent = {
  type?: string;
  delta?: string;
  response?: {
    id?: string;
  };
  error?: {
    message?: string;
  };
};

type StreamState = {
  responseId: string | null;
  outputText: string;
};

export function createOpenAIResponsesAdapter(): ChatProviderAdapter {
  return {
    providerType: OPENAI_PROVIDER_TYPE,

    validateModel(model: ChatModelTarget) {
      if (model.providerType !== OPENAI_PROVIDER_TYPE) {
        throw new ChatAdapterError("unsupported_provider", "The selected model provider is not supported.");
      }

      if (model.apiKey.trim() === "") {
        throw new ChatAdapterError("invalid_request", "The selected model provider is missing an API key.");
      }

      if (model.baseUrl !== null) {
        try {
          new URL(model.baseUrl);
        } catch (error) {
          throw new ChatAdapterError("invalid_request", "The selected model provider base URL is invalid.", error);
        }
      }
    },

    getCapabilities(model: ChatModelTarget): ChatAdapterCapabilities {
      this.validateModel(model);

      return {
        supportsStreaming: true,
        supportsWebSearch: model.supportsWebSearch
      };
    },

    async createResponseStream(request: CreateChatResponseRequest): Promise<ReadableStream<ChatResponseStreamEvent>> {
      this.validateModel(request.model);

      if (request.messages.length === 0) {
        throw new ChatAdapterError("invalid_request", "At least one message is required.");
      }

      const response = await fetch(buildResponsesUrl(request.model.baseUrl), {
        method: "POST",
        headers: {
          authorization: `Bearer ${request.model.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: request.model.modelId,
          input: mapMessagesToResponsesInput(request.messages),
          stream: true,
          ...(request.tools && request.tools.length > 0 ? { tools: mapTools(request.tools, request.model) } : {})
        }),
        signal: request.signal
      }).catch((error: unknown) => {
        throw new ChatAdapterError("upstream_request_failed", "The model provider request failed.", error);
      });

      if (!response.ok) {
        throw new ChatAdapterError(
          "upstream_request_failed",
          `The model provider request failed with status ${response.status}.`
        );
      }

      if (!response.body) {
        throw new ChatAdapterError("upstream_response_invalid", "The model provider returned an invalid response.");
      }

      return createResponsesStream(response.body);
    }
  };
}

function buildResponsesUrl(baseUrl: string | null): string {
  const normalizedBaseUrl = baseUrl ?? DEFAULT_OPENAI_BASE_URL;
  return new URL("responses", ensureTrailingSlash(normalizedBaseUrl)).toString();
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function mapMessagesToResponsesInput(messages: ChatRequestMessage[]) {
  return messages.map((message) => {
    if (message.content.trim() === "") {
      throw new ChatAdapterError("invalid_request", "Messages must include text content.");
    }

    if (message.role === "tool") {
      throw new ChatAdapterError("invalid_request", "Tool messages are not supported by this adapter.");
    }

    return {
      role: message.role,
      content: [{ type: "input_text", text: message.content }]
    };
  });
}

function mapTools(tools: ChatAdapterTool[], model: ChatModelTarget) {
  return tools.map((tool) => {
    if (tool.type === "web_search_preview") {
      if (!model.supportsWebSearch) {
        throw new ChatAdapterError("invalid_request", "The selected model does not support web search.");
      }

      return { type: tool.type };
    }

    throw new ChatAdapterError("invalid_request", "The requested tool is not supported.");
  });
}

function createResponsesStream(body: ReadableStream<Uint8Array>): ReadableStream<ChatResponseStreamEvent> {
  return new ReadableStream<ChatResponseStreamEvent>({
    async start(controller) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let state: StreamState = {
        responseId: null,
        outputText: ""
      };

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          buffer = drainSseBuffer(buffer, controller, state, (nextState) => {
            state = nextState;
          });
        }

        buffer += decoder.decode();
        drainSseBuffer(buffer, controller, state, (nextState) => {
          state = nextState;
        }, true);
        controller.close();
      } catch (error) {
        controller.error(
          error instanceof ChatAdapterError
            ? error
            : new ChatAdapterError("upstream_stream_failed", "The model provider stream failed.", error)
        );
      } finally {
        reader.releaseLock();
      }
    }
  });
}

function drainSseBuffer(
  buffer: string,
  controller: ReadableStreamDefaultController<ChatResponseStreamEvent>,
  currentState: StreamState,
  updateState: (state: StreamState) => void,
  flush = false
) {
  let remainingBuffer = buffer;
  let state = currentState;

  while (true) {
    const boundaryIndex = remainingBuffer.search(/\r?\n\r?\n/);

    if (boundaryIndex === -1) {
      break;
    }

    const rawEvent = remainingBuffer.slice(0, boundaryIndex);
    const boundaryMatch = remainingBuffer.slice(boundaryIndex).match(/^\r?\n\r?\n/);
    remainingBuffer = remainingBuffer.slice(boundaryIndex + (boundaryMatch?.[0].length ?? 2));

    const event = parseSseEvent(rawEvent);

    if (!event) {
      continue;
    }

    const nextEvent = mapStreamEvent(event, state);
    state = nextEvent.state;
    controller.enqueue(nextEvent.event);
    updateState(state);
  }

  if (flush) {
    const event = parseSseEvent(remainingBuffer);

    if (event) {
      const nextEvent = mapStreamEvent(event, state);
      controller.enqueue(nextEvent.event);
      updateState(nextEvent.state);
    }

    return "";
  }

  return remainingBuffer;
}

function parseSseEvent(rawEvent: string): ChatResponseStreamEvent | null {
  const dataLines = rawEvent
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length === 0) {
    return null;
  }

  const payload = dataLines.join("\n");

  if (payload === "[DONE]") {
    return null;
  }

  let parsedPayload: OpenAIResponsesStreamEvent;

  try {
    parsedPayload = JSON.parse(payload) as OpenAIResponsesStreamEvent;
  } catch (error) {
    throw new ChatAdapterError("upstream_response_invalid", "The model provider returned invalid event data.", error);
  }

  return mapParsedStreamEvent(parsedPayload);
}

function mapParsedStreamEvent(event: OpenAIResponsesStreamEvent): ChatResponseStreamEvent | null {
  switch (event.type) {
    case "response.created":
      return {
        type: "response.started",
        responseId: event.response?.id ?? null
      };

    case "response.output_text.delta":
      return event.delta
        ? {
            type: "response.output_text.delta",
            delta: event.delta
          }
        : null;

    case "response.completed":
      return {
        type: "response.completed",
        responseId: event.response?.id ?? null,
        outputText: ""
      };

    case "error":
      throw new ChatAdapterError(
        "upstream_request_failed",
        event.error?.message?.trim() ? "The model provider reported an error." : "The model provider request failed."
      );

    default:
      return null;
  }
}

function mapStreamEvent(
  event: ChatResponseStreamEvent,
  currentState: StreamState
): { event: ChatResponseStreamEvent; state: StreamState } {
  if (event.type === "response.started") {
    return {
      event,
      state: {
        responseId: event.responseId,
        outputText: currentState.outputText
      }
    };
  }

  if (event.type === "response.output_text.delta") {
    return {
      event,
      state: {
        responseId: currentState.responseId,
        outputText: currentState.outputText + event.delta
      }
    };
  }

  return {
    event: {
      type: "response.completed",
      responseId: event.responseId ?? currentState.responseId,
      outputText: currentState.outputText
    },
    state: {
      responseId: event.responseId ?? currentState.responseId,
      outputText: currentState.outputText
    }
  };
}
