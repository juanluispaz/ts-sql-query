// Documentation snippets for the page The context of a conversion (docs/advanced/data-types/conversion-context.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Table } from '../../../../../src/Table.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { getQueryContext } from '../../../../../src/QueryContext.js'
import { ComparableType } from '../../../../../src/exports/v2/index.js'
import type { DefaultTypeAdapter, SqlDataType, TypeAdapter, TypeAdapterContext, TypeAdapterPlaceholderContext, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext } from '../../../../../src/exports/v2/index.js'

// What each step of the conversion of a value sees: its original and its requested type
const seen: string[] = []
function typesOf(context: TypeAdapterContext): string {
    return context.originalType.type + '/' + context.requestedType.type
}

// A value of a class of the user, kept in a decimal column with 2 decimals as the scaled bigint of its cents
class Money {
    constructor(readonly cents: bigint) {}
}

const MoneyDecimal = 'ScaledBigInt<2>'

abstract class MoneyType extends ComparableType<Money, 'Money'> {
    static override readonly type = 'Money'
    // The column is a decimal(10, 2)
    static override readonly sqlDataType: SqlDataType = { family: 'exact numeric', precision: 10, scale: 2 }

    static override transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        seen.push('class sends ' + typesOf(context))
        context.setRequestedType(MoneyDecimal)
        return next.transformValueToDB(value instanceof Money ? value.cents : value, context)
    }
    static override transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        seen.push('class reads ' + typesOf(context))
        context.setRequestedType(MoneyDecimal)
        const result = next.transformValueFromDB(value, context)
        return typeof result === 'bigint' ? new Money(result) : result
    }
    static override transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter): string {
        seen.push('placeholder ' + typesOf(context) + ' index ' + String(context.index) + ' value ' + String(context.valueSentToDB))
        return next.transformPlaceholder(placeholder, context)
    }
}

// The type adapter of a column of MoneyType
const columnAdapter: TypeAdapter = {
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        seen.push('column sends ' + typesOf(context))
        return next.transformValueToDB(value, context)
    },
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        seen.push('column reads before next ' + typesOf(context))
        const result = next.transformValueFromDB(value, context)
        seen.push('column reads after next ' + typesOf(context))
        return result
    } }

// Sends the value with its type, written as a cast where the query runner writes one
const withItsType: TypeAdapter = {
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        context.forceTypeCast = true
        return next.transformValueToDB(value, context)
    },
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        return next.transformValueFromDB(value, context)
    } }

// exact_amount.price is a decimal(10, 2): row 1 has the price 1.50 and row 5 1234.56
const tAmountMoney = new class TAmountMoney extends Table<DBConnection, 'TAmountMoney'> {
    id = this.primaryKey('id', 'int')
    price = this.column('price', MoneyType, columnAdapter)
    constructor() {
        super('exact_amount')
    }
}()

const tIssue = new class TIssue extends Table<DBConnection, 'TIssue'> {
    id = this.primaryKey('id', 'int')
    priority = this.column('priority', 'int', withItsType)
    constructor() {
        super('issue')
    }
}()

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset(); seen.length = 0 })

    test('docs:conversion-context/the-steps-and-what-each-one-sees', async () => {
        ctx.mockNext([{ id: 1, price: '1.50' }, { id: 5, price: '1234.56' }])
        const rows = await ctx.conn.selectFrom(tAmountMoney)
            .where(tAmountMoney.price.greaterOrEqual(new Money(150n)))
            .select({ id: tAmountMoney.id, price: tAmountMoney.price })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, convert(nvarchar(41), price) as price from exact_amount where price >= cast(@0 as decimal(3, 2)) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.50",
          ]
        `)
        assertType<Exact<typeof rows, { id: number; price: Money }[]>>()
        expect(rows).toEqual([{ id: 1, price: new Money(150n) }, { id: 5, price: new Money(123456n) }])
        expect(seen).toMatchInlineSnapshot(`
          [
            "column sends Money/Money",
            "class sends Money/Money",
            "placeholder Money/ScaledBigInt<2> index 0 value 1.50",
            "column reads before next Money/Money",
            "class reads Money/Money",
            "column reads after next Money/ScaledBigInt<2>",
            "column reads before next Money/Money",
            "class reads Money/Money",
            "column reads after next Money/ScaledBigInt<2>",
          ]
        `)
        // The query runner sends the parameter as the type the class requested
        expect(getQueryContext(ctx.lastSql, ctx.lastParams).getParam(0)?.requestedType?.type).toBe(MoneyDecimal)
    })

    test('docs:conversion-context/asking-the-database-for-the-type-of-a-parameter', async () => {
        ctx.mockNext([{ id: 2 }])
        const urgentIssues = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.equals(1))
            .select({ id: tIssue.id })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof urgentIssues, { id: number }[]>>()
        expect(urgentIssues).toEqual([{ id: 2 }])
    })
})
