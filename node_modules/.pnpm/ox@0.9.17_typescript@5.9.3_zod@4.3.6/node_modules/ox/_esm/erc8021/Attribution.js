import * as Hex from '../core/Hex.js';
/**
 * ERC-8021 suffix identifier.
 */
export const ercSuffix = '0x80218021802180218021802180218021';
/**
 * Size of the ERC-8021 suffix (16 bytes).
 */
export const ercSuffixSize = /*#__PURE__*/ Hex.size(ercSuffix);
/**
 * Determines the schema ID for an {@link ox#Attribution.Attribution}.
 *
 * @example
 * ```ts twoslash
 * import { Attribution } from 'ox/erc8021'
 *
 * const schemaId = Attribution.getSchemaId({
 *   codes: ['baseapp']
 * })
 * // @log: 0
 *
 * const schemaId2 = Attribution.getSchemaId({
 *   codes: ['baseapp'],
 *   codeRegistryAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
 * })
 * // @log: 1
 * ```
 *
 * @param attribution - The attribution object.
 * @returns The schema ID (0 for canonical registry, 1 for custom registry).
 */
export function getSchemaId(attribution) {
    if ('codeRegistryAddress' in attribution)
        return 1;
    return 0;
}
/**
 * Converts an {@link ox#Attribution.Attribution} to a data suffix that can be appended to transaction calldata.
 *
 * @example
 * ### Schema 0 (Canonical Registry)
 *
 * ```ts twoslash
 * import { Attribution } from 'ox/erc8021'
 *
 * const suffix = Attribution.toDataSuffix({
 *   codes: ['baseapp', 'morpho']
 * })
 * // @log: '0x626173656170702c6d6f7270686f0e0080218021802180218021802180218021'
 * ```
 *
 * @example
 * ### Schema 1 (Custom Registry)
 *
 * ```ts twoslash
 * import { Attribution } from 'ox/erc8021'
 *
 * const suffix = Attribution.toDataSuffix({
 *   codes: ['baseapp'],
 *   codeRegistryAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
 * })
 * ```
 *
 * @param attribution - The attribution to convert.
 * @returns The data suffix as a {@link ox#Hex.Hex} value.
 */
export function toDataSuffix(attribution) {
    // Encode the codes as ASCII strings separated by commas
    const codesHex = Hex.fromString(attribution.codes.join(','));
    // Get the byte length of the encoded codes
    const codesLength = Hex.size(codesHex);
    // Encode the codes length as 1 byte
    const codesLengthHex = Hex.fromNumber(codesLength, { size: 1 });
    // Determine schema ID
    const schemaId = getSchemaId(attribution);
    const schemaIdHex = Hex.fromNumber(schemaId, { size: 1 });
    // Build the suffix based on schema
    if (schemaId === 1)
        // Schema 1: codeRegistryAddress ∥ codes ∥ codesLength ∥ schemaId ∥ ercSuffix
        return Hex.concat(attribution.codeRegistryAddress.toLowerCase(), codesHex, codesLengthHex, schemaIdHex, ercSuffix);
    // Schema 0: codes ∥ codesLength ∥ schemaId ∥ ercSuffix
    return Hex.concat(codesHex, codesLengthHex, schemaIdHex, ercSuffix);
}
/**
 * Extracts an {@link ox#Attribution.Attribution} from transaction calldata.
 *
 * @example
 * ### Schema 0 (Canonical Registry)
 *
 * ```ts twoslash
 * import { Attribution } from 'ox/erc8021'
 *
 * const attribution = Attribution.fromData(
 *   '0xdddddddd62617365617070070080218021802180218021802180218021'
 * )
 * // @log: { codes: ['baseapp'], id: 0 }
 * ```
 *
 * @example
 * ### Schema 1 (Custom Registry)
 *
 * ```ts twoslash
 * import { Attribution } from 'ox/erc8021'
 *
 * const attribution = Attribution.fromData(
 *   '0xddddddddcccccccccccccccccccccccccccccccccccccccc626173656170702c6d6f7270686f0e0180218021802180218021802180218021'
 * )
 * // @log: {
 * // @log:   codes: ['baseapp', 'morpho'],
 * // @log:   codeRegistryAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
 * // @log:   id: 1
 * // @log: }
 * ```
 *
 * @param data - The transaction calldata containing the attribution suffix.
 * @returns The extracted attribution, or undefined if no valid attribution is found.
 */
export function fromData(data) {
    // Check minimum length: ERC suffix (16 bytes) + schema ID (1 byte) + length (1 byte) = 18 bytes
    const minSize = ercSuffixSize + 1 + 1;
    if (Hex.size(data) < minSize)
        return undefined;
    // Verify ERC suffix is present at the end
    const suffix = Hex.slice(data, -ercSuffixSize);
    if (suffix !== ercSuffix)
        return undefined;
    // Extract schema ID (1 byte before the ERC suffix)
    const schemaIdHex = Hex.slice(data, -ercSuffixSize - 1, -ercSuffixSize);
    const schemaId = Hex.toNumber(schemaIdHex);
    // Schema 0: Canonical registry
    if (schemaId === 0) {
        // Extract codes length (1 byte before schema ID)
        const codesLengthHex = Hex.slice(data, -ercSuffixSize - 2, -ercSuffixSize - 1);
        const codesLength = Hex.toNumber(codesLengthHex);
        // Extract codes
        const codesStart = -ercSuffixSize - 2 - codesLength;
        const codesEnd = -ercSuffixSize - 2;
        const codesHex = Hex.slice(data, codesStart, codesEnd);
        const codesString = Hex.toString(codesHex);
        const codes = codesString.length > 0 ? codesString.split(',') : [];
        return { codes, id: 0 };
    }
    // Schema 1: Custom registry
    // Format: codeRegistryAddress (20 bytes) ∥ codes ∥ codesLength (1 byte) ∥ schemaId (1 byte) ∥ ercSuffix
    if (schemaId === 1) {
        // Extract codes length (1 byte before schema ID)
        const codesLengthHex = Hex.slice(data, -ercSuffixSize - 2, -ercSuffixSize - 1);
        const codesLength = Hex.toNumber(codesLengthHex);
        // Extract codes
        const codesStart = -ercSuffixSize - 2 - codesLength;
        const codesEnd = -ercSuffixSize - 2;
        const codesHex = Hex.slice(data, codesStart, codesEnd);
        const codesString = Hex.toString(codesHex);
        const codes = codesString.length > 0 ? codesString.split(',') : [];
        // Extract registry address (20 bytes before codes)
        const registryStart = codesStart - 20;
        const codeRegistryAddress = Hex.slice(data, registryStart, codesStart);
        return {
            codes,
            codeRegistryAddress,
            id: 1,
        };
    }
    // Unknown schema ID
    return undefined;
}
//# sourceMappingURL=Attribution.js.map