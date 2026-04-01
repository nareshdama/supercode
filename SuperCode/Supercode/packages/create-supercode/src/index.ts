#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createExecutionProfile } from "@supercode/core";
import { detectRuntimeInputs } from "@supercode/detect";
import { recommendWorkflowPacks } from "@supercode/workflows";
import { initializeProject } from "supercode/scaffold";

export async function runCreateSupercode(argv: string[] = process.argv.slice(2)): Promise<number> {
  const target = argv[0];
  if (!target) {
    console.error("Usage: create-supercode <directory>");
    return 1;
  }

  const targetDir = path.resolve(process.cwd(), target);
  mkdirSync(targetDir, { recursive: true });

  const detected = detectRuntimeInputs(targetDir, process.env);
  const recommendation = recommendWorkflowPacks(detected.project, detected.host, detected.model);
  const executionProfile = createExecutionProfile({
    ...detected,
    workflowRecommendation: recommendation
  });

  const result = initializeProject(targetDir, {
    executionProfile,
    resolveExecutionProfile: nextCwd => {
      const runtime = detectRuntimeInputs(nextCwd, process.env);
      const nextRecommendation = recommendWorkflowPacks(runtime.project, runtime.host, runtime.model);
      return createExecutionProfile({
        ...runtime,
        workflowRecommendation: nextRecommendation
      });
    }
  });

  console.log(`Created Supercode project in ${targetDir}`);
  console.log(`Installed packs: ${result.installedPackIds.join(", ") || "(none)"}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCreateSupercode().then(
    code => {
      process.exitCode = code;
    },
    error => {
      console.error(error);
      process.exitCode = 1;
    }
  );
}
