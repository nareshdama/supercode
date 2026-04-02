import { spawnSync } from "node:child_process";
import { collectTestFiles, rootDir } from "./test-files.mjs";

const testFiles = collectTestFiles();

if (testFiles.length === 0) {
  console.error("No test files found.");
  process.exit(1);
}

const thresholds = {
  lines: 90,
  branches: 78,
  functions: 86
};

const args = [
  "--test",
  "--experimental-test-isolation=none",
  "--experimental-test-coverage",
  `--test-coverage-lines=${thresholds.lines}`,
  `--test-coverage-branches=${thresholds.branches}`,
  `--test-coverage-functions=${thresholds.functions}`,
  ...testFiles
];

console.log(
  `[coverage-gate] enforcing minimum coverage: lines=${thresholds.lines}% branches=${thresholds.branches}% functions=${thresholds.functions}%`
);

const result = spawnSync(process.execPath, args, {
  cwd: rootDir,
  stdio: "inherit"
});

process.exit(result.status ?? 1);
