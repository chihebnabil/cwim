/**
 * Claude Code Integration
 * Reads Claude Code's local files and provides context data to the monitor.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import {
  type ContextSnapshot,
  type ContextBreakdown,
  ContextCategory,
  DegradationRisk,
  type SnapshotMetadata,
  type ClaudeCodeLogEntry,
  type ClaudeCodeSession,
  type SessionSummary,
  type SessionPickerOptions,
} from '../types/index.js';
import { TokenEstimator } from '../core/TokenEstimator.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');
const LOGS_DIR = join(CLAUDE_DIR, 'logs');
const SETTINGS_FILE = join(CLAUDE_DIR, 'settings.json');

/** Default session picker options */
const DEFAULT_PICKER_OPTIONS: SessionPickerOptions = {
  recentHours: 24,
  autoSelectIfSingle: true,
  autoSelectCurrentDir: true,
  preferRecent: true,
};

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
 * Find all recent Claude Code sessions
 */
export function findRecentSessions(recentHours: number = 24): ClaudeCodeSession[] {
  const sessions: ClaudeCodeSession[] = [];
  const cutoffTime = new Date(Date.now() - recentHours * 60 * 60 * 1000);

  try {
    if (!existsSync(PROJECTS_DIR)) return sessions;

    const projectDirs = readdirSync(PROJECTS_DIR, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => join(PROJECTS_DIR, entry.name));

    for (const projectDir of projectDirs) {
      try {
        const sessionFiles = readdirSync(projectDir)
          .filter(f => f.endsWith('.jsonl'))
          .map(f => join(projectDir, f));

        for (const sessionFile of sessionFiles) {
          try {
            const session = parseSessionFile(sessionFile);
            if (session && session.lastActivityAt >= cutoffTime) {
              sessions.push(session);
            }
          } catch {
            // Skip invalid session files
          }
        }
      } catch {
        // Skip unreadable project directories
      }
    }
  } catch {
    // Silently fail if projects dir can't be read
  }

  // Sort by most recent activity first
  return sessions.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
}

/**
 * Parse a single session file and extract session information
 */
export function parseSessionFile(filePath: string): ClaudeCodeSession | null {
  try {
    const stat = statSync(filePath);
    if (!stat.isFile() || stat.size === 0) return null;

    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);

    if (lines.length === 0) return null;

    let sessionId = '';
    let model = '';
    let projectPath = '';
    let messageCount = 0;
    let fileReads = 0;
    let toolCalls = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheReadTokens = 0;
    let totalCacheCreationTokens = 0;
    let lastActivityAt = new Date(0);
    let firstActivityAt = new Date();

    // Extract project name from directory
    const projectDir = basename(join(filePath, '..'));
    const projectName = projectDir.replace(/^C--/, '').replace(/--/g, '/');

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const timestamp = entry.timestamp ? new Date(entry.timestamp) : null;

        if (timestamp) {
          if (timestamp > lastActivityAt) lastActivityAt = timestamp;
          if (timestamp < firstActivityAt) firstActivityAt = timestamp;
        }

        // Extract session ID
        if (entry.sessionId && !sessionId) {
          sessionId = entry.sessionId;
        }

        // Extract project path from cwd
        if (entry.cwd && !projectPath) {
          projectPath = entry.cwd;
        }

        // Count messages
        if (entry.type === 'user' || entry.type === 'assistant') {
          messageCount++;
        }

        // Count file reads (file-history-snapshot entries)
        if (entry.type === 'file-history-snapshot') {
          fileReads++;
        }

        // Count tool calls
        if (entry.type === 'assistant' && entry.message?.content) {
          const toolUses = entry.message.content.filter((c: any) => c.type === 'tool_use');
          toolCalls += toolUses.length;
        }

        // Extract model from assistant messages
        if (entry.type === 'assistant' && entry.message?.model && !model) {
          model = entry.message.model;
        }

        // Extract token usage
        if (entry.message?.usage) {
          const usage = entry.message.usage;
          totalInputTokens += usage.input_tokens || 0;
          totalOutputTokens += usage.output_tokens || 0;
          totalCacheReadTokens += usage.cache_read_input_tokens || 0;
          totalCacheCreationTokens += usage.cache_creation_input_tokens || 0;
        }
      } catch {
        // Skip invalid lines
      }
    }

    // Calculate estimated used tokens
    // Include: input tokens + output tokens + cache creation tokens
    // Cache read tokens are not "used" from context window (they're retrieved from cache)
    const estimatedUsedTokens = totalInputTokens + totalOutputTokens + totalCacheCreationTokens;

    // Determine window size from model
    const windowSize = getWindowSizeForModel(model);

    // Calculate utilization
    const utilizationPercent = windowSize > 0 ? estimatedUsedTokens / windowSize : 0;

    // Check if session is still active (activity within last 30 minutes)
    const isActive = (Date.now() - lastActivityAt.getTime()) < 30 * 60 * 1000;

    // Count MCP servers and memory files
    const mcpServers = findMCPServers().length;
    const memoryFiles = findMemoryFiles().length;

    return {
      sessionId: sessionId || basename(filePath, '.jsonl'),
      projectName,
      projectPath: projectPath || projectName,
      sessionFilePath: filePath,
      model: model || 'unknown',
      messageCount,
      fileReads,
      toolCalls,
      totalInputTokens,
      totalOutputTokens,
      totalCacheReadTokens,
      totalCacheCreationTokens,
      estimatedUsedTokens,
      windowSize,
      utilizationPercent,
      mcpServers,
      memoryFiles,
      lastActivityAt,
      firstActivityAt,
      isActive,
    };
  } catch {
    return null;
  }
}

