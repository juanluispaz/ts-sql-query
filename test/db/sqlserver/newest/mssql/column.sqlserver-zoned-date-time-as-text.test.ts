// A DATETIMEOFFSET read and written as text, so the offset each value was written with is kept: tedious reads the
// column as a Date, which has no zone. The type adapter has the database give the column as the text of convert with
// the style 126 (transformProjection, in a column of the result and inside the JSON of an aggregated array) and
// converts the text sent with a cast to datetimeoffset (transformPlaceholder); the value in the application is that
// text. The style 126 writes the seven digits of the fraction of a second, and no fraction when it is zero. The column
// keeps its SQL everywhere else: the where and the order by compare the instants.
//
// Seed (flight_leg): 1 departs 2024-07-01 10:30:15.1234567 +09:00 and arrives 2024-07-01 07:45:00 +02:00; 2 departs at
// the same instant written with +00:00 (01:30:15.1234567 UTC), no arrival; 3 departs 2024-06-30 22:00:00 -05:00
// (03:00 UTC, after 1 and 2, but the smallest text), no arrival.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { DefaultTypeAdapter, TypeAdapter, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext, TypeAdapterPlaceholderContext, TypeAdapterProjectionContext } from '../../../../../src/TypeAdapter.js'
import { Table } from '../../../../../src/Table.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

// A date and time with the offset it was written with, as text, like '2024-07-01T10:30:15.1234567+09:00'
type ZonedDateTime = string

const zonedDateTimeAsText: TypeAdapter = {
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        if (context.originalType === 'ZonedDateTime' && value !== null && value !== undefined) {
            if (typeof value === 'string') {
                return value
            }
            throw new Error('Cannot read a ' + typeof value + ' as a ZonedDateTime')
        }
        return next.transformValueFromDB(value, context)
    },
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        if (context.originalType === 'ZonedDateTime') {
            return value
        }
        return next.transformValueToDB(value, context)
    },
    transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter): string {
        if (context.originalType === 'ZonedDateTime') {
            return 'cast(' + placeholder + ' as datetimeoffset)'
        }
        return next.transformPlaceholder(placeholder, context)
    },
    transformProjection(sql: string, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string {
        if (context.originalType === 'ZonedDateTime') {
            context.comparison = 'none'
        }
        if (context.originalType === 'ZonedDateTime' && (context.output === 'resultColumn' || context.output === 'aggregatedArrayValue')) {
            return 'convert(nvarchar(40), ' + sql + ', 126)'
        }
        return next.transformProjection(sql, context)
    },
}

// The instant of a text read, to the millisecond
function instantOf(text: ZonedDateTime): number {
    return Date.parse(text.replace(/(\.\d{3})\d*/, '$1'))
}

