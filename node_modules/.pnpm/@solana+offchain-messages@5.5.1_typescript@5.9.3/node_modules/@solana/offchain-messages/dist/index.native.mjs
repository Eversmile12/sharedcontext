import { isAddress, assertIsAddress, getAddressEncoder, getAddressDecoder, address, getAddressFromPublicKey, getPublicKeyFromAddress } from '@solana/addresses';
import { isSolanaError, SOLANA_ERROR__ADDRESSES__STRING_LENGTH_OUT_OF_RANGE, SolanaError, SOLANA_ERROR__OFFCHAIN_MESSAGE__APPLICATION_DOMAIN_STRING_LENGTH_OUT_OF_RANGE, SOLANA_ERROR__ADDRESSES__INVALID_BYTE_LENGTH, SOLANA_ERROR__OFFCHAIN_MESSAGE__INVALID_APPLICATION_DOMAIN_BYTE_LENGTH, SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_ENVELOPE_SIGNATURES_CANNOT_BE_ZERO, SOLANA_ERROR__OFFCHAIN_MESSAGE__ENVELOPE_SIGNERS_MISMATCH, SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_SIGNATURES_MISMATCH, SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_REQUIRED_SIGNERS_CANNOT_BE_ZERO, SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_FORMAT_MISMATCH, SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_MUST_BE_NON_EMPTY, SOLANA_ERROR__OFFCHAIN_MESSAGE__RESTRICTED_ASCII_BODY_CHARACTER_OUT_OF_RANGE, SOLANA_ERROR__OFFCHAIN_MESSAGE__MAXIMUM_LENGTH_EXCEEDED, SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_LENGTH_MISMATCH, SOLANA_ERROR__INVARIANT_VIOLATION__SWITCH_MUST_BE_EXHAUSTIVE, SOLANA_ERROR__OFFCHAIN_MESSAGE__VERSION_NUMBER_NOT_SUPPORTED, SOLANA_ERROR__OFFCHAIN_MESSAGE__ADDRESSES_CANNOT_SIGN_OFFCHAIN_MESSAGE, SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATURES_MISSING, SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATURE_VERIFICATION_FAILURE, SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATORIES_MUST_BE_SORTED, SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATORIES_MUST_BE_UNIQUE, SOLANA_ERROR__OFFCHAIN_MESSAGE__UNEXPECTED_VERSION } from '@solana/errors';
import { transformEncoder, combineCodec, transformDecoder, fixDecoderSize, createDecoder, createEncoder, bytesEqual, fixEncoderSize, offsetDecoder } from '@solana/codecs-core';
import { getStructEncoder, getBytesEncoder, getStructDecoder, getArrayDecoder, getBytesDecoder, getTupleDecoder, getTupleEncoder, getHiddenPrefixDecoder, getArrayEncoder, getConstantDecoder, getEnumDecoder, getEnumEncoder, getHiddenPrefixEncoder, getConstantEncoder } from '@solana/codecs-data-structures';
import { getU8Decoder, getU8Encoder, getU16Decoder, getU16Encoder } from '@solana/codecs-numbers';
import { getUtf8Encoder, getUtf8Decoder } from '@solana/codecs-strings';
import { signBytes, verifySignature } from '@solana/keys';

// src/application-domain.ts
function isOffchainMessageApplicationDomain(putativeApplicationDomain) {
  return isAddress(putativeApplicationDomain);
}
function assertIsOffchainMessageApplicationDomain(putativeApplicationDomain) {
  try {
    assertIsAddress(putativeApplicationDomain);
  } catch (error) {
    if (isSolanaError(error, SOLANA_ERROR__ADDRESSES__STRING_LENGTH_OUT_OF_RANGE)) {
      throw new SolanaError(
        SOLANA_ERROR__OFFCHAIN_MESSAGE__APPLICATION_DOMAIN_STRING_LENGTH_OUT_OF_RANGE,
        error.context
      );
    }
    if (isSolanaError(error, SOLANA_ERROR__ADDRESSES__INVALID_BYTE_LENGTH)) {
      throw new SolanaError(
        SOLANA_ERROR__OFFCHAIN_MESSAGE__INVALID_APPLICATION_DOMAIN_BYTE_LENGTH,
        error.context
      );
    }
    throw error;
  }
}
function offchainMessageApplicationDomain(putativeApplicationDomain) {
  assertIsOffchainMessageApplicationDomain(putativeApplicationDomain);
  return putativeApplicationDomain;
}
function getOffchainMessageApplicationDomainEncoder() {
  return transformEncoder(
    getAddressEncoder(),
    (putativeApplicationDomain) => offchainMessageApplicationDomain(putativeApplicationDomain)
  );
}
function getOffchainMessageApplicationDomainDecoder() {
  return getAddressDecoder();
}
function getOffchainMessageApplicationDomainCodec() {
  return combineCodec(getOffchainMessageApplicationDomainEncoder(), getOffchainMessageApplicationDomainDecoder());
}
var OFFCHAIN_MESSAGE_SIGNING_DOMAIN_BYTES = new Uint8Array([
  255,
  115,
  111,
  108,
  97,
  110,
  97,
  32,
  111,
  102,
  102,
  99,
  104,
  97,
  105,
  110
]);
function getOffchainMessageSigningDomainDecoder() {
  return getConstantDecoder(OFFCHAIN_MESSAGE_SIGNING_DOMAIN_BYTES);
}
function getOffchainMessageSigningDomainEncoder() {
  return getConstantEncoder(OFFCHAIN_MESSAGE_SIGNING_DOMAIN_BYTES);
}

