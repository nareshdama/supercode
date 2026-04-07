import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = path.join(rootDir, "packages");
const scriptsTestDir = path.join(rootDir, "scripts", "test");

/**
 * Collect test files from package and script test directories.
 *
 * Args:
 *   None.
 *
 * Returns:
 *   Absolute test-file paths for the Node test runner.
 *
 * Raises:
 *   Never.
 */
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

  try {
    for (const file of readdirSync(scriptsTestDir, { withFileTypes: true })) {
      if (file.isFile() && file.name.endsWith(".test.mjs")) {
        testFiles.push(path.join(scriptsTestDir, file.name));
      }
    }
  } catch {
    // Ignore missing script-test directories so the collector stays compatible with earlier repo states.
  }

  return testFiles;
}
// DESIGN NOTE: Including script-level tests in the normal test pass keeps release automation changes under the same regression gate as package code.
