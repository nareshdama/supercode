import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type {
  ContextWindowTier,
  HostCapabilities,
  HostId,
  InvocationContext,
  ModelCapabilities,
  PackageManager,
  ProjectProfile,
  ReasoningTier,
  SafetyProfile
} from "@nareshdama/core";
import { inferModelCapabilities } from "@nareshdama/models";

type EnvLike = NodeJS.ProcessEnv;

type PackageJsonLike = {
  scripts?: Record<string, string>;
  packageManager?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
};

const PROJECT_SIGNAL_FILES = [
  "package.json",
  "tsconfig.json",
  "pyproject.toml",
  "requirements.txt",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb"
];

function readJson<T>(filePath: string): T | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return undefined;
  }
}

function fileExists(cwd: string, fileName: string): boolean {
  return existsSync(path.join(cwd, fileName));
}

function detectPackageManagerFromString(value?: string): PackageManager {
  if (!value) {
    return "unknown";
  }

  const normalized = value.toLowerCase();
  if (normalized.includes("pnpm")) return "pnpm";
  if (normalized.includes("yarn")) return "yarn";
  if (normalized.includes("bun")) return "bun";
  if (normalized.includes("npm")) return "npm";
  return "unknown";
}

function parseBooleanOverride(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function parseContextWindowOverride(value: string | undefined): ContextWindowTier | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "small" || normalized === "medium" || normalized === "large" || normalized === "unknown") {
    return normalized;
  }

  return undefined;
}

function parseReasoningOverride(value: string | undefined): ReasoningTier | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "fast" || normalized === "balanced" || normalized === "deep" || normalized === "unknown") {
    return normalized;
  }

  return undefined;
}

function findNearestSignalDirectory(startDir: string): string {
  let current = path.resolve(startDir);
  const homeDir = path.resolve(homedir());

  while (true) {
    if (PROJECT_SIGNAL_FILES.some(fileName => fileExists(current, fileName))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === homeDir && current !== homeDir) {
      return path.resolve(startDir);
    }
    if (parent === current) {
      return path.resolve(startDir);
    }
    current = parent;
  }
}

function findWorkspaceRoot(projectRoot: string): string {
  let current = projectRoot;

  while (true) {
    const packageJson = readJson<PackageJsonLike>(path.join(current, "package.json"));
    const hasWorkspaceSignals =
      fileExists(current, "pnpm-workspace.yaml") ||
      fileExists(current, "turbo.json") ||
      Array.isArray(packageJson?.workspaces) ||
      Boolean(packageJson?.workspaces && typeof packageJson.workspaces === "object" && "packages" in packageJson.workspaces);

    if (hasWorkspaceSignals) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return projectRoot;
    }
    current = parent;
  }
}

function detectProjectFiles(projectRoot: string): string[] {
  return PROJECT_SIGNAL_FILES.filter(fileName => fileExists(projectRoot, fileName));
}

function getExplicitHostBase(hostName: string): HostCapabilities {
  const normalized = hostName.trim().toLowerCase();

  const knownHosts: Record<HostId, Omit<HostCapabilities, "source" | "confidence" | "notes">> = {
    codex: {
      hostId: "codex",
      displayName: "Codex",
      supportsTools: true,
      supportsMcp: true,
      supportsStreaming: true,
      supportsMultiAgent: true
    },
    "generic-cli": {
      hostId: "generic-cli",
      displayName: "Generic CLI",
      supportsTools: true,
      supportsMcp: true,
      supportsStreaming: true,
      supportsMultiAgent: false
    },
    ci: {
      hostId: "ci",
      displayName: "CI",
      supportsTools: true,
      supportsMcp: false,
      supportsStreaming: false,
      supportsMultiAgent: false
    },
    "github-actions": {
      hostId: "github-actions",
      displayName: "GitHub Actions",
      supportsTools: true,
      supportsMcp: false,
      supportsStreaming: false,
      supportsMultiAgent: false
    },
    vscode: {
      hostId: "vscode",
      displayName: "VS Code",
      supportsTools: true,
      supportsMcp: false,
      supportsStreaming: true,
      supportsMultiAgent: false
    },
    unknown: {
      hostId: "unknown",
      displayName: "Unknown Host",
      supportsTools: false,
      supportsMcp: false,
      supportsStreaming: false,
      supportsMultiAgent: false
    }
  };

  if (normalized in knownHosts) {
    const host = knownHosts[normalized as HostId];
    return {
      ...host,
      source: "explicit",
      confidence: "high"
    };
  }

  return {
    hostId: "unknown",
    displayName: hostName,
    supportsTools: false,
    supportsMcp: false,
    supportsStreaming: false,
    supportsMultiAgent: false,
    source: "explicit",
    confidence: "high",
    notes: [`Host "${hostName}" is not recognized yet; Supercode is using safe defaults.`]
  };
}

