import {
  settle,
  settle2,
  verify,
  verify2
} from "./chunk-Y62TMQ63.mjs";
import {
  SupportedEVMNetworks,
  SupportedSVMNetworks
} from "./chunk-7OUVQHDC.mjs";

// src/facilitator/facilitator.ts
async function verify3(client, payload, paymentRequirements, config) {
  if (paymentRequirements.scheme === "exact") {
    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      return verify2(
        client,
        payload,
        paymentRequirements
      );
    }
    if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      return await verify(
        client,
        payload,
        paymentRequirements,
        config
      );
    }
  }
  return {
    isValid: false,
    invalidReason: "invalid_scheme",
    payer: SupportedEVMNetworks.includes(paymentRequirements.network) ? payload.payload.authorization.from : ""
  };
}
async function settle3(client, payload, paymentRequirements, config) {
  if (paymentRequirements.scheme === "exact") {
    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      return await settle2(
        client,
        payload,
        paymentRequirements
      );
    }
    if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      return await settle(
        client,
        payload,
        paymentRequirements,
        config
      );
    }
  }
  return {
    success: false,
    errorReason: "invalid_scheme",
    transaction: "",
    network: paymentRequirements.network,
    payer: SupportedEVMNetworks.includes(paymentRequirements.network) ? payload.payload.authorization.from : ""
  };
}

export {
  verify3 as verify,
  settle3 as settle
};
//# sourceMappingURL=chunk-J2TJJ3M3.mjs.map