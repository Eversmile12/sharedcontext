import { FullySignedOffchainMessageEnvelope, OffchainMessage, OffchainMessageEnvelope, OffchainMessageSignatory, OffchainMessageWithRequiredSignatories } from '@solana/offchain-messages';
import { MessagePartialSignerConfig } from './message-partial-signer';
import { OffchainMessageSignatorySigner } from './offchain-message-signer';
/**
 * Extracts all {@link MessageSigner | MessageSigners} inside the provided offchain message and uses
 * them to return a signed offchain message envelope.
 *
 * It first uses all {@link MessageModifyingSigner | MessageModifyingSigners} sequentially before
 * using all {@link MessagePartialSigner | MessagePartialSigners} in parallel.
 *
 * If a composite signer implements both interfaces, it will be used as a
 * {@link MessageModifyingSigner} if no other signer implements that interface. Otherwise, it will
 * be used as a {@link MessagePartialSigner}.
 *
 * @example
 * ```ts
 * const signedOffchainMessageEnvelope = await partiallySignOffchainMessageWithSigners(offchainMessage);
 * ```
 *
 * It also accepts an optional {@link AbortSignal} that will be propagated to all signers.
 *
 * ```ts
 * const signedOffchainMessageEnvelope = await partiallySignOffchainMessageWithSigners(offchainMessage, {
 *     abortSignal: myAbortController.signal,
 * });
 * ```
 *
 * @see {@link signOffchainMessageWithSigners}
 */
export declare function partiallySignOffchainMessageWithSigners(offchainMessage: OffchainMessageWithRequiredSignatories<OffchainMessageSignatory | OffchainMessageSignatorySigner> & Omit<OffchainMessage, 'requiredSignatories'>, config?: MessagePartialSignerConfig): Promise<OffchainMessageEnvelope>;
/**
 * Extracts all {@link MessageSigner | MessageSigners} inside the provided offchain message and uses
 * them to return a signed offchain message envelope before asserting that all signatures required
 * by the message are present.
 *
 * This function delegates to the {@link partiallySignOffchainMessageWithSigners} function
 * in order to extract signers from the offchain message and sign it.
 *
 * @example
 * ```ts
 * const mySignedOffchainMessageEnvelope = await signOffchainMessageWithSigners(myOffchainMessage);
 *
 * // With additional config.
 * const mySignedOffchainMessageEnvelope = await signOffchainMessageWithSigners(myOffchainMessage, {
 *     abortSignal: myAbortController.signal,
 * });
 *
 * // We now know the offchain message is fully signed.
 * mySignedOffchainMessageEnvelope satisfies FullySignedOffchainMessageEnvelope;
 * ```
 *
 * @see {@link partiallySignOffchainMessageWithSigners}
 */
export declare function signOffchainMessageWithSigners(offchainMessage: OffchainMessageWithRequiredSignatories<OffchainMessageSignatory | OffchainMessageSignatorySigner> & Omit<OffchainMessage, 'requiredSignatories'>, config?: MessagePartialSignerConfig): Promise<FullySignedOffchainMessageEnvelope & OffchainMessageEnvelope>;
//# sourceMappingURL=sign-offchain-message.d.ts.map