import * as Hex from 'ox/Hex';
/** @internal */
export const store = /*#__PURE__*/ create();
/** @internal */
export function create() {
    return new Map();
}
/** @internal */
export function getCacheKey(parameters) {
    return `${parameters.address.toLowerCase()}-${parameters.chainId}`;
}
/** @internal */
export function getEntry(store, parameters) {
    const key = getCacheKey(parameters);
    let entry = store.get(key);
    if (!entry) {
        entry = { counter: 0, resetScheduled: false };
        store.set(key, entry);
    }
    return entry;
}
/** @internal */
export function reset(store, parameters) {
    const entry = getEntry(store, parameters);
    entry.counter = 0;
    entry.resetScheduled = false;
}
/** @internal */
export function getNonceKey(store, parameters) {
    const entry = getEntry(store, parameters);
    if (!entry.resetScheduled) {
        entry.resetScheduled = true;
        queueMicrotask(() => reset(store, parameters));
    }
    const count = entry.counter;
    entry.counter++;
    if (count === 0)
        return 0n;
    return Hex.toBigInt(Hex.random(6));
}
//# sourceMappingURL=nonceKeyStore.js.map