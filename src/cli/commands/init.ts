/**
 * Init Command - Initialize CWIM in a project
 */

import chalk from 'chalk';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import {
  ClaudeModel,
  ClaudePlan,
  CONTEXT_WINDOW_SIZES,
} from '../../types/index.js';

interface InitOptions {
  projectPath: string;
  plan: string;
  model: string;
}

const CLAUDE_MD_TEMPLATE = `# {PROJECT_NAME}

## Project Overview
<!-- Brief description of the project -->

## Tech Stack
<!-- List the main technologies used -->

## Architecture
<!-- High-level architecture decisions -->

## Code Conventions
<!-- Coding standards and patterns -->

## Key Files
<!-- Important files and their purposes -->

## Context Notes
<!-- Anything Claude should always remember -->
`;

const CWIM_CONFIG_TEMPLATE = `{
  "model": "{MODEL}",
  "plan": "{PLAN}",
  "contextWindowSize": {WINDOW_SIZE},
  "thresholds": {
    "warning": 0.50,
    "caution": 0.65,
    "danger": 0.80,
    "critical": 0.90
  },
  "dashboard": {
    "refreshRateMs": 3000,
    "theme": "dark"
  }
}`;

export class InitCommand {
  async execute(options: InitOptions): Promise<void> {
    const projectPath = resolve(options.projectPath);

    console.log('');
    console.log(chalk.bold.cyan('  TOKI Project Initialization'));
    console.log(`  ${chalk.gray(projectPath)}`);
    console.log('');

    // Validate model
    const model = options.model as ClaudeModel;
    const plan = options.plan as ClaudePlan;

    // Determine context window size
    let windowSize: number = CONTEXT_WINDOW_SIZES.standard;
    if (plan === 'max20' || plan === 'enterprise') {
      windowSize = CONTEXT_WINDOW_SIZES.extended_1m;
    } else if (plan === 'max5') {
      windowSize = CONTEXT_WINDOW_SIZES.extended_500k;
    }

    // Check for existing CLAUDE.md
    const claudeMdPath = join(projectPath, 'CLAUDE.md');
    if (!existsSync(claudeMdPath)) {
      const projectName = projectPath.split('/').pop() || 'Project';
      const content = CLAUDE_MD_TEMPLATE.replace('{PROJECT_NAME}', projectName);
      writeFileSync(claudeMdPath, content);
      console.log(`  ${chalk.green('✓')} Created ${chalk.cyan('CLAUDE.md')} (${chalk.yellow('~300 tokens')} when loaded)`);
    } else {
      console.log(`  ${chalk.yellow('○')} ${chalk.cyan('CLAUDE.md')} already exists`);
    }

    // Create toki config
    const tokiConfigPath = join(projectPath, '.toki.json');
    const configContent = CWIM_CONFIG_TEMPLATE
      .replace('{MODEL}', model)
      .replace('{PLAN}', plan)
      .replace('{WINDOW_SIZE}', String(windowSize));
    writeFileSync(tokiConfigPath, configContent);
    console.log(`  ${chalk.green('✓')} Created ${chalk.cyan('.toki.json')} (project config)`);

    // Check for .gitignore
    const gitignorePath = join(projectPath, '.gitignore');
    if (existsSync(gitignorePath)) {
      const gitignore = readFileSync(gitignorePath, 'utf-8');
      if (!gitignore.includes('.toki.json')) {
        writeFileSync(gitignorePath, gitignore + '\n# TOKI local config\n.toki.json\n', { flag: 'a' });
        console.log(`  ${chalk.green('✓')} Added ${chalk.cyan('.toki.json')} to .gitignore`);
      }
    }

    // Summary
    console.log('');
    console.log(chalk.bold('  Configuration:'));
    console.log(`    Model:         ${chalk.cyan(model)}`);
    console.log(`    Plan:          ${chalk.cyan(plan)}`);
    console.log(`    Context Size:  ${chalk.cyan(windowSize.toLocaleString())} tokens`);
    console.log('');

    // Next steps
    console.log(chalk.bold('  Next Steps:'));
    console.log(`    1. Edit ${chalk.cyan('CLAUDE.md')} with your project context`);
    console.log(`    2. Run ${chalk.cyan('toki dashboard')} to start monitoring`);
    console.log(`    3. Run ${chalk.cyan('toki check')} to analyze your project`);
    console.log('');

    // Context budget info
    console.log(chalk.bold('  Context Budget (estimated):'));
    console.log(`    System prompt:     ${chalk.yellow('~2,600 tokens')} (fixed)`);
    console.log(`    System tools:      ${chalk.yellow('~17,600 tokens')} (fixed)`);
    console.log(`    CLAUDE.md:         ${chalk.yellow('~300 tokens')} (configurable)`);
    console.log(`    Working space:     ${chalk.green(`~${(windowSize - 20600 - 16500).toLocaleString()} tokens`)} (after buffer)`);
    console.log('');

    // Tips
    console.log(chalk.gray('  Tips:'));
    console.log(chalk.gray('    • Keep CLAUDE.md concise - every token counts'));
    console.log(chalk.gray('    • Use bullet points over prose in CLAUDE.md'));
    console.log(chalk.gray('    • Place critical instructions at the top'));
    console.log('');
  }
}
