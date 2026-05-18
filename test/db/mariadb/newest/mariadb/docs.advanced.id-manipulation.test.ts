// Documentation snippets for the ID manipulation page
// (docs/advanced/id-manipulation.md). The doc walks through using
// `IDEncrypter` inside a custom Connection's `transformValueFromDB`
// / `transformValueToDB` overrides; here we exercise the encrypter
// directly so the round-trip contract is locked in regardless of
// dialect. A full connection-level test would require its own
// DBConnection subclass which would diverge from the shared seed
// domain — out of scope for the symmetric suite.

import { beforeAll, afterAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { IDEncrypter } from '../../../../../src/extras/IDEncrypter.js'
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
})
