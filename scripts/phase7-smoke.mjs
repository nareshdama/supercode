import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCommand } from "./lib/command-runner.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = path.join(rootDir, "packages");
const smokeRoot = path.join(rootDir, ".tmp-phase7-smoke");
const tarballDir = path.join(smokeRoot, "tarballs");
const npmCacheDir = path.join(smokeRoot, "npm-cache");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

/**
 * Emit a prefixed smoke-check log line.
 *
 * Args:
 *   message: Log message to print.
 *
 * Returns:
 *   Never returns a value.
 *
 * Raises:
 *   Never.
 */
function log(message) {
  console.log(`[phase7-smoke] ${message}`);
}
// DESIGN NOTE: A stable log prefix makes release-gate failures easier to scan in aggregated output.

/**
 * Execute a smoke-check command with release-safe defaults.
 *
 * Args:
 *   command: Executable name or path.
 *   args: Ordered argument list passed to the command.
 *   options: Optional cwd and environment overrides.
 *
 * Returns:
 *   Captured stdout text for commands that emit machine-readable output.
 *
 * Raises:
 *   Error: If the command fails to launch or exits non-zero.
 */
function run(command, args, options = {}) {
  const result = runCommand(command, args, {
    cwd: options.cwd ?? rootDir,
    env: {
      npm_config_audit: "false",
      npm_config_fund: "false",
      npm_config_cache: npmCacheDir,
      npm_config_update_notifier: "false",
      ...options.env
    }
  });
  return result.stdout;
}
// DESIGN NOTE: The shared runner centralizes Windows shell handling and file-backed output capture for all release scripts.

/**
 * Verify every publishable package has built artifacts before smoke validation starts.
 *
 * Args:
 *   None.
 *
 * Returns:
 *   Never returns a value.
 *
 * Raises:
 *   Error: If a package with a declared main entrypoint has no built output.
 */
function ensureBuiltArtifacts() {
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageDir = path.join(packagesDir, entry.name);
    const packageJsonPath = path.join(packageDir, "package.json");
    if (!existsSync(packageJsonPath)) continue;

    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    if (!packageJson.main) continue;

    const mainPath = path.join(packageDir, packageJson.main);
    if (!existsSync(mainPath)) {
      throw new Error(`Missing built artifact for ${packageJson.name} at ${mainPath}. Run "npm run build" first.`);
    }
  }
}
// DESIGN NOTE: Smoke tests should fail before any packaging work if the workspace is not already build-ready.

/**
 * Discover workspace packages from the monorepo `packages/` directory.
 *
 * Args:
 *   None.
 *
 * Returns:
 *   A name-sorted list of package descriptors with npm name and absolute directory.
 *
 * Raises:
 *   Never.
 */
function getWorkspacePackages() {
  const packages = [];
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageDir = path.join(packagesDir, entry.name);
    const packageJsonPath = path.join(packageDir, "package.json");
    if (!existsSync(packageJsonPath)) continue;

    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    packages.push({
      name: packageJson.name,
      dir: packageDir
    });
  }

  return packages.sort((left, right) => left.name.localeCompare(right.name));
}
// DESIGN NOTE: Sorting by package name keeps tarball generation deterministic across machines.

/**
 * Pack each workspace package into a tarball and validate tarball contents.
 *
 * Args:
 *   packages: Workspace package descriptors returned by `getWorkspacePackages`.
 *
 * Returns:
 *   A map from package name to packed tarball path.
 *
 * Raises:
 *   Error: If npm pack fails or the tarball leaks build metadata.
 */
function packWorkspacePackages(packages) {
  mkdirSync(tarballDir, { recursive: true });

  const tarballs = new Map();
  for (const pkg of packages) {
    log(`Packing ${pkg.name}`);
    const stdout = run(npmCommand, ["pack", "--json", "--pack-destination", tarballDir], {
      cwd: pkg.dir
    });
    const [packResult] = JSON.parse(stdout);
    const leakedBuildInfo = (packResult.files ?? []).find(file => typeof file.path === "string" && file.path.endsWith(".tsbuildinfo"));
    if (leakedBuildInfo) {
      throw new Error(`Packed tarball for ${pkg.name} includes build metadata: ${leakedBuildInfo.path}`);
    }
    tarballs.set(pkg.name, path.join(tarballDir, packResult.filename));
  }

  return tarballs;
}
// DESIGN NOTE: `npm pack --json` remains the source of truth for tarball filenames so we validate the actual packed output, not assumptions.

