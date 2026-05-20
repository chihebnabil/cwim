/**
 * Check Command - Quick context health assessment
 */

import chalk from 'chalk';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { globbySync } from 'globby';
import { TokenEstimator } from '../../core/TokenEstimator.js';
import {
  ContextHealth,
  HealthStatus,
  DegradationRisk,
  FileCategory,
  type FileTokenAnalysis,
} from '../../types/index.js';

interface CheckOptions {
  projectPath: string;
  json: boolean;
}

export class CheckCommand {
  async execute(options: CheckOptions): Promise<void> {
    const projectPath = resolve(options.projectPath);

    if (!existsSync(projectPath)) {
      console.error(chalk.red(`✗ Project path not found: ${projectPath}`));
      process.exit(1);
    }

    // Find key project files
    const files = this.findProjectFiles(projectPath);
    const analyses = this.analyzeFiles(files, projectPath);

    // Calculate health score
    const health = this.calculateHealth(analyses, projectPath);

    if (options.json) {
      console.log(JSON.stringify({
        health: {
          score: health.score,
          status: health.status,
          riskLevel: health.riskLevel,
          utilizationPercent: health.utilizationPercent,
          topConcerns: health.topConcerns,
          recommendations: health.recommendations,
        },
        files: {
          total: files.length,
          byCategory: this.categorizeFiles(analyses),
          largest: analyses
            .filter(a => a.estimatedTokens > 0)
            .sort((a, b) => b.estimatedTokens - a.estimatedTokens)
            .slice(0, 20)
            .map(a => ({
              path: a.path.replace(projectPath + '/', ''),
              tokens: a.estimatedTokens,
              size: a.size,
              category: a.category,
            })),
        },
      }, null, 2));
      return;
    }

    // Display results
    console.log('');
    console.log(chalk.bold.cyan('  Context Health Check'));
    console.log(chalk.gray(`  ${projectPath}`));
    console.log('');

    // Health score
    const scoreColor = health.score >= 80 ? chalk.green :
                      health.score >= 60 ? chalk.yellow :
                      health.score >= 40 ? chalk.red : chalk.bgRed.white;
    console.log(`  Health Score: ${scoreColor(` ${health.score}/100 `)} ${chalk.bold(health.status.toUpperCase())}`);
    console.log('');

    // Risk level
    if (health.riskLevel !== DegradationRisk.NONE) {
      const riskColor = health.riskLevel === DegradationRisk.CRITICAL ? chalk.bgRed.white :
                       health.riskLevel === DegradationRisk.HIGH ? chalk.red :
                       health.riskLevel === DegradationRisk.MEDIUM ? chalk.yellow : chalk.cyan;
      console.log(`  Risk Level: ${riskColor(` ${health.riskLevel.toUpperCase()} `)}`);
      console.log('');
    }

    // File breakdown by category
    console.log(chalk.bold('  Files by Category:'));
    const byCategory = this.categorizeFiles(analyses);
    const maxCatLen = Math.max(...Object.keys(byCategory).map(k => k.length));
    for (const [category, data] of Object.entries(byCategory)) {
      const label = category.padEnd(maxCatLen, ' ');
      const count = String(data.count).padStart(4, ' ');
      const tokens = TokenEstimator.formatTokens(data.tokens).padStart(8, ' ');
      const color = category === 'SOURCE_CODE' ? chalk.cyan :
                   category === 'DOCUMENTATION' ? chalk.blue :
                   category === 'CONFIG' ? chalk.yellow :
                   category === 'DATA' ? chalk.magenta : chalk.gray;
      console.log(`    ${color(label)} ${count} files  ${tokens} tokens`);
    }
    console.log('');

    // Largest files
    const sorted = analyses
      .filter(a => a.estimatedTokens > 0)
      .sort((a, b) => b.estimatedTokens - a.estimatedTokens)
      .slice(0, 15);

    if (sorted.length > 0) {
      console.log(chalk.bold('  Largest Files (by token estimate):'));
      console.log('');
      const maxPathLen = Math.min(50, Math.max(...sorted.map(a => a.path.replace(projectPath + '/', '').length)));

      for (const file of sorted) {
        const relPath = file.path.replace(projectPath + '/', '').substring(0, maxPathLen).padEnd(maxPathLen, ' ');
        const tokens = TokenEstimator.formatTokens(file.estimatedTokens).padStart(8, ' ');
        const size = this.formatBytes(file.size).padStart(8, ' ');
        const color = file.estimatedTokens > 10000 ? chalk.red :
                     file.estimatedTokens > 5000 ? chalk.yellow :
                     file.estimatedTokens > 1000 ? chalk.cyan : chalk.gray;
        console.log(`    ${color(tokens)}  ${size}  ${relPath}`);
      }
      console.log('');
    }

    // Recommendations
    if (health.recommendations.length > 0) {
      console.log(chalk.bold('  Recommendations:'));
      console.log('');
      for (const rec of health.recommendations) {
        console.log(`    ${chalk.yellow('→')} ${rec}`);
      }
      console.log('');
    }

    // Tips
    console.log(chalk.gray('  Tips:'));
    console.log(chalk.gray('    • Use targeted file reads with line ranges'));
    console.log(chalk.gray('    • Run /compact to summarize conversation'));
    console.log(chalk.gray('    • Use subagents for isolated tasks'));
    console.log(chalk.gray('    • Clear context between unrelated tasks'));
    console.log('');
  }

