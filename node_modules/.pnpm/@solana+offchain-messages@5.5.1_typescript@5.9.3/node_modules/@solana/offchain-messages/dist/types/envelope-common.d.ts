import { VariableSizeEncoder } from '@solana/codecs-core';
import { OffchainMessage, OffchainMessageBytes } from './message';
export declare function compileOffchainMessageEnvelopeUsingEncoder<T extends OffchainMessage>(offchainMessage: T, encoder: VariableSizeEncoder<T>): Readonly<{
    content: OffchainMessageBytes;
    signatures: Readonly<{
        [x: import("@solana/nominal-types").NominalType<"brand", "Address"> & import("@solana/nominal-types").NominalType<"stringEncoding", "base58"> & string]: import("@solana/keys").SignatureBytes | null;
    }>;
}>;
//# sourceMappingURL=envelope-common.d.ts.map