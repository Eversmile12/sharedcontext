import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generatePhrase, validatePhrase, phraseToString, PHRASE_WORD_COUNT, } from "../core/passphrase.js";
describe("passphrase", () => {
    it("generates 12 words", () => {
        const words = generatePhrase();
        assert.equal(words.length, PHRASE_WORD_COUNT);
    });
    it("generated phrase validates", () => {
        const words = generatePhrase();
        const result = validatePhrase(words);
        assert.equal(result.valid, true);
    });
    it("detects typo via checksum mismatch", () => {
        const words = generatePhrase();
        const modified = [...words];
        modified[0] = modified[0] === "abandon" ? "ability" : "abandon";
        const result = validatePhrase(modified);
        assert.equal(result.valid, false);
        assert.ok((result.error ?? "").toLowerCase().includes("checksum"));
    });
    it("normalizes phrase string as lowercase with spaces", () => {
        const phrase = phraseToString(["ABANDON", "ability"]);
        assert.equal(phrase, "abandon ability");
    });
});
//# sourceMappingURL=passphrase.test.js.map