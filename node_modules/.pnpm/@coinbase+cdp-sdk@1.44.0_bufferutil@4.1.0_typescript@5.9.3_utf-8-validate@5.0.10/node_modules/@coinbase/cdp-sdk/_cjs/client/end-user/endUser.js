"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CDPEndUserClient = void 0;
const crypto_1 = require("crypto");
const bs58_1 = __importDefault(require("bs58"));
const toEndUserAccount_js_1 = require("./toEndUserAccount.js");
const analytics_js_1 = require("../../analytics.js");
const constants_js_1 = require("../../constants.js");
const errors_js_1 = require("../../errors.js");
const index_js_1 = require("../../openapi-client/index.js");
/**
 * The CDP end user client.
 */
class CDPEndUserClient {
    /**
     * Creates an end user. An end user is an entity that can own CDP EVM accounts,
     * EVM smart accounts, and/or Solana accounts.
     *
     * @param options - The options for creating an end user.
     *
     * @returns A promise that resolves to the created end user.
     *
     * @example **Create an end user with an email authentication method**
     *          ```ts
     *          const endUser = await cdp.endUser.createEndUser({
     *            authenticationMethods: [
     *              { type: "email", email: "user@example.com" }
     *            ]
     *          });
     *          console.log(endUser.userId);
     *          ```
     *
     * @example **Create an end user with an EVM EOA account**
     *          ```ts
     *          const endUser = await cdp.endUser.createEndUser({
     *            authenticationMethods: [
     *              { type: "email", email: "user@example.com" }
     *            ],
     *            evmAccount: { createSmartAccount: false }
     *          });
     *          ```
     */
    async createEndUser(options) {
        analytics_js_1.Analytics.trackAction({
            action: "create_end_user",
        });
        const userId = options.userId ?? (0, crypto_1.randomUUID)();
        const endUser = await index_js_1.CdpOpenApiClient.createEndUser({
            ...options,
            userId,
        });
        return (0, toEndUserAccount_js_1.toEndUserAccount)(index_js_1.CdpOpenApiClient, { endUser });
    }
    /**
     * Lists end users belonging to the developer's CDP Project.
     * By default, the response is sorted by creation date in ascending order and paginated to 20 users per page.
     *
     * @param options - The options for listing end users.
     *
     * @returns A promise that resolves to a paginated list of end users.
     *
     * @example **List all end users**
     *          ```ts
     *          const result = await cdp.endUsers.listEndUsers();
     *          console.log(result.endUsers);
     *          ```
     *
     * @example **With pagination**
     *          ```ts
     *          let page = await cdp.endUsers.listEndUsers({ pageSize: 10 });
     *
     *          while (page.nextPageToken) {
     *            page = await cdp.endUsers.listEndUsers({
     *              pageSize: 10,
     *              pageToken: page.nextPageToken
     *            });
     *          }
     *          ```
     *
     * @example **With sorting**
     *          ```ts
     *          const result = await cdp.endUsers.listEndUsers({
     *            sort: ['createdAt=desc']
     *          });
     *          ```
     */
    async listEndUsers(options = {}) {
        analytics_js_1.Analytics.trackAction({
            action: "list_end_users",
        });
        const params = {
            ...options,
            ...(options.sort && { sort: options.sort.join(",") }),
        };
        return index_js_1.CdpOpenApiClient.listEndUsers(params);
    }
    /**
     * Gets an end user by their unique identifier.
     *
     * @param options - The options for getting an end user.
     *
     * @returns A promise that resolves to the end user.
     *
     * @example **Get an end user by ID**
     *          ```ts
     *          const endUser = await cdp.endUser.getEndUser({
     *            userId: "user-123"
     *          });
     *          console.log(endUser.userId);
     *          ```
     */
    async getEndUser(options) {
        analytics_js_1.Analytics.trackAction({
            action: "get_end_user",
        });
        const { userId } = options;
        const endUser = await index_js_1.CdpOpenApiClient.getEndUser(userId);
        return (0, toEndUserAccount_js_1.toEndUserAccount)(index_js_1.CdpOpenApiClient, { endUser });
    }
    /**
     * Adds an EVM EOA (Externally Owned Account) to an existing end user. End users can have up to 10 EVM accounts.
     *
     * @param options - The options for adding an EVM account.
     *
     * @returns A promise that resolves to the newly created EVM EOA account.
     *
     * @example **Add an EVM EOA account to an existing end user**
     *          ```ts
     *          const result = await cdp.endUser.addEndUserEvmAccount({
     *            userId: "user-123"
     *          });
     *          console.log(result.evmAccount.address);
     *          ```
     */
    async addEndUserEvmAccount(options) {
        analytics_js_1.Analytics.trackAction({
            action: "add_end_user_evm_account",
        });
        const { userId } = options;
        return index_js_1.CdpOpenApiClient.addEndUserEvmAccount(userId, {});
    }
    /**
     * Adds an EVM smart account to an existing end user. This also creates a new EVM EOA account to serve as the owner of the smart account.
     *
     * @param options - The options for adding an EVM smart account.
     *
     * @returns A promise that resolves to the newly created EVM smart account.
     *
     * @example **Add an EVM smart account to an existing end user**
     *          ```ts
     *          const result = await cdp.endUser.addEndUserEvmSmartAccount({
     *            userId: "user-123",
     *            enableSpendPermissions: false
     *          });
     *          console.log(result.evmSmartAccount.address);
     *          ```
     *
     * @example **Add an EVM smart account with spend permissions enabled**
     *          ```ts
     *          const result = await cdp.endUser.addEndUserEvmSmartAccount({
     *            userId: "user-123",
     *            enableSpendPermissions: true
     *          });
     *          console.log(result.evmSmartAccount.address);
     *          ```
     */
    async addEndUserEvmSmartAccount(options) {
        analytics_js_1.Analytics.trackAction({
            action: "add_end_user_evm_smart_account",
        });
        const { userId, enableSpendPermissions } = options;
        return index_js_1.CdpOpenApiClient.addEndUserEvmSmartAccount(userId, {
            enableSpendPermissions,
        });
    }
    /**
     * Adds a Solana account to an existing end user. End users can have up to 10 Solana accounts.
     *
     * @param options - The options for adding a Solana account.
     *
     * @returns A promise that resolves to the newly created Solana account.
     *
     * @example **Add a Solana account to an existing end user**
     *          ```ts
     *          const result = await cdp.endUser.addEndUserSolanaAccount({
     *            userId: "user-123"
     *          });
     *          console.log(result.solanaAccount.address);
     *          ```
     */
    async addEndUserSolanaAccount(options) {
        analytics_js_1.Analytics.trackAction({
            action: "add_end_user_solana_account",
        });
        const { userId } = options;
        return index_js_1.CdpOpenApiClient.addEndUserSolanaAccount(userId, {});
    }
    /**
     * Validates an end user's access token. Throws an error if the access token is invalid.
     *
     * @param options - The options for validating an access token.
     *
     * @returns The end user object if the access token is valid.
     */
    async validateAccessToken(options) {
        analytics_js_1.Analytics.trackAction({
            action: "validate_access_token",
        });
        const { accessToken } = options;
        const endUser = await index_js_1.CdpOpenApiClient.validateEndUserAccessToken({
            accessToken,
        });
        return (0, toEndUserAccount_js_1.toEndUserAccount)(index_js_1.CdpOpenApiClient, { endUser });
    }
    /**
     * Imports an existing private key for an end user.
     *
     * @param options - The options for importing an end user.
     *
     * @returns A promise that resolves to the imported end user.
     *
     * @example **Import an end user with an EVM private key**
     *          ```ts
     *          const endUser = await cdp.endUser.importEndUser({
     *            authenticationMethods: [
     *              { type: "sms", phoneNumber: "+12055555555" }
     *            ],
     *            privateKey: "0x...",
     *            keyType: "evm"
     *          });
     *          ```
     *
     * @example **Import an end user with a Solana private key (base58)**
     *          ```ts
     *          const endUser = await cdp.endUser.importEndUser({
     *            authenticationMethods: [
     *              { type: "sms", phoneNumber: "+12055555555" }
     *            ],
     *            privateKey: "3Kzj...",
     *            keyType: "solana"
     *          });
     *          ```
     */
    async importEndUser(options) {
        analytics_js_1.Analytics.trackAction({
            action: "import_end_user",
        });
        const userId = options.userId ?? (0, crypto_1.randomUUID)();
        let privateKeyBytes;
        if (options.keyType === "evm") {
            // EVM: expect hex string (with or without 0x prefix)
            if (typeof options.privateKey !== "string") {
                throw new errors_js_1.UserInputValidationError("EVM private key must be a hex string");
            }
            const privateKeyHex = options.privateKey.startsWith("0x")
                ? options.privateKey.slice(2)
                : options.privateKey;
            if (!/^[0-9a-fA-F]+$/.test(privateKeyHex)) {
                throw new errors_js_1.UserInputValidationError("Private key must be a valid hexadecimal string");
            }
            privateKeyBytes = Buffer.from(privateKeyHex, "hex");
        }
        else {
            // Solana: expect base58 string or raw bytes (32 or 64 bytes)
            if (typeof options.privateKey === "string") {
                privateKeyBytes = bs58_1.default.decode(options.privateKey);
            }
            else {
                privateKeyBytes = options.privateKey;
            }
            if (privateKeyBytes.length !== 32 && privateKeyBytes.length !== 64) {
                throw new errors_js_1.UserInputValidationError("Invalid Solana private key length");
            }
            // Truncate 64-byte keys to 32 bytes (seed only)
            if (privateKeyBytes.length === 64) {
                privateKeyBytes = privateKeyBytes.subarray(0, 32);
            }
        }
        const encryptedPrivateKey = (0, crypto_1.publicEncrypt)({
            key: options.encryptionPublicKey ?? constants_js_1.ImportAccountPublicRSAKey,
            padding: crypto_1.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
        }, privateKeyBytes);
        const endUser = await index_js_1.CdpOpenApiClient.importEndUser({
            userId,
            authenticationMethods: options.authenticationMethods,
            encryptedPrivateKey: encryptedPrivateKey.toString("base64"),
            keyType: options.keyType,
        });
        return (0, toEndUserAccount_js_1.toEndUserAccount)(index_js_1.CdpOpenApiClient, { endUser });
    }
}
exports.CDPEndUserClient = CDPEndUserClient;
//# sourceMappingURL=endUser.js.map