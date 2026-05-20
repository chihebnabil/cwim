/**
 * Claude Code Integration
 * Reads Claude Code's local files and provides context data to the monitor.
 */
import { type ContextBreakdown, type ClaudeCodeLogEntry } from '../types/index.js';
/**
 * Parse /context command output from Claude Code
 */
export declare function parseContextOutput(output: string): {
    model: string;
    usedTokens: number;
    totalWindow: number;
    breakdown: ContextBreakdown[];
} | null;
/**
 * Read Claude Code log files
 */
export declare function readLogs(): ClaudeCodeLogEntry[];
/**
 * Get Claude Code settings
 */
export declare function getSettings(): Record<string, unknown>;
/**
 * Check if Claude Code is installed
 */
export declare function isClaudeCodeInstalled(): boolean;
/**
 * Get the Claude Code directory path
 */
export declare function getClaudeCodePath(): string;
/**
 * Find MCP servers configured in Claude Code
 */
export declare function findMCPServers(): Array<{
    name: string;
    toolCount: number;
}>;
/**
 * Find memory files (CLAUDE.md) in Claude Code
 */
export declare function findMemoryFiles(): Array<{
    path: string;
    tokens: number;
}>;
/**
 * Auto-detect current context from Claude Code environment
 */
export declare function autoDetectContext(): {
    model: string;
    windowSize: number;
    mcpServers: number;
    memoryFiles: number;
};
//# sourceMappingURL=claude-code.d.ts.map