# Context Window Intelligence Manager (CWIM)

> Real-time context window monitoring for Claude Code users. Avoid the silent context ceiling with intelligent alerts, predictive warnings, and actionable optimization suggestions.

## The Problem

When using Claude Code, your context window fills up silently. There's no progress bar, no warning bell—just gradual quality degradation until the model starts forgetting files, repeating itself, or producing contradictory code. By the time you notice, you've already lost 30+ minutes to degraded performance.

Research shows degradation begins at **~73% utilization** (~147K/200K tokens), but most users don't realize until it's too late.

## The Solution

CWIM gives you:

- **Real-time dashboard** — Live context usage with a visual progress bar, session info, and live indicators
- **Multi-session support** — Interactive session picker when you have multiple Claude Code projects open
- **Predictive alerts** — Warnings before you hit the ceiling, not after
- **Smart suggestions** — Actionable tips like `/compact`, `/clear`, or subagent delegation
- **File analysis** — Know which files cost the most tokens before loading them
- **Health checks** — Audit your project's context efficiency
- **Cross-platform** — Works on Windows, macOS, and Linux

## Quick Start

```bash
# Install globally
npm install -g @cwim/cli

# Or run directly with npx
npx @cwim/cli dashboard

# Short command (after global install)
cwim dashboard
```

## Commands

### `cwim dashboard` — Real-time Monitoring

Launch a live-updating terminal dashboard that auto-detects your Claude Code sessions:

```bash
# Default monitoring (auto-detects session)
cwim dashboard

# Custom refresh rate
cwim dashboard --refresh 2000

# Extended context window (1M tokens)
cwim dashboard --window 1000000 --model claude-opus-4.7

# Light theme
cwim dashboard --theme light
```

**Dashboard features:**
- **Session identity** — Project name, path, session ID, live/inactive indicator
- **Session timing** — Duration, last activity timestamp
- **Context utilization** — Visual progress bar with color-coded risk levels
- **Stats** — Messages, file reads, tool calls, MCP servers, memory files
- **Consumption rate** — Tokens per minute, per message, trend direction
- **Predictions** — Minutes until critical/full with confidence score
- **Breakdown** — By category (system, tools, MCPs, messages, free space)
- **Suggestions** — Context-aware optimization tips
- **Other sessions** — See your other active Claude Code sessions

**Keyboard shortcuts:**
- `s` — Switch to a different session
- `r` — Force refresh session data
- `q` — Quit dashboard
- `Ctrl+C` — Quit dashboard

**Session picker:**
When multiple active sessions are found, CWIM shows an interactive list with:
- Project name and path
- Model, message count, utilization %
- Risk level indicator
- Last activity time
- Auto-selects the most recent after 5 seconds

### `cwim check` — Project Health Check

Analyze your project's files and context efficiency:

```bash
# Check current project
cwim check

# Check specific project
cwim check --project ~/my-project

# JSON output
cwim check --json
```

### `cwim status` — Quick Status

Show current context window status with session list:

```bash
# Show all recent sessions
cwim status

# Show sessions from last 48 hours
cwim status --recent 48

# JSON output
cwim status --json
```

### `cwim init` — Initialize Project

Generate a smart `CLAUDE.md` tailored to your project type:

```bash
# Initialize in current directory
cwim init

# Initialize specific project
cwim init --project ~/my-project
```

**Auto-detects project type from files:**
| Detected Files | Type | Template Includes |
|---------------|------|-------------------|
| `package.json` | Node.js | React/Vue/Next.js/Nuxt detection, npm/pnpm/yarn/bun, entry point |
| `requirements.txt` / `pyproject.toml` | Python | Django/Flask/FastAPI, Poetry/Pipenv/uv, pytest |
| `Cargo.toml` | Rust | Main/lib detection, cargo commands |
| `go.mod` | Go | Module path, cmd pattern |
| `Gemfile` | Ruby | Rails/Sinatra, RSpec/Minitest |
| `composer.json` | PHP | Laravel/Symfony, artisan |
| `pom.xml` / `build.gradle` | Java | Maven/Gradle, Spring Boot |
| `*.csproj` / `*.sln` | .NET | dotnet CLI commands |

Creates:
- `CLAUDE.md` — Smart project context file for Claude Code (auto-filled with detected stack)

### `cwim estimate` — Token Estimation

Estimate token counts for files before loading them:

```bash
cwim estimate src/auth.ts src/database.ts
cwim estimate docs/*.md
```