const tFlightLeg = new class TFlightLeg extends Table<DBConnection, 'TFlightLeg'> {
    id        = this.primaryKey('id', 'int')
    departsAt = this.column<ZonedDateTime, 'ZonedDateTime'>('departs_at', 'customComparable', 'ZonedDateTime', zonedDateTimeAsText)
    arrivesAt = this.optionalColumn<ZonedDateTime, 'ZonedDateTime'>('arrives_at', 'customComparable', 'ZonedDateTime', zonedDateTimeAsText)
    constructor() { super('flight_leg') }
}()

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('select-reads-the-zone-of-each-value', async () => {
        const expected = [
            { id: 1, departsAt: '2024-07-01T10:30:15.1234567+09:00', arrivesAt: '2024-07-01T07:45:00+02:00' },
            { id: 2, departsAt: '2024-07-01T01:30:15.1234567+00:00' },
            { id: 3, departsAt: '2024-06-30T22:00:00-05:00' },
        ]
        ctx.mockNext(expected)

        const rows = await ctx.conn.selectFrom(tFlightLeg)
            .select({
                id:        tFlightLeg.id,
                departsAt: tFlightLeg.departsAt,
                arrivesAt: tFlightLeg.arrivesAt,
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, convert(nvarchar(40), departs_at, 126) as departsAt, convert(nvarchar(40), arrives_at, 126) as arrivesAt from flight_leg order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, { id: number; departsAt: ZonedDateTime; arrivesAt?: ZonedDateTime }[]>>()
        expect(rows).toEqual(expected)
    })

    test('insert-writes-the-zone-of-the-value', async () => {
        const expected = { departsAt: '2024-07-01T10:30:15.1230000+09:00', arrivesAt: '2024-07-01T07:45:00.5000000+02:00' }
        ctx.mockNext(1)
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tFlightLeg)
                .set({
                    id:        10,
                    departsAt: '2024-07-01T10:30:15.123+09:00',
                    arrivesAt: '2024-07-01T07:45:00.5+02:00',
                })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into flight_leg (id, departs_at, arrives_at) values (@0, cast(@1 as datetimeoffset), cast(@2 as datetimeoffset))"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                10,
                "2024-07-01T10:30:15.123+09:00",
                "2024-07-01T07:45:00.5+02:00",
              ]
            `)
            expect(inserted).toBe(1)

            const row = await ctx.conn.selectFrom(tFlightLeg)
                .where(tFlightLeg.id.equals(10))
                .select({
                    departsAt: tFlightLeg.departsAt,
                    arrivesAt: tFlightLeg.arrivesAt,
                })
                .executeSelectOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select convert(nvarchar(40), departs_at, 126) as departsAt, convert(nvarchar(40), arrives_at, 126) as arrivesAt from flight_leg where id = @0"`)
            assertType<Exact<typeof row, { departsAt: ZonedDateTime; arrivesAt?: ZonedDateTime }>>()
            expect(row).toEqual(expected)
        })
    })

    test('insert-returning-gives-the-zone-of-the-value', async () => {
        const expected = { id: 11, departsAt: '2024-01-14T19:30:15.1230000+09:00', arrivesAt: '2024-01-14T12:30:00+01:00' }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const row = await ctx.conn.insertInto(tFlightLeg)
                .set({
                    id:        11,
                    departsAt: '2024-01-14T19:30:15.123+09:00',
                    arrivesAt: '2024-01-14T12:30:00+01:00',
                })
                .returning({
                    id:        tFlightLeg.id,
                    departsAt: tFlightLeg.departsAt,
                    arrivesAt: tFlightLeg.arrivesAt,
                })
                .executeInsertOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into flight_leg (id, departs_at, arrives_at) output inserted.id as id, convert(nvarchar(40), inserted.departs_at, 126) as departsAt, convert(nvarchar(40), inserted.arrives_at, 126) as arrivesAt values (@0, cast(@1 as datetimeoffset), cast(@2 as datetimeoffset))"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                11,
                "2024-01-14T19:30:15.123+09:00",
                "2024-01-14T12:30:00+01:00",
              ]
            `)
            assertType<Exact<typeof row, { id: number; departsAt: ZonedDateTime; arrivesAt?: ZonedDateTime }>>()
            expect(row).toEqual(expected)
        })
    })

    test('aggregate-as-array-keeps-the-zone-of-each-value', async () => {
        const expected = [
            { id: 1, departsAt: '2024-07-01T10:30:15.1234567+09:00', arrivesAt: '2024-07-01T07:45:00+02:00' },
            { id: 2, departsAt: '2024-07-01T01:30:15.1234567+00:00' },
        ]
        ctx.mockNext({ legs: JSON.stringify([{ ...expected[0] }, { ...expected[1], arrivesAt: null }]) })

        const row = await ctx.conn.selectFrom(tFlightLeg)
            .where(tFlightLeg.id.in([1, 2]))
            .select({
                legs: ctx.conn.aggregateAsArray({
                    id:        tFlightLeg.id,
                    departsAt: tFlightLeg.departsAt,
                    arrivesAt: tFlightLeg.arrivesAt,
                }),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select json_arrayagg(json_object('id':id, 'departsAt':convert(nvarchar(40), departs_at, 126), 'arrivesAt':convert(nvarchar(40), arrives_at, 126))) as legs from flight_leg where id in (@0, @1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof row, { legs: { id: number; departsAt: ZonedDateTime; arrivesAt?: ZonedDateTime }[] }>>()
        // The aggregate without an order by gives the values in no fixed order
        expect([...row.legs].sort((a, b) => a.id - b.id)).toEqual(expected)
    })

    test('update-writes-the-zone-of-a-value-and-of-another-column', async () => {
        // ends up with the arrival the departure had before the update, with its offset -05:00
        const expected = { departsAt: '2024-07-01T08:00:00.5000000+05:30', arrivesAt: '2024-06-30T22:00:00-05:00' }
        ctx.mockNext(1)
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const updated = await ctx.conn.update(tFlightLeg)
                .set({
                    arrivesAt: tFlightLeg.departsAt,
                    departsAt: '2024-07-01T08:00:00.5+05:30',
                })
                .where(tFlightLeg.id.equals(3))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update flight_leg set arrives_at = departs_at, departs_at = cast(@0 as datetimeoffset) where id = @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "2024-07-01T08:00:00.5+05:30",
                3,
              ]
            `)
            expect(updated).toBe(1)

            const row = await ctx.conn.selectFrom(tFlightLeg)
                .where(tFlightLeg.id.equals(3))
                .select({
                    departsAt: tFlightLeg.departsAt,
                    arrivesAt: tFlightLeg.arrivesAt,
                })
                .executeSelectOne()
            assertType<Exact<typeof row, { departsAt: ZonedDateTime; arrivesAt?: ZonedDateTime }>>()
            expect(row).toEqual(expected)
        })
    })

    test('where-equals-compares-the-instant', async () => {
        // 1 (+09:00) and 2 (+00:00) depart at 01:30:15.1234567 UTC, the same instant whichever offset the value is written with
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        ctx.mockNext(expected)

        const withOffset = await ctx.conn.selectFrom(tFlightLeg)
            .where(tFlightLeg.departsAt.equals('2024-07-01T01:30:15.1234567+00:00'))
            .select({ id: tFlightLeg.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from flight_leg where departs_at = cast(@0 as datetimeoffset) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-07-01T01:30:15.1234567+00:00",
          ]
        `)
        assertType<Exact<typeof withOffset, { id: number }[]>>()
        expect(withOffset).toEqual(expected)

        const withOtherOffset = await ctx.conn.selectFrom(tFlightLeg)
            .where(tFlightLeg.departsAt.equals('2024-07-01T10:30:15.1234567+09:00'))
            .select({ id: tFlightLeg.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-07-01T10:30:15.1234567+09:00",
          ]
        `)
        expect(withOtherOffset).toEqual(expected)
    })

    test('where-less-than-compares-the-instant', async () => {
        // 3 departs at 03:00 UTC, after 02:00 UTC, although its text 2024-06-30T22:00 is the smallest
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)

        const rows = await ctx.conn.selectFrom(tFlightLeg)
            .where(tFlightLeg.departsAt.lessThan('2024-07-01T02:00:00+00:00'))
            .select({ id: tFlightLeg.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from flight_leg where departs_at < cast(@0 as datetimeoffset) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-07-01T02:00:00+00:00",
          ]
        `)
        assertType<Exact<typeof rows, { id: number }[]>>()
        expect(rows).toEqual(expected)
    })

    test('order-by-the-column-orders-by-the-instant', async () => {
        // By the text, 3 (2024-06-30T22:00-05:00) would come first and 1 (2024-07-01T10:30+09:00) last
        const expected = [
            { id: 1, departsAt: '2024-07-01T10:30:15.1234567+09:00' },
            { id: 2, departsAt: '2024-07-01T01:30:15.1234567+00:00' },
            { id: 3, departsAt: '2024-06-30T22:00:00-05:00' },
        ]
        ctx.mockNext(expected)

        const rows = await ctx.conn.selectFrom(tFlightLeg)
            .select({
                id:        tFlightLeg.id,
                departsAt: tFlightLeg.departsAt,
            })
            .orderBy('departsAt')
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, convert(nvarchar(40), departs_at, 126) as departsAt from flight_leg order by flight_leg.departs_at, id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, { id: number; departsAt: ZonedDateTime }[]>>()
        expect(rows).toEqual(expected)
    })

    test('union-compares-the-instant', async () => {
        // 1 and 2 depart at the same instant, written with +09:00 and +00:00: the union compares the instants and keeps
        // one row, whichever of the two texts
        ctx.mockNext(['2024-07-01T10:30:15.1234567+09:00'])
        const departures = await ctx.conn.selectFrom(tFlightLeg)
            .where(tFlightLeg.id.equals(1))
            .selectOneColumn(tFlightLeg.departsAt)
            .union(
                ctx.conn.selectFrom(tFlightLeg)
                    .where(tFlightLeg.id.equals(2))
                    .selectOneColumn(tFlightLeg.departsAt)
            )
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select convert(nvarchar(40), o_1_.result, 126) as result from (select departs_at as result from flight_leg where id = @0 union select departs_at as result from flight_leg where id = @1) as o_1_"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof departures, ZonedDateTime[]>>()
        expect(departures.map(instantOf)).toEqual([Date.UTC(2024, 6, 1, 1, 30, 15, 123)])
    })

    test('distinct-compares-the-instant', async () => {
        ctx.mockNext(['2024-07-01T10:30:15.1234567+09:00'])
        const departures = await ctx.conn.selectDistinctFrom(tFlightLeg)
            .where(tFlightLeg.id.in([1, 2]))
            .selectOneColumn(tFlightLeg.departsAt)
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select convert(nvarchar(40), o_1_.result, 126) as result from (select distinct departs_at as result from flight_leg where id in (@0, @1)) as o_1_"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof departures, ZonedDateTime[]>>()
        expect(departures.map(instantOf)).toEqual([Date.UTC(2024, 6, 1, 1, 30, 15, 123)])
    })
})
