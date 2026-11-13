// A type adapter can request the type a value is sent with: `dayMonthYear` sends a ReleaseDay (a customLocalDate) as
// its text DD/MM/YYYY, requesting a string in transformValueToDB, and writes the placeholder converting that text to a
// date. The query runner sends the parameter as the type requested, a text, also where the database must receive its
// type. The rows show the query finds the release of that day (release 1 was released on 2024-01-15).
//
// The conversion of the text to a date is written by the adapter, so it is this database's SQL: the function below is
// the only dialect-specific text of the file.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { getQueryContext } from '../../../../../src/exports/v2/index.js'
import type { TypeAdapter } from '../../../../../src/TypeAdapter.js'
import { Table } from '../../../../../src/Table.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

type ReleaseDay = Date & { readonly __brand: 'ReleaseDay' }

// A localDate is read as 10:00 UTC of its day
function dayOf(year: number, month: number, day: number): ReleaseDay {
    return new Date(Date.UTC(year, month - 1, day, 10)) as ReleaseDay
}

// The date the text DD/MM/YYYY of the placeholder gives, in this database's SQL
function dateOfDayMonthYearText(placeholder: string): string {
    return 'convert(date, ' + placeholder + ', 103)'
}

// What transformPlaceholder sees of the types of the parameter
const seenByThePlaceholder: Array<[string, string | undefined, string, string | undefined]> = []

// Sends a ReleaseDay as its text DD/MM/YYYY
const dayMonthYear: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        return next.transformValueFromDB(value, context)
    },
    transformValueToDB(value, context, next) {
        if (value instanceof Date) {
            context.setRequestedType('string')
            const day = String(value.getUTCDate()).padStart(2, '0')
            const month = String(value.getUTCMonth() + 1).padStart(2, '0')
            return next.transformValueToDB(day + '/' + month + '/' + value.getUTCFullYear(), context)
        }
        return next.transformValueToDB(value, context)
    },
    transformPlaceholder(placeholder, context, next) {
        seenByThePlaceholder.push([context.originalType, context.originalCustomType, context.requestedType, context.requestedCustomType])
        if (context.requestedType === 'string') {
            return dateOfDayMonthYearText(placeholder)
        }
        return next.transformPlaceholder(placeholder, context)
    },
}

const tReleaseDayAsText = new class TReleaseDayAsText extends Table<DBConnection, 'TReleaseDayAsText'> {
    id         = this.primaryKey('id', 'int')
    releasedOn = this.column<ReleaseDay, 'ReleaseDay'>('released_on', 'customLocalDate', 'ReleaseDay', dayMonthYear)
    constructor() { super('project_release') }
}()

// A custom type decides how its value is converted, whatever its name: a customLocalDate named 'localDateTime' is a
// localDate
const tReleaseDayNamedLikeABuiltIn = new class TReleaseDayNamedLikeABuiltIn extends Table<DBConnection, 'TReleaseDayNamedLikeABuiltIn'> {
    id         = this.primaryKey('id', 'int')
    releasedOn = this.column<ReleaseDay, 'localDateTime'>('released_on', 'customLocalDate', 'localDateTime')
    constructor() { super('project_release') }
}()

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('requested-type/a-value-sent-as-the-type-the-adapter-requests', async () => {
        seenByThePlaceholder.length = 0
        ctx.mockNext([{ id: 1 }])
        const rows = await ctx.conn.selectFrom(tReleaseDayAsText)
            .where(tReleaseDayAsText.releasedOn.equals(dayOf(2024, 1, 15)))
            .select({ id: tReleaseDayAsText.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on = convert(date, @0, 103)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "15/01/2024",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([{ id: 1 }])
        // The placeholder and the query runner see both types of the parameter
        expect(seenByThePlaceholder).toEqual([['ReleaseDay', 'customLocalDate', 'string', undefined]])
        const param = getQueryContext(ctx.lastSql, ctx.lastParams).getParam(0)
        expect([param?.originalType, param?.originalCustomType, param?.requestedType, param?.requestedCustomType]).toEqual(['ReleaseDay', 'customLocalDate', 'string', undefined])
    })

    test('requested-type/a-value-sent-as-the-type-the-adapter-requests-where-the-database-receives-its-type', async () => {
        ctx.mockNext([{ id: 1, day: '2024-01-15' }])
        const rows = await ctx.conn.selectFrom(tReleaseDayAsText)
            .where(tReleaseDayAsText.id.equals(1))
            .select({
                id: tReleaseDayAsText.id,
                day: ctx.conn.const(dayOf(2024, 1, 15), 'customLocalDate', 'ReleaseDay', dayMonthYear),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, convert(date, @0, 103) as day from project_release where id = @1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "15/01/2024",
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number, day: ReleaseDay }>>>()
        expect(rows).toEqual([{ id: 1, day: dayOf(2024, 1, 15) }])
    })

    test('requested-type/a-custom-type-decides-whatever-its-name', async () => {
        ctx.mockNext([{ id: 1, releasedOn: '2024-01-15' }])
        const rows = await ctx.conn.selectFrom(tReleaseDayNamedLikeABuiltIn)
            .where(tReleaseDayNamedLikeABuiltIn.releasedOn.equals(dayOf(2024, 1, 15)))
            .select({
                id: tReleaseDayNamedLikeABuiltIn.id,
                releasedOn: tReleaseDayNamedLikeABuiltIn.releasedOn,
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, released_on as releasedOn from project_release where released_on = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-15T10:00:00.000Z,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number, releasedOn: ReleaseDay }>>>()
        // Read as a localDate: 10:00 UTC of its day
        expect(rows).toEqual([{ id: 1, releasedOn: dayOf(2024, 1, 15) }])
    })
})