  private findProjectFiles(projectPath: string): string[] {
    const patterns = [
      '**/*.{ts,tsx,js,jsx,py,rs,go,java,c,cpp,h,swift,kt,rb,php,cs}',
      '**/*.{md,mdx,txt,rst}',
      '**/*.{json,yaml,yml,toml,ini,conf,env}',
      '**/*.{csv,sql,log}',
    ];

    try {
      return globbySync(patterns, {
        cwd: projectPath,
        gitignore: true,
        ignore: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
          '**/coverage/**',
          '**/.next/**',
          '**/vendor/**',
          '**/*.min.js',
          '**/*.min.css',
          '**/package-lock.json',
          '**/yarn.lock',
          '**/pnpm-lock.yaml',
          '**/Cargo.lock',
          '**/go.sum',
        ],
      }).map(p => join(projectPath, p));
    } catch {
      return [];
    }
  }

  private analyzeFiles(files: string[], projectPath: string): FileTokenAnalysis[] {
    const estimator = new TokenEstimator();
    const results: FileTokenAnalysis[] = [];

    // Always include CLAUDE.md if it exists
    const claudeMd = join(projectPath, 'CLAUDE.md');
    if (existsSync(claudeMd)) {
      results.push(estimator.analyzeFile(claudeMd));
    }

    // Global CLAUDE.md
    const globalClaudeMd = join(homedir(), '.claude', 'CLAUDE.md');
    if (existsSync(globalClaudeMd)) {
      const analysis = estimator.analyzeFile(globalClaudeMd);
      analysis.path = '~/.claude/CLAUDE.md';
      results.push(analysis);
    }

    for (const file of files.slice(0, 1000)) { // Cap at 1000 files for performance
      try {
        const stat = statSync(file);
        if (stat.size > 5 * 1024 * 1024) continue; // Skip files > 5MB
        results.push(estimator.analyzeFile(file));
      } catch {
        // Skip unreadable files
      }
    }

    return results;
  }

  private categorizeFiles(analyses: FileTokenAnalysis[]): Record<string, { count: number; tokens: number }> {
    const categories: Record<string, { count: number; tokens: number }> = {};

    for (const a of analyses) {
      const cat = a.category;
      if (!categories[cat]) {
        categories[cat] = { count: 0, tokens: 0 };
      }
      categories[cat].count++;
      categories[cat].tokens += a.estimatedTokens;
    }

    return categories;
  }

  private calculateHealth(analyses: FileTokenAnalysis[], projectPath: string): ContextHealth {
    const totalTokens = analyses.reduce((sum, a) => sum + a.estimatedTokens, 0);
    const fileCount = analyses.filter(a => a.estimatedTokens > 0).length;
    const largeFiles = analyses.filter(a => a.estimatedTokens > 10000).length;
    const claudeMdExists = existsSync(join(projectPath, 'CLAUDE.md'));

    // Calculate hypothetical utilization if all files were loaded
    const standardWindow = 200_000;
    const hypotheticalUtilization = Math.min(1, totalTokens / standardWindow);

    // Health score (0-100)
    let score = 100;

    // Deduct for large files
    score -= largeFiles * 5;

    // Deduct for high total token count
    if (totalTokens > 100_000) score -= 20;
    else if (totalTokens > 50_000) score -= 10;

    // Deduct for many files
    if (fileCount > 500) score -= 10;

    // Bonus for CLAUDE.md
    if (claudeMdExists) score += 5;

    score = Math.max(0, Math.min(100, score));

    // Determine status
    let status: HealthStatus;
    if (score >= 85) status = HealthStatus.EXCELLENT;
    else if (score >= 70) status = HealthStatus.GOOD;
    else if (score >= 50) status = HealthStatus.FAIR;
    else if (score >= 30) status = HealthStatus.POOR;
    else status = HealthStatus.CRITICAL;

    // Risk level
    let riskLevel: DegradationRisk;
    if (hypotheticalUtilization > 0.9) riskLevel = DegradationRisk.CRITICAL;
    else if (hypotheticalUtilization > 0.7) riskLevel = DegradationRisk.HIGH;
    else if (hypotheticalUtilization > 0.5) riskLevel = DegradationRisk.MEDIUM;
    else riskLevel = DegradationRisk.NONE;

    // Concerns
    const concerns: string[] = [];
    if (largeFiles > 0) concerns.push(`${largeFiles} very large files (>10K tokens each)`);
    if (totalTokens > 100_000) concerns.push('Total codebase exceeds 100K tokens');
    if (fileCount > 500) concerns.push('Large number of source files');
    if (!claudeMdExists) concerns.push('No CLAUDE.md found');

    // Recommendations
    const recommendations: string[] = [];
    if (largeFiles > 0) {
      recommendations.push('Split large files or use line-range reads');
    }
    if (totalTokens > 100_000) {
      recommendations.push('Use targeted file references instead of loading entire codebase');
      recommendations.push('Consider using subagents for different modules');
    }
    if (!claudeMdExists) {
      recommendations.push('Create CLAUDE.md with project conventions and context');
    }
    recommendations.push('Run `cwim dashboard` for real-time monitoring during sessions');

    return {
      score,
      status,
      utilizationPercent: hypotheticalUtilization,
      freeSpacePercent: 1 - hypotheticalUtilization,
      riskLevel,
      topConcerns: concerns,
      recommendations,
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}
