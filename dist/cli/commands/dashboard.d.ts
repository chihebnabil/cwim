/**
 * Real-time Dashboard Command
 * Provides a live-updating terminal dashboard for context window monitoring.
 */
import { type CWIMConfig, type DashboardTheme } from '../../types/index.js';
interface DashboardOptions {
    refreshRateMs: number;
    model: string;
    windowSize: number;
    showBreakdown: boolean;
    showSuggestions: boolean;
    theme: DashboardTheme;
}
export declare class DashboardCommand {
    private monitor;
    private running;
    private theme;
    private snapshots;
    execute(options: DashboardOptions): Promise<void>;
    private setupTheme;
    private buildConfig;
    private render;
    private renderMiniBar;
    private getRiskColor;
    private getRiskIcon;
    private getTrendDisplay;
    private formatCategory;
    private formatDuration;
    private shutdown;
}
declare module '../../core/ContextMonitor.js' {
    interface ContextMonitor {
        getConfig(): CWIMConfig;
    }
}
export {};
//# sourceMappingURL=dashboard.d.ts.map