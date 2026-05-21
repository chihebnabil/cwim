/**
 * Status Command - Show current context window status
 */

import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import {
  ContextMonitor,
} from '../../core/ContextMonitor.js';
import {
  TokenEstimator,
} from '../../core/TokenEstimator.js';
import {
  ClaudeModel,
  DegradationRisk,
  type CWIMConfig,
  type ClaudeCodeSession,
} from '../../types/index.js';
import {
  findRecentSessions,
  getCurrentProjectSession,
  getSessionSummaries,
  selectSession,
  isClaudeCodeInstalled,
} from '../../integrations/claude-code.js';

interface StatusOptions {
  json: boolean;
  recentHours: number;
}

export class StatusCommand {
  async execute(options: StatusOptions): Promise<void> {
    // Check if Claude Code is installed
    if (!isClaudeCodeInstalled()) {
      console.log(chalk.yellow('\n  Claude Code is not installed or not initialized.'));
      console.log(chalk.gray('  Install Claude Code to use CWIM context monitoring.\n'));
      return;
    }

    // Find recent sessions
    const sessions = findRecentSessions(options.recentHours);

    if (sessions.length === 0) {
      console.log(chalk.yellow(`\n  No active Claude Code sessions found (last ${options.recentHours}h).`));
      console.log(chalk.gray('  Start a Claude Code session to monitor context usage.\n'));
      return;
    }

    // Select session (auto-select most recent with preferRecent)
    const session = selectSession({
      recentHours: options.recentHours,
      autoSelectIfSingle: true,
      autoSelectCurrentDir: true,
      preferRecent: true,
    });

    if (!session) {
      console.log(chalk.yellow('\n  Could not determine which session to monitor.\n'));
      return;
    }

    // If multiple sessions exist, show a summary of all
    if (sessions.length > 1) {
      this.renderSessionList(sessions, session);
    }

    // Show detailed status for selected session
    this.renderSessionStatus(session, options.json);
  }

  private renderSessionList(sessions: ClaudeCodeSession[], selectedSession: ClaudeCodeSession): void {
    console.log('');
    console.log(chalk.bold.cyan(`  Found ${sessions.length} active Claude Code sessions (last 24h):`));
    console.log('');

    const summaries = getSessionSummaries(sessions);

    for (const summary of summaries) {
      const isSelected = summary.projectPath === selectedSession.projectPath;
      const prefix = isSelected ? chalk.cyan('→ ') : '  ';
      const projectName = isSelected ? chalk.bold.cyan(summary.projectName) : chalk.white(summary.projectName);
      
      const riskIcon = this.getRiskIcon(summary.riskLevel);
      const riskColor = this.getRiskColor(summary.riskLevel);
      
      console.log(`${prefix}[${summary.index}] 📁 ${projectName}`);
      console.log(`      Path: ${chalk.gray(summary.projectPath)}`);
      console.log(`      Model: ${chalk.gray(summary.model)}`);
      console.log(`      Messages: ${chalk.white(summary.messageCount)} | Tokens: ${chalk.white(TokenEstimator.formatTokens(summary.tokensUsed))}/${chalk.white(TokenEstimator.formatTokens(summary.windowSize))} ${riskColor(`(${riskIcon} ${(summary.utilizationPercent * 100).toFixed(1)}%)`)}`);
      console.log(`      Last activity: ${chalk.gray(this.formatTimeAgo(summary.lastActivityAt))}`);
      console.log('');
    }

    console.log(chalk.gray(`  Monitoring: ${selectedSession.projectName} (use --project to select another)\n`));
  }

