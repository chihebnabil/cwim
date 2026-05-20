/**
 * Token Estimation Engine
 * Provides multiple methods for estimating token counts from text, files, and code.
 * Uses character ratios, word ratios, and code-aware heuristics.
 */

import { TokenEstimateMethod, type TokenEstimateOptions, type FileTokenAnalysis, FileCategory } from '../types/index.js';
import { readFileSync, statSync } from 'fs';
import { extname, basename } from 'path';

/** Average characters per token for different content types */
const CHARS_PER_TOKEN = {
  code: 3.5,
  prose: 4.0,
  markdown: 3.8,
  json: 2.8,
  xml: 3.0,
  default: 3.8,
} as const;

/** Average words per token */
const WORDS_PER_TOKEN = 0.75;

/** File extensions by category */
const EXTENSION_CATEGORIES: Record<string, FileCategory> = {
  // Source code
  '.ts': FileCategory.SOURCE_CODE,
  '.tsx': FileCategory.SOURCE_CODE,
  '.js': FileCategory.SOURCE_CODE,
  '.jsx': FileCategory.SOURCE_CODE,
  '.py': FileCategory.SOURCE_CODE,
  '.rs': FileCategory.SOURCE_CODE,
  '.go': FileCategory.SOURCE_CODE,
  '.java': FileCategory.SOURCE_CODE,
  '.cpp': FileCategory.SOURCE_CODE,
  '.c': FileCategory.SOURCE_CODE,
  '.h': FileCategory.SOURCE_CODE,
  '.swift': FileCategory.SOURCE_CODE,
  '.kt': FileCategory.SOURCE_CODE,
  '.rb': FileCategory.SOURCE_CODE,
  '.php': FileCategory.SOURCE_CODE,
  '.cs': FileCategory.SOURCE_CODE,
  // Documentation
  '.md': FileCategory.DOCUMENTATION,
  '.mdx': FileCategory.DOCUMENTATION,
  '.txt': FileCategory.DOCUMENTATION,
  '.rst': FileCategory.DOCUMENTATION,
  // Config
  '.json': FileCategory.CONFIG,
  '.yaml': FileCategory.CONFIG,
  '.yml': FileCategory.CONFIG,
  '.toml': FileCategory.CONFIG,
  '.ini': FileCategory.CONFIG,
  '.conf': FileCategory.CONFIG,
  '.env': FileCategory.CONFIG,
  // Data
  '.csv': FileCategory.DATA,
  '.sql': FileCategory.DATA,
  '.log': FileCategory.DATA,
};

/** Binary file extensions to skip */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.ico', '.webp',
  '.mp4', '.avi', '.mov', '.mkv', '.webm',
  '.mp3', '.wav', '.ogg', '.flac', '.aac',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.lock', '.sum',
]);

export class TokenEstimator {
  private options: TokenEstimateOptions;

  constructor(options: Partial<TokenEstimateOptions> = {}) {
    this.options = {
      method: TokenEstimateMethod.HEURISTIC,
      includeWhitespace: true,
      ...options,
    };
  }

  /**
   * Estimate tokens for a plain text string
   */
  estimate(text: string, contentType: 'code' | 'prose' | 'markdown' | 'json' | 'xml' = 'prose'): number {
    switch (this.options.method) {
      case TokenEstimateMethod.CHAR_RATIO:
        return this.estimateByCharRatio(text, contentType);
      case TokenEstimateMethod.WORD_RATIO:
        return this.estimateByWordRatio(text);
      case TokenEstimateMethod.HEURISTIC:
        return this.estimateByHeuristic(text, contentType);
      default:
        return this.estimateByHeuristic(text, contentType);
    }
  }

  /**
   * Estimate tokens using character-to-token ratio
   * ~4 chars per token for English text, ~3.5 for code
   */
  private estimateByCharRatio(text: string, contentType: keyof typeof CHARS_PER_TOKEN = 'default'): number {
    const cleanText = this.options.includeWhitespace ? text : text.replace(/\s+/g, ' ');
    const ratio = CHARS_PER_TOKEN[contentType] ?? CHARS_PER_TOKEN.default;
    return Math.ceil(cleanText.length / ratio);
  }

  /**
   * Estimate tokens using word-to-token ratio
   * ~0.75 words per token on average
   */
  private estimateByWordRatio(text: string): number {
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    return Math.ceil(words.length / WORDS_PER_TOKEN);
  }

