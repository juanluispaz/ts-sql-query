// The `transformProjection` of a type adapter writes the SQL of a value as it leaves the database; inside the JSON of
// an aggregated array (`output` is 'aggregatedArrayValue') it returns the SQL of a text, which goes in the JSON as a
// string, and its `transformValueFromDB` reads that text. `dayText` gives a release day as the text DD/MM/YYYY inside
// the JSON and as YYYYMMDD in a column of the result, and reads both back as the day: DD/MM/YYYY orders otherwise than
// the day (01/03/2024 < 15/01/2024 < 20/02/2024 for 2024-03-01, 2024-01-15 and 2024-02-20). `monthText` gives a day as
// the text MM/YYYY and reads it back as the first day of that month: two days of the same month give the same text, so
// a distinct or a union of the texts would merge them. `quotedDayText` gives the day between a quote and a backslash.
// Their `projectionComparison` says it: DD/MM/YYYY is `'equality'` (equal days give equal texts, but the texts order
// otherwise) and MM/YYYY is `'none'`. `isoText` gives the day as the text YYYY-MM-DD inside the JSON, which compares and
// orders as the day: it declares nothing, the default `'value'`, and the value is converted in place.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { DefaultTypeAdapter, ProjectionComparison, ProjectionOutput, TypeAdapter, TypeCategory } from '../../../../../src/TypeAdapter.js'
import { Table } from '../../../../../src/Table.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

type ReleaseDay = Date & { readonly __brand: 'ReleaseDay' }

// A localDate is read as 10:00 UTC of its day
function dayOf(year: number, month: number, day: number): ReleaseDay {
    return new Date(Date.UTC(year, month - 1, day, 10)) as ReleaseDay
}

const dayText: TypeAdapter = {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        if (typeof value === 'string') {
            const dayMonthYear = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(value)
            if (dayMonthYear) {
                return next.transformValueFromDB(dayMonthYear[3] + '-' + dayMonthYear[2] + '-' + dayMonthYear[1], type, typeCategory)
            }
            const compact = /^(\d{4})(\d\d)(\d\d)$/.exec(value)
            if (compact) {
                return next.transformValueFromDB(compact[1] + '-' + compact[2] + '-' + compact[3], type, typeCategory)
            }
        }
        return next.transformValueFromDB(value, type, typeCategory)
    },
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, type, typeCategory)
    },
    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): string {
        if (output === 'aggregatedArrayValue') {
            return "date_format(" + sql + ", '%d/%m/%Y')"
        }
        if (output === 'resultColumn') {
            return "date_format(" + sql + ", '%Y%m%d')"
        }
        return next.transformProjection(sql, type, typeCategory, output)
    },
    projectionComparison(type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): ProjectionComparison {
        if (output === 'aggregatedArrayValue') {
            return 'equality'
        }
        return next.projectionComparison(type, typeCategory, output)
    },
}

const monthText: TypeAdapter = {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        const parts = typeof value === 'string' ? /^(\d\d)\/(\d{4})$/.exec(value) : null
        if (parts) {
            return next.transformValueFromDB(parts[2] + '-' + parts[1] + '-01', type, typeCategory)
        }
        return next.transformValueFromDB(value, type, typeCategory)
    },
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, type, typeCategory)
    },
    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): string {
        if (output === 'aggregatedArrayValue') {
            return "date_format(" + sql + ", '%m/%Y')"
        }
        return next.transformProjection(sql, type, typeCategory, output)
    },
    projectionComparison(_type: string, _typeCategory: TypeCategory, _output: ProjectionOutput, _next: DefaultTypeAdapter): ProjectionComparison {
        return 'none'
    },
}

const quotedDayText: TypeAdapter = {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        const parts = typeof value === 'string' ? /^"(\d\d)\/(\d\d)\/(\d{4})\\$/.exec(value) : null
        if (parts) {
            return next.transformValueFromDB(parts[3] + '-' + parts[2] + '-' + parts[1], type, typeCategory)
        }
        return next.transformValueFromDB(value, type, typeCategory)
    },
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, type, typeCategory)
    },
    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): string {
        if (output === 'aggregatedArrayValue') {
            return "concat('\"', date_format(" + sql + ", '%d/%m/%Y'), '\\\\')"
        }
        return next.transformProjection(sql, type, typeCategory, output)
    },
    projectionComparison(_type: string, _typeCategory: TypeCategory, _output: ProjectionOutput, _next: DefaultTypeAdapter): ProjectionComparison {
        return 'equality'
    },
}

