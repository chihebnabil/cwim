/**
 * Context Window Intelligence Manager (CWIM)
 * Real-time context monitoring system for Claude Code users.
 * Avoid the silent context ceiling with intelligent alerts and optimization suggestions.
 */

// Core engine
export { ContextMonitor } from './core/ContextMonitor.js';
export { TokenEstimator } from './core/TokenEstimator.js';
export { ContextPredictor } from './core/ContextPredictor.js';

// Integrations
export {
  parseContextOutput,
  readLogs,
  getSettings,
  isClaudeCodeInstalled,
  getClaudeCodePath,
  findMCPServers,
  findMemoryFiles,
  autoDetectContext,
} from './integrations/claude-code.js';

// Types
export {
  ClaudeModel,
  ClaudePlan,
  CONTEXT_WINDOW_SIZES,
  ContextCategory,
  DegradationRisk,
  AlertType,
  TrendDirection,
  SuggestionPriority,
  SuggestionCategory,
  DashboardTheme,
  TokenEstimateMethod,
  FileCategory,
  HealthStatus,
  LogLevel,
} from './types/index.js';

// Type interfaces
export type {
  ContextSnapshot,
  ContextBreakdown,
  ContextAlert,
  AlertConfig,
  ConsumptionRate,
  OptimizationSuggestion,
  DashboardOptions,
  CWIMConfig,
  ContextHealth,
  ContextPrediction,
  ConsumptionDataPoint,
  FileTokenAnalysis,
  TokenEstimateOptions,
  ClaudeCodeLogEntry,
} from './types/index.js';

// Version
export const VERSION = '1.0.0';
