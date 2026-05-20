/**
 * Status Command - Show current context window status
 */
import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { TokenEstimator, } from '../../core/TokenEstimator.js';
import { DegradationRisk, } from '../../types/index.js';
export class StatusCommand {
    async execute(options) {
        // Try to get actual data from Claude Code log files
        const claudeDir = join(homedir(), '.claude');
        const logDir = join(claudeDir, 'logs');
        // Default status
        let status = {
            contextSize: 200_000,
            usedTokens: 0,
            freeTokens: 200_000,
            utilizationPercent: 0,
            riskLevel: DegradationRisk.NONE,
            model: 'unknown',
            sessionAge: 'N/A',
            messageCount: 0,
            active: false,
            source: 'default',
        };
        // Try to read from Claude Code files
        try {
            // Check for recent session data
            const sessionsDir = join(claudeDir, 'sessions');
            if (existsSync(sessionsDir)) {
                // Could parse session files here
            }
            // Check for context command output cache
            const contextCache = join(claudeDir, '.context_cache');
            if (existsSync(contextCache)) {
                const cached = readFileSync(contextCache, 'utf-8');
                const parsed = JSON.parse(cached);
                status = { ...status, ...parsed, source: 'cache' };
            }
        }
        catch {
            // Use defaults
        }
        if (options.json) {
            console.log(JSON.stringify(status, null, 2));
            return;
        }
        // Display status
        console.log('');
        console.log(chalk.bold.cyan('  Context Window Status'));
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
        console.log(`  ${t.label('Messages:')}      ${t.value(String(status.messageCount))}`);
        console.log(`  ${t.label('Source:')}        ${t.muted(status.source)}`);
        console.log('');
        // Quick actions
        console.log(t.muted('  Quick Actions:'));
        console.log(`    ${chalk.cyan('cwim dashboard')}  - Launch real-time monitor`);
        console.log(`    ${chalk.cyan('cwim check')}      - Analyze project files`);
        console.log(`    ${chalk.cyan('/context')}        - In Claude Code: show breakdown`);
        console.log(`    ${chalk.cyan('/compact')}        - In Claude Code: summarize conversation`);
        console.log(`    ${chalk.cyan('/clear')}          - In Claude Code: reset context`);
        console.log('');
    }
}
//# sourceMappingURL=status.js.map