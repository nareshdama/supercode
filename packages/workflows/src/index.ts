import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  HostCapabilities,
  ModelCapabilities,
  PackInstallState,
  ProjectProfile,
  RuleDefinition,
  SkillDefinition,
  WorkflowPack,
  WorkflowExtensionState,
  WorkflowHookDefinition,
  WorkflowHookManifest,
  WorkflowPluginManifest,
  WorkflowPluginCommandDefinition,
  WorkflowPluginSummary,
  WorkflowPluginRunStepDefinition,
  WorkflowPluginToolDefinition,
  WorkflowResolvedPluginCommandDefinition,
  WorkflowResolvedHookDefinition,
  WorkflowResolvedPluginRunStepDefinition,
  WorkflowResolvedPluginToolDefinition,
  WorkflowValidationIssue,
  WorkflowValidationReport,
  WorkflowPackManifest,
  WorkflowPackSummary,
  WorkflowRecommendation
} from "@nareshdama/core";
import { PACK_MANIFESTS } from "./manifests.js";

type WorkflowCatalog = {
  packs: WorkflowPack[];
  packById: Map<string, WorkflowPack>;
};

export interface WorkflowMatch<T> {
  item: T;
  score: number;
  reasons: string[];
  sourceType: "pack" | "plugin";
  sourceId: string;
  sourceTitle: string;
  path?: string;
}

type WorkflowCatalogSkillEntry = {
  skill: SkillDefinition;
  sourceType: "pack" | "plugin";
  sourceId: string;
  sourceTitle: string;
  path?: string;
};

type WorkflowCatalogRuleEntry = {
  rule: RuleDefinition;
  sourceType: "pack" | "plugin";
  sourceId: string;
  sourceTitle: string;
  path?: string;
};

function normalizeText(value: string): string {
  return value.trim();
}

function normalizeList(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function assertNonEmpty(value: string, field: string, context: string): string {
  const normalized = normalizeText(value);
  if (!normalized) {
    throw new Error(`${context} must define a non-empty ${field}.`);
  }
  return normalized;
}

function normalizeHookFailurePolicy(
  value: WorkflowHookDefinition["onFailure"],
  context: string
): "continue" | "abort" {
  if (value === undefined) {
    return "continue";
  }
  if (value === "continue" || value === "abort") {
    return value;
  }
  throw new Error(`${context} defines unsupported onFailure policy "${String(value)}".`);
}

function validateSkill(skill: SkillDefinition, packId: string): SkillDefinition {
  return {
    skillId: assertNonEmpty(skill.skillId, "skillId", `Workflow pack ${packId}`),
    title: assertNonEmpty(skill.title, "title", `Workflow pack ${packId} skill ${skill.skillId}`),
    summary: assertNonEmpty(skill.summary, "summary", `Workflow pack ${packId} skill ${skill.skillId}`),
    tags: normalizeList(skill.tags),
    triggers: normalizeList(skill.triggers),
    instructions: normalizeList(skill.instructions),
    provenance: skill.provenance ? normalizeText(skill.provenance) : undefined
  };
}

function validateRule(rule: RuleDefinition, packId: string): RuleDefinition {
  return {
    ruleId: assertNonEmpty(rule.ruleId, "ruleId", `Workflow pack ${packId}`),
    title: assertNonEmpty(rule.title, "title", `Workflow pack ${packId} rule ${rule.ruleId}`),
    summary: assertNonEmpty(rule.summary, "summary", `Workflow pack ${packId} rule ${rule.ruleId}`),
    severity: rule.severity,
    appliesTo: normalizeList(rule.appliesTo),
    guidance: normalizeList(rule.guidance),
    provenance: rule.provenance ? normalizeText(rule.provenance) : undefined
  };
}

function assertNoDuplicates(ids: string[], label: string, context: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`${context} defines duplicate ${label} "${id}".`);
    }
    seen.add(id);
  }
}

export function validateWorkflowPackManifest(manifest: WorkflowPackManifest): WorkflowPack {
  if (manifest.schemaVersion !== 1) {
    throw new Error(`Workflow pack ${manifest.packId} uses unsupported schema version ${manifest.schemaVersion}.`);
  }

  const packId = assertNonEmpty(manifest.packId, "packId", "Workflow pack");
  const skills = manifest.skills.map(skill => validateSkill(skill, packId));
  const rules = manifest.rules.map(rule => validateRule(rule, packId));

  assertNoDuplicates(
    skills.map(skill => skill.skillId),
    "skillId",
    `Workflow pack ${packId}`
  );
  assertNoDuplicates(
    rules.map(rule => rule.ruleId),
    "ruleId",
    `Workflow pack ${packId}`
  );

  return {
    schemaVersion: 1,
    packId,
    title: assertNonEmpty(manifest.title, "title", `Workflow pack ${packId}`),
    description: assertNonEmpty(manifest.description, "description", `Workflow pack ${packId}`),
    source: manifest.source,
    installMode: manifest.installMode,
    references: normalizeList(manifest.references),
    skills,
    rules
  };
}

function buildWorkflowCatalog(manifests: WorkflowPackManifest[]): WorkflowCatalog {
  const packs = manifests.map(validateWorkflowPackManifest);
  assertNoDuplicates(
    packs.map(pack => pack.packId),
    "packId",
    "Workflow catalog"
  );
  assertNoDuplicates(
    packs.flatMap(pack => pack.skills.map(skill => skill.skillId)),
    "skillId",
    "Workflow catalog"
  );
  assertNoDuplicates(
    packs.flatMap(pack => pack.rules.map(rule => rule.ruleId)),
    "ruleId",
    "Workflow catalog"
  );

  return {
    packs,
    packById: new Map(packs.map(pack => [pack.packId, pack]))
  };
}

const CATALOG = buildWorkflowCatalog(PACK_MANIFESTS);

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function tokenize(text: string): string[] {
  const stopwords = new Set([
    "a",
    "an",
    "and",
    "before",
    "for",
    "from",
    "in",
    "into",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with"
  ]);

  return [
    ...new Set(
      normalize(text)
        .split(/[^a-z0-9]+/)
        .map(token => {
          if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
            return token.slice(0, -1);
          }

          return token;
        })
        .filter(token => token.length > 1 && !stopwords.has(token))
    )
  ];
}

