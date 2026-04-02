import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliEntrypoint = path.join(rootDir, "packages", "cli", "dist", "index.js");
const SAMPLE_COUNT = 3;

function summarize(samples) {
  const total = samples.reduce((sum, value) => sum + value, 0);
  return {
    samples: samples.map(value => Number(value.toFixed(2))),
    minMs: Number(Math.min(...samples).toFixed(2)),
    maxMs: Number(Math.max(...samples).toFixed(2)),
    avgMs: Number((total / samples.length).toFixed(2))
  };
}

async function loadRunCli() {
  const { runCli } = await import(pathToFileURL(cliEntrypoint).href);
  return runCli;
}

async function invokeCli(runCli, cwd, argv) {
  const previousCwd = process.cwd();
  const out = [];
  const err = [];
  process.chdir(cwd);
  const startedAt = performance.now();
  try {
    const code = await runCli(argv, {
      out: message => out.push(message),
      err: message => err.push(message)
    });
    const durationMs = performance.now() - startedAt;
    if (code !== 0) {
      throw new Error(`Command "${argv.join(" ")}" failed with code ${code}: ${err.join("\n")}`);
    }
    return {
      durationMs,
      out,
      err
    };
  } finally {
    process.chdir(previousCwd);
  }
}

function createTempWorkspace() {
  return mkdtempSync(path.join(tmpdir(), "supercode-profile-"));
}

async function profileDoctor(runCli) {
  const durations = [];
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const result = await invokeCli(runCli, rootDir, ["doctor", "--json"]);
    durations.push(result.durationMs);
  }
  return summarize(durations);
}

async function profileScaffoldedScenario(runCli, commandFactory) {
  const durations = [];
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const cwd = createTempWorkspace();
    try {
      await invokeCli(runCli, cwd, ["init"]);
      const argv = commandFactory(cwd);
      const result = await invokeCli(runCli, cwd, argv);
      durations.push(result.durationMs);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }
  return summarize(durations);
}

async function profileResultList(runCli) {
  const durations = [];
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const cwd = createTempWorkspace();
    try {
      await invokeCli(runCli, cwd, ["init"]);
      await invokeCli(runCli, cwd, ["run", "profile", "baseline"]);
      const result = await invokeCli(runCli, cwd, ["result", "list"]);
      durations.push(result.durationMs);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }
  return summarize(durations);
}

async function main() {
  const runCli = await loadRunCli();
  const report = {
    generatedAt: new Date().toISOString(),
    sampleCount: SAMPLE_COUNT,
    scenarios: {
      doctorJson: await profileDoctor(runCli),
      extensionValidate: await profileScaffoldedScenario(runCli, () => ["extension", "validate"]),
      mcpList: await profileScaffoldedScenario(runCli, () => ["mcp", "list"]),
      runSimpleTask: await profileScaffoldedScenario(runCli, () => ["run", "profile", "baseline"]),
      resultListAfterRun: await profileResultList(runCli)
    }
  };

  console.log("[profile-baseline] Performance baseline");
  console.log(JSON.stringify(report, null, 2));
}

await main();
