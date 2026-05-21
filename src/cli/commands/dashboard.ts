/**
 * Dashboard Command - Real-time context monitoring dashboard
 */

import chalk from 'chalk';
import { ContextMonitor } from '../../core/ContextMonitor.js';
import { TokenEstimator } from '../../core/TokenEstimator.js';
import {
  DegradationRisk,
  DashboardTheme,
  type DashboardOptions,
  type ContextSnapshot,
  type CWIMConfig,
} from '../../types/index.js';
import {
  findRecentSessions,
  selectSession,
  isClaudeCodeInstalled,
  autoDetectContext,
} from '../../integrations/claude-code.js';

interface DashboardCommandOptions {
  refreshRateMs: number;
  model: string;
  windowSize: number;
  showBreakdown: boolean;
  showSuggestions: boolean;
  theme: string;
}

export class DashboardCommand {
  private monitor: ContextMonitor | null = null;
  private isRunning = false;
  private refreshInterval: NodeJS.Timeout | null = null;

  async execute(options: DashboardCommandOptions): Promise<void> {
    // Check if Claude Code is installed
    if (!isClaudeCodeInstalled()) {
      console.log(chalk.yellow('\n  Claude Code is not installed or not initialized.'));
      console.log(chalk.gray('  Install Claude Code to use CWIM context monitoring.\n'));
      return;
    }

    // Show progress indicator
    console.log(chalk.cyan('\n  Scanning for Claude Code sessions...'));

    // Find and auto-select session
    const session = selectSession({
      recentHours: 24,
      autoSelectIfSingle: true,
      autoSelectCurrentDir: true,
      preferRecent: true,
    });

    if (!session) {
      console.log(chalk.yellow('\n  No active Claude Code sessions found (last 24h).'));
      console.log(chalk.gray('  Start a Claude Code session to monitor context usage.\n'));
      return;
    }

    // Auto-detect context if available
    const detectedContext = autoDetectContext();
    const model = detectedContext.model || options.model;
    const windowSize = detectedContext.windowSize || options.windowSize;

    console.log(chalk.green(`  Found session: ${session.projectName}`));
    console.log(chalk.gray(`  Model: ${model} | Window: ${TokenEstimator.formatTokens(windowSize)} tokens\n`));

    // Initialize monitor
    const config: CWIMConfig = {
      model: model as any,
      plan: 'pro' as any,
      contextWindowSize: windowSize,
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
        refreshRateMs: options.refreshRateMs,
        showBreakdown: options.showBreakdown,
        showSuggestions: options.showSuggestions,
        showPredictions: true,
        theme: options.theme as DashboardTheme,
      },
      projectRoot: session.projectPath,
      claudeCodePath: `${process.env.HOME}/.claude`,
      logLevel: 'info' as any,
    };

    this.monitor = new ContextMonitor(config);

    // Set up event listeners
    this.monitor.on('snapshot', (snapshot) => {
      this.renderDashboard(snapshot, options);
    });

    this.monitor.on('alert', (alert) => {
      this.renderAlert(alert);
    });

    this.monitor.on('suggestion', (suggestion) => {
      this.renderSuggestion(suggestion);
    });

    // Start monitoring
    this.isRunning = true;
    this.monitor.start(options.refreshRateMs);

    // Initial render
    const initialSnapshot = this.monitor.getLatestSnapshot();
    if (initialSnapshot) {
      this.renderDashboard(initialSnapshot, options);
    }

