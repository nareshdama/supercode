/**
 * Evaluation harness skeleton.
 *
 * This is a Phase 3 placeholder. Full implementation is planned for Phase 8
 * (Hardening and Launch). The interfaces are defined here so other modules
 * can reference them.
 */

export interface EvaluationCase {
  caseId: string;
  description: string;
  input: Record<string, unknown>;
  expectedOutput?: unknown;
  metadata?: Record<string, unknown>;
}

export interface EvaluationSuite {
  suiteId: string;
  title: string;
  description: string;
  cases: EvaluationCase[];
}

export interface EvaluationCaseResult {
  caseId: string;
  passed: boolean;
  score?: number;
  output?: unknown;
  error?: string;
  durationMs: number;
}

export interface EvaluationReport {
  suiteId: string;
  runId: string;
  startedAt: string;
  completedAt: string;
  totalCases: number;
  passed: number;
  failed: number;
  averageScore?: number;
  results: EvaluationCaseResult[];
}

/**
 * Placeholder evaluation runner.
 * Returns an empty report with all cases marked as not yet implemented.
 */
export function runEvaluation(suite: EvaluationSuite): EvaluationReport {
  const startedAt = new Date().toISOString();

  const results: EvaluationCaseResult[] = suite.cases.map(c => ({
    caseId: c.caseId,
    passed: false,
    error: "Evaluation harness not yet implemented (Phase 8).",
    durationMs: 0
  }));

  return {
    suiteId: suite.suiteId,
    runId: `eval-${Date.now()}`,
    startedAt,
    completedAt: new Date().toISOString(),
    totalCases: suite.cases.length,
    passed: 0,
    failed: suite.cases.length,
    results
  };
}
