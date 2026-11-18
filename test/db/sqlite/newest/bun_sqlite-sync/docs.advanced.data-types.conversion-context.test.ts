// Documentation snippets for the page The context of a conversion (docs/advanced/data-types/conversion-context.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Table } from '../../../../../src/Table.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'
import { getQueryContext } from '../../../../../src/QueryContext.js'
import { BigintType, ComparableType } from '../../../../../src/exports/v2/index.js'
import type { DefaultTypeAdapter, TypeAdapter, TypeAdapterContext, TypeAdapterPlaceholderContext, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext } from '../../../../../src/exports/v2/index.js'

// What each step of the conversion of a value sees: its original and its requested type
const seen: string[] = []
function typesOf(context: TypeAdapterContext): string {
    return context.originalType.type + '/' + context.requestedType.type
}

// A value of a class of the user, kept in an integer column as its number of cents
class Money {
    constructor(readonly cents: bigint) {}
}

abstract class MoneyType extends ComparableType<Money, 'Money'> {
    static override readonly type = 'Money'

    static override transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        seen.push('class sends ' + typesOf(context))
        context.setRequestedType('bigint')
        return next.transformValueToDB(value instanceof Money ? value.cents : value, context)
    }
    static override transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        seen.push('class reads ' + typesOf(context))
        context.setRequestedType('bigint')
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
    },
}

// Sends the value with its type, written as a cast where the query runner writes one
const withItsType: TypeAdapter = {
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        context.forceTypeCast = true
        return next.transformValueToDB(value, context)
    },
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        return next.transformValueFromDB(value, context)
    },
}

const tIssueMoney = new class TIssueMoney extends Table<DBConnection, 'TIssueMoney'> {
    id = this.primaryKey('id', 'int')
    budget = this.column('priority', MoneyType, columnAdapter)
    constructor() {
        super('issue')
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
        ctx.mockNext([{ id: 3, budget: 3 }])
        const rows = sync(ctx.conn.selectFrom(tIssueMoney)
            .where(tIssueMoney.budget.greaterOrEqual(new Money(3n)))
            .select({ id: tIssueMoney.id, budget: tIssueMoney.budget })
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as budget from issue where priority >= ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3n,
          ]
        `)
        assertType<Exact<typeof rows, { id: number; budget: Money }[]>>()
        expect(rows).toEqual([{ id: 3, budget: new Money(3n) }])
        expect(seen).toMatchInlineSnapshot(`
          [
            "column sends Money/Money",
            "class sends Money/Money",
            "placeholder Money/bigint index 0 value 3",
            "column reads before next Money/Money",
            "class reads Money/Money",
            "column reads after next Money/bigint",
          ]
        `)
        // The query runner sends the parameter as the type the class requested
        expect(getQueryContext(ctx.lastSql, ctx.lastParams).getParam(0)?.requestedType).toBe(BigintType)
    })

    test('docs:conversion-context/asking-the-database-for-the-type-of-a-parameter', async () => {
        ctx.mockNext([{ id: 2 }])
        const urgentIssues = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.equals(1))
            .select({ id: tIssue.id })
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof urgentIssues, { id: number }[]>>()
        expect(urgentIssues).toEqual([{ id: 2 }])
    })
})
