// Operations that DERIVE a new data type from the receiver's own, applied to
// COLUMNS declared with a data type of the user. A column that is only PROJECTED is
// blind to its data type being wrong: everything that marshals a value reads the
// type NAME, which a projection preserves. Only an operation that derives a new
// type from the column's own data type can tell.
//
// The instrument is the per-column `scaledByTypeName` adapter declared with the
// fixtures: it scales a number by 100 only when the type name it is handed is
// `Cents` or `Money`. A derived expression that KEEPS the column's custom data
// type therefore binds an operand of that type scaled (a factor or a divisor is
// a number without a unit, bound as it is) and reads its answer back scaled;
// one that has fallen back to a plain `int` / `double` does neither. The mock
// queues the RAW value the database would answer and the assertion is on the value
// AFTER the adapter, so the single unconditional `expect(...)` covers the mock
// round-trip and the real-DB result at once.
//
// One fixture per column factory reads the same row, so a factory that loses the
// data type of the user shows up on its own rather than hiding behind its siblings.
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
import { IntegersType, RealsType } from '../../../../../src/exports/v2/index.js'

// The data types of the values of the user, each one a class of the family of its values
abstract class CentsType extends IntegersType<number, 'Cents'> { static override readonly type = 'Cents' }
abstract class MoneyType extends RealsType<number, 'Money'> { static override readonly type = 'Money' }

// The same conditional adapter the shared fixtures carry, declared here for the
// `Values` views below (a `Values` subclass is declared where it is used).
const scaledByTypeName: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        const v = next.transformValueFromDB(value, context)
        if ((context.originalType.type === 'Cents' || context.originalType.type === 'Money') && typeof v === 'number') {
            return v / 100
        }
        return v
    },
    transformValueToDB(value, context, next) {
        if ((context.originalType.type === 'Cents' || context.originalType.type === 'Money') && typeof value === 'number') {
            return next.transformValueToDB(value * 100, context)
        }
        return next.transformValueToDB(value, context)
    },
}

// `column(type, typeName, adapter)` / `optionalColumn(type, typeName, adapter)` on
// a constant VALUES view. The tuple carries cents 5 (bound scaled as 500) and
// money 1 (bound scaled as 100).
class VDerivedBilling extends Values<DBConnection, 'derivedBilling'> {
    cents = this.column(CentsType, scaledByTypeName)
    money = this.column(MoneyType, scaledByTypeName)
}
class VDerivedBillingOptional extends Values<DBConnection, 'derivedBillingOpt'> {
    cents = this.optionalColumn(CentsType, scaledByTypeName)
    money = this.optionalColumn(MoneyType, scaledByTypeName)
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // -- column ---------------------------------------------------------------

