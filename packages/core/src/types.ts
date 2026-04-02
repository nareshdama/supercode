export type PackageManager = "npm" | "pnpm" | "yarn" | "bun" | "unknown";
export type Launcher = "direct" | "npm" | "npx" | "pnpm" | "pnpm-dlx" | "yarn" | "bunx" | "unknown";
export type HostId = "generic-cli" | "codex" | "ci" | "github-actions" | "vscode" | "unknown";
export type ConfidenceLevel = "high" | "medium" | "low";
export type DiscoverySource = "explicit" | "detected" | "inferred" | "default" | "unknown";
export type ModelProvider = "openai" | "anthropic" | "google" | "local" | "unknown" | string;
export type ContextWindowTier = "small" | "medium" | "large" | "unknown";
export type ReasoningTier = "fast" | "balanced" | "deep" | "unknown";
export type PrimaryLanguage = "typescript" | "javascript" | "python" | "unknown";
export type VerificationLevel = "light" | "standard" | "strict";
export type PromptBudgetProfile = "compact" | "balanced" | "rich";
export type PermissionMode = "default" | "auto" | "bypass";
export type RuleSeverity = "warning" | "error" | "critical";
export type WorkflowPackInstallMode = "core" | "optional";
export type McpConfigSource = "project" | "supercode" | "none";
export type McpTrustMode = "trusted" | "mixed" | "untrusted" | "unknown";
export type McpTransportKind = "builtin" | "stdio" | "http" | "unknown";
export type TaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type TaskResumeMode = "skip-completed" | "rerun-all";
export type TaskPriority = "low" | "normal" | "high";
export type TaskEventType = "created" | "started" | "completed" | "failed" | "cancelled" | "retried";
export type ProgressStepStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";
export type ProgressEventType = "message" | "percent" | "step-updated" | "task-status";
export type PermissionActionCategory = "filesystem" | "shell" | "network" | "mcp" | "tool" | "session";
export type PermissionDecisionValue = "allow" | "deny" | "prompt";
export type ToolCategory = "shell" | "filesystem" | "workflow" | "mcp" | "custom";

export interface InvocationContext {
  launcher: Launcher;
  packageManager: PackageManager;
  userAgent?: string;
}

export interface HostCapabilities {
  hostId: HostId;
  displayName: string;
  supportsTools: boolean;
  supportsMcp: boolean;
  supportsStreaming: boolean;
  supportsMultiAgent: boolean;
  source: DiscoverySource;
  confidence: ConfidenceLevel;
  notes?: string[];
}

export interface ModelCapabilities {
  provider: ModelProvider;
  modelId?: string;
  supportsTools: boolean;
  supportsStreaming: boolean;
  contextWindow: ContextWindowTier;
  reasoning: ReasoningTier;
  source: DiscoverySource;
  confidence: ConfidenceLevel;
  notes?: string[];
}

export interface ProjectScripts {
  build?: string;
  test?: string;
  lint?: string;
}

export interface ProjectProfile {
  cwd: string;
  projectRoot: string;
  packageManager: PackageManager;
  primaryLanguage: PrimaryLanguage;
  frameworks: string[];
  scripts: ProjectScripts;
  isGitRepo: boolean;
  gitDirty: boolean;
  nodeProject: boolean;
  hasTsconfig: boolean;
  fileSignals: string[];
}

export interface SafetyProfile {
  permissionMode: PermissionMode;
  filesystemScope: "workspace" | "project" | "unknown";
  networkAccess: "restricted" | "enabled" | "unknown";
}

export interface SkillDefinition {
  skillId: string;
  title: string;
  summary: string;
  tags: string[];
  triggers: string[];
  instructions: string[];
  provenance?: string;
}

export interface RuleDefinition {
  ruleId: string;
  title: string;
  summary: string;
  severity: RuleSeverity;
  appliesTo: string[];
  guidance: string[];
  provenance?: string;
}

export interface WorkflowPackManifest {
  schemaVersion: 1;
  packId: string;
  title: string;
  description: string;
  skills: SkillDefinition[];
  rules: RuleDefinition[];
  source: "supercode";
  references: string[];
  installMode: WorkflowPackInstallMode;
}

