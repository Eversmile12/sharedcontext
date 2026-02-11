import { VariableSizeCodec, VariableSizeDecoder, VariableSizeEncoder } from '@solana/codecs-core';
import { OffchainMessage } from '../message';
/**
 * Returns a decoder that you can use to convert a byte array (eg. one that conforms to the
 * {@link OffchainMessageBytes} type) to an {@link OffchainMessage} object.
 *
 * @example
 * ```ts
 * import { getOffchainMessageDecoder } from '@solana/offchain-messages';
 *
 * const offchainMessageDecoder = getOffchainMessageDecoder();
 * const offchainMessage = offchainMessageDecoder.decode(
 *     offchainMessageEnvelope.content,
 * );
 * console.log(`Decoded an offchain message (version: ${offchainMessage.version}`);
 * ```
 *
 * @remarks
 * If the offchain message version is known ahead of time, use one of the decoders specific to that
 * version so as not to bundle more code than you need.
 */
export declare function getOffchainMessageDecoder(): VariableSizeDecoder<OffchainMessage>;
/**
 * Returns an encoder that you can use to encode an {@link OffchainMessage} to a byte array
 * appropriate for inclusion in an {@link OffchainMessageEnvelope}.
 *
 * @remarks
 * If the offchain message version is known ahead of time, use one of the encoders specific to that
 * version so as not to bundle more code than you need.
 */
export declare function getOffchainMessageEncoder(): VariableSizeEncoder<OffchainMessage>;
/**
 * Returns a codec that you can use to encode from or decode to an {@link OffchainMessage}
 *
 * @see {@link getOffchainMessageDecoder}
 * @see {@link getOffchainMessageEncoder}
 *
 * @remarks
 * If the offchain message version is known ahead of time, use one of the codecs specific to that
 * version so as not to bundle more code than you need.
 */
export declare function getOffchainMessageCodec(): VariableSizeCodec<OffchainMessage>;
//# sourceMappingURL=message.d.ts.map