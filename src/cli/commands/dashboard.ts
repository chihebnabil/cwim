/**
 * Real-time Dashboard Command
 * Provides a live-updating terminal dashboard for context window monitoring.
 */

import chalk from 'chalk';
import { readFileSync, existsSync, watch } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import {
  ContextMonitor,
} from '../../core/ContextMonitor.js';
import {
  ContextPredictor,
} from '../../core/ContextPredictor.js';
import {
  TokenEstimator,
} from '../../core/TokenEstimator.js';
import {
  DegradationRisk,
  ContextCategory,
  ClaudeModel,
  ClaudePlan,
  LogLevel,
  CONTEXT_WINDOW_SIZES,
  type CWIMConfig,
  type ContextSnapshot,
  type DashboardTheme,
} from '../../types/index.js';

interface DashboardOptions {
  refreshRateMs: number;
  model: string;
  windowSize: number;
  showBreakdown: boolean;
  showSuggestions: boolean;
  theme: DashboardTheme;
}

// ANSI escape codes
const CLEAR = '\x1Bc';
const HIDE_CURSOR = '\x1B[?25l';
const SHOW_CURSOR = '\x1B[?25h';
const CLEAR_LINE = '\x1B[2K\r';
const MOVE_UP = '\x1B[1A';

export class DashboardCommand {
  private monitor!: ContextMonitor;
  private running = false;
  private theme: Record<string, (s: string) => string> = {};
  private snapshots: ContextSnapshot[] = [];

  async execute(options: DashboardOptions): Promise<void> {
    // Setup theme
    this.setupTheme(options.theme);

    // Setup config
    const config = this.buildConfig(options);

    // Create monitor
    this.monitor = new ContextMonitor(config);

    // Setup event handlers
    this.monitor.on('snapshot', (snapshot: ContextSnapshot) => {
      this.snapshots.push(snapshot);
      if (this.snapshots.length > 100) this.snapshots.shift();
    });

    // Start monitoring
    this.monitor.start(options.refreshRateMs);
    this.running = true;

    // Hide cursor
    process.stdout.write(HIDE_CURSOR);

    // Initial render
    this.render(options);

    // Render loop
    const renderInterval = setInterval(() => {
      if (!this.running) {
        clearInterval(renderInterval);
        return;
      }
      this.render(options);
    }, options.refreshRateMs);

    // Handle exit
    process.on('SIGINT', () => {
      this.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.shutdown();
      process.exit(0);
    });

    // Keep process alive
    await new Promise(() => {});
  }

  private setupTheme(themeName: DashboardTheme): void {
    switch (themeName) {
      case 'light':
        this.theme = {
          header: chalk.black.bgWhite.bold,
          subheader: chalk.gray,
          label: chalk.gray,
          value: chalk.black,
          highlight: chalk.blue.bold,
          success: chalk.green,
          warning: chalk.yellow,
          danger: chalk.red,
          critical: chalk.white.bgRed.bold,
          border: chalk.gray,
          muted: chalk.gray,
          accent: chalk.blue,
        };
        break;
      case 'minimal':
        this.theme = {
          header: chalk.bold,
          subheader: chalk.gray,
          label: chalk.gray,
          value: chalk.white,
          highlight: chalk.white.bold,
          success: chalk.white,
          warning: chalk.white,
          danger: chalk.white,
          critical: chalk.white.bold,
          border: chalk.gray,
          muted: chalk.gray,
          accent: chalk.white,
        };
        break;
      case 'dark':
      default:
        this.theme = {
          header: chalk.white.bgGray.bold,
          subheader: chalk.cyan,
          label: chalk.gray,
          value: chalk.white,
          highlight: chalk.cyan.bold,
          success: chalk.green,
          warning: chalk.yellow,
          danger: chalk.red,
          critical: chalk.white.bgRed.bold,
          border: chalk.gray,
          muted: chalk.gray,
          accent: chalk.cyan,
        };
        break;
    }
  }