export interface WorkflowPack extends WorkflowPackManifest {}

export interface WorkflowPackSummary {
  packId: string;
  title: string;
  description: string;
  source: WorkflowPack["source"];
  installMode: WorkflowPackInstallMode;
  skillCount: number;
  ruleCount: number;
  references: string[];
}

export interface WorkflowRecommendation {
  recommendedPackIds: string[];
  reasons: Record<string, string[]>;
}

export interface WorkflowExtensionPackSummary {
  packId: string;
  title: string;
  installMode: WorkflowPackInstallMode;
  skillCount: number;
  ruleCount: number;
}

export interface WorkflowSkillAsset {
  packId: string;
  skillId: string;
  title: string;
  path: string;
}

export interface WorkflowRuleAsset {
  packId: string;
  ruleId: string;
  title: string;
  severity: RuleSeverity;
  path: string;
}

export interface WorkflowExtensionState {
  version: 1;
  generatedAt: string;
  packs: WorkflowExtensionPackSummary[];
  skills: WorkflowSkillAsset[];
  rules: WorkflowRuleAsset[];
}

export type WorkflowHookEvent = "run.before" | "run.after" | "pack.install.after" | "pack.uninstall.after";
export type WorkflowHookExecutionStatus = "completed" | "blocked" | "failed";
export type WorkflowHookFailurePolicy = "continue" | "abort";

export interface WorkflowHookDefinition {
  hookId: string;
  title: string;
  event: WorkflowHookEvent;
  toolId: string;
  enabled: boolean;
  onFailure?: WorkflowHookFailurePolicy;
  input?: unknown;
}

export interface WorkflowHookManifest {
  version: 1;
  hooks: WorkflowHookDefinition[];
}

export interface WorkflowPluginManifest {
  version: 1;
  pluginId: string;
  title: string;
  description: string;
  enabled: boolean;
  skills: SkillDefinition[];
  rules: RuleDefinition[];
  tools: WorkflowPluginToolDefinition[];
  runSteps: WorkflowPluginRunStepDefinition[];
  commands: WorkflowPluginCommandDefinition[];
  hooks: WorkflowHookDefinition[];
}

export interface WorkflowPluginSummary {
  pluginId: string;
  title: string;
  description: string;
  enabled: boolean;
  skillCount: number;
  ruleCount: number;
  toolCount: number;
  runStepCount: number;
  commandCount: number;
  hookCount: number;
  path: string;
}

export interface WorkflowResolvedHookDefinition extends WorkflowHookDefinition {
  source: "local" | "plugin";
  pluginId?: string;
  path: string;
}

export interface WorkflowPluginToolDefinition {
  toolId: string;
  title: string;
  description: string;
  enabled: boolean;
  targetToolId: string;
  input?: unknown;
}

export interface WorkflowResolvedPluginToolDefinition extends WorkflowPluginToolDefinition {
  runtimeToolId: string;
  pluginId: string;
  pluginTitle: string;
  path: string;
}

export type WorkflowPluginRunStepPlacement = "before-defaults" | "after-defaults";

export interface WorkflowPluginRunStepDefinition {
  stepId: string;
  title: string;
  description: string;
  toolId: string;
  enabled: boolean;
  placement?: WorkflowPluginRunStepPlacement;
  whenTaskIncludes?: string[];
  input?: unknown;
}

export interface WorkflowResolvedPluginRunStepDefinition extends WorkflowPluginRunStepDefinition {
  pluginId: string;
  pluginTitle: string;
  path: string;
}

export type WorkflowPluginCommandArgsMode = "none" | "text" | "json" | "argv";

export interface WorkflowPluginCommandDefinition {
  commandId: string;
  commandName: string;
  title: string;
  description: string;
  toolId: string;
  enabled: boolean;
  argsMode?: WorkflowPluginCommandArgsMode;
  input?: unknown;
}

export interface WorkflowResolvedPluginCommandDefinition extends WorkflowPluginCommandDefinition {
  pluginId: string;
  pluginTitle: string;
  path: string;
}

export type WorkflowValidationSeverity = "error" | "warning";

export interface WorkflowValidationIssue {
  severity: WorkflowValidationSeverity;
  sourceType: "local" | "plugin" | "runtime";
  sourceId?: string;
  path: string;
  message: string;
}

