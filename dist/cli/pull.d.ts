export interface PullCommandOptions {
    wallet?: string;
}
/**
 * Pull context from Arweave and reconstruct locally.
 * Used on a new device to restore all facts.
 */
export declare function pullCommand(options?: PullCommandOptions): Promise<void>;
//# sourceMappingURL=pull.d.ts.map