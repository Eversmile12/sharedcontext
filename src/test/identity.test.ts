import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateKeypair,
  deriveKeypairFromPhrase,
  addressFromPublicKey,
  publicKeyFromPrivate,
  signShard,
  verifySignature,
} from "../core/identity.js";

describe("identity", () => {
  describe("generateKeypair", () => {
    it("returns 32-byte private key", () => {
      const kp = generateKeypair();
      assert.equal(kp.privateKey.length, 32);
    });

    it("returns 33-byte compressed public key", () => {
      const kp = generateKeypair();
      assert.equal(kp.publicKey.length, 33);
    });

    it("returns 0x-prefixed 42-char address", () => {
      const kp = generateKeypair();
      assert.ok(kp.address.startsWith("0x"));
      assert.equal(kp.address.length, 42);
    });

    it("generates different keypairs each call", () => {
      const a = generateKeypair();
      const b = generateKeypair();
      assert.notDeepEqual(a.privateKey, b.privateKey);
      assert.notEqual(a.address, b.address);
    });
  });

  describe("deriveKeypairFromPhrase", () => {
    it("returns 32-byte private key", () => {
      const kp = deriveKeypairFromPhrase("test phrase for sharme");
      assert.equal(kp.privateKey.length, 32);
    });

    it("returns 33-byte compressed public key", () => {
      const kp = deriveKeypairFromPhrase("test phrase for sharme");
      assert.equal(kp.publicKey.length, 33);
    });

    it("returns 0x-prefixed 42-char address", () => {
      const kp = deriveKeypairFromPhrase("test phrase for sharme");
      assert.ok(kp.address.startsWith("0x"));
      assert.equal(kp.address.length, 42);
    });

    it("same phrase produces same keypair (deterministic)", () => {
      const a = deriveKeypairFromPhrase("marble clock river absent trophy notable");
      const b = deriveKeypairFromPhrase("marble clock river absent trophy notable");
      assert.deepEqual(a.privateKey, b.privateKey);
      assert.deepEqual(a.publicKey, b.publicKey);
      assert.equal(a.address, b.address);
    });

    it("different phrases produce different keypairs", () => {
      const a = deriveKeypairFromPhrase("marble clock river absent trophy notable");
      const b = deriveKeypairFromPhrase("prepare skin lucky midnight lava song");
      assert.notDeepEqual(a.privateKey, b.privateKey);
      assert.notEqual(a.address, b.address);
    });

    it("derived keypair can sign and verify", () => {
      const kp = deriveKeypairFromPhrase("signing test phrase");
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const sig = signShard(data, kp.privateKey);
      assert.ok(verifySignature(data, sig, kp.address));
    });
  });

  describe("publicKeyFromPrivate", () => {
    it("recovers the same public key", () => {
      const kp = generateKeypair();
      const recovered = publicKeyFromPrivate(kp.privateKey);
      assert.deepEqual(recovered, kp.publicKey);
    });
  });

  describe("addressFromPublicKey", () => {
    it("derives the same address from the public key", () => {
      const kp = generateKeypair();
      const addr = addressFromPublicKey(kp.publicKey);
      assert.equal(addr, kp.address);
    });

    it("address is lowercase hex", () => {
      const kp = generateKeypair();
      const addr = addressFromPublicKey(kp.publicKey);
      assert.match(addr, /^0x[0-9a-f]{40}$/);
    });
  });

  describe("signShard / verifySignature", () => {
    it("valid signature verifies correctly", () => {
      const kp = generateKeypair();
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const sig = signShard(data, kp.privateKey);
      assert.ok(verifySignature(data, sig, kp.address));
    });

    it("signature is 0x-prefixed hex string (65 bytes = 130 hex + 2)", () => {
      const kp = generateKeypair();
      const sig = signShard(new Uint8Array([1]), kp.privateKey);
      assert.ok(sig.startsWith("0x"));
      assert.equal(sig.length, 132); // 0x + 130 hex chars
    });

    it("tampered data fails verification", () => {
      const kp = generateKeypair();
      const data = new Uint8Array([1, 2, 3]);
      const sig = signShard(data, kp.privateKey);
      const tampered = new Uint8Array([1, 2, 4]);
      assert.ok(!verifySignature(tampered, sig, kp.address));
    });

    it("wrong address fails verification", () => {
      const kp1 = generateKeypair();
      const kp2 = generateKeypair();
      const data = new Uint8Array([10, 20, 30]);
      const sig = signShard(data, kp1.privateKey);
      assert.ok(!verifySignature(data, sig, kp2.address));
    });

    it("invalid signature string returns false", () => {
      const kp = generateKeypair();
      const data = new Uint8Array([1]);
      assert.ok(!verifySignature(data, "0xgarbage", kp.address));
    });

    it("empty data can be signed and verified", () => {
      const kp = generateKeypair();
      const data = new Uint8Array(0);
      const sig = signShard(data, kp.privateKey);
      assert.ok(verifySignature(data, sig, kp.address));
    });
  });
});