export interface WorkflowValidationReport {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  issues: WorkflowValidationIssue[];
}

export interface WorkflowHookExecution {
  hookId: string;
  title: string;
  event: WorkflowHookEvent;
  toolId: string;
  status: WorkflowHookExecutionStatus;
  failurePolicy: WorkflowHookFailurePolicy;
  source: "local" | "plugin";
  pluginId?: string;
  path: string;
  invocationId?: string;
  error?: string;
  outputPreview?: string;
  completedAt: string;
}

export interface WorkflowHookRunResult {
  event: WorkflowHookEvent;
  executions: WorkflowHookExecution[];
  halted: boolean;
  haltedByHookId?: string;
  abortReason?: string;
}

export interface ExecutionProfile {
  invocation: InvocationContext;
  host: HostCapabilities;
  model: ModelCapabilities;
  project: ProjectProfile;
  safety: SafetyProfile;
  recommendedPackIds: string[];
  recommendationReasons: Record<string, string[]>;
  verificationLevel: VerificationLevel;
  promptBudgetProfile: PromptBudgetProfile;
  notes: string[];
}

export interface PackInstallState {
  version: 1;
  installedPackIds: string[];
  updatedAt: string;
}

export interface SupercodeMemoryConfig {
  enabled: boolean;
  provider: "local" | "simplemem";
  attachLimit: number;
  defaultTags: string[];
  defaultImportance: number;
  retention: MemoryRetentionPolicy;
}

export interface SupercodeConfig {
  version: 1;
  selectedPackIds: string[];
  verificationLevel: VerificationLevel;
  promptBudgetProfile: PromptBudgetProfile;
  memory: SupercodeMemoryConfig;
  createdAt: string;
  updatedAt: string;
}

export interface DetectionSnapshot {
  version: 1;
  capturedAt: string;
  executionProfile: ExecutionProfile;
}

export interface McpRuntimeSummary {
  available: boolean;
  configured: boolean;
  configPath?: string;
  configSource: McpConfigSource;
  serverCount: number;
  serverIds: string[];
  trustMode: McpTrustMode;
  notes: string[];
}

export interface McpServerConfig {
  serverId: string;
  transport: McpTransportKind;
  enabled: boolean;
  trusted?: boolean;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  timeoutMs: number;
  retryCount: number;
  concurrencyLimit: number;
  queueLimit: number;
  notes: string[];
}

export interface McpRuntimeConfig {
  configPath?: string;
  configSource: McpConfigSource;
  servers: McpServerConfig[];
  notes: string[];
}

export interface McpServerStatus {
  serverId: string;
  transport: McpTransportKind;
  enabled: boolean;
  trusted?: boolean;
  available: boolean;
  timeoutMs: number;
  retryCount: number;
  notes: string[];
}

export interface DoctorJsonReport {
  version: 1;
  generatedAt: string;
  executionProfile: ExecutionProfile;
  workflowRecommendation: WorkflowRecommendation;
  availablePacks: WorkflowPackSummary[];
  installedPacks: PackInstallState;
  mcp: McpRuntimeSummary;
}

export type DoctorReport = DoctorJsonReport;

export interface TaskError {
  message: string;
  code?: string;
  retryable: boolean;
  details?: unknown;
}

export interface TaskResult {
  outcome: "success" | "failure" | "cancelled";
  summary: string;
  data?: unknown;
  outputRef?: string;
  completedAt: string;
}

export interface TaskRecord {
  taskId: string;
  goal: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  parentTaskId?: string;
  childTaskIds: string[];
  attempts: number;
  maxAttempts: number;
  metadata: Record<string, unknown>;
  result?: TaskResult;
  error?: TaskError;
  planRef?: string;
}

export interface CreateTaskInput {
  goal: string;
  priority?: TaskPriority;
  parentTaskId?: string;
  maxAttempts?: number;
  metadata?: Record<string, unknown>;
}

export interface CompleteTaskInput {
  summary: string;
  data?: unknown;
  outputRef?: string;
}

export interface FailTaskInput {
  message: string;
  code?: string;
  retryable?: boolean;
  details?: unknown;
}