### `cwim config` — Configuration

```bash
# List all settings
cwim config list

# Get a setting
cwim config get thresholds.warning

# Set a setting
cwim config set thresholds.danger 0.75

# Reset to defaults
cwim config reset
```

## Programmatic API

Use CWIM in your own tools:

```typescript
import { ContextMonitor, TokenEstimator } from '@cwim/cli';
import { homedir } from 'os';
import { join } from 'path';

// Create a monitor
const monitor = new ContextMonitor({
  model: 'claude-sonnet-4-20250514',
  plan: 'pro',
  contextWindowSize: 200_000,
  alertConfig: {
    thresholds: {
      warning: 0.50,
      caution: 0.65,
      danger: 0.80,
      critical: 0.90,
    },
    predictions: {
      enabled: true,
      lookAheadMinutes: 10,
      sampleWindowMs: 300_000,
      minSamples: 5,
    },
    notifications: {
      desktop: false,
      sound: false,
      cliBadge: true,
    },
  },
  dashboardOptions: {
    refreshRateMs: 3000,
    showBreakdown: true,
    showSuggestions: true,
    theme: 'dark',
  },
  projectRoot: process.cwd(),
  claudeCodePath: join(homedir(), '.claude'),
  logLevel: 'info',
});

// Listen for events
monitor.on('snapshot', (snapshot) => {
  console.log(`Context: ${(snapshot.utilizationPercent * 100).toFixed(1)}%`);
});

monitor.on('alert', (alert) => {
  console.warn(`Alert: ${alert.message}`);
  console.log(`Action: ${alert.suggestedAction}`);
});

monitor.on('suggestion', (suggestion) => {
  console.log(`Suggestion: ${suggestion.title} - ${suggestion.description}`);
});

// Initialize from a Claude Code session (optional)
monitor.initializeFromSession({
  model: 'claude-sonnet-4-6',
  estimatedUsedTokens: 45000,
  messageCount: 12,
  fileReads: 5,
  toolCalls: 3,
  windowSize: 1_000_000,
});

// Update from /context command output
monitor.updateFromContextCommand(
  'claude-sonnet-4-20250514',
  85_000,
  200_000,
  [
    { category: 'system_prompt', tokens: 2600, percentage: 0.013 },
    { category: 'system_tools', tokens: 17600, percentage: 0.088 },
    { category: 'mcp_tools', tokens: 900, percentage: 0.0045 },
    { category: 'messages', tokens: 64000, percentage: 0.32 },
    { category: 'free_space', tokens: 115000, percentage: 0.575 },
  ]
);

// Start monitoring
monitor.start(3000);

// Add a message
monitor.addMessage('Implement user authentication', 'user');

// Add a file read
monitor.addFileRead('src/auth.ts', '/* 500 lines of auth code */');

// Get latest snapshot
const snapshot = monitor.getLatestSnapshot();
console.log(snapshot.degradationRisk);

// Get prediction
const prediction = monitor.getPrediction();
console.log(`Critical in ~${prediction.minutesUntilCritical} minutes`);

// Stop monitoring
monitor.stop();
```

### Token Estimation

```typescript
import { TokenEstimator } from '@cwim/cli';

// Quick estimate
const tokens = TokenEstimator.quickEstimate('Hello world', 'prose');

// Analyze a file
const estimator = new TokenEstimator();
const analysis = estimator.analyzeFile('src/app.ts');
console.log(`${analysis.path}: ~${analysis.estimatedTokens} tokens`);

// Estimate system components
const systemPrompt = TokenEstimator.estimateSystemPrompt();     // ~2,600
const systemTools = TokenEstimator.estimateSystemTools();       // ~17,600
const mcpServer = TokenEstimator.estimateMCPServer('git', 5);   // ~900
```

### Claude Code Integration

```typescript
import {
  parseContextOutput,
  findMCPServers,
  findMemoryFiles,
  autoDetectContext,
  isClaudeCodeInstalled,
  findRecentSessions,
  selectSession,
  reSyncSession,
} from '@cwim/cli';

// Parse /context command output
const output = `
Context Usage
claude-sonnet-4-20250514 · 51k/200k tokens (26%)

Estimated usage by category
  System prompt:     2.6k tokens  (1.3%)
  System tools:     17.6k tokens  (8.8%)
  MCP tools:          907 tokens  (0.5%)
  Messages:         30.5k tokens (15.3%)
  Free space:        114k        (57.0%)