function applyHostOverrides(base: HostCapabilities, env: EnvLike): HostCapabilities {
  const toolsOverride = parseBooleanOverride(env.SUPERCODE_HOST_SUPPORTS_TOOLS);
  const mcpOverride = parseBooleanOverride(env.SUPERCODE_HOST_SUPPORTS_MCP);
  const streamingOverride = parseBooleanOverride(env.SUPERCODE_HOST_SUPPORTS_STREAMING);
  const multiAgentOverride = parseBooleanOverride(env.SUPERCODE_HOST_SUPPORTS_MULTI_AGENT);

  return {
    ...base,
    supportsTools: toolsOverride ?? base.supportsTools,
    supportsMcp: mcpOverride ?? base.supportsMcp,
    supportsStreaming: streamingOverride ?? base.supportsStreaming,
    supportsMultiAgent: multiAgentOverride ?? base.supportsMultiAgent
  };
}

export function detectInvocationContext(env: EnvLike = process.env): InvocationContext {
  const userAgent = env.npm_config_user_agent;
  const execPath = env.npm_execpath ?? "";
  const command = env.npm_command ?? "";

  if (execPath.includes("pnpm") && command === "dlx") {
    return { launcher: "pnpm-dlx", packageManager: "pnpm", userAgent };
  }

  if (execPath.includes("pnpm")) {
    return { launcher: "pnpm", packageManager: "pnpm", userAgent };
  }

  if (execPath.includes("yarn")) {
    return { launcher: "yarn", packageManager: "yarn", userAgent };
  }

  if (execPath.includes("bun")) {
    return { launcher: "bunx", packageManager: "bun", userAgent };
  }

  if (execPath.includes("npm-cli") && command === "exec") {
    return { launcher: "npx", packageManager: "npm", userAgent };
  }

  if (execPath.includes("npm-cli")) {
    return { launcher: "npm", packageManager: "npm", userAgent };
  }

  return {
    launcher: "direct",
    packageManager: detectPackageManagerFromString(userAgent),
    userAgent
  };
}

export function detectHostCapabilities(env: EnvLike = process.env): HostCapabilities {
  const explicitHost = env.SUPERCODE_HOST?.trim();
  if (explicitHost) {
    return applyHostOverrides(getExplicitHostBase(explicitHost), env);
  }

  if (env.CODEX_HOME || env.CODEX_SANDBOX) {
    return applyHostOverrides(
      {
        hostId: "codex",
        displayName: "Codex",
        supportsTools: true,
        supportsMcp: true,
        supportsStreaming: true,
        supportsMultiAgent: true,
        source: "detected",
        confidence: "medium"
      },
      env
    );
  }

  if (env.GITHUB_ACTIONS === "true") {
    return applyHostOverrides(
      {
        hostId: "github-actions",
        displayName: "GitHub Actions",
        supportsTools: true,
        supportsMcp: false,
        supportsStreaming: false,
        supportsMultiAgent: false,
        source: "detected",
        confidence: "high"
      },
      env
    );
  }

  if (env.CI === "true") {
    return applyHostOverrides(
      {
        hostId: "ci",
        displayName: "CI",
        supportsTools: true,
        supportsMcp: false,
        supportsStreaming: false,
        supportsMultiAgent: false,
        source: "detected",
        confidence: "high"
      },
      env
    );
  }

  if (env.VSCODE_PID) {
    return applyHostOverrides(
      {
        hostId: "vscode",
        displayName: "VS Code",
        supportsTools: true,
        supportsMcp: false,
        supportsStreaming: true,
        supportsMultiAgent: false,
        source: "detected",
        confidence: "medium"
      },
      env
    );
  }

  return applyHostOverrides(
    {
      hostId: "generic-cli",
      displayName: "Generic CLI",
      supportsTools: true,
      supportsMcp: true,
      supportsStreaming: true,
      supportsMultiAgent: false,
      source: "default",
      confidence: "medium",
      notes: ["No host-specific adapter was detected; Supercode is using generic CLI capabilities."]
    },
    env
  );
}

