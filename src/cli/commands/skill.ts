/**
 * Skill Command - Manage CWIM Claude Code skill
 */

import chalk from 'chalk';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, resolve, basename } from 'path';
import { homedir } from 'os';

const SKILL_FILE_NAME = 'context-awareness.md';
const SKILL_DIR = '.claude/skills';

const SKILL_TEMPLATE = `---
name: Context Window Awareness
version: 1.0.0
description: Monitor and optimize Claude Code context window usage with CWIM
author: CWIM
---

# Context Window Awareness

You have access to real-time context window monitoring via the CWIM CLI tool. Use it to optimize your performance and avoid silent quality degradation.

## Core Principle

Context degradation begins as early as 25% utilization (~50K/200K tokens). Don't wait for the model to struggle — proactively manage context before it becomes a problem.

## When to Check Context

Check context BEFORE:
1. **Complex multi-step tasks** (>5 files, >3 tool calls expected)
2. **Reading large files** (>1000 tokens estimated)
3. **Spawning subagents** (creates nested context)
4. **Long conversations** (every 8-10 messages)
5. **Context feels "off"** (repetition, forgetting, contradictions)

## How to Check

Run: \`cwim status --json\`

Parse the JSON for:
- \`utilizationPercent\` — Current usage (0-1)
- \`usedTokens\` — Actual tokens consumed
- \`messageCount\` — Conversation length
- \`model\` — Current model and window size

## Context Guidelines

### Healthy (< 40%)
- Proceed normally
- Full file reads acceptable
- No action needed

### Moderate (40-60%)
- Be selective with file reads
- Prefer line ranges over full files
- Consider \`/compact\` after completing current task
- Mention to user: "Context at 52% — I'll be mindful of file sizes"

### High (60-75%)
- **Suggest \`/compact\` before continuing**
- Only read essential files
- Use subagents for isolated work
- Prioritize: finish current task, then compact

### Critical (> 75%)
- **Strongly recommend \`/clear\` or finishing immediately**
- Avoid any new file reads
- Summarize and save state
- Ask user: "Context at 82% — should I /clear and start fresh, or /compact first?"

## Smart Actions

### Before /compact
Generate a preservation prompt:
\`\`\`
/compact Preserve: [key decisions, API changes, architectural choices]
Summarize: [implementation progress, current state, next steps]
\`\`\`

### Before /clear
Save critical state:
\`\`\`
Let me save our progress before clearing:
- Current task: [what we're doing]
- Key findings: [important discoveries]
- Next steps: [what to do after clear]

/clear
\`\`\`

### Subagent Delegation
When context is tight but work remains:
\`\`\`
Context at 68%. I'll delegate [specific isolated task] to a subagent
to keep our main context focused.
\`\`\`

### Targeted Reads
Instead of: "Read src/auth.ts"
Say: "Read lines 45-120 of src/auth.ts (the login handler)"

## Project-Specific Context

{PROJECT_CONTEXT}

## Memory

Track these across the conversation:
- Files already read (avoid re-reading)
- Decisions made (preserve in /compact)
- Context checks performed
- User preferences on context management

## Anti-Patterns to Avoid

- Reading entire directories recursively
- Re-reading files already in context
- Starting new features when context >70%
- Ignoring context until quality degrades
- Long prose responses when context is tight

Good practices:
- Line-range reads for specific functions
- Targeted grep before full file reads
- Proactive /compact at 60%+
- Subagent delegation for isolated tasks
- Bullet points over paragraphs when context is high

## Commands Reference

- \`cwim status --json\` — Quick context check
- \`cwim dashboard\` — Real-time monitoring
- \`cwim check\` — Project health analysis
- \`/compact\` — Summarize conversation
- \`/clear\` — Reset context (start fresh)
`;

interface SkillOptions {
  projectPath: string;
}

export class SkillCommand {
  async install(options: SkillOptions): Promise<void> {
    const projectPath = resolve(options.projectPath);
    const targetDir = join(projectPath, SKILL_DIR);
    const targetFile = join(targetDir, SKILL_FILE_NAME);

    console.log('');
    console.log(chalk.bold.cyan('  CWIM Skill Installation'));
    console.log(`  ${chalk.gray(projectPath)}`);
    console.log('');

    // Create .claude/skills directory
    try {
      const fs = await import('fs');
      if (!existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        console.log(`  ${chalk.green('✓')} Created ${chalk.cyan(SKILL_DIR)}`);
      }
    } catch {
      console.log(chalk.red(`  ✗ Could not create ${SKILL_DIR}`));
      console.log('');
      return;
    }

    // Use embedded template
    let content = SKILL_TEMPLATE;
    content = this.customizeTemplate(content, projectPath);

    // Check if already exists
    if (existsSync(targetFile)) {
      const existing = readFileSync(targetFile, 'utf-8');
      if (existing === content) {
        console.log(`  ${chalk.yellow('○')} Skill already installed and up to date`);
        console.log('');
        return;
      }

      console.log(`  ${chalk.yellow('!')} Skill already exists — updating...`);
    }

    // Write skill file
    writeFileSync(targetFile, content);
    console.log(`  ${chalk.green('✓')} Installed ${chalk.cyan(SKILL_FILE_NAME)}`);
    console.log(`  ${chalk.gray(`   → ${targetFile}`)}`);
    console.log('');

    // Check for .gitignore
    const gitignorePath = join(projectPath, '.gitignore');
    if (existsSync(gitignorePath)) {
      const gitignore = readFileSync(gitignorePath, 'utf-8');
      if (!gitignore.includes('.claude/')) {
        writeFileSync(gitignorePath, gitignore + '\n# Claude Code\n.claude/\n', { flag: 'a' });
        console.log(`  ${chalk.green('✓')} Added ${chalk.cyan('.claude/')} to .gitignore`);
      }
    }

    console.log(chalk.bold('  What this does:'));
    console.log('  • Makes Claude aware of context window usage');
    console.log('  • Suggests /compact proactively when context grows');
    console.log('  • Recommends targeted reads over full files');
    console.log('  • Proposes subagent delegation when context is tight');
    console.log('');

    console.log(chalk.gray('  Claude will now check context automatically before complex tasks.'));
    console.log('');
  }

