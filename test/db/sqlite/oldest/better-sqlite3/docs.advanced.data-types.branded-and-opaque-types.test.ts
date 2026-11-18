// Documentation snippets for the Branded and opaque types page (docs/advanced/data-types/branded-and-opaque-types.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Table } from '../../../../../src/Table.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { ComparableType, IntegersType, IntType } from '../../../../../src/exports/v2/index.js'
import type { CombinedOptionality, DataTypeOf, DefaultTypeAdapter, OperandOf, OptionalityOf, SourceOf, SqlDataType, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext, ValueSource } from '../../../../../src/exports/v2/index.js'

// An amount of cents, branded with a symbol of its own, also multiplied by a plain number or an int
declare const centsBrand: unique symbol
type Cents = number & { readonly [centsBrand]: true }

function cents(value: number): Cents {
    if (!Number.isInteger(value)) {
        throw new Error('An amount of cents is an integer: ' + value)
    }
    // tests-audit-disable-next-line type-cast -- a brand is given by a cast, in the one function that checks the value
    return value as Cents
}

abstract class CentsType extends IntegersType<Cents, 'Cents'> {
    static override readonly type = 'Cents'
    override multiply(value: Cents | number): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    override multiply<VALUE extends OperandOf<this> | OperandOf<IntType>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    // tests-audit-disable-next-line any-type -- the implementation signature of the overloads, which TypeScript requires to accept all of them
    override multiply(value: any): any {
        return super.multiply(value)
    }
}

const tIssueCents = new class TIssueCents extends Table<DBConnection, 'TIssueCents'> {
    id = this.primaryKey('id', 'int')
    priority = this.column('priority', CentsType)
    number = this.column('number', 'int')
    constructor() {
        super('issue')
    }
}()

// A value of a class of the user, kept in an integer column
class Money {
    constructor(readonly cents: bigint) {}
}

abstract class MoneyType extends ComparableType<Money, 'Money'> {
    static override readonly type = 'Money'
    static override readonly sqlDataType: SqlDataType = { family: 'exact numeric', scale: 0, bytes: 8 }

    static override transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        context.setRequestedType('bigint')
        return next.transformValueToDB(value instanceof Money ? value.cents : value, context)
    }
    static override transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        context.setRequestedType('bigint')
        const result = next.transformValueFromDB(value, context)
        return typeof result === 'bigint' ? new Money(result) : result
    }
}

const tIssueMoney = new class TIssueMoney extends Table<DBConnection, 'TIssueMoney'> {
    id = this.primaryKey('id', 'int')
    budget = this.column('priority', MoneyType)
    constructor() {
        super('issue')
    }
}()

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:branded-and-opaque-types/a-brand-with-a-symbol', async () => {
        const expected = [{ id: 2, priority: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueCents)
            .where(tIssueCents.priority.lessThan(cents(2)))
            .select({ id: tIssueCents.id, priority: tIssueCents.priority })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as priority from issue where priority < ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, { id: number; priority: Cents }[]>>()
        expect(rows).toEqual(expected)
        expect(() => cents(1.5)).toThrow('An amount of cents is an integer: 1.5')
    })

    test('docs:branded-and-opaque-types/a-value-of-a-class-of-yours', async () => {
        ctx.mockNext([{ id: 1, budget: 2 }, { id: 4, budget: 2 }, { id: 3, budget: 3 }])
        const rows = await ctx.conn.selectFrom(tIssueMoney)
            .where(tIssueMoney.budget.greaterOrEqual(new Money(2n)))
            .select({ id: tIssueMoney.id, budget: tIssueMoney.budget })
            .orderBy('budget')
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as budget from issue where priority >= ?1 order by budget, id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2n,
          ]
        `)
        assertType<Exact<typeof rows, { id: number; budget: Money }[]>>()
        expect(rows).toEqual([{ id: 1, budget: new Money(2n) }, { id: 4, budget: new Money(2n) }, { id: 3, budget: new Money(3n) }])
        expect(rows[0]?.budget).toBeInstanceOf(Money)
    })

    test('docs:branded-and-opaque-types/combining-your-type-with-other-values', async () => {
        ctx.mockNext([{ id: 1, tripled: 6, byNumber: 2 }, { id: 2, tripled: 3, byNumber: 2 }])
        const connection = ctx.conn
        // doc-start
        const rows = await connection.selectFrom(tIssueCents)
            .where(tIssueCents.id.lessOrEqual(2))
            .select({
                id: tIssueCents.id,
                tripled: tIssueCents.priority.multiply(3),
                byNumber: tIssueCents.priority.multiply(tIssueCents.number),
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority * ?1 as tripled, priority * number as byNumber from issue where id <= ?2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            2,
          ]
        `)
        assertType<Exact<typeof rows, { id: number; tripled: Cents; byNumber: Cents }[]>>()
        expect(rows).toEqual([{ id: 1, tripled: 6, byNumber: 2 }, { id: 2, tripled: 3, byNumber: 2 }])
    })
})
