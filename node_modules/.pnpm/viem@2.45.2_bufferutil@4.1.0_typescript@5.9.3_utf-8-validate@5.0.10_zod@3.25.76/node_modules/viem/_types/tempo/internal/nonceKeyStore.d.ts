import type { Address } from 'abitype';
type Parameters = {
    address: Address;
    chainId: number;
};
type Store = Map<string, {
    counter: number;
    resetScheduled: boolean;
}>;
/** @internal */
export declare const store: Store;
/** @internal */
export declare function create(): Store;
/** @internal */
export declare function getCacheKey(parameters: Parameters): string;
/** @internal */
export declare function getEntry(store: Store, parameters: Parameters): {
    counter: number;
    resetScheduled: boolean;
};
/** @internal */
export declare function reset(store: Store, parameters: Parameters): void;
/** @internal */
export declare function getNonceKey(store: Store, parameters: Parameters): bigint;
export {};
//# sourceMappingURL=nonceKeyStore.d.ts.map