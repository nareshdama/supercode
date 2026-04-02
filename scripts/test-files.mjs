import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = path.join(rootDir, "packages");

export function collectTestFiles() {
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

  return testFiles;
}
