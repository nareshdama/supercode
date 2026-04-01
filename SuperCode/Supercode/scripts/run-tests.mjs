import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = path.join(rootDir, "packages");
const testFiles = [];

for (const pkg of readdirSync(packagesDir, { withFileTypes: true })) {
  if (!pkg.isDirectory()) continue;
  const testDir = path.join(packagesDir, pkg.name, "test");
  try {
    for (const file of readdirSync(testDir, { withFileTypes: true })) {
      if (file.isFile() && file.name.endsWith(".test.mjs")) {
        testFiles.push(path.join(testDir, file.name));
      }
    }
  } catch {
    continue;
  }
}

if (testFiles.length === 0) {
  console.error("No test files found.");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", "--experimental-test-isolation=none", ...testFiles], {
  cwd: rootDir,
  stdio: "inherit"
});

process.exit(result.status ?? 1);
