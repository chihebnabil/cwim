/**
 * Claude Code Integration
 * Reads Claude Code's local files and provides context data to the monitor.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  type ContextSnapshot,
  type ContextBreakdown,
  ContextCategory,
  DegradationRisk,
  type SnapshotMetadata,
  type ClaudeCodeLogEntry,
} from '../types/index.js';
import { TokenEstimator } from '../core/TokenEstimator.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const LOGS_DIR = join(CLAUDE_DIR, 'logs');
const SETTINGS_FILE = join(CLAUDE_DIR, 'settings.json');

/**
 * Parse /context command output from Claude Code
 */
export function parseContextOutput(output: string): {
  model: string;
  usedTokens: number;
  totalWindow: number;
  breakdown: ContextBreakdown[];
} | null {
  try {
    // Parse model and usage line
    // Example: "claude-opus-4-5-20251101 · 51k/200k tokens (26%)"
    const headerMatch = output.match(/([\w-]+)\s+·\s+([\d.k]+)\/([\d.k]+)\s+tokens\s+\(([\d.]+)%\)/);
    if (!headerMatch) return null;

    const model = headerMatch[1];
    const usedTokens = parseTokenCount(headerMatch[2]);
    const totalWindow = parseTokenCount(headerMatch[3]);

    // Parse breakdown lines
    // Example: "  System prompt:     2.6k tokens  (1.3%)"
    const breakdown: ContextBreakdown[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/^\s+([\w\s]+):\s+([\d.k]+)\s+tokens?\s+\(([\d.]+)%\)/);
      if (match) {
        const categoryName = match[1].trim().toLowerCase().replace(/\s+/g, '_');
        const tokens = parseTokenCount(match[2]);
        const percentage = parseFloat(match[3]) / 100;

        const category = mapCategoryName(categoryName);
        if (category) {
          breakdown.push({ category, tokens, percentage });
        }
      }
    }

    return { model, usedTokens, totalWindow, breakdown };
  } catch {
    return null;
  }
}

/**
 * Read Claude Code log files
 */
export function readLogs(): ClaudeCodeLogEntry[] {
  const entries: ClaudeCodeLogEntry[] = [];

  try {
    if (!existsSync(LOGS_DIR)) return entries;

    const files = readdirSync(LOGS_DIR)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => join(LOGS_DIR, f))
      .filter(f => {
        try {
          const stat = statSync(f);
          return stat.isFile() && stat.size > 0;
        } catch {
          return false;
        }
      })
      .sort((a, b) => {
        try {
          return statSync(b).mtime.getTime() - statSync(a).mtime.getTime();
        } catch {
          return 0;
        }
      })
      .slice(0, 5); // Only read 5 most recent log files

    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf-8');
        const lines = content.split('\n').filter(Boolean);
        for (const line of lines.slice(-100)) { // Last 100 entries per file
          try {
            const entry = JSON.parse(line);
            entries.push({
              timestamp: entry.timestamp || new Date().toISOString(),
              type: entry.type || 'request',
              model: entry.model,
              tokens: entry.tokens,
              message: entry.message,
              tool_name: entry.tool_name,
            });
          } catch {
            // Skip invalid lines
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Silently fail if logs can't be read
  }

  return entries;
}

/**
 * Get Claude Code settings
 */
export function getSettings(): Record<string, unknown> {
  try {
    if (existsSync(SETTINGS_FILE)) {
      return JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8'));
    }
  } catch {
    // Use defaults
  }
  return {};
}

/**
 * Check if Claude Code is installed
 */
export function isClaudeCodeInstalled(): boolean {
  return existsSync(CLAUDE_DIR);
}

/**
 * Get the Claude Code directory path
 */
export function getClaudeCodePath(): string {
  return CLAUDE_DIR;
}

/**
 * Find MCP servers configured in Claude Code
 */
export function findMCPServers(): Array<{ name: string; toolCount: number }> {
  const servers: Array<{ name: string; toolCount: number }> = [];

  try {
    const mcpDir = join(CLAUDE_DIR, 'mcp-servers');
    if (!existsSync(mcpDir)) return servers;

    const entries = readdirSync(mcpDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Try to read server config to count tools
        const configPath = join(mcpDir, entry.name, 'config.json');
        let toolCount = 5; // Default estimate
        if (existsSync(configPath)) {
          try {
            const config = JSON.parse(readFileSync(configPath, 'utf-8'));
            if (config.tools && Array.isArray(config.tools)) {
              toolCount = config.tools.length;
            }
          } catch {
            // Use default
          }
        }
        servers.push({ name: entry.name, toolCount });
      }
    }
  } catch {
    // Silently fail
  }

  return servers;
}

