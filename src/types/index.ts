/**
 * Core types for Context Window Intelligence Manager
 */

/** Supported Claude models with their context window sizes */
export enum ClaudeModel {
  CLAUDE_3_5_SONNET = 'claude-3-5-sonnet-20241022',
  CLAUDE_3_5_HAIKU = 'claude-3-5-haiku-20241022',
  CLAUDE_3_OPUS = 'claude-3-opus-20240229',
  CLAUDE_3_SONNET = 'claude-3-sonnet-20240229',
  CLAUDE_3_HAIKU = 'claude-3-haiku-20240307',
  CLAUDE_4_SONNET = 'claude-sonnet-4-20250514',
  CLAUDE_4_OPUS = 'claude-opus-4-20250514',
  CLAUDE_4_5_SONNET = 'claude-sonnet-4.5-20251022',
  CLAUDE_4_6_SONNET = 'claude-sonnet-4.6-20260101',
  CLAUDE_4_7_OPUS = 'claude-opus-4.7-20260101',
}

/** Context window sizes by tier */
export const CONTEXT_WINDOW_SIZES = {
  standard: 200_000,
  extended_500k: 500_000,
  extended_1m: 1_000_000,
} as const;

/** Categories that consume context window */
export enum ContextCategory {
  SYSTEM_PROMPT = 'system_prompt',
  SYSTEM_TOOLS = 'system_tools',
  MCP_TOOLS = 'mcp_tools',
  CUSTOM_AGENTS = 'custom_agents',
  MEMORY_FILES = 'memory_files',
  SKILLS = 'skills',
  MESSAGES = 'messages',
  FREE_SPACE = 'free_space',
  AUTOCOMPACT_BUFFER = 'autocompact_buffer',
}

/** Context consumption breakdown */
export interface ContextBreakdown {
  category: ContextCategory;
  tokens: number;
  percentage: number;
}

/** Complete context snapshot */
export interface ContextSnapshot {
  timestamp: Date;
  model: string;
  totalWindow: number;
  usedTokens: number;
  freeTokens: number;
  autocompactBuffer: number;
  utilizationPercent: number;
  breakdown: ContextBreakdown[];
  degradationRisk: DegradationRisk;
  estimatedTurnsRemaining: number | null;
  metadata: SnapshotMetadata;
}

