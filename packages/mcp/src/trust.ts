import type {
  McpServerConfig,
  MCPTrustClass,
  MCPIsolationMode,
  MCPCredentialMode,
  MCPCapabilityProfile
} from "@nareshdama/core";

export function determineTrustClass(config: McpServerConfig): MCPTrustClass {
  // If explicitly trusted via config overrides
  if (config.trusted === true) {
    return "trusted";
  }

  // HTTP transports that aren't loopback are untrusted by default unless overridden
  if (config.transport === "http" && config.url) {
    try {
      const url = new URL(config.url);
      if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
        return "untrusted";
      }
    } catch {
      return "untrusted";
    }
  }

  // Stdios and local HTTP are restricted by default unless explicitly trusted
  return "restricted";
}

export function determineIsolationMode(config: McpServerConfig): MCPIsolationMode {
  if (config.transport === "builtin") {
    return "in_process";
  }
  if (config.transport === "http") {
    return "remote";
  }
  if (config.transport === "stdio") {
    return "subprocess";
  }
  return "remote";
}

export function determineCredentialMode(trustClass: MCPTrustClass): MCPCredentialMode {
  switch (trustClass) {
    case "trusted":
      return "delegated";
    case "restricted":
      return "brokered";
    case "untrusted":
      return "none";
  }
}

const HIGH_RISK_CAPABILITIES = new Set([
  "fs_write",
  "fs_delete",
  "shell_exec",
  "write_file",
  "delete_file",
  "execute_command"
]);

export function filterCapabilitiesByTrust(
  capabilities: MCPCapabilityProfile,
  trustClass: MCPTrustClass
): MCPCapabilityProfile {
  if (trustClass === "untrusted") {
    // Untrusted servers get NO capabilities exposed
    return {
      ...capabilities,
      tools: [],
      resources: [],
      prompts: [],
      supportsStreaming: false
    };
  }

  if (trustClass === "trusted") {
    // Trusted gets full capabilities
    return { ...capabilities };
  }

  // Restricted class: Filter out known high-risk tool prefixes
  const safeTools = capabilities.tools.filter(tool => {
    const name = typeof tool.name === "string" ? tool.name.toLowerCase() : "";
    return !Array.from(HIGH_RISK_CAPABILITIES).some(risk => name.includes(risk));
  });

  return {
    ...capabilities,
    tools: safeTools
  };
}