// The day as YYYY-MM-DD inside the JSON, which compares and orders as the day
const isoText: TypeAdapter = {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueFromDB(value, type, typeCategory)
    },
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, type, typeCategory)
    },
    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): string {
        if (output === 'aggregatedArrayValue') {
            return "date_format(" + sql + ", '%Y-%m-%d')"
        }
        return next.transformProjection(sql, type, typeCategory, output)
    },
}

// Every transform delegates to the library
const delegating: TypeAdapter = {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueFromDB(value, type, typeCategory)
    },
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, type, typeCategory)
    },
    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): string {
        return next.transformProjection(sql, type, typeCategory, output)
    },
}

// project_release: 1 of project 1 released on 2024-01-15 (signed off 2024-01-14), 2 of project 1 on 2024-02-20 (never
// signed off), 3 of project 2 on 2024-03-01 (signed off 2024-02-28)
const tReleaseDay = new class TReleaseDay extends Table<DBConnection, 'TReleaseDay'> {
    id         = this.primaryKey('id', 'int')
    projectId  = this.column('project_id', 'int')
    releasedOn = this.column<ReleaseDay, 'ReleaseDay'>('released_on', 'customLocalDate', 'ReleaseDay', dayText)
    signedOff  = this.optionalColumn<ReleaseDay, 'ReleaseDay'>('signed_off_at', 'customLocalDate', 'ReleaseDay', dayText)
    constructor() { super('project_release') }
}()

const tReleaseQuotedDay = new class TReleaseQuotedDay extends Table<DBConnection, 'TReleaseQuotedDay'> {
    id         = this.primaryKey('id', 'int')
    releasedOn = this.column<ReleaseDay, 'ReleaseDay'>('released_on', 'customLocalDate', 'ReleaseDay', quotedDayText)
    constructor() { super('project_release') }
}()

const tReleaseIsoText = new class TReleaseIsoText extends Table<DBConnection, 'TReleaseIsoText'> {
    id         = this.primaryKey('id', 'int')
    releasedOn = this.column<ReleaseDay, 'ReleaseDay'>('released_on', 'customLocalDate', 'ReleaseDay', isoText)
    constructor() { super('project_release') }
}()

const tReleaseDayDelegating = new class TReleaseDayDelegating extends Table<DBConnection, 'TReleaseDayDelegating'> {
    id         = this.primaryKey('id', 'int')
    projectId  = this.column('project_id', 'int')
    releasedOn = this.column<ReleaseDay, 'ReleaseDay'>('released_on', 'customLocalDate', 'ReleaseDay', delegating)
    constructor() { super('project_release') }
}()

const tReleaseDayPlain = new class TReleaseDayPlain extends Table<DBConnection, 'TReleaseDayPlain'> {
    id         = this.primaryKey('id', 'int')
    projectId  = this.column('project_id', 'int')
    releasedOn = this.column<ReleaseDay, 'ReleaseDay'>('released_on', 'customLocalDate', 'ReleaseDay')
    constructor() { super('project_release') }
}()

// project: 1 and 2 have releases
const tProjectOf = new class TProjectOf extends Table<DBConnection, 'TProjectOf'> {
    id = this.primaryKey('id', 'int')
    constructor() { super('project') }
}()

// issue_worklog: 1 on 2024-03-04, 2 on 2024-03-05, 3 on 2024-03-06
const tWorkMonth = new class TWorkMonth extends Table<DBConnection, 'TWorkMonth'> {
    id       = this.primaryKey('id', 'int')
    issueId  = this.column('issue_id', 'int')
    workDate = this.column<ReleaseDay, 'ReleaseDay'>('work_date', 'customLocalDate', 'ReleaseDay', monthText)
    constructor() { super('issue_worklog') }
}()

// issue: 1 has the worklogs 1 and 3
const tIssueOf = new class TIssueOf extends Table<DBConnection, 'TIssueOf'> {
    id = this.primaryKey('id', 'int')
    constructor() { super('issue') }
}()

