// Documentation snippets for the Data types page (docs/configuration/data-types.md), sections Types of the user,
// Combining your type with other values, Operations of your own in a dynamic filter and Exact decimals.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Table } from '../../../../../src/Table.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { DecimalsType, EqualableType, IntegersType, LocalDatesType, exposeFilterOperations, filterOperation, IntType } from '../../../../../src/exports/v2/index.js'
import type { DynamicCondition, CombinedOptionality, DataTypeOf, OperandOf, OptionalityOf, SourceOf, ValueSource } from '../../../../../src/exports/v2/index.js'

// The data types of the values of the user, each one a class of the family of its values
abstract class AmountType extends DecimalsType<string, 'Amount'> { static override readonly type = 'Amount' }
abstract class UnitsType extends IntegersType<Units, 'Units'> { static override readonly type = 'Units' }
abstract class TagType extends EqualableType<string, 'Tag'> { static override readonly type = 'Tag' }

type Units = number & { readonly __brand: 'Units' }

const tExactAmount = new class TExactAmount extends Table<DBConnection, 'TExactAmount'> {
    id = this.primaryKey('id', 'int')
    amount = this.optionalColumn('amount', AmountType)
    price = this.optionalColumn('price', AmountType)
    constructor() {
        super('exact_amount')
    }
}()

// A date of the user with operations of its own for a dynamic filter
abstract class WorkDayType extends LocalDatesType<Date, 'WorkDay'> {
    static override readonly type = 'WorkDay'
    static override readonly [filterOperation] = exposeFilterOperations(this, LocalDatesType, ['isLeapDay', 'inYear'])
    declare [filterOperation]: (typeof WorkDayType)[typeof filterOperation]

    // On 29 February
    isLeapDay() {
        return this.getMonth().equals(1).and(this.getDate().equals(29))
    }
    inYear(year: number) {
        return this.getFullYear().equals(year)
    }
}

const tWorklogDay = new class TWorklogDay extends Table<DBConnection, 'TWorklogDay'> {
    id = this.primaryKey('id', 'int')
    workDate = this.column('work_date', WorkDayType)
    constructor() {
        super('issue_worklog')
    }
}()

// A number of the user that is also multiplied by a plain number or an int
type Cents = number & { readonly __brand: 'Cents' }
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

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:data-types/own-type-converted-as-its-category', async () => {
        // The SQL gives both values as text: the IntegersType is converted as an int, the custom arrives as it comes
        ctx.mockNext({ units: '42', tag: '42' })
        const row = await ctx.conn.selectFromNoTable()
            .select({
                units: ctx.conn.fragmentWithType(UnitsType, 'required').sql`'42'`,
                tag: ctx.conn.fragmentWithType(TagType, 'required').sql`'42'`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select '42' as units, '42' as tag"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { units: Units; tag: string }>>()
        expect(row).toEqual({ units: 42, tag: '42' })
    })

    test('docs:data-types/exact-decimals', async () => {
        ctx.mockNext([
            { id: 1, amount: '12345678901234567890.1234567891', next: '12345678901234567890.1234567892' },
            { id: 5, amount: '98765432109876543210.9876543210', next: '98765432109876543210.9876543211' },
        ])
        const connection = ctx.conn
        // doc-start
        const rows = await connection.selectFrom(tExactAmount)
            .where(tExactAmount.price.greaterThan('1'))
            .select({
                id: tExactAmount.id,
                amount: tExactAmount.amount,
                next: tExactAmount.amount.add('0.0000000001'),
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, amount as amount, amount + $1 as next from exact_amount where price > $2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0.0000000001",
            "1",
          ]
        `)
        assertType<Exact<typeof rows, { id: number; amount?: string; next?: string }[]>>()
        expect(rows).toEqual([
            { id: 1, amount: '12345678901234567890.1234567891', next: '12345678901234567890.1234567892' },
            { id: 5, amount: '98765432109876543210.9876543210', next: '98765432109876543210.9876543211' },
        ])
    })

    test('docs:data-types/operations-of-your-own-in-a-dynamic-filter', async () => {
        ctx.mockNext([{ id: 1 }, { id: 2 }, { id: 3 }])
        const connection = ctx.conn
        // doc-start
        const filter: DynamicCondition<{ workDate: WorkDayType }> = {
            workDate: { inYear: 2024, isLeapDay: false }
        }

        const worklogs = await connection.selectFrom(tWorklogDay)
            .where(connection.dynamicConditionFor({ workDate: tWorklogDay.workDate }).withValues(filter))
            .select({ id: tWorklogDay.id })
            .orderBy('id')
            .executeSelectMany()
        // doc-end
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where extract(year from work_date) = $1 and not ((extract(month from work_date) - 1) = $2 and extract(day from work_date) = $3) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024,
            1,
            29,
          ]
        `)
        assertType<Exact<typeof worklogs, { id: number }[]>>()
        expect(worklogs).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
    })

    test('docs:data-types/combining-your-type-with-other-values', async () => {
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority * $1 as tripled, priority * number as "byNumber" from issue where id <= $2 order by id"`)
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
