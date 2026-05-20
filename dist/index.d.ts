/**
 * Context Window Intelligence Manager (CWIM)
 * Real-time context monitoring system for Claude Code users.
 * Avoid the silent context ceiling with intelligent alerts and optimization suggestions.
 */
export { ContextMonitor } from './core/ContextMonitor.js';
export { TokenEstimator } from './core/TokenEstimator.js';
export { ContextPredictor } from './core/ContextPredictor.js';
export { parseContextOutput, readLogs, getSettings, isClaudeCodeInstalled, getClaudeCodePath, findMCPServers, findMemoryFiles, autoDetectContext, } from './integrations/claude-code.js';
export { ClaudeModel, ClaudePlan, CONTEXT_WINDOW_SIZES, ContextCategory, DegradationRisk, AlertType, TrendDirection, SuggestionPriority, SuggestionCategory, DashboardTheme, TokenEstimateMethod, FileCategory, HealthStatus, LogLevel, } from './types/index.js';
export type { ContextSnapshot, ContextBreakdown, ContextAlert, AlertConfig, ConsumptionRate, OptimizationSuggestion, DashboardOptions, CWIMConfig, ContextHealth, ContextPrediction, ConsumptionDataPoint, FileTokenAnalysis, TokenEstimateOptions, ClaudeCodeLogEntry, } from './types/index.js';
export declare const VERSION = "1.0.0";
//# sourceMappingURL=index.d.ts.map