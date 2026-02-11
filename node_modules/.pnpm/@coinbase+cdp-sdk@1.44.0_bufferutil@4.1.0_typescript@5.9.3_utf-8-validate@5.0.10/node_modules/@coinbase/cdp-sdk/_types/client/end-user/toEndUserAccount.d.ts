import type { EndUserAccount } from "./endUser.types.js";
import type { CdpOpenApiClientType, EndUser as OpenAPIEndUser } from "../../openapi-client/index.js";
/**
 * Options for converting an OpenAPI EndUser to an EndUserAccount with actions.
 */
export type ToEndUserAccountOptions = {
    /** The end user from the API response. */
    endUser: OpenAPIEndUser;
};
/**
 * Creates an EndUserAccount instance with actions from an existing OpenAPI EndUser.
 * This wraps the raw API response and adds convenience methods for adding accounts.
 *
 * @param apiClient - The API client.
 * @param options - Configuration options.
 * @param options.endUser - The end user from the API response.
 * @returns An EndUserAccount instance with action methods.
 */
export declare function toEndUserAccount(apiClient: CdpOpenApiClientType, options: ToEndUserAccountOptions): EndUserAccount;
//# sourceMappingURL=toEndUserAccount.d.ts.map