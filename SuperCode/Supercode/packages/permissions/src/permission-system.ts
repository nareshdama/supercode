import { randomUUID } from "node:crypto";
import type {
  PermissionActionCategory,
  PermissionDecision,
  PermissionDecisionValue,
  PermissionLogEntry,
  PermissionMode,
  PermissionRequest,
  PermissionSystem
} from "@supercode/core";

export interface PermissionSystemOptions {
  mode: PermissionMode;
  allowCategories?: PermissionActionCategory[];
  denyCategories?: PermissionActionCategory[];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function now(): string {
  return new Date().toISOString();
}

function defaultDecisionFor(mode: PermissionMode, category: PermissionActionCategory): PermissionDecisionValue {
  if (mode === "bypass") {
    return "allow";
  }

  if (category === "session") {
    return "allow";
  }

  if (mode === "auto") {
    if (["network", "mcp"].includes(category)) {
      return "prompt";
    }

    return "allow";
  }

  if (["shell", "network", "mcp"].includes(category)) {
    return "prompt";
  }

  return "allow";
}

export class DefaultPermissionSystem implements PermissionSystem {
  private readonly log: PermissionLogEntry[];
  private readonly mode: PermissionMode;
  private readonly allowCategories: Set<PermissionActionCategory>;
  private readonly denyCategories: Set<PermissionActionCategory>;

  constructor(options: PermissionSystemOptions, seedLog: PermissionLogEntry[] = []) {
    this.mode = options.mode;
    this.allowCategories = new Set(options.allowCategories ?? []);
    this.denyCategories = new Set(options.denyCategories ?? []);
    this.log = seedLog.map(entry => clone(entry));
  }

  evaluate(requestInput: Omit<PermissionRequest, "requestId" | "requestedAt">): PermissionDecision {
    const request: PermissionRequest = {
      requestId: randomUUID(),
      requestedAt: now(),
      ...clone(requestInput)
    };

    let decision: PermissionDecisionValue;
    let reason: string;

    if (this.denyCategories.has(request.category)) {
      decision = "deny";
      reason = `Category ${request.category} is explicitly denied by the runtime policy.`;
    } else if (this.allowCategories.has(request.category)) {
      decision = "allow";
      reason = `Category ${request.category} is explicitly allowed by the runtime policy.`;
    } else {
      decision = defaultDecisionFor(this.mode, request.category);
      reason = `Mode ${this.mode} applied the default decision for ${request.category}.`;
    }

    const record: PermissionLogEntry = {
      request,
      decision: {
        requestId: request.requestId,
        decision,
        mode: this.mode,
        decidedAt: now(),
        reason
      }
    };

    this.log.push(record);
    return clone(record.decision);
  }

  getDecisionLog(): PermissionLogEntry[] {
    return this.log.map(entry => clone(entry));
  }
}
