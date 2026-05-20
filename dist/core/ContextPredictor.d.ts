/**
 * Context Predictor - Predictive analytics for context window usage
 * Uses linear regression and trend analysis to predict when context will fill up.
 */
import { ContextPrediction, type ConsumptionDataPoint, type PredictionConfig } from '../types/index.js';
export declare class ContextPredictor {
    private config;
    constructor(config: PredictionConfig);
    /**
     * Predict when the context window will reach capacity
     */
    predict(history: ConsumptionDataPoint[], totalWindow: number): ContextPrediction;
    /**
     * Simple linear regression: y = slope * x + intercept
     */
    private linearRegression;
    /**
     * Determine trend direction from slope and recent data
     */
    private determineTrend;
    /**
     * Calculate average consumption rate from data points
     */
    private avgRate;
}
//# sourceMappingURL=ContextPredictor.d.ts.map