  async uninstall(options: SkillOptions): Promise<void> {
    const projectPath = resolve(options.projectPath);
    const targetFile = join(projectPath, SKILL_DIR, SKILL_FILE_NAME);

    console.log('');
    console.log(chalk.bold.cyan('  CWIM Skill Uninstallation'));
    console.log('');

    if (!existsSync(targetFile)) {
      console.log(chalk.yellow(`  Skill not found at ${targetFile}`));
      console.log('');
      return;
    }

    try {
      unlinkSync(targetFile);
      console.log(`  ${chalk.green('✓')} Removed ${chalk.cyan(SKILL_FILE_NAME)}`);
      console.log('');
    } catch {
      console.log(chalk.red(`  ✗ Could not remove ${targetFile}`));
      console.log('');
    }
  }

  async show(options: SkillOptions): Promise<void> {
    const projectPath = resolve(options.projectPath);
    const targetFile = join(projectPath, SKILL_DIR, SKILL_FILE_NAME);

    console.log('');
    console.log(chalk.bold.cyan('  CWIM Skill Status'));
    console.log('');

    if (existsSync(targetFile)) {
      console.log(`  ${chalk.green('●')} Skill installed: ${chalk.cyan(targetFile)}`);
      console.log('');

      // Show preview
      const content = readFileSync(targetFile, 'utf-8');
      const lines = content.split('\n').slice(0, 20);
      console.log(chalk.gray('  Preview:'));
      for (const line of lines) {
        console.log(`  ${chalk.gray(line)}`);
      }
      if (content.split('\n').length > 20) {
        console.log(`  ${chalk.gray('  ...')}`);
      }
    } else {
      console.log(`  ${chalk.red('○')} Skill not installed`);
      console.log(`  ${chalk.gray('  Run: cwim skill install')}`);
    }
    console.log('');
  }

  async status(options: SkillOptions): Promise<void> {
    const projectPath = resolve(options.projectPath);
    const targetFile = join(projectPath, SKILL_DIR, SKILL_FILE_NAME);
    const globalSkillFile = join(homedir(), SKILL_DIR, SKILL_FILE_NAME);

    console.log('');
    console.log(chalk.bold.cyan('  CWIM Skill Status'));
    console.log(`  ${chalk.gray(projectPath)}`);
    console.log('');

    // Check project-level skill
    if (existsSync(targetFile)) {
      console.log(`  ${chalk.green('✓')} Project skill: ${chalk.cyan('installed')}`);
      const stats = require('fs').statSync(targetFile);
      console.log(`    ${chalk.gray(`Updated: ${stats.mtime.toLocaleDateString()}`)}`);
    } else {
      console.log(`  ${chalk.gray('○')} Project skill: not installed`);
    }

    // Check global skill
    if (existsSync(globalSkillFile)) {
      console.log(`  ${chalk.green('✓')} Global skill: ${chalk.cyan('installed')}`);
    } else {
      console.log(`  ${chalk.gray('○')} Global skill: not installed`);
    }

    console.log('');
    console.log(chalk.bold('  Available commands:'));
    console.log(`    ${chalk.cyan('cwim skill install')}     Install skill in current project`);
    console.log(`    ${chalk.cyan('cwim skill uninstall')}   Remove skill from current project`);
    console.log(`    ${chalk.cyan('cwim skill show')}       View skill content`);
    console.log('');
  }

  /**
   * Customize skill template for the project
   */
  private customizeTemplate(content: string, projectPath: string): string {
    const projectName = basename(projectPath);

    // Detect project type for context
    let projectContext = '';

    if (existsSync(join(projectPath, 'package.json'))) {
      projectContext += '- **Node.js project** — Be mindful of node_modules reads\n';
      projectContext += '- Use package.json scripts reference instead of reading full files\n';
    }

    if (existsSync(join(projectPath, 'requirements.txt')) || existsSync(join(projectPath, 'pyproject.toml'))) {
      projectContext += '- **Python project** — Watch for large dependency files\n';
      projectContext += '- Avoid reading full venv/ or __pycache__/ directories\n';
    }

    if (existsSync(join(projectPath, 'Cargo.toml'))) {
      projectContext += '- **Rust project** — Cargo.lock can be large; avoid reading unless needed\n';
    }

    if (existsSync(join(projectPath, 'CLAUDE.md'))) {
      projectContext += '- **CLAUDE.md present** — Already loaded in context, don\'t re-read\n';
    }

    if (projectContext === '') {
      projectContext = '- No specific project type detected\n';
    }

    return content.replace('{PROJECT_CONTEXT}', projectContext.trim());
  }
}
