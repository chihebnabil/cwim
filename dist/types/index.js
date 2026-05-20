/**
 * Core types for Context Window Intelligence Manager
 */
/** Supported Claude models with their context window sizes */
export var ClaudeModel;
(function (ClaudeModel) {
    ClaudeModel["CLAUDE_3_5_SONNET"] = "claude-3-5-sonnet-20241022";
    ClaudeModel["CLAUDE_3_5_HAIKU"] = "claude-3-5-haiku-20241022";
    ClaudeModel["CLAUDE_3_OPUS"] = "claude-3-opus-20240229";
    ClaudeModel["CLAUDE_3_SONNET"] = "claude-3-sonnet-20240229";
    ClaudeModel["CLAUDE_3_HAIKU"] = "claude-3-haiku-20240307";
    ClaudeModel["CLAUDE_4_SONNET"] = "claude-sonnet-4-20250514";
    ClaudeModel["CLAUDE_4_OPUS"] = "claude-opus-4-20250514";
    ClaudeModel["CLAUDE_4_5_SONNET"] = "claude-sonnet-4.5-20251022";
    ClaudeModel["CLAUDE_4_6_SONNET"] = "claude-sonnet-4.6-20260101";
    ClaudeModel["CLAUDE_4_7_OPUS"] = "claude-opus-4.7-20260101";
})(ClaudeModel || (ClaudeModel = {}));
/** Context window sizes by tier */
export const CONTEXT_WINDOW_SIZES = {
    standard: 200_000,
    extended_500k: 500_000,
    extended_1m: 1_000_000,
};
/** Categories that consume context window */
export var ContextCategory;
(function (ContextCategory) {
    ContextCategory["SYSTEM_PROMPT"] = "system_prompt";
    ContextCategory["SYSTEM_TOOLS"] = "system_tools";
    ContextCategory["MCP_TOOLS"] = "mcp_tools";
    ContextCategory["CUSTOM_AGENTS"] = "custom_agents";
    ContextCategory["MEMORY_FILES"] = "memory_files";
    ContextCategory["SKILLS"] = "skills";
    ContextCategory["MESSAGES"] = "messages";
    ContextCategory["FREE_SPACE"] = "free_space";
    ContextCategory["AUTOCOMPACT_BUFFER"] = "autocompact_buffer";
})(ContextCategory || (ContextCategory = {}));
/** Risk levels for context degradation */
export var DegradationRisk;
(function (DegradationRisk) {
    DegradationRisk["NONE"] = "none";
    DegradationRisk["LOW"] = "low";
    DegradationRisk["MEDIUM"] = "medium";
    DegradationRisk["HIGH"] = "high";
    DegradationRisk["CRITICAL"] = "critical";
})(DegradationRisk || (DegradationRisk = {}));
/** Types of alerts */
export var AlertType;
(function (AlertType) {
    AlertType["THRESHOLD"] = "threshold";
    AlertType["PREDICTION"] = "prediction";
    AlertType["DEGRADATION"] = "degradation";
    AlertType["OPTIMIZATION"] = "optimization";
})(AlertType || (AlertType = {}));
export var TrendDirection;
(function (TrendDirection) {
    TrendDirection["STABLE"] = "stable";
    TrendDirection["RISING"] = "rising";
    TrendDirection["FALLING"] = "falling";
    TrendDirection["ACCELERATING"] = "accelerating";
})(TrendDirection || (TrendDirection = {}));
export var SuggestionPriority;
(function (SuggestionPriority) {
    SuggestionPriority["CRITICAL"] = "critical";
    SuggestionPriority["HIGH"] = "high";
    SuggestionPriority["MEDIUM"] = "medium";
    SuggestionPriority["LOW"] = "low";
})(SuggestionPriority || (SuggestionPriority = {}));
export var SuggestionCategory;
(function (SuggestionCategory) {
    SuggestionCategory["CLEAR_MESSAGES"] = "clear_messages";
    SuggestionCategory["COMPACT_CONTEXT"] = "compact_context";
    SuggestionCategory["REMOVE_MCP"] = "remove_mcp";
    SuggestionCategory["OPTIMIZE_MEMORY"] = "optimize_memory";
    SuggestionCategory["SUBAGENT"] = "subagent";
    SuggestionCategory["FILE_STRATEGY"] = "file_strategy";
    SuggestionCategory["SESSION_MANAGEMENT"] = "session_management";
})(SuggestionCategory || (SuggestionCategory = {}));
export var DashboardTheme;
(function (DashboardTheme) {
    DashboardTheme["DARK"] = "dark";
    DashboardTheme["LIGHT"] = "light";
    DashboardTheme["MINIMAL"] = "minimal";
})(DashboardTheme || (DashboardTheme = {}));
/** Plan tiers for Claude */
export var ClaudePlan;
(function (ClaudePlan) {
    ClaudePlan["FREE"] = "free";
    ClaudePlan["PRO"] = "pro";
    ClaudePlan["MAX_5"] = "max5";
    ClaudePlan["MAX_20"] = "max20";
    ClaudePlan["ENTERPRISE"] = "enterprise";
})(ClaudePlan || (ClaudePlan = {}));
export var LogLevel;
(function (LogLevel) {
    LogLevel["SILENT"] = "silent";
    LogLevel["ERROR"] = "error";
    LogLevel["WARN"] = "warn";
    LogLevel["INFO"] = "info";
    LogLevel["DEBUG"] = "debug";
})(LogLevel || (LogLevel = {}));
export var TokenEstimateMethod;
(function (TokenEstimateMethod) {
    TokenEstimateMethod["CHAR_RATIO"] = "char_ratio";
    TokenEstimateMethod["WORD_RATIO"] = "word_ratio";
    TokenEstimateMethod["HEURISTIC"] = "heuristic";
})(TokenEstimateMethod || (TokenEstimateMethod = {}));
export var FileCategory;
(function (FileCategory) {
    FileCategory["SOURCE_CODE"] = "source_code";
    FileCategory["DOCUMENTATION"] = "documentation";
    FileCategory["CONFIG"] = "config";
    FileCategory["DATA"] = "data";
    FileCategory["BINARY"] = "binary";
    FileCategory["IGNORED"] = "ignored";
})(FileCategory || (FileCategory = {}));
export var HealthStatus;
(function (HealthStatus) {
    HealthStatus["EXCELLENT"] = "excellent";
    HealthStatus["GOOD"] = "good";
    HealthStatus["FAIR"] = "fair";
    HealthStatus["POOR"] = "poor";
    HealthStatus["CRITICAL"] = "critical";
})(HealthStatus || (HealthStatus = {}));
//# sourceMappingURL=index.js.map