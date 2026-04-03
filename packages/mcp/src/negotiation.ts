import type { MCPCapabilityProfile } from "@nareshdama/core";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type McpSendFn = (message: JsonRpcRequest | JsonRpcNotification) => Promise<JsonRpcResponse | void>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readArrayField(
  response: JsonRpcResponse | void,
  fieldName: "tools" | "resources"
): Record<string, unknown>[] {
  const result = response?.result;
  if (!isRecord(result)) {
    throw new Error(`Capability schema violation: ${fieldName}/list result must be an object.`);
  }

  const entries = result[fieldName];
  if (!Array.isArray(entries)) {
    throw new Error(`Capability schema violation: ${fieldName}/list.${fieldName} must be an array.`);
  }

  return entries.filter(isRecord);
}

export async function negotiateCapabilities(send: McpSendFn): Promise<MCPCapabilityProfile> {
  const initRequest: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: "init-1",
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "supercode",
        version: "0.1.0"
      }
    }
  };

  const initResponse = await send(initRequest);

  if (!initResponse || initResponse.error) {
    throw new Error(`MCP Initialization failed: ${initResponse?.error?.message ?? "No response"}`);
  }

  if (!isRecord(initResponse.result)) {
    throw new Error("Capability schema violation: initialize result must be an object.");
  }

  const result = initResponse.result as Record<string, unknown>;
  const protocolVersion =
    typeof result.protocolVersion === "string" && result.protocolVersion.trim()
      ? result.protocolVersion
      : "2024-11-05";
  const serverCapabilities = result?.capabilities ?? {};

  if (!isRecord(serverCapabilities)) {
    throw new Error("Capability schema violation: initialize.capabilities must be an object.");
  }

  // Send initialized notification
  await send({
    jsonrpc: "2.0",
    method: "notifications/initialized"
  });

  // Fetch tools if supported
  const tools: Record<string, unknown>[] = [];
  if (serverCapabilities.tools !== undefined) {
    tools.push(...readArrayField(await send({
      jsonrpc: "2.0",
      id: "tools-1",
      method: "tools/list"
    }), "tools"));
  }

  // Fetch resources if supported
  const resources: Record<string, unknown>[] = [];
  if (serverCapabilities.resources !== undefined) {
    resources.push(...readArrayField(await send({
      jsonrpc: "2.0",
      id: "res-1",
      method: "resources/list"
    }), "resources"));
  }

  return {
    protocolVersion,
    tools,
    resources,
    prompts: [], // Simplified for MVP
    supportsStreaming: serverCapabilities.streaming === true,
    maxConcurrentRequests: 5 // Default backpressure cap
  };
}