export interface CancelTaskInput {
  reason?: string;
}

export interface TaskQuery {
  status?: TaskStatus | TaskStatus[];
  parentTaskId?: string;
}

export interface TaskEvent {
  eventId: string;
  taskId: string;
  type: TaskEventType;
  status: TaskStatus;
  timestamp: string;
  message?: string;
  data?: unknown;
}

export interface TaskManager {
  createTask(input: CreateTaskInput): TaskRecord;
  startTask(taskId: string): TaskRecord;
  completeTask(taskId: string, input: CompleteTaskInput): TaskRecord;
  failTask(taskId: string, input: FailTaskInput): TaskRecord;
  cancelTask(taskId: string, input?: CancelTaskInput): TaskRecord;
  retryTask(taskId: string, force?: boolean): TaskRecord;
  resumeTask(taskId: string): TaskRecord;
  getTask(taskId: string): TaskRecord | undefined;
  listTasks(query?: TaskQuery): TaskRecord[];
  getTaskEvents(taskId: string): TaskEvent[];
  subscribe(listener: (event: TaskEvent, task: TaskRecord) => void): () => void;
}

export interface ProgressStep {
  stepId: string;
  title: string;
  status: ProgressStepStatus;
  startedAt?: string;
  completedAt?: string;
  detail?: string;
}

export interface ProgressEvent {
  eventId: string;
  taskId: string;
  type: ProgressEventType;
  timestamp: string;
  status?: TaskStatus;
  message?: string;
  percentComplete?: number;
  step?: ProgressStep;
}

export interface RecordProgressInput {
  taskId: string;
  type: ProgressEventType;
  status?: TaskStatus;
  message?: string;
  percentComplete?: number;
  step?: ProgressStep;
}

export interface TaskProgressSnapshot {
  taskId: string;
  status: TaskStatus;
  summary?: string;
  percentComplete?: number;
  steps: ProgressStep[];
  events: ProgressEvent[];
  updatedAt: string;
}

export interface ProgressTracker {
  record(input: RecordProgressInput): TaskProgressSnapshot;
  recordTaskEvent(event: TaskEvent): TaskProgressSnapshot;
  getTaskProgress(taskId: string): TaskProgressSnapshot | undefined;
  listTaskProgress(): TaskProgressSnapshot[];
}

export interface PermissionRequest {
  requestId: string;
  category: PermissionActionCategory;
  resource: string;
  reason: string;
  taskId?: string;
  requestedAt: string;
  metadata?: Record<string, unknown>;
}