// Every ReleaseDay of the connection, without a type adapter, given inside the JSON as the text DD/MM/YYYY
class DayAsTextConnection extends DBConnection {
    protected override transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput): string {
        if (type === 'ReleaseDay' && output === 'aggregatedArrayValue') {
            return "date_format(" + sql + ", '%d/%m/%Y')"
        }
        return super.transformProjection(sql, type, typeCategory, output)
    }
    protected override projectionComparison(type: string, typeCategory: TypeCategory, output: ProjectionOutput): ProjectionComparison {
        if (type === 'ReleaseDay' && output === 'aggregatedArrayValue') {
            return 'equality'
        }
        return super.projectionComparison(type, typeCategory, output)
    }
    protected override transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory): unknown {
        const parts = type === 'ReleaseDay' && typeof value === 'string' ? /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(value) : null
        if (parts) {
            return super.transformValueFromDB(parts[3] + '-' + parts[2] + '-' + parts[1], type, typeCategory)
        }
        return super.transformValueFromDB(value, type, typeCategory)
    }
}

function byId<T extends { id: number }>(values: T[]): T[] {
    return [...values].sort((a, b) => a.id - b.id)
}

function byTime(values: Date[]): Date[] {
    return [...values].sort((a, b) => a.getTime() - b.getTime())
}

