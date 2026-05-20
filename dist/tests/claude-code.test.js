import { describe, it, expect } from 'vitest';
import { parseContextOutput } from '../integrations/claude-code.js';
describe('Claude Code Integration', () => {
    it('should parse /context command output', () => {
        const output = `Context Usage
claude-opus-4-5-20251101 · 51k/200k tokens (26%)

Estimated usage by category
  System prompt:     2.6k tokens  (1.3%)
  System tools:     17.6k tokens  (8.8%)
  MCP tools:          907 tokens  (0.5%)
  Custom agents:      935 tokens  (0.5%)
  Memory files:       302 tokens  (0.2%)
  Skills:              61 tokens  (0.0%)
  Messages:         30.5k tokens (15.3%)
  Free space:        114k        (57.0%)
  Autocompact buffer: 33k tokens (16.5%)`;
        const result = parseContextOutput(output);
        expect(result).not.toBeNull();
        expect(result.model).toBe('claude-opus-4-5-20251101');
        expect(result.usedTokens).toBe(51_000);
        expect(result.totalWindow).toBe(200_000);
        expect(result.breakdown.length).toBeGreaterThan(0);
        const systemPrompt = result.breakdown.find(b => b.category === 'system_prompt');
        expect(systemPrompt).toBeDefined();
        expect(systemPrompt.tokens).toBe(2600);
    });
    it('should return null for invalid output', () => {
        const result = parseContextOutput('not valid context output');
        expect(result).toBeNull();
    });
    it('should handle empty string', () => {
        const result = parseContextOutput('');
        expect(result).toBeNull();
    });
    it('should parse different token formats', () => {
        const output = `Context Usage
claude-sonnet-4-20250514 · 150k/200k tokens (75%)

Estimated usage by category
  Messages:         130k tokens (65.0%)
  Free space:        20k        (10.0%)`;
        const result = parseContextOutput(output);
        expect(result.usedTokens).toBe(150_000);
        expect(result.totalWindow).toBe(200_000);
    });
});
//# sourceMappingURL=claude-code.test.js.map