export interface PermissionDecision {
  requestId: string;
  decision: PermissionDecisionValue;
  mode: PermissionMode;
  decidedAt: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface PermissionLogEntry {
  request: PermissionRequest;
  decision: PermissionDecision;
}

export interface PermissionSystem {
  evaluate(request: Omit<PermissionRequest, "requestId" | "requestedAt">): PermissionDecision;
  getDecisionLog(): PermissionLogEntry[];
}

export interface SessionState {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  activeTaskIds: string[];
  recentTaskIds: string[];
  resultRefs: string[];
}

export type MemorySourceKind = "task" | "result" | "user-note" | "system";

export interface MemoryProvenance {
  sessionId?: string;
  taskId?: string;
  resultRef?: string;
  sourceKind: MemorySourceKind;
  sourceLabel?: string;
}

export interface MemoryRetentionPolicy {
  strategy: "keep-all" | "ttl" | "count-bound";
  maxEntries?: number;
  ttlDays?: number;
}

export interface MemoryRecord {
  memoryRef: string;
  content: string;
  summary: string;
  tags: string[];
  importance: number;
  createdAt: string;
  updatedAt: string;
  provenance: MemoryProvenance;
  retention: MemoryRetentionPolicy;
  metadata?: Record<string, unknown>;
}

export interface MemoryQuery {
  text?: string;
  tags?: string[];
  sessionId?: string;
  taskId?: string;
  limit?: number;
}

export interface MemoryAttachment {
  memoryRef: string;
  summary: string;
  content: string;
  score: number;
  provenance: MemoryProvenance;
}

export interface MemoryProviderInfo {
  providerId: string;
  displayName: string;
  kind: "local" | "adapter";
}

export interface MemoryProvider {
  getInfo(): MemoryProviderInfo;
  add(record: Omit<MemoryRecord, "memoryRef" | "createdAt" | "updatedAt"> & Partial<Pick<MemoryRecord, "memoryRef" | "createdAt" | "updatedAt">>): MemoryRecord;
  get(memoryRef: string): MemoryRecord | undefined;
  list(query?: MemoryQuery): MemoryRecord[];
  attach(query?: MemoryQuery): MemoryAttachment[];
  prune(): MemoryRecord[];
}

export interface ResultRecord {
  resultRef: string;
  createdAt: string;
  summary: string;
  preview?: string;
  taskId?: string;
  toolId?: string;
  kind: "tool-result" | "task-output";
  data?: unknown;
  artifactRef?: string;
}

export interface StepOutcome {
  stepId: string;
  toolId: string;
  ok: boolean;
  output?: unknown;
  error?: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  timedOut?: boolean;
}

export interface StoredPlan {
  planRef: string;
  plan: ExecutionPlan;
  storedAt: string;
  taskId: string;
}

export interface ToolExecutionContext {
  sessionId?: string;
  taskId?: string;
  workingDirectory?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolDefinition<Input = unknown, Output = unknown> {
  toolId: string;
  title: string;
  description: string;
  category: ToolCategory;
  requiresPermission?: PermissionActionCategory[];
  execute?: (input: Input, context: ToolExecutionContext) => Promise<Output> | Output;
}

export interface ToolInvocation {
  invocationId: string;
  toolId: string;
  taskId?: string;
  input: unknown;
  invokedAt: string;
}

export interface ToolResult {
  invocationId: string;
  toolId: string;
  ok: boolean;
  output?: unknown;
  error?: string;
  outputRef?: string;
  completedAt: string;
}

export interface ToolRegistry {
  registerTool<Input = unknown, Output = unknown>(tool: ToolDefinition<Input, Output>): void;
  getTool(toolId: string): ToolDefinition | undefined;
  listTools(): ToolDefinition[];
  invoke(toolId: string, input: unknown, context: ToolExecutionContext): Promise<ToolResult>;
}

export interface ExecutionStep {
  stepId: string;
  toolId: string;
  input?: unknown;
  title?: string;
  description?: string;
  timeoutMs?: number;
  retryCount?: number;
  metadata?: Record<string, unknown>;
}

export interface ExecutionPlan {
  planRef?: string;
  taskId: string;
  steps: ExecutionStep[];
  createdAt: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

export type ExecutionOutcomeData =
  | ToolResult
  | {
      planId?: string;
      steps?: Array<string | ExecutionStep>;
      stats?: {
        startedAt?: string;
        completedAt?: string;
        durationMs?: number;
      };
      [key: string]: unknown;
    };

export interface ExecutionOutcome {
  success: boolean;
  summary: string;
  outputRef?: string;
  data?: ExecutionOutcomeData;
  completedAt?: string;
  stepOutcomes?: StepOutcome[];
  startedAt?: string;
  durationMs?: number;
}

export interface TaskExecutor {
  run(plan: ExecutionPlan): Promise<ExecutionOutcome>;
  resume?(plan: ExecutionPlan, completedStepIds: string[]): Promise<ExecutionOutcome>;
}

export interface McpInvocationRequest {
  requestId: string;
  serverId: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  taskId?: string;
  requestedAt: string;
  timeoutMs?: number;
  retryCount?: number;
}

export interface McpInvocationAttempt {
  attempt: number;
  startedAt: string;
  completedAt: string;
  ok: boolean;
  timedOut: boolean;
  error?: string;
}

export interface McpInvocationResult {
  requestId: string;
  serverId: string;
  toolName: string;
  ok: boolean;
  response?: unknown;
  error?: string;
  attemptCount: number;
  attempts: McpInvocationAttempt[];
  timedOut: boolean;
  completedAt: string;
}

export type MCPConnectionState = "configured" | "connecting" | "authenticating" | "negotiating" | "ready" | "degraded" | "backoff" | "disconnected" | "quarantined";

export type MCPTrustClass = "trusted" | "restricted" | "untrusted";

export type MCPIsolationMode = "in_process" | "worker" | "subprocess" | "remote";

export type MCPCredentialMode = "none" | "brokered" | "delegated";

export interface MCPCapabilityProfile {
  protocolVersion: string;
  tools: readonly Record<string, unknown>[];
  resources: readonly Record<string, unknown>[];
  prompts: readonly Record<string, unknown>[];
  supportsStreaming: boolean;
  maxConcurrentRequests: number;
}

export interface MCPHealthStatus {
  status: "healthy" | "degraded" | "down";
  latencyMs?: number;
  errorCount: number;
  lastError?: string;
  lastCheckedAt: string;
}

export interface MCPServerSession {
  serverId: string;
  displayName: string;
  state: MCPConnectionState;
  trustClass: MCPTrustClass;
  capabilities?: MCPCapabilityProfile;
  health: MCPHealthStatus;
}

export interface McpRuntime {
  getSummary(): McpRuntimeSummary;
  getConfig(): McpRuntimeConfig;
  listServers(): McpServerStatus[];
  invoke(
    request: Omit<McpInvocationRequest, "requestId" | "requestedAt">
  ): Promise<McpInvocationResult>;
  destroy(): Promise<void>;
}

// --- Model Control Plane ---

export type ModelTrustTier = "first_party" | "approved_third_party" | "restricted";
export type ModelLatencyTier = "fast" | "balanced" | "deep";
export type ModelFinishReason = "stop" | "tool_calls" | "length" | "error";
export type ProviderHealthStatus = "healthy" | "degraded" | "down";

export interface ModelDescriptor {
  modelId: string;
  providerId: string;
  family: string;
  contextWindow: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
  trustTier: ModelTrustTier;
  cost: { inputPer1kTokens: number; outputPer1kTokens: number };
  latencyTier: ModelLatencyTier;
}

export interface ModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: ModelToolCall[];
}

export interface ModelToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ModelToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ModelInvocationRequest {
  messages: ModelMessage[];
  modelId?: string;
  tools?: ModelToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  taskId?: string;
  metadata?: Record<string, unknown>;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ModelInvocationResult {
  requestId: string;
  modelId: string;
  providerId: string;
  content: string;
  toolCalls?: ModelToolCall[];
  usage: ModelUsage;
  finishReason: ModelFinishReason;
  latencyMs: number;
  completedAt: string;
}

export interface ModelDelta {
  type: "content" | "tool_call" | "done" | "error";
  content?: string;
  toolCall?: Partial<ModelToolCall>;
  error?: string;
  usage?: ModelUsage;
}

export interface ProviderHealth {
  providerId: string;
  status: ProviderHealthStatus;
  lastCheckedAt: string;
  latencyMs?: number;
  errorCount: number;
  notes: string[];
}

export interface ModelProviderAdapter {
  providerId: string;
  displayName: string;
  invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult>;
  stream?(request: ModelInvocationRequest): AsyncIterable<ModelDelta>;
  listModels(): ModelDescriptor[];
  getHealth(): ProviderHealth;
}

export interface ModelSelectionRequest {
  requiresTools: boolean;
  requiresStreaming: boolean;
  preferredProviderId?: string;
  preferredModelId?: string;
  budgetSnapshot?: BudgetSnapshot;
  latencyTarget: "interactive" | "background";
}

export interface ModelSelectionDecision {
  primary: ModelDescriptor;
  fallbacks: ModelDescriptor[];
  reason: string;
}

export interface PromptTemplate {
  promptId: string;
  version: string;
  description: string;
  body: string;
  variables: string[];
}

export interface RenderedPrompt {
  promptId: string;
  version: string;
  content: string;
  renderedAt: string;
}

export interface BudgetSnapshot {
  sessionId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostEstimate: number;
  maxBudget?: number;
  remainingBudget?: number;
  invocationCount: number;
  updatedAt: string;
}

export interface BudgetReservation {
  reservationId: string;
  estimatedTokens: number;
  estimatedCost: number;
  reservedAt: string;
}

export interface UsageRecord {
  reservationId?: string;
  modelId: string;
  providerId: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latencyMs: number;
  completedAt: string;
}
