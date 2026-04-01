import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DetectionSnapshot, ExecutionProfile, SupercodeConfig } from "@supercode/core";
import { FileRuntimeStateStore } from "@supercode/state";
import { installRecommendedWorkflowPacks } from "@supercode/workflows";

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
    "This directory stores Supercode's local configuration, pack installation state, and detection snapshots.",
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
    "Notes:",
    notes,
    ""
  ].join("\n");
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

  const installed = installRecommendedWorkflowPacks(cwd, {
    recommendedPackIds: executionProfile.recommendedPackIds,
    reasons: executionProfile.recommendationReasons
  });

  return {
    createdFiles,
    skippedFiles,
    installedPackIds: installed.installedPackIds,
    executionProfile
  };
}
