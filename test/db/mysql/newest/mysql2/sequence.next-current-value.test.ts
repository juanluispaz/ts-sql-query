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

import { afterAll, beforeAll, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)

    // NOT-APPLICABLE: MySQL has no sequences; `connection.sequence(...)` is not typed on MySqlConnection.
    /*
    import { test, expect, beforeEach } from '../../../../lib/testRunner.js'
    beforeEach(() => { ctx.reset() })

    test('sequence-next-value-in-select', async () => {
        // `seq.nextValue()` returns a SequenceValueSource tagged
        // `_nextSequenceValue`; SelectQueryBuilder dispatches it
        // through the dialect's `_nextSequenceValue(...)` override.
        ctx.mockNext(42)
        const next = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.issueIdSeq.nextValue())
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        if (!ctx.realDbEnabled) expect(next).toBe(42)
        else expect(typeof next).toBe('number')
    })
    */

    // NOT-APPLICABLE: MySQL has no sequences; `connection.sequence(...)` is not typed on MySqlConnection.
    /*
    test('sequence-current-value-in-select', async () => {
        // `seq.currentValue()` mirrors nextValue but dispatches to
        // `_currentSequenceValue`, pinned per cell by the snapshot
        // below. Some engines require `nextValue` to have been called in
        // the same session before `currentValue`, so the test calls
        // `nextValue` first when running against a real DB.
        if (ctx.realDbEnabled) {
            await ctx.conn.selectFromNoTable()
                .selectOneColumn(ctx.conn.issueIdSeq.nextValue())
                .executeSelectOne()
        }
        ctx.mockNext(41)
        const curr = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.issueIdSeq.currentValue())
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        if (!ctx.realDbEnabled) expect(curr).toBe(41)
        else expect(typeof curr).toBe('number')
    })
    */

    // NOT-APPLICABLE: MySQL has no sequences; `connection.sequence(...)` is not typed on MySqlConnection.
    /*
    test('sequence-bigint-next-value-emission', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        expect(typeof next === 'bigint' || typeof next === 'string' || typeof next === 'number').toBe(true)
    })
    */

    // NOT-APPLICABLE: MySQL has no sequences; `connection.sequence(...)` is not typed on MySqlConnection.
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof next, ReleaseTag>>()
            if (!ctx.realDbEnabled) expect(next).toBe(7 as ReleaseTag)
            else expect(typeof next).toBe('number')
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no sequences; connection.sequence(...) is not typed on MySqlConnection.
    /*
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
    */

    // NOT-APPLICABLE: MySQL has no sequences; connection.sequence(...) is not typed on MySqlConnection.
    /*
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
    */
})
