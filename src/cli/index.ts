#!/usr/bin/env node
/**
 * CLI Entry Point for Context Window Intelligence Manager
 * Provides real-time dashboard, health checks, and configuration management.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DashboardCommand } from './commands/dashboard.js';
import { CheckCommand } from './commands/check.js';
import { ConfigCommand } from './commands/config.js';
import { InitCommand } from './commands/init.js';
import { StatusCommand } from './commands/status.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));

const program = new Command();

program
  .name('toki')
  .description('Context Window Intelligence Manager - Real-time monitoring for Claude Code context')
  .version(pkg.version, '-v, --version', 'Display version number');

// Dashboard command - real-time monitoring
program
  .command('dashboard')
  .description('Launch real-time context monitoring dashboard')
  .option('-r, --refresh <ms>', 'Refresh rate in milliseconds', '3000')
  .option('-m, --model <model>', 'Claude model being used', 'claude-sonnet-4-20250514')
  .option('-w, --window <size>', 'Context window size in tokens', '200000')
  .option('--no-breakdown', 'Hide category breakdown')
  .option('--no-suggestions', 'Hide optimization suggestions')
  .option('--theme <theme>', 'Dashboard theme: dark, light, minimal', 'dark')
  .action(async (options) => {
    const cmd = new DashboardCommand();
    await cmd.execute({
      refreshRateMs: parseInt(options.refresh),
      model: options.model,
      windowSize: parseInt(options.window),
      showBreakdown: options.breakdown,
      showSuggestions: options.suggestions,
      theme: options.theme,
    });
  });

// Check command - quick health check
program
  .command('check')
  .description('Quick context health check')
  .option('-p, --project <path>', 'Project root path', process.cwd())
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const cmd = new CheckCommand();
    await cmd.execute({
      projectPath: options.project,
      json: options.json,
    });
  });

// Status command - show current status
program
  .command('status')
  .description('Show current context window status')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const cmd = new StatusCommand();
    await cmd.execute({ json: options.json });
  });

// Config command - manage configuration
program
  .command('config')
  .description('Manage CWIM configuration')
  .addCommand(
    new Command('get')
      .description('Get configuration value')
      .argument('<key>', 'Configuration key')
      .action(async (key) => {
        const cmd = new ConfigCommand();
        await cmd.get(key);
      })
  )
  .addCommand(
    new Command('set')
      .description('Set configuration value')
      .argument('<key>', 'Configuration key')
      .argument('<value>', 'Configuration value')
      .action(async (key, value) => {
        const cmd = new ConfigCommand();
        await cmd.set(key, value);
      })
  )
  .addCommand(
    new Command('list')
      .description('List all configuration')
      .action(async () => {
        const cmd = new ConfigCommand();
        await cmd.list();
      })
  )
  .addCommand(
    new Command('reset')
      .description('Reset configuration to defaults')
      .action(async () => {
        const cmd = new ConfigCommand();
        await cmd.reset();
      })
  );

// Init command - initialize in project
program
  .command('init')
  .description('Initialize CWIM in current project')
  .option('-p, --project <path>', 'Project root path', process.cwd())
  .option('--plan <plan>', 'Claude plan tier: free, pro, max5, max20, enterprise', 'pro')
  .option('--model <model>', 'Default Claude model', 'claude-sonnet-4-20250514')
  .action(async (options) => {
    const cmd = new InitCommand();
    await cmd.execute({
      projectPath: options.project,
      plan: options.plan,
      model: options.model,
    });
  });

// Estimate command - estimate file tokens
program
  .command('estimate')
  .description('Estimate token count for files')
  .argument('<files...>', 'Files to analyze')
  .option('-r, --recursive', 'Include directory contents recursively')
  .option('--json', 'Output as JSON')
  .action(async (files, options) => {
    const { TokenEstimator } = await import('../core/TokenEstimator.js');
    const estimator = new TokenEstimator();

    console.log(chalk.bold('\n  Token Estimation\n'));

    let totalTokens = 0;
    const results = [];

    for (const file of files) {
      try {
        const analysis = estimator.analyzeFile(file);
        totalTokens += analysis.estimatedTokens;
        results.push(analysis);

        if (!options.json) {
          const color = analysis.estimatedTokens > 10000 ? chalk.red :
                       analysis.estimatedTokens > 5000 ? chalk.yellow : chalk.green;
          console.log(`  ${chalk.gray('─'.repeat(50))}`);
          console.log(`  ${chalk.bold(file)}`);
          console.log(`  Size: ${chalk.cyan(analysis.size.toLocaleString())} bytes`);
          console.log(`  Est. Tokens: ${color(analysis.estimatedTokens.toLocaleString())}`);
          console.log(`  Category: ${chalk.magenta(analysis.category)}`);
        }
      } catch (err) {
        console.log(chalk.red(`  ✗ ${file}: ${(err as Error).message}`));
      }
    }

    console.log(chalk.gray(`\n  ${'─'.repeat(50)}`));
    console.log(`  ${chalk.bold('Total:')} ${chalk.yellow(totalTokens.toLocaleString())} tokens`);

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    }
  });

// Parse CLI arguments
program.parse();
