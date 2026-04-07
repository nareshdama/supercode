import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";

const WINDOWS_SHELL_COMMANDS = new Set(["npm", "npm.cmd", "npx", "npx.cmd"]);

/**
 * Format a command and its arguments for logs and error messages.
 *
 * Args:
 *   command: Executable name or path.
 *   args: Ordered argument list passed to the command.
 *
 * Returns:
 *   A human-readable command line string.
 *
 * Raises:
 *   Never.
 */
export function formatCommand(command, args) {
  return [command, ...args].join(" ");
}
// DESIGN NOTE: A single formatter keeps diagnostics consistent across release scripts.

/**
 * Decide whether a command should be launched through the Windows shell.
 *
 * Args:
 *   command: Executable name or path.
 *   shell: Optional explicit shell override.
 *
 * Returns:
 *   `true` when the Windows shell is required for the command, otherwise `false`.
 *
 * Raises:
 *   Never.
 */
export function resolveShellOption(command, shell) {
  if (typeof shell === "boolean") {
    return shell;
  }

  return process.platform === "win32" && WINDOWS_SHELL_COMMANDS.has(command.toLowerCase());
}
// DESIGN NOTE: Only npm/npx wrappers go through the shell by default so other commands stay explicit and predictable.

/**
 * Execute a command with file-backed output capture.
 *
 * Args:
 *   command: Executable name or path.
 *   args: Ordered argument list passed to the command.
 *   options: Execution options including cwd, env overrides, and shell mode.
 *
 * Returns:
 *   An object containing stdout, stderr, exit status, and the rendered command line.
 *
 * Raises:
 *   Error: If the command cannot be launched or exits non-zero when `allowFailure` is not enabled.
 */
export function runCommand(command, args, options = {}) {
  const tempDir = mkdtempSync(path.join(tmpdir(), "supercode-command-"));
  const stdoutPath = path.join(tempDir, "stdout.log");
  const stderrPath = path.join(tempDir, "stderr.log");
  const shell = resolveShellOption(command, options.shell);
  const commandLine = formatCommand(command, args);
  let stdoutFd;
  let stderrFd;

  try {
    stdoutFd = openSync(stdoutPath, "w");
    stderrFd = openSync(stderrPath, "w");

    const result = spawnSync(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: {
        ...process.env,
        ...options.env
      },
      shell,
      stdio: ["ignore", stdoutFd, stderrFd]
    });

    const stdout = readOutput(stdoutPath);
    const stderr = readOutput(stderrPath);
    const exitCode = typeof result.status === "number" ? result.status : 1;

    if (result.error) {
      throw new Error(buildLaunchFailureMessage(commandLine, options.cwd ?? process.cwd(), result.error));
    }

    if (exitCode !== 0 && options.allowFailure !== true) {
      throw new Error(buildExitFailureMessage(commandLine, options.cwd ?? process.cwd(), exitCode, stdout, stderr));
    }

    return {
      commandLine,
      cwd: options.cwd ?? process.cwd(),
      exitCode,
      stdout,
      stderr
    };
  } finally {
    if (stdoutFd !== undefined) {
      closeSync(stdoutFd);
    }
    if (stderrFd !== undefined) {
      closeSync(stderrFd);
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
}
// DESIGN NOTE: File-backed capture avoids the Windows sandbox failures triggered by `stdio: "pipe"` while preserving structured output.

/**
 * Read a captured output file as UTF-8 text.
 *
 * Args:
 *   filePath: Absolute path to the capture file.
 *
 * Returns:
 *   The file contents as UTF-8 text, or an empty string when the file is missing.
 *
 * Raises:
 *   Never.
 */
function readOutput(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}
// DESIGN NOTE: Missing capture files should degrade to empty output rather than masking the primary process error.

/**
 * Build an actionable error message for command launch failures.
 *
 * Args:
 *   commandLine: Rendered command line string.
 *   cwd: Working directory used for the command.
 *   error: Launch error returned by `spawnSync`.
 *
 * Returns:
 *   A multi-line diagnostic message.
 *
 * Raises:
 *   Never.
 */
function buildLaunchFailureMessage(commandLine, cwd, error) {
  return [`Command launch failed: ${commandLine}`, `cwd: ${cwd}`, `error: ${error.message}`].join("\n\n");
}
// DESIGN NOTE: Launch failures need cwd context because release scripts often execute from nested package directories.

/**
 * Build an actionable error message for non-zero command exits.
 *
 * Args:
 *   commandLine: Rendered command line string.
 *   cwd: Working directory used for the command.
 *   exitCode: Numeric exit code from the process.
 *   stdout: Captured standard output.
 *   stderr: Captured standard error.
 *
 * Returns:
 *   A multi-line diagnostic message with captured output when available.
 *
 * Raises:
 *   Never.
 */
function buildExitFailureMessage(commandLine, cwd, exitCode, stdout, stderr) {
  return [
    `Command failed: ${commandLine}`,
    `cwd: ${cwd}`,
    `exitCode: ${exitCode}`,
    stdout.trim() ? `stdout:\n${stdout.trim()}` : "",
    stderr.trim() ? `stderr:\n${stderr.trim()}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}
// DESIGN NOTE: Including stdout and stderr directly keeps failure analysis local to the script without requiring repro steps first.
