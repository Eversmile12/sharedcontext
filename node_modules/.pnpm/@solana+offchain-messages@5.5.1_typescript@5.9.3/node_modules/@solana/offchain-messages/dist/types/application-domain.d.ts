import { Brand, EncodedString } from '@solana/nominal-types';
/**
 * A 32-byte array identifying the application requesting off-chain message signing.
 *
 * This may be any arbitrary bytes. For instance the on-chain address of a program, DAO instance,
 * Candy Machine, et cetera.
 *
 * This field SHOULD be displayed to users as a base58-encoded ASCII string rather than interpreted
 * otherwise.
 */
export type OffchainMessageApplicationDomain = Brand<EncodedString<string, 'base58'>, 'OffchainMessageApplicationDomain'>;
/**
 * A type guard that returns `true` if the input string conforms to the
 * {@link OffchainMessageApplicationDomain} type, and refines its type for use in your program.
 *
 * @example
 * ```ts
 * import { isOffchainMessageApplicationDomain, OffchainMessageV0 } from '@solana/offchain-messages';
 *
 * if (isOffchainMessageApplicationDomain(applicationDomain)) {
 *     // At this point, `applicationDomain` has been refined to an
 *     // `OffchainMessageApplcationDomain` that can be used to craft a message.
 *     const offchainMessage: OffchainMessageV0 = {
 *         applicationDomain:
 *             offchainMessageApplicationDomain('HgHLLXT3BVA5m7x66tEp3YNatXLth1hJwVeCva2T9RNx'),
 *             // ...
 *     };
 * } else {
 *     setError(`${applicationDomain} is not a valid application domain for an offchain message`);
 * }
 * ```
 */
export declare function isOffchainMessageApplicationDomain(putativeApplicationDomain: string): putativeApplicationDomain is OffchainMessageApplicationDomain;
/**
 * From time to time you might acquire a string, that you expect to validate as an offchain message
 * application domain, from an untrusted network API or user input. Use this function to assert that
 * such an arbitrary string is a base58-encoded application domain.
 *
 * @example
 * ```ts
 * import { assertIsOffchainMessageApplicationDomain, OffchainMessageV0 } from '@solana/offchain-messages';
 *
 * // Imagine a function that determines whether an application domain is valid.
 * function handleSubmit() {
 *     // We know only that what the user typed conforms to the `string` type.
 *     const applicationDomain: string = applicationDomainInput.value;
 *     try {
 *         // If this type assertion function doesn't throw, then
 *         // Typescript will upcast `applicationDomain` to `OffchainMessageApplicationDomain`.
 *         assertIsOffchainMessageApplicationDomain(applicationDomain);
 *         // At this point, `applicationDomain` is a `OffchainMessageApplicationDomain` that can be
 *         // used to craft an offchain message.
 *         const offchainMessage: OffchainMessageV0 = {
 *             applicationDomain:
 *                 offchainMessageApplicationDomain('HgHLLXT3BVA5m7x66tEp3YNatXLth1hJwVeCva2T9RNx'),
 *             // ...
 *         };
 *     } catch (e) {
 *         // `applicationDomain` turned out not to be a base58-encoded application domain
 *     }
 * }
 * ```
 */
export declare function assertIsOffchainMessageApplicationDomain(putativeApplicationDomain: string): asserts putativeApplicationDomain is OffchainMessageApplicationDomain;
/**
 * Combines _asserting_ that a string is an offchain message application domain with _coercing_ it
 * to the {@link OffchainMessageApplicationDomain} type. It's most useful with untrusted input.
 *
 * @example
 * ```ts
 * import { offchainMessageApplicationDomain, OffchainMessageV0 } from '@solana/offchain-messages';
 *
 * const offchainMessage: OffchainMessageV0 = {
 *     applicationDomain:
 *         offchainMessageApplicationDomain('HgHLLXT3BVA5m7x66tEp3YNatXLth1hJwVeCva2T9RNx'),
 *     // ...
 * };
 * ```
 *
 * > [!TIP]
 * > When starting from a known-good application domain as a string, it's more efficient to typecast
 * > it rather than to use the {@link offchainMessageApplicationDomain} helper, because the helper
 * > unconditionally performs validation on its input.
 * >
 * > ```ts
 * > import { OffchainMessageApplicationDomain } from '@solana/offchain-messages';
 * >
 * > const applicationDomain =
 * >     'HgHLLXT3BVA5m7x66tEp3YNatXLth1hJwVeCva2T9RNx' as OffchainMessageApplicationDomain;
 * > ```
 */
export declare function offchainMessageApplicationDomain(putativeApplicationDomain: string): OffchainMessageApplicationDomain;
//# sourceMappingURL=application-domain.d.ts.map