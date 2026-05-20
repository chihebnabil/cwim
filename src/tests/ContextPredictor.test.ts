import { describe, it, expect } from 'vitest';
import { ContextPredictor } from '../core/ContextPredictor.js';
import { TrendDirection } from '../types/index.js';

describe('ContextPredictor', () => {
  it('should return null prediction with insufficient data', () => {
    const predictor = new ContextPredictor({
      enabled: true,
      lookAheadMinutes: 10,
      sampleWindowMs: 300_000,
      minSamples: 5,
    });

    const history = [
      { timestamp: new Date(), usedTokens: 1000, messageCount: 1, fileReads: 0 },
    ];

    const prediction = predictor.predict(history, 200_000);
    expect(prediction.minutesUntilFull).toBeNull();
    expect(prediction.confidence).toBe(0);
  });

  it('should predict time until full', () => {
    const predictor = new ContextPredictor({
      enabled: true,
      lookAheadMinutes: 10,
      sampleWindowMs: 300_000,
      minSamples: 5,
    });

    const now = Date.now();
    const history = [
      { timestamp: new Date(now), usedTokens: 10_000, messageCount: 1, fileReads: 0 },
      { timestamp: new Date(now + 60_000), usedTokens: 30_000, messageCount: 2, fileReads: 0 },
      { timestamp: new Date(now + 120_000), usedTokens: 50_000, messageCount: 3, fileReads: 0 },
      { timestamp: new Date(now + 180_000), usedTokens: 70_000, messageCount: 4, fileReads: 0 },
      { timestamp: new Date(now + 240_000), usedTokens: 90_000, messageCount: 5, fileReads: 0 },
    ];

    const prediction = predictor.predict(history, 200_000);

    expect(prediction.minutesUntilFull).not.toBeNull();
    expect(prediction.minutesUntilFull!).toBeGreaterThan(0);
    expect(prediction.trend).toBe(TrendDirection.RISING);
  });

  it('should detect stable trend', () => {
    const predictor = new ContextPredictor({
      enabled: true,
      lookAheadMinutes: 10,
      sampleWindowMs: 300_000,
      minSamples: 5,
    });

    const now = Date.now();
    const history = [
      { timestamp: new Date(now), usedTokens: 50_000, messageCount: 1, fileReads: 0 },
      { timestamp: new Date(now + 60_000), usedTokens: 50_100, messageCount: 2, fileReads: 0 },
      { timestamp: new Date(now + 120_000), usedTokens: 50_200, messageCount: 3, fileReads: 0 },
      { timestamp: new Date(now + 180_000), usedTokens: 50_300, messageCount: 4, fileReads: 0 },
      { timestamp: new Date(now + 240_000), usedTokens: 50_400, messageCount: 5, fileReads: 0 },
    ];

    const prediction = predictor.predict(history, 200_000);
    expect(prediction.trend).toBe(TrendDirection.STABLE);
  });

  it('should handle disabled predictions', () => {
    const predictor = new ContextPredictor({
      enabled: false,
      lookAheadMinutes: 10,
      sampleWindowMs: 300_000,
      minSamples: 5,
    });

    const now = Date.now();
    const history = [
      { timestamp: new Date(now), usedTokens: 10_000, messageCount: 1, fileReads: 0 },
      { timestamp: new Date(now + 60_000), usedTokens: 50_000, messageCount: 2, fileReads: 0 },
      { timestamp: new Date(now + 120_000), usedTokens: 100_000, messageCount: 3, fileReads: 0 },
    ];

    const prediction = predictor.predict(history, 200_000);
    expect(prediction.minutesUntilFull).toBeNull();
    expect(prediction.confidence).toBe(0);
  });
});
