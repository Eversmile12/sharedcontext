import { SolanaErrorCode, SolanaErrorCodeWithCause, SolanaErrorCodeWithDeprecatedCause } from './codes';
import { SolanaErrorContext } from './context';
/**
 * A variant of {@link SolanaError} where the `cause` property is deprecated.
 *
 * This type is returned by {@link isSolanaError} when checking for error codes in
 * {@link SolanaErrorCodeWithDeprecatedCause}. Accessing `cause` on these errors will show
 * a deprecation warning in IDEs that support JSDoc `@deprecated` tags.
 */
export interface SolanaErrorWithDeprecatedCause<TErrorCode extends SolanaErrorCodeWithDeprecatedCause = SolanaErrorCodeWithDeprecatedCause> extends Omit<SolanaError<TErrorCode>, 'cause'> {
    /**
     * @deprecated The `cause` property is deprecated for this error code.
     * Use the error's `context` property instead to access relevant error information.
     */
    readonly cause?: unknown;
}
/**
 * A type guard that returns `true` if the input is a {@link SolanaError}, optionally with a
 * particular error code.
 *
 * When the `code` argument is supplied and the input is a {@link SolanaError}, TypeScript will
 * refine the error's {@link SolanaError#context | `context`} property to the type associated with
 * that error code. You can use that context to render useful error messages, or to make
 * context-aware decisions that help your application to recover from the error.
 *
 * @example
 * ```ts
 * import {
 *     SOLANA_ERROR__TRANSACTION__MISSING_SIGNATURE,
 *     SOLANA_ERROR__TRANSACTION__FEE_PAYER_SIGNATURE_MISSING,
 *     isSolanaError,
 * } from '@solana/errors';
 * import { assertIsFullySignedTransaction, getSignatureFromTransaction } from '@solana/transactions';
 *
 * try {
 *     const transactionSignature = getSignatureFromTransaction(tx);
 *     assertIsFullySignedTransaction(tx);
 *     /* ... *\/
 * } catch (e) {
 *     if (isSolanaError(e, SOLANA_ERROR__TRANSACTION__SIGNATURES_MISSING)) {
 *         displayError(
 *             "We can't send this transaction without signatures for these addresses:\n- %s",
 *             // The type of the `context` object is now refined to contain `addresses`.
 *             e.context.addresses.join('\n- '),
 *         );
 *         return;
 *     } else if (isSolanaError(e, SOLANA_ERROR__TRANSACTION__FEE_PAYER_SIGNATURE_MISSING)) {
 *         if (!tx.feePayer) {
 *             displayError('Choose a fee payer for this transaction before sending it');
 *         } else {
 *             displayError('The fee payer still needs to sign for this transaction');
 *         }
 *         return;
 *     }
 *     throw e;
 * }
 * ```
 */
export declare function isSolanaError<TErrorCode extends SolanaErrorCodeWithDeprecatedCause>(e: unknown, code: TErrorCode): e is SolanaErrorWithDeprecatedCause<TErrorCode>;
export declare function isSolanaError<TErrorCode extends SolanaErrorCode>(e: unknown, code?: TErrorCode): e is SolanaError<TErrorCode>;
type SolanaErrorCodedContext = {
    [P in SolanaErrorCode]: Readonly<{
        __code: P;
    }> & (SolanaErrorContext[P] extends undefined ? object : SolanaErrorContext[P]);
};
/**
 * Encapsulates an error's stacktrace, a Solana-specific numeric code that indicates what went
 * wrong, and optional context if the type of error indicated by the code supports it.
 */
export declare class SolanaError<TErrorCode extends SolanaErrorCode = SolanaErrorCode> extends Error {
    /**
     * Indicates the root cause of this {@link SolanaError}, if any.
     *
     * For example, a transaction error might have an instruction error as its root cause. In this
     * case, you will be able to access the instruction error on the transaction error as `cause`.
     */
    readonly cause?: TErrorCode extends SolanaErrorCodeWithCause ? SolanaError : unknown;
    /**
     * Contains context that can assist in understanding or recovering from a {@link SolanaError}.
     */
    readonly context: SolanaErrorCodedContext[TErrorCode];
    constructor(...[code, contextAndErrorOptions]: SolanaErrorContext[TErrorCode] extends undefined ? [code: TErrorCode, errorOptions?: ErrorOptions | undefined] : [code: TErrorCode, contextAndErrorOptions: SolanaErrorContext[TErrorCode] & (ErrorOptions | undefined)]);
}
export {};
//# sourceMappingURL=error.d.ts.map