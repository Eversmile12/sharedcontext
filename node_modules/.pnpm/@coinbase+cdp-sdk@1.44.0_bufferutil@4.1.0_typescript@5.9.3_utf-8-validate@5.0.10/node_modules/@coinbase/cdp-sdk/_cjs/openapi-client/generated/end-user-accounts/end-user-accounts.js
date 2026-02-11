"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importEndUser = exports.addEndUserSolanaAccount = exports.addEndUserEvmSmartAccount = exports.addEndUserEvmAccount = exports.getEndUser = exports.validateEndUserAccessToken = exports.listEndUsers = exports.createEndUser = void 0;
const cdpApiClient_js_1 = require("../../cdpApiClient.js");
/**
 * Creates an end user. An end user is an entity that can own CDP EVM accounts, EVM smart accounts, and/or Solana accounts. 1 or more authentication methods must be associated with an end user. By default, no accounts are created unless the optional `evmAccount` and/or `solanaAccount` fields are provided.
This API is intended to be used by the developer's own backend, and is authenticated using the developer's CDP API key.
 * @summary Create an end user
 */
const createEndUser = (createEndUserBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/end-users`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: createEndUserBody,
    }, options);
};
exports.createEndUser = createEndUser;
/**
 * Lists the end users belonging to the developer's CDP Project.
By default, the response is sorted by creation date in ascending order and paginated to 20 users per page.
 * @summary List end users
 */
const listEndUsers = (params, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({ url: `/v2/end-users`, method: "GET", params }, options);
};
exports.listEndUsers = listEndUsers;
/**
 * Validates the end user's access token and returns the end user's information. Returns an error if the access token is invalid or expired.

This API is intended to be used by the developer's own backend, and is authenticated using the developer's CDP API key.
 * @summary Validate end user access token
 */
const validateEndUserAccessToken = (validateEndUserAccessTokenBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/end-users/auth/validate-token`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: validateEndUserAccessTokenBody,
    }, options);
};
exports.validateEndUserAccessToken = validateEndUserAccessToken;
/**
 * Gets an end user by ID.

This API is intended to be used by the developer's own backend, and is authenticated using the developer's CDP API key.
 * @summary Get an end user
 */
const getEndUser = (userId, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({ url: `/v2/end-users/${userId}`, method: "GET" }, options);
};
exports.getEndUser = getEndUser;
/**
 * Adds a new EVM EOA account to an existing end user. End users can have up to 10 EVM accounts.
This API is intended to be used by the developer's own backend, and is authenticated using the developer's CDP API key.
 * @summary Add an EVM account to an end user
 */
const addEndUserEvmAccount = (userId, addEndUserEvmAccountBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/end-users/${userId}/evm`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: addEndUserEvmAccountBody,
    }, options);
};
exports.addEndUserEvmAccount = addEndUserEvmAccount;
/**
 * Creates an EVM smart account for an existing end user. The backend will create a new EVM EOA account to serve as the owner of the smart account.
This API is intended to be used by the developer's own backend, and is authenticated using the developer's CDP API key.
 * @summary Add an EVM smart account to an end user
 */
const addEndUserEvmSmartAccount = (userId, addEndUserEvmSmartAccountBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/end-users/${userId}/evm-smart-account`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: addEndUserEvmSmartAccountBody,
    }, options);
};
exports.addEndUserEvmSmartAccount = addEndUserEvmSmartAccount;
/**
 * Adds a new Solana account to an existing end user. End users can have  up to 10 Solana accounts.
This API is intended to be used by the developer's own backend, and is authenticated using the developer's CDP API key.
 * @summary Add a Solana account to an end user
 */
const addEndUserSolanaAccount = (userId, addEndUserSolanaAccountBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/end-users/${userId}/solana`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: addEndUserSolanaAccountBody,
    }, options);
};
exports.addEndUserSolanaAccount = addEndUserSolanaAccount;
/**
 * Imports an existing private key for an end user into the developer's CDP Project. The private key must be encrypted using the CDP SDK's encryption scheme before being sent to this endpoint. This API should be called from the [CDP SDK](https://github.com/coinbase/cdp-sdk) to ensure that the associated private key is properly encrypted.

This endpoint allows developers to import existing keys for their end users, supporting both EVM and Solana key types. The end user must have at least one authentication method configured.
 * @summary Import a private key for an end user
 */
const importEndUser = (importEndUserBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/end-users/import`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: importEndUserBody,
    }, options);
};
exports.importEndUser = importEndUser;
//# sourceMappingURL=end-user-accounts.js.map