// src/codecs/preamble-common.ts
function getSigningDomainPrefixedDecoder(...fields) {
  return getHiddenPrefixDecoder(getStructDecoder(fields), [getOffchainMessageSigningDomainDecoder()]);
}
function getSigningDomainPrefixedEncoder(...fields) {
  return getHiddenPrefixEncoder(getStructEncoder(fields), [getOffchainMessageSigningDomainEncoder()]);
}
function getVersionTransformer(fixedVersion) {
  return (version) => {
    if (version > 1) {
      throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__VERSION_NUMBER_NOT_SUPPORTED, {
        unsupportedVersion: version
      });
    }
    if (fixedVersion != null && version !== fixedVersion) {
      throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__UNEXPECTED_VERSION, {
        actualVersion: version,
        expectedVersion: fixedVersion
      });
    }
    return version;
  };
}
function createOffchainMessagePreambleDecoder(version, ...fields) {
  return getSigningDomainPrefixedDecoder(
    ["version", transformDecoder(getU8Decoder(), getVersionTransformer(version))],
    ...fields
  );
}
function createOffchainMessagePreambleEncoder(version, ...fields) {
  return getSigningDomainPrefixedEncoder(
    ["version", transformEncoder(getU8Encoder(), getVersionTransformer(version))],
    ...fields
  );
}
function decodeRequiredSignatoryAddresses(bytes) {
  const { version, bytesAfterVersion } = getSigningDomainPrefixedDecoder(
    ["version", transformDecoder(getU8Decoder(), getVersionTransformer())],
    ["bytesAfterVersion", getBytesDecoder()]
  ).decode(bytes);
  return offsetDecoder(
    transformDecoder(getArrayDecoder(getAddressDecoder(), { size: getU8Decoder() }), (signatoryAddresses) => {
      if (signatoryAddresses.length === 0) {
        throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_REQUIRED_SIGNERS_CANNOT_BE_ZERO);
      }
      return signatoryAddresses;
    }),
    {
      preOffset: ({ preOffset }) => preOffset + (version === 0 ? 32 + 1 : 0)
    }
  ).decode(bytesAfterVersion);
}
function getSignatoriesComparator() {
  return (x, y) => {
    if (x.length !== y.length) {
      return x.length < y.length ? -1 : 1;
    }
    for (let ii = 0; ii < x.length; ii++) {
      if (x[ii] === y[ii]) {
        continue;
      } else {
        return x[ii] < y[ii] ? -1 : 1;
      }
    }
    return 0;
  };
}
function getSignaturesToEncode(signaturesMap) {
  const signatures = Object.values(signaturesMap);
  if (signatures.length === 0) {
    throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_ENVELOPE_SIGNATURES_CANNOT_BE_ZERO);
  }
  return signatures.map((signature) => {
    if (!signature) {
      return new Uint8Array(64).fill(0);
    }
    return signature;
  });
}
function getSignaturesEncoder() {
  return transformEncoder(
    getArrayEncoder(fixEncoderSize(getBytesEncoder(), 64), { size: getU8Encoder() }),
    getSignaturesToEncode
  );
}