  private renderSessionStatus(session: ClaudeCodeSession, json: boolean): void {
    const status = {
      contextSize: session.windowSize,
      usedTokens: session.estimatedUsedTokens,
      freeTokens: Math.max(0, session.windowSize - session.estimatedUsedTokens),
      utilizationPercent: session.utilizationPercent,
      riskLevel: this.calculateRiskLevel(session.utilizationPercent),
      model: session.model,
      sessionAge: this.formatDuration(Date.now() - session.firstActivityAt.getTime()),
      messageCount: session.messageCount,
      fileReads: session.fileReads,
      toolCalls: session.toolCalls,
      cacheReadTokens: session.totalCacheReadTokens,
      cacheCreationTokens: session.totalCacheCreationTokens,
      active: session.isActive,
      source: 'claude-code-session',
      projectPath: session.projectPath,
      lastActivity: this.formatTimeAgo(session.lastActivityAt),
    };

    if (json) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    // Display status
    console.log('');
    console.log(chalk.bold.cyan('  Context Window Status'));
    console.log(chalk.gray(`  ${session.projectName} ${session.isActive ? chalk.green('● live') : chalk.gray('○ inactive')}`));
    console.log('');

    const t = {
      label: chalk.gray,
      value: chalk.white,
      highlight: chalk.cyan.bold,
      success: chalk.green,
      warning: chalk.yellow,
      danger: chalk.red,
      critical: chalk.white.bgRed.bold,
      muted: chalk.gray,
    };

    // Model
    console.log(`  ${t.label('Model:')}         ${t.value(status.model)}`);
    console.log(`  ${t.label('Window Size:')}   ${t.highlight(TokenEstimator.formatTokens(status.contextSize))}`);
    console.log(`  ${t.label('Used:')}          ${t.value(TokenEstimator.formatTokens(status.usedTokens))}`);
    console.log(`  ${t.label('Free:')}          ${t.success(TokenEstimator.formatTokens(status.freeTokens))}`);

    // Utilization bar
    const barWidth = 30;
    const filled = Math.floor(status.utilizationPercent * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
    const barColor = status.utilizationPercent > 0.9 ? t.critical :
                    status.utilizationPercent > 0.7 ? t.danger :
                    status.utilizationPercent > 0.5 ? t.warning : t.success;
    console.log(`  ${t.label('Utilization:')}  ${barColor(bar)} ${barColor(`${(status.utilizationPercent * 100).toFixed(1)}%`)}`);

    // Risk level
    const riskColor = status.riskLevel === DegradationRisk.CRITICAL ? t.critical :
                     status.riskLevel === DegradationRisk.HIGH ? t.danger :
                     status.riskLevel === DegradationRisk.MEDIUM ? t.warning :
                     status.riskLevel === DegradationRisk.LOW ? t.muted : t.success;
    console.log(`  ${t.label('Risk:')}          ${riskColor(status.riskLevel.toUpperCase())}`);
    console.log('');

    // Session details
    console.log(t.label('  ─── Session Details ───'));
    console.log(`  ${t.label('Messages:')}      ${t.value(String(status.messageCount))}`);
    console.log(`  ${t.label('File Reads:')}    ${t.value(String(status.fileReads))}`);
    console.log(`  ${t.label('Tool Calls:')}    ${t.value(String(status.toolCalls))}`);
    console.log(`  ${t.label('Session Age:')}   ${t.value(status.sessionAge)}`);
    console.log(`  ${t.label('Last Activity:')} ${t.value(status.lastActivity)}`);
    console.log('');

    // Cache info
    if (status.cacheReadTokens > 0 || status.cacheCreationTokens > 0) {
      console.log(t.label('  ─── Cache Usage ───'));
      console.log(`  ${t.label('Cache Reads:')}    ${t.value(TokenEstimator.formatTokens(status.cacheReadTokens))}`);
      console.log(`  ${t.label('Cache Creation:')} ${t.value(TokenEstimator.formatTokens(status.cacheCreationTokens))}`);
      console.log('');
    }

    // Quick actions
    console.log(t.muted('  Quick Actions:'));
    console.log(`    ${chalk.cyan('cwim dashboard')}  - Launch real-time monitor`);
    console.log(`    ${chalk.cyan('cwim check')}      - Analyze project files`);
    console.log(`    ${chalk.cyan('/context')}        - In Claude Code: show breakdown`);
    console.log(`    ${chalk.cyan('/compact')}        - In Claude Code: summarize conversation`);
    console.log(`    ${chalk.cyan('/clear')}          - In Claude Code: reset context`);
    console.log('');
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
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
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
}
