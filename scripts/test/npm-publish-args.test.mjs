// ═══════════════════════════════════════════════════
// Fixed by: Fixer Agent | Cycle: 2
// Bugs fixed: covered BUG-2-M1, BUG-2-M4, BUG-2-m1–m3 (test-side)
// Performance improvements: 0
// Proactive improvements: 1 (expanded assertions for normalization and scoped names)
// Code health: Good → Excellent
// Safe to build on: YES
// ═══════════════════════════════════════════════════

import test from "node:test";
import assert from "node:assert/strict";
import {
  isPublishedVersionFromViewResult,
  isScopedPackage,
  normalizeVersionForPublishCompare,
  publishArgsFor,
  toPublishTarget,
  viewArgsFor
} from "../lib/npm-publish-args.mjs";

test("isScopedPackage accepts @scope/pkg only", () => {
  assert.equal(isScopedPackage("@acme/foo"), true);
  assert.equal(isScopedPackage("@nareshdama/supercode"), true);
  assert.equal(isScopedPackage("plain-name"), false);
  assert.equal(isScopedPackage(""), false);
  assert.equal(isScopedPackage("@"), false);
  assert.equal(isScopedPackage("@scope"), false);
  assert.equal(isScopedPackage("@a/b/c"), false);
  assert.equal(isScopedPackage(null), false);
  assert.equal(isScopedPackage(undefined), false);
});

test("toPublishTarget normalizes backslashes and rejects invalid input", () => {
  assert.equal(toPublishTarget("packages\\core"), "./packages/core");
  assert.equal(toPublishTarget("packages/core"), "./packages/core");
  assert.throws(() => toPublishTarget(""), /non-empty string/);
  assert.throws(() => toPublishTarget(undefined), /non-empty string/);
});

test("publishArgsFor includes --access public for scoped packages", () => {
  const args = publishArgsFor({
    packageDir: "packages/cli",
    packageName: "@nareshdama/supercode",
    tag: "latest",
    otp: undefined
  });
  assert.deepEqual(args, [
    "publish",
    "./packages/cli",
    "--tag",
    "latest",
    "--access",
    "public"
  ]);
});

test("publishArgsFor omits --access for unscoped packages", () => {
  const args = publishArgsFor({
    packageDir: "packages/core",
    packageName: "some-legacy-name",
    tag: "beta",
    otp: undefined
  });
  assert.deepEqual(args, ["publish", "./packages/core", "--tag", "beta"]);
});

test("publishArgsFor appends --otp when provided", () => {
  const args = publishArgsFor({
    packageDir: "packages/core",
    packageName: "@scope/pkg",
    tag: "latest",
    otp: "123456"
  });
  assert.deepEqual(args.slice(-2), ["--otp", "123456"]);
});

test("publishArgsFor rejects empty tag or invalid types", () => {
  assert.throws(
    () =>
      publishArgsFor({
        packageDir: "packages/core",
        packageName: "x",
        tag: "",
        otp: undefined
      }),
    /tag must be a non-empty string/
  );
  assert.throws(
    () =>
      publishArgsFor({
        packageDir: "",
        packageName: "x",
        tag: "latest",
        otp: undefined
      }),
    /packageDir must be a non-empty string/
  );
});

test("viewArgsFor builds version query argv and validates inputs", () => {
  assert.deepEqual(viewArgsFor("@scope/foo", "1.2.3"), ["view", "@scope/foo@1.2.3", "version"]);
  assert.deepEqual(viewArgsFor("lodash", "4.0.0"), ["view", "lodash@4.0.0", "version"]);
  assert.throws(() => viewArgsFor("", "1.0.0"), /packageName/);
  assert.throws(() => viewArgsFor("lodash", ""), /version/);
});

test("normalizeVersionForPublishCompare handles quotes and leading v", () => {
  assert.equal(normalizeVersionForPublishCompare("1.0.0\n"), "1.0.0");
  assert.equal(normalizeVersionForPublishCompare('"1.0.0"\n'), "1.0.0");
  assert.equal(normalizeVersionForPublishCompare("'2.1.0'\n"), "2.1.0");
  assert.equal(normalizeVersionForPublishCompare("v3.0.0"), "3.0.0");
  assert.equal(normalizeVersionForPublishCompare("V4.0.1"), "4.0.1");
  assert.equal(normalizeVersionForPublishCompare(123), "");
});

test("isPublishedVersionFromViewResult matches normalized output", () => {
  assert.equal(
    isPublishedVersionFromViewResult({ exitCode: 0, stdout: "1.0.0\n" }, "1.0.0"),
    true
  );
  assert.equal(
    isPublishedVersionFromViewResult({ exitCode: 0, stdout: '"1.0.0"\n' }, "1.0.0"),
    true
  );
  assert.equal(
    isPublishedVersionFromViewResult({ exitCode: 0, stdout: "v1.0.0\n" }, "1.0.0"),
    true
  );
  assert.equal(
    isPublishedVersionFromViewResult({ exitCode: 0, stdout: "  2.1.0  \n" }, "2.1.0"),
    true
  );
  assert.equal(
    isPublishedVersionFromViewResult({ exitCode: 0, stdout: "1.0.0\nextra-line\n" }, "1.0.0"),
    true
  );
});

test("isPublishedVersionFromViewResult rejects nonzero exit or stdout mismatch", () => {
  assert.equal(
    isPublishedVersionFromViewResult({ exitCode: 1, stdout: "1.0.0" }, "1.0.0"),
    false
  );
  assert.equal(
    isPublishedVersionFromViewResult({ exitCode: 0, stdout: "1.0.1" }, "1.0.0"),
    false
  );
  assert.equal(isPublishedVersionFromViewResult({ exitCode: 0, stdout: "" }, "1.0.0"), false);
  assert.equal(isPublishedVersionFromViewResult({ exitCode: 0, stdout: "1.0.0" }, ""), false);
  assert.equal(isPublishedVersionFromViewResult(null, "1.0.0"), false);
  assert.equal(isPublishedVersionFromViewResult({ exitCode: 0 }, "1.0.0"), false);
});
