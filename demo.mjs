#!/usr/bin/env node
/**
 * CWIM Demo - Simulated Context Window Monitoring
 * Demonstrates the dashboard with simulated context consumption.
 */

import { ContextMonitor } from './dist/core/ContextMonitor.js';
import {
  ClaudeModel,
  ClaudePlan,
  DashboardTheme,
  LogLevel,
} from './dist/types/index.js';

// Simulated context data showing progression toward the ceiling
const scenarios = [
  { used: 45000, messages: 8, files: 3, tools: 2, mcps: 2, memory: 1, label: 'Fresh Session' },
  { used: 75000, messages: 15, files: 8, tools: 5, mcps: 2, memory: 1, label: 'Building Context' },
  { used: 110000, messages: 25, files: 14, tools: 9, mcps: 2, memory: 1, label: 'Getting Full' },
  { used: 135000, messages: 35, files: 20, tools: 12, mcps: 2, memory: 1, label: 'Degradation Zone' },
  { used: 155000, messages: 42, files: 26, tools: 15, mcps: 3, memory: 2, label: 'Critical' },
  { used: 175000, messages: 50, files: 32, tools: 18, mcps: 3, memory: 2, label: 'Near Capacity' },
];

function createConfig() {
  return {
    model: ClaudeModel.CLAUDE_4_SONNET,
    plan: ClaudePlan.PRO,
    contextWindowSize: 200_000,
    alertConfig: {
      thresholds: { warning: 0.50, caution: 0.65, danger: 0.80, critical: 0.90 },
      predictions: { enabled: true, lookAheadMinutes: 10, sampleWindowMs: 300_000, minSamples: 5 },
      notifications: { desktop: false, sound: false, cliBadge: true },
    },
    dashboardOptions: {
      refreshRateMs: 3000,
      showBreakdown: true,
      showSuggestions: true,
      showPredictions: true,
      theme: DashboardTheme.DARK,
    },
    projectRoot: process.cwd(),
    claudeCodePath: `${process.env.HOME || '/tmp'}/.claude`,
    logLevel: LogLevel.SILENT,
  };
}

function formatTokens(tokens) {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return `${tokens}`;
}

function getRiskBar(pct, width = 40) {
  const filled = Math.floor(pct * width);
  const empty = width - filled;
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  if (pct > 0.9) return `\x1b[41m\x1b[37m${bar}\x1b[0m`;
  if (pct > 0.7) return `\x1b[31m${bar}\x1b[0m`;
  if (pct > 0.5) return `\x1b[33m${bar}\x1b[0m`;
  return `\x1b[32m${bar}\x1b[0m`;
}

