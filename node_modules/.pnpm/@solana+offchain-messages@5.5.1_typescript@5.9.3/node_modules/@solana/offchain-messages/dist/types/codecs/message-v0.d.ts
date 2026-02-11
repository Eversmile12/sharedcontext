import { VariableSizeCodec, VariableSizeDecoder, VariableSizeEncoder } from '@solana/codecs-core';
import { OffchainMessageV0 } from '../message-v0';
/**
 * Returns a decoder that you can use to convert a byte array (eg. one that conforms to the
 * {@link OffchainMessageBytes} type) to an {@link OffchainMessageV0} object.
 *
 * @example
 * ```ts
 * import { getOffchainMessageV0Decoder } from '@solana/offchain-messages';
 *
 * const offchainMessageDecoder = getOffchainMessageV0Decoder();
 * const offchainMessage = offchainMessageDecoder.decode(
 *     offchainMessageEnvelope.content,
 * );
 * console.log(`Decoded a v0 offchain message`);
 * ```
 *
 * Throws in the event that the message bytes represent a message of a version other than 0.
 */
export declare function getOffchainMessageV0Decoder(): VariableSizeDecoder<OffchainMessageV0>;
/**
 * Returns an encoder that you can use to encode an {@link OffchainMessageV0} to a byte array
 * appropriate for inclusion in an {@link OffchainMessageEnvelope}.
 */
export declare function getOffchainMessageV0Encoder(): VariableSizeEncoder<OffchainMessageV0>;
/**
 * Returns a codec that you can use to encode from or decode to an {@link OffchainMessageV0}
 *
 * @see {@link getOffchainMessageV0Decoder}
 * @see {@link getOffchainMessageV0Encoder}
 */
export declare function getOffchainMessageV0Codec(): VariableSizeCodec<OffchainMessageV0>;
//# sourceMappingURL=message-v0.d.ts.map