import { fetchJsonParsedAccounts, assertAccountsDecoded, assertAccountsExist } from '@solana/accounts';
export * from '@solana/accounts';
export * from '@solana/addresses';
export * from '@solana/codecs';
import { isSolanaError, SOLANA_ERROR__INVALID_NONCE, getSolanaErrorFromTransactionError } from '@solana/errors';
export * from '@solana/errors';
export * from '@solana/functional';
export * from '@solana/instructions';
export * from '@solana/instruction-plans';
export * from '@solana/keys';
export * from '@solana/offchain-messages';
export * from '@solana/plugin-core';
export * from '@solana/programs';
export * from '@solana/rpc';
export * from '@solana/rpc-parsed-types';
export * from '@solana/rpc-subscriptions';
import { commitmentComparator } from '@solana/rpc-types';
export * from '@solana/rpc-types';
export * from '@solana/signers';
import { decompileTransactionMessage } from '@solana/transaction-messages';
export * from '@solana/transaction-messages';
import { getBase64EncodedWireTransaction, getSignatureFromTransaction } from '@solana/transactions';
export * from '@solana/transactions';
import { createRecentSignatureConfirmationPromiseFactory, createNonceInvalidationPromiseFactory, createBlockHeightExceedencePromiseFactory, waitForRecentTransactionConfirmationUntilTimeout, getTimeoutPromise, waitForDurableNonceTransactionConfirmation, waitForRecentTransactionConfirmation } from '@solana/transaction-confirmation';
export { createRpcMessage } from '@solana/rpc-spec-types';

// src/index.ts

// src/airdrop-internal.ts
async function requestAndConfirmAirdrop_INTERNAL_ONLY_DO_NOT_EXPORT({
  abortSignal,
  commitment,
  confirmSignatureOnlyTransaction,
  lamports,
  recipientAddress,
  rpc
}) {
  const airdropTransactionSignature = await rpc.requestAirdrop(recipientAddress, lamports, { commitment }).send({ abortSignal });
  await confirmSignatureOnlyTransaction({
    abortSignal,
    commitment,
    signature: airdropTransactionSignature
  });
  return airdropTransactionSignature;
}

// src/airdrop.ts
function airdropFactory({
  rpc,
  rpcSubscriptions
}) {
  const getRecentSignatureConfirmationPromise = createRecentSignatureConfirmationPromiseFactory({
    rpc,
    rpcSubscriptions
  });
  async function confirmSignatureOnlyTransaction(config) {
    await waitForRecentTransactionConfirmationUntilTimeout({
      ...config,
      getRecentSignatureConfirmationPromise,
      getTimeoutPromise
    });
  }
  return async function airdrop(config) {
    return await requestAndConfirmAirdrop_INTERNAL_ONLY_DO_NOT_EXPORT({
      ...config,
      confirmSignatureOnlyTransaction,
      rpc
    });
  };
}
async function fetchAddressesForLookupTables(lookupTableAddresses, rpc, config) {
  if (lookupTableAddresses.length === 0) {
    return {};
  }
  const fetchedLookupTables = await fetchJsonParsedAccounts(
    rpc,
    lookupTableAddresses,
    config
  );
  assertAccountsDecoded(fetchedLookupTables);
  assertAccountsExist(fetchedLookupTables);
  return fetchedLookupTables.reduce((acc, lookup) => {
    return {
      ...acc,
      [lookup.address]: lookup.data.addresses
    };
  }, {});
}

// src/decompile-transaction-message-fetching-lookup-tables.ts
async function decompileTransactionMessageFetchingLookupTables(compiledTransactionMessage, rpc, config) {
  const lookupTables = "addressTableLookups" in compiledTransactionMessage && compiledTransactionMessage.addressTableLookups !== void 0 && compiledTransactionMessage.addressTableLookups.length > 0 ? compiledTransactionMessage.addressTableLookups : [];
  const lookupTableAddresses = lookupTables.map((l) => l.lookupTableAddress);
  const { lastValidBlockHeight, ...fetchAccountsConfig } = config ?? {};
  const addressesByLookupTableAddress = lookupTableAddresses.length > 0 ? await fetchAddressesForLookupTables(lookupTableAddresses, rpc, fetchAccountsConfig) : {};
  return decompileTransactionMessage(compiledTransactionMessage, {
    addressesByLookupTableAddress,
    lastValidBlockHeight
  });
}