// src/codecs/envelope.ts
function getOffchainMessageEnvelopeEncoder() {
  return transformEncoder(
    getStructEncoder([
      ["signatures", getSignaturesEncoder()],
      ["content", getBytesEncoder()]
    ]),
    (envelope) => {
      const signaturesMapAddresses = Object.keys(envelope.signatures).map(address);
      if (signaturesMapAddresses.length === 0) {
        throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_ENVELOPE_SIGNATURES_CANNOT_BE_ZERO);
      }
      const signatoryAddresses = decodeAndValidateRequiredSignatoryAddresses(envelope.content);
      const missingRequiredSigners = [];
      const unexpectedSigners = [];
      for (const address2 of signatoryAddresses) {
        if (!signaturesMapAddresses.includes(address2)) {
          missingRequiredSigners.push(address2);
        }
      }
      for (const address2 of signaturesMapAddresses) {
        if (!signatoryAddresses.includes(address2)) {
          unexpectedSigners.push(address2);
        }
      }
      if (missingRequiredSigners.length || unexpectedSigners.length) {
        throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__ENVELOPE_SIGNERS_MISMATCH, {
          missingRequiredSigners,
          unexpectedSigners
        });
      }
      const orderedSignatureMap = {};
      for (const address2 of signatoryAddresses) {
        orderedSignatureMap[address2] = envelope.signatures[address2];
      }
      return {
        ...envelope,
        signatures: orderedSignatureMap
      };
    }
  );
}
function getOffchainMessageEnvelopeDecoder() {
  return transformDecoder(
    getStructDecoder([
      ["signatures", getArrayDecoder(fixDecoderSize(getBytesDecoder(), 64), { size: getU8Decoder() })],
      ["content", getBytesDecoder()]
    ]),
    decodePartiallyDecodedOffchainMessageEnvelope
  );
}
function getOffchainMessageEnvelopeCodec() {
  return combineCodec(getOffchainMessageEnvelopeEncoder(), getOffchainMessageEnvelopeDecoder());
}
function decodePartiallyDecodedOffchainMessageEnvelope(offchainMessageEnvelope) {
  const { content, signatures } = offchainMessageEnvelope;
  if (signatures.length === 0) {
    throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_ENVELOPE_SIGNATURES_CANNOT_BE_ZERO);
  }
  const signatoryAddresses = decodeAndValidateRequiredSignatoryAddresses(content);
  if (signatoryAddresses.length !== signatures.length) {
    throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_SIGNATURES_MISMATCH, {
      numRequiredSignatures: signatoryAddresses.length,
      signatoryAddresses,
      signaturesLength: signatures.length
    });
  }
  const signaturesMap = {};
  signatoryAddresses.forEach((address2, index) => {
    const signatureForAddress = signatures[index];
    if (signatureForAddress.every((b) => b === 0)) {
      signaturesMap[address2] = null;
    } else {
      signaturesMap[address2] = signatureForAddress;
    }
  });
  return Object.freeze({
    content,
    signatures: Object.freeze(signaturesMap)
  });
}
function decodeAndValidateRequiredSignatoryAddresses(bytes) {
  const signatoryAddresses = decodeRequiredSignatoryAddresses(bytes);
  if (signatoryAddresses.length === 0) {
    throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_REQUIRED_SIGNERS_CANNOT_BE_ZERO);
  }
  return signatoryAddresses;
}
var MAX_BODY_BYTES = (
  // Largest 16-bit unsigned integer
  65535
);
var MAX_BODY_BYTES_HARDWARE_WALLET_SIGNABLE = (
  // Space remaining in the mininum IPv6 MTU after network header overhead
  1232
);
var OffchainMessageContentFormat = /* @__PURE__ */ ((OffchainMessageContentFormat3) => {
  OffchainMessageContentFormat3[OffchainMessageContentFormat3["RESTRICTED_ASCII_1232_BYTES_MAX"] = 0] = "RESTRICTED_ASCII_1232_BYTES_MAX";
  OffchainMessageContentFormat3[OffchainMessageContentFormat3["UTF8_1232_BYTES_MAX"] = 1] = "UTF8_1232_BYTES_MAX";
  OffchainMessageContentFormat3[OffchainMessageContentFormat3["UTF8_65535_BYTES_MAX"] = 2] = "UTF8_65535_BYTES_MAX";
  return OffchainMessageContentFormat3;
})(OffchainMessageContentFormat || {});
function assertIsOffchainMessageContentRestrictedAsciiOf1232BytesMax(putativeContent) {
  if (putativeContent.format !== 0 /* RESTRICTED_ASCII_1232_BYTES_MAX */) {
    throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_FORMAT_MISMATCH, {
      actualMessageFormat: putativeContent.format,
      expectedMessageFormat: 0 /* RESTRICTED_ASCII_1232_BYTES_MAX */
    });
  }
  if (putativeContent.text.length === 0) {
    throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_MUST_BE_NON_EMPTY);
  }
  if (isTextRestrictedAscii(putativeContent.text) === false) {
    throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__RESTRICTED_ASCII_BODY_CHARACTER_OUT_OF_RANGE);
  }
  const length = getUtf8Encoder().getSizeFromValue(putativeContent.text);
  if (length > MAX_BODY_BYTES_HARDWARE_WALLET_SIGNABLE) {
    throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__MAXIMUM_LENGTH_EXCEEDED, {
      actualBytes: length,
      maxBytes: MAX_BODY_BYTES_HARDWARE_WALLET_SIGNABLE
    });
  }
}
function isOffchainMessageContentRestrictedAsciiOf1232BytesMax(putativeContent) {
  if (putativeContent.format !== 0 /* RESTRICTED_ASCII_1232_BYTES_MAX */ || putativeContent.text.length === 0 || isTextRestrictedAscii(putativeContent.text) === false) {
    return false;
  }
  const length = getUtf8Encoder().getSizeFromValue(putativeContent.text);
  return length <= MAX_BODY_BYTES_HARDWARE_WALLET_SIGNABLE;
}
function offchainMessageContentRestrictedAsciiOf1232BytesMax(text) {
  const putativeContent = Object.freeze({
    format: 0 /* RESTRICTED_ASCII_1232_BYTES_MAX */,
    text
  });
  assertIsOffchainMessageContentRestrictedAsciiOf1232BytesMax(putativeContent);
  return putativeContent;
}
function assertIsOffchainMessageContentUtf8Of1232BytesMax(putativeContent) {
  if (putativeContent.text.length === 0) {
    throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_MUST_BE_NON_EMPTY);
  }
  if (putativeContent.format !== 1 /* UTF8_1232_BYTES_MAX */) {
    throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_FORMAT_MISMATCH, {
      actualMessageFormat: putativeContent.format,
      expectedMessageFormat: 1 /* UTF8_1232_BYTES_MAX */
    });
  }
  const length = getUtf8Encoder().getSizeFromValue(putativeContent.text);
  if (length > MAX_BODY_BYTES_HARDWARE_WALLET_SIGNABLE) {
    throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__MAXIMUM_LENGTH_EXCEEDED, {
      actualBytes: length,
      maxBytes: MAX_BODY_BYTES_HARDWARE_WALLET_SIGNABLE
    });
  }
}
function isOffchainMessageContentUtf8Of1232BytesMax(putativeContent) {
  if (putativeContent.format !== 1 /* UTF8_1232_BYTES_MAX */ || putativeContent.text.length === 0) {
    return false;
  }
  const length = getUtf8Encoder().getSizeFromValue(putativeContent.text);
  return length <= MAX_BODY_BYTES_HARDWARE_WALLET_SIGNABLE;
}
function offchainMessageContentUtf8Of1232BytesMax(text) {
  const putativeContent = Object.freeze({
    format: 1 /* UTF8_1232_BYTES_MAX */,
    text
  });
  assertIsOffchainMessageContentUtf8Of1232BytesMax(putativeContent);
  return putativeContent;
}
function assertIsOffchainMessageContentUtf8Of65535BytesMax(putativeContent) {
  if (putativeContent.format !== 2 /* UTF8_65535_BYTES_MAX */) {
    throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_FORMAT_MISMATCH, {
      actualMessageFormat: putativeContent.format,
      expectedMessageFormat: 2 /* UTF8_65535_BYTES_MAX */
    });
  }
  if (putativeContent.text.length === 0) {
    throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_MUST_BE_NON_EMPTY);
  }
  const length = getUtf8Encoder().getSizeFromValue(putativeContent.text);
  if (length > MAX_BODY_BYTES) {
    throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__MAXIMUM_LENGTH_EXCEEDED, {
      actualBytes: length,
      maxBytes: MAX_BODY_BYTES
    });
  }
}
function isOffchainMessageContentUtf8Of65535BytesMax(putativeContent) {
  if (putativeContent.format !== 2 /* UTF8_65535_BYTES_MAX */ || putativeContent.text.length === 0) {
    return false;
  }
  const length = getUtf8Encoder().getSizeFromValue(putativeContent.text);
  return length <= MAX_BODY_BYTES;
}
function offchainMessageContentUtf8Of65535BytesMax(text) {
  const putativeContent = Object.freeze({
    format: 2 /* UTF8_65535_BYTES_MAX */,
    text
  });
  assertIsOffchainMessageContentUtf8Of65535BytesMax(putativeContent);
  return putativeContent;
}
function isTextRestrictedAscii(putativeRestrictedAsciiString) {
  return /^[\x20-\x7e]+$/.test(putativeRestrictedAsciiString);
}

