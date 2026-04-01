import type {
  ModelDescriptor,
  ModelInvocationRequest,
  ModelInvocationResult,
  ModelFinishReason
} from "@supercode/core";
import { BaseModelProvider, type BaseProviderOptions } from "./provider.js";

const ANTHROPIC_MODELS: ModelDescriptor[] = [
  {
    modelId: "claude-sonnet-4-20250514",
    providerId: "anthropic",
    family: "claude-4",
    contextWindow: 200_000,
    supportsTools: true,
    supportsStreaming: true,
    trustTier: "first_party",
    cost: { inputPer1kTokens: 0.003, outputPer1kTokens: 0.015 },
    latencyTier: "balanced"
  },
  {
    modelId: "claude-3-7-sonnet-20250219",
    providerId: "anthropic",
    family: "claude-3.7",
    contextWindow: 200_000,
    supportsTools: true,
    supportsStreaming: true,
    trustTier: "first_party",
    cost: { inputPer1kTokens: 0.003, outputPer1kTokens: 0.015 },
    latencyTier: "balanced"
  },
  {
    modelId: "claude-3-5-sonnet-20241022",
    providerId: "anthropic",
    family: "claude-3.5",
    contextWindow: 200_000,
    supportsTools: true,
    supportsStreaming: true,
    trustTier: "first_party",
    cost: { inputPer1kTokens: 0.003, outputPer1kTokens: 0.015 },
    latencyTier: "balanced"
  },
  {
    modelId: "claude-3-5-haiku-20241022",
    providerId: "anthropic",
    family: "claude-3.5",
    contextWindow: 200_000,
    supportsTools: true,
    supportsStreaming: true,
    trustTier: "first_party",
    cost: { inputPer1kTokens: 0.0008, outputPer1kTokens: 0.004 },
    latencyTier: "fast"
  },
  {
    modelId: "claude-3-opus-20240229",
    providerId: "anthropic",
    family: "claude-3",
    contextWindow: 200_000,
    supportsTools: true,
    supportsStreaming: true,
    trustTier: "first_party",
    cost: { inputPer1kTokens: 0.015, outputPer1kTokens: 0.075 },
    latencyTier: "deep"
  }
];

function mapStopReason(reason?: string): ModelFinishReason {
  switch (reason) {
    case "end_turn":
      return "stop";
    case "tool_use":
      return "tool_calls";
    case "max_tokens":
      return "length";
    default:
      return "stop";
  }
}

export class AnthropicProvider extends BaseModelProvider {
  readonly providerId = "anthropic";
  readonly displayName = "Anthropic";

  constructor(options?: BaseProviderOptions) {
    super("https://api.anthropic.com/v1", "claude-sonnet-4-20250514", options);
  }

  listModels(): ModelDescriptor[] {
    return [...ANTHROPIC_MODELS];
  }

  async invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult> {
    const modelId = this.resolveModel(request);
    const requestId = this.makeRequestId();
    const startedAt = Date.now();

    // Anthropic uses a separate system field.
    const systemMessages = request.messages.filter(m => m.role === "system");
    const nonSystemMessages = request.messages.filter(m => m.role !== "system");

    const body: Record<string, unknown> = {
      model: modelId,
      max_tokens: request.maxTokens ?? 4096,
      messages: nonSystemMessages.map(msg => {
        if (msg.role === "tool") {
          return {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: msg.toolCallId,
                content: msg.content
              }
            ]
          };
        }
        return { role: msg.role, content: msg.content };
      })
    };

    if (systemMessages.length > 0) {
      body.system = systemMessages.map(m => m.content).join("\n\n");
    }

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters
      }));
    }

    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.stopSequences) body.stop_sequences = request.stopSequences;

    try {
      const response = await this.fetchFn(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey ?? "",
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        this.recordFailure();
        throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
      }

      const json = await response.json() as Record<string, unknown>;
      const latencyMs = Date.now() - startedAt;
      this.recordSuccess(latencyMs);

      const contentBlocks = (json.content ?? []) as Array<Record<string, unknown>>;
      const usage = (json.usage ?? {}) as Record<string, number>;

      let content = "";
      const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];

      for (const block of contentBlocks) {
        if (block.type === "text") {
          content += block.text as string;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id as string,
            name: block.name as string,
            arguments: JSON.stringify(block.input)
          });
        }
      }

      return {
        requestId,
        modelId,
        providerId: this.providerId,
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: this.computeUsage(
          usage.input_tokens ?? 0,
          usage.output_tokens ?? 0
        ),
        finishReason: mapStopReason(json.stop_reason as string),
        latencyMs,
        completedAt: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Anthropic API error")) {
        throw error;
      }
      this.recordFailure();
      throw new Error(`Anthropic request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
