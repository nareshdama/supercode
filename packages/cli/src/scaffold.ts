import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DetectionSnapshot, ExecutionProfile, SupercodeConfig } from "@nareshdama/core";
import { FileRuntimeStateStore } from "@nareshdama/state";
import { installRecommendedWorkflowPacks } from "@nareshdama/workflows";

export interface InitProjectOptions {
  executionProfile: ExecutionProfile;
  force?: boolean;
  resolveExecutionProfile?: (cwd: string) => ExecutionProfile;
}

export interface InitProjectResult {
  createdFiles: string[];
  skippedFiles: string[];
  installedPackIds: string[];
  executionProfile: ExecutionProfile;
}

function writeJsonFile(filePath: string, data: unknown, force: boolean, createdFiles: string[], skippedFiles: string[]): void {
  if (existsSync(filePath) && !force) {
    skippedFiles.push(filePath);
    return;
  }

  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  createdFiles.push(filePath);
}

function writeTextFile(filePath: string, contents: string, force: boolean, createdFiles: string[], skippedFiles: string[]): void {
  if (existsSync(filePath) && !force) {
    skippedFiles.push(filePath);
    return;
  }

  writeFileSync(filePath, contents, "utf8");
  createdFiles.push(filePath);
}

function sanitizeName(rawName: string): string {
  return rawName.toLowerCase().replace(/[^a-z0-9-_]+/g, "-");
}

function createStateReadme(profile: ExecutionProfile): string {
  const frameworks = profile.project.frameworks.length > 0 ? profile.project.frameworks.join(", ") : "(none)";
  const notes = profile.notes.length > 0 ? profile.notes.map(note => `- ${note}`).join("\n") : "- (none)";
  const selectedPacks = profile.recommendedPackIds.length > 0 ? profile.recommendedPackIds.map(packId => `- ${packId}`).join("\n") : "- (none)";

  return [
    "# Supercode Project State",
    "",
    "This directory stores Supercode's local configuration, pack installation state, generated extension assets, and detection snapshots.",
    "",
    "Detected environment:",
    `- Working directory: ${profile.project.cwd}`,
    `- Project root: ${profile.project.projectRoot}`,
    `- Primary language: ${profile.project.primaryLanguage}`,
    `- Package manager: ${profile.project.packageManager}`,
    `- Frameworks: ${frameworks}`,
    `- Host: ${profile.host.displayName}`,
    `- Model: ${profile.model.modelId ?? "unknown"} (${profile.model.provider})`,
    `- Verification level: ${profile.verificationLevel}`,
    `- Prompt budget: ${profile.promptBudgetProfile}`,
    "",
    "Selected packs:",
    selectedPacks,
    "",
    "Generated extension baseline:",
    "- .supercode/extensions/manifest.json",
    "- .supercode/extensions/generated/skills/",
    "- .supercode/extensions/generated/rules/",
    "- .supercode/extensions/local/",
    "- .supercode/extensions/local/hooks.json",
    "- .supercode/extensions/local/hooks.example.json",
    "- .supercode/extensions/plugins/",
    "- .supercode/extensions/plugins/plugin.example.json",
    "- .supercode/WORKFLOW.md",
    "",
    "Notes:",
    notes,
    ""
  ].join("\n");
}

function createProjectReadme(profile: ExecutionProfile): string {
  const frameworks = profile.project.frameworks.length > 0 ? profile.project.frameworks.join(", ") : "none detected";

  return [
    `# ${path.basename(profile.project.projectRoot)}`,
    "",
    "This project was initialized with the Supercode editor-neutral starter template.",
    "",
    "Quick start:",
    "- Install dependencies: `npm install`",
    "- Inspect the environment: `npx supercode doctor`",
    "- Run a task: `npx supercode run \"describe the next implementation step\"`",
    "- Reapply recommended packs: `npx supercode pack recommend --apply`",
    "- Reconcile generated workflow assets: `npx supercode pack sync`",
    "",
    "Detected profile:",
    `- Primary language: ${profile.project.primaryLanguage}`,
    `- Package manager: ${profile.project.packageManager}`,
    `- Frameworks: ${frameworks}`,
    "",
    "Local workflow files live under `.supercode/`.",
    "See `.supercode/WORKFLOW.md` for hook, plugin, and pack customization paths.",
    ""
  ].join("\n");
}