// src/message-v0.ts
function assertIsOffchainMessageRestrictedAsciiOf1232BytesMax(putativeMessage) {
  assertIsOffchainMessageContentRestrictedAsciiOf1232BytesMax(putativeMessage.content);
}
function assertIsOffchainMessageUtf8Of1232BytesMax(putativeMessage) {
  assertIsOffchainMessageContentUtf8Of1232BytesMax(putativeMessage.content);
}
function assertIsOffchainMessageUtf8Of65535BytesMax(putativeMessage) {
  assertIsOffchainMessageContentUtf8Of65535BytesMax(putativeMessage.content);
}
function getOffchainMessageContentFormatDecoder() {
  return getEnumDecoder(OffchainMessageContentFormat, {
    useValuesAsDiscriminators: true
  });
}
function getOffchainMessageContentFormatEncoder() {
  return getEnumEncoder(OffchainMessageContentFormat, {
    useValuesAsDiscriminators: true
  });
}

// src/codecs/preamble-v0.ts
function getOffchainMessageV0PreambleDecoder() {
  return createOffchainMessagePreambleDecoder(
    /* version */
    0,
    ["applicationDomain", getOffchainMessageApplicationDomainDecoder()],
    ["messageFormat", getOffchainMessageContentFormatDecoder()],
    [
      "requiredSignatories",
      transformDecoder(getArrayDecoder(getAddressDecoder(), { size: getU8Decoder() }), (signatoryAddresses) => {
        if (signatoryAddresses.length === 0) {
          throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_REQUIRED_SIGNERS_CANNOT_BE_ZERO);
        }
        return signatoryAddresses.map((address2) => Object.freeze({ address: address2 }));
      })
    ],
    ["messageLength", getU16Decoder()]
  );
}
function getOffchainMessageV0PreambleEncoder() {
  return createOffchainMessagePreambleEncoder(
    /* version */
    0,
    ["applicationDomain", getOffchainMessageApplicationDomainEncoder()],
    ["messageFormat", getOffchainMessageContentFormatEncoder()],
    [
      "requiredSignatories",
      transformEncoder(
        getArrayEncoder(getAddressEncoder(), { size: getU8Encoder() }),
        (signatoryAddresses) => {
          if (signatoryAddresses.length === 0) {
            throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_REQUIRED_SIGNERS_CANNOT_BE_ZERO);
          }
          return signatoryAddresses.map(({ address: address2 }) => address2);
        }
      )
    ],
    ["messageLength", getU16Encoder()]
  );
}

