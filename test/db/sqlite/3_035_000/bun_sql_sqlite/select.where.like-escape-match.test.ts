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
        // without one does not match.
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
    // Row-selection proof of `_escapeLikeWildcard` across the affix grid: each
    // test inserts a probe holding a LITERAL metachar and a decoy where that
    // metachar is replaced by a char a wildcard would match, then asserts which
    // rows come back. On native-sqlite/docker the LIKE + ESCAPE actually run, so
    // a broken escape would leak the decoy. Positive predicates keep the literal
    // row; negative predicates (`not*`) keep the decoy and are scoped by a
    // full_name marker so seed rows don't leak in. `[` carries real row-selection
    // signal only on SqlServer (elsewhere it is an ordinary char) but the test is
    // valid on every dialect. These assertions are dialect-independent (the
    // per-dialect escaped param is pinned in `like-escape-literal`), so there are
    // no SQL snapshots here.

    test('starts-with-percent', async () => {
        // startsWith with a literal percent: correct escaping matches only the literal-percent row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['q%k-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'q%k-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'qwk-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWith('q%k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['q%k-z'])
        })
    })

    test('starts-with-bracket', async () => {
        // startsWith with a literal bracket: correct escaping matches only the literal-bracket row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['q[bk]-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'q[bk]-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'qb-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWith('q[bk]'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['q[bk]-z'])
        })
    })

    test('starts-with-if-value-percent', async () => {
        // startsWithIfValue with a literal percent: correct escaping matches only the literal-percent row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['q%k-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'q%k-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'qwk-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWithIfValue('q%k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['q%k-z'])
        })
    })

    test('starts-with-if-value-underscore', async () => {
        // startsWithIfValue with a literal underscore: correct escaping matches only the literal-underscore row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['q_k-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'q_k-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'qwk-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWithIfValue('q_k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['q_k-z'])
        })
    })

    test('starts-with-if-value-bracket', async () => {
        // startsWithIfValue with a literal bracket: correct escaping matches only the literal-bracket row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['q[bk]-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'q[bk]-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'qb-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWithIfValue('q[bk]'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['q[bk]-z'])
        })
    })

    test('starts-with-insensitive-percent', async () => {
        // startsWithInsensitive with a literal percent: correct escaping matches only the literal-percent row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['Q%K-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'Q%K-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'QWK-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWithInsensitive('q%k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['Q%K-z'])
        })
    })

    test('starts-with-insensitive-underscore', async () => {
        // startsWithInsensitive with a literal underscore: correct escaping matches only the literal-underscore row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['Q_K-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'Q_K-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'QWK-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWithInsensitive('q_k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['Q_K-z'])
        })
    })

    test('starts-with-insensitive-bracket', async () => {
        // startsWithInsensitive with a literal bracket: correct escaping matches only the literal-bracket row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['Q[BK]-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'Q[BK]-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'QB-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWithInsensitive('q[bk]'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['Q[BK]-z'])
        })
    })

    test('starts-with-insensitive-if-value-percent', async () => {
        // startsWithInsensitiveIfValue with a literal percent: correct escaping matches only the literal-percent row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['Q%K-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'Q%K-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'QWK-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWithInsensitiveIfValue('q%k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['Q%K-z'])
        })
    })

    test('starts-with-insensitive-if-value-underscore', async () => {
        // startsWithInsensitiveIfValue with a literal underscore: correct escaping matches only the literal-underscore row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['Q_K-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'Q_K-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'QWK-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWithInsensitiveIfValue('q_k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['Q_K-z'])
        })
    })

    test('starts-with-insensitive-if-value-backslash', async () => {
        // startsWithInsensitiveIfValue with a literal backslash: correct escaping matches only the literal-backslash row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['Q\\K-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'Q\\K-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'QK-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWithInsensitiveIfValue('q\\k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['Q\\K-z'])
        })
    })

    test('starts-with-insensitive-if-value-bracket', async () => {
        // startsWithInsensitiveIfValue with a literal bracket: correct escaping matches only the literal-bracket row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['Q[BK]-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'Q[BK]-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'QB-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWithInsensitiveIfValue('q[bk]'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['Q[BK]-z'])
        })
    })

    test('not-starts-with-percent', async () => {
        // notStartsWith with a literal percent: the literal-percent row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['qwk-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'q%k-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'qwk-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notStartsWith('q%k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['qwk-z'])
        })
    })

    test('not-starts-with-underscore', async () => {
        // notStartsWith with a literal underscore: the literal-underscore row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['qwk-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'q_k-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'qwk-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notStartsWith('q_k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['qwk-z'])
        })
    })

    test('not-starts-with-backslash', async () => {
        // notStartsWith with a literal backslash: the literal-backslash row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['qk-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'q\\k-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'qk-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notStartsWith('q\\k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['qk-z'])
        })
    })

    test('not-starts-with-bracket', async () => {
        // notStartsWith with a literal bracket: the literal-bracket row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['qb-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'q[bk]-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'qb-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notStartsWith('q[bk]')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['qb-z'])
        })
    })

    test('not-starts-with-if-value-percent', async () => {
        // notStartsWithIfValue with a literal percent: the literal-percent row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['qwk-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'q%k-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'qwk-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notStartsWithIfValue('q%k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['qwk-z'])
        })
    })

    test('not-starts-with-if-value-underscore', async () => {
        // notStartsWithIfValue with a literal underscore: the literal-underscore row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['qwk-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'q_k-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'qwk-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notStartsWithIfValue('q_k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['qwk-z'])
        })
    })

    test('not-starts-with-if-value-backslash', async () => {
        // notStartsWithIfValue with a literal backslash: the literal-backslash row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['qk-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'q\\k-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'qk-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notStartsWithIfValue('q\\k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['qk-z'])
        })
    })

    test('not-starts-with-if-value-bracket', async () => {
        // notStartsWithIfValue with a literal bracket: the literal-bracket row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['qb-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'q[bk]-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'qb-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notStartsWithIfValue('q[bk]')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['qb-z'])
        })
    })

    test('not-starts-with-insensitive-percent', async () => {
        // notStartsWithInsensitive with a literal percent: the literal-percent row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['QWK-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'Q%K-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'QWK-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notStartsWithInsensitive('q%k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['QWK-z'])
        })
    })

    test('not-starts-with-insensitive-underscore', async () => {
        // notStartsWithInsensitive with a literal underscore: the literal-underscore row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['QWK-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'Q_K-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'QWK-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notStartsWithInsensitive('q_k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['QWK-z'])
        })
    })

    test('not-starts-with-insensitive-backslash', async () => {
        // notStartsWithInsensitive with a literal backslash: the literal-backslash row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['QK-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'Q\\K-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'QK-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notStartsWithInsensitive('q\\k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['QK-z'])
        })
    })

    test('not-starts-with-insensitive-bracket', async () => {
        // notStartsWithInsensitive with a literal bracket: the literal-bracket row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['QB-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'Q[BK]-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'QB-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notStartsWithInsensitive('q[bk]')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['QB-z'])
        })
    })

    test('not-starts-with-insensitive-if-value-percent', async () => {
        // notStartsWithInsensitiveIfValue with a literal percent: the literal-percent row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['QWK-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'Q%K-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'QWK-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notStartsWithInsensitiveIfValue('q%k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['QWK-z'])
        })
    })

    test('not-starts-with-insensitive-if-value-underscore', async () => {
        // notStartsWithInsensitiveIfValue with a literal underscore: the literal-underscore row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['QWK-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'Q_K-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'QWK-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notStartsWithInsensitiveIfValue('q_k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['QWK-z'])
        })
    })

    test('not-starts-with-insensitive-if-value-backslash', async () => {
        // notStartsWithInsensitiveIfValue with a literal backslash: the literal-backslash row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['QK-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'Q\\K-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'QK-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notStartsWithInsensitiveIfValue('q\\k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['QK-z'])
        })
    })

    test('not-starts-with-insensitive-if-value-bracket', async () => {
        // notStartsWithInsensitiveIfValue with a literal bracket: the literal-bracket row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['QB-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'Q[BK]-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'QB-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notStartsWithInsensitiveIfValue('q[bk]')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['QB-z'])
        })
    })

    test('ends-with-percent', async () => {
        // endsWith with a literal percent: correct escaping matches only the literal-percent row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-q%k'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-q%k', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-qwk', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.endsWith('q%k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-q%k'])
        })
    })

    test('ends-with-bracket', async () => {
        // endsWith with a literal bracket: correct escaping matches only the literal-bracket row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-q[bk]'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-q[bk]', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-qb', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.endsWith('q[bk]'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-q[bk]'])
        })
    })

    test('ends-with-if-value-percent', async () => {
        // endsWithIfValue with a literal percent: correct escaping matches only the literal-percent row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-q%k'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-q%k', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-qwk', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.endsWithIfValue('q%k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-q%k'])
        })
    })

    test('ends-with-if-value-underscore', async () => {
        // endsWithIfValue with a literal underscore: correct escaping matches only the literal-underscore row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-q_k'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-q_k', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-qwk', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.endsWithIfValue('q_k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-q_k'])
        })
    })

    test('ends-with-if-value-bracket', async () => {
        // endsWithIfValue with a literal bracket: correct escaping matches only the literal-bracket row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-q[bk]'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-q[bk]', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-qb', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.endsWithIfValue('q[bk]'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-q[bk]'])
        })
    })

    test('ends-with-insensitive-percent', async () => {
        // endsWithInsensitive with a literal percent: correct escaping matches only the literal-percent row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-Q%K'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-Q%K', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-QWK', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.endsWithInsensitive('q%k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-Q%K'])
        })
    })

    test('ends-with-insensitive-underscore', async () => {
        // endsWithInsensitive with a literal underscore: correct escaping matches only the literal-underscore row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-Q_K'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-Q_K', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-QWK', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.endsWithInsensitive('q_k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-Q_K'])
        })
    })

    test('ends-with-insensitive-bracket', async () => {
        // endsWithInsensitive with a literal bracket: correct escaping matches only the literal-bracket row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-Q[BK]'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-Q[BK]', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-QB', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.endsWithInsensitive('q[bk]'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-Q[BK]'])
        })
    })

    test('ends-with-insensitive-if-value-percent', async () => {
        // endsWithInsensitiveIfValue with a literal percent: correct escaping matches only the literal-percent row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-Q%K'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-Q%K', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-QWK', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.endsWithInsensitiveIfValue('q%k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-Q%K'])
        })
    })

    test('ends-with-insensitive-if-value-underscore', async () => {
        // endsWithInsensitiveIfValue with a literal underscore: correct escaping matches only the literal-underscore row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-Q_K'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-Q_K', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-QWK', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.endsWithInsensitiveIfValue('q_k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-Q_K'])
        })
    })

    test('ends-with-insensitive-if-value-backslash', async () => {
        // endsWithInsensitiveIfValue with a literal backslash: correct escaping matches only the literal-backslash row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-Q\\K'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-Q\\K', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-QK', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.endsWithInsensitiveIfValue('q\\k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-Q\\K'])
        })
    })

    test('ends-with-insensitive-if-value-bracket', async () => {
        // endsWithInsensitiveIfValue with a literal bracket: correct escaping matches only the literal-bracket row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-Q[BK]'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-Q[BK]', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-QB', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.endsWithInsensitiveIfValue('q[bk]'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-Q[BK]'])
        })
    })

    test('not-ends-with-percent', async () => {
        // notEndsWith with a literal percent: the literal-percent row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-qwk'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-q%k', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-qwk', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notEndsWith('q%k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-qwk'])
        })
    })

    test('not-ends-with-underscore', async () => {
        // notEndsWith with a literal underscore: the literal-underscore row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-qwk'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-q_k', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-qwk', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notEndsWith('q_k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-qwk'])
        })
    })

    test('not-ends-with-backslash', async () => {
        // notEndsWith with a literal backslash: the literal-backslash row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-qk'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-q\\k', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-qk', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notEndsWith('q\\k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-qk'])
        })
    })

    test('not-ends-with-bracket', async () => {
        // notEndsWith with a literal bracket: the literal-bracket row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-qb'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-q[bk]', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-qb', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notEndsWith('q[bk]')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-qb'])
        })
    })

    test('not-ends-with-if-value-percent', async () => {
        // notEndsWithIfValue with a literal percent: the literal-percent row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-qwk'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-q%k', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-qwk', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notEndsWithIfValue('q%k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-qwk'])
        })
    })

    test('not-ends-with-if-value-underscore', async () => {
        // notEndsWithIfValue with a literal underscore: the literal-underscore row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-qwk'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-q_k', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-qwk', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notEndsWithIfValue('q_k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-qwk'])
        })
    })

    test('not-ends-with-if-value-backslash', async () => {
        // notEndsWithIfValue with a literal backslash: the literal-backslash row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-qk'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-q\\k', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-qk', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notEndsWithIfValue('q\\k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-qk'])
        })
    })

    test('not-ends-with-if-value-bracket', async () => {
        // notEndsWithIfValue with a literal bracket: the literal-bracket row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-qb'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-q[bk]', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-qb', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notEndsWithIfValue('q[bk]')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-qb'])
        })
    })

    test('not-ends-with-insensitive-percent', async () => {
        // notEndsWithInsensitive with a literal percent: the literal-percent row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-QWK'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-Q%K', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-QWK', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notEndsWithInsensitive('q%k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-QWK'])
        })
    })

    test('not-ends-with-insensitive-underscore', async () => {
        // notEndsWithInsensitive with a literal underscore: the literal-underscore row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-QWK'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-Q_K', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-QWK', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notEndsWithInsensitive('q_k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-QWK'])
        })
    })

    test('not-ends-with-insensitive-backslash', async () => {
        // notEndsWithInsensitive with a literal backslash: the literal-backslash row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-QK'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-Q\\K', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-QK', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notEndsWithInsensitive('q\\k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-QK'])
        })
    })

    test('not-ends-with-insensitive-bracket', async () => {
        // notEndsWithInsensitive with a literal bracket: the literal-bracket row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-QB'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-Q[BK]', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-QB', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notEndsWithInsensitive('q[bk]')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-QB'])
        })
    })

    test('not-ends-with-insensitive-if-value-percent', async () => {
        // notEndsWithInsensitiveIfValue with a literal percent: the literal-percent row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-QWK'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-Q%K', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-QWK', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notEndsWithInsensitiveIfValue('q%k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-QWK'])
        })
    })

    test('not-ends-with-insensitive-if-value-underscore', async () => {
        // notEndsWithInsensitiveIfValue with a literal underscore: the literal-underscore row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-QWK'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-Q_K', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-QWK', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notEndsWithInsensitiveIfValue('q_k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-QWK'])
        })
    })

    test('not-ends-with-insensitive-if-value-backslash', async () => {
        // notEndsWithInsensitiveIfValue with a literal backslash: the literal-backslash row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-QK'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-Q\\K', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-QK', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notEndsWithInsensitiveIfValue('q\\k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-QK'])
        })
    })

    test('not-ends-with-insensitive-if-value-bracket', async () => {
        // notEndsWithInsensitiveIfValue with a literal bracket: the literal-bracket row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-QB'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-Q[BK]', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-QB', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notEndsWithInsensitiveIfValue('q[bk]')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-QB'])
        })
    })

    test('contains-underscore', async () => {
        // contains with a literal underscore: correct escaping matches only the literal-underscore row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-q_k-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-q_k-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-qwk-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.contains('q_k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-q_k-z'])
        })
    })

    test('contains-if-value-percent', async () => {
        // containsIfValue with a literal percent: correct escaping matches only the literal-percent row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-q%k-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-q%k-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-qwk-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.containsIfValue('q%k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-q%k-z'])
        })
    })

    test('contains-if-value-bracket', async () => {
        // containsIfValue with a literal bracket: correct escaping matches only the literal-bracket row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-q[bk]-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-q[bk]-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-qb-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.containsIfValue('q[bk]'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-q[bk]-z'])
        })
    })

    test('contains-insensitive-percent', async () => {
        // containsInsensitive with a literal percent: correct escaping matches only the literal-percent row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-Q%K-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-Q%K-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-QWK-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.containsInsensitive('q%k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-Q%K-z'])
        })
    })

    test('contains-insensitive-bracket', async () => {
        // containsInsensitive with a literal bracket: correct escaping matches only the literal-bracket row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-Q[BK]-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-Q[BK]-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-QB-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.containsInsensitive('q[bk]'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-Q[BK]-z'])
        })
    })

    test('contains-insensitive-if-value-percent', async () => {
        // containsInsensitiveIfValue with a literal percent: correct escaping matches only the literal-percent row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-Q%K-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-Q%K-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-QWK-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.containsInsensitiveIfValue('q%k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-Q%K-z'])
        })
    })

    test('contains-insensitive-if-value-underscore', async () => {
        // containsInsensitiveIfValue with a literal underscore: correct escaping matches only the literal-underscore row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-Q_K-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-Q_K-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-QWK-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.containsInsensitiveIfValue('q_k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-Q_K-z'])
        })
    })

    test('contains-insensitive-if-value-backslash', async () => {
        // containsInsensitiveIfValue with a literal backslash: correct escaping matches only the literal-backslash row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-Q\\K-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-Q\\K-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-QK-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.containsInsensitiveIfValue('q\\k'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-Q\\K-z'])
        })
    })

    test('contains-insensitive-if-value-bracket', async () => {
        // containsInsensitiveIfValue with a literal bracket: correct escaping matches only the literal-bracket row, not the decoy.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-Q[BK]-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-Q[BK]-z', fullName: 'str probe' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-QB-z', fullName: 'str decoy' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.containsInsensitiveIfValue('q[bk]'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-Q[BK]-z'])
        })
    })

    test('not-contains-percent', async () => {
        // notContains with a literal percent: the literal-percent row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-qwk-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-q%k-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-qwk-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notContains('q%k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-qwk-z'])
        })
    })

    test('not-contains-bracket', async () => {
        // notContains with a literal bracket: the literal-bracket row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-qb-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-q[bk]-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-qb-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notContains('q[bk]')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-qb-z'])
        })
    })

    test('not-contains-if-value-percent', async () => {
        // notContainsIfValue with a literal percent: the literal-percent row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-qwk-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-q%k-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-qwk-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notContainsIfValue('q%k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-qwk-z'])
        })
    })

    test('not-contains-if-value-underscore', async () => {
        // notContainsIfValue with a literal underscore: the literal-underscore row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-qwk-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-q_k-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-qwk-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notContainsIfValue('q_k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-qwk-z'])
        })
    })

    test('not-contains-if-value-backslash', async () => {
        // notContainsIfValue with a literal backslash: the literal-backslash row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-qk-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-q\\k-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-qk-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notContainsIfValue('q\\k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-qk-z'])
        })
    })

    test('not-contains-if-value-bracket', async () => {
        // notContainsIfValue with a literal bracket: the literal-bracket row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-qb-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-q[bk]-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-qb-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notContainsIfValue('q[bk]')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-qb-z'])
        })
    })

    test('not-contains-insensitive-percent', async () => {
        // notContainsInsensitive with a literal percent: the literal-percent row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-QWK-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-Q%K-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-QWK-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notContainsInsensitive('q%k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-QWK-z'])
        })
    })

    test('not-contains-insensitive-underscore', async () => {
        // notContainsInsensitive with a literal underscore: the literal-underscore row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-QWK-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-Q_K-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-QWK-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notContainsInsensitive('q_k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-QWK-z'])
        })
    })

    test('not-contains-insensitive-backslash', async () => {
        // notContainsInsensitive with a literal backslash: the literal-backslash row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-QK-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-Q\\K-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-QK-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notContainsInsensitive('q\\k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-QK-z'])
        })
    })

    test('not-contains-insensitive-bracket', async () => {
        // notContainsInsensitive with a literal bracket: the literal-bracket row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-QB-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-Q[BK]-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-QB-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notContainsInsensitive('q[bk]')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-QB-z'])
        })
    })

    test('not-contains-insensitive-if-value-percent', async () => {
        // notContainsInsensitiveIfValue with a literal percent: the literal-percent row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-QWK-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-Q%K-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-QWK-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notContainsInsensitiveIfValue('q%k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-QWK-z'])
        })
    })

    test('not-contains-insensitive-if-value-underscore', async () => {
        // notContainsInsensitiveIfValue with a literal underscore: the literal-underscore row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-QWK-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-Q_K-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-QWK-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notContainsInsensitiveIfValue('q_k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-QWK-z'])
        })
    })

    test('not-contains-insensitive-if-value-backslash', async () => {
        // notContainsInsensitiveIfValue with a literal backslash: the literal-backslash row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-QK-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-Q\\K-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-QK-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notContainsInsensitiveIfValue('q\\k')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-QK-z'])
        })
    })

    test('not-contains-insensitive-if-value-bracket', async () => {
        // notContainsInsensitiveIfValue with a literal bracket: the literal-bracket row is excluded, the decoy survives (scoped by full_name marker).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-QB-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-Q[BK]-z', fullName: 'neg-marker' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-QB-z', fullName: 'neg-marker' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.fullName.equals('neg-marker').and(tAppUser.email.notContainsInsensitiveIfValue('q[bk]')))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-QB-z'])
        })
    })

    test('starts-with-column-operand-underscore-literal', async () => {
        // startsWith(<column>) uses full_name as the needle, so its metachar is escaped at
        // the SQL level. Both rows share full_name 'q_k' (literal underscore); only Row A's
        // email begins with that literal, so correct escaping matches only Row A. Row B would
        // leak if the `_` reached the engine as a single-char wildcard.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['q_k-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'q_k-z', fullName: 'q_k' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'qwk-z', fullName: 'q_k' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWith(tAppUser.fullName))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['q_k-z'])
        })
    })

    test('ends-with-column-operand-underscore-literal', async () => {
        // endsWith(<column>) uses full_name 'q_k' (literal underscore) as the needle. Only
        // Row A's email ends with that literal; Row B would leak if the `_` reached the engine
        // as a single-char wildcard.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['z-q_k'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-q_k', fullName: 'q_k' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'z-qwk', fullName: 'q_k' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.endsWith(tAppUser.fullName))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['z-q_k'])
        })
    })

    test('contains-column-operand-percent-literal', async () => {
        // contains(<column>) uses full_name 'q%k' (literal percent) as the needle. Only Row A's
        // email holds that literal; Row B would leak if the `%` reached the engine as a
        // multi-char wildcard (matching q<any>k).
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['c-q%k-z'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-q%k-z', fullName: 'q%k' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'c-qwk-z', fullName: 'q%k' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.contains(tAppUser.fullName))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['c-q%k-z'])
        })
    })

    test('not-contains-column-operand-underscore-literal', async () => {
        // notContains(<column>) uses full_name 'q_k' (literal underscore) as the needle, scoped
        // to the two `nc-`-prefixed rows. Row A's email holds the literal `q_k` and is EXCLUDED;
        // Row B (`nc-qwk@t`) — which only matches `q_k` as the wildcard `q<any>k` — is KEPT.
        // Without escaping both would be excluded, so the surviving row proves the escape.
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(['nc-qwk@t'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'nc-q_k@t', fullName: 'q_k' })
                .executeInsert()
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'nc-qwk@t', fullName: 'q_k' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWith('nc-').and(tAppUser.email.notContains(tAppUser.fullName)))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['nc-qwk@t'])
        })
    })
})
