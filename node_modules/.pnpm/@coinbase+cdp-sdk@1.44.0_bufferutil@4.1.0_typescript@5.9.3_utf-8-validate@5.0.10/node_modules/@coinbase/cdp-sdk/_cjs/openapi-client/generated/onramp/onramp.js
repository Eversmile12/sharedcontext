"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOnrampSession = exports.getOnrampOrderById = exports.createOnrampOrder = void 0;
const cdpApiClient_js_1 = require("../../cdpApiClient.js");
/**
 * Create a new Onramp order or get a quote for an Onramp order. Either `paymentAmount` or `purchaseAmount` must be provided.

This API currently only supports the payment method `GUEST_CHECKOUT_APPLE_PAY`.

For detailed integration instructions and to get access to this API, refer to the  [Apple Pay Onramp API docs](https://docs.cdp.coinbase.com/onramp-&-offramp/onramp-apis/apple-pay-onramp-api).
 * @summary Create an onramp order
 */
const createOnrampOrder = (createOnrampOrderBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/onramp/orders`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: createOnrampOrderBody,
    }, options);
};
exports.createOnrampOrder = createOnrampOrder;
/**
 * Get an onramp order by ID.
 * @summary Get an onramp order by ID
 */
const getOnrampOrderById = (orderId, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({ url: `/v2/onramp/orders/${orderId}`, method: "GET" }, options);
};
exports.getOnrampOrderById = getOnrampOrderById;
/**
 * Returns a single-use URL for an Onramp session. This API provides flexible  functionality based on the parameters provided, supporting three cases:

**Important**: The returned URL is single-use only. Once a user visits the URL,  no one else can access it.
## Use Cases
### 1. Basic Session (Minimum Parameters)
**Required**: `destinationAddress`, `purchaseCurrency`, `destinationNetwork`

**Returns**: Basic single-use onramp URL. The `quote` object will not be included in the response.
### 2. One-Click Onramp URL
**Required**: Basic parameters + (`paymentAmount` OR `purchaseAmount`), `paymentCurrency`

**Returns**: One-click onramp URL for streamlined checkout. The `quote` object will not be included in the response.
### 3. One-Click Onramp URL with Quote
**Required**: One-Click Onramp parameters + `paymentMethod`, `country`, `subdivision`

**Returns**: Complete pricing quote and one-click onramp URL. Both `session` and `quote` objects will be included in the response.

**Note**: Only one of `paymentAmount` or `purchaseAmount` should be provided, not both. Providing both will result in an error. When `paymentAmount` is provided, the quote shows how much crypto the user will receive for the specified fiat amount (fee-inclusive). When `purchaseAmount` is provided, the quote shows how much fiat the user needs to pay for the specified crypto amount (fee-exclusive).
 * @summary Create an onramp session
 */
const createOnrampSession = (createOnrampSessionBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/onramp/sessions`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: createOnrampSessionBody,
    }, options);
};
exports.createOnrampSession = createOnrampSession;
//# sourceMappingURL=onramp.js.map