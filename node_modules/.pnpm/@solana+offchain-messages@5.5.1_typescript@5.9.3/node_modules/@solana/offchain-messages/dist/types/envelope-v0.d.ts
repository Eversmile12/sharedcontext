import { OffchainMessageEnvelope } from './envelope';
import { OffchainMessageV0 } from './message-v0';
/**
 * Returns an {@link OffchainMessageEnvelope} object for a given {@link OffchainMessageV0}.
 *
 * This includes the compiled bytes of the offchain message, and a map of signatures. This map will
 * have a key for each address that is required to sign the message. The message envelope will not
 * yet have signatures for any of these signatories.
 */
export declare function compileOffchainMessageV0Envelope(offchainMessage: OffchainMessageV0): OffchainMessageEnvelope;
//# sourceMappingURL=envelope-v0.d.ts.map