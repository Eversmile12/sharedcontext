import { TurboFactory, EthereumSigner } from "@ardrive/turbo-sdk";
import { Readable } from "node:stream";
/**
 * Turbo SDK implementation of StorageBackend.
 * Uploads encrypted shards to Arweave via ArDrive Turbo.
 */
export class TurboBackend {
    turbo;
    constructor(options) {
        const privKey = options.privateKeyHex.startsWith("0x")
            ? options.privateKeyHex
            : "0x" + options.privateKeyHex;
        const signer = new EthereumSigner(privKey);
        if (options.testnet) {
            this.turbo = TurboFactory.authenticated({
                signer,
                token: "base-eth",
                gatewayUrl: "https://sepolia.base.org",
            });
        }
        else {
            this.turbo = TurboFactory.authenticated({
                signer,
                token: "ethereum",
            });
        }
    }
    async upload(data, tags) {
        const buffer = Buffer.from(data);
        const result = await this.turbo.uploadFile({
            fileStreamFactory: () => Readable.from(buffer),
            fileSizeFactory: () => buffer.length,
            dataItemOpts: {
                tags: tags.map((t) => ({ name: t.name, value: t.value })),
            },
        });
        return { txId: result.id };
    }
    async getBalance() {
        const balance = await this.turbo.getBalance();
        const winc = BigInt(balance.controlledWinc);
        // Rough estimate: 1 shard ~600 bytes, cost ~100 winc per byte
        const estimatedCostPerShard = BigInt(600 * 100);
        const estimated = estimatedCostPerShard > 0n
            ? Number(winc / estimatedCostPerShard)
            : 0;
        return {
            balance: balance.controlledWinc + " winc",
            estimatedUploads: estimated,
        };
    }
}
//# sourceMappingURL=turbo.js.map