function scoreTextAgainstTask(
  task: string,
  taskTokens: string[],
  candidate: string,
  options: {
    phraseWeight: number;
    tokenWeight: number;
    label: string;
  }
): { score: number; reasons: string[] } {
  const candidateText = normalize(candidate);
  if (!candidateText || !task) {
    return { score: 0, reasons: [] };
  }

  let score = 0;
  const reasons: string[] = [];
  if (task.includes(candidateText) || candidateText.includes(task)) {
    score += options.phraseWeight;
    reasons.push(`${options.label} phrase match`);
  }

  const candidateTokens = tokenize(candidateText);
  const overlappingTokens = candidateTokens.filter(token => taskTokens.includes(token));
  if (overlappingTokens.length > 0) {
    score += overlappingTokens.length * options.tokenWeight;
    reasons.push(`${options.label} tokens: ${overlappingTokens.join(", ")}`);
  }

  return { score, reasons };
}

function dedupeReasons(reasons: string[]): string[] {
  return [...new Set(reasons)];
}

function scoreSkill(task: string, skill: SkillDefinition): WorkflowMatch<SkillDefinition> {
  const taskText = normalize(task);
  const taskTokens = tokenize(taskText);
  let score = 0;
  const reasons: string[] = [];

  for (const [value, phraseWeight, tokenWeight, label] of [
    [skill.title, 10, 4, "title"],
    [skill.summary, 6, 2, "summary"],
    [skill.tags.join(" "), 0, 4, "tags"],
    [skill.triggers.join(" "), 8, 4, "triggers"],
    [skill.instructions.join(" "), 2, 1, "instructions"]
  ] as const) {
    const next = scoreTextAgainstTask(taskText, taskTokens, value, {
      phraseWeight,
      tokenWeight,
      label
    });
    score += next.score;
    reasons.push(...next.reasons);
  }

  return {
    item: skill,
    score,
    reasons: dedupeReasons(reasons),
    sourceType: "pack",
    sourceId: "unknown",
    sourceTitle: "Unknown"
  };
}

function scoreRule(task: string, rule: RuleDefinition): WorkflowMatch<RuleDefinition> {
  const taskText = normalize(task);
  const taskTokens = tokenize(taskText);
  let score = 0;
  const reasons: string[] = [];

  for (const [value, phraseWeight, tokenWeight, label] of [
    [rule.title, 10, 4, "title"],
    [rule.summary, 6, 2, "summary"],
    [rule.appliesTo.join(" "), 0, 3, "scope"],
    [rule.guidance.join(" "), 2, 1, "guidance"]
  ] as const) {
    const next = scoreTextAgainstTask(taskText, taskTokens, value, {
      phraseWeight,
      tokenWeight,
      label
    });
    score += next.score;
    reasons.push(...next.reasons);
  }

  return {
    item: rule,
    score,
    reasons: dedupeReasons(reasons),
    sourceType: "pack",
    sourceId: "unknown",
    sourceTitle: "Unknown"
  };
}

function sortMatches<T extends { title: string }>(matches: WorkflowMatch<T>[]): WorkflowMatch<T>[] {
  return matches.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.item.title.localeCompare(right.item.title);
  });
}

function createEmptyPackState(): PackInstallState {
  return {
    version: 1,
    installedPackIds: [],
    updatedAt: new Date(0).toISOString()
  };
}

function getPackStatePath(cwd: string): string {
  return path.join(cwd, ".supercode", "packs.json");
}

function ensureProjectStateDir(cwd: string): void {
  mkdirSync(path.join(cwd, ".supercode"), { recursive: true });
}

function normalizeInstalledPackIds(packIds: string[]): string[] {
  return [...new Set(packIds.filter(packId => CATALOG.packById.has(packId)))];
}

function createPackState(installedPackIds: string[]): PackInstallState {
  return {
    version: 1,
    installedPackIds: normalizeInstalledPackIds(installedPackIds),
    updatedAt: new Date().toISOString()
  };
}

function getExtensionRootPath(cwd: string): string {
  return path.join(cwd, ".supercode", "extensions");
}

function getGeneratedExtensionsPath(cwd: string): string {
  return path.join(getExtensionRootPath(cwd), "generated");
}

function getGeneratedSkillsPath(cwd: string): string {
  return path.join(getGeneratedExtensionsPath(cwd), "skills");
}

function getGeneratedRulesPath(cwd: string): string {
  return path.join(getGeneratedExtensionsPath(cwd), "rules");
}

function getExtensionManifestPath(cwd: string): string {
  return path.join(getExtensionRootPath(cwd), "manifest.json");
}

function getLocalHooksPath(cwd: string): string {
  return path.join(getExtensionRootPath(cwd), "local", "hooks.json");
}

function getPluginsPath(cwd: string): string {
  return path.join(getExtensionRootPath(cwd), "plugins");
}

function getPluginManifestPath(cwd: string, pluginId: string): string {
  return path.join(getPluginsPath(cwd), pluginId, "plugin.json");
}

function getRelativeExtensionPath(...segments: string[]): string {
  return path.posix.join(".supercode", "extensions", ...segments);
}

function ensureExtensionLayout(cwd: string): void {
  mkdirSync(getGeneratedSkillsPath(cwd), { recursive: true });
  mkdirSync(getGeneratedRulesPath(cwd), { recursive: true });
  mkdirSync(path.join(getExtensionRootPath(cwd), "local"), { recursive: true });
  mkdirSync(getPluginsPath(cwd), { recursive: true });
}

function cleanupManagedMarkdownFiles(directory: string, expectedFiles: Set<string>): void {
  if (!existsSync(directory)) {
    return;
  }

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    if (!expectedFiles.has(entry.name)) {
      unlinkSync(path.join(directory, entry.name));
    }
  }
}

function renderSkillAsset(pack: WorkflowPack, skill: SkillDefinition): string {
  return [
    `# ${skill.title}`,
    "",
    `Pack: ${pack.packId}`,
    `Skill ID: ${skill.skillId}`,
    `Summary: ${skill.summary}`,
    skill.tags.length > 0 ? `Tags: ${skill.tags.join(", ")}` : "Tags: (none)",
    skill.triggers.length > 0 ? `Triggers: ${skill.triggers.join(", ")}` : "Triggers: (none)",
    "",
    "Instructions:",
    ...skill.instructions.map(instruction => `- ${instruction}`),
    "",
    skill.provenance ? `Provenance: ${skill.provenance}` : "Provenance: supercode",
    ""
  ].join("\n");
}

function renderRuleAsset(pack: WorkflowPack, rule: RuleDefinition): string {
  return [
    `# ${rule.title}`,
    "",
    `Pack: ${pack.packId}`,
    `Rule ID: ${rule.ruleId}`,
    `Severity: ${rule.severity}`,
    `Summary: ${rule.summary}`,
    rule.appliesTo.length > 0 ? `Applies To: ${rule.appliesTo.join(", ")}` : "Applies To: (none)",
    "",
    "Guidance:",
    ...rule.guidance.map(guidance => `- ${guidance}`),
    "",
    rule.provenance ? `Provenance: ${rule.provenance}` : "Provenance: supercode",
    ""
  ].join("\n");
}

