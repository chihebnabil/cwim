/**
 * Token Estimation Engine
 * Provides multiple methods for estimating token counts from text, files, and code.
 * Uses character ratios, word ratios, and code-aware heuristics.
 */
import { type TokenEstimateOptions, type FileTokenAnalysis, FileCategory } from '../types/index.js';
export declare class TokenEstimator {
    private options;
    constructor(options?: Partial<TokenEstimateOptions>);
    /**
     * Estimate tokens for a plain text string
     */
    estimate(text: string, contentType?: 'code' | 'prose' | 'markdown' | 'json' | 'xml'): number;
    /**
     * Estimate tokens using character-to-token ratio
     * ~4 chars per token for English text, ~3.5 for code
     */
    private estimateByCharRatio;
    /**
     * Estimate tokens using word-to-token ratio
     * ~0.75 words per token on average
     */
    private estimateByWordRatio;
    /**
     * Code-aware heuristic estimation
     * Adjusts ratios based on content characteristics
     */
    private estimateByHeuristic;
    /**
     * Analyze a file and estimate its token count
     */
    analyzeFile(filePath: string): FileTokenAnalysis;
    /**
     * Estimate tokens for multiple files
     */
    analyzeFiles(filePaths: string[]): FileTokenAnalysis[];
    /**
     * Quick estimate for a string (static method for convenience)
     */
    static quickEstimate(text: string, contentType?: 'code' | 'prose' | 'markdown' | 'json' | 'xml'): number;
    /**
     * Estimate system prompt tokens (Claude Code default ~2.6K)
     */
    static estimateSystemPrompt(): number;
    /**
     * Estimate system tools tokens (Claude Code default ~17.6K)
     */
    static estimateSystemTools(): number;
    /**
     * Estimate per MCP server tokens (~800-1200 each)
     */
    static estimateMCPServer(serverName: string, toolCount?: number): number;
    /**
     * Estimate memory file tokens
     */
    static estimateMemoryFile(content: string): number;
    /**
     * Get content type from file extension
     */
    private getContentType;
    /**
     * Get file category from extension
     */
    static getFileCategory(filePath: string): FileCategory;
    /**
     * Format token count for human readability
     */
    static formatTokens(tokens: number): string;
    /**
     * Format percentage for display
     */
    static formatPercent(value: number): string;
}
//# sourceMappingURL=TokenEstimator.d.ts.map