  /**
   * Code-aware heuristic estimation
   * Adjusts ratios based on content characteristics
   */
  private estimateByHeuristic(text: string, contentType: keyof typeof CHARS_PER_TOKEN = 'default'): number {
    const charEstimate = this.estimateByCharRatio(text, contentType);
    const wordEstimate = this.estimateByWordRatio(text);

    // Adjust for code-specific patterns
    let adjustment = 1.0;
    const lines = text.split('\n');
    const avgLineLength = text.length / lines.length;

    // Short lines typical of code (many single-token lines like '}', 'return;')
    if (avgLineLength < 40) {
      adjustment *= 0.92;
    }

    // High symbol density typical of code
    const symbolDensity = (text.match(/[^\w\s]/g) || []).length / text.length;
    if (symbolDensity > 0.15) {
      adjustment *= 0.88;
    }

    // Lots of indentation = repeated whitespace patterns compress well
    const indentedLines = lines.filter(l => l.startsWith(' ') || l.startsWith('\t')).length;
    if (indentedLines / lines.length > 0.6) {
      adjustment *= 0.94;
    }

    // Long repeated strings compress well
    const uniqueWords = new Set(text.split(/\s+/));
    const repetitionRatio = uniqueWords.size / text.split(/\s+/).length;
    if (repetitionRatio < 0.3) {
      adjustment *= 0.9;
    }

    // For JSON: very predictable structure
    if (contentType === 'json') {
      adjustment *= 0.82;
    }

    // For XML/HTML: lots of repeated tags
    if (contentType === 'xml') {
      adjustment *= 0.85;
    }

    const adjusted = Math.round(charEstimate * adjustment);
    // Blend with word estimate for stability
    return Math.ceil((adjusted * 0.7) + (wordEstimate * 0.3));
  }

  /**
   * Analyze a file and estimate its token count
   */
  analyzeFile(filePath: string): FileTokenAnalysis {
    try {
      const stats = statSync(filePath);
      const ext = extname(filePath).toLowerCase();

      // Binary files
      if (BINARY_EXTENSIONS.has(ext) || stats.size > 10 * 1024 * 1024) {
        return {
          path: filePath,
          size: stats.size,
          estimatedTokens: 0,
          category: FileCategory.BINARY,
        };
      }

      const content = readFileSync(filePath, 'utf-8');
      const contentType = this.getContentType(ext);
      const tokens = this.estimate(content, contentType);
      const category = EXTENSION_CATEGORIES[ext] ?? FileCategory.SOURCE_CODE;

      return {
        path: filePath,
        size: stats.size,
        estimatedTokens: tokens,
        category,
      };
    } catch {
      return {
        path: filePath,
        size: 0,
        estimatedTokens: 0,
        category: FileCategory.IGNORED,
      };
    }
  }

  /**
   * Estimate tokens for multiple files
   */
  analyzeFiles(filePaths: string[]): FileTokenAnalysis[] {
    return filePaths.map(path => this.analyzeFile(path));
  }

  /**
   * Quick estimate for a string (static method for convenience)
   */
  static quickEstimate(text: string, contentType: 'code' | 'prose' | 'markdown' | 'json' | 'xml' = 'prose'): number {
    const estimator = new TokenEstimator();
    return estimator.estimate(text, contentType);
  }

  /**
   * Estimate system prompt tokens (Claude Code default ~2.6K)
   */
  static estimateSystemPrompt(): number {
    return 2_600;
  }

  /**
   * Estimate system tools tokens (Claude Code default ~17.6K)
   */
  static estimateSystemTools(): number {
    return 17_600;
  }

  /**
   * Estimate per MCP server tokens (~800-1200 each)
   */
  static estimateMCPServer(serverName: string, toolCount: number = 5): number {
    const base = 400;
    const perTool = 100;
    return base + (toolCount * perTool);
  }

  /**
   * Estimate memory file tokens
   */
  static estimateMemoryFile(content: string): number {
    const estimator = new TokenEstimator();
    return estimator.estimate(content, 'markdown');
  }

  /**
   * Get content type from file extension
   */
  private getContentType(ext: string): 'code' | 'prose' | 'markdown' | 'json' | 'xml' {
    if (ext === '.md' || ext === '.mdx') return 'markdown';
    if (ext === '.json') return 'json';
    if (ext === '.xml' || ext === '.html' || ext === '.htm' || ext === '.svg') return 'xml';
    if (ext === '.txt' || ext === '.rst') return 'prose';
    return 'code';
  }

  /**
   * Get file category from extension
   */
  static getFileCategory(filePath: string): FileCategory {
    const ext = extname(filePath).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) return FileCategory.BINARY;
    return EXTENSION_CATEGORIES[ext] ?? FileCategory.SOURCE_CODE;
  }

  /**
   * Format token count for human readability
   */
  static formatTokens(tokens: number): string {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
    return `${tokens}`;
  }

  /**
   * Format percentage for display
   */
  static formatPercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }
}
