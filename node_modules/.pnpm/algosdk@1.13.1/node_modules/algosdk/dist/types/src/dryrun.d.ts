import AlgodClient from './client/v2/algod/algod';
import { DryrunRequest, DryrunSource } from './client/v2/algod/models/types';
import { SignedTransaction } from './transaction';
/**
 * createDryrun takes an Algod Client (from algod.AlgodV2Client) and an array of Signed Transactions
 * from (transaction.SignedTransaction) and creates a DryrunRequest object with relevant balances
 * @param client - the AlgodClient to make requests against
 * @param txns - the array of SignedTransaction to use for generating the DryrunRequest object
 * @param protocolVersion - the string representing the protocol version to use
 * @param latestTimestamp - the timestamp
 * @returns the DryrunRequest object constructed from the SignedTransactions passed
 */
export declare function createDryrun({ client, txns, protocolVersion, latestTimestamp, round, sources, }: {
    client: AlgodClient;
    txns: SignedTransaction[];
    protocolVersion?: string;
    latestTimestamp?: number | bigint;
    round?: number | bigint;
    sources?: DryrunSource[];
}): Promise<DryrunRequest>;
