import { randomUUID } from "node:crypto";
import type {
  PermissionDecision,
  PermissionDecisionValue,
  PermissionRequest,
  ToolDefinition,
  ToolExecutionContext,
  ToolRegistry,
  ToolResult
} from "@supercode/core";

export interface ToolAuthorizationContext {
  tool: ToolDefinition;
  request: Omit<PermissionRequest, "requestId" | "requestedAt">;
}

export interface ToolRegistryOptions {
  authorize?: (context: ToolAuthorizationContext) => PermissionDecision;
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function cloneToolDefinition(tool: ToolDefinition): ToolDefinition {
  return {
    toolId: tool.toolId,
    title: tool.title,
    description: tool.description,
    category: tool.category,
    requiresPermission: tool.requiresPermission ? [...tool.requiresPermission] : undefined,
    execute: tool.execute
  };
}

function now(): string {
  return new Date().toISOString();
}

function isBlocked(decision: PermissionDecisionValue): boolean {
  return decision !== "allow";
}

export class ExecutableToolRegistry implements ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly authorize?: ToolRegistryOptions["authorize"];

  constructor(options: ToolRegistryOptions = {}) {
    this.authorize = options.authorize;
  }

  registerTool<Input = unknown, Output = unknown>(tool: ToolDefinition<Input, Output>): void {
    if (!tool.toolId.trim()) {
      throw new Error("Tool definitions must provide a non-empty toolId.");
    }

    if (this.tools.has(tool.toolId)) {
      throw new Error(`Tool ${tool.toolId} is already registered.`);
    }

    this.tools.set(tool.toolId, cloneToolDefinition(tool as ToolDefinition));
  }

  getTool(toolId: string): ToolDefinition | undefined {
    const tool = this.tools.get(toolId);
    return tool ? cloneToolDefinition(tool) : undefined;
  }

  listTools(): ToolDefinition[] {
    return [...this.tools.values()].map(tool => cloneToolDefinition(tool));
  }

  async invoke(toolId: string, input: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    const invocationId = randomUUID();
    const completedAt = now();
    const tool = this.tools.get(toolId);
    if (!tool) {
      return {
        invocationId,
        toolId,
        ok: false,
        error: `Unknown tool: ${toolId}`,
        completedAt
      };
    }

    for (const category of tool.requiresPermission ?? []) {
      const decision = this.authorize?.({
        tool: cloneToolDefinition(tool),
        request: {
          category,
          resource: tool.toolId,
          reason: `Execute tool ${tool.toolId}.`,
          taskId: context.taskId,
          metadata: cloneValue(context.metadata ?? {})
        }
      });

      if (decision && isBlocked(decision.decision)) {
        return {
          invocationId,
          toolId: tool.toolId,
          ok: false,
          error: `Tool ${tool.toolId} blocked by permission decision ${decision.decision}.`,
          completedAt
        };
      }
    }

    if (!tool.execute) {
      return {
        invocationId,
        toolId: tool.toolId,
        ok: false,
        error: `Tool ${tool.toolId} does not implement execute().`,
        completedAt
      };
    }

    try {
      const output = await tool.execute(input, cloneValue(context));
      return {
        invocationId,
        toolId: tool.toolId,
        ok: true,
        output: cloneValue(output),
        completedAt
      };
    } catch (error) {
      return {
        invocationId,
        toolId: tool.toolId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        completedAt
      };
    }
  }
}
