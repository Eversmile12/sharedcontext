import { type ValidateAccessTokenOptions, type ListEndUsersOptions, type CreateEndUserOptions, type GetEndUserOptions, type ImportEndUserOptions, type AddEndUserEvmAccountOptions, type AddEndUserEvmAccountResult, type AddEndUserEvmSmartAccountOptions, type AddEndUserEvmSmartAccountResult, type AddEndUserSolanaAccountOptions, type AddEndUserSolanaAccountResult, type EndUserAccount } from "./endUser.types.js";
import { type ListEndUsers200 } from "../../openapi-client/index.js";
/**
 * The CDP end user client.
 */
export declare class CDPEndUserClient {
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
    createEndUser(options: CreateEndUserOptions): Promise<EndUserAccount>;
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
    listEndUsers(options?: ListEndUsersOptions): Promise<ListEndUsers200>;
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
    getEndUser(options: GetEndUserOptions): Promise<EndUserAccount>;
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
    addEndUserEvmAccount(options: AddEndUserEvmAccountOptions): Promise<AddEndUserEvmAccountResult>;
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
    addEndUserEvmSmartAccount(options: AddEndUserEvmSmartAccountOptions): Promise<AddEndUserEvmSmartAccountResult>;
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
    addEndUserSolanaAccount(options: AddEndUserSolanaAccountOptions): Promise<AddEndUserSolanaAccountResult>;
    /**
     * Validates an end user's access token. Throws an error if the access token is invalid.
     *
     * @param options - The options for validating an access token.
     *
     * @returns The end user object if the access token is valid.
     */
    validateAccessToken(options: ValidateAccessTokenOptions): Promise<EndUserAccount>;
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
    importEndUser(options: ImportEndUserOptions): Promise<EndUserAccount>;
}
//# sourceMappingURL=endUser.d.ts.map