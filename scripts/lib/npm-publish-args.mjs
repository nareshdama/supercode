// ═══════════════════════════════════════════════════
// Fixed by: Fixer Agent | Cycle: 2
// Bugs fixed: 8 (0 critical, 5 major, 3 minor)
// Performance improvements: 0 (PERF-2-1 documented; deferred)
// Proactive improvements: 1 (shared normalization helpers)
// Code health: Good → Excellent
// Safe to build on: YES
// ═══════════════════════════════════════════════════

/**
 * Pure helpers for npm publish and npm view argument construction, plus
 * interpretation of npm view output for skip-if-already-published logic.
 *
 * Callers must pass string fields where specified; publish-release validates
 * manifests before invoking these helpers.
 */
// DESIGN NOTE: Keeping argv construction separate from I/O keeps publish-release testable without invoking npm.

/**
 * Normalize a version string from npm view stdout or from package.json for comparison.
 * Uses the first line only, trims, strips matching ASCII quotes, and a leading "v"/"V".
 *
 * Args:
 *   value: Raw version or stdout fragment.
 *
 * Returns:
 *   Normalized string, or empty string when input is not a non-empty string.
 *
 * Raises:
 *   Never.
 */
export function normalizeVersionForPublishCompare(value) {
  if (typeof value !== "string") {
    return "";
  }
  const firstLine = value.trim().split(/\r?\n/, 1)[0]?.trim() ?? "";
  return firstLine.replace(/^["']+|["']+$/g, "").replace(/^v/i, "");
}
// DESIGN NOTE: npm and manifests sometimes differ by a leading "v" or wrapping quotes; comparing normalized forms reduces false negatives on skip checks (BUG-2-M4, BUG-2-m1).

/**
 * Determine whether an npm package name is scoped (requires --access public on publish).
 * Valid scoped names are @scope/name with exactly one slash separating scope and package id.
 *
 * Args:
 *   packageName: npm package name to inspect.
 *
 * Returns:
 *   `true` when the name is a well-formed scoped package name, otherwise `false`.
 *
 * Raises:
 *   Never.
 */
export function isScopedPackage(packageName) {
  if (typeof packageName !== "string") {
    return false;
  }
  if (!packageName.startsWith("@")) {
    return false;
  }
  const slash = packageName.indexOf("/", 1);
  if (slash <= 1 || slash !== packageName.lastIndexOf("/")) {
    return false;
  }
  return packageName.length > slash + 1;
}
// DESIGN NOTE: Reject "@", "@scope", and multi-slash forms so we do not add --access for invalid names (BUG-2-m2).

/**
 * Convert a workspace package directory into an npm publish target path.
 *
 * Args:
 *   packageDir: Workspace-relative package directory.
 *
 * Returns:
 *   npm-compatible relative publish target.
 *
 * Raises:
 *   TypeError: When packageDir is not a non-empty string.
 */
export function toPublishTarget(packageDir) {
  if (typeof packageDir !== "string" || packageDir.length === 0) {
    throw new TypeError(`toPublishTarget: expected non-empty string packageDir, got ${typeof packageDir}`);
  }
  return `./${packageDir.replace(/\\/g, "/")}`;
}
// DESIGN NOTE: Normalizing slashes keeps publish targets stable across Windows and POSIX shells.

/**
 * Build npm publish arguments for a package.
 *
 * Args:
 *   options: Options object.
 *   options.packageDir: Workspace-relative package directory.
 *   options.packageName: npm package name.
 *   options.tag: Dist-tag to publish under (e.g. `latest`).
 *   options.otp: Optional npm one-time password.
 *
 * Returns:
 *   Ordered npm publish arguments.
 *
 * Raises:
 *   TypeError: When required fields are missing or not strings, or tag is empty.
 */
export function publishArgsFor({ packageDir, packageName, tag, otp }) {
  if (typeof packageDir !== "string" || packageDir.length === 0) {
    throw new TypeError("publishArgsFor: packageDir must be a non-empty string");
  }
  if (typeof packageName !== "string" || packageName.length === 0) {
    throw new TypeError("publishArgsFor: packageName must be a non-empty string");
  }
  if (typeof tag !== "string" || tag.trim() === "") {
    throw new TypeError("publishArgsFor: tag must be a non-empty string");
  }
  const publishArgs = ["publish", toPublishTarget(packageDir), "--tag", tag];
  if (isScopedPackage(packageName)) {
    publishArgs.push("--access", "public");
  }
  if (otp) {
    if (typeof otp !== "string") {
      throw new TypeError("publishArgsFor: otp must be a string when provided");
    }
    publishArgs.push("--otp", otp);
  }
  return publishArgs;
}
// DESIGN NOTE: Publish argument construction stays pure so dry-run and real publish paths cannot drift.

/**
 * Build npm view arguments for checking an already-published version.
 *
 * Args:
 *   packageName: npm package name.
 *   version: Version to look up.
 *
 * Returns:
 *   Ordered npm view arguments.
 *
 * Raises:
 *   TypeError: When packageName or version is not a non-empty string.
 */
export function viewArgsFor(packageName, version) {
  if (typeof packageName !== "string" || packageName.length === 0) {
    throw new TypeError("viewArgsFor: packageName must be a non-empty string");
  }
  if (typeof version !== "string" || version.length === 0) {
    throw new TypeError("viewArgsFor: version must be a non-empty string");
  }
  return ["view", `${packageName}@${version}`, "version"];
}
// DESIGN NOTE: Version checks happen before OTP prompts to avoid unnecessary auth interactions.

/**
 * Decide whether npm view output indicates the exact version is already on the registry.
 *
 * Args:
 *   result: Object with `exitCode` and `stdout` as returned by the command runner.
 *   expectedVersion: Version string from package.json to compare (may include leading "v" in registry output only).
 *
 * Returns:
 *   `true` when the registry reports the same normalized version, otherwise `false`.
 *   Returns `false` when result is nullish, exitCode is not 0, or stdout/expectedVersion are not strings.
 *
 * Raises:
 *   Never.
 */
export function isPublishedVersionFromViewResult(result, expectedVersion) {
  if (!result || typeof result.exitCode !== "number" || result.exitCode !== 0) {
    return false;
  }
  if (typeof result.stdout !== "string" || typeof expectedVersion !== "string") {
    return false;
  }
  const got = normalizeVersionForPublishCompare(result.stdout);
  const want = normalizeVersionForPublishCompare(expectedVersion);
  if (got === "" || want === "") {
    return false;
  }
  return got === want;
}
// DESIGN NOTE: Separating this predicate from `runCommand` allows unit tests without a live registry; defensive checks avoid throws on partial mocks (BUG-2-M1, BUG-2-M4).
