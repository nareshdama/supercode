import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageDirs = [
  "packages/core",
  "packages/models",
  "packages/detect",
  "packages/permissions",
  "packages/progress",
  "packages/state",
  "packages/tasks",
  "packages/tools",
  "packages/workflows",
  "packages/mcp",
  "packages/memory",
  "packages/cli",
  "packages/create-supercode"
];

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const configuredOtp = process.env.NPM_PUBLISH_OTP?.trim();
const tag = process.env.NPM_PUBLISH_TAG?.trim() || "latest";
const npmCommand = process.platform === "win32" ? "npm" : "npm";

function readPackageManifest(packageDir) {
  const manifestPath = path.join(rootDir, packageDir, "package.json");
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

function isScopedPackage(packageName) {
  return packageName.startsWith("@");
}

function toPublishTarget(packageDir) {
  return `./${packageDir.replace(/\\/g, "/")}`;
}

function publishArgsFor(packageDir, packageName, otp) {
  const publishArgs = ["publish", toPublishTarget(packageDir), "--tag", tag];
  if (isScopedPackage(packageName)) {
    publishArgs.push("--access", "public");
  }
  if (otp) {
    publishArgs.push("--otp", otp);
  }
  return publishArgs;
}

function viewArgsFor(packageName, version) {
  return ["view", `${packageName}@${version}`, "version"];
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32"
  });

  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

function isAlreadyPublished(packageName, version) {
  const result = spawnSync(npmCommand, viewArgsFor(packageName, version), {
    cwd: rootDir,
    stdio: "pipe",
    env: process.env,
    encoding: "utf8",
    shell: process.platform === "win32"
  });

  if (result.error) {
    throw result.error;
  }

  return result.status === 0 && result.stdout.trim() === version;
}

async function promptForOtp(packageName) {
  const rl = readline.createInterface({ input, output });
  try {
    const entered = await rl.question(`[publish-release] Enter current npm OTP for ${packageName} (or press Enter to try without OTP): `);
    return entered.trim() || undefined;
  } finally {
    rl.close();
  }
}

async function main() {
  console.log(`[publish-release] tag=${tag}${dryRun ? " (dry-run)" : ""}`);
  console.log(configuredOtp ? "[publish-release] using OTP from NPM_PUBLISH_OTP" : "[publish-release] no fixed OTP provided");

  for (const packageDir of packageDirs) {
    const manifest = readPackageManifest(packageDir);
    if (isAlreadyPublished(manifest.name, manifest.version)) {
      console.log(`[publish-release] ${manifest.name}@${manifest.version} already published, skipping`);
      continue;
    }
    const otp = configuredOtp ?? (dryRun ? undefined : await promptForOtp(manifest.name));
    const publishArgs = publishArgsFor(packageDir, manifest.name, otp);
    console.log(`[publish-release] ${manifest.name}@${manifest.version}`);
    console.log(`  ${npmCommand} ${publishArgs.join(" ")}`);
    if (!dryRun) {
      run(npmCommand, publishArgs);
    }
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[publish-release] ${message}`);
  console.error("[publish-release] If publish requires npm 2FA, enter a fresh OTP when prompted or use a granular npm token with bypass-2FA enabled.");
  process.exit(1);
}