// src/codecs/message-v0.ts
function getOffchainMessageV0Decoder() {
  return transformDecoder(
    getTupleDecoder([getOffchainMessageV0PreambleDecoder(), getUtf8Decoder()]),
    ([{ messageLength, messageFormat, requiredSignatories, ...preambleRest }, text]) => {
      const actualLength = getUtf8Encoder().getSizeFromValue(text);
      if (messageLength !== actualLength) {
        throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_LENGTH_MISMATCH, {
          actualLength,
          specifiedLength: messageLength
        });
      }
      const offchainMessage = Object.freeze({
        ...preambleRest,
        content: Object.freeze({
          format: messageFormat,
          text
        }),
        requiredSignatories: Object.freeze(requiredSignatories)
      });
      switch (messageFormat) {
        case 0 /* RESTRICTED_ASCII_1232_BYTES_MAX */: {
          assertIsOffchainMessageRestrictedAsciiOf1232BytesMax(offchainMessage);
          return offchainMessage;
        }
        case 1 /* UTF8_1232_BYTES_MAX */: {
          assertIsOffchainMessageUtf8Of1232BytesMax(offchainMessage);
          return offchainMessage;
        }
        case 2 /* UTF8_65535_BYTES_MAX */: {
          assertIsOffchainMessageUtf8Of65535BytesMax(offchainMessage);
          return offchainMessage;
        }
        default: {
          throw new SolanaError(SOLANA_ERROR__INVARIANT_VIOLATION__SWITCH_MUST_BE_EXHAUSTIVE, {
            unexpectedValue: messageFormat
          });
        }
      }
    }
  );
}
function getOffchainMessageV0Encoder() {
  return transformEncoder(
    getTupleEncoder([getOffchainMessageV0PreambleEncoder(), getUtf8Encoder()]),
    (offchainMessage) => {
      const { content, ...preamble } = offchainMessage;
      switch (offchainMessage.content.format) {
        case 0 /* RESTRICTED_ASCII_1232_BYTES_MAX */: {
          assertIsOffchainMessageRestrictedAsciiOf1232BytesMax(offchainMessage);
          break;
        }
        case 1 /* UTF8_1232_BYTES_MAX */: {
          assertIsOffchainMessageUtf8Of1232BytesMax(offchainMessage);
          break;
        }
        case 2 /* UTF8_65535_BYTES_MAX */: {
          assertIsOffchainMessageUtf8Of65535BytesMax(offchainMessage);
          break;
        }
        default: {
          throw new SolanaError(SOLANA_ERROR__INVARIANT_VIOLATION__SWITCH_MUST_BE_EXHAUSTIVE, {
            unexpectedValue: offchainMessage.content
          });
        }
      }
      const messageLength = getUtf8Encoder().getSizeFromValue(content.text);
      const compiledPreamble = {
        ...preamble,
        messageFormat: content.format,
        messageLength
      };
      return [compiledPreamble, content.text];
    }
  );
}
function getOffchainMessageV0Codec() {
  return combineCodec(getOffchainMessageV0Encoder(), getOffchainMessageV0Decoder());
}
function getOffchainMessageV1PreambleDecoder() {
  return createOffchainMessagePreambleDecoder(
    /* version */
    1,
    [
      "requiredSignatories",
      transformDecoder(
        getArrayDecoder(fixDecoderSize(getBytesDecoder(), 32), { size: getU8Decoder() }),
        (signatoryAddressesBytes) => {
          if (signatoryAddressesBytes.length === 0) {
            throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_REQUIRED_SIGNERS_CANNOT_BE_ZERO);
          }
          const comparator = getSignatoriesComparator();
          for (let ii = 0; ii < signatoryAddressesBytes.length - 1; ii++) {
            switch (comparator(signatoryAddressesBytes[ii], signatoryAddressesBytes[ii + 1])) {
              case 0:
                throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATORIES_MUST_BE_UNIQUE);
              case 1:
                throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATORIES_MUST_BE_SORTED);
            }
          }
          const addressDecoder = getAddressDecoder();
          return signatoryAddressesBytes.map(
            (addressBytes) => Object.freeze({
              address: addressDecoder.decode(addressBytes)
            })
          );
        }
      )
    ]
  );
}
function getOffchainMessageV1PreambleEncoder() {
  return createOffchainMessagePreambleEncoder(
    /* version */
    1,
    [
      "requiredSignatories",
      transformEncoder(
        transformEncoder(
          getArrayEncoder(getBytesEncoder(), { size: getU8Encoder() }),
          (signatoryAddressesBytes) => {
            return signatoryAddressesBytes.toSorted(getSignatoriesComparator());
          }
        ),
        (signatoryAddresses) => {
          if (signatoryAddresses.length === 0) {
            throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_REQUIRED_SIGNERS_CANNOT_BE_ZERO);
          }
          const seenSignatories = /* @__PURE__ */ new Set();
          for (const { address: address2 } of signatoryAddresses) {
            if (seenSignatories.has(address2)) {
              throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATORIES_MUST_BE_UNIQUE);
            }
            seenSignatories.add(address2);
          }
          const addressEncoder = getAddressEncoder();
          return signatoryAddresses.map(({ address: address2 }) => addressEncoder.encode(address2));
        }
      )
    ]
  );
}

