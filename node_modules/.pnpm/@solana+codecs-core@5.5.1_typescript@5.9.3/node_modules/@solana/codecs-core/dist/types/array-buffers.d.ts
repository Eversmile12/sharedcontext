import { ReadonlyUint8Array } from './readonly-uint8array';
/**
 * Converts a `Uint8Array` to an `ArrayBuffer`. If the underlying buffer is a `SharedArrayBuffer`,
 * it will be copied to a non-shared buffer, for safety.
 *
 * @remarks
 * Source: https://stackoverflow.com/questions/37228285/uint8array-to-arraybuffer
 */
export declare function toArrayBuffer(bytes: ReadonlyUint8Array | Uint8Array, offset?: number, length?: number): ArrayBuffer;
//# sourceMappingURL=array-buffers.d.ts.map