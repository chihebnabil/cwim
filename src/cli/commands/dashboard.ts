/**
 * Dashboard Command - Real-time context monitoring dashboard
 */

import chalk from 'chalk';
import { homedir } from 'os';
import { join, basename } from 'path';
import { createInterface } from 'readline';
import { ContextMonitor } from '../../core/ContextMonitor.js';
import { TokenEstimator } from '../../core/TokenEstimator.js';
import {
  DegradationRisk,
  DashboardTheme,
  type DashboardOptions,
  type ContextSnapshot,
  type CWIMConfig,
  type ClaudeCodeSession,
} from '../../types/index.js';
import {
  findRecentSessions,
  selectSession,
  isClaudeCodeInstalled,
  autoDetectContext,
  reSyncSession,
  getSessionSummaries,
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
  private sessionSyncInterval: NodeJS.Timeout | null = null;
  private activeSession: ClaudeCodeSession | null = null;
  private allSessions: ClaudeCodeSession[] = [];
  private sessionStartTime: Date = new Date();
  private options: DashboardCommandOptions | null = null;
  private rl: ReturnType<typeof createInterface> | null = null;

  async execute(options: DashboardCommandOptions): Promise<void> {
    this.options = options;

    // Check if Claude Code is installed
    if (!isClaudeCodeInstalled()) {
      console.log(chalk.yellow('\n  Claude Code is not installed or not initialized.'));
      console.log(chalk.gray('  Install Claude Code to use CWIM context monitoring.\n'));
      return;
    }

    // Find all recent sessions
    console.log(chalk.cyan('\n  Scanning for Claude Code sessions...'));
    this.allSessions = findRecentSessions(24);

    let session: ClaudeCodeSession | null = null;

    if (this.allSessions.length === 0) {
      // Fallback mode: run with manual defaults
      console.log(chalk.yellow('\n  No active Claude Code sessions found (last 24h).'));
      console.log(chalk.gray('  Running in fallback mode with manual defaults.\n'));
      await this.startWithSession(null, options);
      return;
    }

    // If multiple sessions, let user pick
    if (this.allSessions.length > 1) {
      session = await this.promptSessionSelection(this.allSessions);
    } else {
      // Single session - auto-select but show clearly
      session = this.allSessions[0];
      console.log(chalk.green(`\n  Auto-selected session: ${session.projectName}`));
      console.log(chalk.gray(`  Path: ${session.projectPath}`));
      console.log(chalk.gray(`  Model: ${session.model} | Messages: ${session.messageCount}`));
      console.log();
    }

    if (!session) {
      console.log(chalk.yellow('\n  No session selected. Exiting.\n'));
      return;
    }

    await this.startWithSession(session, options);
  }

  /**
   * Prompt user to select a session when multiple are found
   */
  private async promptSessionSelection(sessions: ClaudeCodeSession[]): Promise<ClaudeCodeSession | null> {
    console.log(chalk.cyan(`\n  Found ${sessions.length} active sessions:\n`));

    const summaries = getSessionSummaries(sessions);

    for (const summary of summaries) {
      const riskIcon = this.getRiskIcon(summary.riskLevel);
      const riskColor = this.getRiskColor(summary.riskLevel);
      const activeIndicator = sessions[summary.index - 1].isActive
        ? chalk.green('●')
        : chalk.gray('○');

      console.log(`  ${chalk.cyan(`[${summary.index}]`)} ${activeIndicator} ${chalk.bold.white(summary.projectName)}`);
      console.log(`      ${chalk.gray(summary.projectPath)}`);
      console.log(`      ${chalk.gray('Model:')} ${summary.model} ${chalk.gray('|')} ${summary.messageCount} msgs ${chalk.gray('|')} ${TokenEstimator.formatTokens(summary.tokensUsed)}/${TokenEstimator.formatTokens(summary.windowSize)} ${riskColor(`${riskIcon} ${(summary.utilizationPercent * 100).toFixed(1)}%`)}`);
      console.log(`      ${chalk.gray('Last activity:')} ${this.formatTimeAgo(summary.lastActivityAt)}`);
      console.log();
    }

    // Auto-select most recent after 5 seconds if no input
    console.log(chalk.gray('  Press a number to select, or wait 5s for auto-select [1]...'));

    return new Promise((resolve) => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const timer = setTimeout(() => {
        rl.close();
        console.log(chalk.gray('  Auto-selecting [1]...\n'));
        resolve(sessions[0]);
      }, 5000);

      rl.question('', (answer) => {
        clearTimeout(timer);
        rl.close();

        const choice = parseInt(answer.trim(), 10);
        if (isNaN(choice) || choice < 1 || choice > sessions.length) {
          console.log(chalk.gray('  Invalid choice. Auto-selecting [1]...\n'));
          resolve(sessions[0]);
        } else {
          console.log(chalk.green(`  Selected: ${sessions[choice - 1].projectName}\n`));
          resolve(sessions[choice - 1]);
        }
      });
    });
  }

  /**
   * Start monitoring with the selected session
   */
  private async startWithSession(session: ClaudeCodeSession | null, options: DashboardCommandOptions): Promise<void> {
    let model: string;
    let windowSize: number;
    let projectPath: string;

    if (session) {
      this.activeSession = session;
      this.sessionStartTime = session.firstActivityAt;
      const detectedContext = autoDetectContext();
      model = detectedContext.model || options.model;
      windowSize = detectedContext.windowSize || options.windowSize;
      projectPath = session.projectPath;
    } else {
      const detectedContext = autoDetectContext();
      model = detectedContext.model || options.model;
      windowSize = detectedContext.windowSize || options.windowSize;
      projectPath = process.cwd();
    }

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
      projectRoot: projectPath,
      claudeCodePath: join(homedir(), '.claude'),
      logLevel: 'info' as any,
    };

    this.monitor = new ContextMonitor(config);

    // Seed monitor with session data if available
    if (session) {
      this.monitor.initializeFromSession({
        model: session.model,
        estimatedUsedTokens: session.estimatedUsedTokens,
        messageCount: session.messageCount,
        fileReads: session.fileReads,
        toolCalls: session.toolCalls,
        windowSize: session.windowSize,
      });
    }

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

    // Set up live session re-sync (every 10 seconds)
    if (this.activeSession) {
      this.sessionSyncInterval = setInterval(() => {
        this.syncSessionData();
      }, 10_000);
    }

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

    // Set up keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      this.shutdown();
    });

    process.on('SIGTERM', () => {
      this.shutdown();
    });

    // Keep process alive
    await new Promise(() => {});
  }

  /** Set up keyboard shortcuts */
  private setupKeyboardShortcuts(): void {
    if (!process.stdin.isTTY) return;

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (key: string) => {
      if (key === '\u0003') { // Ctrl+C
        this.shutdown();
        return;
      }

      switch (key.toLowerCase()) {
        case 'q':
          this.shutdown();
          break;
        case 'r':
          if (this.monitor) {
            this.syncSessionData();
            const snapshot = this.monitor.getLatestSnapshot();
            if (snapshot && this.options) {
              this.renderDashboard(snapshot, this.options);
            }
          }
          break;
        case 's':
          this.switchSession();
          break;
      }
    });
  }

  /** Switch to a different session */
  private async switchSession(): Promise<void> {
    if (this.allSessions.length <= 1) {
      console.log(chalk.yellow('\n  No other sessions available.\n'));
      return;
    }

    // Stop current monitoring
    if (this.monitor) {
      this.monitor.stop();
    }
    if (this.sessionSyncInterval) {
      clearInterval(this.sessionSyncInterval);
      this.sessionSyncInterval = null;
    }
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    console.log(chalk.cyan('\n  Switching session...\n'));

    // Get fresh sessions
    this.allSessions = findRecentSessions(24);
    const session = await this.promptSessionSelection(this.allSessions);

    if (session && this.options) {
      await this.startWithSession(session, this.options);
    }
  }

  /** Re-sync session data from Claude Code files */
  private syncSessionData(): void {
    if (!this.activeSession || !this.monitor) return;

    const refreshed = reSyncSession(this.activeSession);
    if (!refreshed) return;

    // Only update if data changed
    if (
      refreshed.estimatedUsedTokens !== this.activeSession.estimatedUsedTokens ||
      refreshed.messageCount !== this.activeSession.messageCount ||
      refreshed.fileReads !== this.activeSession.fileReads ||
      refreshed.toolCalls !== this.activeSession.toolCalls
    ) {
      this.activeSession = refreshed;
      this.monitor.updateManual(
        refreshed.estimatedUsedTokens,
        refreshed.messageCount,
        refreshed.fileReads,
        refreshed.toolCalls,
        refreshed.mcpServers || 0,
        refreshed.memoryFiles || 0
      );
    }
  }

  private renderDashboard(snapshot: ContextSnapshot, options: DashboardCommandOptions): void {
    // Clear screen (ANSI escape sequence)
    process.stdout.write('\x1Bc');

    const t = this.getThemeColors(options.theme);

    // Header with session info
    console.log(chalk.bold.cyan('  Context Window Intelligence Manager'));
    console.log();

    // Session identification block
    if (this.activeSession) {
      const isLive = this.activeSession.isActive;
      const liveIndicator = isLive
        ? chalk.green.bold('● LIVE')
        : chalk.gray('○ inactive');
      const shortId = this.activeSession.sessionId.slice(0, 8);

      console.log(`  ${t.label('Project:')}       ${chalk.bold.white(this.activeSession.projectName)} ${liveIndicator}`);
      console.log(`  ${t.label('Path:')}          ${t.muted(this.activeSession.projectPath)}`);
      console.log(`  ${t.label('Session:')}       ${t.muted(shortId)} ${t.muted(`(${this.formatDuration(Date.now() - this.sessionStartTime.getTime())})`)}`);
      console.log(`  ${t.label('Last Activity:')} ${t.muted(this.formatTimeAgo(this.activeSession.lastActivityAt))}`);
      console.log();
    } else {
      console.log(`  ${t.label('Mode:')}          ${chalk.yellow('Fallback (no session detected)')}`);
      console.log();
    }

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

    // Other active sessions
    const otherSessions = this.allSessions.filter(
      s => this.activeSession && s.sessionId !== this.activeSession.sessionId && s.isActive
    );

    if (otherSessions.length > 0) {
      console.log(t.label('  --- Other Active Sessions ---'));
      for (const s of otherSessions.slice(0, 3)) {
        const riskIcon = this.getRiskIcon(this.calculateRiskLevel(s.utilizationPercent));
        const riskColor = this.getRiskColor(this.calculateRiskLevel(s.utilizationPercent));
        console.log(`  ${chalk.green('●')} ${chalk.white(s.projectName)} ${chalk.gray(`(${this.formatTimeAgo(s.lastActivityAt)})`)} ${riskColor(`${riskIcon} ${(s.utilizationPercent * 100).toFixed(0)}%`)}`);
      }
      console.log();
    }

    // Footer
    console.log(t.muted(`  Last updated: ${new Date().toLocaleTimeString()}`));
    console.log(t.muted(`  Refresh: ${options.refreshRateMs}ms | [s]witch | [r]efresh | [q]uit`));
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

  private getRiskIcon(risk: DegradationRisk): string {
    switch (risk) {
      case DegradationRisk.CRITICAL: return '✗';
      case DegradationRisk.HIGH: return '!';
      case DegradationRisk.MEDIUM: return '◆';
      case DegradationRisk.LOW: return '●';
      default: return '✓';
    }
  }

  private getRiskColor(risk: DegradationRisk) {
    switch (risk) {
      case DegradationRisk.CRITICAL: return chalk.white.bgRed.bold;
      case DegradationRisk.HIGH: return chalk.red;
      case DegradationRisk.MEDIUM: return chalk.yellow;
      case DegradationRisk.LOW: return chalk.gray;
      default: return chalk.green;
    }
  }

  private calculateRiskLevel(utilization: number): DegradationRisk {
    if (utilization >= 0.90) return DegradationRisk.CRITICAL;
    if (utilization >= 0.80) return DegradationRisk.HIGH;
    if (utilization >= 0.65) return DegradationRisk.MEDIUM;
    if (utilization >= 0.50) return DegradationRisk.LOW;
    return DegradationRisk.NONE;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }

  private formatTimeAgo(date: Date): string {
    const ms = Date.now() - date.getTime();
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    if (seconds > 10) return `${seconds}s ago`;
    return 'just now';
  }

  private shutdown(): void {
    this.isRunning = false;

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    if (this.sessionSyncInterval) {
      clearInterval(this.sessionSyncInterval);
      this.sessionSyncInterval = null;
    }
    if (this.monitor) {
      this.monitor.stop();
      this.monitor = null;
    }
    console.log(chalk.yellow('\n  Dashboard stopped.\n'));
    process.exit(0);
  }
}
