import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  installWorkflowPack,
  listWorkflowPackSummaries,
  rankRulesForTask,
  rankSkillsForTask,
  recommendWorkflowPacks,
  searchRules,
  searchSkills,
  validateWorkflowExtensions,
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

test("enabled plugins contribute skills and rules to search and ranking", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-workflows-plugin-"));
  mkdirSync(path.join(cwd, ".supercode", "extensions", "plugins", "release"), { recursive: true });
  writeFileSync(
    path.join(cwd, ".supercode", "extensions", "plugins", "release", "plugin.json"),
    `${JSON.stringify(
      {
        version: 1,
        pluginId: "release",
        title: "Release Plugin",
        description: "Release workflows.",
        enabled: true,
        skills: [
          {
            skillId: "release-checklist",
            title: "Release Checklist",
            summary: "Prepare a release checklist for package publishing.",
            tags: ["release", "publishing"],
            triggers: ["release prep"],
            instructions: ["Verify package metadata before release."],
            provenance: "plugin:release"
          }
        ],
        rules: [
          {
            ruleId: "require-release-notes",
            title: "Require Release Notes",
            summary: "Document release notes for package changes.",
            severity: "warning",
            appliesTo: ["release"],
            guidance: ["Write concise release notes before publish."],
            provenance: "plugin:release"
          }
        ],
        tools: [],
        hooks: []
      },
      null,
      2
    )}\n`
  );

  const foundSkills = searchSkills("release checklist", cwd);
  const foundRules = searchRules("release notes", cwd);
  const rankedSkills = rankSkillsForTask("prepare release checklist for package publishing", ["core", "typescript"], cwd);
  const rankedRules = rankRulesForTask("write release notes before package publish", ["core", "typescript"], cwd);

  assert.ok(foundSkills.some(skill => skill.skillId === "release-checklist"));
  assert.ok(foundRules.some(rule => rule.ruleId === "require-release-notes"));
  assert.equal(rankedSkills[0]?.item.skillId, "release-checklist");
  assert.equal(rankedSkills[0]?.sourceType, "plugin");
  assert.equal(rankedSkills[0]?.sourceId, "release");
  assert.equal(rankedRules[0]?.item.ruleId, "require-release-notes");
  assert.equal(rankedRules[0]?.sourceType, "plugin");
  assert.equal(rankedRules[0]?.sourceId, "release");
});

test("validateWorkflowExtensions reports invalid tool references", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-workflows-validate-"));
  mkdirSync(path.join(cwd, ".supercode", "extensions", "plugins", "bad-plugin"), { recursive: true });
  writeFileSync(
    path.join(cwd, ".supercode", "extensions", "plugins", "bad-plugin", "plugin.json"),
    `${JSON.stringify(
      {
        version: 1,
        pluginId: "bad-plugin",
        title: "Bad Plugin",
        description: "Invalid tool references.",
        enabled: true,
        skills: [],
        rules: [],
        tools: [
          {
            toolId: "bad-tool",
            title: "Bad Tool",
            description: "Targets an unknown runtime tool.",
            enabled: true,
            targetToolId: "unknown.runtime.tool"
          }
        ],
        runSteps: [
          {
            stepId: "bad-run-step",
            title: "Bad Run Step",
            description: "Targets an unknown runtime tool.",
            enabled: true,
            toolId: "unknown.run.step.tool",
            whenTaskIncludes: ["release"]
          }
        ],
        commands: [
          {
            commandId: "bad-command",
            commandName: "bad-command",
            title: "Bad Command",
            description: "Targets an unknown runtime tool.",
            enabled: true,
            toolId: "unknown.command.tool"
          }
        ],
        hooks: [
          {
            hookId: "bad-hook",
            title: "Bad Hook",
            event: "run.before",
            toolId: "missing-hook-tool",
            enabled: true
          }
        ]
      },
      null,
      2
    )}\n`
  );

  const report = validateWorkflowExtensions(cwd, {
    knownToolIds: ["workflow.match", "mcp.inspect", "mcp.invoke", "fs.read", "fs.write", "shell.exec", "git.status", "project.build", "project.test"]
  });

  assert.equal(report.ok, false);
  assert.equal(report.errorCount, 4);
  assert.ok(report.issues.some(issue => issue.message.includes("unknown runtime tool")));
  assert.ok(report.issues.some(issue => issue.message.includes('Run step "bad-run-step" references unknown tool')));
  assert.ok(report.issues.some(issue => issue.message.includes('Command "bad-command" references unknown tool')));
  assert.ok(report.issues.some(issue => issue.message.includes("references unknown tool")));
});

