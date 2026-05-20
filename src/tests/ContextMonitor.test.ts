import { describe, it, expect, vi } from 'vitest';
import { ContextMonitor } from '../core/ContextMonitor.js';
import { DegradationRisk, ClaudeModel, ClaudePlan, DashboardTheme, LogLevel } from '../types/index.js';
import type { CWIMConfig } from '../types/index.js';

function createTestConfig(overrides: Partial<CWIMConfig> = {}): CWIMConfig {
  return {
    model: ClaudeModel.CLAUDE_4_SONNET,
    plan: ClaudePlan.PRO,
    contextWindowSize: 200_000,
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
      refreshRateMs: 3000,
      showBreakdown: true,
      showSuggestions: true,
      showPredictions: true,
      theme: DashboardTheme.DARK,
    },
    projectRoot: process.cwd(),
    claudeCodePath: '/tmp/.claude',
    logLevel: LogLevel.SILENT,
    ...overrides,
  };
}

describe('ContextMonitor', () => {
  it('should create monitor with config', () => {
    const config = createTestConfig();
    const monitor = new ContextMonitor(config);
    expect(monitor).toBeDefined();
    expect(monitor.isActive).toBe(false);
  });

  it('should take snapshot with correct values', () => {
    const config = createTestConfig();
    const monitor = new ContextMonitor(config);

    monitor.updateManual(50_000, 10, 5, 3, 2, 1);
    const snapshot = monitor.getLatestSnapshot();

    expect(snapshot).toBeDefined();
    expect(snapshot!.usedTokens).toBe(50_000);
    expect(snapshot!.totalWindow).toBe(200_000);
    expect(snapshot!.utilizationPercent).toBe(0.25);
    expect(snapshot!.freeTokens).toBeGreaterThan(0);
  });

  it('should detect low risk at 25% utilization', () => {
    const config = createTestConfig();
    const monitor = new ContextMonitor(config);

    monitor.updateManual(50_000, 10, 5, 3, 0, 0);
    const snapshot = monitor.getLatestSnapshot();

    expect(snapshot!.degradationRisk).toBe(DegradationRisk.NONE);
  });

  it('should detect warning at 55% utilization', () => {
    const config = createTestConfig();
    const monitor = new ContextMonitor(config);

    monitor.updateManual(110_000, 20, 10, 5, 0, 0);
    const snapshot = monitor.getLatestSnapshot();

    expect(snapshot!.degradationRisk).toBe(DegradationRisk.LOW);
  });

  it('should detect caution at 70% utilization', () => {
    const config = createTestConfig();
    const monitor = new ContextMonitor(config);

    monitor.updateManual(140_000, 30, 15, 8, 0, 0);
    const snapshot = monitor.getLatestSnapshot();

    expect(snapshot!.degradationRisk).toBe(DegradationRisk.MEDIUM);
  });

  it('should calculate consumption rate', () => {
    const config = createTestConfig();
    const monitor = new ContextMonitor(config);

    // Need at least 2 snapshots for rate calculation
    monitor.updateManual(10_000, 5, 2, 1, 0, 0);
    monitor.updateManual(20_000, 10, 4, 2, 0, 0);

    const rate = monitor.getConsumptionRate();
    expect(rate.tokensPerMinute).toBeGreaterThanOrEqual(0);
  });

  it('should emit snapshot events', () => {
    const config = createTestConfig();
    const monitor = new ContextMonitor(config);
    const handler = vi.fn();

    monitor.on('snapshot', handler);
    monitor.updateManual(50_000, 10, 5, 3, 0, 0);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].usedTokens).toBe(50_000);
  });

  it('should clear context and reset state', () => {
    const config = createTestConfig();
    const monitor = new ContextMonitor(config);

    monitor.updateManual(150_000, 50, 20, 10, 2, 1);
    const beforeClear = monitor.getLatestSnapshot();
    expect(beforeClear!.usedTokens).toBe(150_000);

    monitor.clearContext();
    const afterClear = monitor.getLatestSnapshot();

    // After clear, used tokens should be much lower (just baseline)
    expect(afterClear!.usedTokens).toBeLessThan(150_000);
    expect(afterClear!.metadata.messageCount).toBe(0);
  });

  it('should track message count', () => {
    const config = createTestConfig();
    const monitor = new ContextMonitor(config);

    monitor.addMessage('Hello', 'user');
    monitor.addMessage('Hi there', 'assistant');

    const snapshot = monitor.getLatestSnapshot();
    expect(snapshot!.metadata.messageCount).toBe(2);
  });

  it('should track file reads', () => {
    const config = createTestConfig();
    const monitor = new ContextMonitor(config);

    monitor.addFileRead('src/test.ts', 'const x = 1;\nconst y = 2;');

    const snapshot = monitor.getLatestSnapshot();
    expect(snapshot!.metadata.fileReads).toBe(1);
    expect(snapshot!.usedTokens).toBeGreaterThan(0);
  });

  it('should generate suggestions at high utilization', () => {
    const config = createTestConfig();
    const monitor = new ContextMonitor(config);

    monitor.updateManual(160_000, 40, 25, 12, 4, 2);
    const suggestions = monitor.getSuggestions();

    // Should suggest clearing, compacting, or using subagents
    expect(suggestions.length).toBeGreaterThan(0);
  });
});
