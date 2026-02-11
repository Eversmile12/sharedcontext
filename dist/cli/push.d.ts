export interface PushCommandOptions {
    testnet?: boolean;
}
/**
 * Push all local shards to Arweave, plus the identity transaction if not already pushed.
 */
export declare function pushCommand(options?: PushCommandOptions): Promise<void>;
//# sourceMappingURL=push.d.ts.map