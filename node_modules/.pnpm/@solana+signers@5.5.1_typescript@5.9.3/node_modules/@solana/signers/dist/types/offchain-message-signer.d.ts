import { OffchainMessageWithRequiredSignatories } from '@solana/offchain-messages';
import { MessageSigner } from './message-signer';
/**
 * Represents a {@link Signer} that is required to sign an offchain message for it to be valid.
 */
export type OffchainMessageSignatorySigner<TAddress extends string = string> = MessageSigner<TAddress>;
/**
 * Extracts and deduplicates all {@link MessageSigner | MessageSigners} stored inside a given
 * {@link OffchainMessageWithSigners | offchain message}.
 *
 * Any extracted signers that share the same {@link Address} will be de-duplicated.
 *
 * @typeParam TAddress - Supply a string literal to define an account having a particular address.
 * @typeParam TSigner - Optionally provide a narrower type for {@link MessageSigner | MessageSigners}.
 * @typeParam TOffchainMessage - The inferred type of the offchain message provided.
 *
 * @example
 * ```ts
 * import { OffchainMessageWithSigners, getSignersFromOffchainMessage } from '@solana/signers';
 *
 * const signerA = { address: address('1111..1111'), signMessages: async () => {} };
 * const signerB = { address: address('2222..2222'), modifyAndSignMessages: async () => {} };
 * const OffchainMessage: OffchainMessageWithSigners = {
 *     /* ... *\/
 *     requiredSignatories: [signerA, signerB],
 * };
 *
 * const messageSigners = getSignersFromOffchainMessage(offchainMessage);
 * // ^ [signerA, signerB]
 * ```
 */
export declare function getSignersFromOffchainMessage({ requiredSignatories, }: OffchainMessageWithRequiredSignatories): readonly MessageSigner[];
//# sourceMappingURL=offchain-message-signer.d.ts.map