/** Risk levels for context degradation */
export enum DegradationRisk {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/** Metadata about the snapshot */
export interface SnapshotMetadata {
  sessionDurationMs: number;
  messageCount: number;
  fileReads: number;
  toolCalls: number;
  mcpServers: number;
  memoryFiles: number;
}

/** Alert configuration */
export interface AlertConfig {
  thresholds: ThresholdConfig;
  predictions: PredictionConfig;
  notifications: NotificationConfig;
}

/** Threshold levels */
export interface ThresholdConfig {
  warning: number;   // e.g., 0.50 (50%)
  caution: number;   // e.g., 0.65 (65%)
  danger: number;    // e.g., 0.80 (80%)
  critical: number;  // e.g., 0.90 (90%)
}

/** Prediction configuration */
export interface PredictionConfig {
  enabled: boolean;
  lookAheadMinutes: number;
  sampleWindowMs: number;
  minSamples: number;
}

/** Notification configuration */
export interface NotificationConfig {
  desktop: boolean;
  sound: boolean;
  cliBadge: boolean;
  webhook?: string;
}

/** An alert event */
export interface ContextAlert {
  id: string;
  timestamp: Date;
  level: DegradationRisk;
  type: AlertType;
  message: string;
  snapshot: ContextSnapshot;
  suggestedAction: string;
  dismissed: boolean;
}

/** Types of alerts */
export enum AlertType {
  THRESHOLD = 'threshold',
  PREDICTION = 'prediction',
  DEGRADATION = 'degradation',
  OPTIMIZATION = 'optimization',
}

/** Context consumption rate */
export interface ConsumptionRate {
  tokensPerMinute: number;
  tokensPerMessage: number;
  tokensPerFileRead: number;
  trend: TrendDirection;
}

export enum TrendDirection {
  STABLE = 'stable',
  RISING = 'rising',
  FALLING = 'falling',
  ACCELERATING = 'accelerating',
}

/** Optimization suggestion */
export interface OptimizationSuggestion {
  id: string;
  priority: SuggestionPriority;
  category: SuggestionCategory;
  title: string;
  description: string;
  impactTokens: number;
  action: string;
  command?: string;
}

export enum SuggestionPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum SuggestionCategory {
  CLEAR_MESSAGES = 'clear_messages',
  COMPACT_CONTEXT = 'compact_context',
  REMOVE_MCP = 'remove_mcp',
  OPTIMIZE_MEMORY = 'optimize_memory',
  SUBAGENT = 'subagent',
  FILE_STRATEGY = 'file_strategy',
  SESSION_MANAGEMENT = 'session_management',
}

/** CLI display options */
export interface DashboardOptions {
  refreshRateMs: number;
  showBreakdown: boolean;
  showSuggestions: boolean;
  showPredictions: boolean;
  theme: DashboardTheme;
}

export enum DashboardTheme {
  DARK = 'dark',
  LIGHT = 'light',
  MINIMAL = 'minimal',
}

/** Plan tiers for Claude */
export enum ClaudePlan {
  FREE = 'free',
  PRO = 'pro',
  MAX_5 = 'max5',
  MAX_20 = 'max20',
  ENTERPRISE = 'enterprise',
}

/** Configuration for the CWIM engine */
export interface CWIMConfig {
  model: ClaudeModel;
  plan: ClaudePlan;
  contextWindowSize: number;
  alertConfig: AlertConfig;
  dashboardOptions: DashboardOptions;
  projectRoot: string;
  claudeCodePath: string;
  logLevel: LogLevel;
}

export enum LogLevel {
  SILENT = 'silent',
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

/** Token estimation options */
export interface TokenEstimateOptions {
  method: TokenEstimateMethod;
  includeWhitespace: boolean;
}

export enum TokenEstimateMethod {
  CHAR_RATIO = 'char_ratio',      // ~4 chars per token
  WORD_RATIO = 'word_ratio',      // ~0.75 words per token
  HEURISTIC = 'heuristic',        // Code-aware heuristic
}

/** File analysis result */
export interface FileTokenAnalysis {
  path: string;
  size: number;
  estimatedTokens: number;
  category: FileCategory;
}

export enum FileCategory {
  SOURCE_CODE = 'source_code',
  DOCUMENTATION = 'documentation',
  CONFIG = 'config',
  DATA = 'data',
  BINARY = 'binary',
  IGNORED = 'ignored',
}

/** Claude Code JSONL entry */
export interface ClaudeCodeLogEntry {
  timestamp: string;
  type: 'request' | 'response' | 'tool_call' | 'tool_result' | 'error';
  model?: string;
  tokens?: number;
  message?: string;
  tool_name?: string;
}

/** Event types for the monitor */
export interface MonitorEvents {
  'snapshot': (snapshot: ContextSnapshot) => void;
  'alert': (alert: ContextAlert) => void;
  'suggestion': (suggestion: OptimizationSuggestion) => void;
  'degradation': (level: DegradationRisk) => void;
  'error': (error: Error) => void;
}

/** Overall context health score */
export interface ContextHealth {
  score: number; // 0-100
  status: HealthStatus;
  utilizationPercent: number;
  freeSpacePercent: number;
  riskLevel: DegradationRisk;
  topConcerns: string[];
  recommendations: string[];
}

export enum HealthStatus {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  CRITICAL = 'critical',
}

/** Claude Code session information */
export interface ClaudeCodeSession {
  sessionId: string;
  projectName: string;
  projectPath: string;
  sessionFilePath: string;
  model: string;
  messageCount: number;
  fileReads: number;
  toolCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  estimatedUsedTokens: number;
  windowSize: number;
  utilizationPercent: number;
  mcpServers: number;
  memoryFiles: number;
  lastActivityAt: Date;
  firstActivityAt: Date;
  isActive: boolean;
}

/** Session summary for picker display */
export interface SessionSummary {
  index: number;
  projectName: string;
  projectPath: string;
  model: string;
  messageCount: number;
  tokensUsed: number;
  windowSize: number;
  utilizationPercent: number;
  lastActivityAt: Date;
  riskLevel: DegradationRisk;
}

/** Session picker options */
export interface SessionPickerOptions {
  recentHours: number;
  autoSelectIfSingle: boolean;
  autoSelectCurrentDir: boolean;
  preferRecent: boolean;
}

/** Historical consumption data point */
export interface ConsumptionDataPoint {
  timestamp: Date;
  usedTokens: number;
  messageCount: number;
  fileReads: number;
}

/** Prediction result */
export interface ContextPrediction {
  predictedFullAt: Date | null;
  predictedCriticalAt: Date | null;
  minutesUntilFull: number | null;
  minutesUntilCritical: number | null;
  confidence: number; // 0-1
  trend: TrendDirection;
}