// src/codecs/message-v1.ts
function getOffchainMessageV1Decoder() {
  return transformDecoder(
    getTupleDecoder([getOffchainMessageV1PreambleDecoder(), getUtf8Decoder()]),
    ([{ requiredSignatories, ...preambleRest }, text]) => {
      if (text.length === 0) {
        throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_MUST_BE_NON_EMPTY);
      }
      return Object.freeze({
        ...preambleRest,
        content: text,
        requiredSignatories: Object.freeze(requiredSignatories)
      });
    }
  );
}
function getOffchainMessageV1Encoder() {
  return transformEncoder(
    getTupleEncoder([getOffchainMessageV1PreambleEncoder(), getUtf8Encoder()]),
    (offchainMessage) => {
      const { content, ...compiledPreamble } = offchainMessage;
      if (content.length === 0) {
        throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_MUST_BE_NON_EMPTY);
      }
      return [compiledPreamble, content];
    }
  );
}
function getOffchainMessageV1Codec() {
  return combineCodec(getOffchainMessageV1Encoder(), getOffchainMessageV1Decoder());
}

// src/codecs/message.ts
function getOffchainMessageDecoder() {
  return createDecoder({
    read(bytes, offset) {
      const version = getHiddenPrefixDecoder(getU8Decoder(), [
        // Discard the signing domain
        getOffchainMessageSigningDomainDecoder()
      ]).decode(bytes, offset);
      switch (version) {
        case 0:
          return getOffchainMessageV0Decoder().read(bytes, offset);
        case 1:
          return getOffchainMessageV1Decoder().read(bytes, offset);
        default:
          throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__VERSION_NUMBER_NOT_SUPPORTED, {
            unsupportedVersion: version
          });
      }
    }
  });
}
function getOffchainMessageEncoder() {
  return createEncoder({
    getSizeFromValue: (offchainMessage) => {
      const { version } = offchainMessage;
      switch (version) {
        case 0:
          return getOffchainMessageV0Encoder().getSizeFromValue(offchainMessage);
        case 1:
          return getOffchainMessageV1Encoder().getSizeFromValue(offchainMessage);
        default:
          throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__VERSION_NUMBER_NOT_SUPPORTED, {
            unsupportedVersion: version
          });
      }
    },
    write: (offchainMessage, bytes, offset) => {
      const { version } = offchainMessage;
      switch (version) {
        case 0:
          return getOffchainMessageV0Encoder().write(offchainMessage, bytes, offset);
        case 1:
          return getOffchainMessageV1Encoder().write(offchainMessage, bytes, offset);
        default:
          throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__VERSION_NUMBER_NOT_SUPPORTED, {
            unsupportedVersion: version
          });
      }
    }
  });
}
function getOffchainMessageCodec() {
  return combineCodec(getOffchainMessageEncoder(), getOffchainMessageDecoder());
}

