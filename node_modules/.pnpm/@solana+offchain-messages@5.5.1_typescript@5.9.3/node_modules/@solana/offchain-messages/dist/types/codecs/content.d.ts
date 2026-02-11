import { FixedSizeCodec, FixedSizeDecoder, FixedSizeEncoder } from '@solana/codecs-core';
import { OffchainMessageContentFormat } from '../content';
export declare function getOffchainMessageContentFormatDecoder(): FixedSizeDecoder<OffchainMessageContentFormat, 1>;
export declare function getOffchainMessageContentFormatEncoder(): FixedSizeEncoder<OffchainMessageContentFormat, 1>;
export declare function getOffchainMessageContentFormatCodec(): FixedSizeCodec<OffchainMessageContentFormat, OffchainMessageContentFormat, 1>;
//# sourceMappingURL=content.d.ts.map