// tIssueOf is referenced by the commented-out `the-distinct-of-a-correlated-aggregate-function-compares-the-values`
// test below; the cells where that test is uncommented use it for real.
void tIssueOf

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('transform-projection-aggregated-array/converts-the-values-of-an-aggregate-of-objects', async () => {
        ctx.mockNext([
            { projectId: 1, releases: JSON.stringify([{ id: 1, day: '15/01/2024' }, { id: 2, day: '20/02/2024' }]) },
            { projectId: 2, releases: JSON.stringify([{ id: 3, day: '01/03/2024' }]) },
        ])
        const rows = await ctx.conn.selectFrom(tReleaseDay)
            .select({
                projectId: tReleaseDay.projectId,
                releases:  ctx.conn.aggregateAsArray({ id: tReleaseDay.id, day: tReleaseDay.releasedOn }),
            })
            .groupBy('projectId')
            .orderBy('projectId')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, cast(json_arrayagg(json_object('id', id, 'day', date_format(released_on, '%d/%m/%Y'))) as char) as releases from project_release group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, { projectId: number; releases: { id: number; day: ReleaseDay }[] }[]>>()
        expect(rows.map(row => ({ ...row, releases: byId(row.releases) }))).toEqual([
            { projectId: 1, releases: [{ id: 1, day: dayOf(2024, 1, 15) }, { id: 2, day: dayOf(2024, 2, 20) }] },
            { projectId: 2, releases: [{ id: 3, day: dayOf(2024, 3, 1) }] },
        ])
    })

    test('transform-projection-aggregated-array/converts-the-values-of-an-aggregate-of-one-column', async () => {
        ctx.mockNext([
            { projectId: 1, days: JSON.stringify(['15/01/2024', '20/02/2024']) },
            { projectId: 2, days: JSON.stringify(['01/03/2024']) },
        ])
        const rows = await ctx.conn.selectFrom(tReleaseDay)
            .select({
                projectId: tReleaseDay.projectId,
                days:      ctx.conn.aggregateAsArrayOfOneColumn(tReleaseDay.releasedOn),
            })
            .groupBy('projectId')
            .orderBy('projectId')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, cast(json_arrayagg(date_format(released_on, '%d/%m/%Y')) as char) as days from project_release group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, { projectId: number; days: ReleaseDay[] }[]>>()
        expect(rows.map(row => ({ ...row, days: byTime(row.days) }))).toEqual([
            { projectId: 1, days: [dayOf(2024, 1, 15), dayOf(2024, 2, 20)] },
            { projectId: 2, days: [dayOf(2024, 3, 1)] },
        ])
    })

    test('transform-projection-aggregated-array/the-distinct-compares-the-values', async () => {
        // 2024-03-04, 2024-03-05 and 2024-03-06 are three values with the same text 03/2024: the distinct keeps them
        ctx.mockNext({ id: 1, months: JSON.stringify([{ month: '03/2024' }, { month: '03/2024' }, { month: '03/2024' }]) })
        const months = ctx.conn.selectDistinctFrom(tWorkMonth)
            .select({ month: tWorkMonth.workDate })
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tProjectOf)
            .where(tProjectOf.id.equals(1))
            .select({ id: tProjectOf.id, months })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast((select json_arrayagg(json_object('month', date_format(a_1_.\`month\`, '%m/%Y'))) from (select distinct work_date as \`month\` from issue_worklog) as a_1_) as char) as months from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; months: { month: ReleaseDay }[] }>>()
        expect(row).toEqual({ id: 1, months: [{ month: dayOf(2024, 3, 1) }, { month: dayOf(2024, 3, 1) }, { month: dayOf(2024, 3, 1) }] })
    })

    // NOT-APPLICABLE: MySQL's JSON_ARRAYAGG does not accept DISTINCT, so aggregateAsArrayOfOneColumnDistinct is not declared on MySqlConnection
    /*
    test('transform-projection-aggregated-array/the-distinct-of-an-aggregate-function-compares-the-texts', async () => {
        // The distinct is inside the aggregate, over what goes in the JSON: the three days of March 2024 give one text
        ctx.mockNext({ months: JSON.stringify(['03/2024']), objects: JSON.stringify([{ month: '03/2024' }]) })
        const row = await ctx.conn.selectFrom(tWorkMonth)
            .select({
                months:  ctx.conn.aggregateAsArrayOfOneColumnDistinct(tWorkMonth.workDate),
                objects: ctx.conn.aggregateAsArrayDistinct({ month: tWorkMonth.workDate }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof row, { months: ReleaseDay[]; objects: { month: ReleaseDay }[] }>>()
        expect(row).toEqual({ months: [dayOf(2024, 3, 1)], objects: [{ month: dayOf(2024, 3, 1) }] })
    })
    */

    test('transform-projection-aggregated-array/the-union-compares-the-values', async () => {
        // 2024-03-04 and 2024-03-05 are two values with the same text 03/2024: the union keeps both
        ctx.mockNext({ id: 1, months: JSON.stringify([{ month: '03/2024' }, { month: '03/2024' }]) })
        const months = ctx.conn.selectFrom(tWorkMonth)
            .where(tWorkMonth.id.equals(1))
            .select({ month: tWorkMonth.workDate })
            .union(
                ctx.conn.selectFrom(tWorkMonth)
                    .where(tWorkMonth.id.equals(2))
                    .select({ month: tWorkMonth.workDate })
            )
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tProjectOf)
            .where(tProjectOf.id.equals(1))
            .select({ id: tProjectOf.id, months })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast((select json_arrayagg(json_object('month', date_format(a_1_.\`month\`, '%m/%Y'))) from (select work_date as \`month\` from issue_worklog where id = ? union select work_date as \`month\` from issue_worklog where id = ?) as a_1_) as char) as months from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; months: { month: ReleaseDay }[] }>>()
        expect(row).toEqual({ id: 1, months: [{ month: dayOf(2024, 3, 1) }, { month: dayOf(2024, 3, 1) }] })
    })

    test('transform-projection-aggregated-array/the-order-by-and-the-limit-use-the-values', async () => {
        // Ordered by the day: 2024-01-15 and 2024-02-20 come first; ordered by the text, 01/03/2024 would come first
        ctx.mockNext({ id: 1, firstReleases: JSON.stringify([{ id: 1, day: '15/01/2024' }, { id: 2, day: '20/02/2024' }]) })
        const firstReleases = ctx.conn.selectFrom(tReleaseDay)
            .select({ id: tReleaseDay.id, day: tReleaseDay.releasedOn })
            .orderBy('day')
            .limit(2)
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tProjectOf)
            .where(tProjectOf.id.equals(1))
            .select({ id: tProjectOf.id, firstReleases })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast((select json_arrayagg(json_object('id', a_1_.id, 'day', date_format(a_1_.\`day\`, '%d/%m/%Y'))) from (select id as id, released_on as \`day\` from project_release order by \`day\` limit ?) as a_1_) as char) as firstReleases from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; firstReleases: { id: number; day: ReleaseDay }[] }>>()
        expect(row).toEqual({ id: 1, firstReleases: [{ id: 1, day: dayOf(2024, 1, 15) }, { id: 2, day: dayOf(2024, 2, 20) }] })
    })

    test('transform-projection-aggregated-array/converts-the-values-of-a-nested-aggregate', async () => {
        ctx.mockNext({
            byProject: JSON.stringify([
                { projectId: 1, days: ['15/01/2024', '20/02/2024'] },
                { projectId: 2, days: ['01/03/2024'] },
            ]),
        })
        const byProject = ctx.conn.selectFrom(tReleaseDay)
            .select({
                projectId: tReleaseDay.projectId,
                days:      ctx.conn.aggregateAsArrayOfOneColumn(tReleaseDay.releasedOn),
            })
            .groupBy('projectId')
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFromNoTable()
            .select({ byProject })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast((select json_arrayagg(json_object('projectId', a_1_.projectId, 'days', a_1_.days)) from (select project_id as projectId, json_arrayagg(date_format(released_on, '%d/%m/%Y')) as days from project_release group by project_id) as a_1_) as char) as byProject"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { byProject: { projectId: number; days: ReleaseDay[] }[] }>>()
        expect([...row.byProject].sort((a, b) => a.projectId - b.projectId).map(project => ({ ...project, days: byTime(project.days) }))).toEqual([
            { projectId: 1, days: [dayOf(2024, 1, 15), dayOf(2024, 2, 20)] },
            { projectId: 2, days: [dayOf(2024, 3, 1)] },
        ])
    })

    test('transform-projection-aggregated-array/converts-the-values-of-an-inline-select', async () => {
        ctx.mockNext({ id: 1, releases: JSON.stringify([{ id: 1, day: '15/01/2024' }, { id: 2, day: '20/02/2024' }]) })
        const releases = ctx.conn.subSelectUsing(tProjectOf).from(tReleaseDay)
            .where(tReleaseDay.projectId.equals(tProjectOf.id))
            .select({ id: tReleaseDay.id, day: tReleaseDay.releasedOn })
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tProjectOf)
            .where(tProjectOf.id.equals(1))
            .select({ id: tProjectOf.id, releases })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast((select json_arrayagg(json_object('id', id, 'day', date_format(released_on, '%d/%m/%Y'))) from project_release where project_id = project.id) as char) as releases from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; releases: { id: number; day: ReleaseDay }[] }>>()
        expect({ ...row, releases: byId(row.releases) }).toEqual({
            id: 1,
            releases: [{ id: 1, day: dayOf(2024, 1, 15) }, { id: 2, day: dayOf(2024, 2, 20) }],
        })
    })

    test('transform-projection-aggregated-array/an-optional-value-without-value-is-null', async () => {
        // Release 2 was never signed off
        ctx.mockNext([{ projectId: 1, releases: JSON.stringify([{ id: 1, signedOff: '14/01/2024' }, { id: 2, signedOff: null }]) }])
        const rows = await ctx.conn.selectFrom(tReleaseDay)
            .where(tReleaseDay.projectId.equals(1))
            .select({
                projectId: tReleaseDay.projectId,
                releases:  ctx.conn.aggregateAsArray({ id: tReleaseDay.id, signedOff: tReleaseDay.signedOff }),
            })
            .groupBy('projectId')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, cast(json_arrayagg(json_object('id', id, 'signedOff', date_format(signed_off_at, '%d/%m/%Y'))) as char) as releases from project_release where project_id = ? group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, { projectId: number; releases: { id: number; signedOff?: ReleaseDay }[] }[]>>()
        expect(rows.map(row => ({ ...row, releases: byId(row.releases) }))).toEqual([
            { projectId: 1, releases: [{ id: 1, signedOff: dayOf(2024, 1, 14) }, { id: 2 }] },
        ])
    })

    test('transform-projection-aggregated-array/a-text-with-a-quote-and-a-backslash-is-a-json-string', async () => {
        ctx.mockNext([{ id: 1, days: JSON.stringify(['"15/01/2024\\']) }])
        const rows = await ctx.conn.selectFrom(tReleaseQuotedDay)
            .where(tReleaseQuotedDay.id.equals(1))
            .select({
                id:   tReleaseQuotedDay.id,
                days: ctx.conn.aggregateAsArrayOfOneColumn(tReleaseQuotedDay.releasedOn),
            })
            .groupBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(json_arrayagg(concat('"', date_format(released_on, '%d/%m/%Y'), '\\\\')) as char) as days from project_release where id = ? group by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, { id: number; days: ReleaseDay[] }[]>>()
        expect(rows).toEqual([{ id: 1, days: [dayOf(2024, 1, 15)] }])
    })

    test('transform-projection-aggregated-array/an-adapter-that-delegates-changes-nothing', async () => {
        ctx.mockNext([{ projectId: 2, releases: JSON.stringify([{ id: 3, day: '2024-03-01' }]) }])
        const plain = await ctx.conn.selectFrom(tReleaseDayPlain)
            .where(tReleaseDayPlain.projectId.equals(2))
            .select({
                projectId: tReleaseDayPlain.projectId,
                releases:  ctx.conn.aggregateAsArray({ id: tReleaseDayPlain.id, day: tReleaseDayPlain.releasedOn }),
            })
            .groupBy('projectId')
            .executeSelectMany()
        const plainSql = ctx.lastSql
        ctx.mockNext([{ projectId: 2, releases: JSON.stringify([{ id: 3, day: '2024-03-01' }]) }])
        const rows = await ctx.conn.selectFrom(tReleaseDayDelegating)
            .where(tReleaseDayDelegating.projectId.equals(2))
            .select({
                projectId: tReleaseDayDelegating.projectId,
                releases:  ctx.conn.aggregateAsArray({ id: tReleaseDayDelegating.id, day: tReleaseDayDelegating.releasedOn }),
            })
            .groupBy('projectId')
            .executeSelectMany()
        expect(ctx.lastSql).toBe(plainSql)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, cast(json_arrayagg(json_object('id', id, 'day', released_on)) as char) as releases from project_release where project_id = ? group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, { projectId: number; releases: { id: number; day: ReleaseDay }[] }[]>>()
        expect(plain).toEqual([{ projectId: 2, releases: [{ id: 3, day: dayOf(2024, 3, 1) }] }])
        expect(rows).toEqual([{ projectId: 2, releases: [{ id: 3, day: dayOf(2024, 3, 1) }] }])
    })

    test('transform-projection-aggregated-array/a-connection-converts-every-value-of-a-type', async () => {
        const connection = ctx.withConnection(DayAsTextConnection)
        ctx.mockNext([{ projectId: 2, days: JSON.stringify(['01/03/2024']) }])
        const rows = await connection.selectFrom(tReleaseDayPlain)
            .where(tReleaseDayPlain.projectId.equals(2))
            .select({
                projectId: tReleaseDayPlain.projectId,
                days:      connection.aggregateAsArrayOfOneColumn(tReleaseDayPlain.releasedOn),
            })
            .groupBy('projectId')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, cast(json_arrayagg(date_format(released_on, '%d/%m/%Y')) as char) as days from project_release where project_id = ? group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, { projectId: number; days: ReleaseDay[] }[]>>()
        expect(rows).toEqual([{ projectId: 2, days: [dayOf(2024, 3, 1)] }])
    })

    test('transform-projection-aggregated-array/a-column-and-the-same-value-inside-the-json-are-converted-apart', async () => {
        // The column of the result is YYYYMMDD and the value inside the JSON is DD/MM/YYYY
        ctx.mockNext([{ day: '20240115', days: JSON.stringify(['15/01/2024']) }])
        const rows = await ctx.conn.selectFrom(tReleaseDay)
            .where(tReleaseDay.id.equals(1))
            .select({
                day:  tReleaseDay.releasedOn,
                days: ctx.conn.aggregateAsArrayOfOneColumn(tReleaseDay.releasedOn),
            })
            .groupBy('day')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date_format(released_on, '%Y%m%d') as \`day\`, cast(json_arrayagg(date_format(released_on, '%d/%m/%Y')) as char) as days from project_release where id = ? group by released_on"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, { day: ReleaseDay; days: ReleaseDay[] }[]>>()
        expect(rows).toEqual([{ day: dayOf(2024, 1, 15), days: [dayOf(2024, 1, 15)] }])
    })

    test('transform-projection-aggregated-array/a-value-conversion-distinct-converts-in-place', async () => {
        ctx.mockNext({ id: 1, days: JSON.stringify([{ day: '2024-01-15' }, { day: '2024-02-20' }, { day: '2024-03-01' }]) })
        const days = ctx.conn.selectDistinctFrom(tReleaseIsoText)
            .select({ day: tReleaseIsoText.releasedOn })
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tProjectOf)
            .where(tProjectOf.id.equals(1))
            .select({ id: tProjectOf.id, days })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast((select json_arrayagg(json_object('day', date_format(a_1_.\`day\`, '%Y-%m-%d'))) from (select distinct released_on as \`day\` from project_release) as a_1_) as char) as days from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; days: { day: ReleaseDay }[] }>>()
        expect(byTime(row.days.map(value => value.day))).toEqual([dayOf(2024, 1, 15), dayOf(2024, 2, 20), dayOf(2024, 3, 1)])
    })

    // NOT-APPLICABLE: MySQL's JSON_ARRAYAGG does not accept DISTINCT, so aggregateAsArrayOfOneColumnDistinct is not declared on MySqlConnection
    /*
    test('transform-projection-aggregated-array/the-distinct-of-an-aggregate-function-alone-compares-the-values', async () => {
        // The aggregate is the only column of the select: the distinct is applied to the days, and the aggregate over
        // them converts them. The three days of March 2024 are three values
        ctx.mockNext(JSON.stringify(['03/2024', '03/2024', '03/2024']))
        const months = await ctx.conn.selectFrom(tWorkMonth)
            .selectOneColumn(ctx.conn.aggregateAsArrayOfOneColumnDistinct(tWorkMonth.workDate))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof months, ReleaseDay[]>>()
        expect(months).toEqual([dayOf(2024, 3, 1), dayOf(2024, 3, 1), dayOf(2024, 3, 1)])
    })
    */

    // NOT-APPLICABLE: MySQL's JSON_ARRAYAGG does not accept DISTINCT, so aggregateAsArrayOfOneColumnDistinct is not declared on MySqlConnection
    /*
    test('transform-projection-aggregated-array/the-distinct-of-an-aggregate-function-of-objects-alone-compares-the-values', async () => {
        ctx.mockNext({ months: JSON.stringify([{ month: '03/2024' }, { month: '03/2024' }, { month: '03/2024' }]) })
        const row = await ctx.conn.selectFrom(tWorkMonth)
            .select({ months: ctx.conn.aggregateAsArrayDistinct({ month: tWorkMonth.workDate }) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof row, { months: { month: ReleaseDay }[] }>>()
        expect(row).toEqual({ months: [{ month: dayOf(2024, 3, 1) }, { month: dayOf(2024, 3, 1) }, { month: dayOf(2024, 3, 1) }] })
    })
    */

    // NOT-APPLICABLE: MySQL's JSON_ARRAYAGG does not accept DISTINCT, so aggregateAsArrayOfOneColumnDistinct is not declared on MySqlConnection
    /*
    test('transform-projection-aggregated-array/the-distinct-of-a-correlated-aggregate-function-compares-the-values', async () => {
        // Issue 1 has two worklogs of March 2024, two values
        ctx.mockNext({ id: 1, months: JSON.stringify(['03/2024', '03/2024']) })
        const months = ctx.conn.subSelectUsing(tIssueOf).from(tWorkMonth)
            .where(tWorkMonth.issueId.equals(tIssueOf.id))
            .selectOneColumn(ctx.conn.aggregateAsArrayOfOneColumnDistinct(tWorkMonth.workDate))
            .forUseAsInlineQueryValue()
        const row = await ctx.conn.selectFrom(tIssueOf)
            .where(tIssueOf.id.equals(1))
            .select({ id: tIssueOf.id, months })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof row, { id: number; months?: ReleaseDay[] }>>()
        expect(row).toEqual({ id: 1, months: [dayOf(2024, 3, 1), dayOf(2024, 3, 1)] })
    })
    */

    // NOT-APPLICABLE: MySQL's JSON_ARRAYAGG does not accept DISTINCT, so aggregateAsArrayOfOneColumnDistinct is not declared on MySqlConnection
    /*
    test('transform-projection-aggregated-array/a-value-conversion-distinct-of-an-aggregate-function-stays-inside', async () => {
        // YYYY-MM-DD compares as the day: the distinct stays inside the aggregate, over the texts
        ctx.mockNext(JSON.stringify(['2024-01-15', '2024-02-20', '2024-03-01']))
        const days = await ctx.conn.selectFrom(tReleaseIsoText)
            .selectOneColumn(ctx.conn.aggregateAsArrayOfOneColumnDistinct(tReleaseIsoText.releasedOn))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof days, ReleaseDay[]>>()
        expect(byTime(days)).toEqual([dayOf(2024, 1, 15), dayOf(2024, 2, 20), dayOf(2024, 3, 1)])
    })
    */
})