function getRiskLabel(risk) {
  const labels = {
    none: '\x1b[32m OK \x1b[0m',
    low: '\x1b[36m LOW \x1b[0m',
    medium: '\x1b[33m MEDIUM \x1b[0m',
    high: '\x1b[31m HIGH \x1b[0m',
    critical: '\x1b[41m\x1b[37m CRITICAL \x1b[0m',
  };
  return labels[risk] || risk;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.clear();
console.log('\n  \x1b[1m\x1b[36mCWIM Demo\x1b[0m - Context Window Intelligence Manager');
console.log('  \x1b[90mSimulating context window usage over time\x1b[0m\n');
console.log('  Press Ctrl+C to exit\n');

const monitor = new ContextMonitor(createConfig());

// Listen for alerts
monitor.on('alert', (alert) => {
  console.log(`\n  \x1b[33m! ALERT: ${alert.message}\x1b[0m`);
  console.log(`  \x1b[90m  Action: ${alert.suggestedAction}\x1b[0m\n`);
});

monitor.on('suggestion', (s) => {
  console.log(`  \x1b[35m\u2192 Suggestion: ${s.title}\x1b[0m`);
});

async function run() {
  for (const scenario of scenarios) {
    console.clear();
    console.log('\n  \x1b[1m\x1b[36mCWIM Demo\x1b[0m - Context Window Intelligence Manager');
    console.log(`  \x1b[90mScenario: ${scenario.label}\x1b[0m\n`);

    monitor.updateManual(
      scenario.used,
      scenario.messages,
      scenario.files,
      scenario.tools,
      scenario.mcps,
      scenario.memory
    );

    const snapshot = monitor.getLatestSnapshot();
    const pct = snapshot.utilizationPercent;
    const free = snapshot.freeTokens;
    const turns = snapshot.estimatedTurnsRemaining;

    console.log(`  Status: ${getRiskLabel(snapshot.degradationRisk)}  Model: \x1b[36m${snapshot.model}\x1b[0m`);
    console.log('');
    console.log(`  \x1b[90mUsed:\x1b[0m  \x1b[1m${formatTokens(scenario.used).padStart(8, ' ')}\x1b[0m / ${formatTokens(200000)} tokens`);
    console.log(`  \x1b[90mFree:\x1b[0m  \x1b[32m${formatTokens(free).padStart(8, ' ')}\x1b[0m tokens`);
    console.log(`  \x1b[90mUtil:\x1b[0m  ${getRiskLabel(snapshot.degradationRisk)} ${(pct * 100).toFixed(1)}%`);
    console.log(`  ${getRiskBar(pct)}`);
    console.log('');
    console.log(`  \x1b[90mMessages:\x1b[0m     ${scenario.messages}`);
    console.log(`  \x1b[90mFile Reads:\x1b[0m   ${scenario.files}`);
    console.log(`  \x1b[90mTool Calls:\x1b[0m    ${scenario.tools}`);
    console.log(`  \x1b[90mMCP Servers:\x1b[0m  ${scenario.mcps}`);
    console.log(`  \x1b[90mEst. Turns:\x1b[0m   ${turns !== null ? `~${turns} remaining` : 'N/A'}`);
    console.log('');

    // Show suggestions
    const suggestions = monitor.getSuggestions().slice(-3);
    if (suggestions.length > 0) {
      console.log('  \x1b[1m\x1b[90mSuggestions:\x1b[0m');
      for (const s of suggestions) {
        const priority = s.priority === 'critical' ? '\x1b[41m\x1b[37mCRIT\x1b[0m' :
                        s.priority === 'high' ? '\x1b[31mHIGH\x1b[0m' :
                        s.priority === 'medium' ? '\x1b[33mMED\x1b[0m' : '\x1b[90mLOW\x1b[0m';
        console.log(`    ${priority} ${s.title}`);
        if (s.command) {
          console.log(`         \x1b[36m\u2192 ${s.command}\x1b[0m`);
        }
      }
      console.log('');
    }

    // Show alerts
    const activeAlerts = monitor.getActiveAlerts();
    if (activeAlerts.length > 0) {
      console.log('  \x1b[1m\x1b[33mActive Alerts:\x1b[0m');
      for (const alert of activeAlerts.slice(-3)) {
        console.log(`    \x1b[33m!\x1b[0m ${alert.message}`);
      }
      console.log('');
    }

    console.log('  \x1b[90m─'.padEnd(58, '─') + '\x1b[0m');
    console.log(`  \x1b[90mNext scenario in 3 seconds... (${scenarios.indexOf(scenario) + 1}/${scenarios.length})\x1b[0m`);
    console.log('');

    await sleep(3000);
  }

  console.clear();
  console.log('\n  \x1b[1m\x1b[36mCWIM Demo Complete\x1b[0m\n');
  console.log('  The demo showed context window progression from a fresh');
  console.log('  session (22.5%) to near capacity (87.5%).\n');
  console.log('  \x1b[1mKey Takeaways:\x1b[0m');
  console.log('  \x1b[33m\u2022\x1b[0m Degradation begins around 73% (~147K/200K tokens)');
  console.log('  \x1b[33m\u2022\x1b[0m Use /compact at ~65% to summarize conversation');
  console.log('  \x1b[33m\u2022\x1b[0m Use /clear when switching tasks');
  console.log('  \x1b[33m\u2022\x1b[0m Delegate to subagents for isolated work\n');
  console.log(`  Run \x1b[36mtoki dashboard\x1b[0m for live monitoring during Claude Code sessions.\n`);
}

run().catch(console.error);