`;

const parsed = parseContextOutput(output);
console.log(parsed.model, parsed.usedTokens, parsed.totalWindow);

// Find recent sessions
const sessions = findRecentSessions(24); // Last 24 hours
console.log(`${sessions.length} sessions found`);

// Auto-select best session
const session = selectSession({
  recentHours: 24,
  autoSelectIfSingle: true,
  autoSelectCurrentDir: true,
  preferRecent: true,
});

// Re-sync session data (for live updates)
if (session) {
  const refreshed = reSyncSession(session);
  console.log(`Updated tokens: ${refreshed?.estimatedUsedTokens}`);
}

// Find MCP servers
const servers = findMCPServers();
console.log(`${servers.length} MCP servers configured`);

// Find memory files
const memoryFiles = findMemoryFiles();
console.log(`${memoryFiles.length} memory files found`);

// Auto-detect context
const context = autoDetectContext();
console.log(`Model: ${context.model}, Window: ${context.windowSize}`);
```

## How It Works

### Session Detection

CWIM reads Claude Code's local session files (`~/.claude/projects/`) to:
- Auto-discover active sessions across all projects
- Extract real token usage, message counts, and model info
- Sync live data every 10 seconds while dashboard is running
- Support both model naming formats (`claude-sonnet-4-6` and `claude-sonnet-4.6`)

### Token Estimation Engine

CWIM uses a code-aware heuristic that considers:
- **Character ratio** (~3.5 chars/token for code, ~4.0 for prose)
- **Line length patterns** (short lines = better compression)
- **Symbol density** (code symbols compress well)
- **Indentation patterns** (repeated whitespace compresses)
- **Content-type specific adjustments** (JSON, XML, Markdown)

### Predictive Alerts

Using linear regression on your consumption history, CWIM predicts:
- When you'll hit the 80% critical threshold
- When context will be full
- Confidence level based on data quality

### Smart Suggestions

Based on your current state, CWIM suggests:
- **/compact** — When you have many messages
- **/clear** — When context is nearly full
- **Subagent delegation** — For isolated tasks
- **MCP server audit** — When MCPs consume too much
- **File read optimization** — When reading many files

## Context Budget Reference

For a standard 200K context window:

| Component | Tokens | % of Window |
|-----------|--------|-------------|
| System prompt | ~2,600 | 1.3% |
| System tools | ~17,600 | 8.8% |
| Autocompact buffer | ~33,000 | 16.5% |
| **Available for work** | **~146,800** | **73.4%** |

Each MCP server adds ~800-1200 tokens. Each memory file (CLAUDE.md) adds its content size. The autocompact buffer is reserved for automatic compaction.

## Configuration

CWIM reads configuration from:

1. `~/.config/cwim/config.json` — Global user config
2. CLI flags — Highest priority

### Default Config

```json
{
  "model": "claude-sonnet-4-20250514",
  "plan": "pro",
  "contextWindowSize": 200000,
  "thresholds": {
    "warning": 0.50,
    "caution": 0.65,
    "danger": 0.80,
    "critical": 0.90
  },
  "predictions": {
    "enabled": true,
    "lookAheadMinutes": 10,
    "sampleWindowMs": 300000,
    "minSamples": 5
  },
  "dashboard": {
    "refreshRateMs": 3000,
    "theme": "dark"
  }
}
```

## Claude Code Best Practices

CWIM helps you implement these context management strategies:

1. **One task, one context** — Use `/clear` between unrelated tasks
2. **Compact strategically** — Use `/compact` when transitioning between phases
3. **Delegate to subagents** — Spawn subagents for isolated, file-heavy tasks
4. **Audit MCP servers** — Disable unused MCPs with `/mcp`
5. **Read files strategically** — Use line ranges instead of full files
6. **Optimize CLAUDE.md** — Keep project docs concise and token-efficient

## Supported Models & Context Windows

| Model | Context Window |
|-------|---------------|
| Claude 3.5 Sonnet/Opus | 200K |
| Claude 4 Sonnet | 200K |
| Claude 4 Opus | 500K |
| Claude 4.5 Sonnet | 500K |
| Claude 4.6 Sonnet (with credits) | 1M |
| Claude 4.7 Opus (with credits) | 1M |

## Requirements

- Node.js 18+
- Claude Code (optional, for integration features)

## Cross-Platform Support

CWIM works on Windows, macOS, and Linux:
- Auto-detects home directory across all platforms
- Handles path separators correctly
- Reads Claude Code's session files regardless of OS

## License

MIT
