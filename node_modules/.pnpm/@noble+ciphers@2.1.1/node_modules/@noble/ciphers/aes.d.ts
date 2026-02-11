import { type Cipher, type CipherWithOutput, type PRG, type Uint8ArrayBuffer } from './utils.ts';
/** Key expansion used in CTR. */
declare function expandKeyLE(key: Uint8Array): Uint32Array;
declare function expandKeyDecLE(key: Uint8Array): Uint32Array;
declare function encrypt(xk: Uint32Array, s0: number, s1: number, s2: number, s3: number): {
    s0: number;
    s1: number;
    s2: number;
    s3: number;
};
declare function decrypt(xk: Uint32Array, s0: number, s1: number, s2: number, s3: number): {
    s0: number;
    s1: number;
    s2: number;
    s3: number;
};
declare function ctrCounter(xk: Uint32Array, nonce: Uint8Array, src: Uint8Array, dst?: Uint8Array): Uint8Array;
declare function ctr32(xk: Uint32Array, isLE: boolean, nonce: Uint8Array, src: Uint8Array, dst?: Uint8Array): Uint8Array;
/**
 * **CTR** (Counter Mode): Turns a block cipher into a stream cipher using a counter and IV (nonce).
 * Efficient and parallelizable. Requires a unique nonce per encryption. Unauthenticated: needs MAC.
 */
export declare const ctr: ((key: Uint8Array, nonce: Uint8Array) => CipherWithOutput) & {
    blockSize: number;
    nonceLength: number;
};
/** Options for ECB and CBC. */
export type BlockOpts = {
    disablePadding?: boolean;
};
/**
 * **ECB** (Electronic Codebook): Deterministic encryption; identical plaintext blocks yield
 * identical ciphertexts. Not secure due to pattern leakage.
 * See [AES Penguin](https://words.filippo.io/the-ecb-penguin/).
 */
export declare const ecb: ((key: Uint8Array, opts?: BlockOpts) => CipherWithOutput) & {
    blockSize: number;
};
/**
 * **CBC** (Cipher Block Chaining): Each plaintext block is XORed with the
 * previous block of ciphertext before encryption.
 * Hard to use: requires proper padding and an IV. Unauthenticated: needs MAC.
 */
export declare const cbc: ((key: Uint8Array, iv: Uint8Array, opts?: BlockOpts) => CipherWithOutput) & {
    blockSize: number;
    nonceLength: number;
};
/**
 * CFB: Cipher Feedback Mode. The input for the block cipher is the previous cipher output.
 * Unauthenticated: needs MAC.
 */
export declare const cfb: ((key: Uint8Array, iv: Uint8Array) => CipherWithOutput) & {
    blockSize: number;
    nonceLength: number;
};
/**
 * **GCM** (Galois/Counter Mode): Combines CTR mode with polynomial MAC. Efficient and widely used.
 * Not perfect:
 * a) conservative key wear-out is `2**32` (4B) msgs.
 * b) key wear-out under random nonces is even smaller: `2**23` (8M) messages for `2**-50` chance.
 * c) MAC can be forged: see Poly1305 documentation.
 */
export declare const gcm: ((key: Uint8Array, nonce: Uint8Array, AAD?: Uint8Array) => Cipher) & {
    blockSize: number;
    nonceLength: number;
    tagLength: number;
    varSizeNonce: true;
};
/**
 * **SIV** (Synthetic IV): GCM with nonce-misuse resistance.
 * Repeating nonces reveal only the fact plaintexts are identical.
 * Also suffers from GCM issues: key wear-out limits & MAC forging.
 * See [RFC 8452](https://www.rfc-editor.org/rfc/rfc8452).
 */
export declare const gcmsiv: ((key: Uint8Array, nonce: Uint8Array, AAD?: Uint8Array) => Cipher) & {
    blockSize: number;
    nonceLength: number;
    tagLength: number;
    varSizeNonce: true;
};
declare function encryptBlock(xk: Uint32Array, block: Uint8Array): Uint8Array;
declare function decryptBlock(xk: Uint32Array, block: Uint8Array): Uint8Array;
/**
 * AES-KW (key-wrap). Injects static IV into plaintext, adds counter, encrypts 6 times.
 * Reduces block size from 16 to 8 bytes.
 * For padded version, use aeskwp.
 * [RFC 3394](https://www.rfc-editor.org/rfc/rfc3394/),
 * [NIST.SP.800-38F](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38F.pdf).
 */
export declare const aeskw: ((kek: Uint8Array) => Cipher) & {
    blockSize: number;
};
/**
 * AES-KW, but with padding and allows random keys.
 * Second u32 of IV is used as counter for length.
 * [RFC 5649](https://www.rfc-editor.org/rfc/rfc5649)
 */
