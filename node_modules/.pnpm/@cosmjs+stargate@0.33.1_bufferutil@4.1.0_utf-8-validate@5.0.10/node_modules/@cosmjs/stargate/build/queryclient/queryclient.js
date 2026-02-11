"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryClient = void 0;
const utils_1 = require("@cosmjs/utils");
class QueryClient {
    static withExtensions(cometClient, ...extensionSetups) {
        const client = new QueryClient(cometClient);
        const extensions = extensionSetups.map((setupExtension) => setupExtension(client));
        for (const extension of extensions) {
            (0, utils_1.assert)((0, utils_1.isNonNullObject)(extension), `Extension must be a non-null object`);
            for (const [moduleKey, moduleValue] of Object.entries(extension)) {
                (0, utils_1.assert)((0, utils_1.isNonNullObject)(moduleValue), `Module must be a non-null object. Found type ${typeof moduleValue} for module "${moduleKey}".`);
                const current = client[moduleKey] || {};
                client[moduleKey] = {
                    ...current,
                    ...moduleValue,
                };
            }
        }
        return client;
    }
    constructor(cometClient) {
        this.cometClient = cometClient;
    }
    /**
     * Performs an ABCI query to Tendermint without requesting a proof.
     *
     * If the `desiredHeight` is set, a particular height is requested. Otherwise
     * the latest height is requested. The response contains the actual height of
     * the query.
     */
    async queryAbci(path, request, desiredHeight) {
        const response = await this.cometClient.abciQuery({
            path: path,
            data: request,
            prove: false,
            height: desiredHeight,
        });
        if (response.code) {
            throw new Error(`Query failed with (${response.code}): ${response.log}`);
        }
        if (!response.height) {
            throw new Error("No query height returned");
        }
        return {
            value: response.value,
            height: response.height,
        };
    }
}
exports.QueryClient = QueryClient;
//# sourceMappingURL=queryclient.js.map