/**
 * Create a minimal package.json for an isolated smoke-test workspace.
 *
 * Args:
 *   targetDir: Directory where the package.json should be written.
 *   name: Package name for the synthetic workspace.
 *
 * Returns:
 *   Never returns a value.
 *
 * Raises:
 *   Error: If the target directory cannot be created or written.
 */
function writePackageJson(targetDir, name) {
  mkdirSync(targetDir, { recursive: true });
  writeFileSync(
    path.join(targetDir, "package.json"),
    `${JSON.stringify(
      {
        name,
        private: true,
        version: "0.0.0",
        type: "module"
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}
// DESIGN NOTE: Minimal synthetic workspaces reduce cross-talk with the monorepo root while still exercising real install paths.

/**
 * Assert that a filesystem path exists.
 *
 * Args:
 *   targetPath: Path that must exist.
 *   label: Human-readable description for failure messages.
 *
 * Returns:
 *   Never returns a value.
 *
 * Raises:
 *   Error: If the target path does not exist.
 */
function assertExists(targetPath, label) {
  if (!existsSync(targetPath)) {
    throw new Error(`Expected ${label} at ${targetPath}`);
  }
}
// DESIGN NOTE: Dedicated assertions keep smoke failures explicit instead of surfacing as later, harder-to-read filesystem errors.

/**
 * Install a set of packed tarballs into an isolated workspace.
 *
 * Args:
 *   targetDir: Synthetic workspace directory.
 *   tarballs: Ordered tarball paths to install.
 *
 * Returns:
 *   Never returns a value.
 *
 * Raises:
 *   Error: If npm install fails.
 */
function installTarballs(targetDir, tarballs) {
  writePackageJson(targetDir, path.basename(targetDir));
  run(npmCommand, ["install", "--save-exact", ...tarballs], {
    cwd: targetDir
  });
}
// DESIGN NOTE: Installing from tarballs rather than workspace links verifies the published-package path that downstream users actually consume.

/**
 * Verify the packaged CLI install path using packed workspace tarballs.
 *
 * Args:
 *   tarballsByName: Map of packed tarballs keyed by package name.
 *
 * Returns:
 *   Never returns a value.
 *
 * Raises:
 *   Error: If the packaged CLI cannot scaffold a project correctly.
 */
function verifyPackagedCli(tarballsByName) {
  log("Verifying packaged CLI install path");
  const testDir = path.join(smokeRoot, "packaged-cli");
  const generatedDir = path.join(testDir, "generated-app");
  installTarballs(testDir, [...tarballsByName.values()]);

  run(npxCommand, ["--no-install", "supercode", "init", "generated-app"], {
    cwd: testDir
  });

  assertExists(path.join(generatedDir, ".supercode", "config.json"), "generated Supercode config");
  assertExists(path.join(generatedDir, ".supercode", "extensions", "manifest.json"), "generated extension manifest");
  assertExists(path.join(generatedDir, "README.md"), "generated README");
}
// DESIGN NOTE: The CLI smoke path proves the tarballs contain all runtime dependencies and the shipped binary wiring still works.

/**
 * Verify the package-consumer install path for `@nareshdama/core`.
 *
 * Args:
 *   tarballsByName: Map of packed tarballs keyed by package name.
 *
 * Returns:
 *   Never returns a value.
 *
 * Raises:
 *   Error: If the tarball is missing or the installed package cannot be imported.
 */
function verifyCoreInstall(tarballsByName) {
  log("Verifying @nareshdama/core package install path");
  const testDir = path.join(smokeRoot, "core-install");
  const coreTarball = tarballsByName.get("@nareshdama/core");
  if (!coreTarball) {
    throw new Error("Missing packed tarball for @nareshdama/core.");
  }

  writePackageJson(testDir, "phase7-core-install");
  run(npmCommand, ["install", "--save-exact", coreTarball], {
    cwd: testDir
  });

  run(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      [
        "import { createExecutionProfile } from '@nareshdama/core';",
        "const profile = createExecutionProfile({",
        "  invocation: { launcher: 'cli', packageManager: 'npm' },",
        "  host: { hostId: 'unknown', displayName: 'Smoke', source: 'unknown', confidence: 'high', supportsTools: false, supportsMcp: false, supportsStreaming: false, supportsMultiAgent: false, notes: [] },",
        "  model: { provider: 'unknown', modelId: 'stub', source: 'unknown', confidence: 'high', contextWindow: 'small', reasoning: 'fast', supportsTools: false, supportsStreaming: false, notes: [] },",
        "  project: { cwd: process.cwd(), projectRoot: process.cwd(), packageManager: 'npm', primaryLanguage: 'unknown', frameworks: [], scripts: {}, isGitRepo: false, gitDirty: false, nodeProject: true, hasTsconfig: false, fileSignals: [] },",
        "  safety: { permissionMode: 'default', filesystemScope: 'workspace', networkAccess: 'restricted' }",
        "});",
        "if (profile.verificationLevel !== 'light') throw new Error(`Unexpected verification level: ${profile.verificationLevel}`);"
      ].join(" "),
    ],
    {
      cwd: testDir
    }
  );
}
// DESIGN NOTE: The core package smoke path is intentionally narrow so breakage in the base SDK seam is caught separately from CLI packaging issues.

/**
 * Verify the source-checkout workflow against the built local CLI.
 *
 * Args:
 *   None.
 *
 * Returns:
 *   Never returns a value.
 *
 * Raises:
 *   Error: If doctor output or local init behavior regresses.
 */
function verifySourceCheckout() {
  log("Verifying source-checkout install path");
  const outputDir = path.join(smokeRoot, "source-checkout-app");

  const doctorOutput = run(process.execPath, ["packages/cli/dist/index.js", "doctor", "--json"], {
    cwd: rootDir
  });
  const doctorReport = JSON.parse(doctorOutput);
  if (doctorReport.version !== 1) {
    throw new Error(`Unexpected doctor report version: ${doctorReport.version}`);
  }

  run(process.execPath, ["packages/cli/dist/index.js", "init", outputDir], {
    cwd: rootDir
  });

  assertExists(path.join(outputDir, ".supercode", "config.json"), "source-checkout Supercode config");
  assertExists(path.join(outputDir, ".supercode", "WORKFLOW.md"), "source-checkout workflow guide");
}
// DESIGN NOTE: Keeping the source-checkout path in the smoke suite protects contributors from packaging-only drift.

/**
 * Execute the complete Phase 7 smoke validation flow.
 *
 * Args:
 *   None.
 *
 * Returns:
 *   Never returns a value.
 *
 * Raises:
 *   Never directly. Failures are reported, artifacts are preserved, and the process exits non-zero.
 */
function main() {
  rmSync(smokeRoot, { recursive: true, force: true });
  mkdirSync(smokeRoot, { recursive: true });

  try {
    ensureBuiltArtifacts();
    const workspacePackages = getWorkspacePackages();
    const tarballsByName = packWorkspacePackages(workspacePackages);
    verifyPackagedCli(tarballsByName);
    verifyCoreInstall(tarballsByName);
    verifySourceCheckout();
    rmSync(smokeRoot, { recursive: true, force: true });
    log("Phase 7 smoke checks passed");
  } catch (error) {
    console.error(`[phase7-smoke] ${error instanceof Error ? error.message : String(error)}`);
    console.error(`[phase7-smoke] Artifacts kept at ${smokeRoot}`);
    process.exitCode = 1;
  }
}
// DESIGN NOTE: The smoke workspace is retained on failure so packaging issues can be inspected without rerunning the whole suite first.

main();