export function detectModelCapabilities(env: EnvLike = process.env): ModelCapabilities {
  const candidates = [
    env.SUPERCODE_MODEL,
    env.OPENAI_MODEL,
    env.ANTHROPIC_MODEL,
    env.MODEL,
    env.CLAUDE_MODEL
  ].filter(Boolean) as string[];

  const explicitProvider = env.SUPERCODE_MODEL_PROVIDER ?? env.OPENAI_PROVIDER ?? env.ANTHROPIC_PROVIDER;
  const base =
    candidates.length > 0 ? inferModelCapabilities(candidates[0], explicitProvider) : inferModelCapabilities(undefined, explicitProvider);

  const supportsTools = parseBooleanOverride(env.SUPERCODE_MODEL_SUPPORTS_TOOLS);
  const supportsStreaming = parseBooleanOverride(env.SUPERCODE_MODEL_SUPPORTS_STREAMING);
  const contextWindow = parseContextWindowOverride(env.SUPERCODE_MODEL_CONTEXT_WINDOW);
  const reasoning = parseReasoningOverride(env.SUPERCODE_MODEL_REASONING);

  if (
    supportsTools === undefined &&
    supportsStreaming === undefined &&
    contextWindow === undefined &&
    reasoning === undefined
  ) {
    return base;
  }

  return {
    ...base,
    supportsTools: supportsTools ?? base.supportsTools,
    supportsStreaming: supportsStreaming ?? base.supportsStreaming,
    contextWindow: contextWindow ?? base.contextWindow,
    reasoning: reasoning ?? base.reasoning,
    source: "explicit",
    confidence: "high",
    notes: [...(base.notes ?? []), "Model capabilities were refined by explicit Supercode environment overrides."]
  };
}

function detectProjectPackageManager(projectRoot: string, packageJson?: PackageJsonLike): PackageManager {
  if (packageJson?.packageManager) {
    return detectPackageManagerFromString(packageJson.packageManager);
  }

  if (fileExists(projectRoot, "pnpm-lock.yaml")) return "pnpm";
  if (fileExists(projectRoot, "yarn.lock")) return "yarn";
  if (fileExists(projectRoot, "bun.lockb") || fileExists(projectRoot, "bun.lock")) return "bun";
  if (fileExists(projectRoot, "package-lock.json")) return "npm";
  return "unknown";
}

function detectFrameworks(packageJson?: PackageJsonLike): string[] {
  const deps = {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {})
  };

  const frameworks: string[] = [];
  const known = ["react", "next", "vite", "vitest", "jest", "express", "fastify", "@nestjs/core"];
  for (const dependency of known) {
    if (dependency in deps) {
      frameworks.push(dependency);
    }
  }

  return frameworks;
}

function detectGitState(cwd: string): { isGitRepo: boolean; gitDirty: boolean } {
  const inside = spawnSync("git", ["-C", cwd, "rev-parse", "--is-inside-work-tree"], {
    encoding: "utf8"
  });

  if (inside.status !== 0 || inside.stdout.trim() !== "true") {
    return { isGitRepo: false, gitDirty: false };
  }

  const status = spawnSync("git", ["-C", cwd, "status", "--porcelain"], {
    encoding: "utf8"
  });

  return {
    isGitRepo: true,
    gitDirty: status.status === 0 && status.stdout.trim().length > 0
  };
}

export function detectProjectProfile(cwd: string = process.cwd()): ProjectProfile {
  const projectRoot = findNearestSignalDirectory(cwd);
  const workspaceRoot = findWorkspaceRoot(projectRoot);
  const packageJson = readJson<PackageJsonLike>(path.join(projectRoot, "package.json"));
  const nodeProject = Boolean(packageJson);
  const hasTsconfig = fileExists(projectRoot, "tsconfig.json");
  const hasPyProject = fileExists(projectRoot, "pyproject.toml");
  const hasRequirements = fileExists(projectRoot, "requirements.txt");

  const primaryLanguage = hasTsconfig ? "typescript" : nodeProject ? "javascript" : hasPyProject || hasRequirements ? "python" : "unknown";
  const packageManager = detectProjectPackageManager(projectRoot, packageJson);
  const frameworks = detectFrameworks(packageJson);
  const gitState = detectGitState(workspaceRoot);
  const fileSignals = detectProjectFiles(projectRoot);

  return {
    cwd,
    projectRoot,
    packageManager,
    primaryLanguage,
    frameworks,
    scripts: {
      build: packageJson?.scripts?.build,
      test: packageJson?.scripts?.test,
      lint: packageJson?.scripts?.lint
    },
    isGitRepo: gitState.isGitRepo,
    gitDirty: gitState.gitDirty,
    nodeProject,
    hasTsconfig,
    fileSignals
  };
}

export function detectSafetyProfile(env: EnvLike = process.env): SafetyProfile {
  return {
    permissionMode: (env.SUPERCODE_PERMISSION_MODE as SafetyProfile["permissionMode"]) ?? "default",
    filesystemScope: "workspace",
    networkAccess: env.SUPERCODE_NETWORK === "enabled" ? "enabled" : "restricted"
  };
}

export function detectRuntimeInputs(cwd: string = process.cwd(), env: EnvLike = process.env): {
  invocation: InvocationContext;
  host: HostCapabilities;
  model: ModelCapabilities;
  project: ProjectProfile;
  safety: SafetyProfile;
} {
  return {
    invocation: detectInvocationContext(env),
    host: detectHostCapabilities(env),
    model: detectModelCapabilities(env),
    project: detectProjectProfile(cwd),
    safety: detectSafetyProfile(env)
  };
}
