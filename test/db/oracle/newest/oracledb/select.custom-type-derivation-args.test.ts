// Operations that DERIVE a new data type from the receiver's own, applied to
// FRAGMENT-BUILDER ARGUMENTS declared with a custom data type. An argument that
// merely binds its value is blind to its data type being wrong: the bound value
// is marshalled with the type NAME, which the declaration keeps either way. Only
// an operation applied to the argument INSIDE the fragment body derives a new
// type from it.
//
// Two observables are used here, and they are independent:
//
//   - The SQL the dialect emits for the derivation. `modulo` over a fractional
//     receiver needs a different form from an integer one, and which one it is is
//     read from the argument's own data type. These arguments carry NO adapter.
//   - The value transform of a type-name conditional adapter (`scaledByTypeName`,
//     which scales by 100 only when handed `Cents` or `Money`). Those tests are
//     block-commented: `arg(...)` / `valueArg(...)` currently hand the marshaller
//     the OPTIONALITY string in place of the declared type name, so the adapter is
//     never given a chance to fire.
//
// Every fragment body keeps each placeholder next to a typed column operand, so
// the emitted SQL resolves on every dialect.
//
// Seed used: col_matrix holds a single row with m_int 42.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tDerivedColumn } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // -- the emitted form of a derivation over a custom-typed argument -------

    test('arg/custom-double-modulo-emits-the-form-the-argument-data-type-requires', async () => {
        // 1 `Money` modulo 2 `Money`. The receiver is fractional, so the modulo
        // takes the floating-point form; the remainder 1 is read back unchanged
        // (this argument carries no adapter).
        ctx.mockNext(1)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(ctx.conn.derivedArgMoneyModulo(1))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select mod(:0, :1) as "result" from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1)
    })

    test('aggregate-arg/custom-double-modulo-emits-the-form-the-argument-data-type-requires', async () => {
        // The aggregate sibling: the same modulo summed over the single row.
        ctx.mockNext(1)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(ctx.conn.derivedAggArgMoneyModulo(1))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(mod(:0, :1)) as "result" from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1)
    })

    test('if-value-value-arg/custom-double-modulo-emits-the-form-the-argument-data-type-requires', async () => {
        // The value-only argument form, as a predicate: (1 mod 2) < 10, so the row
        // survives the filter.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .where(ctx.conn.derivedValueArgMoneyModuloIfValue(1))
            .selectOneColumn(tDerivedColumn.plainInt)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int as "result" from col_matrix where (mod(:0, :1)) < :2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            10,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(42)
    })

    // -- the value transform of a type-name conditional adapter --------------
    //
    // The bodies below are the ones that will run once `arg(...)` / `valueArg(...)`
    // hand the marshaller the declared type name. Today they hand it the
    // optionality string instead, so `scaledByTypeName` is never invoked with
    // `Cents` / `Money` and every bound operand stays unscaled.

    // TODO[BUG]: see test/BUGS.md — arg()/valueArg() swap the type name and the optionality of a custom-typed argument.
    /*
    test('arg/custom-int-add-binds-the-extra-operand-with-the-argument-data-type', async () => {
        // 5 `Cents` (bound as 500) plus the 42 of m_int plus 9 `Cents` (bound as
        // 900). The fragment declares a plain `int` result, so the sum 1442 is
        // read back unscaled.
        ctx.mockNext(1442)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(ctx.conn.derivedArgCents(5, tDerivedColumn.plainCents))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1 + m_int + $2 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            500,
            900,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1442)
    })
    */

    // TODO[BUG]: see test/BUGS.md — arg()/valueArg() swap the type name and the optionality of a custom-typed argument.
    /*
    test('arg/custom-double-add-binds-the-extra-operand-with-the-argument-data-type', async () => {
        // 1 `Money` (bound as 100) plus the 3.5 of m_double plus 9 `Money` (bound
        // as 900); the plain `double` result reads the sum 1003.5 back unscaled.
        ctx.mockNext(1003.5)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(ctx.conn.derivedArgMoney(1, tDerivedColumn.plainMoney))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1 + m_int + $2 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
            900,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1003.5)
    })
    */

    // TODO[BUG]: see test/BUGS.md — arg()/valueArg() swap the type name and the optionality of a custom-typed argument.
    /*
    test('arg/custom-int-add-returned-derived-source-reads-back-with-the-argument-data-type', async () => {
        // The same argument, but the fragment returns the DERIVED value source
        // instead of wrapping it, so the derived data type also governs the read:
        // 500 + 42 = 542 reads back as 5.42.
        ctx.mockNext(542)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(ctx.conn.derivedArgCentsRead(5, tDerivedColumn.plainCents))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1 + m_int as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            500,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(5.42)
    })
    */

    // TODO[BUG]: see test/BUGS.md — arg()/valueArg() swap the type name and the optionality of a custom-typed argument.
    /*
    test('arg/custom-double-add-returned-derived-source-reads-back-with-the-argument-data-type', async () => {
        // The customDouble twin: 100 + 3.5 = 103.5 reads back as 1.035.
        ctx.mockNext(103.5)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(ctx.conn.derivedArgMoneyRead(1, tDerivedColumn.plainMoney))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1 + m_int as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1.035)
    })
    */

    // TODO[BUG]: see test/BUGS.md — arg()/valueArg() swap the type name and the optionality of a custom-typed argument.
    /*
    test('maybe-optional-arg/custom-int-add-binds-the-extra-operand-with-the-argument-data-type', async () => {
        // Both arguments are present, so the merged result is required. The
        // derivation binds 900 for the 9 `Cents` and the sum is 1442.
        ctx.mockNext(1442)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(ctx.conn.derivedMaybeOptionalArgCents(5, tDerivedColumn.plainCents))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1 + m_int + $2 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            500,
            900,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1442)
    })
    */

    // TODO[BUG]: see test/BUGS.md — arg()/valueArg() swap the type name and the optionality of a custom-typed argument.
    /*
    test('if-value-arg/custom-int-add-binds-the-extra-operand-with-the-argument-data-type', async () => {
        // The predicate is `500 + 42 + 900 > 1000`, true only while the 9 binds
        // as 900 `Cents`; the row survives the filter.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .where(ctx.conn.derivedArgCentsIfValue(5, tDerivedColumn.plainCents, 1000))
            .selectOneColumn(tDerivedColumn.plainInt)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int as result from col_matrix where ($1 + m_int + $2) > $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            500,
            900,
            1000,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(42)
    })
    */

    // TODO[BUG]: see test/BUGS.md — arg()/valueArg() swap the type name and the optionality of a custom-typed argument.
    /*
    test('if-value-value-arg/custom-int-add-binds-the-extra-operand-with-the-argument-data-type', async () => {
        // The value-only argument form. The predicate is
        // `500 + 42 + 900 > 42 * 20`, true only while the 9 binds as 900 `Cents`.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .where(ctx.conn.derivedValueArgCentsIfValue(tDerivedColumn.plainCents, 5))
            .selectOneColumn(tDerivedColumn.plainInt)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int as result from col_matrix where ($1 + m_int + $2) > (m_int * $3)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            500,
            900,
            20,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(42)
    })
    */

    // TODO[BUG]: see test/BUGS.md — arg()/valueArg() swap the type name and the optionality of a custom-typed argument.
    /*
    test('aggregate-arg/custom-int-add-binds-the-extra-operand-with-the-argument-data-type', async () => {
        // The aggregate sibling: `sum(500 + 42 + 900)` over the single row.
        ctx.mockNext(1442)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(ctx.conn.derivedAggArgCents(5, tDerivedColumn.plainCents))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum($1 + m_int + $2) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            500,
            900,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1442)
    })
    */

    // TODO[BUG]: see test/BUGS.md — arg()/valueArg() swap the type name and the optionality of a custom-typed argument.
    /*
    test('aggregate-maybe-optional-arg/custom-double-add-binds-the-extra-operand-with-the-argument-data-type', async () => {
        // Both arguments are present, so the merged result is required:
        // `sum(100 + 3.5 + 900)` over the single row.
        ctx.mockNext(1003.5)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(ctx.conn.derivedAggMaybeOptionalArgMoney(1, tDerivedColumn.plainMoney))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum($1 + m_int + $2) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
            900,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1003.5)
    })
    */

    // TODO[BUG]: see test/BUGS.md — arg()/valueArg() swap the type name and the optionality of a custom-typed argument.
    /*
    test('aggregate-if-value-value-arg/custom-int-add-binds-the-extra-operand-with-the-argument-data-type', async () => {
        // A HAVING predicate over the grouped row: `sum(500 + 42 + 900)` against
        // `sum(42) * 20`, i.e. 1442 > 840 — true only while the 9 binds as 900
        // `Cents`.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tDerivedColumn)
            .groupBy(tDerivedColumn.id)
            .having(ctx.conn.derivedAggValueArgCentsIfValue(tDerivedColumn.plainCents, 5))
            .select({ id: tDerivedColumn.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from col_matrix group by id having (sum($1 + m_int + $2) > (sum(m_int) * 20))"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            500,
            900,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })
    */
})
