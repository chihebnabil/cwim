/**
 * Context Predictor - Predictive analytics for context window usage
 * Uses linear regression and trend analysis to predict when context will fill up.
 */
import { TrendDirection, } from '../types/index.js';
export class ContextPredictor {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Predict when the context window will reach capacity
     */
    predict(history, totalWindow) {
        if (!this.config.enabled || history.length < this.config.minSamples) {
            return {
                predictedFullAt: null,
                predictedCriticalAt: null,
                minutesUntilFull: null,
                minutesUntilCritical: null,
                confidence: 0,
                trend: TrendDirection.STABLE,
            };
        }
        // Use recent data within sample window
        const cutoff = new Date(Date.now() - this.config.sampleWindowMs);
        const recent = history.filter(h => h.timestamp >= cutoff);
        if (recent.length < 3) {
            return {
                predictedFullAt: null,
                predictedCriticalAt: null,
                minutesUntilFull: null,
                minutesUntilCritical: null,
                confidence: 0,
                trend: TrendDirection.STABLE,
            };
        }
        // Linear regression on token usage over time
        const n = recent.length;
        const xValues = []; // minutes from start
        const yValues = []; // token counts
        const startTime = recent[0].timestamp.getTime();
        for (const point of recent) {
            xValues.push((point.timestamp.getTime() - startTime) / 60000); // minutes
            yValues.push(point.usedTokens);
        }
        const { slope, intercept, rSquared } = this.linearRegression(xValues, yValues);
        // Calculate trend direction
        const trend = this.determineTrend(slope, recent);
        // If slope is near zero or negative, context isn't growing
        if (slope <= 0) {
            return {
                predictedFullAt: null,
                predictedCriticalAt: null,
                minutesUntilFull: null,
                minutesUntilCritical: null,
                confidence: rSquared,
                trend,
            };
        }
        // Predict when we hit critical threshold (80%)
        const criticalThreshold = totalWindow * 0.80;
        const minutesUntilCritical = (criticalThreshold - intercept) / slope;
        // Predict when we hit full (100% - autocompact buffer)
        const effectiveFull = totalWindow * 0.835; // minus autocompact buffer
        const minutesUntilFull = (effectiveFull - intercept) / slope;
        // Convert to dates if in the future
        const now = Date.now();
        const predictedCriticalAt = minutesUntilCritical > 0
            ? new Date(now + minutesUntilCritical * 60000)
            : null;
        const predictedFullAt = minutesUntilFull > 0
            ? new Date(now + minutesUntilFull * 60000)
            : null;
        // Confidence based on R-squared and sample size
        const sampleConfidence = Math.min(1, recent.length / 20); // More samples = higher confidence
        const confidence = rSquared * sampleConfidence;
        return {
            predictedFullAt,
            predictedCriticalAt,
            minutesUntilFull: minutesUntilFull > 0 ? Math.ceil(minutesUntilFull) : null,
            minutesUntilCritical: minutesUntilCritical > 0 ? Math.ceil(minutesUntilCritical) : null,
            confidence,
            trend,
        };
    }
    /**
     * Simple linear regression: y = slope * x + intercept
     */
    linearRegression(x, y) {
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
        const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);
        const denominator = n * sumXX - sumX * sumX;
        if (denominator === 0) {
            return { slope: 0, intercept: sumY / n, rSquared: 0 };
        }
        const slope = (n * sumXY - sumX * sumY) / denominator;
        const intercept = (sumY - slope * sumX) / n;
        // R-squared
        const ssRes = y.reduce((sum, yi, i) => {
            const predicted = slope * x[i] + intercept;
            return sum + (yi - predicted) ** 2;
        }, 0);
        const ssTot = sumYY - (sumY * sumY) / n;
        const rSquared = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
        return { slope, intercept, rSquared: Math.max(0, rSquared) };
    }
    /**
     * Determine trend direction from slope and recent data
     */
    determineTrend(slope, recent) {
        if (recent.length < 5)
            return TrendDirection.STABLE;
        // Compare first half avg rate vs second half
        const mid = Math.floor(recent.length / 2);
        const firstHalf = recent.slice(0, mid);
        const secondHalf = recent.slice(mid);
        const rate1 = this.avgRate(firstHalf);
        const rate2 = this.avgRate(secondHalf);
        if (rate2 > rate1 * 1.5)
            return TrendDirection.ACCELERATING;
        if (rate2 > rate1 * 1.1)
            return TrendDirection.RISING;
        if (rate2 < rate1 * 0.9)
            return TrendDirection.FALLING;
        return TrendDirection.STABLE;
    }
    /**
     * Calculate average consumption rate from data points
     */
    avgRate(points) {
        if (points.length < 2)
            return 0;
        const timeSpan = (points[points.length - 1].timestamp.getTime() - points[0].timestamp.getTime()) / 60000;
        const tokenSpan = points[points.length - 1].usedTokens - points[0].usedTokens;
        return timeSpan > 0 ? tokenSpan / timeSpan : 0;
    }
}
//# sourceMappingURL=ContextPredictor.js.map