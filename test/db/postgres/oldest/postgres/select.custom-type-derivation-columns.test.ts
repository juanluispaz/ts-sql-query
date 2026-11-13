// Operations that DERIVE a new data type from the receiver's own, applied to
// COLUMNS declared with a custom data type. A column that is only PROJECTED is
// blind to its data type being wrong: everything that marshals a value reads the
// type NAME, which a projection preserves. Only an operation that derives a new
// type from the column's own data type can tell.
//
// The instrument is the per-column `scaledByTypeName` adapter declared with the
// fixtures: it scales a number by 100 only when the type name it is handed is
// `Cents` or `Money`. A derived expression that KEEPS the column's custom data
// type therefore binds its extra operand scaled and reads its answer back scaled;
// one that has fallen back to a plain `int` / `double` does neither. The mock
// queues the RAW value the database would answer and the assertion is on the value
// AFTER the adapter, so the single unconditional `expect(...)` covers the mock
// round-trip and the real-DB result at once.
//
// One fixture per column factory reads the same row, so a factory that loses the
// custom data type shows up on its own rather than hiding behind its siblings.
//
// Seed used: col_matrix (and the col_matrix_view over it) hold a single row with
// m_int 42 and m_double 3.5, which the custom columns read back as 0.42 (`Cents`)
// and 0.035 (`Money`).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { TypeAdapter } from '../../../../../src/TypeAdapter.js'
import { Values } from '../../../../../src/Values.js'
import {
    DBConnection,
    tDerivedAutogenPk,
    tDerivedColumn,
    tDerivedComputed,
    tDerivedDefault,
    tDerivedOptional,
    tDerivedOptionalComputed,
    tDerivedOptionalDefault,
    tDerivedPk,
    tDerivedVirtual,
    vDerivedColumn,
} from '../../domain/connection.js'
import { ctx } from './setup.js'

// The same conditional adapter the shared fixtures carry, declared here for the
// `Values` views below (a `Values` subclass is declared where it is used).
const scaledByTypeName: TypeAdapter = {
    transformValueFromDB(value, type, typeCategory, context, next) {
        const v = next.transformValueFromDB(value, type, typeCategory, context)
        if ((type === 'Cents' || type === 'Money') && typeof v === 'number') {
            return v / 100
        }
        return v
    },
    transformValueToDB(value, type, typeCategory, context, next) {
        if ((type === 'Cents' || type === 'Money') && typeof value === 'number') {
            return next.transformValueToDB(value * 100, type, typeCategory, context)
        }
        return next.transformValueToDB(value, type, typeCategory, context)
    },
}

// `column(type, typeName, adapter)` / `optionalColumn(type, typeName, adapter)` on
// a constant VALUES view. The tuple carries cents 5 (bound scaled as 500) and
// money 1 (bound scaled as 100).
class VDerivedBilling extends Values<DBConnection, 'derivedBilling'> {
    cents = this.column<number, 'Cents'>('customInt', 'Cents', scaledByTypeName)
    money = this.column<number, 'Money'>('customDouble', 'Money', scaledByTypeName)
}
class VDerivedBillingOptional extends Values<DBConnection, 'derivedBillingOpt'> {
    cents = this.optionalColumn<number, 'Cents'>('customInt', 'Cents', scaledByTypeName)
    money = this.optionalColumn<number, 'Money'>('customDouble', 'Money', scaledByTypeName)
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // -- column ---------------------------------------------------------------

