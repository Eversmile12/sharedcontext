import { VariableSizeCodec, VariableSizeDecoder, VariableSizeEncoder } from '@solana/codecs-core';
import { OffchainMessageV1 } from '../message-v1';
/**
 * Returns a decoder that you can use to convert a byte array (eg. one that conforms to the
 * {@link OffchainMessageBytes} type) to an {@link OffchainMessageV1} object.
 *
 * @example
 * ```ts
 * import { getOffchainMessageV1Decoder } from '@solana/offchain-messages';
 *
 * const offchainMessageDecoder = getOffchainMessageV1Decoder();
 * const offchainMessage = offchainMessageDecoder.decode(
 *     offchainMessageEnvelope.content,
 * );
 * console.log(`Decoded a v1 offchain message`);
 * ```
 *
 * Throws in the event that the message bytes represent a message of a version other than 1.
 */
export declare function getOffchainMessageV1Decoder(): VariableSizeDecoder<OffchainMessageV1>;
/**
 * Returns an encoder that you can use to encode an {@link OffchainMessageV1} to a byte array
 * appropriate for inclusion in an {@link OffchainMessageEnvelope}.
 */
export declare function getOffchainMessageV1Encoder(): VariableSizeEncoder<OffchainMessageV1>;
/**
 * Returns a codec that you can use to encode from or decode to an {@link OffchainMessageV1}
 *
 * @see {@link getOffchainMessageV1Decoder}
 * @see {@link getOffchainMessageV1Encoder}
 */
export declare function getOffchainMessageV1Codec(): VariableSizeCodec<OffchainMessageV1>;
//# sourceMappingURL=message-v1.d.ts.map