// src/envelope-common.ts
function compileOffchainMessageEnvelopeUsingEncoder(offchainMessage, encoder) {
  const offchainMessageBytes = encoder.encode(offchainMessage);
  const signatures = {};
  for (const { address: address2 } of offchainMessage.requiredSignatories) {
    signatures[address2] = null;
  }
  return Object.freeze({
    content: offchainMessageBytes,
    signatures: Object.freeze(signatures)
  });
}

// src/envelope-v0.ts
function compileOffchainMessageV0Envelope(offchainMessage) {
  return compileOffchainMessageEnvelopeUsingEncoder(offchainMessage, getOffchainMessageV0Encoder());
}

// src/envelope-v1.ts
function compileOffchainMessageV1Envelope(offchainMessage) {
  return compileOffchainMessageEnvelopeUsingEncoder(offchainMessage, getOffchainMessageV1Encoder());
}

// src/envelope.ts
function compileOffchainMessageEnvelope(offchainMessage) {
  const { version } = offchainMessage;
  switch (version) {
    case 0:
      return compileOffchainMessageV0Envelope(offchainMessage);
    case 1:
      return compileOffchainMessageV1Envelope(offchainMessage);
    default:
      throw new SolanaError(SOLANA_ERROR__INVARIANT_VIOLATION__SWITCH_MUST_BE_EXHAUSTIVE, {
        unexpectedValue: version
      });
  }
}
async function partiallySignOffchainMessageEnvelope(keyPairs, offchainMessageEnvelope) {
  let newSignatures;
  let unexpectedSigners;
  const requiredSignatoryAddresses = decodeRequiredSignatoryAddresses(offchainMessageEnvelope.content);
  await Promise.all(
    keyPairs.map(async (keyPair) => {
      const address2 = await getAddressFromPublicKey(keyPair.publicKey);
      if (!requiredSignatoryAddresses.includes(address2)) {
        unexpectedSigners ||= /* @__PURE__ */ new Set();
        unexpectedSigners.add(address2);
        return;
      }
      if (unexpectedSigners) {
        return;
      }
      const existingSignature = offchainMessageEnvelope.signatures[address2];
      const newSignature = await signBytes(keyPair.privateKey, offchainMessageEnvelope.content);
      if (existingSignature != null && bytesEqual(newSignature, existingSignature)) {
        return;
      }
      newSignatures ||= {};
      newSignatures[address2] = newSignature;
    })
  );
  if (unexpectedSigners && unexpectedSigners.size > 0) {
    throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__ADDRESSES_CANNOT_SIGN_OFFCHAIN_MESSAGE, {
      expectedAddresses: requiredSignatoryAddresses,
      unexpectedAddresses: [...unexpectedSigners]
    });
  }
  if (!newSignatures) {
    return offchainMessageEnvelope;
  }
  return Object.freeze({
    ...offchainMessageEnvelope,
    signatures: Object.freeze({
      ...offchainMessageEnvelope.signatures,
      ...newSignatures
    })
  });
}
async function signOffchainMessageEnvelope(keyPairs, offchainMessageEnvelope) {
  const out = await partiallySignOffchainMessageEnvelope(keyPairs, offchainMessageEnvelope);
  assertIsFullySignedOffchainMessageEnvelope(out);
  Object.freeze(out);
  return out;
}
function isFullySignedOffchainMessageEnvelope(offchainMessage) {
  return Object.entries(offchainMessage.signatures).every(([_, signatureBytes]) => !!signatureBytes);
}
function assertIsFullySignedOffchainMessageEnvelope(offchainMessage) {
  const missingSigs = [];
  Object.entries(offchainMessage.signatures).forEach(([address2, signatureBytes]) => {
    if (!signatureBytes) {
      missingSigs.push(address2);
    }
  });
  if (missingSigs.length > 0) {
    throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATURES_MISSING, {
      addresses: missingSigs
    });
  }
}
async function verifyOffchainMessageEnvelope(offchainMessageEnvelope) {
  let errorContext;
  const requiredSignatories = decodeRequiredSignatoryAddresses(offchainMessageEnvelope.content);
  await Promise.all(
    requiredSignatories.map(async (address2) => {
      const signature = offchainMessageEnvelope.signatures[address2];
      if (signature == null) {
        errorContext ||= {};
        errorContext.signatoriesWithMissingSignatures ||= [];
        errorContext.signatoriesWithMissingSignatures.push(address2);
      } else {
        const publicKey = await getPublicKeyFromAddress(address2);
        if (await verifySignature(publicKey, signature, offchainMessageEnvelope.content)) {
          return true;
        } else {
          errorContext ||= {};
          errorContext.signatoriesWithInvalidSignatures ||= [];
          errorContext.signatoriesWithInvalidSignatures.push(address2);
        }
      }
    })
  );
  if (errorContext) {
    throw new SolanaError(SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATURE_VERIFICATION_FAILURE, errorContext);
  }
}

