"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendUserOperation = sendUserOperation;
const viem_1 = require("viem");
const getBaseNodeRpcUrl_js_1 = require("../../accounts/evm/getBaseNodeRpcUrl.js");
// Type guards
/**
 * Type guard to check if a BaseCall is a ContractCall.
 *
 * @param call - The BaseCall to check
 * @returns True if the call is a ContractCall
 */
function isContractCall(call) {
    return "abi" in call && "functionName" in call;
}
/**
 * Sends a user operation to the network.
 *
 * @example
 * ```ts
 * import { sendUserOperation } from "@coinbase/cdp-sdk";
 * import { parseEther } from "viem";
 * import { CdpClient } from "@coinbase/cdp-sdk";
 *
 * const client = new CdpClient({
 *   apiKeyId: "your-api-key-id",
 *   apiKeySecret: "your-api-key-secret",
 *   walletSecret: "your-wallet-secret",
 * });
 *
 * const ethAccount = await client.createEvmServerAccount()
 * const smartAccount = await client.createEvmSmartAccount({ owner: ethAccount })
 *
 * const result = await sendUserOperation(client, smartAccount, {
 *   calls: [
 *     {
 *       abi: erc20Abi,
 *       functionName: "transfer",
 *       args: [to, amount],
 *     },
 *     {
 *       to: "0x1234567890123456789012345678901234567890",
 *       data: "0x",
 *       value: parseEther("0.0000005"),
 *     },
 *   ],
 *   network: "base-sepolia",
 *   paymasterUrl: "https://api.developer.coinbase.com/rpc/v1/base/someapikey",
 * });
 * ```
 *
 * @param {CdpOpenApiClientType} client - The client to use to send the user operation.
 * @param {SendUserOperationOptions<T>} options - The options for the user operation.
 * @returns {Promise<SendUserOperationReturnType>} The result of the user operation.
 */
async function sendUserOperation(client, options) {
    const { calls, network, paymasterUrl: _paymasterUrl } = options;
    const paymasterUrl = await (async () => {
        if (!_paymasterUrl && network === "base") {
            return (0, getBaseNodeRpcUrl_js_1.getBaseNodeRpcUrl)("base");
        }
        return _paymasterUrl;
    })();
    if (calls.length === 0) {
        throw new Error("Calls array is empty");
    }
    const encodedCalls = calls.map(call => {
        const baseCall = call;
        const value = (baseCall.value ?? BigInt(0)).toString();
        const overrideGasLimit = baseCall.overrideGasLimit?.toString();
        if (isContractCall(baseCall)) {
            return {
                to: baseCall.to,
                data: (0, viem_1.encodeFunctionData)({
                    abi: baseCall.abi,
                    functionName: baseCall.functionName,
                    args: baseCall.args,
                }),
                value,
                overrideGasLimit,
            };
        }
        const directCall = baseCall;
        return {
            to: directCall.to,
            data: directCall.data ?? "0x",
            value,
            overrideGasLimit,
        };
    });
    const createOpResponse = await client.prepareUserOperation(options.smartAccount.address, {
        network,
        calls: encodedCalls,
        paymasterUrl,
        dataSuffix: options.dataSuffix,
    });
    const owner = options.smartAccount.owners[0];
    const signature = await owner.sign({
        hash: createOpResponse.userOpHash,
    });
    const broadcastResponse = await client.sendUserOperation(options.smartAccount.address, createOpResponse.userOpHash, {
        signature,
    }, options.idempotencyKey);
    return {
        smartAccountAddress: options.smartAccount.address,
        status: broadcastResponse.status,
        userOpHash: createOpResponse.userOpHash,
    };
}
//# sourceMappingURL=sendUserOperation.js.map