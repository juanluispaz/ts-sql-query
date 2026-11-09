// Operations that DERIVE a new data type from the receiver's own, applied to a
// SEQUENCE reference declared with a custom data type. Drawing the value alone is
// blind to the data type being wrong: the drawn value is marshalled with the type
// NAME, which the declaration keeps either way. Only an operation that derives a
// new type from the sequence's own data type can tell.
//
// The instrument is the `scaledByTypeName` adapter the sequence declaration
// carries: it scales a number by 100 only when the type name it is handed is
// `Cents` or `Money`. So a derivation that KEEPS the sequence's custom data type
// binds its extra operand scaled and reads its answer back scaled.
//
// Every body starts from `nextValue().multiply(0)`. The drawn number is not
// reproducible — the engine decides it — while zero is, and the zeroing operand
// scales to zero whichever data type it is marshalled with, so it leaves the
// assertion deterministic without settling the question the test asks. Everything
// after it is still driven by the sequence's own data type.
//
// Each body runs inside `ctx.withCommit` for the same two reasons the other
// sequence tests do: the transaction pins one backend session so `currval` sees
// the prior `nextval`, and the trailing reseed puts back the counter `nextval`
// bumped (sequences are not transactional on any supported engine).
//
// Seed used: col_matrix holds a single row with m_int 42, read through the
// `ReleaseTag` data type the sequence also carries.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tDerivedColumn } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('sequence/custom-int-add-binds-the-extra-operand-with-the-sequence-data-type', async () => {
        await ctx.withCommit(async () => {
            // The zeroed draw plus 9 `ReleaseTag`: the operand binds scaled (900)
            // and the sum 900 reads back as 9.
            ctx.mockNext(900)
            const v = await ctx.conn.selectFromNoTable()
                .selectOneColumn(ctx.conn.derivedTagSeq.nextValue().multiply(0).add(9))
                .executeSelectOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select (release_tag_seq.nextval * :0) + :1 as "result" from dual"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                0,
                900,
              ]
            `)
            assertType<Exact<typeof v, number>>()
            expect(v).toBe(9)
        })
    })

    test('sequence/custom-int-add-column-reads-back-with-the-sequence-data-type', async () => {
        await ctx.withCommit(async () => {
            // The zeroed draw plus the 42 of the `ReleaseTag` column: nothing is
            // bound for the column, so the answer 42 reads back as 0.42 only while
            // the sum still carries the sequence's data type.
            ctx.mockNext(42)
            const v = await ctx.conn.selectFrom(tDerivedColumn)
                .selectOneColumn(ctx.conn.derivedTagSeq.nextValue().multiply(0).add(tDerivedColumn.releaseTag))
                .executeSelectOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select (release_tag_seq.nextval * :0) + m_int as "result" from col_matrix"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                0,
              ]
            `)
            assertType<Exact<typeof v, number>>()
            expect(v).toBe(0.42)
        })
    })

    test('sequence/custom-int-ceil-keeps-the-sequence-data-type', async () => {
        await ctx.withCommit(async () => {
            // The ceiling of the same sum: no extra bound operand, and the answer
            // 42 reads back as 0.42.
            ctx.mockNext(42)
            const v = await ctx.conn.selectFrom(tDerivedColumn)
                .selectOneColumn(ctx.conn.derivedTagSeq.nextValue().multiply(0).add(tDerivedColumn.releaseTag).ceil())
                .executeSelectOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil((release_tag_seq.nextval * :0) + m_int) as "result" from col_matrix"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                0,
              ]
            `)
            assertType<Exact<typeof v, number>>()
            expect(v).toBe(0.42)
        })
    })

    test('sequence/custom-int-modulo-binds-the-extra-operand-with-the-sequence-data-type', async () => {
        await ctx.withCommit(async () => {
            // The same sum modulo 5 `ReleaseTag`: the divisor binds scaled (500),
            // so the remainder is the whole 42 and reads back as 0.42.
            ctx.mockNext(42)
            const v = await ctx.conn.selectFrom(tDerivedColumn)
                .selectOneColumn(ctx.conn.derivedTagSeq.nextValue().multiply(0).add(tDerivedColumn.releaseTag).modulo(5))
                .executeSelectOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select mod((release_tag_seq.nextval * :0) + m_int, :1) as "result" from col_matrix"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                0,
                500,
              ]
            `)
            assertType<Exact<typeof v, number>>()
            expect(v).toBe(0.42)
        })
    })

    test('sequence/current-value-custom-int-add-column-reads-back-with-the-sequence-data-type', async () => {
        await ctx.withCommit(async () => {
            // The same derivation over `currentValue()` instead of `nextValue()`.
            // currval / lastval is session-scoped, so a draw has to happen first on
            // a real engine; the enclosing transaction keeps both on one session.
            ctx.mockNext(42)
            if (ctx.realDbEnabled) {
                await ctx.conn.selectFromNoTable()
                    .selectOneColumn(ctx.conn.derivedTagSeq.nextValue())
                    .executeSelectOne()
            }
            const v = await ctx.conn.selectFrom(tDerivedColumn)
                .selectOneColumn(ctx.conn.derivedTagSeq.currentValue().multiply(0).add(tDerivedColumn.releaseTag))
                .executeSelectOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select (release_tag_seq.currval * :0) + m_int as "result" from col_matrix"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                0,
              ]
            `)
            assertType<Exact<typeof v, number>>()
            expect(v).toBe(0.42)
        })
    })
})
