import type { WorkflowPackManifest } from "@nareshdama/core";

export const PACK_MANIFESTS: WorkflowPackManifest[] = [
  {
    schemaVersion: 1,
    packId: "core",
    title: "Core Engineering Pack",
    description: "Planning, implementation, review, testing, and security workflows for all projects.",
    source: "supercode",
    installMode: "core",
    references: [],
    skills: [
      {
        skillId: "plan-before-edit",
        title: "Plan Before Edit",
        summary: "Trace dependencies and risks before making structural changes.",
        tags: ["planning", "architecture"],
        triggers: ["complex change", "multi-file edit"],
        instructions: [
          "Map affected modules before editing.",
          "State assumptions and risks explicitly.",
          "Sequence changes so verification can happen incrementally."
        ]
      },
      {
        skillId: "verification-loop",
        title: "Verification Loop",
        summary: "Run the smallest relevant verification set before closing work.",
        tags: ["testing", "verification"],
        triggers: ["after implementation", "before release"],
        instructions: [
          "Choose the smallest build, test, and lint scope that proves the change.",
          "Prefer fast local verification first.",
          "Escalate to broader checks only if the risk profile requires it."
        ]
      },
      {
        skillId: "security-review",
        title: "Security Review",
        summary: "Check boundaries, secrets, and unsafe side effects.",
        tags: ["security", "review"],
        triggers: ["tool execution", "input handling", "release"],
        instructions: [
          "Validate input at system boundaries.",
          "Never hardcode secrets.",
          "Review side effects, permission scope, and error leakage."
        ]
      }
    ],
    rules: [
      {
        ruleId: "validate-boundaries",
        title: "Validate Boundaries",
        summary: "Validate untrusted input before use.",
        severity: "critical",
        appliesTo: ["runtime", "api", "tooling"],
        guidance: [
          "Validate all external inputs at the boundary.",
          "Fail fast with explicit errors when shape or permissions are invalid."
        ]
      },
      {
        ruleId: "focused-changes",
        title: "Keep Changes Focused",
        summary: "Prefer small, reviewable changes over broad churn.",
        severity: "warning",
        appliesTo: ["implementation"],
        guidance: [
          "Keep files cohesive and changes scoped.",
          "Avoid mixing refactors with unrelated behavioral changes."
        ]
      },
      {
        ruleId: "verify-before-close",
        title: "Verify Before Close",
        summary: "Run relevant checks before marking work complete.",
        severity: "error",
        appliesTo: ["release", "implementation"],
        guidance: [
          "Run the smallest relevant verification set.",
          "Document what was verified and what remains unverified."
        ]
      }
    ]
  },
  {
    schemaVersion: 1,
    packId: "typescript",
    title: "TypeScript Pack",
    description: "TypeScript build, package, and release guidance for Node-based projects.",
    source: "supercode",
    installMode: "optional",
    references: [],
    skills: [
      {
        skillId: "ts-build-fix",
        title: "TypeScript Build Fix",
        summary: "Resolve type and build failures with minimal churn.",
        tags: ["typescript", "build", "debugging"],
        triggers: ["tsc failure", "package build"],
        instructions: [
          "Fix type contracts before adding casts.",
          "Keep public exports stable where possible.",
          "Use package.json exports and generated types consistently."
        ]
      },
      {
        skillId: "package-publish-hygiene",
        title: "Package Publish Hygiene",
        summary: "Keep package metadata, exports, and shipped files aligned.",
        tags: ["typescript", "npm", "publishing"],
        triggers: ["package work", "release prep"],
        instructions: [
          "Verify main, types, exports, and files are aligned.",
          "Ship declaration files for public packages.",
          "Keep bin entrypoints small and dependency-light."
        ]
      }
    ],
    rules: [
      {
        ruleId: "ship-types-and-exports",
        title: "Ship Types and Exports",
        summary: "Packages must expose coherent JavaScript and type entrypoints.",
        severity: "error",
        appliesTo: ["typescript", "npm"],
        guidance: [
          "Every public package should publish dist output and declarations.",
          "Keep exports explicit and avoid accidental deep import reliance."
        ]
      },
      {
        ruleId: "prefer-strict-ts",
        title: "Prefer Strict TypeScript",
        summary: "Use strict TypeScript defaults for framework code.",
        severity: "warning",
        appliesTo: ["typescript"],
        guidance: [
          "Keep TypeScript strict mode enabled.",
          "Prefer precise types and narrow inference over any."
        ]
      }
    ]
  }
];
