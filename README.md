# Context Window Intelligence Manager (CWIM)

> Real-time context window monitoring for Claude Code users. Avoid the silent context ceiling with intelligent alerts, predictive warnings, and actionable optimization suggestions.

## The Problem

When using Claude Code, your context window fills up silently. There's no progress bar, no warning bell—just gradual quality degradation until the model starts forgetting files, repeating itself, or producing contradictory code. By the time you notice, you've already lost 30+ minutes to degraded performance.

Research shows context degradation can begin surprisingly early. Chroma's "Context Rot" study found significant degradation at just 25% utilization (~50K/200K tokens), with reasoning quality dropping measurably as utilization grows.

Stanford/Meta's "Lost in the Middle" paper shows that when relevant information sits in the middle of a long context, accuracy can drop 30% or more — meaning even at moderate utilization, the model may miss key details simply because of where they appear.

## The Solution

CWIM gives you:

- **Real-time dashboard** — Live context usage with a visual progress bar, session info, and live indicators
- **Multi-session support** — Interactive session picker when you have multiple Claude Code projects open
- **Predictive alerts** — Warnings before you hit the ceiling, not after
- **Smart suggestions** — Actionable tips like `/compact`, `/clear`, or subagent delegation
- **File analysis** — Know which files cost the most tokens before loading them
- **Health checks** — Audit your project's context efficiency
- **Claude Code skill** — Makes Claude self-aware of its own context usage
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

### `cwim skill` — Claude Code Skill

Install a context-awareness skill that makes Claude monitor its own context window:

```bash
# Install skill in current project
# Creates .claude/skills/context-awareness/SKILL.md
cwim skill install

# Check if skill is installed
cwim skill status

# View skill content
cwim skill show

# Remove skill
cwim skill uninstall
```

**What the skill does:**
- Makes Claude check context before complex multi-step tasks
- Suggests `/compact` proactively when utilization hits 60%+
- Recommends targeted file reads (line ranges) instead of full files
- Proposes subagent delegation when context is tight
- Warns about reading large files when context is already high

**How it works:**
The skill is a Claude Code instruction file that teaches Claude to run `cwim status --json` before expensive operations and adjust its behavior based on current context usage.

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

Core classes are exported for advanced integrations (VS Code extensions, custom dashboards, etc.):

```typescript
import { ContextMonitor, TokenEstimator } from '@cwim/cli';

// Quick token estimate
const tokens = TokenEstimator.quickEstimate('Hello world', 'prose');

// Analyze a file
const analysis = new TokenEstimator().analyzeFile('src/app.ts');
```

See `src/index.ts` for all available exports.

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
| **Available after overhead** | **~146,800** | **73.4%** |

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
- Claude Code (recommended for full session detection, but not required — dashboard works in fallback mode)

## Cross-Platform Support

CWIM works on Windows, macOS, and Linux:
- Auto-detects home directory across all platforms
- Handles path separators correctly
- Reads Claude Code's session files regardless of OS

## License

MIT