    // Set up refresh interval for UI updates
    this.refreshInterval = setInterval(() => {
      if (this.monitor && this.isRunning) {
        const snapshot = this.monitor.getLatestSnapshot();
        if (snapshot) {
          this.renderDashboard(snapshot, options);
        }
      }
    }, options.refreshRateMs);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      this.shutdown();
    });

    process.on('SIGTERM', () => {
      this.shutdown();
    });

    // Keep process alive
    console.log(chalk.gray(`\n  Press Ctrl+C to exit\n`));
    await new Promise(() => {}); // Keep running indefinitely
  }

  private renderDashboard(snapshot: ContextSnapshot, options: DashboardCommandOptions): void {
    // Clear screen (ANSI escape sequence)
    process.stdout.write('\x1Bc');

    const t = this.getThemeColors(options.theme);

    // Header
    console.log(chalk.bold.cyan('  Context Window Intelligence Manager - Dashboard'));
    console.log();

    // Model info
    console.log(`  ${t.label('Model:')}         ${t.value(snapshot.model)}`);
    console.log(`  ${t.label('Window Size:')}   ${t.highlight(TokenEstimator.formatTokens(snapshot.totalWindow))}`);
    console.log(`  ${t.label('Used:')}          ${t.value(TokenEstimator.formatTokens(snapshot.usedTokens))}`);
    console.log(`  ${t.label('Free:')}          ${t.success(TokenEstimator.formatTokens(snapshot.freeTokens))}`);

    // Utilization bar
    const barWidth = 40;
    const filled = Math.floor(snapshot.utilizationPercent * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
    const barColor = snapshot.utilizationPercent > 0.9 ? t.critical :
                    snapshot.utilizationPercent > 0.7 ? t.danger :
                    snapshot.utilizationPercent > 0.5 ? t.warning : t.success;
    console.log(`  ${t.label('Utilization:')}  ${barColor(bar)} ${barColor(`${(snapshot.utilizationPercent * 100).toFixed(1)}%`)}`);

    // Risk level
    const riskColor = snapshot.degradationRisk === DegradationRisk.CRITICAL ? t.critical :
                     snapshot.degradationRisk === DegradationRisk.HIGH ? t.danger :
                     snapshot.degradationRisk === DegradationRisk.MEDIUM ? t.warning :
                     snapshot.degradationRisk === DegradationRisk.LOW ? t.muted : t.success;
    console.log(`  ${t.label('Risk:')}          ${riskColor(snapshot.degradationRisk.toUpperCase())}`);

    // Estimated turns remaining
    if (snapshot.estimatedTurnsRemaining !== null) {
      const turnsColor = snapshot.estimatedTurnsRemaining < 5 ? t.danger :
                        snapshot.estimatedTurnsRemaining < 10 ? t.warning : t.success;
      console.log(`  ${t.label('Est. Turns:')}   ${turnsColor(`${snapshot.estimatedTurnsRemaining} remaining`)}`);
    }
    console.log();

    // Session details
    console.log(t.label('  --- Session Details ---'));
    console.log(`  ${t.label('Messages:')}      ${t.value(String(snapshot.metadata.messageCount))}`);
    console.log(`  ${t.label('File Reads:')}    ${t.value(String(snapshot.metadata.fileReads))}`);
    console.log(`  ${t.label('Tool Calls:')}    ${t.value(String(snapshot.metadata.toolCalls))}`);
    console.log(`  ${t.label('MCP Servers:')}   ${t.value(String(snapshot.metadata.mcpServers))}`);
    console.log(`  ${t.label('Memory Files:')}  ${t.value(String(snapshot.metadata.memoryFiles))}`);
    console.log();

    // Breakdown
    if (options.showBreakdown && snapshot.breakdown.length > 0) {
      console.log(t.label('  --- Context Breakdown ---'));
      const maxCatLen = Math.max(...snapshot.breakdown.map(b => b.category.length));
      for (const item of snapshot.breakdown) {
        const label = item.category.padEnd(maxCatLen, ' ');
        const tokens = TokenEstimator.formatTokens(item.tokens).padStart(8, ' ');
        const pct = `${(item.percentage * 100).toFixed(1)}%`.padStart(6, ' ');
        console.log(`  ${t.muted(label)} ${tokens} tokens ${pct}`);
      }
      console.log();
    }

    // Consumption rate
    if (this.monitor) {
      const rate = this.monitor.getConsumptionRate();
      console.log(t.label('  --- Consumption Rate ---'));
      console.log(`  ${t.label('Rate:')}          ${t.value(`${rate.tokensPerMinute.toFixed(1)} tokens/min`)}`);
      console.log(`  ${t.label('Per Message:')}   ${t.value(`${rate.tokensPerMessage.toFixed(0)} tokens/msg`)}`);
      console.log(`  ${t.label('Trend:')}         ${t.value(rate.trend)}`);
      console.log();
    }

    // Predictions
    if (options.showSuggestions && this.monitor) {
      const prediction = this.monitor.getPrediction();
      if (prediction.minutesUntilCritical !== null) {
        console.log(t.label('  --- Predictions ---'));
        const predColor = prediction.minutesUntilCritical < 10 ? t.danger :
                         prediction.minutesUntilCritical < 30 ? t.warning : t.success;
        console.log(`  ${t.label('Critical in:')}   ${predColor(`~${Math.ceil(prediction.minutesUntilCritical)} minutes`)}`);
        if (prediction.minutesUntilFull !== null) {
          console.log(`  ${t.label('Full in:')}       ${predColor(`~${Math.ceil(prediction.minutesUntilFull)} minutes`)}`);
        }
        console.log(`  ${t.label('Confidence:')}   ${t.value(`${(prediction.confidence * 100).toFixed(0)}%`)}`);
        console.log();
      }
    }

    // Suggestions
    if (options.showSuggestions && this.monitor) {
      const suggestions = this.monitor.getSuggestions().slice(-3);
      if (suggestions.length > 0) {
        console.log(t.label('  --- Suggestions ---'));
        for (const suggestion of suggestions) {
          const priorityColor = suggestion.priority === 'critical' ? t.critical :
                               suggestion.priority === 'high' ? t.danger :
                               suggestion.priority === 'medium' ? t.warning : t.muted;
          console.log(`  ${priorityColor(`[${suggestion.priority.toUpperCase()}]`)} ${suggestion.title}`);
          console.log(`    ${t.muted(suggestion.description)}`);
          if (suggestion.command) {
            console.log(`    ${t.highlight(`> ${suggestion.command}`)}`);
          }
          console.log();
        }
      }
    }

    // Footer
    console.log(t.muted(`  Last updated: ${new Date().toLocaleTimeString()}`));
    console.log(t.muted(`  Refresh: ${options.refreshRateMs}ms | Press Ctrl+C to exit`));
    console.log();
  }

  private renderAlert(alert: any): void {
    const color = alert.level === DegradationRisk.CRITICAL ? chalk.white.bgRed.bold :
                 alert.level === DegradationRisk.HIGH ? chalk.red :
                 alert.level === DegradationRisk.MEDIUM ? chalk.yellow : chalk.cyan;
    console.log(color(`\n  ALERT: ${alert.message}`));
    console.log(chalk.gray(`  Action: ${alert.suggestedAction}\n`));
  }

  private renderSuggestion(suggestion: any): void {
    console.log(chalk.cyan(`\n  Suggestion: ${suggestion.title}`));
    console.log(chalk.gray(`  ${suggestion.description}`));
    if (suggestion.command) {
      console.log(chalk.yellow(`  > ${suggestion.command}`));
    }
    console.log();
  }

  private getThemeColors(theme: string) {
    switch (theme) {
      case 'light':
        return {
          label: chalk.gray,
          value: chalk.black,
          highlight: chalk.blue.bold,
          success: chalk.green,
          warning: chalk.yellow,
          danger: chalk.red,
          critical: chalk.white.bgRed.bold,
          muted: chalk.gray,
        };
      case 'minimal':
        return {
          label: (s: string) => s,
          value: (s: string) => s,
          highlight: (s: string) => s,
          success: (s: string) => s,
          warning: (s: string) => s,
          danger: (s: string) => s,
          critical: (s: string) => s,
          muted: (s: string) => s,
        };
      default: // dark
        return {
          label: chalk.gray,
          value: chalk.white,
          highlight: chalk.cyan.bold,
          success: chalk.green,
          warning: chalk.yellow,
          danger: chalk.red,
          critical: chalk.white.bgRed.bold,
          muted: chalk.gray,
        };
    }
  }

  private shutdown(): void {
    this.isRunning = false;
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    if (this.monitor) {
      this.monitor.stop();
      this.monitor = null;
    }
    console.log(chalk.yellow('\n  Dashboard stopped.\n'));
    process.exit(0);
  }
}
