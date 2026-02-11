import { FixedSizeCodec, FixedSizeDecoder, FixedSizeEncoder } from '@solana/codecs-core';
import { OffchainMessageApplicationDomain } from '../application-domain';
/**
 * Returns an encoder that you can use to encode a base58-encoded offchain message application
 * domain to a byte array.
 *
 * @example
 * ```ts
 * import { getOffchainMessageApplicationDomainEncoder } from '@solana/offchain-messages';
 *
 * const offchainMessageApplicationDomain =
 *     'HgHLLXT3BVA5m7x66tEp3YNatXLth1hJwVeCva2T9RNx' as OffchainMessageApplicationDomain;
 * const offchainMessageApplicationDomainEncoder = getOffchainMessageApplicationDomainEncoder();
 * const offchainMessageApplicationDomainBytes =
 *     offchainMessageApplicationDomainEncoder.encode(offchainMessageApplicationDomain);
 * // Uint8Array(32) [
 * //   247, 203,  28,  80,  52, 240, 169,  19,
 * //    21, 103, 107, 119,  91, 235,  13,  48,
 * //   194, 169, 148, 160,  78, 105, 235,  37,
 * //   232, 160,  49,  47,  64,  89,  18, 153,
 * // ]
 * ```
 */
export declare function getOffchainMessageApplicationDomainEncoder(): FixedSizeEncoder<OffchainMessageApplicationDomain, 32>;
/**
 * Returns a decoder that you can use to convert an array of 32 bytes representing an offchain
 * message application domain to the base58-encoded representation of that application domain.
 *
 * @example
 * ```ts
 * import { getOffchainMessageApplicationDomainDecoder } from '@solana/offchain-messages';
 *
 * const offchainMessageApplicationDomainBytes = new Uint8Array([
 *     247, 203,  28,  80,  52, 240, 169,  19,
 *      21, 103, 107, 119,  91, 235,  13,  48,
 *     194, 169, 148, 160,  78, 105, 235,  37,
 *     232, 160,  49,  47,  64,  89,  18, 153,
 * ]);
 * const offchainMessageApplicationDomainDecoder = getOffchainMessageApplicationDomainDecoder();
 * const offchainMessageApplicationDomain =
 *     offchainMessageApplicationDomainDecoder.decode(offchainMessageApplicationDomainBytes);
 *     // HgHLLXT3BVA5m7x66tEp3YNatXLth1hJwVeCva2T9RNx
 * ```
 */
export declare function getOffchainMessageApplicationDomainDecoder(): FixedSizeDecoder<OffchainMessageApplicationDomain, 32>;
/**
 * Returns a codec that you can use to encode from or decode to a base-58 encoded offchain message
 * application domain.
 *
 * @see {@link getOffchainMessageApplicationDomainDecoder}
 * @see {@link getOffchainMessageApplicationDomainEncoder}
 */
export declare function getOffchainMessageApplicationDomainCodec(): FixedSizeCodec<OffchainMessageApplicationDomain, OffchainMessageApplicationDomain, 32>;
//# sourceMappingURL=application-domain.d.ts.map