    test('column/custom-int-add-keeps-the-column-data-type', async () => {
        // 42 cents plus 9 `Cents`: the operand binds scaled (900) and the sum 942
        // reads back as 9.42.
        ctx.mockNext(942)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.cents.add(9))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int + $1 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(9.42)
    })

    test('column/custom-int-ceil-keeps-the-column-data-type', async () => {
        // ceil of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.cents.ceil())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(m_int) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.42)
    })

    test('column/custom-double-add-keeps-the-column-data-type', async () => {
        // 3.5 money plus 1 `Money`: the operand binds scaled (100) and the sum
        // 103.5 reads back as 1.035.
        ctx.mockNext(103.5)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.money.add(1))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_double + $1 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1.035)
    })

    test('column/custom-double-modulo-keeps-the-column-data-type', async () => {
        // 3.5 money modulo 1 `Money`: the divisor binds scaled (100), the
        // remainder 3.5 reads back as 0.035, and the emitted modulo takes the
        // floating-point form the dialect needs for a fractional operand.
        ctx.mockNext(3.5)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.money.modulo(1))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select mod((m_double)::numeric, ($1)::numeric) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.035)
    })

    // -- optional-column ---------------------------------------------------------------

    test('optional-column/custom-int-add-keeps-the-column-data-type', async () => {
        // 42 cents plus 9 `Cents`: the operand binds scaled (900) and the sum 942
        // reads back as 9.42.
        ctx.mockNext({ derived: 942 })
        const row = await ctx.conn.selectFrom(tDerivedOptional)
            .select({ derived: tDerivedOptional.cents.add(9) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int + $1 as derived from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
          ]
        `)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 9.42 })
    })

    test('optional-column/custom-int-ceil-keeps-the-column-data-type', async () => {
        // ceil of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext({ derived: 42 })
        const row = await ctx.conn.selectFrom(tDerivedOptional)
            .select({ derived: tDerivedOptional.cents.ceil() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(m_int) as derived from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 0.42 })
    })

    test('optional-column/custom-double-add-keeps-the-column-data-type', async () => {
        // 3.5 money plus 1 `Money`: the operand binds scaled (100) and the sum
        // 103.5 reads back as 1.035.
        ctx.mockNext({ derived: 103.5 })
        const row = await ctx.conn.selectFrom(tDerivedOptional)
            .select({ derived: tDerivedOptional.money.add(1) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_double + $1 as derived from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 1.035 })
    })

    test('optional-column/custom-double-modulo-keeps-the-column-data-type', async () => {
        // 3.5 money modulo 1 `Money`: the divisor binds scaled (100), the
        // remainder 3.5 reads back as 0.035, and the emitted modulo takes the
        // floating-point form the dialect needs for a fractional operand.
        ctx.mockNext({ derived: 3.5 })
        const row = await ctx.conn.selectFrom(tDerivedOptional)
            .select({ derived: tDerivedOptional.money.modulo(1) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select mod((m_double)::numeric, ($1)::numeric) as derived from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 0.035 })
    })

    // -- column-with-default-value ---------------------------------------------------------------

    test('column-with-default-value/custom-int-add-keeps-the-column-data-type', async () => {
        // 42 cents plus 9 `Cents`: the operand binds scaled (900) and the sum 942
        // reads back as 9.42.
        ctx.mockNext(942)
        const v = await ctx.conn.selectFrom(tDerivedDefault)
            .selectOneColumn(tDerivedDefault.cents.add(9))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int + $1 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(9.42)
    })

    test('column-with-default-value/custom-int-ceil-keeps-the-column-data-type', async () => {
        // ceil of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(tDerivedDefault)
            .selectOneColumn(tDerivedDefault.cents.ceil())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(m_int) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.42)
    })

    test('column-with-default-value/custom-double-add-keeps-the-column-data-type', async () => {
        // 3.5 money plus 1 `Money`: the operand binds scaled (100) and the sum
        // 103.5 reads back as 1.035.
        ctx.mockNext(103.5)
        const v = await ctx.conn.selectFrom(tDerivedDefault)
            .selectOneColumn(tDerivedDefault.money.add(1))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_double + $1 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1.035)
    })

    test('column-with-default-value/custom-double-modulo-keeps-the-column-data-type', async () => {
        // 3.5 money modulo 1 `Money`: the divisor binds scaled (100), the
        // remainder 3.5 reads back as 0.035, and the emitted modulo takes the
        // floating-point form the dialect needs for a fractional operand.
        ctx.mockNext(3.5)
        const v = await ctx.conn.selectFrom(tDerivedDefault)
            .selectOneColumn(tDerivedDefault.money.modulo(1))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select mod((m_double)::numeric, ($1)::numeric) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.035)
    })

    // -- optional-column-with-default-value ---------------------------------------------------------------

    test('optional-column-with-default-value/custom-int-add-keeps-the-column-data-type', async () => {
        // 42 cents plus 9 `Cents`: the operand binds scaled (900) and the sum 942
        // reads back as 9.42.
        ctx.mockNext({ derived: 942 })
        const row = await ctx.conn.selectFrom(tDerivedOptionalDefault)
            .select({ derived: tDerivedOptionalDefault.cents.add(9) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int + $1 as derived from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
          ]
        `)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 9.42 })
    })

    test('optional-column-with-default-value/custom-int-ceil-keeps-the-column-data-type', async () => {
        // ceil of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext({ derived: 42 })
        const row = await ctx.conn.selectFrom(tDerivedOptionalDefault)
            .select({ derived: tDerivedOptionalDefault.cents.ceil() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(m_int) as derived from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 0.42 })
    })

    test('optional-column-with-default-value/custom-double-add-keeps-the-column-data-type', async () => {
        // 3.5 money plus 1 `Money`: the operand binds scaled (100) and the sum
        // 103.5 reads back as 1.035.
        ctx.mockNext({ derived: 103.5 })
        const row = await ctx.conn.selectFrom(tDerivedOptionalDefault)
            .select({ derived: tDerivedOptionalDefault.money.add(1) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_double + $1 as derived from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 1.035 })
    })

    test('optional-column-with-default-value/custom-double-modulo-keeps-the-column-data-type', async () => {
        // 3.5 money modulo 1 `Money`: the divisor binds scaled (100), the
        // remainder 3.5 reads back as 0.035, and the emitted modulo takes the
        // floating-point form the dialect needs for a fractional operand.
        ctx.mockNext({ derived: 3.5 })
        const row = await ctx.conn.selectFrom(tDerivedOptionalDefault)
            .select({ derived: tDerivedOptionalDefault.money.modulo(1) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select mod((m_double)::numeric, ($1)::numeric) as derived from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 0.035 })
    })

    // -- computed-column ---------------------------------------------------------------

    test('computed-column/custom-int-add-keeps-the-column-data-type', async () => {
        // 42 cents plus 9 `Cents`: the operand binds scaled (900) and the sum 942
        // reads back as 9.42.
        ctx.mockNext(942)
        const v = await ctx.conn.selectFrom(tDerivedComputed)
            .selectOneColumn(tDerivedComputed.cents.add(9))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int + $1 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(9.42)
    })

    test('computed-column/custom-int-ceil-keeps-the-column-data-type', async () => {
        // ceil of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(tDerivedComputed)
            .selectOneColumn(tDerivedComputed.cents.ceil())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(m_int) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.42)
    })

    test('computed-column/custom-double-add-keeps-the-column-data-type', async () => {
        // 3.5 money plus 1 `Money`: the operand binds scaled (100) and the sum
        // 103.5 reads back as 1.035.
        ctx.mockNext(103.5)
        const v = await ctx.conn.selectFrom(tDerivedComputed)
            .selectOneColumn(tDerivedComputed.money.add(1))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_double + $1 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1.035)
    })

    test('computed-column/custom-double-modulo-keeps-the-column-data-type', async () => {
        // 3.5 money modulo 1 `Money`: the divisor binds scaled (100), the
        // remainder 3.5 reads back as 0.035, and the emitted modulo takes the
        // floating-point form the dialect needs for a fractional operand.
        ctx.mockNext(3.5)
        const v = await ctx.conn.selectFrom(tDerivedComputed)
            .selectOneColumn(tDerivedComputed.money.modulo(1))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select mod((m_double)::numeric, ($1)::numeric) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.035)
    })

    // -- optional-computed-column ---------------------------------------------------------------

    test('optional-computed-column/custom-int-add-keeps-the-column-data-type', async () => {
        // 42 cents plus 9 `Cents`: the operand binds scaled (900) and the sum 942
        // reads back as 9.42.
        ctx.mockNext({ derived: 942 })
        const row = await ctx.conn.selectFrom(tDerivedOptionalComputed)
            .select({ derived: tDerivedOptionalComputed.cents.add(9) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int + $1 as derived from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
          ]
        `)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 9.42 })
    })

    test('optional-computed-column/custom-int-ceil-keeps-the-column-data-type', async () => {
        // ceil of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext({ derived: 42 })
        const row = await ctx.conn.selectFrom(tDerivedOptionalComputed)
            .select({ derived: tDerivedOptionalComputed.cents.ceil() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(m_int) as derived from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 0.42 })
    })

    test('optional-computed-column/custom-double-add-keeps-the-column-data-type', async () => {
        // 3.5 money plus 1 `Money`: the operand binds scaled (100) and the sum
        // 103.5 reads back as 1.035.
        ctx.mockNext({ derived: 103.5 })
        const row = await ctx.conn.selectFrom(tDerivedOptionalComputed)
            .select({ derived: tDerivedOptionalComputed.money.add(1) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_double + $1 as derived from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 1.035 })
    })

    test('optional-computed-column/custom-double-modulo-keeps-the-column-data-type', async () => {
        // 3.5 money modulo 1 `Money`: the divisor binds scaled (100), the
        // remainder 3.5 reads back as 0.035, and the emitted modulo takes the
        // floating-point form the dialect needs for a fractional operand.
        ctx.mockNext({ derived: 3.5 })
        const row = await ctx.conn.selectFrom(tDerivedOptionalComputed)
            .select({ derived: tDerivedOptionalComputed.money.modulo(1) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select mod((m_double)::numeric, ($1)::numeric) as derived from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 0.035 })
    })

    // -- primary-key ---------------------------------------------------------------

    test('primary-key/custom-int-add-keeps-the-column-data-type', async () => {
        // 42 cents plus 9 `Cents`: the operand binds scaled (900) and the sum 942
        // reads back as 9.42.
        ctx.mockNext(942)
        const v = await ctx.conn.selectFrom(tDerivedPk)
            .selectOneColumn(tDerivedPk.centsPk.add(9))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int + $1 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(9.42)
    })

    test('primary-key/custom-int-ceil-keeps-the-column-data-type', async () => {
        // ceil of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(tDerivedPk)
            .selectOneColumn(tDerivedPk.centsPk.ceil())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(m_int) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.42)
    })

    // -- autogenerated-primary-key ---------------------------------------------------------------

    test('autogenerated-primary-key/custom-int-add-keeps-the-column-data-type', async () => {
        // 42 cents plus 9 `Cents`: the operand binds scaled (900) and the sum 942
        // reads back as 9.42.
        ctx.mockNext(942)
        const v = await ctx.conn.selectFrom(tDerivedAutogenPk)
            .selectOneColumn(tDerivedAutogenPk.centsPk.add(9))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int + $1 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(9.42)
    })

    test('autogenerated-primary-key/custom-int-ceil-keeps-the-column-data-type', async () => {
        // ceil of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(tDerivedAutogenPk)
            .selectOneColumn(tDerivedAutogenPk.centsPk.ceil())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(m_int) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.42)
    })

    // -- virtual-column ---------------------------------------------------------------

    test('virtual-column/custom-int-add-keeps-the-column-data-type', async () => {
        // 42 cents plus 9 `Cents`: the operand binds scaled (900) and the sum 942
        // reads back as 9.42.
        ctx.mockNext(942)
        const v = await ctx.conn.selectFrom(tDerivedVirtual)
            .selectOneColumn(tDerivedVirtual.cents.add(9))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int + $1 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(9.42)
    })

    test('virtual-column/custom-int-ceil-keeps-the-column-data-type', async () => {
        // ceil of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(tDerivedVirtual)
            .selectOneColumn(tDerivedVirtual.cents.ceil())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(m_int) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.42)
    })

    test('virtual-column/custom-double-add-keeps-the-column-data-type', async () => {
        // 3.5 money plus 1 `Money`: the operand binds scaled (100) and the sum
        // 103.5 reads back as 1.035.
        ctx.mockNext(103.5)
        const v = await ctx.conn.selectFrom(tDerivedVirtual)
            .selectOneColumn(tDerivedVirtual.money.add(1))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_double + $1 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1.035)
    })

    test('virtual-column/custom-double-modulo-keeps-the-column-data-type', async () => {
        // 3.5 money modulo 1 `Money`: the divisor binds scaled (100), the
        // remainder 3.5 reads back as 0.035, and the emitted modulo takes the
        // floating-point form the dialect needs for a fractional operand.
        ctx.mockNext(3.5)
        const v = await ctx.conn.selectFrom(tDerivedVirtual)
            .selectOneColumn(tDerivedVirtual.money.modulo(1))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select mod((m_double)::numeric, ($1)::numeric) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.035)
    })

    // -- optional-virtual-column ---------------------------------------------------------------

    test('optional-virtual-column/custom-int-add-keeps-the-column-data-type', async () => {
        // 42 cents plus 9 `Cents`: the operand binds scaled (900) and the sum 942
        // reads back as 9.42.
        ctx.mockNext({ derived: 942 })
        const row = await ctx.conn.selectFrom(tDerivedVirtual)
            .select({ derived: tDerivedVirtual.centsOptional.add(9) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int + $1 as derived from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
          ]
        `)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 9.42 })
    })

    test('optional-virtual-column/custom-int-ceil-keeps-the-column-data-type', async () => {
        // ceil of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext({ derived: 42 })
        const row = await ctx.conn.selectFrom(tDerivedVirtual)
            .select({ derived: tDerivedVirtual.centsOptional.ceil() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(m_int) as derived from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 0.42 })
    })

    test('optional-virtual-column/custom-double-add-keeps-the-column-data-type', async () => {
        // 3.5 money plus 1 `Money`: the operand binds scaled (100) and the sum
        // 103.5 reads back as 1.035.
        ctx.mockNext({ derived: 103.5 })
        const row = await ctx.conn.selectFrom(tDerivedVirtual)
            .select({ derived: tDerivedVirtual.moneyOptional.add(1) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_double + $1 as derived from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 1.035 })
    })

    test('optional-virtual-column/custom-double-modulo-keeps-the-column-data-type', async () => {
        // 3.5 money modulo 1 `Money`: the divisor binds scaled (100), the
        // remainder 3.5 reads back as 0.035, and the emitted modulo takes the
        // floating-point form the dialect needs for a fractional operand.
        ctx.mockNext({ derived: 3.5 })
        const row = await ctx.conn.selectFrom(tDerivedVirtual)
            .select({ derived: tDerivedVirtual.moneyOptional.modulo(1) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select mod((m_double)::numeric, ($1)::numeric) as derived from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 0.035 })
    })

    // -- view-column ---------------------------------------------------------------

    test('view-column/custom-int-add-keeps-the-column-data-type', async () => {
        // 42 cents plus 9 `Cents`: the operand binds scaled (900) and the sum 942
        // reads back as 9.42.
        ctx.mockNext(942)
        const v = await ctx.conn.selectFrom(vDerivedColumn)
            .selectOneColumn(vDerivedColumn.cents.add(9))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int + $1 as result from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(9.42)
    })

    test('view-column/custom-int-ceil-keeps-the-column-data-type', async () => {
        // ceil of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(vDerivedColumn)
            .selectOneColumn(vDerivedColumn.cents.ceil())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(m_int) as result from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.42)
    })

    test('view-column/custom-double-add-keeps-the-column-data-type', async () => {
        // 3.5 money plus 1 `Money`: the operand binds scaled (100) and the sum
        // 103.5 reads back as 1.035.
        ctx.mockNext(103.5)
        const v = await ctx.conn.selectFrom(vDerivedColumn)
            .selectOneColumn(vDerivedColumn.money.add(1))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_double + $1 as result from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1.035)
    })

    test('view-column/custom-double-modulo-keeps-the-column-data-type', async () => {
        // 3.5 money modulo 1 `Money`: the divisor binds scaled (100), the
        // remainder 3.5 reads back as 0.035, and the emitted modulo takes the
        // floating-point form the dialect needs for a fractional operand.
        ctx.mockNext(3.5)
        const v = await ctx.conn.selectFrom(vDerivedColumn)
            .selectOneColumn(vDerivedColumn.money.modulo(1))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select mod((m_double)::numeric, ($1)::numeric) as result from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.035)
    })

    // -- view-optional-column ---------------------------------------------------------------

    test('view-optional-column/custom-int-add-keeps-the-column-data-type', async () => {
        // 42 cents plus 9 `Cents`: the operand binds scaled (900) and the sum 942
        // reads back as 9.42.
        ctx.mockNext({ derived: 942 })
        const row = await ctx.conn.selectFrom(vDerivedColumn)
            .select({ derived: vDerivedColumn.centsOptional.add(9) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int + $1 as derived from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
          ]
        `)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 9.42 })
    })

    test('view-optional-column/custom-int-ceil-keeps-the-column-data-type', async () => {
        // ceil of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext({ derived: 42 })
        const row = await ctx.conn.selectFrom(vDerivedColumn)
            .select({ derived: vDerivedColumn.centsOptional.ceil() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(m_int) as derived from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 0.42 })
    })

    test('view-optional-column/custom-double-add-keeps-the-column-data-type', async () => {
        // 3.5 money plus 1 `Money`: the operand binds scaled (100) and the sum
        // 103.5 reads back as 1.035.
        ctx.mockNext({ derived: 103.5 })
        const row = await ctx.conn.selectFrom(vDerivedColumn)
            .select({ derived: vDerivedColumn.moneyOptional.add(1) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_double + $1 as derived from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 1.035 })
    })

    test('view-optional-column/custom-double-modulo-keeps-the-column-data-type', async () => {
        // 3.5 money modulo 1 `Money`: the divisor binds scaled (100), the
        // remainder 3.5 reads back as 0.035, and the emitted modulo takes the
        // floating-point form the dialect needs for a fractional operand.
        ctx.mockNext({ derived: 3.5 })
        const row = await ctx.conn.selectFrom(vDerivedColumn)
            .select({ derived: vDerivedColumn.moneyOptional.modulo(1) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select mod((m_double)::numeric, ($1)::numeric) as derived from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 0.035 })
    })

    // -- view-virtual-column ---------------------------------------------------------------

    test('view-virtual-column/custom-int-add-keeps-the-column-data-type', async () => {
        // 42 cents plus 9 `Cents`: the operand binds scaled (900) and the sum 942
        // reads back as 9.42.
        ctx.mockNext(942)
        const v = await ctx.conn.selectFrom(vDerivedColumn)
            .selectOneColumn(vDerivedColumn.centsVirtual.add(9))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int + $1 as result from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(9.42)
    })

    test('view-virtual-column/custom-int-ceil-keeps-the-column-data-type', async () => {
        // ceil of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(vDerivedColumn)
            .selectOneColumn(vDerivedColumn.centsVirtual.ceil())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(m_int) as result from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.42)
    })

    test('view-virtual-column/custom-double-add-keeps-the-column-data-type', async () => {
        // 3.5 money plus 1 `Money`: the operand binds scaled (100) and the sum
        // 103.5 reads back as 1.035.
        ctx.mockNext(103.5)
        const v = await ctx.conn.selectFrom(vDerivedColumn)
            .selectOneColumn(vDerivedColumn.moneyVirtual.add(1))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_double + $1 as result from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1.035)
    })

    test('view-virtual-column/custom-double-modulo-keeps-the-column-data-type', async () => {
        // 3.5 money modulo 1 `Money`: the divisor binds scaled (100), the
        // remainder 3.5 reads back as 0.035, and the emitted modulo takes the
        // floating-point form the dialect needs for a fractional operand.
        ctx.mockNext(3.5)
        const v = await ctx.conn.selectFrom(vDerivedColumn)
            .selectOneColumn(vDerivedColumn.moneyVirtual.modulo(1))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select mod((m_double)::numeric, ($1)::numeric) as result from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.035)
    })

    // -- view-optional-virtual-column ---------------------------------------------------------------

    test('view-optional-virtual-column/custom-int-add-keeps-the-column-data-type', async () => {
        // 42 cents plus 9 `Cents`: the operand binds scaled (900) and the sum 942
        // reads back as 9.42.
        ctx.mockNext({ derived: 942 })
        const row = await ctx.conn.selectFrom(vDerivedColumn)
            .select({ derived: vDerivedColumn.centsVirtualOptional.add(9) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int + $1 as derived from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
          ]
        `)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 9.42 })
    })

    test('view-optional-virtual-column/custom-int-ceil-keeps-the-column-data-type', async () => {
        // ceil of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext({ derived: 42 })
        const row = await ctx.conn.selectFrom(vDerivedColumn)
            .select({ derived: vDerivedColumn.centsVirtualOptional.ceil() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(m_int) as derived from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 0.42 })
    })

    test('view-optional-virtual-column/custom-double-add-keeps-the-column-data-type', async () => {
        // 3.5 money plus 1 `Money`: the operand binds scaled (100) and the sum
        // 103.5 reads back as 1.035.
        ctx.mockNext({ derived: 103.5 })
        const row = await ctx.conn.selectFrom(vDerivedColumn)
            .select({ derived: vDerivedColumn.moneyVirtualOptional.add(1) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_double + $1 as derived from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 1.035 })
    })

    test('view-optional-virtual-column/custom-double-modulo-keeps-the-column-data-type', async () => {
        // 3.5 money modulo 1 `Money`: the divisor binds scaled (100), the
        // remainder 3.5 reads back as 0.035, and the emitted modulo takes the
        // floating-point form the dialect needs for a fractional operand.
        ctx.mockNext({ derived: 3.5 })
        const row = await ctx.conn.selectFrom(vDerivedColumn)
            .select({ derived: vDerivedColumn.moneyVirtualOptional.modulo(1) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select mod((m_double)::numeric, ($1)::numeric) as derived from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 0.035 })
    })

    // -- the remaining derived operations, on the `column` factory --------

    test('column/custom-int-subtract-keeps-the-column-data-type', async () => {
        // 42 cents minus 4 `Cents`: the operand binds scaled (400) and the difference
        // -358 reads back as -3.58.
        ctx.mockNext(-358)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.cents.subtract(4))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int - $1 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            400,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(-3.58)
    })

    test('column/custom-int-multiply-keeps-the-column-data-type', async () => {
        // 42 cents times 3 `Cents`: the factor binds scaled (300) and the product
        // 12600 reads back as 126.
        ctx.mockNext(12600)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.cents.multiply(3))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int * $1 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            300,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(126)
    })

    test('column/custom-int-modulo-keeps-the-column-data-type', async () => {
        // 42 cents modulo 5 `Cents`: the divisor binds scaled (500), so the remainder
        // is the whole 42 and reads back as 0.42.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.cents.modulo(5))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int % $1 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            500,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.42)
    })

    test('column/custom-int-min-value-keeps-the-column-data-type', async () => {
        // 42 cents floored at 1 `Cents`: the bound floor is scaled (100), so the
        // greatest of the two is 100 and reads back as 1.
        ctx.mockNext(100)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.cents.minValue(1))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select greatest(m_int, $1) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1)
    })

    test('column/custom-int-max-value-keeps-the-column-data-type', async () => {
        // 42 cents capped at 1 `Cents`: the bound cap is scaled (100), so the least of
        // the two is the column itself and reads back as 0.42.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.cents.maxValue(1))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select least(m_int, $1) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.42)
    })

    test('column/custom-int-floor-keeps-the-column-data-type', async () => {
        // floor of 42 cents: no bound operand, and the answer reads back as 0.42.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.cents.floor())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select floor(m_int) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.42)
    })

    test('column/custom-int-round-keeps-the-column-data-type', async () => {
        // round of 42 cents: no bound operand, and the answer reads back as 0.42.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.cents.round())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select round((m_int)::numeric) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.42)
    })

    test('column/custom-double-subtract-keeps-the-column-data-type', async () => {
        // 3.5 money minus 1 `Money`: the operand binds scaled (100) and the difference
        // -96.5 reads back as -0.965.
        ctx.mockNext(-96.5)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.money.subtract(1))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_double - $1 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(-0.965)
    })

    test('column/custom-double-multiply-keeps-the-column-data-type', async () => {
        // 3.5 money times 2 `Money`: the factor binds scaled (200) and the product 700
        // reads back as 7.
        ctx.mockNext(700)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.money.multiply(2))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_double * $1 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            200,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(7)
    })

    test('column/custom-double-divide-keeps-the-column-data-type', async () => {
        // 3.5 money divided by 0.005 `Money`: the divisor binds scaled (0.5) and the
        // quotient 7 reads back as 0.07.
        ctx.mockNext(7)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.money.divide(0.005))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_double::float / $1 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0.5,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.07)
    })

    test('column/custom-double-sqrt-keeps-the-column-data-type', async () => {
        // square root of 3.5 money: no bound operand, and the answer reads back
        // scaled only while the expression still carries `Money`.
        ctx.mockNext(1.8708286933869707)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.money.sqrt())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sqrt(m_double) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.01870828693386971)
    })

    test('column/custom-double-floor-keeps-the-column-data-type', async () => {
        // floor of 3.5 money: the answer 3 reads back as 0.03.
        ctx.mockNext(3)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.money.floor())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select floor(m_double) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.03)
    })

    test('column/custom-double-min-value-keeps-the-column-data-type', async () => {
        // 3.5 money floored at 1 `Money`: the bound floor is scaled (100), so the
        // greatest of the two is 100 and reads back as 1.
        ctx.mockNext(100)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.money.minValue(1))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select greatest(m_double, $1) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1)
    })

    // -- the temporal and uuid custom data types ---------------------------

    test('column/custom-local-date-time-get-full-year', async () => {
        // The year of the 2024-01-14 12:30 instant. The result is a plain int; what
        // the column's own data type decides is how the dialect spells the date
        // part it extracts.
        ctx.mockNext(2024)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.signOff.getFullYear())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(year from m_datetime) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(2024)
    })

    test('column/custom-local-date-get-month', async () => {
        // The month of the 2024-03-04 date (0-based, so 2). Same rule as the
        // date-time getter above, on the date-only data type.
        ctx.mockNext(2)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.releaseDay.getMonth())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(month from m_date) - 1 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(2)
    })

    test('column/custom-local-time-get-hours', async () => {
        // The hour of the 09:15:00 time. Same rule as the two getters above, on
        // the time-only data type.
        ctx.mockNext(9)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.cutoffClock.getHours())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(hour from m_time) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(9)
    })

    test('column/custom-uuid-as-string', async () => {
        // The seeded uuid rendered as text and then interpolated into a fragment.
        // `asString()` marks its result as a uuid-backed string from the receiver's
        // own data type, and a dialect that stores uuids in a non-text form reads
        // that mark to know it still has to render the value when it lands inside
        // arbitrary SQL.
        ctx.mockNext('0a8f9c1e-1111-4222-8333-444455556666')
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(ctx.conn.fragmentWithType('string', 'required').sql`${tDerivedColumn.signingKey.asString()}`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_uuid::text as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, string>>()
        expect(v).toBe('0a8f9c1e-1111-4222-8333-444455556666')
    })

    // -- the `Values` column factories ------------------------------------

    test('values-column/custom-int-add-keeps-the-column-data-type', async () => {
        // The tuple carries cents 5, bound scaled as 500; plus 9 `Cents` bound as
        // 900. The sum 1400 reads back as 14.
        ctx.mockNext(1400)
        const billing = Values.create(VDerivedBilling, 'derivedBilling', [
            { cents: 5, money: 1 },
        ])
        const v = await ctx.conn.selectFrom(billing)
            .selectOneColumn(billing.cents.add(9))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with derivedBilling(cents, money) as (values ($1, $2)) select cents + $3 as result from derivedBilling"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            500,
            100,
            900,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(14)
    })

    test('values-column/custom-double-add-keeps-the-column-data-type', async () => {
        // The tuple carries money 1, bound scaled as 100; plus 1 `Money` bound as
        // 100. The sum 200 reads back as 2.
        ctx.mockNext(200)
        const billing = Values.create(VDerivedBilling, 'derivedBilling', [
            { cents: 5, money: 1 },
        ])
        const v = await ctx.conn.selectFrom(billing)
            .selectOneColumn(billing.money.add(1))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with derivedBilling(cents, money) as (values ($1, $2)) select money + $3 as result from derivedBilling"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            500,
            100,
            100,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(2)
    })

    test('values-optional-column/custom-int-add-keeps-the-column-data-type', async () => {
        // The optional sibling: the same tuple through `optionalColumn`, so the
        // projected leaf is optional while the derivation is unchanged.
        ctx.mockNext({ derived: 1400 })
        const billing = Values.create(VDerivedBillingOptional, 'derivedBillingOpt', [
            { cents: 5, money: 1 },
        ])
        const row = await ctx.conn.selectFrom(billing)
            .select({ derived: billing.cents.add(9) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with derivedBillingOpt(cents, money) as (values ($1, $2)) select cents + $3 as derived from derivedBillingOpt"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            500,
            100,
            900,
          ]
        `)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 14 })
    })

    test('values-optional-column/custom-double-add-keeps-the-column-data-type', async () => {
        // The optional sibling of the customDouble case above.
        ctx.mockNext({ derived: 200 })
        const billing = Values.create(VDerivedBillingOptional, 'derivedBillingOpt', [
            { cents: 5, money: 1 },
        ])
        const row = await ctx.conn.selectFrom(billing)
            .select({ derived: billing.money.add(1) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with derivedBillingOpt(cents, money) as (values ($1, $2)) select money + $3 as derived from derivedBillingOpt"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            500,
            100,
            100,
          ]
        `)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 2 })
    })
})
