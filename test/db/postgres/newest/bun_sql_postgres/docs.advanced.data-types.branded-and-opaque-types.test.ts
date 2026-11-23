// Documentation snippets for the Branded and opaque types page (docs/advanced/data-types/branded-and-opaque-types.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Table } from '../../../../../src/Table.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { ComparableType, IntegersType, IntType, scaledBigInt } from '../../../../../src/exports/v2/index.js'
import type { CombinedOptionality, DataTypeOf, DefaultTypeAdapter, OperandOf, OptionalityOf, ScaledBigInt, SourceOf, SqlDataType, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext, ValueSource } from '../../../../../src/exports/v2/index.js'

// A number of units in stock, branded with a symbol of its own, also multiplied by a plain number or an int
declare const unitsBrand: unique symbol
type Units = number & { readonly [unitsBrand]: true }

function units(value: number): Units {
    if (!Number.isInteger(value)) {
        throw new Error('A number of units is an integer: ' + value)
    }
    // tests-audit-disable-next-line type-cast -- a brand is given by a cast, in the one function that checks the value
    return value as Units
}

abstract class UnitsType extends IntegersType<Units, 'Units'> {
    static override readonly type = 'Units'
    override multiply(value: Units | number): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    override multiply<VALUE extends OperandOf<this> | OperandOf<IntType>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    // tests-audit-disable-next-line any-type -- the implementation signature of the overloads, which TypeScript requires to accept all of them
    override multiply(value: any): any {
        return super.multiply(value)
    }
}

const tIssueUnits = new class TIssueUnits extends Table<DBConnection, 'TIssueUnits'> {
    id = this.primaryKey('id', 'int')
    stock = this.column('priority', UnitsType)
    packs = this.column('number', 'int')
    constructor() {
        super('issue')
    }
}()

// A value of a class of the user, kept in a decimal column of 2 decimals
class Money {
    constructor(readonly amount: ScaledBigInt<2>) {}
}

abstract class MoneyType extends ComparableType<Money, 'Money'> {
    static override readonly type = 'Money'
    static override readonly sqlDataType: SqlDataType = { family: 'exact numeric', precision: 10, scale: 2 }

    static override transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        context.setRequestedType('ScaledBigInt<2>')
        return next.transformValueToDB(value instanceof Money ? value.amount : value, context)
    }
    static override transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        context.setRequestedType('ScaledBigInt<2>')
        const result = next.transformValueFromDB(value, context)
        return typeof result === 'bigint' ? new Money(scaledBigInt(result, 2)) : result
    }
}

const tAmountMoney = new class TAmountMoney extends Table<DBConnection, 'TAmountMoney'> {
    id = this.primaryKey('id', 'int')
    total = this.column('price', MoneyType)
    constructor() {
        super('exact_amount')
    }
}()

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:branded-and-opaque-types/a-brand-with-a-symbol', async () => {
        const expected = [{ id: 2, stock: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueUnits)
            .where(tIssueUnits.stock.lessThan(units(2)))
            .select({ id: tIssueUnits.id, stock: tIssueUnits.stock })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as stock from issue where priority < $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, { id: number; stock: Units }[]>>()
        expect(rows).toEqual(expected)
        expect(() => units(1.5)).toThrow('A number of units is an integer: 1.5')
    })

    test('docs:branded-and-opaque-types/a-value-of-a-class-of-yours', async () => {
        ctx.mockNext([{ id: 1, total: '1.50' }, { id: 5, total: '1234.56' }])
        const rows = await ctx.conn.selectFrom(tAmountMoney)
            .where(tAmountMoney.total.greaterOrEqual(new Money(scaledBigInt(150n, 2))))
            .select({ id: tAmountMoney.id, total: tAmountMoney.total })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, price as total from exact_amount where price >= $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.50",
          ]
        `)
        assertType<Exact<typeof rows, { id: number; total: Money }[]>>()
        expect(rows).toEqual([{ id: 1, total: new Money(scaledBigInt(150n, 2)) }, { id: 5, total: new Money(scaledBigInt(123456n, 2)) }])
        expect(rows[0]?.total).toBeInstanceOf(Money)
    })

    test('docs:branded-and-opaque-types/combining-your-type-with-other-values', async () => {
        ctx.mockNext([{ id: 1, inPacksOf3: 6, inPacks: 2 }, { id: 2, inPacksOf3: 3, inPacks: 2 }])
        const connection = ctx.conn
        // doc-start
        const rows = await connection.selectFrom(tIssueUnits)
            .where(tIssueUnits.id.lessOrEqual(2))
            .select({
                id: tIssueUnits.id,
                inPacksOf3: tIssueUnits.stock.multiply(3),
                inPacks: tIssueUnits.stock.multiply(tIssueUnits.packs) })
            .orderBy('id')
            .executeSelectMany()
        // doc-end
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority * $1 as "inPacksOf3", priority * number as "inPacks" from issue where id <= $2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            2,
          ]
        `)
        assertType<Exact<typeof rows, { id: number; inPacksOf3: Units; inPacks: Units }[]>>()
        expect(rows).toEqual([{ id: 1, inPacksOf3: 6, inPacks: 2 }, { id: 2, inPacksOf3: 3, inPacks: 2 }])
    })
})
