import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import type { ToolDefinition, ToolExecutionContext } from "@nareshdama/core";

type ShellExecInput = {
  command: string;
  args?: string[];
  timeoutMs?: number;
  cwd?: string;
};

type FsReadInput = {
  path: string;
  encoding?: BufferEncoding;
};

type FsWriteInput = {
  path: string;
  content: string;
  encoding?: BufferEncoding;
};

type GitStatusInput = {
  cwd?: string;
};

type ProjectScriptInput = {
  script?: string;
  packageManager?: "npm" | "pnpm" | "yarn" | "bun";
  cwd?: string;
  timeoutMs?: number;
};

function resolveCwd(context: ToolExecutionContext, override?: string): string {
  const baseDir = path.resolve(context.workingDirectory ?? process.cwd());
  return override ? ensureInside(baseDir, override) : baseDir;
}

function ensureInside(baseDir: string, targetPath: string): string {
  const resolvedBaseDir = path.resolve(baseDir);
  const resolved = path.resolve(resolvedBaseDir, targetPath);
  const relative = path.relative(resolvedBaseDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path ${targetPath} is outside the allowed workspace.`);
  }
  return resolved;
}

function runProcess(command: string, args: string[], cwd: string, timeoutMs = 10000): Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve({ stdout, stderr, code: null, timedOut: true });
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => (stdout += chunk));
    child.stderr.on("data", chunk => (stderr += chunk));
    child.on("error", error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, code, timedOut: false });
    });
  });
}

async function shellExec(input: ShellExecInput, context: ToolExecutionContext) {
  const cwd = resolveCwd(context, input.cwd);
  const args = input.args ?? [];
  const { stdout, stderr, code, timedOut } = await runProcess(input.command, args, cwd, input.timeoutMs ?? 10000);
  return {
    ok: code === 0 && !timedOut,
    code,
    timedOut,
    stdout,
    stderr
  };
}

async function fsRead(input: FsReadInput, context: ToolExecutionContext) {
  const cwd = resolveCwd(context);
  const target = ensureInside(cwd, input.path);
  const encoding = input.encoding ?? "utf8";
  const content = await readFile(target, { encoding });
  return { path: target, content };
}

async function fsWrite(input: FsWriteInput, context: ToolExecutionContext) {
  const cwd = resolveCwd(context);
  const target = ensureInside(cwd, input.path);
  const encoding = input.encoding ?? "utf8";
  await writeFile(target, input.content, { encoding });
  return { path: target, bytes: Buffer.byteLength(input.content, encoding) };
}

async function gitStatus(input: GitStatusInput, context: ToolExecutionContext) {
  const cwd = resolveCwd(context, input.cwd);
  try {
    const { stdout, stderr, code, timedOut } = await runProcess("git", ["status", "--short"], cwd, 8000);
    if (timedOut) {
      return { ok: false, timedOut: true, stdout, stderr };
    }
    const notRepo = typeof stderr === "string" && stderr.toLowerCase().includes("not a git repository");
    if (notRepo) {
      return { ok: true, stdout: "", stderr, code };
    }
    return { ok: code === 0, stdout, stderr, code };
  } catch (error) {
    return {
      ok: true,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      code: null
    };
  }
}

async function runProjectScript(input: ProjectScriptInput, context: ToolExecutionContext, scriptName: string) {
  const cwd = resolveCwd(context, input.cwd);
  const pkgManager = input.packageManager ?? "npm";
  const script = input.script ?? scriptName;
  const commandArgs: Record<string, string[]> = {
    npm: ["run", script],
    pnpm: ["run", script],
    yarn: [script],
    bun: ["run", script]
  };
  const args = commandArgs[pkgManager] ?? ["run", script];
  const { stdout, stderr, code, timedOut } = await runProcess(pkgManager, args, cwd, input.timeoutMs ?? 30000);
  return { ok: code === 0 && !timedOut, code, timedOut, stdout, stderr };
}

export function getFirstPartyTools(): ToolDefinition[] {
  return [
    {
      toolId: "shell.exec",
      title: "Shell Exec",
      description: "Execute a bounded shell command.",
      category: "shell",
      requiresPermission: ["shell", "tool"],
      execute: (input, context) => shellExec(input as ShellExecInput, context)
    },
    {
      toolId: "fs.read",
      title: "Filesystem Read",
      description: "Read a file within the workspace.",
      category: "filesystem",
      requiresPermission: ["filesystem", "tool"],
      execute: (input, context) => fsRead(input as FsReadInput, context)
    },
    {
      toolId: "fs.write",
      title: "Filesystem Write",
      description: "Write a file within the workspace with scoped permissions.",
      category: "filesystem",
      requiresPermission: ["filesystem", "tool"],
      execute: (input, context) => fsWrite(input as FsWriteInput, context)
    },
    {
      toolId: "git.status",
      title: "Git Status",
      description: "Summarize git status for the current repo.",
      category: "workflow",
      requiresPermission: ["shell", "filesystem", "tool"],
      execute: (input, context) => gitStatus(input as GitStatusInput, context)
    },
    {
      toolId: "project.build",
      title: "Project Build",
      description: "Run the project build command discovered from scripts.",
      category: "workflow",
      requiresPermission: ["shell", "tool"],
      execute: (input, context) => runProjectScript(input as ProjectScriptInput, context, "build")
    },
    {
      toolId: "project.test",
      title: "Project Test",
      description: "Run the project test command discovered from scripts.",
      category: "workflow",
      requiresPermission: ["shell", "tool"],
      execute: (input, context) => runProjectScript(input as ProjectScriptInput, context, "test")
    }
  ];
}

export function registerFirstPartyTools(register: (tool: ToolDefinition) => void): void {
  for (const tool of getFirstPartyTools()) {
    register(tool);
  }
}