export declare const aeskwp: ((kek: Uint8Array) => Cipher) & {
    blockSize: number;
};
declare class _AesCtrDRBG implements PRG {
    readonly blockLen: number;
    private key;
    private nonce;
    private state;
    private reseedCnt;
    constructor(keyLen: number, seed: Uint8Array, personalization?: Uint8Array);
    private update;
    addEntropy(seed: Uint8Array, info?: Uint8Array): void;
    randomBytes(len: number, info?: Uint8Array): Uint8Array;
    clean(): void;
}
export type AesCtrDrbg = (seed: Uint8Array, personalization?: Uint8Array) => _AesCtrDRBG;
/**
 * AES-CTR DRBG 128-bit - CSPRNG (cryptographically secure pseudorandom number generator).
 * It's best to limit usage to non-production, non-critical cases: for example, test-only.
 */
export declare const rngAesCtrDrbg128: AesCtrDrbg;
/**
 * AES-CTR DRBG 256-bit - CSPRNG (cryptographically secure pseudorandom number generator).
 * It's best to limit usage to non-production, non-critical cases: for example, test-only.
 */
export declare const rngAesCtrDrbg256: AesCtrDrbg;
/**
 * Left-shift by one bit and conditionally XOR with 0x87:
 * ```
 * if MSB(L) is equal to 0
 * then    K1 := L << 1;
 * else    K1 := (L << 1) XOR const_Rb;
 * ```
 *
 * Specs: [RFC 4493, Section 2.3](https://www.rfc-editor.org/rfc/rfc4493.html#section-2.3),
 *        [RFC 5297 Section 2.3](https://datatracker.ietf.org/doc/html/rfc5297.html#section-2.3)
 *
 * @returns modified `block` (for chaining)
 */
declare function dbl<T extends Uint8Array>(block: T): T;
/**
 * `a XOR b`, running in-site on `a`.
 * @param a left operand and output
 * @param b right operand
 * @returns `a` (for chaining)
 */
declare function xorBlock<T extends Uint8Array>(a: T, b: Uint8Array): T;
/**
 * xorend as defined in [RFC 5297 Section 2.1](https://datatracker.ietf.org/doc/html/rfc5297.html#section-2.1).
 *
 * ```
 * leftmost(A, len(A)-len(B)) || (rightmost(A, len(B)) xor B)
 * ```
 */
declare function xorend<T extends Uint8Array>(a: T, b: Uint8Array): T;
/**
 * Internal CMAC class.
 */
declare class _CMAC {
    private buffer;
    private destroyed;
    private k1;
    private k2;
    private xk;
    constructor(key: Uint8Array);
    update(data: Uint8Array): _CMAC;
    digest(): Uint8ArrayBuffer;
    destroy(): void;
}
/**
 * AES-CMAC (Cipher-based Message Authentication Code).
 * Specs: [RFC 4493](https://www.rfc-editor.org/rfc/rfc4493.html).
 */
export declare const cmac: {
    (key: Uint8Array, message: Uint8Array): Uint8Array;
    create(key: Uint8Array): _CMAC;
};
/**
 * S2V (Synthetic Initialization Vector) function as described in [RFC 5297 Section 2.4](https://datatracker.ietf.org/doc/html/rfc5297.html#section-2.4).
 *
 * ```
 * S2V(K, S1, ..., Sn) {
 *   if n = 0 then
 *     return V = AES-CMAC(K, <one>)
 *   fi
 *   D = AES-CMAC(K, <zero>)
 *   for i = 1 to n-1 do
 *     D = dbl(D) xor AES-CMAC(K, Si)
 *   done
 *   if len(Sn) >= 128 then
 *     T = Sn xorend D
 *   else
 *     T = dbl(D) xor pad(Sn)
 *   fi
 *   return V = AES-CMAC(K, T)
 * }
 * ```
 *
 * S2V takes a key and a vector of strings S1, S2, ..., Sn and returns a 128-bit string.
 * The S2V function is used to generate a synthetic IV for AES-SIV.
 *
 * @param key - AES key (128, 192, or 256 bits)
 * @param strings - Array of byte arrays to process
 * @returns 128-bit synthetic IV
 */
declare function s2v(key: Uint8Array, strings: Uint8Array[]): Uint8Array;
/** Use `gcmsiv` or `aessiv`. */
export declare const siv: () => never;
/**
 * **SIV**: Synthetic Initialization Vector (SIV) Authenticated Encryption
 * Nonce is derived from the plaintext and AAD using the S2V function.
 * See [RFC 5297](https://datatracker.ietf.org/doc/html/rfc5297.html).
 */
export declare const aessiv: ((key: Uint8Array, ...AAD: Uint8Array[]) => Cipher) & {
    blockSize: number;
    tagLength: number;
};
/** Unsafe low-level internal methods. May change at any time. */
export declare const unsafe: {
    expandKeyLE: typeof expandKeyLE;
    expandKeyDecLE: typeof expandKeyDecLE;
    encrypt: typeof encrypt;
    decrypt: typeof decrypt;
    encryptBlock: typeof encryptBlock;
    decryptBlock: typeof decryptBlock;
    ctrCounter: typeof ctrCounter;
    ctr32: typeof ctr32;
    dbl: typeof dbl;
    xorBlock: typeof xorBlock;
    xorend: typeof xorend;
    s2v: typeof s2v;
};
export {};
//# sourceMappingURL=aes.d.ts.map