test("validateWorkflowExtensions resolves local plugin targets and reports cycles", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-workflows-cycle-"));
  mkdirSync(path.join(cwd, ".supercode", "extensions", "plugins", "cycle"), { recursive: true });
  writeFileSync(
    path.join(cwd, ".supercode", "extensions", "plugins", "cycle", "plugin.json"),
    `${JSON.stringify(
      {
        version: 1,
        pluginId: "cycle",
        title: "Cycle Plugin",
        description: "Composed plugin tools with a cycle.",
        enabled: true,
        skills: [],
        rules: [],
        tools: [
          {
            toolId: "first",
            title: "First Tool",
            description: "Targets a local plugin tool.",
            enabled: true,
            targetToolId: "second"
          },
          {
            toolId: "second",
            title: "Second Tool",
            description: "Targets a local plugin tool.",
            enabled: true,
            targetToolId: "first"
          }
        ],
        hooks: [
          {
            hookId: "cycle-hook",
            title: "Cycle Hook",
            event: "run.before",
            toolId: "first",
            enabled: true
          }
        ]
      },
      null,
      2
    )}\n`
  );

  const report = validateWorkflowExtensions(cwd, {
    knownToolIds: ["workflow.match", "mcp.inspect", "mcp.invoke", "fs.read", "fs.write", "shell.exec", "git.status", "project.build", "project.test"]
  });

  assert.equal(report.ok, false);
  assert.equal(report.errorCount, 1);
  assert.ok(report.issues.some(issue => issue.message.includes("Plugin tool cycle detected")));
  assert.equal(report.issues.some(issue => issue.message.includes("unknown runtime tool")), false);
  assert.equal(report.issues.some(issue => issue.message.includes("references unknown tool")), false);
});

test("validateWorkflowExtensions reports unsupported hook failure policies", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-workflows-hook-policy-"));
  mkdirSync(path.join(cwd, ".supercode", "extensions", "plugins", "bad-policy"), { recursive: true });
  writeFileSync(
    path.join(cwd, ".supercode", "extensions", "plugins", "bad-policy", "plugin.json"),
    `${JSON.stringify(
      {
        version: 1,
        pluginId: "bad-policy",
        title: "Bad Policy Plugin",
        description: "Contains an unsupported hook policy.",
        enabled: true,
        skills: [],
        rules: [],
        tools: [],
        hooks: [
          {
            hookId: "bad-hook-policy",
            title: "Bad Hook Policy",
            event: "run.before",
            toolId: "fs.write",
            enabled: true,
            onFailure: "explode"
          }
        ]
      },
      null,
      2
    )}\n`
  );

  const report = validateWorkflowExtensions(cwd, {
    knownToolIds: ["workflow.match", "mcp.inspect", "mcp.invoke", "fs.read", "fs.write", "shell.exec", "git.status", "project.build", "project.test"]
  });

  assert.equal(report.ok, false);
  assert.equal(report.errorCount, 1);
  assert.ok(report.issues.some(issue => issue.message.includes('unsupported onFailure policy "explode"')));
});

test("validateWorkflowExtensions reports plugin command name conflicts with built-ins", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-workflows-command-policy-"));
  mkdirSync(path.join(cwd, ".supercode", "extensions", "plugins", "bad-command"), { recursive: true });
  writeFileSync(
    path.join(cwd, ".supercode", "extensions", "plugins", "bad-command", "plugin.json"),
    `${JSON.stringify(
      {
        version: 1,
        pluginId: "bad-command",
        title: "Bad Command Plugin",
        description: "Contains a conflicting command name.",
        enabled: true,
        skills: [],
        rules: [],
        tools: [],
        runSteps: [],
        commands: [
          {
            commandId: "doctor-shadow",
            commandName: "doctor",
            title: "Doctor Shadow",
            description: "Conflicts with a built-in command.",
            enabled: true,
            toolId: "fs.write"
          }
        ],
        hooks: []
      },
      null,
      2
    )}\n`
  );

  const report = validateWorkflowExtensions(cwd, {
    knownToolIds: ["workflow.match", "mcp.inspect", "mcp.invoke", "fs.read", "fs.write", "shell.exec", "git.status", "project.build", "project.test"],
    reservedCommandNames: ["doctor", "run", "task"]
  });

  assert.equal(report.ok, false);
  assert.equal(report.errorCount, 1);
  assert.ok(report.issues.some(issue => issue.message.includes('Command "doctor" conflicts with a built-in CLI command.')));
});
