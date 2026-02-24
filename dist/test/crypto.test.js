import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveKey, generateSalt, encrypt, decrypt } from "../core/crypto.js";
describe("crypto", () => {
    describe("generateSalt", () => {
        it("returns 16 bytes", () => {
            const salt = generateSalt();
            assert.equal(salt.length, 16);
        });
        it("returns different values each call", () => {
            const a = generateSalt();
            const b = generateSalt();
            assert.notDeepEqual(a, b);
        });
    });
    describe("deriveKey", () => {
        it("returns 32 bytes (256-bit key)", () => {
            const salt = generateSalt();
            const key = deriveKey("test-passphrase", salt);
            assert.equal(key.length, 32);
        });
        it("same passphrase + same salt = same key", () => {
            const salt = generateSalt();
            const a = deriveKey("test-passphrase", salt);
            const b = deriveKey("test-passphrase", salt);
            assert.deepEqual(a, b);
        });
        it("different passphrase = different key", () => {
            const salt = generateSalt();
            const a = deriveKey("passphrase-a", salt);
            const b = deriveKey("passphrase-b", salt);
            assert.notDeepEqual(a, b);
        });
        it("different salt = different key", () => {
            const saltA = generateSalt();
            const saltB = generateSalt();
            const a = deriveKey("same-passphrase", saltA);
            const b = deriveKey("same-passphrase", saltB);
            assert.notDeepEqual(a, b);
        });
    });
    describe("encrypt / decrypt", () => {
        const key = deriveKey("test", generateSalt());
        it("round-trips plaintext correctly", () => {
            const plaintext = new TextEncoder().encode("hello sharedcontext");
            const encrypted = encrypt(plaintext, key);
            const decrypted = decrypt(encrypted, key);
            assert.deepEqual(decrypted, plaintext);
        });
        it("ciphertext is larger than plaintext (nonce + tag overhead)", () => {
            const plaintext = new TextEncoder().encode("data");
            const encrypted = encrypt(plaintext, key);
            // 12 bytes nonce + 16 bytes GCM tag = 28 bytes overhead minimum
            assert.ok(encrypted.length >= plaintext.length + 28);
        });
        it("different encryptions of same plaintext produce different ciphertext", () => {
            const plaintext = new TextEncoder().encode("same data");
            const a = encrypt(plaintext, key);
            const b = encrypt(plaintext, key);
            assert.notDeepEqual(a, b); // random nonce each time
        });
        it("wrong key throws on decrypt", () => {
            const plaintext = new TextEncoder().encode("secret");
            const encrypted = encrypt(plaintext, key);
            const wrongKey = deriveKey("wrong", generateSalt());
            assert.throws(() => decrypt(encrypted, wrongKey));
        });
        it("tampered ciphertext throws on decrypt", () => {
            const plaintext = new TextEncoder().encode("sensitive");
            const encrypted = encrypt(plaintext, key);
            // Flip a byte in the ciphertext (after the nonce)
            encrypted[20] ^= 0xff;
            assert.throws(() => decrypt(encrypted, key));
        });
        it("handles empty plaintext", () => {
            const plaintext = new Uint8Array(0);
            const encrypted = encrypt(plaintext, key);
            const decrypted = decrypt(encrypted, key);
            assert.equal(decrypted.length, 0);
        });
    });
});
//# sourceMappingURL=crypto.test.js.map