function createWorkflowGuide(profile: ExecutionProfile): string {
  const selectedPacks = profile.recommendedPackIds.length > 0 ? profile.recommendedPackIds.join(", ") : "(none)";

  return [
    "# Local Workflow Guide",
    "",
    "This file documents the editor-neutral workflow entrypoints for the current project.",
    "",
    "Core commands:",
    "- `npx supercode doctor`",
    "- `npx supercode run \"<task>\"`",
    "- `npx supercode extension validate`",
    "- `npx supercode plugin list`",
    "- `npx supercode pack recommend --apply`",
    "- `npx supercode pack sync`",
    "",
    "Current recommended packs:",
    `- ${selectedPacks}`,
    "",
    "Local customization paths:",
    "- `.supercode/config.json` for runtime defaults such as memory and artifact retention settings",
    "- `.supercode/extensions/local/hooks.json` for active local lifecycle hooks",
    "- `.supercode/extensions/local/hooks.example.json` for a copy-safe hook template",
    "- `.supercode/extensions/plugins/plugin.example.json` for a copy-safe plugin manifest template",
    "",
    "Operational notes:",
    "- `pack recommend --apply` reapplies the currently detected recommendation set.",
    "- `pack sync` rewrites `.supercode/packs.json` into normalized state and regenerates managed extension assets.",
    "- Files under `.supercode/extensions/generated/` are managed by Supercode.",
    "- Files under `.supercode/extensions/local/` are user-managed and preserved during pack sync.",
    ""
  ].join("\n");
}

function createHookTemplate(): string {
  return `${JSON.stringify(
    {
      version: 1,
      hooks: [
        {
          hookId: "write-run-summary",
          title: "Write a run summary marker",
          event: "run.after",
          toolId: "fs.write",
          enabled: false,
          onFailure: "continue",
          input: {
            path: ".supercode/last-run.txt",
            content: "task={{event.task}} result={{event.resultRef}} success={{event.success}}"
          }
        }
      ]
    },
    null,
    2
  )}\n`;
}

function createPluginTemplate(): string {
  return `${JSON.stringify(
    {
      version: 1,
      pluginId: "example-plugin",
      title: "Example Plugin",
      description: "Copy this file to plugin.json inside a plugin directory and customize the fields below.",
      enabled: true,
      skills: [],
      rules: [],
      tools: [
        {
          toolId: "write-example-file",
          title: "Write Example File",
          description: "Wrap the built-in fs.write tool.",
          enabled: true,
          targetToolId: "fs.write",
          input: {
            path: ".supercode/example-plugin.txt"
          }
        }
      ],
      runSteps: [
        {
          stepId: "example-run-step",
          title: "Example Run Step",
          description: "Run before default plan steps when the task mentions release.",
          toolId: "write-example-file",
          enabled: false,
          placement: "before-defaults",
          whenTaskIncludes: ["release"],
          input: {
            content: "plugin run step executed"
          }
        }
      ],
      commands: [
        {
          commandId: "example-command",
          commandName: "example-command",
          title: "Example Command",
          description: "Expose a plugin-owned CLI command.",
          toolId: "write-example-file",
          enabled: false,
          argsMode: "text"
        }
      ],
      hooks: [
        {
          hookId: "example-after-run",
          title: "Example After-Run Hook",
          event: "run.after",
          toolId: "write-example-file",
          enabled: false,
          onFailure: "continue",
          input: {
            content: "hook result={{event.resultRef}}"
          }
        }
      ]
    },
    null,
    2
  )}\n`;
}