function renderExtensionsReadme(state: WorkflowExtensionState): string {
  return [
    "# Supercode Extensions",
    "",
    "This directory is the local Phase 6 extension baseline for the current project.",
    "Generated skills and rules are refreshed from installed workflow packs.",
    "",
    `Generated at: ${state.generatedAt}`,
    `Installed packs: ${state.packs.map(pack => pack.packId).join(", ") || "(none)"}`,
    `Generated skills: ${state.skills.length}`,
    `Generated rules: ${state.rules.length}`,
    "",
    "Managed paths:",
    `- ${getRelativeExtensionPath("manifest.json")}`,
    `- ${getRelativeExtensionPath("generated", "skills")}`,
    `- ${getRelativeExtensionPath("generated", "rules")}`,
    `- ${getRelativeExtensionPath("local")}`,
    "",
    "Files under generated/ are managed by Supercode and may be regenerated.",
    "Put project-specific extensions under the local/ directory.",
    ""
  ].join("\n");
}

function renderLocalExtensionsReadme(): string {
  return [
    "# Local Extensions",
    "",
    "Add project-specific skills, rules, or future extension assets here.",
    "Local runtime hooks are configured in hooks.json.",
    "This directory is reserved for user-managed files and is not rewritten during pack sync.",
    ""
  ].join("\n");
}

function renderPluginsReadme(): string {
  return [
    "# Local Plugins",
    "",
    "Add plugin folders here.",
    "Each plugin lives in its own directory and must define plugin.json.",
    ""
  ].join("\n");
}

function createDefaultHookManifest(): WorkflowHookManifest {
  return {
    version: 1,
    hooks: []
  };
}

function normalizeHookDefinition(hook: WorkflowHookDefinition): WorkflowHookDefinition {
  return {
    hookId: assertNonEmpty(hook.hookId, "hookId", "Workflow hook"),
    title: assertNonEmpty(hook.title, "title", `Workflow hook ${hook.hookId}`),
    event: hook.event,
    toolId: assertNonEmpty(hook.toolId, "toolId", `Workflow hook ${hook.hookId}`),
    enabled: hook.enabled !== false,
    onFailure: normalizeHookFailurePolicy(hook.onFailure, `Workflow hook ${hook.hookId}`),
    input: hook.input
  };
}

function normalizePluginToolDefinition(tool: WorkflowPluginToolDefinition, pluginId: string): WorkflowPluginToolDefinition {
  return {
    toolId: assertNonEmpty(tool.toolId, "toolId", `Workflow plugin ${pluginId} tool`),
    title: assertNonEmpty(tool.title, "title", `Workflow plugin ${pluginId} tool ${tool.toolId}`),
    description: assertNonEmpty(tool.description, "description", `Workflow plugin ${pluginId} tool ${tool.toolId}`),
    enabled: tool.enabled !== false,
    targetToolId: assertNonEmpty(tool.targetToolId, "targetToolId", `Workflow plugin ${pluginId} tool ${tool.toolId}`),
    input: tool.input
  };
}

function normalizePluginRunStepPlacement(
  value: WorkflowPluginRunStepDefinition["placement"],
  context: string
): "before-defaults" | "after-defaults" {
  if (value === undefined) {
    return "after-defaults";
  }
  if (value === "before-defaults" || value === "after-defaults") {
    return value;
  }
  throw new Error(`${context} defines unsupported placement "${String(value)}".`);
}

function normalizePluginRunStepDefinition(
  step: WorkflowPluginRunStepDefinition,
  pluginId: string
): WorkflowPluginRunStepDefinition {
  return {
    stepId: assertNonEmpty(step.stepId, "stepId", `Workflow plugin ${pluginId} run step`),
    title: assertNonEmpty(step.title, "title", `Workflow plugin ${pluginId} run step ${step.stepId}`),
    description: assertNonEmpty(step.description, "description", `Workflow plugin ${pluginId} run step ${step.stepId}`),
    toolId: assertNonEmpty(step.toolId, "toolId", `Workflow plugin ${pluginId} run step ${step.stepId}`),
    enabled: step.enabled !== false,
    placement: normalizePluginRunStepPlacement(step.placement, `Workflow plugin ${pluginId} run step ${step.stepId}`),
    whenTaskIncludes: Array.isArray(step.whenTaskIncludes) ? normalizeList(step.whenTaskIncludes) : [],
    input: step.input
  };
}

function normalizePluginCommandArgsMode(
  value: WorkflowPluginCommandDefinition["argsMode"],
  context: string
): "none" | "text" | "json" | "argv" {
  if (value === undefined) {
    return "argv";
  }
  if (value === "none" || value === "text" || value === "json" || value === "argv") {
    return value;
  }
  throw new Error(`${context} defines unsupported argsMode "${String(value)}".`);
}

function normalizePluginCommandDefinition(
  command: WorkflowPluginCommandDefinition,
  pluginId: string
): WorkflowPluginCommandDefinition {
  return {
    commandId: assertNonEmpty(command.commandId, "commandId", `Workflow plugin ${pluginId} command`),
    commandName: assertNonEmpty(command.commandName, "commandName", `Workflow plugin ${pluginId} command ${command.commandId}`),
    title: assertNonEmpty(command.title, "title", `Workflow plugin ${pluginId} command ${command.commandId}`),
    description: assertNonEmpty(command.description, "description", `Workflow plugin ${pluginId} command ${command.commandId}`),
    toolId: assertNonEmpty(command.toolId, "toolId", `Workflow plugin ${pluginId} command ${command.commandId}`),
    enabled: command.enabled !== false,
    argsMode: normalizePluginCommandArgsMode(command.argsMode, `Workflow plugin ${pluginId} command ${command.commandId}`),
    input: command.input
  };
}

function getPluginRuntimeToolId(pluginId: string, toolId: string): string {
  return `plugin.${pluginId}.${toolId}`;
}

function resolvePluginScopedToolId(toolId: string, pluginId: string, pluginLocalToolIds: Set<string>): string {
  return pluginLocalToolIds.has(toolId) ? getPluginRuntimeToolId(pluginId, toolId) : toolId;
}

function resolvePluginToolDefinitions(
  manifest: WorkflowPluginManifest,
  pluginPath: string
): WorkflowResolvedPluginToolDefinition[] {
  const pluginLocalToolIds = new Set(manifest.tools.filter(tool => tool.enabled).map(tool => tool.toolId));

  return manifest.tools
    .filter(tool => tool.enabled)
    .map(tool => ({
      ...tool,
      targetToolId: resolvePluginScopedToolId(tool.targetToolId, manifest.pluginId, pluginLocalToolIds),
      runtimeToolId: getPluginRuntimeToolId(manifest.pluginId, tool.toolId),
      pluginId: manifest.pluginId,
      pluginTitle: manifest.title,
      path: pluginPath
    }));
}

