// Documentation snippets for the Methods of your own page (docs/advanced/data-types/methods-of-your-own.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Table } from '../../../../../src/Table.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { IntegersType, LocalDatesType, exposeFilterOperations, filterOperation } from '../../../../../src/exports/v2/index.js'
import type { DynamicCondition } from '../../../../../src/exports/v2/index.js'

declare const millisecondsBrand: unique symbol
type Milliseconds = number & { readonly [millisecondsBrand]: true }

// A number of the user with SQL of its own in its methods
abstract class MillisecondsType extends IntegersType<Milliseconds, 'Milliseconds'> {
    static override readonly type = 'Milliseconds'
    inSeconds() {
        return this.fragmentWithType('double', 'required').sql`${this} / 1000.0`
    }
    exceedsSeconds(seconds: number) {
        return this.fragmentWithType('boolean', 'required').sql`${this} > ${this.const(seconds, 'double')} * 1000`
    }
}

const tIssueDuration = new class TIssueDuration extends Table<DBConnection, 'TIssueDuration'> {
    id = this.primaryKey('id', 'int')
    duration = this.column('priority', MillisecondsType)
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
        // The priority of the issues as milliseconds: 2, 1, 3 and 2
        ctx.mockNext([{ id: 1, seconds: 0.002 }, { id: 3, seconds: 0.003 }, { id: 4, seconds: 0.002 }])
        const connection = ctx.conn
        // doc-start
        const calls = await connection.selectFrom(tIssueDuration)
            .where(tIssueDuration.duration.exceedsSeconds(0))
            .and(tIssueDuration.duration.inSeconds().greaterThan(0.0015))
            .select({ id: tIssueDuration.id, seconds: tIssueDuration.duration.inSeconds() })
            .orderBy('id')
            .executeSelectMany()
        // doc-end
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority / 1000.0 as seconds from issue where priority > ?1 * 1000 and (priority / 1000.0) > ?2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            0.0015,
          ]
        `)
        assertType<Exact<typeof calls, { id: number; seconds: number }[]>>()
        expect(calls).toEqual([{ id: 1, seconds: 0.002 }, { id: 3, seconds: 0.003 }, { id: 4, seconds: 0.002 }])
        // @ts-expect-error the fragments of a data type exist only inside its class
        tIssueDuration.duration.fragmentWithType('int', 'required')
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cast(strftime('%Y', work_date) as integer) = ?1 and not ((cast(strftime('%m', work_date) as integer) - 1) = ?2 and cast(strftime('%d', work_date) as integer) = ?3) order by id"`)
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