// src/get-minimum-balance-for-rent-exemption.ts
function getMinimumBalanceForRentExemption(space) {
  const RENT = {
    ACCOUNT_STORAGE_OVERHEAD: 128n,
    DEFAULT_EXEMPTION_THRESHOLD: 2n,
    DEFAULT_LAMPORTS_PER_BYTE_YEAR: 3480n
  };
  const requiredLamports = (RENT.ACCOUNT_STORAGE_OVERHEAD + space) * RENT.DEFAULT_LAMPORTS_PER_BYTE_YEAR * RENT.DEFAULT_EXEMPTION_THRESHOLD;
  return requiredLamports;
}
function getSendTransactionConfigWithAdjustedPreflightCommitment(commitment, config) {
  if (
    // The developer has supplied no value for `preflightCommitment`.
    !config?.preflightCommitment && // The value of `commitment` is lower than the server default of `preflightCommitment`.
    commitmentComparator(
      commitment,
      "finalized"
      /* default value of `preflightCommitment` */
    ) < 0
  ) {
    return {
      ...config,
      // In the common case, it is unlikely that you want to simulate a transaction at
      // `finalized` commitment when your standard of commitment for confirming the
      // transaction is lower. Cap the simulation commitment level to the level of the
      // confirmation commitment.
      preflightCommitment: commitment
    };
  }
  return config;
}
async function sendTransaction_INTERNAL_ONLY_DO_NOT_EXPORT({
  abortSignal,
  commitment,
  rpc,
  transaction,
  ...sendTransactionConfig
}) {
  const base64EncodedWireTransaction = getBase64EncodedWireTransaction(transaction);
  return await rpc.sendTransaction(base64EncodedWireTransaction, {
    ...getSendTransactionConfigWithAdjustedPreflightCommitment(commitment, sendTransactionConfig),
    encoding: "base64"
  }).send({ abortSignal });
}
async function sendAndConfirmDurableNonceTransaction_INTERNAL_ONLY_DO_NOT_EXPORT({
  abortSignal,
  commitment,
  confirmDurableNonceTransaction,
  rpc,
  transaction,
  ...sendTransactionConfig
}) {
  const transactionSignature = await sendTransaction_INTERNAL_ONLY_DO_NOT_EXPORT({
    ...sendTransactionConfig,
    abortSignal,
    commitment,
    rpc,
    transaction
  });
  await confirmDurableNonceTransaction({
    abortSignal,
    commitment,
    transaction
  });
  return transactionSignature;
}
async function sendAndConfirmTransactionWithBlockhashLifetime_INTERNAL_ONLY_DO_NOT_EXPORT({
  abortSignal,
  commitment,
  confirmRecentTransaction,
  rpc,
  transaction,
  ...sendTransactionConfig
}) {
  const transactionSignature = await sendTransaction_INTERNAL_ONLY_DO_NOT_EXPORT({
    ...sendTransactionConfig,
    abortSignal,
    commitment,
    rpc,
    transaction
  });
  await confirmRecentTransaction({
    abortSignal,
    commitment,
    transaction
  });
  return transactionSignature;
}

// src/send-and-confirm-durable-nonce-transaction.ts
function sendAndConfirmDurableNonceTransactionFactory({
  rpc,
  rpcSubscriptions
}) {
  const getNonceInvalidationPromise = createNonceInvalidationPromiseFactory({ rpc, rpcSubscriptions });
  const getRecentSignatureConfirmationPromise = createRecentSignatureConfirmationPromiseFactory({
    rpc,
    rpcSubscriptions
  });
  function createNonceInvalidationPromiseHandlingRaceCondition(signature) {
    return async function wrappedGetNonceInvalidationPromise(config) {
      try {
        return await getNonceInvalidationPromise(config);
      } catch (e) {
        if (isSolanaError(e, SOLANA_ERROR__INVALID_NONCE)) {
          let status;
          try {
            const { value: statuses } = await rpc.getSignatureStatuses([signature]).send({ abortSignal: config.abortSignal });
            status = statuses[0];
          } catch {
            throw e;
          }
          if (status === null || status === void 0) {
            throw e;
          }
          if (status.confirmationStatus !== null && commitmentComparator(status.confirmationStatus, config.commitment) >= 0) {
            if (status.err !== null) {
              throw getSolanaErrorFromTransactionError(status.err);
            }
            return;
          }
          return await new Promise(() => {
          });
        }
        throw e;
      }
    };
  }
  async function confirmDurableNonceTransaction(config) {
    const wrappedGetNonceInvalidationPromise = createNonceInvalidationPromiseHandlingRaceCondition(
      getSignatureFromTransaction(config.transaction)
    );
    await waitForDurableNonceTransactionConfirmation({
      ...config,
      getNonceInvalidationPromise: wrappedGetNonceInvalidationPromise,
      getRecentSignatureConfirmationPromise
    });
  }
  return async function sendAndConfirmDurableNonceTransaction(transaction, config) {
    await sendAndConfirmDurableNonceTransaction_INTERNAL_ONLY_DO_NOT_EXPORT({
      ...config,
      confirmDurableNonceTransaction,
      rpc,
      transaction
    });
  };
}
function sendAndConfirmTransactionFactory({
  rpc,
  rpcSubscriptions
}) {
  const getBlockHeightExceedencePromise = createBlockHeightExceedencePromiseFactory({
    rpc,
    rpcSubscriptions
  });
  const getRecentSignatureConfirmationPromise = createRecentSignatureConfirmationPromiseFactory({
    rpc,
    rpcSubscriptions
  });
  async function confirmRecentTransaction(config) {
    await waitForRecentTransactionConfirmation({
      ...config,
      getBlockHeightExceedencePromise,
      getRecentSignatureConfirmationPromise
    });
  }
  return async function sendAndConfirmTransaction(transaction, config) {
    await sendAndConfirmTransactionWithBlockhashLifetime_INTERNAL_ONLY_DO_NOT_EXPORT({
      ...config,
      confirmRecentTransaction,
      rpc,
      transaction
    });
  };
}

// src/send-transaction-without-confirming.ts
function sendTransactionWithoutConfirmingFactory({
  rpc
}) {
  return async function sendTransactionWithoutConfirming(transaction, config) {
    await sendTransaction_INTERNAL_ONLY_DO_NOT_EXPORT({
      ...config,
      rpc,
      transaction
    });
  };
}

export { airdropFactory, decompileTransactionMessageFetchingLookupTables, fetchAddressesForLookupTables, getMinimumBalanceForRentExemption, sendAndConfirmDurableNonceTransactionFactory, sendAndConfirmTransactionFactory, sendTransactionWithoutConfirmingFactory };
//# sourceMappingURL=index.browser.mjs.map
//# sourceMappingURL=index.browser.mjs.map