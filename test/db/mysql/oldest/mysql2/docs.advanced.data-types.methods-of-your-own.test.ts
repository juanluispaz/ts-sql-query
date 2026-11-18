// Documentation snippets for the Methods of your own page (docs/advanced/data-types/methods-of-your-own.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Table } from '../../../../../src/Table.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { IntegersType, LocalDatesType, exposeFilterOperations, filterOperation } from '../../../../../src/exports/v2/index.js'
import type { DynamicCondition } from '../../../../../src/exports/v2/index.js'

declare const centsBrand: unique symbol
type Cents = number & { readonly [centsBrand]: true }

// A number of the user with SQL of its own in its methods
abstract class BalanceType extends IntegersType<Cents, 'Balance'> {
    static override readonly type = 'Balance'
    inEuros() {
        return this.fragmentWithType('double', 'required').sql`${this} / 100.0`
    }
    exceedsEuros(euros: number) {
        return this.fragmentWithType('boolean', 'required').sql`${this} > ${this.const(euros, 'double')} * 100`
    }
}

const tIssueBalance = new class TIssueBalance extends Table<DBConnection, 'TIssueBalance'> {
    id = this.primaryKey('id', 'int')
    balance = this.column('priority', BalanceType)
    constructor() {
        super('issue')
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

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:methods-of-your-own/sql-of-your-own-in-a-method', async () => {
        // The priority of the issues as cents: 2, 1, 3 and 2
        ctx.mockNext([{ id: 1, euros: 0.02 }, { id: 3, euros: 0.03 }, { id: 4, euros: 0.02 }])
        const connection = ctx.conn
        // doc-start
        const accounts = await connection.selectFrom(tIssueBalance)
            .where(tIssueBalance.balance.exceedsEuros(0))
            .and(tIssueBalance.balance.inEuros().greaterThan(0.015))
            .select({ id: tIssueBalance.id, euros: tIssueBalance.balance.inEuros() })
            .orderBy('id')
            .executeSelectMany()
        // doc-end
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority / 100.0 as euros from issue where priority > ? * 100 and (priority / 100.0) > ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            0.015,
          ]
        `)
        assertType<Exact<typeof accounts, { id: number; euros: number }[]>>()
        expect(accounts).toEqual([{ id: 1, euros: 0.02 }, { id: 3, euros: 0.03 }, { id: 4, euros: 0.02 }])
        // @ts-expect-error the fragments of a data type exist only inside its class
        tIssueBalance.balance.fragmentWithType('int', 'required')
    })

    test('docs:methods-of-your-own/operations-of-your-own-in-a-dynamic-filter', async () => {
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where year(work_date) = ? and not ((month(work_date) - 1) = ? and (dayofmonth(work_date)) = ?) order by id"`)
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
})
