/**
 * Context Monitor - Real-time monitoring engine
 * Tracks context window usage, calculates consumption rates,
 * detects degradation risks, and emits events.
 */
import { EventEmitter } from 'events';
import { ContextSnapshot, ContextAlert, ConsumptionRate, OptimizationSuggestion, ContextPrediction, type CWIMConfig, type SnapshotMetadata } from '../types/index.js';
export declare class ContextMonitor extends EventEmitter {
    private config;
    private alertConfig;
    private estimator;
    private predictor;
    private snapshots;
    private alerts;
    private suggestions;
    private isMonitoring;
    private monitorInterval;
    private sessionStartTime;
    private lastAlertLevel;
    private consumptionHistory;
    private currentModel;
    private currentMessageCount;
    private currentFileReads;
    private currentToolCalls;
    private currentMcpServers;
    private currentMemoryFiles;
    private currentUsedTokens;
    private currentBreakdown;
    constructor(config: CWIMConfig);
    /** Start monitoring */
    start(refreshIntervalMs?: number): void;
    /** Stop monitoring */
    stop(): void;
    /** Check if monitoring is active */
    get isActive(): boolean;
    /** Update context data from external source (e.g., /context command) */
    updateFromContextCommand(model: string, usedTokens: number, totalWindow: number, breakdown: Array<{
        category: string;
        tokens: number;
        percentage: number;
    }>, metadata?: Partial<SnapshotMetadata>): ContextSnapshot;
    /** Update from manual input */
    updateManual(usedTokens: number, messageCount: number, fileReads: number, toolCalls: number, mcpServers: number, memoryFiles: number): ContextSnapshot;
    /** Add a message to the conversation */
    addMessage(text: string, role: 'user' | 'assistant'): void;
    /** Add a file read to context */
    addFileRead(filePath: string, content: string): void;
    /** Add MCP server to context */
    addMCPServer(serverName: string, toolCount: number): void;
    /** Remove MCP server from context */
    removeMCPServer(serverName: string, toolCount: number): void;
    /** Take a snapshot of current context state */
    takeSnapshot(): ContextSnapshot;
    /** Get the latest snapshot */
    getLatestSnapshot(): ContextSnapshot | null;
    /** Get all snapshots */
    getSnapshots(): ContextSnapshot[];
    /** Get all alerts */
    getAlerts(): ContextAlert[];
    /** Get active (non-dismissed) alerts */
    getActiveAlerts(): ContextAlert[];
    /** Get all suggestions */
    getSuggestions(): OptimizationSuggestion[];
    /** Dismiss an alert */
    dismissAlert(alertId: string): void;
    /** Get consumption rate statistics */
    getConsumptionRate(): ConsumptionRate;
    /** Get context prediction */
    getPrediction(): ContextPrediction;
    /** Clear all context (simulate /clear) */
    clearContext(): ContextSnapshot;
    /** Get baseline tokens (system prompt + tools + MCPs that persist) */
    private getBaselineTokens;
    /** Calculate degradation risk level */
    private calculateDegradationRisk;
    /** Estimate remaining turns based on consumption rate */
    private estimateTurnsRemaining;
    /** Check thresholds and emit alerts */
    private checkThresholds;
    /** Get human-readable alert message */
    private getAlertMessage;
    /** Get suggested action for risk level */
    private getSuggestedAction;
    /** Generate optimization suggestions */
    private generateSuggestions;
    /** Emit prediction-based alert */
    private emitPredictionAlert;
    /** Calculate consumption trend */
    private calculateTrend;
    /** Record consumption data point */
    private recordConsumptionData;
    /** Rebuild breakdown estimate from current state */
    private rebuildBreakdownEstimate;
}
//# sourceMappingURL=ContextMonitor.d.ts.map