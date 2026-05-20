/**
 * Init Command - Initialize CWIM in a project
 */
interface InitOptions {
    projectPath: string;
    plan: string;
    model: string;
}
export declare class InitCommand {
    execute(options: InitOptions): Promise<void>;
}
export {};
//# sourceMappingURL=init.d.ts.map