/**
 * Get the current project's session (matching current working directory)
 */
export function getCurrentProjectSession(): ClaudeCodeSession | null {
  const sessions = findRecentSessions(24);
  const cwd = process.cwd();

  // Find exact match first
  let match = sessions.find(s => s.projectPath === cwd);
  if (match) return match;

  // Try partial match (project path contains cwd or vice versa)
  match = sessions.find(s => 
    cwd.includes(s.projectPath) || s.projectPath.includes(cwd)
  );
  if (match) return match;

  return null;
}

/**
 * Get session summaries for picker display
 */
export function getSessionSummaries(sessions: ClaudeCodeSession[]): SessionSummary[] {
  return sessions.map((session, index) => ({
    index: index + 1,
    projectName: session.projectName,
    projectPath: session.projectPath,
    model: session.model,
    messageCount: session.messageCount,
    tokensUsed: session.estimatedUsedTokens,
    windowSize: session.windowSize,
    utilizationPercent: session.utilizationPercent,
    lastActivityAt: session.lastActivityAt,
    riskLevel: calculateRiskLevel(session.utilizationPercent),
  }));
}

/**
 * Select a session based on options
 * Returns null if no sessions found or user cancels
 */
export function selectSession(
  options: Partial<SessionPickerOptions> = {}
): ClaudeCodeSession | null {
  const opts = { ...DEFAULT_PICKER_OPTIONS, ...options };
  const sessions = findRecentSessions(opts.recentHours);

  if (sessions.length === 0) {
    return null;
  }

  // Auto-select if only one session
  if (opts.autoSelectIfSingle && sessions.length === 1) {
    return sessions[0];
  }

  // If preferRecent is true, prioritize most recent session
  if (opts.preferRecent) {
    return sessions[0];
  }

  // Otherwise, auto-select current directory match
  if (opts.autoSelectCurrentDir) {
    const currentSession = getCurrentProjectSession();
    if (currentSession) {
      return currentSession;
    }
  }

  // Fallback to most recent
  return sessions[0];
}

/**
 * Read Claude Code log files (legacy, kept for backward compatibility)
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
 * Get window size for a given model
 * Supports both dash and dot formats: e.g., "sonnet-4-6" and "sonnet-4.6"
 */
function getWindowSizeForModel(model: string): number {
  if (!model || model === 'unknown') return 200_000;
  // Normalize model string to handle both "4-6" and "4.6" formats
  const normalized = model.replace(/-(\d)-(\d)/, '-$1.$2');
  if (normalized.includes('opus-4.7') || normalized.includes('sonnet-4.6')) return 1_000_000;
  if (normalized.includes('opus-4.5') || normalized.includes('sonnet-4.5')) return 500_000;
  if (normalized.includes('opus-4') || normalized.includes('sonnet-4')) return 200_000;
  return 200_000;
}

/**
 * Calculate risk level from utilization percentage
 */
function calculateRiskLevel(utilization: number): DegradationRisk {
  if (utilization >= 0.90) return DegradationRisk.CRITICAL;
  if (utilization >= 0.80) return DegradationRisk.HIGH;
  if (utilization >= 0.65) return DegradationRisk.MEDIUM;
  if (utilization >= 0.50) return DegradationRisk.LOW;
  return DegradationRisk.NONE;
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
 * Re-read a session file to get the latest stats (for live sync)
 */
export function reSyncSession(session: ClaudeCodeSession): ClaudeCodeSession | null {
  if (!session.sessionFilePath || !existsSync(session.sessionFilePath)) {
    return null;
  }
  return parseSessionFile(session.sessionFilePath);
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
  // Try to get from active session first
  const session = selectSession();
  if (session) {
    return {
      model: session.model,
      windowSize: session.windowSize,
      mcpServers: findMCPServers().length,
      memoryFiles: findMemoryFiles().length,
    };
  }

  // Fallback to settings
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
