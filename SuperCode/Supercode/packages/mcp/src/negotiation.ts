import type { MCPCapabilityProfile } from "@supercode/core";

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

  const result = initResponse.result as any;
  const protocolVersion = result?.protocolVersion ?? "2024-11-05";
  const serverCapabilities = result?.capabilities ?? {};

  // Send initialized notification
  await send({
    jsonrpc: "2.0",
    method: "notifications/initialized"
  });

  // Fetch tools if supported
  const tools: Record<string, unknown>[] = [];
  if (serverCapabilities.tools !== undefined) {
    const toolsResponse = await send({
      jsonrpc: "2.0",
      id: "tools-1",
      method: "tools/list"
    });

    if (toolsResponse && toolsResponse.result && Array.isArray((toolsResponse.result as any).tools)) {
      tools.push(...((toolsResponse.result as any).tools));
    }
  }

  // Fetch resources if supported
  const resources: Record<string, unknown>[] = [];
  if (serverCapabilities.resources !== undefined) {
    const resResponse = await send({
      jsonrpc: "2.0",
      id: "res-1",
      method: "resources/list"
    });

    if (resResponse && resResponse.result && Array.isArray((resResponse.result as any).resources)) {
      resources.push(...((resResponse.result as any).resources));
    }
  }

  return {
    protocolVersion,
    tools,
    resources,
    prompts: [], // Simplified for MVP
    supportsStreaming: serverCapabilities.prompts?.listChanged === true || false,
    maxConcurrentRequests: 5 // Default backpressure cap
  };
}