function resolvePluginRunStepDefinitions(
  manifest: WorkflowPluginManifest,
  pluginPath: string
): WorkflowResolvedPluginRunStepDefinition[] {
  const pluginLocalToolIds = new Set(manifest.tools.filter(tool => tool.enabled).map(tool => tool.toolId));

  return manifest.runSteps
    .filter(step => step.enabled)
    .map(step => ({
      ...step,
      toolId: resolvePluginScopedToolId(step.toolId, manifest.pluginId, pluginLocalToolIds),
      pluginId: manifest.pluginId,
      pluginTitle: manifest.title,
      path: pluginPath
    }));
}

function resolvePluginCommandDefinitions(
  manifest: WorkflowPluginManifest,
  pluginPath: string
): WorkflowResolvedPluginCommandDefinition[] {
  const pluginLocalToolIds = new Set(manifest.tools.filter(tool => tool.enabled).map(tool => tool.toolId));

  return manifest.commands
    .filter(command => command.enabled)
    .map(command => ({
      ...command,
      toolId: resolvePluginScopedToolId(command.toolId, manifest.pluginId, pluginLocalToolIds),
      pluginId: manifest.pluginId,
      pluginTitle: manifest.title,
      path: pluginPath
    }));
}

function normalizePluginManifest(manifest: WorkflowPluginManifest): WorkflowPluginManifest {
  const pluginId = assertNonEmpty(manifest.pluginId, "pluginId", "Workflow plugin");
  const skills = Array.isArray(manifest.skills) ? manifest.skills.map(skill => validateSkill(skill, pluginId)) : [];
  const rules = Array.isArray(manifest.rules) ? manifest.rules.map(rule => validateRule(rule, pluginId)) : [];
  const tools = Array.isArray(manifest.tools)
    ? manifest.tools.map(tool => normalizePluginToolDefinition(tool, pluginId))
    : [];
  const runSteps = Array.isArray(manifest.runSteps)
    ? manifest.runSteps.map(step => normalizePluginRunStepDefinition(step, pluginId))
    : [];
  const commands = Array.isArray(manifest.commands)
    ? manifest.commands.map(command => normalizePluginCommandDefinition(command, pluginId))
    : [];
  const hooks = Array.isArray(manifest.hooks) ? manifest.hooks.map(hook => normalizeHookDefinition(hook)) : [];
  assertNoDuplicates(
    skills.map(skill => skill.skillId),
    "skillId",
    `Workflow plugin ${pluginId}`
  );
  assertNoDuplicates(
    rules.map(rule => rule.ruleId),
    "ruleId",
    `Workflow plugin ${pluginId}`
  );
  assertNoDuplicates(
    tools.map(tool => tool.toolId),
    "toolId",
    `Workflow plugin ${pluginId}`
  );
  assertNoDuplicates(
    runSteps.map(step => step.stepId),
    "stepId",
    `Workflow plugin ${pluginId}`
  );
  assertNoDuplicates(
    commands.map(command => command.commandId),
    "commandId",
    `Workflow plugin ${pluginId}`
  );
  assertNoDuplicates(
    commands.map(command => command.commandName),
    "commandName",
    `Workflow plugin ${pluginId}`
  );
  assertNoDuplicates(
    hooks.map(hook => hook.hookId),
    "hookId",
    `Workflow plugin ${pluginId}`
  );

  return {
    version: 1,
    pluginId,
    title: assertNonEmpty(manifest.title, "title", `Workflow plugin ${pluginId}`),
    description: normalizeText(manifest.description),
    enabled: manifest.enabled !== false,
    skills,
    rules,
    tools,
    runSteps,
    commands,
    hooks
  };
}

function createValidationIssue(
  severity: WorkflowValidationIssue["severity"],
  pathValue: string,
  message: string,
  sourceType: WorkflowValidationIssue["sourceType"],
  sourceId?: string
): WorkflowValidationIssue {
  return {
    severity,
    sourceType,
    sourceId,
    path: pathValue,
    message
  };
}

function buildValidationReport(issues: WorkflowValidationIssue[]): WorkflowValidationReport {
  const errorCount = issues.filter(issue => issue.severity === "error").length;
  const warningCount = issues.filter(issue => issue.severity === "warning").length;
  return {
    ok: errorCount === 0,
    errorCount,
    warningCount,
    issues
  };
}