function writeStarterTemplate(cwd: string, createdFiles: string[], skippedFiles: string[]): void {
  if (existsSync(path.join(cwd, "package.json"))) {
    return;
  }

  mkdirSync(path.join(cwd, "src"), { recursive: true });
  writeJsonFile(
    path.join(cwd, "package.json"),
    {
      name: sanitizeName(path.basename(cwd)),
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: {
        build: "tsc -p tsconfig.json",
        start: "node dist/index.js"
      },
      devDependencies: {
        typescript: "^5.8.3"
      }
    },
    false,
    createdFiles,
    skippedFiles
  );
  writeJsonFile(
    path.join(cwd, "tsconfig.json"),
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        outDir: "dist",
        rootDir: "src",
        strict: true
      },
      include: ["src/**/*.ts"]
    },
    false,
    createdFiles,
    skippedFiles
  );
  writeTextFile(
    path.join(cwd, "src", "index.ts"),
    'export function main(): void {\n  console.log("Supercode basic template is ready.");\n}\n\nmain();\n',
    false,
    createdFiles,
    skippedFiles
  );
}

export function initializeProject(cwd: string, options: InitProjectOptions): InitProjectResult {
  const createdFiles: string[] = [];
  const skippedFiles: string[] = [];
  const force = options.force ?? false;

  mkdirSync(cwd, { recursive: true });
  mkdirSync(path.join(cwd, ".supercode"), { recursive: true });
  const runtimeStore = new FileRuntimeStateStore(cwd);
  runtimeStore.ensureLayout();
  runtimeStore.loadOrCreateSession();

  writeStarterTemplate(cwd, createdFiles, skippedFiles);

  const executionProfile = options.resolveExecutionProfile ? options.resolveExecutionProfile(cwd) : options.executionProfile;
  const timestamp = new Date().toISOString();
  const configPath = path.join(cwd, ".supercode", "config.json");
  const snapshotPath = path.join(cwd, ".supercode", "profile.snapshot.json");
  const readmePath = path.join(cwd, ".supercode", "README.md");

  const config: SupercodeConfig = {
    version: 1,
    selectedPackIds: executionProfile.recommendedPackIds,
    verificationLevel: executionProfile.verificationLevel,
    promptBudgetProfile: executionProfile.promptBudgetProfile,
    memory: {
      enabled: false,
      provider: "local",
      attachLimit: 5,
      defaultTags: ["supercode"],
      defaultImportance: 0.6,
      retention: {
        strategy: "count-bound",
        maxEntries: 200
      }
    },
    artifacts: {
      maxEntries: 50,
      maxTotalBytes: 5_000_000,
      maxArtifactBytes: 1_000_000
    },
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const snapshot: DetectionSnapshot = {
    version: 1,
    capturedAt: timestamp,
    executionProfile
  };

  writeJsonFile(configPath, config, force, createdFiles, skippedFiles);
  writeJsonFile(snapshotPath, snapshot, force, createdFiles, skippedFiles);
  writeTextFile(readmePath, createStateReadme(executionProfile), force, createdFiles, skippedFiles);
  writeTextFile(path.join(cwd, ".supercode", "WORKFLOW.md"), createWorkflowGuide(executionProfile), force, createdFiles, skippedFiles);

  const installed = installRecommendedWorkflowPacks(cwd, {
    recommendedPackIds: executionProfile.recommendedPackIds,
    reasons: executionProfile.recommendationReasons
  });
  writeTextFile(
    path.join(cwd, ".supercode", "extensions", "local", "hooks.example.json"),
    createHookTemplate(),
    force,
    createdFiles,
    skippedFiles
  );
  writeTextFile(
    path.join(cwd, ".supercode", "extensions", "plugins", "plugin.example.json"),
    createPluginTemplate(),
    force,
    createdFiles,
    skippedFiles
  );
  writeTextFile(path.join(cwd, "README.md"), createProjectReadme(executionProfile), false, createdFiles, skippedFiles);

  return {
    createdFiles,
    skippedFiles,
    installedPackIds: installed.installedPackIds,
    executionProfile
  };
}
