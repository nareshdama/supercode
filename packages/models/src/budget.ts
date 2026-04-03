import { randomUUID } from "node:crypto";
import type {
  BudgetReservation,
  BudgetSnapshot,
  ModelDescriptor,
  UsageRecord
} from "@nareshdama/core";

function now(): string {
  return new Date().toISOString();
}

export interface BudgetPolicyOptions {
  maxBudget?: number;
  sessionId?: string;
}

export class BudgetPolicy {
  private readonly sessionId: string;
  private readonly maxBudget: number | undefined;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private totalCostEstimate = 0;
  private invocationCount = 0;
  private readonly reservations = new Map<string, BudgetReservation>();

  constructor(options?: BudgetPolicyOptions) {
    this.sessionId = options?.sessionId ?? randomUUID();
    this.maxBudget = options?.maxBudget;
  }

  reserve(model: ModelDescriptor, estimatedTokens: number): BudgetReservation {
    const estimatedCost =
      (estimatedTokens / 1000) * (model.cost.inputPer1kTokens + model.cost.outputPer1kTokens) / 2;

    const reservation: BudgetReservation = {
      reservationId: randomUUID(),
      estimatedTokens,
      estimatedCost,
      reservedAt: now()
    };

    this.reservations.set(reservation.reservationId, reservation);
    return reservation;
  }

  record(usage: UsageRecord): void {
    this.totalInputTokens += usage.inputTokens;
    this.totalOutputTokens += usage.outputTokens;
    this.totalCostEstimate += usage.cost;
    this.invocationCount++;

    if (usage.reservationId) {
      this.reservations.delete(usage.reservationId);
    }
  }

  snapshot(): BudgetSnapshot {
    const remaining = this.maxBudget !== undefined
      ? Math.max(0, this.maxBudget - this.totalCostEstimate)
      : undefined;

    return {
      sessionId: this.sessionId,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      totalCostEstimate: this.totalCostEstimate,
      maxBudget: this.maxBudget,
      remainingBudget: remaining,
      invocationCount: this.invocationCount,
      updatedAt: now()
    };
  }

  isWithinBudget(): boolean {
    if (this.maxBudget === undefined) return true;
    return this.totalCostEstimate < this.maxBudget;
  }

  isExhausted(): boolean {
    if (this.maxBudget === undefined) return false;
    return this.totalCostEstimate >= this.maxBudget;
  }

  getWarning(): string | undefined {
    if (this.maxBudget === undefined) return undefined;
    const remaining = this.maxBudget - this.totalCostEstimate;
    if (remaining <= 0) {
      return `Budget exhausted: spent $${this.totalCostEstimate.toFixed(4)} of $${this.maxBudget.toFixed(4)} limit.`;
    }
    if (remaining < this.maxBudget * 0.1) {
      return `Budget warning: $${remaining.toFixed(4)} remaining of $${this.maxBudget.toFixed(4)} limit.`;
    }
    return undefined;
  }

  computeCost(model: ModelDescriptor, inputTokens: number, outputTokens: number): number {
    return (
      (inputTokens / 1000) * model.cost.inputPer1kTokens +
      (outputTokens / 1000) * model.cost.outputPer1kTokens
    );
  }
}
