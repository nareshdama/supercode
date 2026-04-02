import { spawnSync } from "node:child_process";
import { collectTestFiles, rootDir } from "./test-files.mjs";

const testFiles = collectTestFiles();

if (testFiles.length === 0) {
  console.error("No test files found.");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", "--experimental-test-isolation=none", ...testFiles], {
  cwd: rootDir,
  stdio: "inherit"
});

process.exit(result.status ?? 1);
