import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type {
  HostCapabilities,
  McpConfigSource,
  McpRuntimeConfig,
  McpRuntimeSummary,
  McpServerConfig,
  McpTransportKind,
  McpTrustMode
} from "@supercode/core";

type McpConfigCandidate = {
  path: string;
  source: Exclude<McpConfigSource, "none">;
};

type ParsedMcpDocument = {
  servers: McpServerConfig[];
  trustMode: McpTrustMode;
  notes: string[];
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function readJson(filePath: string): unknown | undefined {
  try {
    const raw = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function getConfigCandidates(cwd: string): McpConfigCandidate[] {
  return [
    {
      path: path.join(cwd, ".mcp.json"),
      source: "project"
    },
    {
      path: path.join(cwd, ".supercode", "mcp.json"),
      source: "supercode"
    }
  ];
}

function normalizeServerIds(ids: string[]): string[] {
  return [...new Set(ids.map(id => id.trim()).filter(Boolean))];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value.map(entry => String(entry).trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const normalized = Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => [key.trim(), String(entry).trim()] as const)
      .filter(([key, entry]) => Boolean(key) && Boolean(entry))
  );

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "enabled", "on", "yes"].includes(normalized)) {
    return true;
  }

  if (["false", "disabled", "off", "no"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function readBooleanTrust(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["trusted", "allow", "allowed", "enabled", "true"].includes(normalized)) {
    return true;
  }

  if (["untrusted", "deny", "denied", "disabled", "false"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function readWholeNumber(value: unknown, fallback: number, minimum = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(minimum, Math.floor(value));
}

function inferTransport(serverConfig: Record<string, unknown>): McpTransportKind {
  const explicit = typeof serverConfig.transport === "string" ? serverConfig.transport.trim().toLowerCase() : "";
  if (["builtin", "stdio", "http"].includes(explicit)) {
    return explicit as McpTransportKind;
  }

  if (typeof serverConfig.url === "string" && serverConfig.url.trim()) {
    return "http";
  }

  if (typeof serverConfig.command === "string" && serverConfig.command.trim()) {
    return "stdio";
  }

  return "unknown";
}

function deriveTrustMode(flags: Array<boolean | undefined>): McpTrustMode {
  const known = flags.filter(flag => flag !== undefined);
  if (known.length === 0) {
    return "unknown";
  }

  const trustedCount = known.filter(Boolean).length;
  if (trustedCount === known.length) {
    return "trusted";
  }

  if (trustedCount === 0) {
    return "untrusted";
  }

  return "mixed";
}

function parseServerEntries(config: unknown): Array<[string, unknown]> {
  if (!config || typeof config !== "object") {
    return [];
  }

  const configRecord = config as Record<string, unknown>;
  const objectShape = configRecord.mcpServers ?? configRecord.servers;

  if (objectShape && typeof objectShape === "object" && !Array.isArray(objectShape)) {
    return Object.entries(objectShape as Record<string, unknown>);
  }

  if (Array.isArray(objectShape)) {
    return objectShape.map((entry, index) => {
      if (entry && typeof entry === "object" && "name" in (entry as Record<string, unknown>)) {
        return [String((entry as Record<string, unknown>).name), entry] as [string, unknown];
      }

      return [`server-${index + 1}`, entry] as [string, unknown];
    });
  }

  return [];
}

function parseServerConfig(
  serverId: string,
  serverConfig: unknown,
  defaultTrust: boolean | undefined
): McpServerConfig {
  const serverRecord =
    serverConfig && typeof serverConfig === "object" && !Array.isArray(serverConfig)
      ? (serverConfig as Record<string, unknown>)
      : {};
  const transport = inferTransport(serverRecord);
  const enabled = readBoolean(serverRecord.enabled) ?? true;
  const trusted =
    readBooleanTrust(serverRecord.trust) ??
    readBooleanTrust(serverRecord.trusted) ??
    defaultTrust;
  const command = typeof serverRecord.command === "string" && serverRecord.command.trim()
    ? serverRecord.command.trim()
    : undefined;
  const url = typeof serverRecord.url === "string" && serverRecord.url.trim()
    ? serverRecord.url.trim()
    : undefined;
  const notes = [
    transport === "unknown" ? `Server ${serverId} does not define a supported transport.` : "",
    !enabled ? `Server ${serverId} is disabled in the active MCP config.` : "",
    transport === "builtin" ? `Server ${serverId} uses Supercode's builtin MCP runtime transport.` : ""
  ].filter(Boolean);

  return {
    serverId,
    transport,
    enabled,
    trusted,
    command,
    args: normalizeStringArray(serverRecord.args),
    url,
    env: normalizeStringRecord(serverRecord.env),
    headers: normalizeStringRecord(serverRecord.headers),
    timeoutMs: readWholeNumber(serverRecord.timeoutMs ?? serverRecord.timeout, 5000, 1),
    retryCount: readWholeNumber(serverRecord.retryCount ?? serverRecord.retries ?? serverRecord.retryAttempts, 0, 0),
    concurrencyLimit: readWholeNumber(serverRecord.concurrencyLimit, 5, 1),
    queueLimit: readWholeNumber(serverRecord.queueLimit, 10, 0),
    notes
  };
}

function parseMcpConfigDocument(config: unknown): ParsedMcpDocument {
  if (!config || typeof config !== "object") {
    return {
      servers: [],
      trustMode: "unknown",
      notes: ["MCP config exists but does not contain a recognized object structure."]
    };
  }

  const configRecord = config as Record<string, unknown>;
  const topLevelTrust =
    configRecord.trust && typeof configRecord.trust === "object" && !Array.isArray(configRecord.trust)
      ? (configRecord.trust as Record<string, unknown>)
      : undefined;
  const defaultTrust = readBooleanTrust(topLevelTrust?.default);
  const serverEntries = parseServerEntries(config);
  const serverIds = normalizeServerIds(serverEntries.map(([serverId]) => serverId));
  const servers = serverEntries.map(([serverId, serverConfig]) => parseServerConfig(serverId, serverConfig, defaultTrust));
  const activeServers = servers.filter(server => server.enabled);

  return {
    servers,
    trustMode: deriveTrustMode(activeServers.map(server => server.trusted)),
    notes: [
      serverIds.length > 0
        ? `Detected ${serverIds.length} MCP server definition${serverIds.length === 1 ? "" : "s"}.`
        : "No MCP servers are defined in the active config."
    ]
  };
}

export function loadMcpRuntimeConfig(cwd: string): McpRuntimeConfig {
  const candidates = getConfigCandidates(cwd);
  const existingCandidates = candidates.filter(candidate => existsSync(candidate.path));
  const activeCandidate = existingCandidates[0];

  if (!activeCandidate) {
    return {
      configSource: "none",
      servers: [],
      notes: ["No MCP config file detected in the current project."]
    };
  }

  const activeConfig = readJson(activeCandidate.path);
  if (!activeConfig) {
    return {
      configPath: activeCandidate.path,
      configSource: activeCandidate.source,
      servers: [],
      notes: unique([
        `Using ${activeCandidate.source} MCP config at ${activeCandidate.path}.`,
        "The active MCP config could not be parsed as valid JSON.",
        existingCandidates.length > 1
          ? "Multiple MCP config files were found; project config takes precedence over .supercode/mcp.json."
          : ""
      ])
    };
  }

  const parsed = parseMcpConfigDocument(activeConfig);
  return {
    configPath: activeCandidate.path,
    configSource: activeCandidate.source,
    servers: parsed.servers.map(server => clone(server)),
    notes: unique([
      `Using ${activeCandidate.source} MCP config at ${activeCandidate.path}.`,
      existingCandidates.length > 1
        ? "Multiple MCP config files were found; project config takes precedence over .supercode/mcp.json."
        : "",
      ...parsed.notes
    ])
  };
}

export function detectMcpSupport(
  cwd: string,
  host: HostCapabilities,
  env: NodeJS.ProcessEnv = process.env
): McpRuntimeSummary {
  const explicitDisable = env.SUPERCODE_DISABLE_MCP === "1";
  const config = loadMcpRuntimeConfig(cwd);
  const activeServers = config.servers.filter(server => server.enabled);
  const serverIds = activeServers.map(server => server.serverId);
  const trustMode = deriveTrustMode(activeServers.map(server => server.trusted));

  return {
    available: host.supportsMcp && !explicitDisable,
    configured: activeServers.length > 0,
    configPath: config.configPath,
    configSource: config.configSource,
    serverCount: activeServers.length,
    serverIds,
    trustMode,
    notes: unique([
      explicitDisable ? "MCP was disabled explicitly through SUPERCODE_DISABLE_MCP." : "",
      !host.supportsMcp ? "The current host does not advertise MCP support." : "",
      ...config.notes
    ])
  };
}
