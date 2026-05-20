/**
 * Config Command - Manage CWIM configuration
 */

import chalk from 'chalk';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.config', 'cwim');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  plan: 'pro',
  contextWindowSize: 200_000,
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
  dashboard: {
    refreshRateMs: 3000,
    showBreakdown: true,
    showSuggestions: true,
    theme: 'dark',
  },
};

export class ConfigCommand {
  private ensureConfig(): Record<string, unknown> {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    if (!existsSync(CONFIG_FILE)) {
      writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
      return { ...DEFAULT_CONFIG };
    }
    try {
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  private saveConfig(config: Record<string, unknown>): void {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  }

  async get(key: string): Promise<void> {
    const config = this.ensureConfig();
    const value = this.getNested(config, key);

    if (value === undefined) {
      console.log(chalk.red(`  Key "${key}" not found in configuration`));
      console.log(chalk.gray(`  Run 'cwim config list' to see all keys`));
      return;
    }

    console.log(`  ${chalk.cyan(key)} = ${chalk.yellow(JSON.stringify(value))}`);
  }

  async set(key: string, value: string): Promise<void> {
    const config = this.ensureConfig();

    // Try to parse as number/boolean/object
    let parsed: unknown = value;
    try {
      parsed = JSON.parse(value);
    } catch {
      // Keep as string
    }

    this.setNested(config, key, parsed);
    this.saveConfig(config);

    console.log(`  ${chalk.green('✓')} ${chalk.cyan(key)} = ${chalk.yellow(JSON.stringify(parsed))}`);
  }

  async list(): Promise<void> {
    const config = this.ensureConfig();

    console.log('');
    console.log(chalk.bold.cyan('  CWIM Configuration'));
    console.log(`  ${chalk.gray(CONFIG_FILE)}`);
    console.log('');

    this.printObject(config, 2);
    console.log('');
  }

  async reset(): Promise<void> {
    this.saveConfig({ ...DEFAULT_CONFIG });
    console.log(chalk.green('  ✓ Configuration reset to defaults'));
  }

  private printObject(obj: Record<string, unknown>, indent: number): void {
    const spaces = '  '.repeat(indent);
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        console.log(`${spaces}${chalk.cyan(key)}:`);
        this.printObject(value as Record<string, unknown>, indent + 1);
      } else {
        console.log(`${spaces}${chalk.cyan(key)}: ${chalk.yellow(JSON.stringify(value))}`);
      }
    }
  }

  private getNested(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  private setNested(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current) || typeof current[parts[i]] !== 'object') {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }

  /** Load merged config (defaults + user config) */
  static load(): Record<string, unknown> {
    const config = { ...DEFAULT_CONFIG };
    if (existsSync(CONFIG_FILE)) {
      try {
        const userConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
        Object.assign(config, userConfig);
      } catch {
        // Use defaults
      }
    }
    return config;
  }
}
