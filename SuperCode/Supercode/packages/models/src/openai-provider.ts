import type {
  ModelDescriptor,
  ModelInvocationRequest,
  ModelInvocationResult,
  ModelFinishReason
} from "@supercode/core";
import { BaseModelProvider, type BaseProviderOptions } from "./provider.js";

const OPENAI_MODELS: ModelDescriptor[] = [
  {
    modelId: "gpt-5",
    providerId: "openai",
    family: "gpt-5",
    contextWindow: 1_000_000,
    supportsTools: true,
    supportsStreaming: true,
    trustTier: "first_party",
    cost: { inputPer1kTokens: 0.01, outputPer1kTokens: 0.03 },
    latencyTier: "deep"
  },
  {
    modelId: "gpt-4.1",
    providerId: "openai",
    family: "gpt-4.1",
    contextWindow: 1_000_000,
    supportsTools: true,
    supportsStreaming: true,
    trustTier: "first_party",
    cost: { inputPer1kTokens: 0.002, outputPer1kTokens: 0.008 },
    latencyTier: "balanced"
  },
  {
    modelId: "gpt-4.1-mini",
    providerId: "openai",
    family: "gpt-4.1",
    contextWindow: 1_000_000,
    supportsTools: true,
    supportsStreaming: true,
    trustTier: "first_party",
    cost: { inputPer1kTokens: 0.0004, outputPer1kTokens: 0.0016 },
    latencyTier: "fast"
  },
  {
    modelId: "gpt-4.1-nano",
    providerId: "openai",
    family: "gpt-4.1",
    contextWindow: 1_000_000,
    supportsTools: true,
    supportsStreaming: true,
    trustTier: "first_party",
    cost: { inputPer1kTokens: 0.0001, outputPer1kTokens: 0.0004 },
    latencyTier: "fast"
  },
  {
    modelId: "o3",
    providerId: "openai",
    family: "o3",
    contextWindow: 200_000,
    supportsTools: true,
    supportsStreaming: true,
    trustTier: "first_party",
    cost: { inputPer1kTokens: 0.01, outputPer1kTokens: 0.04 },
    latencyTier: "deep"
  },
  {
    modelId: "o3-mini",
    providerId: "openai",
    family: "o3",
    contextWindow: 200_000,
    supportsTools: true,
    supportsStreaming: true,
    trustTier: "first_party",
    cost: { inputPer1kTokens: 0.0011, outputPer1kTokens: 0.0044 },
    latencyTier: "balanced"
  },
  {
    modelId: "o4-mini",
    providerId: "openai",
    family: "o4",
    contextWindow: 200_000,
    supportsTools: true,
    supportsStreaming: true,
    trustTier: "first_party",
    cost: { inputPer1kTokens: 0.0011, outputPer1kTokens: 0.0044 },
    latencyTier: "balanced"
  },
  {
    modelId: "gpt-4o",
    providerId: "openai",
    family: "gpt-4o",
    contextWindow: 128_000,
    supportsTools: true,
    supportsStreaming: true,
    trustTier: "first_party",
    cost: { inputPer1kTokens: 0.0025, outputPer1kTokens: 0.01 },
    latencyTier: "balanced"
  },
  {
    modelId: "gpt-4o-mini",
    providerId: "openai",
    family: "gpt-4o",
    contextWindow: 128_000,
    supportsTools: true,
    supportsStreaming: true,
    trustTier: "first_party",
    cost: { inputPer1kTokens: 0.00015, outputPer1kTokens: 0.0006 },
    latencyTier: "fast"
  }
];

function mapFinishReason(reason?: string): ModelFinishReason {
  switch (reason) {
    case "stop":
      return "stop";
    case "tool_calls":
      return "tool_calls";
    case "length":
      return "length";
    default:
      return "stop";
  }
}

export class OpenAIProvider extends BaseModelProvider {
  readonly providerId = "openai";
  readonly displayName = "OpenAI";

  constructor(options?: BaseProviderOptions) {
    super("https://api.openai.com/v1", "gpt-4.1-mini", options);
  }

  listModels(): ModelDescriptor[] {
    return [...OPENAI_MODELS];
  }

  async invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult> {
    const modelId = this.resolveModel(request);
    const requestId = this.makeRequestId();
    const startedAt = Date.now();

    const body: Record<string, unknown> = {
      model: modelId,
      messages: request.messages.map(msg => {
        const mapped: Record<string, unknown> = { role: msg.role, content: msg.content };
        if (msg.toolCallId) mapped.tool_call_id = msg.toolCallId;
        return mapped;
      })
    };

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map(tool => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }));
    }

    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens;
    if (request.stopSequences) body.stop = request.stopSequences;

    try {
      const response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        this.recordFailure();
        throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
      }

      const json = await response.json() as Record<string, unknown>;
      const latencyMs = Date.now() - startedAt;
      this.recordSuccess(latencyMs);

      const choice = (json.choices as Array<Record<string, unknown>>)?.[0];
      const message = (choice?.message ?? {}) as Record<string, unknown>;
      const usage = (json.usage ?? {}) as Record<string, number>;

      const toolCalls = (message.tool_calls as Array<Record<string, unknown>> | undefined)?.map(tc => {
        const fn = tc.function as Record<string, string>;
        return {
          id: tc.id as string,
          name: fn.name,
          arguments: fn.arguments
        };
      });

      return {
        requestId,
        modelId,
        providerId: this.providerId,
        content: (message.content as string) ?? "",
        toolCalls,
        usage: this.computeUsage(
          usage.prompt_tokens ?? 0,
          usage.completion_tokens ?? 0
        ),
        finishReason: mapFinishReason(choice?.finish_reason as string),
        latencyMs,
        completedAt: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("OpenAI API error")) {
        throw error;
      }
      this.recordFailure();
      throw new Error(`OpenAI request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
