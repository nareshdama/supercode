import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = path.join(rootDir, "packages");
const smokeRoot = path.join(rootDir, ".tmp-phase7-smoke");
const tarballDir = path.join(smokeRoot, "tarballs");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

function log(message) {
  console.log(`[phase7-smoke] ${message}`);
}

function run(command, args, options = {}) {
  const useShell = process.platform === "win32" && (command === npmCommand || command === npxCommand);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    encoding: "utf8",
    stdio: "pipe",
    shell: useShell,
    env: {
      ...process.env,
      npm_config_audit: "false",
      npm_config_fund: "false",
      ...options.env
    }
  });

  if (result.error) {
    throw new Error(
      [`Command launch failed: ${command} ${args.join(" ")}`, `cwd: ${options.cwd ?? rootDir}`, `error: ${result.error.message}`].join(
        "\n\n"
      )
    );
  }

  if (result.status !== 0) {
    const details = [
      `Command failed: ${command} ${args.join(" ")}`,
      `cwd: ${options.cwd ?? rootDir}`,
      result.stdout?.trim() ? `stdout:\n${result.stdout.trim()}` : "",
      result.stderr?.trim() ? `stderr:\n${result.stderr.trim()}` : ""
    ]
      .filter(Boolean)
      .join("\n\n");
    throw new Error(details);
  }

  return result.stdout ?? "";
}

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

function assertExists(targetPath, label) {
  if (!existsSync(targetPath)) {
    throw new Error(`Expected ${label} at ${targetPath}`);
  }
}

function installTarballs(targetDir, tarballs) {
  writePackageJson(targetDir, path.basename(targetDir));
  run(npmCommand, ["install", "--save-exact", ...tarballs], {
    cwd: targetDir
  });
}

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

main();