function listPluginDirectories(cwd: string): string[] {
  const pluginsDir = getPluginsPath(cwd);
  if (!existsSync(pluginsDir)) {
    return [];
  }

  return readdirSync(pluginsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function tryLoadPluginManifest(cwd: string, pluginDirName: string): { manifest?: WorkflowPluginManifest; error?: string } {
  const manifestPath = getPluginManifestPath(cwd, pluginDirName);
  if (!existsSync(manifestPath)) {
    return {
      error: "Missing plugin.json."
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as WorkflowPluginManifest;
    return {
      manifest: normalizePluginManifest(parsed)
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function tryLoadPluginManifestAtPath(pluginManifestPath: string): { manifest?: WorkflowPluginManifest; error?: string } {
  if (!existsSync(pluginManifestPath)) {
    return {
      error: "Missing plugin.json."
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(pluginManifestPath, "utf8")) as WorkflowPluginManifest;
    return {
      manifest: normalizePluginManifest(parsed)
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function tryLoadLocalHookManifest(cwd: string): { manifest?: WorkflowHookManifest; error?: string } {
  const hooksPath = getLocalHooksPath(cwd);
  if (!existsSync(hooksPath)) {
    return {
      manifest: createDefaultHookManifest()
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(hooksPath, "utf8")) as Partial<WorkflowHookManifest>;
    const hooks = Array.isArray(parsed.hooks) ? parsed.hooks.map(hook => normalizeHookDefinition(hook as WorkflowHookDefinition)) : [];
    assertNoDuplicates(
      hooks.map(hook => hook.hookId),
      "hookId",
      "Workflow hook manifest"
    );
    return {
      manifest: {
        version: 1,
        hooks
      }
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function loadWorkflowHookManifest(cwd: string): WorkflowHookManifest {
  return tryLoadLocalHookManifest(cwd).manifest ?? createDefaultHookManifest();
}

export function listWorkflowPlugins(cwd: string): WorkflowPluginSummary[] {
  const summaries: WorkflowPluginSummary[] = [];
  for (const pluginId of listPluginDirectories(cwd)) {
    const loaded = tryLoadPluginManifest(cwd, pluginId);
    if (!loaded.manifest) {
      continue;
    }

    try {
      const manifest = loaded.manifest;
      summaries.push({
        pluginId: manifest.pluginId,
        title: manifest.title,
        description: manifest.description,
        enabled: manifest.enabled,
        skillCount: manifest.skills.length,
        ruleCount: manifest.rules.length,
        toolCount: manifest.tools.length,
        runStepCount: manifest.runSteps.length,
        commandCount: manifest.commands.length,
        hookCount: manifest.hooks.length,
        path: getRelativeExtensionPath("plugins", pluginId, "plugin.json")
      });
    } catch {
      continue;
    }
  }

  return summaries;
}

export function loadResolvedWorkflowHooks(cwd: string): WorkflowResolvedHookDefinition[] {
  const resolved = new Map<string, WorkflowResolvedHookDefinition>();

  for (const plugin of listWorkflowPlugins(cwd)) {
    if (!plugin.enabled) {
      continue;
    }

    try {
      const loaded = tryLoadPluginManifestAtPath(path.join(cwd, plugin.path));
      if (!loaded.manifest) {
        continue;
      }
      const manifest = loaded.manifest;
      const pluginToolIds = new Set(manifest.tools.map(tool => tool.toolId));
      for (const hook of manifest.hooks) {
        const resolvedToolId = resolvePluginScopedToolId(hook.toolId, manifest.pluginId, pluginToolIds);
        resolved.set(hook.hookId, {
          ...hook,
          toolId: resolvedToolId,
          source: "plugin",
          pluginId: manifest.pluginId,
          path: plugin.path
        });
      }
    } catch {
      continue;
    }
  }

  const localManifest = loadWorkflowHookManifest(cwd);
  for (const hook of localManifest.hooks) {
    resolved.set(hook.hookId, {
      ...hook,
      source: "local",
      path: getRelativeExtensionPath("local", "hooks.json")
    });
  }

  return [...resolved.values()].sort((left, right) => left.hookId.localeCompare(right.hookId));
}

export function loadResolvedWorkflowPluginTools(cwd: string): WorkflowResolvedPluginToolDefinition[] {
  return listWorkflowPlugins(cwd)
    .filter(plugin => plugin.enabled)
    .flatMap(plugin => {
      try {
        const loaded = tryLoadPluginManifestAtPath(path.join(cwd, plugin.path));
        if (!loaded.manifest) {
          return [];
        }
        return resolvePluginToolDefinitions(loaded.manifest, plugin.path);
      } catch {
        return [];
      }
    });
}

function pluginRunStepMatchesTask(task: string, step: WorkflowPluginRunStepDefinition): boolean {
  if (step.whenTaskIncludes === undefined || step.whenTaskIncludes.length === 0) {
    return true;
  }

  const taskText = normalize(task);
  const taskTokens = tokenize(taskText);
  return step.whenTaskIncludes.some(trigger => {
    const normalizedTrigger = normalize(trigger);
    if (!normalizedTrigger) {
      return false;
    }
    if (taskText.includes(normalizedTrigger)) {
      return true;
    }

    const triggerTokens = tokenize(normalizedTrigger);
    return triggerTokens.length > 0 && triggerTokens.every(token => taskTokens.includes(token));
  });
}

export function loadResolvedWorkflowRunSteps(cwd: string, task: string): WorkflowResolvedPluginRunStepDefinition[] {
  return listWorkflowPlugins(cwd)
    .filter(plugin => plugin.enabled)
    .flatMap(plugin => {
      try {
        const loaded = tryLoadPluginManifestAtPath(path.join(cwd, plugin.path));
        if (!loaded.manifest) {
          return [];
        }

        return resolvePluginRunStepDefinitions(loaded.manifest, plugin.path)
          .filter(step => pluginRunStepMatchesTask(task, step));
      } catch {
        return [];
      }
    })
    .sort((left, right) => {
      if (left.placement !== right.placement) {
        return left.placement === "before-defaults" ? -1 : 1;
      }
      const pluginSort = left.pluginId.localeCompare(right.pluginId);
      if (pluginSort !== 0) {
        return pluginSort;
      }
      return left.stepId.localeCompare(right.stepId);
    });
}

export function loadResolvedWorkflowCommands(cwd: string): WorkflowResolvedPluginCommandDefinition[] {
  return listWorkflowPlugins(cwd)
    .filter(plugin => plugin.enabled)
    .flatMap(plugin => {
      try {
        const loaded = tryLoadPluginManifestAtPath(path.join(cwd, plugin.path));
        if (!loaded.manifest) {
          return [];
        }

        return resolvePluginCommandDefinitions(loaded.manifest, plugin.path);
      } catch {
        return [];
      }
    })
    .sort((left, right) => {
      const commandSort = left.commandName.localeCompare(right.commandName);
      if (commandSort !== 0) {
        return commandSort;
      }
      const pluginSort = left.pluginId.localeCompare(right.pluginId);
      if (pluginSort !== 0) {
        return pluginSort;
      }
      return left.commandId.localeCompare(right.commandId);
    });
}

function detectPluginToolCycles(
  pluginTools: WorkflowResolvedPluginToolDefinition[]
): Array<{ path: string; pluginId: string; cycle: string[] }> {
  const toolById = new Map(pluginTools.map(tool => [tool.runtimeToolId, tool]));
  const state = new Map<string, "visiting" | "visited">();
  const stack: string[] = [];
  const dedupe = new Set<string>();
  const cycles: Array<{ path: string; pluginId: string; cycle: string[] }> = [];

  function visit(runtimeToolId: string): void {
    const currentState = state.get(runtimeToolId);
    if (currentState === "visiting" || currentState === "visited") {
      return;
    }

    state.set(runtimeToolId, "visiting");
    stack.push(runtimeToolId);

    const tool = toolById.get(runtimeToolId);
    if (tool && toolById.has(tool.targetToolId)) {
      const targetState = state.get(tool.targetToolId);
      if (targetState === "visiting") {
        const cycleStartIndex = stack.indexOf(tool.targetToolId);
        const cycle = [...stack.slice(cycleStartIndex), tool.targetToolId];
        const cycleKey = [...new Set(cycle.slice(0, -1))].sort((left, right) => left.localeCompare(right)).join("|");
        if (!dedupe.has(cycleKey)) {
          dedupe.add(cycleKey);
          const cycleStartTool = toolById.get(tool.targetToolId) ?? tool;
          cycles.push({
            path: cycleStartTool.path,
            pluginId: cycleStartTool.pluginId,
            cycle
          });
        }
      } else if (targetState !== "visited") {
        visit(tool.targetToolId);
      }
    }

    stack.pop();
    state.set(runtimeToolId, "visited");
  }

  for (const tool of pluginTools) {
    visit(tool.runtimeToolId);
  }

  return cycles;
}

export function validateWorkflowExtensions(
  cwd: string,
  options: {
    knownToolIds?: string[];
    reservedCommandNames?: string[];
  } = {}
): WorkflowValidationReport {
  const issues: WorkflowValidationIssue[] = [];
  const knownToolIds = new Set(options.knownToolIds ?? []);
  const reservedCommandNames = new Set((options.reservedCommandNames ?? []).map(name => normalize(name)));
  const packSkillIds = new Set(CATALOG.packs.flatMap(pack => pack.skills.map(skill => skill.skillId)));
  const packRuleIds = new Set(CATALOG.packs.flatMap(pack => pack.rules.map(rule => rule.ruleId)));
  const pluginIdToPath = new Map<string, string>();
  const pluginSkillIds = new Map<string, string>();
  const pluginRuleIds = new Map<string, string>();
  const pluginCommandNames = new Map<string, string>();
  const pluginRuntimeToolIds = new Set<string>();
  const validPlugins: Array<{
    manifest: WorkflowPluginManifest;
    path: string;
    resolvedTools: WorkflowResolvedPluginToolDefinition[];
    resolvedRunSteps: WorkflowResolvedPluginRunStepDefinition[];
    resolvedCommands: WorkflowResolvedPluginCommandDefinition[];
  }> = [];

  const localHookLoad = tryLoadLocalHookManifest(cwd);
  if (localHookLoad.error) {
    issues.push(
      createValidationIssue("error", getRelativeExtensionPath("local", "hooks.json"), localHookLoad.error, "local")
    );
  }

  for (const pluginDir of listPluginDirectories(cwd)) {
    const pluginPath = getRelativeExtensionPath("plugins", pluginDir, "plugin.json");
    const loaded = tryLoadPluginManifest(cwd, pluginDir);
    if (!loaded.manifest) {
      issues.push(createValidationIssue("error", pluginPath, loaded.error ?? "Invalid plugin manifest.", "plugin", pluginDir));
      continue;
    }

    const manifest = loaded.manifest;
    const resolvedTools = resolvePluginToolDefinitions(manifest, pluginPath);
    const resolvedRunSteps = resolvePluginRunStepDefinitions(manifest, pluginPath);
    const resolvedCommands = resolvePluginCommandDefinitions(manifest, pluginPath);
    validPlugins.push({ manifest, path: pluginPath, resolvedTools, resolvedRunSteps, resolvedCommands });

    if (pluginIdToPath.has(manifest.pluginId)) {
      issues.push(
        createValidationIssue(
          "error",
          pluginPath,
          `Duplicate pluginId "${manifest.pluginId}" is already defined by ${pluginIdToPath.get(manifest.pluginId)}.`,
          "plugin",
          manifest.pluginId
        )
      );
    } else {
      pluginIdToPath.set(manifest.pluginId, pluginPath);
    }

    for (const skill of manifest.skills) {
      if (packSkillIds.has(skill.skillId)) {
        issues.push(
          createValidationIssue(
            "error",
            pluginPath,
            `Skill ID "${skill.skillId}" conflicts with an installed workflow-pack skill.`,
            "plugin",
            manifest.pluginId
          )
        );
      }
      if (pluginSkillIds.has(skill.skillId)) {
        issues.push(
          createValidationIssue(
            "error",
            pluginPath,
            `Skill ID "${skill.skillId}" conflicts with plugin ${pluginSkillIds.get(skill.skillId)}.`,
            "plugin",
            manifest.pluginId
          )
        );
      } else {
        pluginSkillIds.set(skill.skillId, manifest.pluginId);
      }
    }

    for (const rule of manifest.rules) {
      if (packRuleIds.has(rule.ruleId)) {
        issues.push(
          createValidationIssue(
            "error",
            pluginPath,
            `Rule ID "${rule.ruleId}" conflicts with an installed workflow-pack rule.`,
            "plugin",
            manifest.pluginId
          )
        );
      }
      if (pluginRuleIds.has(rule.ruleId)) {
        issues.push(
          createValidationIssue(
            "error",
            pluginPath,
            `Rule ID "${rule.ruleId}" conflicts with plugin ${pluginRuleIds.get(rule.ruleId)}.`,
            "plugin",
            manifest.pluginId
          )
        );
      } else {
        pluginRuleIds.set(rule.ruleId, manifest.pluginId);
      }
    }

    for (const tool of resolvedTools) {
      pluginRuntimeToolIds.add(tool.runtimeToolId);
    }

    for (const command of resolvedCommands) {
      const normalizedCommandName = normalize(command.commandName);
      if (reservedCommandNames.has(normalizedCommandName)) {
        issues.push(
          createValidationIssue(
            "error",
            pluginPath,
            `Command "${command.commandName}" conflicts with a built-in CLI command.`,
            "plugin",
            manifest.pluginId
          )
        );
      }
      if (pluginCommandNames.has(normalizedCommandName)) {
        issues.push(
          createValidationIssue(
            "error",
            pluginPath,
            `Command "${command.commandName}" conflicts with plugin ${pluginCommandNames.get(normalizedCommandName)}.`,
            "plugin",
            manifest.pluginId
          )
        );
      } else {
        pluginCommandNames.set(normalizedCommandName, manifest.pluginId);
      }
    }
  }

  const availableToolIds = new Set([...knownToolIds, ...pluginRuntimeToolIds]);

  for (const { manifest, path: pluginPath, resolvedTools, resolvedRunSteps, resolvedCommands } of validPlugins) {
    const pluginLocalToolIds = new Set(manifest.tools.filter(tool => tool.enabled).map(tool => tool.toolId));
    for (const tool of resolvedTools) {
      if (!availableToolIds.has(tool.targetToolId)) {
        issues.push(
          createValidationIssue(
            "error",
            pluginPath,
            `Plugin tool "${tool.runtimeToolId}" targets unknown runtime tool "${tool.targetToolId}".`,
            "plugin",
            manifest.pluginId
          )
        );
      }
    }

    for (const runStep of resolvedRunSteps) {
      if (!availableToolIds.has(runStep.toolId)) {
        issues.push(
          createValidationIssue(
            "error",
            pluginPath,
            `Run step "${runStep.stepId}" references unknown tool "${runStep.toolId}".`,
            "plugin",
            manifest.pluginId
          )
        );
      }
    }

    for (const command of resolvedCommands) {
      if (!availableToolIds.has(command.toolId)) {
        issues.push(
          createValidationIssue(
            "error",
            pluginPath,
            `Command "${command.commandName}" references unknown tool "${command.toolId}".`,
            "plugin",
            manifest.pluginId
          )
        );
      }
    }

    for (const hook of manifest.hooks.filter(hook => hook.enabled)) {
      const resolvedToolId = resolvePluginScopedToolId(hook.toolId, manifest.pluginId, pluginLocalToolIds);
      if (!availableToolIds.has(resolvedToolId)) {
        issues.push(
          createValidationIssue(
            "error",
            pluginPath,
            `Hook "${hook.hookId}" references unknown tool "${hook.toolId}".`,
            "plugin",
            manifest.pluginId
          )
        );
      }
    }
  }

  for (const cycle of detectPluginToolCycles(validPlugins.flatMap(plugin => plugin.resolvedTools))) {
    issues.push(
      createValidationIssue(
        "error",
        cycle.path,
        `Plugin tool cycle detected: ${cycle.cycle.join(" -> ")}.`,
        "plugin",
        cycle.pluginId
      )
    );
  }

  if (localHookLoad.manifest) {
    const localManifest = localHookLoad.manifest;
    for (const hook of localManifest.hooks.filter(hook => hook.enabled)) {
      if (!availableToolIds.has(hook.toolId)) {
        issues.push(
          createValidationIssue(
            "error",
            getRelativeExtensionPath("local", "hooks.json"),
            `Local hook "${hook.hookId}" references unknown tool "${hook.toolId}".`,
            "local"
          )
        );
      }
    }
  }

  return buildValidationReport(issues);
}

function collectPackSkillEntries(packIds: string[]): WorkflowCatalogSkillEntry[] {
  return CATALOG.packs
    .filter(pack => packIds.includes(pack.packId))
    .flatMap(pack =>
      pack.skills.map(skill => ({
        skill,
        sourceType: "pack" as const,
        sourceId: pack.packId,
        sourceTitle: pack.title
      }))
    );
}

function collectPackRuleEntries(packIds: string[]): WorkflowCatalogRuleEntry[] {
  return CATALOG.packs
    .filter(pack => packIds.includes(pack.packId))
    .flatMap(pack =>
      pack.rules.map(rule => ({
        rule,
        sourceType: "pack" as const,
        sourceId: pack.packId,
        sourceTitle: pack.title
      }))
    );
}

function collectPluginSkillEntries(cwd: string): WorkflowCatalogSkillEntry[] {
  return listWorkflowPlugins(cwd)
    .filter(plugin => plugin.enabled)
    .flatMap(plugin => {
      try {
        const parsed = JSON.parse(readFileSync(getPluginManifestPath(cwd, plugin.pluginId), "utf8")) as WorkflowPluginManifest;
        const manifest = normalizePluginManifest(parsed);
        return manifest.skills.map(skill => ({
          skill,
          sourceType: "plugin" as const,
          sourceId: manifest.pluginId,
          sourceTitle: manifest.title,
          path: plugin.path
        }));
      } catch {
        return [];
      }
    });
}

function collectPluginRuleEntries(cwd: string): WorkflowCatalogRuleEntry[] {
  return listWorkflowPlugins(cwd)
    .filter(plugin => plugin.enabled)
    .flatMap(plugin => {
      try {
        const parsed = JSON.parse(readFileSync(getPluginManifestPath(cwd, plugin.pluginId), "utf8")) as WorkflowPluginManifest;
        const manifest = normalizePluginManifest(parsed);
        return manifest.rules.map(rule => ({
          rule,
          sourceType: "plugin" as const,
          sourceId: manifest.pluginId,
          sourceTitle: manifest.title,
          path: plugin.path
        }));
      } catch {
        return [];
      }
    });
}

export function syncInstalledWorkflowExtensions(cwd: string, packIds: string[]): WorkflowExtensionState {
  ensureProjectStateDir(cwd);
  ensureExtensionLayout(cwd);

  const generatedSkillFiles = new Set<string>();
  const generatedRuleFiles = new Set<string>();
  const packs = normalizeInstalledPackIds(packIds)
    .map(packId => CATALOG.packById.get(packId))
    .filter((pack): pack is WorkflowPack => Boolean(pack));

  const state: WorkflowExtensionState = {
    version: 1,
    generatedAt: new Date().toISOString(),
    packs: packs.map(pack => ({
      packId: pack.packId,
      title: pack.title,
      installMode: pack.installMode,
      skillCount: pack.skills.length,
      ruleCount: pack.rules.length
    })),
    skills: [],
    rules: []
  };

  for (const pack of packs) {
    for (const skill of pack.skills) {
      const fileName = `${pack.packId}--${skill.skillId}.md`;
      const relativePath = getRelativeExtensionPath("generated", "skills", fileName);
      writeFileSync(path.join(getGeneratedSkillsPath(cwd), fileName), renderSkillAsset(pack, skill), "utf8");
      generatedSkillFiles.add(fileName);
      state.skills.push({
        packId: pack.packId,
        skillId: skill.skillId,
        title: skill.title,
        path: relativePath
      });
    }

    for (const rule of pack.rules) {
      const fileName = `${pack.packId}--${rule.ruleId}.md`;
      const relativePath = getRelativeExtensionPath("generated", "rules", fileName);
      writeFileSync(path.join(getGeneratedRulesPath(cwd), fileName), renderRuleAsset(pack, rule), "utf8");
      generatedRuleFiles.add(fileName);
      state.rules.push({
        packId: pack.packId,
        ruleId: rule.ruleId,
        title: rule.title,
        severity: rule.severity,
        path: relativePath
      });
    }
  }

  cleanupManagedMarkdownFiles(getGeneratedSkillsPath(cwd), generatedSkillFiles);
  cleanupManagedMarkdownFiles(getGeneratedRulesPath(cwd), generatedRuleFiles);
  writeFileSync(path.join(getExtensionRootPath(cwd), "README.md"), renderExtensionsReadme(state), "utf8");
  writeFileSync(path.join(getExtensionRootPath(cwd), "local", "README.md"), renderLocalExtensionsReadme(), "utf8");
  writeFileSync(path.join(getPluginsPath(cwd), "README.md"), renderPluginsReadme(), "utf8");
  if (!existsSync(getLocalHooksPath(cwd))) {
    writeFileSync(getLocalHooksPath(cwd), `${JSON.stringify(createDefaultHookManifest(), null, 2)}\n`, "utf8");
  }
  writeFileSync(getExtensionManifestPath(cwd), `${JSON.stringify(state, null, 2)}\n`, "utf8");

  return state;
}

export function loadWorkflowExtensionState(cwd: string): WorkflowExtensionState | undefined {
  const manifestPath = getExtensionManifestPath(cwd);
  if (!existsSync(manifestPath)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as WorkflowExtensionState;
    if (parsed.version !== 1) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

export function listWorkflowPacks(): WorkflowPack[] {
  return CATALOG.packs;
}

export function listWorkflowPackSummaries(): WorkflowPackSummary[] {
  return CATALOG.packs.map(pack => ({
    packId: pack.packId,
    title: pack.title,
    description: pack.description,
    source: pack.source,
    installMode: pack.installMode,
    skillCount: pack.skills.length,
    ruleCount: pack.rules.length,
    references: [...pack.references]
  }));
}

export function getWorkflowPack(packId: string): WorkflowPack | undefined {
  return CATALOG.packById.get(packId);
}

export function searchSkills(query: string, cwd?: string): SkillDefinition[] {
  const needle = normalize(query);
  const skills = [
    ...CATALOG.packs.flatMap(pack => pack.skills),
    ...(cwd ? collectPluginSkillEntries(cwd).map(entry => entry.skill) : [])
  ];
  return skills.filter(skill => {
    const haystack = [skill.title, skill.summary, ...skill.tags, ...skill.triggers].join(" ").toLowerCase();
    return haystack.includes(needle);
  });
}

export function searchRules(query: string, cwd?: string): RuleDefinition[] {
  const needle = normalize(query);
  const rules = [
    ...CATALOG.packs.flatMap(pack => pack.rules),
    ...(cwd ? collectPluginRuleEntries(cwd).map(entry => entry.rule) : [])
  ];
  return rules.filter(rule => {
    const haystack = [rule.title, rule.summary, ...rule.appliesTo, ...rule.guidance].join(" ").toLowerCase();
    return haystack.includes(needle);
  });
}

export function recommendWorkflowPacks(
  project: ProjectProfile,
  _host: HostCapabilities,
  _model: ModelCapabilities
): WorkflowRecommendation {
  const recommendedPackIds = ["core"];
  const reasons: Record<string, string[]> = {
    core: ["Always load the core pack for planning, verification, and security."]
  };

  if (project.primaryLanguage === "typescript" || project.hasTsconfig) {
    recommendedPackIds.push("typescript");
    reasons.typescript = ["TypeScript signals were detected in the project configuration."];
  }

  return {
    recommendedPackIds,
    reasons
  };
}

export function loadInstalledPackState(cwd: string): PackInstallState {
  const statePath = getPackStatePath(cwd);
  if (!existsSync(statePath)) {
    return createEmptyPackState();
  }

  try {
    const parsed = JSON.parse(readFileSync(statePath, "utf8")) as Partial<PackInstallState>;
    return {
      version: 1,
      installedPackIds: normalizeInstalledPackIds(Array.isArray(parsed.installedPackIds) ? parsed.installedPackIds : []),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString()
    };
  } catch {
    return createEmptyPackState();
  }
}

export function saveInstalledPackState(cwd: string, state: PackInstallState): PackInstallState {
  ensureProjectStateDir(cwd);
  const normalizedState: PackInstallState = {
    version: 1,
    installedPackIds: normalizeInstalledPackIds(state.installedPackIds),
    updatedAt: state.updatedAt
  };
  writeFileSync(getPackStatePath(cwd), `${JSON.stringify(normalizedState, null, 2)}\n`, "utf8");
  return normalizedState;
}

export function installWorkflowPack(cwd: string, packId: string): PackInstallState {
  const pack = getWorkflowPack(packId);
  if (!pack) {
    throw new Error(`Unknown workflow pack: ${packId}`);
  }

  const current = loadInstalledPackState(cwd);
  const nextState = saveInstalledPackState(cwd, createPackState([...current.installedPackIds, pack.packId]));
  syncInstalledWorkflowExtensions(cwd, nextState.installedPackIds);
  return nextState;
}

export function uninstallWorkflowPack(cwd: string, packId: string): PackInstallState {
  const pack = getWorkflowPack(packId);
  if (!pack) {
    throw new Error(`Unknown workflow pack: ${packId}`);
  }

  if (pack.installMode === "core") {
    throw new Error(`Workflow pack ${packId} is required and cannot be uninstalled.`);
  }

  const current = loadInstalledPackState(cwd);
  const nextState = saveInstalledPackState(
    cwd,
    createPackState(current.installedPackIds.filter(installedPackId => installedPackId !== pack.packId))
  );
  syncInstalledWorkflowExtensions(cwd, nextState.installedPackIds);
  return nextState;
}

export function installRecommendedWorkflowPacks(cwd: string, recommendation: WorkflowRecommendation): PackInstallState {
  const current = loadInstalledPackState(cwd);
  const nextState = saveInstalledPackState(
    cwd,
    createPackState([...current.installedPackIds, ...recommendation.recommendedPackIds])
  );
  syncInstalledWorkflowExtensions(cwd, nextState.installedPackIds);
  return nextState;
}

export function syncWorkflowPackState(cwd: string): PackInstallState {
  const current = loadInstalledPackState(cwd);
  const nextState = saveInstalledPackState(cwd, createPackState(current.installedPackIds));
  syncInstalledWorkflowExtensions(cwd, nextState.installedPackIds);
  return nextState;
}

export function matchSkillsForTask(task: string, packIds: string[], cwd?: string): SkillDefinition[] {
  return rankSkillsForTask(task, packIds, cwd).map(match => match.item);
}

export function matchRulesForTask(task: string, packIds: string[], cwd?: string): RuleDefinition[] {
  return rankRulesForTask(task, packIds, cwd).map(match => match.item);
}

export function rankSkillsForTask(task: string, packIds: string[], cwd?: string): WorkflowMatch<SkillDefinition>[] {
  return sortMatches(
    [...collectPackSkillEntries(packIds), ...(cwd ? collectPluginSkillEntries(cwd) : [])]
      .map(entry => ({
        ...scoreSkill(task, entry.skill),
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        sourceTitle: entry.sourceTitle,
        path: entry.path
      }))
      .filter(match => match.score >= 2)
  );
}

export function rankRulesForTask(task: string, packIds: string[], cwd?: string): WorkflowMatch<RuleDefinition>[] {
  return sortMatches(
    [...collectPackRuleEntries(packIds), ...(cwd ? collectPluginRuleEntries(cwd) : [])]
      .map(entry => ({
        ...scoreRule(task, entry.rule),
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        sourceTitle: entry.sourceTitle,
        path: entry.path
      }))
      .filter(match => match.score >= 2)
  );
}
