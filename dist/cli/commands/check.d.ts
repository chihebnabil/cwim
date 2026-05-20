/**
 * Check Command - Quick context health assessment
 */
interface CheckOptions {
    projectPath: string;
    json: boolean;
}
export declare class CheckCommand {
    execute(options: CheckOptions): Promise<void>;
    private findProjectFiles;
    private analyzeFiles;
    private categorizeFiles;
    private calculateHealth;
    private formatBytes;
}
export {};
//# sourceMappingURL=check.d.ts.map