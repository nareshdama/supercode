import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  HostCapabilities,
  ModelCapabilities,
  PackInstallState,
  ProjectProfile,
  RuleDefinition,
  SkillDefinition,
  WorkflowPack,
  WorkflowPackManifest,
  WorkflowPackSummary,
  WorkflowRecommendation
} from "@supercode/core";
import { PACK_MANIFESTS } from "./manifests.js";

type WorkflowCatalog = {
  packs: WorkflowPack[];
  packById: Map<string, WorkflowPack>;
};

export interface WorkflowMatch<T> {
  item: T;
  score: number;
  reasons: string[];
}

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
    reasons: dedupeReasons(reasons)
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
    reasons: dedupeReasons(reasons)
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

export function searchSkills(query: string): SkillDefinition[] {
  const needle = normalize(query);
  return CATALOG.packs.flatMap(pack => pack.skills).filter(skill => {
    const haystack = [skill.title, skill.summary, ...skill.tags, ...skill.triggers].join(" ").toLowerCase();
    return haystack.includes(needle);
  });
}

export function searchRules(query: string): RuleDefinition[] {
  const needle = normalize(query);
  return CATALOG.packs.flatMap(pack => pack.rules).filter(rule => {
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
  return saveInstalledPackState(cwd, createPackState([...current.installedPackIds, pack.packId]));
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
  return saveInstalledPackState(
    cwd,
    createPackState(current.installedPackIds.filter(installedPackId => installedPackId !== pack.packId))
  );
}

export function installRecommendedWorkflowPacks(cwd: string, recommendation: WorkflowRecommendation): PackInstallState {
  const current = loadInstalledPackState(cwd);
  return saveInstalledPackState(cwd, createPackState([...current.installedPackIds, ...recommendation.recommendedPackIds]));
}

export function matchSkillsForTask(task: string, packIds: string[]): SkillDefinition[] {
  return rankSkillsForTask(task, packIds).map(match => match.item);
}

export function matchRulesForTask(task: string, packIds: string[]): RuleDefinition[] {
  return rankRulesForTask(task, packIds).map(match => match.item);
}

export function rankSkillsForTask(task: string, packIds: string[]): WorkflowMatch<SkillDefinition>[] {
  return sortMatches(
    CATALOG.packs
      .filter(pack => packIds.includes(pack.packId))
      .flatMap(pack => pack.skills)
      .map(skill => scoreSkill(task, skill))
      .filter(match => match.score >= 2)
  );
}

export function rankRulesForTask(task: string, packIds: string[]): WorkflowMatch<RuleDefinition>[] {
  return sortMatches(
    CATALOG.packs
      .filter(pack => packIds.includes(pack.packId))
      .flatMap(pack => pack.rules)
      .map(rule => scoreRule(task, rule))
      .filter(match => match.score >= 2)
  );
}
