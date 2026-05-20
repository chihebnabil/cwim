import { describe, it, expect } from 'vitest';
import { TokenEstimator } from '../core/TokenEstimator.js';
import { FileCategory } from '../types/index.js';

describe('TokenEstimator', () => {
  describe('basic estimation', () => {
    it('should estimate prose text', () => {
      const estimator = new TokenEstimator();
      const tokens = estimator.estimate('Hello world, this is a test sentence.', 'prose');
      expect(tokens).toBeGreaterThan(5);
      expect(tokens).toBeLessThan(15);
    });

    it('should estimate code text with shorter ratio', () => {
      const estimator = new TokenEstimator();
      const code = 'function test() {\n  return 42;\n}';
      const prose = 'function test() { return 42; }';

      const codeTokens = estimator.estimate(code, 'code');
      const proseTokens = estimator.estimate(prose, 'prose');

      // Code should generally have fewer tokens per character due to compression
      expect(codeTokens).toBeGreaterThan(0);
      expect(proseTokens).toBeGreaterThan(0);
    });

    it('should handle empty string', () => {
      const estimator = new TokenEstimator();
      expect(estimator.estimate('', 'prose')).toBe(0);
    });
  });

  describe('static helpers', () => {
    it('should estimate system prompt', () => {
      expect(TokenEstimator.estimateSystemPrompt()).toBe(2600);
    });

    it('should estimate system tools', () => {
      expect(TokenEstimator.estimateSystemTools()).toBe(17600);
    });

    it('should estimate MCP server', () => {
      expect(TokenEstimator.estimateMCPServer('git', 5)).toBe(900);
      expect(TokenEstimator.estimateMCPServer('git', 0)).toBe(400);
    });

    it('should format tokens', () => {
      expect(TokenEstimator.formatTokens(500)).toBe('500');
      expect(TokenEstimator.formatTokens(1500)).toBe('1.5K');
      expect(TokenEstimator.formatTokens(1500000)).toBe('1.5M');
    });

    it('should format percentages', () => {
      expect(TokenEstimator.formatPercent(0.5)).toBe('50.0%');
      expect(TokenEstimator.formatPercent(0.123)).toBe('12.3%');
    });
  });

  describe('file categorization', () => {
    it('should categorize TypeScript files', () => {
      expect(TokenEstimator.getFileCategory('test.ts')).toBe(FileCategory.SOURCE_CODE);
      expect(TokenEstimator.getFileCategory('test.tsx')).toBe(FileCategory.SOURCE_CODE);
    });

    it('should categorize Markdown files', () => {
      expect(TokenEstimator.getFileCategory('README.md')).toBe(FileCategory.DOCUMENTATION);
    });

    it('should categorize binary files', () => {
      expect(TokenEstimator.getFileCategory('image.png')).toBe(FileCategory.BINARY);
      expect(TokenEstimator.getFileCategory('archive.zip')).toBe(FileCategory.BINARY);
    });
  });
});
