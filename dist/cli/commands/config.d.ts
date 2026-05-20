/**
 * Config Command - Manage CWIM configuration
 */
export declare class ConfigCommand {
    private ensureConfig;
    private saveConfig;
    get(key: string): Promise<void>;
    set(key: string, value: string): Promise<void>;
    list(): Promise<void>;
    reset(): Promise<void>;
    private printObject;
    private getNested;
    private setNested;
    /** Load merged config (defaults + user config) */
    static load(): Record<string, unknown>;
}
//# sourceMappingURL=config.d.ts.map