/**
 * Find memory files (CLAUDE.md) in Claude Code
 */
export function findMemoryFiles(): Array<{ path: string; tokens: number }> {
  const files: Array<{ path: string; tokens: number }> = [];
  const estimator = new TokenEstimator();

  // Global CLAUDE.md
  const globalClaudeMd = join(CLAUDE_DIR, 'CLAUDE.md');
  if (existsSync(globalClaudeMd)) {
    try {
      const content = readFileSync(globalClaudeMd, 'utf-8');
      files.push({
        path: '~/.claude/CLAUDE.md',
        tokens: estimator.estimate(content, 'markdown'),
      });
    } catch {
      // Skip
    }
  }

  // Project CLAUDE.md (if in a project)
  const projectClaudeMd = join(process.cwd(), 'CLAUDE.md');
  if (existsSync(projectClaudeMd)) {
    try {
      const content = readFileSync(projectClaudeMd, 'utf-8');
      files.push({
        path: './CLAUDE.md',
        tokens: estimator.estimate(content, 'markdown'),
      });
    } catch {
      // Skip
    }
  }

  // Auto-memory files
  try {
    const memoryDir = join(CLAUDE_DIR, 'memory');
    if (existsSync(memoryDir)) {
      const entries = readdirSync(memoryDir)
        .filter(f => f.endsWith('.md') || f.endsWith('.txt'))
        .map(f => join(memoryDir, f));

      for (const file of entries) {
        try {
          const content = readFileSync(file, 'utf-8');
          files.push({
            path: file.replace(CLAUDE_DIR, '~/.claude'),
            tokens: estimator.estimate(content, 'markdown'),
          });
        } catch {
          // Skip
        }
      }
    }
  } catch {
    // Skip
  }

  return files;
}

/**
 * Parse token count string (handles k suffix)
 */
function parseTokenCount(str: string): number {
  const trimmed = str.trim().toLowerCase();
  if (trimmed.endsWith('k')) {
    return Math.floor(parseFloat(trimmed.slice(0, -1)) * 1000);
  }
  if (trimmed.endsWith('m')) {
    return Math.floor(parseFloat(trimmed.slice(0, -1)) * 1000000);
  }
  return parseInt(trimmed, 10) || 0;
}

/**
 * Map category name from /context output to ContextCategory
 */
function mapCategoryName(name: string): ContextCategory | null {
  const mapping: Record<string, ContextCategory> = {
    'system_prompt': ContextCategory.SYSTEM_PROMPT,
    'system_tools': ContextCategory.SYSTEM_TOOLS,
    'mcp_tools': ContextCategory.MCP_TOOLS,
    'custom_agents': ContextCategory.CUSTOM_AGENTS,
    'memory_files': ContextCategory.MEMORY_FILES,
    'skills': ContextCategory.SKILLS,
    'messages': ContextCategory.MESSAGES,
    'free_space': ContextCategory.FREE_SPACE,
    'autocompact_buffer': ContextCategory.AUTOCOMPACT_BUFFER,
  };
  return mapping[name] || null;
}

/**
 * Auto-detect current context from Claude Code environment
 */
export function autoDetectContext(): {
  model: string;
  windowSize: number;
  mcpServers: number;
  memoryFiles: number;
} {
  const settings = getSettings();
  const model = (settings.model as string) || 'claude-sonnet-4-20250514';

  // Determine window size from model
  let windowSize = 200_000;
  if (model.includes('opus-4.7') || model.includes('sonnet-4.6')) {
    windowSize = 1_000_000;
  } else if (model.includes('opus-4') || model.includes('sonnet-4.5')) {
    windowSize = 500_000;
  }

  const mcpServers = findMCPServers().length;
  const memoryFiles = findMemoryFiles().length;

  return { model, windowSize, mcpServers, memoryFiles };
}
