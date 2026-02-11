import { VariableSizeDecoder, VariableSizeEncoder } from '@solana/codecs-core';
import { OffchainMessageEnvelope } from '../envelope';
/**
 * Returns an encoder that you can use to encode an {@link OffchainMessageEnvelope} to a byte array
 * appropriate for sharing with a third party for validation.
 */
export declare function getOffchainMessageEnvelopeEncoder(): VariableSizeEncoder<OffchainMessageEnvelope>;
/**
 * Returns a decoder that you can use to convert a byte array in the Solana offchain message format
 * to a {@link OffchainMessageEnvelope} object.
 *
 * @example
 * ```ts
 * import { getOffchainMessageEnvelopeDecoder } from '@solana/offchain-messages';
 *
 * const offchainMessageEnvelopeDecoder = getOffchainMessageEnvelopeDecoder();
 * const offchainMessageEnvelope = offchainMessageEnvelopeDecoder.decode(offchainMessageEnvelopeBytes);
 * for (const [address, signature] in Object.entries(offchainMessageEnvelope.signatures)) {
 *     console.log(`Signature by ${address}`, signature);
 * }
 * ```
 */
export declare function getOffchainMessageEnvelopeDecoder(): VariableSizeDecoder<OffchainMessageEnvelope>;
/**
 * Returns a codec that you can use to encode from or decode to an {@link OffchainMessageEnvelope}
 *
 * @see {@link getOffchainMessageEnvelopeDecoder}
 * @see {@link getOffchainMessageEnvelopeEncoder}
 */
export declare function getOffchainMessageEnvelopeCodec(): import("@solana/codecs-core").VariableSizeCodec<OffchainMessageEnvelope, OffchainMessageEnvelope>;
//# sourceMappingURL=envelope.d.ts.map