export { OffchainMessageContentFormat, assertIsFullySignedOffchainMessageEnvelope, assertIsOffchainMessageApplicationDomain, assertIsOffchainMessageContentRestrictedAsciiOf1232BytesMax, assertIsOffchainMessageContentUtf8Of1232BytesMax, assertIsOffchainMessageContentUtf8Of65535BytesMax, assertIsOffchainMessageRestrictedAsciiOf1232BytesMax, assertIsOffchainMessageUtf8Of1232BytesMax, assertIsOffchainMessageUtf8Of65535BytesMax, compileOffchainMessageEnvelope, compileOffchainMessageV0Envelope, compileOffchainMessageV1Envelope, getOffchainMessageApplicationDomainCodec, getOffchainMessageApplicationDomainDecoder, getOffchainMessageApplicationDomainEncoder, getOffchainMessageCodec, getOffchainMessageDecoder, getOffchainMessageEncoder, getOffchainMessageEnvelopeCodec, getOffchainMessageEnvelopeDecoder, getOffchainMessageEnvelopeEncoder, getOffchainMessageV0Codec, getOffchainMessageV0Decoder, getOffchainMessageV0Encoder, getOffchainMessageV1Codec, getOffchainMessageV1Decoder, getOffchainMessageV1Encoder, isFullySignedOffchainMessageEnvelope, isOffchainMessageApplicationDomain, isOffchainMessageContentRestrictedAsciiOf1232BytesMax, isOffchainMessageContentUtf8Of1232BytesMax, isOffchainMessageContentUtf8Of65535BytesMax, offchainMessageApplicationDomain, offchainMessageContentRestrictedAsciiOf1232BytesMax, offchainMessageContentUtf8Of1232BytesMax, offchainMessageContentUtf8Of65535BytesMax, partiallySignOffchainMessageEnvelope, signOffchainMessageEnvelope, verifyOffchainMessageEnvelope };
//# sourceMappingURL=index.native.mjs.map
//# sourceMappingURL=index.native.mjs.map