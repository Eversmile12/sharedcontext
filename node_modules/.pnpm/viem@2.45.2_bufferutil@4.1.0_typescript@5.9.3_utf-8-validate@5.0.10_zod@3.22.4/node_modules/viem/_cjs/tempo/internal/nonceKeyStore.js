"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = void 0;
exports.create = create;
exports.getCacheKey = getCacheKey;
exports.getEntry = getEntry;
exports.reset = reset;
exports.getNonceKey = getNonceKey;
const Hex = require("ox/Hex");
exports.store = create();
function create() {
    return new Map();
}
function getCacheKey(parameters) {
    return `${parameters.address.toLowerCase()}-${parameters.chainId}`;
}
function getEntry(store, parameters) {
    const key = getCacheKey(parameters);
    let entry = store.get(key);
    if (!entry) {
        entry = { counter: 0, resetScheduled: false };
        store.set(key, entry);
    }
    return entry;
}
function reset(store, parameters) {
    const entry = getEntry(store, parameters);
    entry.counter = 0;
    entry.resetScheduled = false;
}
function getNonceKey(store, parameters) {
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