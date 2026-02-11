import type { StorageBackend, Tag, UploadResult, BalanceInfo } from "../storage.js";
export interface TurboBackendOptions {
    /** Hex-encoded secp256k1 private key (0x-prefixed or raw) */
    privateKeyHex: string;
    /** Use testnet (Base Sepolia) instead of mainnet */
    testnet?: boolean;
}
/**
 * Turbo SDK implementation of StorageBackend.
 * Uploads encrypted shards to Arweave via ArDrive Turbo.
 */
export declare class TurboBackend implements StorageBackend {
    private turbo;
    constructor(options: TurboBackendOptions);
    upload(data: Uint8Array, tags: Tag[]): Promise<UploadResult>;
    getBalance(): Promise<BalanceInfo>;
}
//# sourceMappingURL=turbo.d.ts.map