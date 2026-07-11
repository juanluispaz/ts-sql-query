// Behavioural coverage of `_escapeLikeWildcard`: when an affix predicate's
// needle contains a LIKE metacharacter (`_` / `%`) it must be escaped so the
// engine matches it LITERALLY, not as a wildcard. The `like-escape*` tests pin
// the emitted param STRING; a mock never runs the LIKE, so only inserting a
// row and asserting WHICH rows come back proves the escape actually works on
// the engine. The matched set is dialect-independent — the per-dialect escaped
// param is asserted in `like-escape-literal` — so these assertions are the
// same in every cell.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tAppUser } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('starts-with-treats-underscore-literally', async () => {
        // `a_a@probe.test` holds a LITERAL underscore. The seeded
        // `ada@acme.test` and `alan@globex.test` both start with a-<any>-a, so
        // they WOULD leak in if `_` reached the engine as a single-char
        // wildcard; correct escaping matches only the literal-underscore row.
        ctx.mockNext(1)
        ctx.mockNext(['a_a@probe.test'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'a_a@probe.test', fullName: 'underscore probe' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWith('a_a'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['a_a@probe.test'])
        })
    })

    test('contains-treats-percent-literally', async () => {
        // `wa%ew@probe.test` holds a LITERAL percent. `contains('a%e')` with
        // `%` leaking as a wildcard would match every seeded address (each has
        // an `a` before an `e`); correct escaping matches only the literal-
        // percent row.
        ctx.mockNext(1)
        ctx.mockNext(['wa%ew@probe.test'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'wa%ew@probe.test', fullName: 'percent probe' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.contains('a%e'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['wa%ew@probe.test'])
        })
    })

    test('contains-column-operand-treats-metachar-literally', async () => {
        // `contains(<column>)` uses a COLUMN as the needle, so its metacharacters are
        // escaped at the SQL level. Row A's email holds a literal `_`; Row B's would
        // leak if the `_` reached the engine as a single-char wildcard (`a_c` matching
        // `abc`). Each row compares its own email against its own `full_name` ('a_c'),
        // so correct escaping matches only Row A.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['za_cz@x'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'za_cz@x', fullName: 'a_c' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'zabcz@x', fullName: 'a_c' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.contains(tAppUser.fullName))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['za_cz@x'])
        })
    })

    test('contains-backslash-literal-matches-only-the-backslash-row', async () => {
        // A literal backslash (`\`) needle. Row A's email holds a literal `\`; the decoy
        // without one does not match. The needle is doubled in the bound param (`\` →
        // `\\`), so under the default `\` escape character the engine matches exactly one
        // literal backslash — Row A and not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['a\\b@x'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'a\\b@x', fullName: 'backslash probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'axb@x', fullName: 'plain probe' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.contains('\\'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['a\\b@x'])
        })
    })

    test('contains-bracket-literal-matches-only-the-literal-bracket-row', async () => {
        // A literal `[cd]` needle. On engines where `[` opens a character class, `[cd]`
        // matches `c` or `d` unless the `[` is escaped, so the decoy Row B (whose email
        // has a `c`) would leak from an unescaped class. Correct escaping matches only
        // Row A, which holds the literal `[cd]`.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['x[cd]y@z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'x[cd]y@z', fullName: 'literal bracket' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'xcy@z', fullName: 'char-class decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.contains('[cd]'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['x[cd]y@z'])
        })
    })

    test('ends-with-underscore-literal-matches-only-the-literal-row', async () => {
        // `endsWith` fed a `_` metachar needle. Row A's email ends with a literal `_x`;
        // the decoy ends with `ax`, which would match the `%_x` affix if `_` reached the
        // engine as a wildcard. Correct escaping matches only Row A.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['end_x'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'end_x', fullName: 'ends underscore' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'endax', fullName: 'ends decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.endsWith('_x'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['end_x'])
        })
    })

    test('not-contains-underscore-literal-keeps-only-the-non-literal-row', async () => {
        // `notContains` with a `_` metachar needle, scoped to the two `nc-`-prefixed
        // rows. The literal-`_` row (`nc-a_b@t`) contains the escaped needle `a_b` and is
        // excluded, while `nc-axb@t` — which only matches `a_b` as the wildcard `a<any>b`
        // — is KEPT. Without escaping both would be excluded, so the surviving row proves
        // the escape.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['nc-axb@t'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'nc-a_b@t', fullName: 'nc literal' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'nc-axb@t', fullName: 'nc decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWith('nc-').and(tAppUser.email.notContains('a_b')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['nc-axb@t'])
        })
    })

    test('contains-insensitive-underscore-literal-matches-case-folded-literal-row', async () => {
        // `containsInsensitive` with a `_` metachar needle. The needle `z_q` (lower)
        // matches Row A `ZZ_QX` (upper, literal `_`) case-insensitively but not the decoy
        // `ZZAQX`, which would match only via the `_` wildcard.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['ZZ_QX'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'ZZ_QX', fullName: 'insensitive literal' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'ZZAQX', fullName: 'insensitive decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.containsInsensitive('z_q'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['ZZ_QX'])
        })
    })

    test('contains-if-value-underscore-literal-matches-only-the-literal-row', async () => {
        // `containsIfValue` with a present `_` metachar needle. Row A `w_qz` holds a
        // literal `_`; the decoy `wxqz` would leak via the `_` wildcard.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['w_qz'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'w_qz', fullName: 'ifvalue literal' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'wxqz', fullName: 'ifvalue decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.containsIfValue('w_q'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['w_qz'])
        })
    })

    test('contains-column-operand-backslash-literal-matches-only-the-backslash-row', async () => {
        // `contains(<column>)` uses a COLUMN as the needle. Both rows share the same
        // `full_name` (`a\c`, holding a literal backslash); only Row A's email actually
        // contains that literal backslash, so a match proves the backslash reaches the
        // engine literally rather than being over-escaped away. Row B's email `zabcz@x`
        // does not contain `a\c`.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['za\\cz@x'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'za\\cz@x', fullName: 'a\\c' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'zabcz@x', fullName: 'a\\c' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.contains(tAppUser.fullName))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['za\\cz@x'])
        })
    })

    test('starts-with-backslash-literal-matches-only-the-literal-row', async () => {
        // `startsWith` fed a `a\a` needle holding a literal backslash. Row A's email
        // begins with the literal `a\a`; the decoy begins with `axa`, which has no
        // backslash. A match proves the backslash reaches the engine literally rather
        // than being over-escaped away.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['a\\a@probe.test'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'a\\a@probe.test', fullName: 'bs starts' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'axa@probe.test', fullName: 'bs starts decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWith('a\\a'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['a\\a@probe.test'])
        })
    })

    test('ends-with-backslash-literal-matches-only-the-literal-row', async () => {
        // `endsWith` fed a `\x` needle holding a literal backslash. Row A's email ends
        // with the literal `\x`; the decoy ends with `ax`, which has no backslash. A
        // match proves the backslash reaches the engine literally rather than being
        // over-escaped away.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['end\\x'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'end\\x', fullName: 'bs ends' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'endax', fullName: 'bs ends decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.endsWith('\\x'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['end\\x'])
        })
    })

    test('not-contains-backslash-literal-keeps-only-the-non-literal-row', async () => {
        // `notContains` with a `a\b` needle holding a literal backslash, scoped to the
        // two `ncb-`-prefixed rows. Row A's email holds the literal `a\b` and is
        // EXCLUDED; the decoy `ncb-axb@t` has no backslash so it does NOT contain `a\b`
        // and is KEPT. The surviving row proves the backslash reaches the engine
        // literally rather than being over-escaped away.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['ncb-axb@t'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'ncb-a\\b@t', fullName: 'ncb literal' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'ncb-axb@t', fullName: 'ncb decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWith('ncb-').and(tAppUser.email.notContains('a\\b')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['ncb-axb@t'])
        })
    })

    test('contains-insensitive-backslash-literal-matches-case-folded-literal-row', async () => {
        // `containsInsensitive` with a `z\q` needle holding a literal backslash. The
        // needle (lower) matches Row A `ZZ\QX` (upper, literal backslash) case-
        // insensitively but not the decoy `ZZAQX`, which has no backslash. A match
        // proves the backslash reaches the engine literally rather than being
        // over-escaped away.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['ZZ\\QX'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'ZZ\\QX', fullName: 'bs insens literal' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'ZZAQX', fullName: 'bs insens decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.containsInsensitive('z\\q'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['ZZ\\QX'])
        })
    })

    test('starts-with-insensitive-backslash-literal-matches-case-folded-literal-row', async () => {
        // `startsWithInsensitive` with a `a\z` needle holding a literal backslash. The
        // needle (lower) matches Row A `A\zzz@t` (upper, literal backslash) case-
        // insensitively but not the decoy `Axzz@t`, which has no backslash. A match
        // proves the backslash reaches the engine literally rather than being
        // over-escaped away.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['A\\zzz@t'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'A\\zzz@t', fullName: 'bs starts insens' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'Axzz@t', fullName: 'bs starts insens decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWithInsensitive('a\\z'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['A\\zzz@t'])
        })
    })

    test('ends-with-insensitive-backslash-literal-matches-case-folded-literal-row', async () => {
        // `endsWithInsensitive` with a `\x` needle holding a literal backslash. The
        // needle (lower) matches Row A `qq\X` (upper, literal backslash) case-
        // insensitively but not the decoy `qqaX`, which has no backslash. A match
        // proves the backslash reaches the engine literally rather than being
        // over-escaped away.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['qq\\X'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'qq\\X', fullName: 'bs ends insens' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'qqaX', fullName: 'bs ends insens decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.endsWithInsensitive('\\x'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['qq\\X'])
        })
    })

    test('contains-if-value-backslash-literal-matches-only-the-literal-row', async () => {
        // `containsIfValue` with a present `w\q` needle holding a literal backslash. Row
        // A `w\qz2` holds the literal backslash; the decoy `wxqz2` has no backslash. A
        // match proves the backslash reaches the engine literally rather than being
        // over-escaped away.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['w\\qz2'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'w\\qz2', fullName: 'bs ifvalue' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'wxqz2', fullName: 'bs ifvalue decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.containsIfValue('w\\q'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['w\\qz2'])
        })
    })

    test('starts-with-if-value-backslash-literal-matches-only-the-literal-row', async () => {
        // `startsWithIfValue` with a present `a\i` needle holding a literal backslash.
        // Row A `a\ifv@t` begins with the literal backslash; the decoy `axifv@t` has no
        // backslash. A match proves the backslash reaches the engine literally rather
        // than being over-escaped away.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['a\\ifv@t'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'a\\ifv@t', fullName: 'bs starts ifvalue' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'axifv@t', fullName: 'bs starts ifvalue decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWithIfValue('a\\i'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['a\\ifv@t'])
        })
    })

    test('ends-with-if-value-backslash-literal-matches-only-the-literal-row', async () => {
        // `endsWithIfValue` with a present `\z` needle holding a literal backslash. Row
        // A `ifvq\z` ends with the literal backslash; the decoy `ifvqxz` has no
        // backslash. A match proves the backslash reaches the engine literally rather
        // than being over-escaped away.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['ifvq\\z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'ifvq\\z', fullName: 'bs ends ifvalue' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'ifvqxz', fullName: 'bs ends ifvalue decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.endsWithIfValue('\\z'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['ifvq\\z'])
        })
    })
})
