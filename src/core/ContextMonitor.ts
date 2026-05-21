/**
 * Context Monitor - Real-time monitoring engine
 * Tracks context window usage, calculates consumption rates,
 * detects degradation risks, and emits events.
 */

import { EventEmitter } from 'events';
import {
  ContextSnapshot,
  ContextBreakdown,
  DegradationRisk,
  ContextCategory,
  AlertType,
  ContextAlert,
  ConsumptionRate,
  TrendDirection,
  OptimizationSuggestion,
  SuggestionPriority,
  SuggestionCategory,
  ConsumptionDataPoint,
  ContextPrediction,
  type MonitorEvents,
  type AlertConfig,
  type CWIMConfig,
  type SnapshotMetadata,
} from '../types/index.js';
import { TokenEstimator } from './TokenEstimator.js';
import { ContextPredictor } from './ContextPredictor.js';
import { v4 as uuidv4 } from '../utils/id.js';

/** Default alert thresholds */
const DEFAULT_THRESHOLDS = {
  warning: 0.50,
  caution: 0.65,
  danger: 0.80,
  critical: 0.90,
};

/** Known degradation onset threshold from research */
const DEGRADATION_ONSET_THRESHOLD = 0.735; // ~147K/200K

export class ContextMonitor extends EventEmitter {
  private config: CWIMConfig;
  private alertConfig: AlertConfig;
  private estimator: TokenEstimator;
  private predictor: ContextPredictor;
  private snapshots: ContextSnapshot[] = [];
  private alerts: ContextAlert[] = [];
  private suggestions: OptimizationSuggestion[] = [];
  private isMonitoring = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private sessionStartTime: Date;
  private lastAlertLevel: DegradationRisk = DegradationRisk.NONE;
  private consumptionHistory: ConsumptionDataPoint[] = [];

  // Current state tracking
  private currentModel: string = '';
  private currentMessageCount = 0;
  private currentFileReads = 0;
  private currentToolCalls = 0;
  private currentMcpServers = 0;
  private currentMemoryFiles = 0;
  private currentUsedTokens = 0;
  private currentBreakdown: ContextBreakdown[] = [];

  constructor(config: CWIMConfig) {
    super();
    this.config = config;
    this.alertConfig = config.alertConfig;
    this.estimator = new TokenEstimator();
    this.predictor = new ContextPredictor(config.alertConfig.predictions);
    this.sessionStartTime = new Date();
  }

  /** Initialize monitor state from a parsed Claude Code session */
  initializeFromSession(session: {
    model: string;
    estimatedUsedTokens: number;
    messageCount: number;
    fileReads: number;
    toolCalls: number;
    windowSize: number;
    mcpServers?: number;
    memoryFiles?: number;
  }): void {
    this.currentModel = session.model;
    this.currentUsedTokens = session.estimatedUsedTokens;
    this.currentMessageCount = session.messageCount;
    this.currentFileReads = session.fileReads;
    this.currentToolCalls = session.toolCalls;
    this.currentMcpServers = session.mcpServers ?? this.currentMcpServers;
    this.currentMemoryFiles = session.memoryFiles ?? this.currentMemoryFiles;
    this.config.contextWindowSize = session.windowSize;

    // Rebuild breakdown with actual session data
    this.rebuildBreakdownEstimate();
  }

  /** Start monitoring */
  start(refreshIntervalMs = 5000): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    this.sessionStartTime = new Date();

    // Initial snapshot
    this.takeSnapshot();

    // Periodic snapshots
    this.monitorInterval = setInterval(() => {
      this.takeSnapshot();
    }, refreshIntervalMs);

