import { Address } from '@solana/addresses';
import { NominalType } from '@solana/nominal-types';
import { OffchainMessageEnvelope } from './envelope';
/**
 * Represents an offchain message envelope that is signed by all of its required signers.
 */
export type FullySignedOffchainMessageEnvelope = NominalType<'offchainMessageEnvelopeSignedness', 'fullySigned'>;
/**
 * Represents an address that is required to sign an offchain message for it to be valid.
 */
export type OffchainMessageSignatory<TAddress extends string = string> = Readonly<{
    address: Address<TAddress>;
}>;
/**
 * An offchain message having a list of accounts that must sign it in order for it to be valid.
 */
export interface OffchainMessageWithRequiredSignatories<TSignatory extends OffchainMessageSignatory = OffchainMessageSignatory> {
    requiredSignatories: readonly TSignatory[];
}
/**
 * Given an array of `CryptoKey` objects which are private keys pertaining to addresses that are
 * required to sign an offchain message, this method will return a new signed offchain message
 * envelope of type {@link OffchainMessageEnvelope}.
 *
 * Though the resulting message might be signed by all required signers, this function will not
 * assert that it is. A partially signed message is not complete, but can be serialized and
 * deserialized.
 *
 * @example
 * ```ts
 * import { generateKeyPair } from '@solana/keys';
 * import { partiallySignOffchainMessageEnvelope } from '@solana/offchain-messages';
 *
 * const partiallySignedOffchainMessage = await partiallySignOffchainMessageEnvelope(
 *     [myPrivateKey],
 *     offchainMessageEnvelope,
 * );
 * ```
 *
 * @see {@link signOffchainMessageEnvelope} if you want to assert that the message is signed by all
 * its required signers after signing.
 */
export declare function partiallySignOffchainMessageEnvelope<TOffchainMessageEnvelope extends OffchainMessageEnvelope>(keyPairs: CryptoKeyPair[], offchainMessageEnvelope: TOffchainMessageEnvelope): Promise<TOffchainMessageEnvelope>;
/**
 * Given an array of `CryptoKey` objects which are private keys pertaining to addresses that are
 * required to sign an offchain message envelope, this method will return a new signed envelope of
 * type {@link FullySignedOffchainMessageEnvelope}.
 *
 * This function will throw unless the resulting message is fully signed.
 *
 * @example
 * ```ts
 * import { generateKeyPair } from '@solana/keys';
 * import { signOffchainMessageEnvelope } from '@solana/offchain-messages';
 *
 * const signedOffchainMessage = await signOffchainMessageEnvelope(
 *     [myPrivateKey],
 *     offchainMessageEnvelope,
 * );
 * ```
 *
 * @see {@link partiallySignOffchainMessageEnvelope} if you want to sign the message without
 * asserting that the resulting message envelope is fully signed.
 */
export declare function signOffchainMessageEnvelope<TOffchainMessageEnvelope extends OffchainMessageEnvelope>(keyPairs: CryptoKeyPair[], offchainMessageEnvelope: TOffchainMessageEnvelope): Promise<FullySignedOffchainMessageEnvelope & TOffchainMessageEnvelope>;
/**
 * A type guard that returns `true` if the input {@link OffchainMessageEnvelope} is fully signed,
 * and refines its type for use in your program, adding the
 * {@link FullySignedOffchainMessageEnvelope} type.
 *
 * @example
 * ```ts
 * import { isFullySignedOffchainMessageEnvelope } from '@solana/offchain-messages';
 *
 * const offchainMessageEnvelope = getOffchainMessageDecoder().decode(offchainMessageBytes);
 * if (isFullySignedOffchainMessageEnvelope(offchainMessageEnvelope)) {
 *   // At this point we know that the offchain message is fully signed.
 * }
 * ```
 */
export declare function isFullySignedOffchainMessageEnvelope<TEnvelope extends OffchainMessageEnvelope>(offchainMessage: TEnvelope): offchainMessage is FullySignedOffchainMessageEnvelope & TEnvelope;
/**
 * From time to time you might acquire a {@link OffchainMessageEnvelope}, that you expect to be
 * fully signed, from an untrusted network API or user input. Use this function to assert that such
 * an offchain message is fully signed.
 *
 * @example
 * ```ts
 * import { assertIsFullySignedOffchainMessage } from '@solana/offchain-messages';
 *
 * const offchainMessageEnvelope = getOffchainMessageDecoder().decode(offchainMessageBytes);
 * try {
 *     // If this type assertion function doesn't throw, then Typescript will upcast
 *     // `offchainMessageEnvelope` to `FullySignedOffchainMessageEnvelope`.
 *     assertIsFullySignedOffchainMessageEnvelope(offchainMessage);
 *     // At this point we know that the offchain message is signed by all required signers.
 * } catch(e) {
 *     if (isSolanaError(e, SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATURES_MISSING)) {
 *         setError(`Missing signatures for ${e.context.addresses.join(', ')}`);
 *     } else {
 *         throw e;
 *     }
 * }
 * ```
 */
export declare function assertIsFullySignedOffchainMessageEnvelope<TEnvelope extends OffchainMessageEnvelope>(offchainMessage: TEnvelope): asserts offchainMessage is FullySignedOffchainMessageEnvelope & TEnvelope;
/**
 * Asserts that there are signatures present for all of an offchain message's required signatories,
 * and that those signatures are valid given the message.
 *
 * @example
 * ```ts
 * import { isSolanaError, SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATURE_VERIFICATION_FAILURE } from '@solana/errors';
 * import { verifyOffchainMessageEnvelope } from '@solana/offchain-messages';
 *
 * try {
 *     await verifyOffchainMessageEnvelope(offchainMessageEnvelope);
 *     // At this point the message is valid and signed by all of the required signatories.
 * } catch (e) {
 *     if (isSolanaError(e, SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATURE_VERIFICATION_FAILURE)) {
 *         if (e.context.signatoriesWithMissingSignatures.length) {
 *             console.error(
 *                 'Missing signatures for the following addresses',
 *                 e.context.signatoriesWithMissingSignatures,
 *             );
 *         }
 *         if (e.context.signatoriesWithInvalidSignatures.length) {
 *             console.error(
 *                 'Signatures for the following addresses are invalid',
 *                 e.context.signatoriesWithInvalidSignatures,
 *             );
 *         }
 *     }
 *     throw e;
 * }
 */
export declare function verifyOffchainMessageEnvelope(offchainMessageEnvelope: OffchainMessageEnvelope): Promise<void>;
//# sourceMappingURL=signatures.d.ts.map