  private buildConfig(options: DashboardOptions): CWIMConfig {
    return {
      model: options.model as ClaudeModel,
      plan: ClaudePlan.PRO,
      contextWindowSize: options.windowSize,
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
          sampleWindowMs: 300000,
          minSamples: 5,
        },
        notifications: {
          desktop: false,
          sound: false,
          cliBadge: true,
        },
      },
      dashboardOptions: {
        refreshRateMs: options.refreshRateMs,
        showBreakdown: options.showBreakdown,
        showSuggestions: options.showSuggestions,
        showPredictions: true,
        theme: options.theme,
      },
      projectRoot: process.cwd(),
      claudeCodePath: join(homedir(), '.claude'),
      logLevel: LogLevel.INFO,
    };
  }

  private render(options: DashboardOptions): void {
    const snapshot = this.monitor.getLatestSnapshot();
    if (!snapshot) return;

    const t = this.theme;
    const lines: string[] = [];

    // Header
    lines.push('');
    lines.push(t.header('  CWIM — Context Window Intelligence Manager  '.padEnd(58, ' ')));
    lines.push('');

    // Status bar
    const riskColor = this.getRiskColor(snapshot.degradationRisk);
    const statusText = ` ${this.getRiskIcon(snapshot.degradationRisk)} ${snapshot.degradationRisk.toUpperCase()} `;
    lines.push(`  Status: ${riskColor(statusText.padEnd(12, ' '))}  Model: ${t.accent(snapshot.model)}`);
    lines.push('');

    // Main metrics
    lines.push(t.subheader('  ─── Context Usage ───'));
    lines.push('');

    const used = TokenEstimator.formatTokens(snapshot.usedTokens);
    const total = TokenEstimator.formatTokens(snapshot.totalWindow);
    const free = TokenEstimator.formatTokens(snapshot.freeTokens);
    const pct = snapshot.utilizationPercent;

    // Progress bar
    const barWidth = 40;
    const filled = Math.floor(pct * barWidth);
    const barChar = '█';
    const emptyChar = '░';
    const bar = riskColor(barChar.repeat(filled)) + t.muted(emptyChar.repeat(barWidth - filled));

    lines.push(`  ${t.label('Used:')}  ${t.highlight(used.padStart(8, ' '))} / ${total} ${t.label('tokens')}`);
    lines.push(`  ${t.label('Free:')}  ${t.success(free.padStart(8, ' '))} ${t.label('tokens')}`);
    lines.push(`  ${t.label('Util:')}  ${riskColor(`${(pct * 100).toFixed(1)}%`.padStart(8, ' '))}`);
    lines.push(`  ${bar}`);
    lines.push('');

    // Compact buffer indicator
    const buffer = TokenEstimator.formatTokens(snapshot.autocompactBuffer);
    lines.push(`  ${t.label('Autocompact Buffer:')} ${t.warning(buffer.padStart(8, ' '))} ${t.label('tokens (reserved)')}`);
    lines.push('');

    // Session info
    lines.push(t.subheader('  ─── Session ───'));
    lines.push('');

    const duration = this.formatDuration(snapshot.metadata.sessionDurationMs);
    const rate = this.monitor.getConsumptionRate();

    lines.push(`  ${t.label('Duration:')}     ${t.value(duration)}`);
    lines.push(`  ${t.label('Messages:')}     ${t.value(String(snapshot.metadata.messageCount))}`);
    lines.push(`  ${t.label('File Reads:')}   ${t.value(String(snapshot.metadata.fileReads))}`);
    lines.push(`  ${t.label('Tool Calls:')}    ${t.value(String(snapshot.metadata.toolCalls))}`);
    lines.push(`  ${t.label('MCP Servers:')}  ${t.value(String(snapshot.metadata.mcpServers))}`);
    lines.push(`  ${t.label('Memory Files:')} ${t.value(String(snapshot.metadata.memoryFiles))}`);
    lines.push('');
    lines.push(`  ${t.label('Rate:')}         ${t.accent(`${Math.round(rate.tokensPerMinute)} tokens/min`)}`);
    lines.push(`  ${t.label('Trend:')}        ${this.getTrendDisplay(rate.trend)}`);

    // Est. turns remaining
    if (snapshot.estimatedTurnsRemaining !== null) {
      const turnsColor = snapshot.estimatedTurnsRemaining < 5 ? t.danger :
                        snapshot.estimatedTurnsRemaining < 15 ? t.warning : t.success;
      lines.push(`  ${t.label('Est. Turns:')}   ${turnsColor(`~${snapshot.estimatedTurnsRemaining} remaining`)}`);
    }
    lines.push('');

    // Prediction
    if (this.monitor.getConfig().alertConfig.predictions.enabled) {
      const prediction = this.monitor.getPrediction();
      if (prediction.minutesUntilCritical && prediction.confidence > 0.3) {
        lines.push(t.subheader('  ─── Prediction ───'));
        lines.push('');
        const predColor = prediction.minutesUntilCritical < 5 ? t.critical :
                         prediction.minutesUntilCritical < 15 ? t.danger : t.warning;
        lines.push(`  ${t.label('Critical in:')}  ${predColor(`~${prediction.minutesUntilCritical} minutes`)} ${t.muted(`(confidence: ${(prediction.confidence * 100).toFixed(0)}%)`)}`);
        lines.push('');
      }
    }

    // Breakdown
    if (options.showBreakdown && snapshot.breakdown.length > 0) {
      lines.push(t.subheader('  ─── Breakdown ───'));
      lines.push('');

      const maxLabelLen = Math.max(...snapshot.breakdown.map(b => this.formatCategory(b.category).length));

      for (const item of snapshot.breakdown) {
        const label = this.formatCategory(item.category).padEnd(maxLabelLen, ' ');
        const tokens = TokenEstimator.formatTokens(item.tokens).padStart(8, ' ');
        const percentage = `${(item.percentage * 100).toFixed(1)}%`.padStart(6, ' ');
        const miniBar = this.renderMiniBar(item.percentage, 15);
        lines.push(`  ${t.label(label)} ${tokens} ${t.muted(percentage)} ${miniBar}`);
      }
      lines.push('');
    }

    // Suggestions
    if (options.showSuggestions) {
      const suggestions = this.monitor.getSuggestions().slice(-5);
      if (suggestions.length > 0) {
        lines.push(t.subheader('  ─── Suggestions ───'));
        lines.push('');

        for (const s of suggestions) {
          const priorityColor = s.priority === 'critical' ? t.critical :
                               s.priority === 'high' ? t.danger :
                               s.priority === 'medium' ? t.warning : t.muted;
          lines.push(`  ${priorityColor(`[${s.priority.toUpperCase()}]`)} ${s.title}`);
          lines.push(`  ${t.muted(s.description.substring(0, 56))}`);
          if (s.command) {
            lines.push(`  ${t.accent(`→ ${s.command}`)}`);
          }
          lines.push('');
        }
      }
    }

    // Footer
    lines.push(t.border('  ─'.padEnd(58, '─')));
    lines.push(`  ${t.muted('Press Ctrl+C to exit')}  ${t.muted(`| Refresh: ${options.refreshRateMs}ms`)}`);
    lines.push('');

    // Clear and render
    process.stdout.write(CLEAR);
    process.stdout.write(lines.join('\n'));
  }

  private renderMiniBar(percent: number, width: number): string {
    const filled = Math.max(0, Math.min(width, Math.floor(percent * width)));
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);

    if (percent > 0.9) return this.theme.danger(bar);
    if (percent > 0.7) return this.theme.warning(bar);
    if (percent > 0.5) return this.theme.accent(bar);
    return this.theme.muted(bar);
  }

  private getRiskColor(risk: DegradationRisk) {
    switch (risk) {
      case DegradationRisk.CRITICAL: return this.theme.critical;
      case DegradationRisk.HIGH: return this.theme.danger;
      case DegradationRisk.MEDIUM: return this.theme.warning;
      case DegradationRisk.LOW: return this.theme.accent;
      default: return this.theme.success;
    }
  }

  private getRiskIcon(risk: DegradationRisk): string {
    switch (risk) {
      case DegradationRisk.CRITICAL: return '✗';
      case DegradationRisk.HIGH: return '!';
      case DegradationRisk.MEDIUM: return '◆';
      case DegradationRisk.LOW: return '●';
      default: return '✓';
    }
  }

  private getTrendDisplay(trend: string): string {
    switch (trend) {
      case 'accelerating': return this.theme.danger('▲▲ Accelerating');
      case 'rising': return this.theme.warning('▲ Rising');
      case 'falling': return this.theme.success('▼ Falling');
      default: return this.theme.muted('● Stable');
    }
  }

  private formatCategory(category: ContextCategory): string {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  private shutdown(): void {
    this.running = false;
    this.monitor.stop();
    process.stdout.write(SHOW_CURSOR);
    console.log(chalk.gray('\n\n  CWIM stopped.\n'));
  }
}

// Type augmentation for ContextMonitor
declare module '../../core/ContextMonitor.js' {
  interface ContextMonitor {
    getConfig(): CWIMConfig;
  }
}