    test('column/own-int-add-keeps-the-column-data-type', async () => {
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

    test('column/own-int-abs-keeps-the-column-data-type', async () => {
        // abs of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.cents.abs())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select abs(m_int) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.42)
    })

    test('column/own-double-add-keeps-the-column-data-type', async () => {
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

    test('column/own-double-modulo-keeps-the-column-data-type', async () => {
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

    test('optional-column/own-int-add-keeps-the-column-data-type', async () => {
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

    test('optional-column/own-int-abs-keeps-the-column-data-type', async () => {
        // abs of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext({ derived: 42 })
        const row = await ctx.conn.selectFrom(tDerivedOptional)
            .select({ derived: tDerivedOptional.cents.abs() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select abs(m_int) as derived from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 0.42 })
    })

    test('optional-column/own-double-add-keeps-the-column-data-type', async () => {
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

    test('optional-column/own-double-modulo-keeps-the-column-data-type', async () => {
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

    test('column-with-default-value/own-int-add-keeps-the-column-data-type', async () => {
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

    test('column-with-default-value/own-int-abs-keeps-the-column-data-type', async () => {
        // abs of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(tDerivedDefault)
            .selectOneColumn(tDerivedDefault.cents.abs())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select abs(m_int) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.42)
    })

    test('column-with-default-value/own-double-add-keeps-the-column-data-type', async () => {
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

    test('column-with-default-value/own-double-modulo-keeps-the-column-data-type', async () => {
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

    test('optional-column-with-default-value/own-int-add-keeps-the-column-data-type', async () => {
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

    test('optional-column-with-default-value/own-int-abs-keeps-the-column-data-type', async () => {
        // abs of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext({ derived: 42 })
        const row = await ctx.conn.selectFrom(tDerivedOptionalDefault)
            .select({ derived: tDerivedOptionalDefault.cents.abs() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select abs(m_int) as derived from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 0.42 })
    })

    test('optional-column-with-default-value/own-double-add-keeps-the-column-data-type', async () => {
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

    test('optional-column-with-default-value/own-double-modulo-keeps-the-column-data-type', async () => {
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

    test('computed-column/own-int-add-keeps-the-column-data-type', async () => {
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

    test('computed-column/own-int-abs-keeps-the-column-data-type', async () => {
        // abs of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(tDerivedComputed)
            .selectOneColumn(tDerivedComputed.cents.abs())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select abs(m_int) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.42)
    })

    test('computed-column/own-double-add-keeps-the-column-data-type', async () => {
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

    test('computed-column/own-double-modulo-keeps-the-column-data-type', async () => {
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

    test('optional-computed-column/own-int-add-keeps-the-column-data-type', async () => {
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

    test('optional-computed-column/own-int-abs-keeps-the-column-data-type', async () => {
        // abs of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext({ derived: 42 })
        const row = await ctx.conn.selectFrom(tDerivedOptionalComputed)
            .select({ derived: tDerivedOptionalComputed.cents.abs() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select abs(m_int) as derived from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 0.42 })
    })

    test('optional-computed-column/own-double-add-keeps-the-column-data-type', async () => {
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

    test('optional-computed-column/own-double-modulo-keeps-the-column-data-type', async () => {
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

    test('primary-key/own-int-add-keeps-the-column-data-type', async () => {
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

    test('primary-key/own-int-abs-keeps-the-column-data-type', async () => {
        // abs of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(tDerivedPk)
            .selectOneColumn(tDerivedPk.centsPk.abs())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select abs(m_int) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.42)
    })

    // -- autogenerated-primary-key ---------------------------------------------------------------

    test('autogenerated-primary-key/own-int-add-keeps-the-column-data-type', async () => {
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

    test('autogenerated-primary-key/own-int-abs-keeps-the-column-data-type', async () => {
        // abs of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(tDerivedAutogenPk)
            .selectOneColumn(tDerivedAutogenPk.centsPk.abs())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select abs(m_int) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.42)
    })

    // -- virtual-column ---------------------------------------------------------------

    test('virtual-column/own-int-add-keeps-the-column-data-type', async () => {
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

    test('virtual-column/own-int-abs-keeps-the-column-data-type', async () => {
        // abs of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(tDerivedVirtual)
            .selectOneColumn(tDerivedVirtual.cents.abs())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select abs(m_int) as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.42)
    })

    test('virtual-column/own-double-add-keeps-the-column-data-type', async () => {
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

    test('virtual-column/own-double-modulo-keeps-the-column-data-type', async () => {
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

    test('optional-virtual-column/own-int-add-keeps-the-column-data-type', async () => {
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

    test('optional-virtual-column/own-int-abs-keeps-the-column-data-type', async () => {
        // abs of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext({ derived: 42 })
        const row = await ctx.conn.selectFrom(tDerivedVirtual)
            .select({ derived: tDerivedVirtual.centsOptional.abs() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select abs(m_int) as derived from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 0.42 })
    })

    test('optional-virtual-column/own-double-add-keeps-the-column-data-type', async () => {
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

    test('optional-virtual-column/own-double-modulo-keeps-the-column-data-type', async () => {
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

    test('view-column/own-int-add-keeps-the-column-data-type', async () => {
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

    test('view-column/own-int-abs-keeps-the-column-data-type', async () => {
        // abs of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(vDerivedColumn)
            .selectOneColumn(vDerivedColumn.cents.abs())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select abs(m_int) as result from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.42)
    })

    test('view-column/own-double-add-keeps-the-column-data-type', async () => {
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

    test('view-column/own-double-modulo-keeps-the-column-data-type', async () => {
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

    test('view-optional-column/own-int-add-keeps-the-column-data-type', async () => {
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

    test('view-optional-column/own-int-abs-keeps-the-column-data-type', async () => {
        // abs of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext({ derived: 42 })
        const row = await ctx.conn.selectFrom(vDerivedColumn)
            .select({ derived: vDerivedColumn.centsOptional.abs() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select abs(m_int) as derived from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 0.42 })
    })

    test('view-optional-column/own-double-add-keeps-the-column-data-type', async () => {
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

    test('view-optional-column/own-double-modulo-keeps-the-column-data-type', async () => {
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

    test('view-virtual-column/own-int-add-keeps-the-column-data-type', async () => {
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

    test('view-virtual-column/own-int-abs-keeps-the-column-data-type', async () => {
        // abs of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext(42)
        const v = await ctx.conn.selectFrom(vDerivedColumn)
            .selectOneColumn(vDerivedColumn.centsVirtual.abs())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select abs(m_int) as result from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.42)
    })

    test('view-virtual-column/own-double-add-keeps-the-column-data-type', async () => {
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

    test('view-virtual-column/own-double-modulo-keeps-the-column-data-type', async () => {
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

    test('view-optional-virtual-column/own-int-add-keeps-the-column-data-type', async () => {
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

    test('view-optional-virtual-column/own-int-abs-keeps-the-column-data-type', async () => {
        // abs of 42 cents: no bound operand, and the answer 42 reads back as 0.42
        // only while the expression still carries `Cents`.
        ctx.mockNext({ derived: 42 })
        const row = await ctx.conn.selectFrom(vDerivedColumn)
            .select({ derived: vDerivedColumn.centsVirtualOptional.abs() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select abs(m_int) as derived from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { derived?: number }>>()
        expect(row).toEqual({ derived: 0.42 })
    })

    test('view-optional-virtual-column/own-double-add-keeps-the-column-data-type', async () => {
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

    test('view-optional-virtual-column/own-double-modulo-keeps-the-column-data-type', async () => {
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

    test('column/own-int-subtract-keeps-the-column-data-type', async () => {
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

    test('column/own-int-multiply-keeps-the-column-data-type', async () => {
        // m_int 42 (0.42 `Cents`) times 3: the factor is a number without a unit, so
        // it is bound as it is (3), and the product 126 reads back as 1.26.
        ctx.mockNext(126)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.cents.multiply(3))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int * $1 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1.26)
    })

    test('column/own-int-modulo-keeps-the-column-data-type', async () => {
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

    test('column/own-int-min-value-keeps-the-column-data-type', async () => {
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

    test('column/own-int-max-value-keeps-the-column-data-type', async () => {
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



    test('column/own-double-subtract-keeps-the-column-data-type', async () => {
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

    test('column/own-double-multiply-keeps-the-column-data-type', async () => {
        // m_double 3.5 (0.035 `Money`) times 2: the factor is a number without a
        // unit, so it is bound as it is (2), and the product 7 reads back as 0.07.
        ctx.mockNext(7)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.money.multiply(2))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_double * $1 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.07)
    })

    test('column/own-double-divide-keeps-the-column-data-type', async () => {
        // m_double 3.5 (0.035 `Money`) divided by 0.005: the divisor is a number
        // without a unit, so it is bound as it is (0.005), and the quotient 700 reads
        // back as 7.
        ctx.mockNext(700)
        const v = await ctx.conn.selectFrom(tDerivedColumn)
            .selectOneColumn(tDerivedColumn.money.divide(0.005))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_double / $1 as result from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0.005,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(7)
    })

    test('column/own-double-floor-keeps-the-column-data-type', async () => {
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

    test('column/own-double-min-value-keeps-the-column-data-type', async () => {
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

    // -- the temporal and uuid data types of the user ---------------------------

    test('column/own-local-date-time-get-full-year', async () => {
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

    test('column/own-local-date-get-month', async () => {
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

    test('column/own-local-time-get-hours', async () => {
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

    test('column/own-uuid-as-string', async () => {
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

    test('values-column/own-int-add-keeps-the-column-data-type', async () => {
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

    test('values-column/own-double-add-keeps-the-column-data-type', async () => {
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

    test('values-optional-column/own-int-add-keeps-the-column-data-type', async () => {
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

    test('values-optional-column/own-double-add-keeps-the-column-data-type', async () => {
        // The optional sibling of the RealsType case above.
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
