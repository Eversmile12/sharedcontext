import { OffchainMessageEnvelope } from './envelope';
import { OffchainMessageV1 } from './message-v1';
/**
 * Returns an {@link OffchainMessageEnvelope} object for a given {@link OffchainMessageV1}.
 *
 * This includes the compiled bytes of the offchain message, and a map of signatures. This map will
 * have a key for each address that is required to sign the message. The message envelope will not
 * yet have signatures for any of these signatories.
 */
export declare function compileOffchainMessageV1Envelope(offchainMessage: OffchainMessageV1): OffchainMessageEnvelope;
//# sourceMappingURL=envelope-v1.d.ts.map