    this.emit('started', { timestamp: this.sessionStartTime });
  }

  /** Stop monitoring */
  stop(): void {
    this.isMonitoring = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.emit('stopped', { timestamp: new Date() });
  }

  /** Get current configuration */
  getConfig(): CWIMConfig {
    return this.config;
  }

  /** Check if monitoring is active */
  get isActive(): boolean {
    return this.isMonitoring;
  }

  /** Update context data from external source (e.g., /context command) */
  updateFromContextCommand(
    model: string,
    usedTokens: number,
    totalWindow: number,
    breakdown: Array<{ category: string; tokens: number; percentage: number }>,
    metadata?: Partial<SnapshotMetadata>
  ): ContextSnapshot {
    this.currentModel = model;
    this.currentUsedTokens = usedTokens;
    this.config.contextWindowSize = totalWindow;

    this.currentBreakdown = breakdown.map(b => ({
      category: b.category as ContextCategory,
      tokens: b.tokens,
      percentage: b.percentage,
    }));

    if (metadata) {
      this.currentMessageCount = metadata.messageCount ?? this.currentMessageCount;
      this.currentFileReads = metadata.fileReads ?? this.currentFileReads;
      this.currentToolCalls = metadata.toolCalls ?? this.currentToolCalls;
      this.currentMcpServers = metadata.mcpServers ?? this.currentMcpServers;
      this.currentMemoryFiles = metadata.memoryFiles ?? this.currentMemoryFiles;
    }

    return this.takeSnapshot();
  }

  /** Update from manual input */
  updateManual(
    usedTokens: number,
    messageCount: number,
    fileReads: number,
    toolCalls: number,
    mcpServers: number,
    memoryFiles: number
  ): ContextSnapshot {
    this.currentUsedTokens = usedTokens;
    this.currentMessageCount = messageCount;
    this.currentFileReads = fileReads;
    this.currentToolCalls = toolCalls;
    this.currentMcpServers = mcpServers;
    this.currentMemoryFiles = memoryFiles;

    // Rebuild breakdown estimate
    this.rebuildBreakdownEstimate();

    return this.takeSnapshot();
  }

  /** Add a message to the conversation */
  addMessage(text: string, role: 'user' | 'assistant'): ContextSnapshot {
    const tokens = this.estimator.estimate(text, role === 'assistant' ? 'prose' : 'prose');
    this.currentUsedTokens += tokens;
    this.currentMessageCount++;

    // Update breakdown
    const messagesBreakdown = this.currentBreakdown.find(
      b => b.category === ContextCategory.MESSAGES
    );
    if (messagesBreakdown) {
      messagesBreakdown.tokens += tokens;
      messagesBreakdown.percentage = messagesBreakdown.tokens / this.config.contextWindowSize;
    } else {
      this.currentBreakdown.push({
        category: ContextCategory.MESSAGES,
        tokens,
        percentage: tokens / this.config.contextWindowSize,
      });
    }

    this.emit('message', { tokens, role, totalMessages: this.currentMessageCount });
    return this.takeSnapshot();
  }

  /** Add a file read to context */
  addFileRead(filePath: string, content: string): ContextSnapshot {
    const tokens = this.estimator.estimate(content, 'code');
    this.currentUsedTokens += tokens;
    this.currentFileReads++;

    const messagesBreakdown = this.currentBreakdown.find(
      b => b.category === ContextCategory.MESSAGES
    );
    if (messagesBreakdown) {
      messagesBreakdown.tokens += tokens;
      messagesBreakdown.percentage = messagesBreakdown.tokens / this.config.contextWindowSize;
    }

    this.emit('fileRead', { filePath, tokens });
    return this.takeSnapshot();
  }

  /** Add MCP server to context */
  addMCPServer(serverName: string, toolCount: number): void {
    const tokens = TokenEstimator.estimateMCPServer(serverName, toolCount);
    this.currentUsedTokens += tokens;
    this.currentMcpServers++;

    const mcpBreakdown = this.currentBreakdown.find(
      b => b.category === ContextCategory.MCP_TOOLS
    );
    if (mcpBreakdown) {
      mcpBreakdown.tokens += tokens;
      mcpBreakdown.percentage = mcpBreakdown.tokens / this.config.contextWindowSize;
    } else {
      this.currentBreakdown.push({
        category: ContextCategory.MCP_TOOLS,
        tokens,
        percentage: tokens / this.config.contextWindowSize,
      });
    }

    this.emit('mcpServer', { serverName, tokens });
  }

  /** Remove MCP server from context */
  removeMCPServer(serverName: string, toolCount: number): void {
    const tokens = TokenEstimator.estimateMCPServer(serverName, toolCount);
    this.currentUsedTokens = Math.max(0, this.currentUsedTokens - tokens);
    this.currentMcpServers = Math.max(0, this.currentMcpServers - 1);

    const mcpBreakdown = this.currentBreakdown.find(
      b => b.category === ContextCategory.MCP_TOOLS
    );
    if (mcpBreakdown) {
      mcpBreakdown.tokens = Math.max(0, mcpBreakdown.tokens - tokens);
      mcpBreakdown.percentage = mcpBreakdown.tokens / this.config.contextWindowSize;
    }
  }

  /** Take a snapshot of current context state */
  takeSnapshot(): ContextSnapshot {
    const now = new Date();
    const sessionDurationMs = now.getTime() - this.sessionStartTime.getTime();
    const totalWindow = this.config.contextWindowSize;
    const usedTokens = this.currentUsedTokens;
    const utilizationPercent = usedTokens / totalWindow;
    const autocompactBuffer = Math.floor(totalWindow * 0.165);
    const freeTokens = Math.max(0, totalWindow - usedTokens - autocompactBuffer);

    const degradationRisk = this.calculateDegradationRisk(utilizationPercent);
    const estimatedTurnsRemaining = this.estimateTurnsRemaining(freeTokens);

    // Ensure we have a breakdown
    if (this.currentBreakdown.length === 0) {
      this.rebuildBreakdownEstimate();
    }

    // Normalize percentages
    const normalizedBreakdown = this.currentBreakdown.map(b => ({
      ...b,
      percentage: b.tokens / totalWindow,
    }));

    const snapshot: ContextSnapshot = {
      timestamp: now,
      model: this.currentModel || this.config.model,
      totalWindow,
      usedTokens,
      freeTokens,
      autocompactBuffer,
      utilizationPercent,
      breakdown: normalizedBreakdown,
      degradationRisk,
      estimatedTurnsRemaining,
      metadata: {
        sessionDurationMs,
        messageCount: this.currentMessageCount,
        fileReads: this.currentFileReads,
        toolCalls: this.currentToolCalls,
        mcpServers: this.currentMcpServers,
        memoryFiles: this.currentMemoryFiles,
      },
    };

    this.snapshots.push(snapshot);
    this.recordConsumptionData(snapshot);

    // Check thresholds
    this.checkThresholds(snapshot);

    // Generate suggestions
    this.generateSuggestions(snapshot);

    // Predict
    if (this.alertConfig.predictions.enabled && this.consumptionHistory.length >= this.alertConfig.predictions.minSamples) {
      const prediction = this.predictor.predict(this.consumptionHistory, totalWindow);
      if (prediction.minutesUntilFull && prediction.minutesUntilFull < this.alertConfig.predictions.lookAheadMinutes) {
        this.emitPredictionAlert(snapshot, prediction);
      }
    }

    this.emit('snapshot', snapshot);
    return snapshot;
  }

  /** Get the latest snapshot */
  getLatestSnapshot(): ContextSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  /** Get all snapshots */
  getSnapshots(): ContextSnapshot[] {
    return [...this.snapshots];
  }

  /** Get all alerts */
  getAlerts(): ContextAlert[] {
    return [...this.alerts];
  }

  /** Get active (non-dismissed) alerts */
  getActiveAlerts(): ContextAlert[] {
    return this.alerts.filter(a => !a.dismissed);
  }

  /** Get all suggestions */
  getSuggestions(): OptimizationSuggestion[] {
    return [...this.suggestions];
  }

  /** Dismiss an alert */
  dismissAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.dismissed = true;
      this.emit('alertDismissed', alert);
    }
  }

  /** Get consumption rate statistics */
  getConsumptionRate(): ConsumptionRate {
    if (this.consumptionHistory.length < 2) {
      return {
        tokensPerMinute: 0,
        tokensPerMessage: 0,
        tokensPerFileRead: 0,
        trend: TrendDirection.STABLE,
      };
    }

    const recent = this.consumptionHistory.slice(-10);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    const timeDiff = (newest.timestamp.getTime() - oldest.timestamp.getTime()) / 60000; // minutes

    const tokensPerMinute = timeDiff > 0
      ? (newest.usedTokens - oldest.usedTokens) / timeDiff
      : 0;

    const messagesDiff = newest.messageCount - oldest.messageCount;
    const tokensPerMessage = messagesDiff > 0
      ? (newest.usedTokens - oldest.usedTokens) / messagesDiff
      : 0;

    const filesDiff = newest.fileReads - oldest.fileReads;
    const tokensPerFileRead = filesDiff > 0
      ? (newest.usedTokens - oldest.usedTokens) / filesDiff
      : 0;

    // Calculate trend
    const trend = this.calculateTrend();

    return {
      tokensPerMinute,
      tokensPerMessage: Math.abs(tokensPerMessage),
      tokensPerFileRead: Math.abs(tokensPerFileRead),
      trend,
    };
  }

  /** Get context prediction */
  getPrediction(): ContextPrediction {
    return this.predictor.predict(this.consumptionHistory, this.config.contextWindowSize);
  }

  /** Clear all context (simulate /clear) */
  clearContext(): ContextSnapshot {
    this.currentUsedTokens = this.getBaselineTokens();
    this.currentMessageCount = 0;
    this.currentFileReads = 0;
    this.currentToolCalls = 0;
    this.consumptionHistory = [];
    this.rebuildBreakdownEstimate();

    const snapshot = this.takeSnapshot();
    this.emit('cleared', snapshot);
    return snapshot;
  }

  /** Get baseline tokens (system prompt + tools + MCPs that persist) */
  private getBaselineTokens(): number {
    let baseline = TokenEstimator.estimateSystemPrompt() + TokenEstimator.estimateSystemTools();

    // Add persistent MCP servers
    const mcpBreakdown = this.currentBreakdown.find(
      b => b.category === ContextCategory.MCP_TOOLS
    );
    if (mcpBreakdown) {
      baseline += mcpBreakdown.tokens;
    }

    // Add memory files
    const memoryBreakdown = this.currentBreakdown.find(
      b => b.category === ContextCategory.MEMORY_FILES
    );
    if (memoryBreakdown) {
      baseline += memoryBreakdown.tokens;
    }

    return baseline;
  }

  /** Calculate degradation risk level */
  private calculateDegradationRisk(utilization: number): DegradationRisk {
    const thresholds = this.alertConfig.thresholds;

    if (utilization >= thresholds.critical || utilization >= DEGRADATION_ONSET_THRESHOLD + 0.15) {
      return DegradationRisk.CRITICAL;
    }
    if (utilization >= thresholds.danger || utilization >= DEGRADATION_ONSET_THRESHOLD + 0.05) {
      return DegradationRisk.HIGH;
    }
    if (utilization >= thresholds.caution || utilization >= DEGRADATION_ONSET_THRESHOLD - 0.05) {
      return DegradationRisk.MEDIUM;
    }
    if (utilization >= thresholds.warning) {
      return DegradationRisk.LOW;
    }
    return DegradationRisk.NONE;
  }

  /** Estimate remaining turns based on consumption rate */
  private estimateTurnsRemaining(freeTokens: number): number | null {
    const rate = this.getConsumptionRate();
    if (rate.tokensPerMessage <= 0) return null;
    return Math.floor(freeTokens / rate.tokensPerMessage);
  }

  /** Check thresholds and emit alerts */
  private checkThresholds(snapshot: ContextSnapshot): void {
    const risk = snapshot.degradationRisk;

    if (risk !== this.lastAlertLevel && risk !== DegradationRisk.NONE) {
      const alert: ContextAlert = {
        id: uuidv4(),
        timestamp: new Date(),
        level: risk,
        type: AlertType.THRESHOLD,
        message: this.getAlertMessage(risk, snapshot),
        snapshot,
        suggestedAction: this.getSuggestedAction(risk),
        dismissed: false,
      };

      this.alerts.push(alert);
      this.lastAlertLevel = risk;
      this.emit('alert', alert);

      if (risk === DegradationRisk.CRITICAL || risk === DegradationRisk.HIGH) {
        this.emit('degradation', risk);
      }
    }
  }

  /** Get human-readable alert message */
  private getAlertMessage(risk: DegradationRisk, snapshot: ContextSnapshot): string {
    const used = TokenEstimator.formatTokens(snapshot.usedTokens);
    const total = TokenEstimator.formatTokens(snapshot.totalWindow);
    const pct = TokenEstimator.formatPercent(snapshot.utilizationPercent);

    switch (risk) {
      case DegradationRisk.LOW:
        return `Context at ${pct} (${used}/${total}). Monitor usage.`;
      case DegradationRisk.MEDIUM:
        return `Context at ${pct} (${used}/${total}). Consider using /compact soon.`;
      case DegradationRisk.HIGH:
        return `Context at ${pct} (${used}/${total}). Quality degradation likely. Use /compact or /clear.`;
      case DegradationRisk.CRITICAL:
        return `Context CRITICAL at ${pct} (${used}/${total}). Immediate action required!`;
      default:
        return `Context utilization: ${pct}`;
    }
  }

  /** Get suggested action for risk level */
  private getSuggestedAction(risk: DegradationRisk): string {
    switch (risk) {
      case DegradationRisk.LOW:
        return 'Continue monitoring. Run /context periodically.';
      case DegradationRisk.MEDIUM:
        return 'Run /compact to summarize conversation, or start wrapping up current task.';
      case DegradationRisk.HIGH:
        return 'Run /compact immediately, or /clear if starting a new task. Consider subagents for remaining work.';
      case DegradationRisk.CRITICAL:
        return 'URGENT: Run /clear now or finish immediately. Save any important state first!';
      default:
        return 'No action needed.';
    }
  }

  /** Generate optimization suggestions */
  private generateSuggestions(snapshot: ContextSnapshot): void {
    const newSuggestions: OptimizationSuggestion[] = [];

    // High message count -> suggest /compact
    if (snapshot.metadata.messageCount > 20 && snapshot.utilizationPercent > 0.4) {
      newSuggestions.push({
        id: uuidv4(),
        priority: snapshot.utilizationPercent > 0.7 ? SuggestionPriority.CRITICAL : SuggestionPriority.HIGH,
        category: SuggestionCategory.COMPACT_CONTEXT,
        title: 'Compact Conversation',
        description: `${snapshot.metadata.messageCount} messages accumulating. Use /compact to summarize and free up context.`,
        impactTokens: Math.floor(snapshot.usedTokens * 0.3),
        action: 'Run /compact with instructions on what to preserve',
        command: '/compact Preserve [key decisions] and summarize progress so far',
      });
    }

    // Many file reads -> suggest targeted approach
    if (snapshot.metadata.fileReads > 15) {
      newSuggestions.push({
        id: uuidv4(),
        priority: SuggestionPriority.HIGH,
        category: SuggestionCategory.FILE_STRATEGY,
        title: 'Optimize File Reads',
        description: `${snapshot.metadata.fileReads} files read. Use line ranges and grep before reading full files.`,
        impactTokens: snapshot.metadata.fileReads * 500,
        action: 'Use targeted file reads with line ranges instead of full files',
        command: 'Read specific line ranges: "Look at lines 45-80 in auth.ts"',
      });
    }

    // Many MCP servers -> suggest disabling unused
    if (snapshot.metadata.mcpServers > 3 && snapshot.utilizationPercent > 0.5) {
      const mcpTokens = snapshot.breakdown.find(b => b.category === ContextCategory.MCP_TOOLS)?.tokens ?? 0;
      newSuggestions.push({
        id: uuidv4(),
        priority: SuggestionPriority.MEDIUM,
        category: SuggestionCategory.REMOVE_MCP,
        title: 'Audit MCP Servers',
        description: `${snapshot.metadata.mcpServers} MCP servers consuming ~${TokenEstimator.formatTokens(mcpTokens)} tokens. Disable unused ones.`,
        impactTokens: mcpTokens,
        action: 'Run /mcp to see per-server costs and disable unused servers',
        command: '/mcp',
      });
    }

    // High utilization -> suggest subagent
    if (snapshot.utilizationPercent > 0.6) {
      newSuggestions.push({
        id: uuidv4(),
        priority: SuggestionPriority.HIGH,
        category: SuggestionCategory.SUBAGENT,
        title: 'Delegate to Subagent',
        description: 'Offload self-contained tasks to subagents to isolate their context from the main conversation.',
        impactTokens: Math.floor(snapshot.totalWindow * 0.2),
        action: 'Spawn a subagent for isolated tasks like code review or exploration',
        command: 'Have a subagent [review this code / explore this module / research this topic]',
      });
    }

    // Approaching critical -> suggest /clear
    if (snapshot.utilizationPercent > 0.75) {
      newSuggestions.push({
        id: uuidv4(),
        priority: SuggestionPriority.CRITICAL,
        category: SuggestionCategory.CLEAR_MESSAGES,
        title: 'Clear Context',
        description: 'Context is nearly full. Start fresh for a new task to avoid quality degradation.',
        impactTokens: snapshot.usedTokens - this.getBaselineTokens(),
        action: 'Run /clear to reset context window (save important state first)',
        command: '/clear',
      });
    }

    // Long session -> suggest session management
    const sessionHours = snapshot.metadata.sessionDurationMs / 3600000;
    if (sessionHours > 1.5 && snapshot.utilizationPercent > 0.4) {
      newSuggestions.push({
        id: uuidv4(),
        priority: SuggestionPriority.MEDIUM,
        category: SuggestionCategory.SESSION_MANAGEMENT,
        title: 'Start Fresh Session',
        description: `Session running for ${sessionHours.toFixed(1)} hours. Consider a clean start for new tasks.`,
        impactTokens: Math.floor(snapshot.usedTokens * 0.25),
        action: 'Use /clear or start a new terminal session for unrelated work',
        command: '/clear',
      });
    }

    // Deduplicate suggestions
    const existingIds = new Set(this.suggestions.map(s => s.category + s.title));
    for (const suggestion of newSuggestions) {
      const key = suggestion.category + suggestion.title;
      if (!existingIds.has(key)) {
        this.suggestions.push(suggestion);
        this.emit('suggestion', suggestion);
      }
    }
  }

  /** Emit prediction-based alert */
  private emitPredictionAlert(snapshot: ContextSnapshot, prediction: ContextPrediction): void {
    const alert: ContextAlert = {
      id: uuidv4(),
      timestamp: new Date(),
      level: DegradationRisk.HIGH,
      type: AlertType.PREDICTION,
      message: prediction.minutesUntilFull
        ? `Context predicted full in ~${Math.ceil(prediction.minutesUntilFull)} minutes at current rate`
        : 'Context consumption accelerating - monitor closely',
      snapshot,
      suggestedAction: 'Consider compacting or clearing context soon',
      dismissed: false,
    };

    this.alerts.push(alert);
    this.emit('alert', alert);
  }

  /** Calculate consumption trend */
  private calculateTrend(): TrendDirection {
    if (this.consumptionHistory.length < 5) return TrendDirection.STABLE;

    const recent = this.consumptionHistory.slice(-5);
    const rates: number[] = [];

    for (let i = 1; i < recent.length; i++) {
      const timeDiff = (recent[i].timestamp.getTime() - recent[i - 1].timestamp.getTime()) / 60000;
      const tokenDiff = recent[i].usedTokens - recent[i - 1].usedTokens;
      if (timeDiff > 0) {
        rates.push(tokenDiff / timeDiff);
      }
    }

    if (rates.length < 2) return TrendDirection.STABLE;

    const avgFirstHalf = rates.slice(0, Math.floor(rates.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(rates.length / 2);
    const avgSecondHalf = rates.slice(Math.floor(rates.length / 2)).reduce((a, b) => a + b, 0) / (rates.length - Math.floor(rates.length / 2));

    if (avgSecondHalf > avgFirstHalf * 1.5) return TrendDirection.ACCELERATING;
    if (avgSecondHalf > avgFirstHalf * 1.2) return TrendDirection.RISING;
    if (avgSecondHalf < avgFirstHalf * 0.8) return TrendDirection.FALLING;
    return TrendDirection.STABLE;
  }

  /** Record consumption data point */
  private recordConsumptionData(snapshot: ContextSnapshot): void {
    this.consumptionHistory.push({
      timestamp: snapshot.timestamp,
      usedTokens: snapshot.usedTokens,
      messageCount: snapshot.metadata.messageCount,
      fileReads: snapshot.metadata.fileReads,
    });

    // Trim history to keep memory bounded
    const maxHistory = 1000;
    if (this.consumptionHistory.length > maxHistory) {
      this.consumptionHistory = this.consumptionHistory.slice(-maxHistory);
    }
  }

  /** Rebuild breakdown estimate from current state */
  private rebuildBreakdownEstimate(): void {
    const totalWindow = this.config.contextWindowSize;
    const baseline = this.getBaselineTokens();
    const messageTokens = this.currentUsedTokens - baseline;

    this.currentBreakdown = [
      {
        category: ContextCategory.SYSTEM_PROMPT,
        tokens: TokenEstimator.estimateSystemPrompt(),
        percentage: TokenEstimator.estimateSystemPrompt() / totalWindow,
      },
      {
        category: ContextCategory.SYSTEM_TOOLS,
        tokens: TokenEstimator.estimateSystemTools(),
        percentage: TokenEstimator.estimateSystemTools() / totalWindow,
      },
      {
        category: ContextCategory.MESSAGES,
        tokens: Math.max(0, messageTokens),
        percentage: Math.max(0, messageTokens) / totalWindow,
      },
      {
        category: ContextCategory.FREE_SPACE,
        tokens: Math.max(0, totalWindow - this.currentUsedTokens),
        percentage: Math.max(0, totalWindow - this.currentUsedTokens) / totalWindow,
      },
    ];

    // Add optional categories if present
    const mcpTokens = this.currentMcpServers * 900;
    if (mcpTokens > 0) {
      this.currentBreakdown.push({
        category: ContextCategory.MCP_TOOLS,
        tokens: mcpTokens,
        percentage: mcpTokens / totalWindow,
      });
    }
  }
}
