// Coverage of `connection.sequence(name, type).nextValue()` and
// `.currentValue`. The dispatcher constructs a `SequenceValueSource`
// tagged with `_nextSequenceValue` / `_currentSequenceValue`; each
// dialect's SqlBuilder renders that pair its own way, pinned per cell
// by the snapshot below. Where the dialect has no `CREATE SEQUENCE` and
// the `sequence()` API isn't exposed at the type level, the test is
// commented out.
//
// The two sequence references the tests use (`issueIdSeq`,
// `auditTagSeq`) are declared on the shared
// [`DBConnection`](../../domain/connection.ts) — the per-dialect
// connection class that already extends `AbstractAdvancedConnection`
// for these four dialects.
//
// Each test wraps its body in `ctx.withCommit(...)` for two reasons:
//   1. The transaction `withCommit` opens pins one backend session,
//      so the `currval` / `lastval` call sees the prior `nextval`
//      (those functions are session-scoped on the engines that expose
//      them).
//   2. The trailing reseed resets the sequence counters that
//      `nextval()` bumps. Sequences are non-transactional on every
//      supported engine, so a `withRollback` would leave the bump
//      behind — and the implicit sequence behind `issue.id` would
//      then shift every subsequent insert id.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { ReleaseTag } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('sequence-next-value-in-select', async () => {
        await ctx.withCommit(async () => {
            // `seq.nextValue()` returns a SequenceValueSource tagged
            // `_nextSequenceValue`; SelectQueryBuilder dispatches it
            // through the dialect's `_nextSequenceValue(...)` override.
            ctx.mockNext(42)
            const next = await ctx.conn.selectFromNoTable()
                .selectOneColumn(ctx.conn.issueIdSeq.nextValue())
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select nextval('issue_id_seq') as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            if (!ctx.realDbEnabled) expect(next).toBe(42)
            else expect(typeof next).toBe('number')
        })
    })

    test('sequence-current-value-in-select', async () => {
        await ctx.withCommit(async () => {
            // `seq.currentValue()` mirrors nextValue but dispatches to
            // `_currentSequenceValue`; the form this dialect emits is
            // pinned by the snapshot below. currval / lastval is
            // session-scoped, so the outer `withCommit` (which opens a
            // `connection.transaction` for us) pins the pool's backend
            // and both queries land on the same session.
            // (Asserts stay inside the body so `lastSql` shows the
            // currentValue query, not the trailing "commit".)
            ctx.mockNext(41)
            if (ctx.realDbEnabled) {
                await ctx.conn.selectFromNoTable()
                    .selectOneColumn(ctx.conn.issueIdSeq.nextValue())
                    .executeSelectOne()
            }
            const curr = await ctx.conn.selectFromNoTable()
                .selectOneColumn(ctx.conn.issueIdSeq.currentValue())
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select currval('issue_id_seq') as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            if (!ctx.realDbEnabled) expect(curr).toBe(41)
            else expect(typeof curr).toBe('number')
        })
    })

    test('sequence-bigint-next-value-emission', async () => {
        await ctx.withCommit(async () => {
            // Sequences over `bigint` round-trip through the same
            // dispatcher; the value type only changes how the result is
            // type-adapted, not the emitted SQL keyword. Real-DB returns
            // an engine-assigned bigint (sometimes serialized as string
            // or number depending on the driver), so the type assertion
            // accepts all three shapes.
            ctx.mockNext('9223372036854775000')
            const next = await ctx.conn.selectFromNoTable()
                .selectOneColumn(ctx.conn.auditTagSeq.nextValue())
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select nextval('audit_tag_seq') as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            expect(typeof next === 'bigint' || typeof next === 'string' || typeof next === 'number').toBe(true)
        })
    })

    test('sequence-custom-int-value-type', async () => {
        await ctx.withCommit(async () => {
            // `release_tag_seq` is declared
            // over a branded `customInt` (`ReleaseTag`) rather than the plain
            // int / bigint of the sequences above. The emitted SQL is identical
            // to the int form (the value type only changes the type adapter);
            // the assertion pins that `nextValue()` projects the branded
            // CustomIntValueSource.
            ctx.mockNext(7)
            const next = await ctx.conn.selectFromNoTable()
                .selectOneColumn(ctx.conn.releaseTagSeq.nextValue())
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select nextval('release_tag_seq') as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof next, ReleaseTag>>()
            if (!ctx.realDbEnabled) expect(next).toBe(7 as ReleaseTag)
            else expect(typeof next).toBe('number')
        })
    })

    test('sequence-bigint-current-value-emission', async () => {
        await ctx.withCommit(async () => {
            // `currentValue()` over a BIGINT sequence. The emitted SQL is the
            // same `currval`/equivalent as the int form; the value type only
            // changes the type adapter. currval is session-scoped, so a prior
            // nextValue primes it on the real DB.
            ctx.mockNext('9223372036854775000')
            if (ctx.realDbEnabled) {
                await ctx.conn.selectFromNoTable()
                    .selectOneColumn(ctx.conn.auditTagSeq.nextValue())
                    .executeSelectOne()
            }
            const curr = await ctx.conn.selectFromNoTable()
                .selectOneColumn(ctx.conn.auditTagSeq.currentValue())
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select currval('audit_tag_seq') as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            expect(typeof curr === 'bigint' || typeof curr === 'string' || typeof curr === 'number').toBe(true)
        })
    })

    test('sequence-custom-int-current-value-type', async () => {
        await ctx.withCommit(async () => {
            // `currentValue()` over a branded `customInt` sequence
            // (release_tag_seq / ReleaseTag): the result is the branded
            // CustomIntValueSource, like nextValue.
            ctx.mockNext(7)
            if (ctx.realDbEnabled) {
                await ctx.conn.selectFromNoTable()
                    .selectOneColumn(ctx.conn.releaseTagSeq.nextValue())
                    .executeSelectOne()
            }
            const curr = await ctx.conn.selectFromNoTable()
                .selectOneColumn(ctx.conn.releaseTagSeq.currentValue())
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select currval('release_tag_seq') as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof curr, ReleaseTag>>()
            if (!ctx.realDbEnabled) expect(curr).toBe(7 as ReleaseTag)
            else expect(typeof curr).toBe('number')
        })
    })

    test('sequence-next-value-with-trailing-adapter', async () => {
        await ctx.withCommit(async () => {
            // issueIdSeqOffset reuses issue_id_seq but carries a trailing
            // TypeAdapter (plusOffsetAdapter, read +1000) — the value-transform
            // slot of sequence(...). The emitted SQL is identical to issueIdSeq;
            // only the read value is shifted. The mock is primed with the RAW 42,
            // so nextValue() comes back as 1042.
            ctx.mockNext(42)
            const next = await ctx.conn.selectFromNoTable()
                .selectOneColumn(ctx.conn.issueIdSeqOffset.nextValue())
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select nextval('issue_id_seq') as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            if (!ctx.realDbEnabled) expect(next).toBe(1042)
            else expect(typeof next).toBe('number')
        })
    })

    test('sequence-current-value-with-trailing-adapter', async () => {
        await ctx.withCommit(async () => {
            // currentValue() over the same adapter-carrying sequence reference:
            // the read value is shifted by plusOffsetAdapter (+1000). currval is
            // session-scoped, so a prior nextValue primes it on the real DB.
            ctx.mockNext(41)
            if (ctx.realDbEnabled) {
                await ctx.conn.selectFromNoTable()
                    .selectOneColumn(ctx.conn.issueIdSeqOffset.nextValue())
                    .executeSelectOne()
            }
            const curr = await ctx.conn.selectFromNoTable()
                .selectOneColumn(ctx.conn.issueIdSeqOffset.currentValue())
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select currval('issue_id_seq') as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            if (!ctx.realDbEnabled) expect(curr).toBe(1041)
            else expect(typeof curr).toBe('number')
        })
    })
})
