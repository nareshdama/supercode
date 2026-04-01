import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  installWorkflowPack,
  listWorkflowPackSummaries,
  rankRulesForTask,
  rankSkillsForTask,
  recommendWorkflowPacks,
  searchSkills,
  uninstallWorkflowPack
} from "../dist/index.js";

test("recommendWorkflowPacks includes core and TypeScript for TypeScript projects", () => {
  const recommendation = recommendWorkflowPacks(
    {
      cwd: "/tmp/project",
      projectRoot: "/tmp/project",
      packageManager: "npm",
      primaryLanguage: "typescript",
      frameworks: [],
      scripts: {
        build: "tsc -b",
        test: "node --test"
      },
      isGitRepo: false,
      gitDirty: false,
      nodeProject: true,
      hasTsconfig: true,
      fileSignals: ["package.json", "tsconfig.json"]
    },
    {
      hostId: "generic-cli",
      displayName: "Generic CLI",
      supportsTools: true,
      supportsMcp: true,
      supportsStreaming: true,
      supportsMultiAgent: false,
      source: "default",
      confidence: "medium"
    },
    {
      provider: "openai",
      modelId: "gpt-5",
      supportsTools: true,
      supportsStreaming: true,
      contextWindow: "large",
      reasoning: "deep",
      source: "inferred",
      confidence: "medium"
    }
  );

  assert.deepEqual(recommendation.recommendedPackIds, ["core", "typescript"]);
});

test("searchSkills finds verification guidance", () => {
  const results = searchSkills("verification");
  assert.ok(results.some(skill => skill.skillId === "verification-loop"));
});

test("listWorkflowPackSummaries exposes manifest metadata", () => {
  const packs = listWorkflowPackSummaries();
  const corePack = packs.find(pack => pack.packId === "core");
  const typescriptPack = packs.find(pack => pack.packId === "typescript");

  assert.equal(corePack?.installMode, "core");
  assert.equal(corePack?.skillCount, 3);
  assert.equal(typescriptPack?.installMode, "optional");
});

test("optional workflow packs can be uninstalled while core packs remain protected", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-workflows-"));
  installWorkflowPack(cwd, "core");
  installWorkflowPack(cwd, "typescript");

  const nextState = uninstallWorkflowPack(cwd, "typescript");
  assert.deepEqual(nextState.installedPackIds, ["core"]);

  assert.throws(() => uninstallWorkflowPack(cwd, "core"), /cannot be uninstalled/i);
});

test("rankSkillsForTask prioritizes the most relevant workflow", () => {
  const matches = rankSkillsForTask("fix TypeScript build errors and package exports", ["core", "typescript"]);

  assert.equal(matches[0]?.item.skillId, "ts-build-fix");
  assert.ok(matches.some(match => match.item.skillId === "package-publish-hygiene"));
  assert.ok(matches[0].score >= matches[1].score);
});

test("rankRulesForTask prioritizes export and typing guidance for TypeScript tasks", () => {
  const matches = rankRulesForTask("verify TypeScript package exports and public entrypoints", ["core", "typescript"]);

  assert.equal(matches[0]?.item.ruleId, "ship-types-and-exports");
  assert.ok(matches.some(match => match.item.ruleId === "prefer-strict-ts") || matches.some(match => match.item.ruleId === "verify-before-close"));
});
