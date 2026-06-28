// Documentation snippets for the ID manipulation page
// (docs/advanced/id-manipulation.md). The doc walks through using
// `IDEncrypter` inside a custom Connection's `transformValueFromDB`
// / `transformValueToDB` overrides; here we exercise the encrypter
// directly so the round-trip contract is locked in regardless of
// dialect. A full connection-level test would require its own
// DBConnection subclass which would diverge from the shared seed
// domain — out of scope for the symmetric suite.

import { beforeAll, afterAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { IDEncrypter, isValidEncryptedID } from '../../../../../src/extras/IDEncrypter.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:id-manipulation/encrypter-round-trip', () => {
        // doc-start: same passwords as in the docs page.
        const enc = new IDEncrypter('3zTvzr3p67VC61jm', '60iP0h6vJoEaJo8c')
        const encrypted = enc.encrypt(1n)
        const decrypted = enc.decrypt(encrypted)
        // doc-end
        // Documented expected value for id=1.
        expect(encrypted).toBe('uftSdCUhUTBQ0111')
        expect(decrypted).toBe(1n)
    })

    test('docs-extra:id-manipulation/encrypter-different-ids-different-output', () => {
        const enc = new IDEncrypter('3zTvzr3p67VC61jm', '60iP0h6vJoEaJo8c')
        const e1 = enc.encrypt(1n)
        const e2 = enc.encrypt(2n)
        const e3 = enc.encrypt(99999n)
        expect(e1).not.toBe(e2)
        expect(e2).not.toBe(e3)
        expect(enc.decrypt(e1)).toBe(1n)
        expect(enc.decrypt(e2)).toBe(2n)
        expect(enc.decrypt(e3)).toBe(99999n)
    })

    test('docs-extra:id-manipulation/encrypter-large-bigint', () => {
        const enc = new IDEncrypter('3zTvzr3p67VC61jm', '60iP0h6vJoEaJo8c')
        const large = 9007199254740993n  // > Number.MAX_SAFE_INTEGER
        const e = enc.encrypt(large)
        expect(enc.decrypt(e)).toBe(large)
    })

    test('docs:id-manipulation/encrypter-with-prefix', () => {
        // Section "Globally Encrypted ID" — `encrypt(id, prefix)` adds a
        // table-scoped prefix to the encrypted output so two tables with
        // overlapping numeric ids serialise to distinct strings.
        const enc = new IDEncrypter('3zTvzr3p67VC61jm', '60iP0h6vJoEaJo8c')
        // doc-start
        const companyEnc = enc.encrypt(1n, 'co')
        const decrypted  = enc.decrypt(companyEnc, 'co')
        // doc-end
        expect(decrypted).toBe(1n)
        // The encrypted value carries the prefix literally as its head.
        expect(companyEnc.startsWith('co')).toBe(true)
    })

    test('docs-extra:id-manipulation/encrypter-prefix-disambiguates-tables', () => {
        // Same id under two different prefixes encodes differently.
        const enc = new IDEncrypter('3zTvzr3p67VC61jm', '60iP0h6vJoEaJo8c')
        const companyEnc  = enc.encrypt(1n, 'co')
        const customerEnc = enc.encrypt(1n, 'cu')
        expect(companyEnc).not.toBe(customerEnc)
        expect(enc.decrypt(companyEnc,  'co')).toBe(1n)
        expect(enc.decrypt(customerEnc, 'cu')).toBe(1n)
    })

    test('docs-extra:id-manipulation/decrypter-rejects-too-short-input-with-invalid-id', () => {
        // `decrypt(s)` requires length ≥ 16; below
        // that throws "Invalid id" before any crypto runs.
        const enc = new IDEncrypter('3zTvzr3p67VC61jm', '60iP0h6vJoEaJo8c')
        expect(() => enc.decrypt('short')).toThrow(/Invalid id/)
    })

    test('docs-extra:id-manipulation/decrypter-rejects-wrong-prefix', () => {
        // `decrypt(s, prefix)` rejects with
        // "Invalid prefix" when the encrypted string doesn't start with
        // the expected prefix.
        const enc = new IDEncrypter('3zTvzr3p67VC61jm', '60iP0h6vJoEaJo8c')
        const encryptedWithCo = enc.encrypt(1n, 'co')
        expect(() => enc.decrypt(encryptedWithCo, 'cu')).toThrow(/Invalid prefix/)
    })

    test('docs-extra:id-manipulation/decrypter-rejects-tampered-checksum-with-invalid-id', () => {
        // the public checksum (last 2 chars) must
        // match `checksumString` of the rest. Flipping the final byte
        // breaks the checksum and throws "Invalid id".
        const enc = new IDEncrypter('3zTvzr3p67VC61jm', '60iP0h6vJoEaJo8c')
        const encrypted = enc.encrypt(1n)
        // Replace the last char with a different one (cycling through
        // [0-9a-f]) so the checksum mismatch fires regardless of the
        // original suffix.
        const last = encrypted[encrypted.length - 1]!
        const alt = last === '0' ? '1' : '0'
        const tampered = encrypted.slice(0, -1) + alt
        expect(() => enc.decrypt(tampered)).toThrow(/Invalid id/)
    })

    test('docs-extra:id-manipulation/is-valid-encrypted-id-true-for-output-of-encrypt', () => {
        // the cheap client-side checksum check
        // that a UI can run before sending the string back to the
        // server. Accepts everything `encrypt(...)` produces, with or
        // without a prefix.
        const enc = new IDEncrypter('3zTvzr3p67VC61jm', '60iP0h6vJoEaJo8c')
        expect(isValidEncryptedID(enc.encrypt(1n))).toBe(true)
        expect(isValidEncryptedID(enc.encrypt(1n, 'co'), 'co')).toBe(true)
    })

    test('docs-extra:id-manipulation/is-valid-encrypted-id-false-for-too-short', () => {
        // strings shorter than the minimum
        // length cannot be valid; return false (vs. `decrypt` throwing).
        expect(isValidEncryptedID('short')).toBe(false)
        expect(isValidEncryptedID('co123', 'co')).toBe(false)
    })

    test('docs-extra:id-manipulation/is-valid-encrypted-id-false-for-wrong-prefix', () => {
        // when an expected prefix is required and
        // the candidate string does not start with it, `isValidEncryptedID`
        // returns false without recomputing the checksum (mirrors
        // `decrypt`'s `Invalid prefix` throw).
        const enc = new IDEncrypter('3zTvzr3p67VC61jm', '60iP0h6vJoEaJo8c')
        const encryptedWithCo = enc.encrypt(1n, 'co')
        expect(isValidEncryptedID(encryptedWithCo, 'cu')).toBe(false)
    })

    test('docs-extra:id-manipulation/is-valid-encrypted-id-false-for-tampered-checksum', () => {
        // same checksum the decrypter throws
        // on, but returned as a boolean.
        const enc = new IDEncrypter('3zTvzr3p67VC61jm', '60iP0h6vJoEaJo8c')
        const encrypted = enc.encrypt(1n)
        const last = encrypted[encrypted.length - 1]!
        const alt = last === '0' ? '1' : '0'
        const tampered = encrypted.slice(0, -1) + alt
        expect(isValidEncryptedID(tampered)).toBe(false)
    })

    test('docs-extra:id-manipulation/decrypter-rejects-wrong-key-with-invalid-id', () => {
        // A string encrypted with one key pair and decrypted with a DIFFERENT
        // key pair. The PUBLIC checksum (last two chars) is key-independent — it
        // only validates the string itself — so it passes; the wrong key then
        // yields garbage plaintext whose INTERNAL checksum no longer matches the
        // recovered id, so the deeper `ics/pcs !== cs` guard fires. This is a
        // distinct rejection path from the public-checksum tamper test above,
        // which never reaches the cipher.
        const encA = new IDEncrypter('3zTvzr3p67VC61jm', '60iP0h6vJoEaJo8c')
        // Same 16-char alphabets, password and IV swapped: a valid but
        // different key pair.
        const encB = new IDEncrypter('60iP0h6vJoEaJo8c', '3zTvzr3p67VC61jm')
        const encrypted = encA.encrypt(1n)
        // The string is well-formed: its public checksum validates regardless
        // of the decryption key.
        expect(isValidEncryptedID(encrypted)).toBe(true)
        expect(() => encB.decrypt(encrypted)).toThrow(/Invalid id/)
    })
})
