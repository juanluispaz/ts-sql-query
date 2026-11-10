// A TIMESTAMP WITH TIME ZONE read and written as text, so the zone each value was written with is kept: oracledb
// reads the column as a Date, which has no zone. The type adapter has the database give the column as the text of
// to_char (transformProjection, in a column of the result and inside the JSON of an aggregated array) and converts the
// text sent with to_timestamp_tz (transformPlaceholder); the value in the application is that text. departs_at is read
// with its offset (TZH:TZM), arrives_at with its region or its offset (TZR). The column keeps its SQL everywhere else:
// the where and the order by compare the instants.
//
// Seed (flight_leg): 1 departs 2024-07-01 10:30:15.123456 +09:00 and arrives 2024-07-01 07:45:00 Europe/Madrid; 2
// departs at the same instant written with +00:00 (01:30:15.123456 UTC), no arrival; 3 departs 2024-06-30 22:00:00
// -05:00 (03:00 UTC, after 1 and 2, but the smallest text), no arrival.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { DefaultTypeAdapter, ProjectionOutput, TypeAdapter, TypeCategory } from '../../../../../src/TypeAdapter.js'
import { Table } from '../../../../../src/Table.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

// A date and time with the zone it was written with, as text, like '2024-07-01T10:30:15.123456000+09:00'
type ZonedDateTime = string

class ZonedDateTimeAsTextTypeAdapter implements TypeAdapter {
    // The zone in the text read: 'TZH:TZM' the offset, ' TZR' the region, or the offset when the value has no region
    constructor(readonly zone: 'TZH:TZM' | ' TZR') {}

    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        if (type === 'ZonedDateTime' && value !== null && value !== undefined) {
            if (typeof value === 'string') {
                return value
            }
            throw new Error('Cannot read a ' + typeof value + ' as a ZonedDateTime')
        }
        return next.transformValueFromDB(value, type, typeCategory)
    }

    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        if (type === 'ZonedDateTime') {
            return value
        }
        return next.transformValueToDB(value, type, typeCategory)
    }

    transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, valueSentToDB: unknown, next: DefaultTypeAdapter): string {
        if (type === 'ZonedDateTime') {
            // Reads an offset (2024-07-01T10:30:15.123+09:00) or a region (2024-07-01T07:45:00.5 Europe/Madrid)
            return "to_timestamp_tz(" + placeholder + ", 'YYYY-MM-DD\"T\"HH24:MI:SS.FF TZR')"
        }
        return next.transformPlaceholder(placeholder, type, typeCategory, valueSentToDB)
    }

    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): string {
        if (type === 'ZonedDateTime' && (output === 'resultColumn' || output === 'aggregatedArrayValue')) {
            return "to_char(" + sql + ", 'YYYY-MM-DD\"T\"HH24:MI:SS.FF9" + this.zone + "')"
        }
        return next.transformProjection(sql, type, typeCategory, output)
    }
}

const tFlightLeg = new class TFlightLeg extends Table<DBConnection, 'TFlightLeg'> {
    id        = this.primaryKey('id', 'int')
    departsAt = this.column<ZonedDateTime, 'ZonedDateTime'>('departs_at', 'customComparable', 'ZonedDateTime', new ZonedDateTimeAsTextTypeAdapter('TZH:TZM'))
    arrivesAt = this.optionalColumn<ZonedDateTime, 'ZonedDateTime'>('arrives_at', 'customComparable', 'ZonedDateTime', new ZonedDateTimeAsTextTypeAdapter(' TZR'))
    constructor() { super('flight_leg') }
}()

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('select-reads-the-zone-of-each-value', async () => {
        const expected = [
            { id: 1, departsAt: '2024-07-01T10:30:15.123456000+09:00', arrivesAt: '2024-07-01T07:45:00.000000000 EUROPE/MADRID' },
            { id: 2, departsAt: '2024-07-01T01:30:15.123456000+00:00' },
            { id: 3, departsAt: '2024-06-30T22:00:00.000000000-05:00' },
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char(departs_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM') as "departsAt", to_char(arrives_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF9 TZR') as "arrivesAt" from flight_leg order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, { id: number; departsAt: ZonedDateTime; arrivesAt?: ZonedDateTime }[]>>()
        expect(rows).toEqual(expected)
    })

    test('insert-writes-the-zone-of-the-value', async () => {
        const expected = { departsAt: '2024-07-01T10:30:15.123000000+09:00', arrivesAt: '2024-07-01T07:45:00.500000000 EUROPE/MADRID' }
        ctx.mockNext(1)
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tFlightLeg)
                .set({
                    id:        10,
                    departsAt: '2024-07-01T10:30:15.123+09:00',
                    arrivesAt: '2024-07-01T07:45:00.5 Europe/Madrid',
                })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into flight_leg (id, departs_at, arrives_at) values (:0, to_timestamp_tz(:1, 'YYYY-MM-DD"T"HH24:MI:SS.FF TZR'), to_timestamp_tz(:2, 'YYYY-MM-DD"T"HH24:MI:SS.FF TZR'))"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                10,
                "2024-07-01T10:30:15.123+09:00",
                "2024-07-01T07:45:00.5 Europe/Madrid",
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(departs_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM') as "departsAt", to_char(arrives_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF9 TZR') as "arrivesAt" from flight_leg where id = :0"`)
            assertType<Exact<typeof row, { departsAt: ZonedDateTime; arrivesAt?: ZonedDateTime }>>()
            expect(row).toEqual(expected)
        })
    })

    test('insert-returning-gives-the-zone-of-the-value', async () => {
        const expected = { id: 11, departsAt: '2024-01-14T19:30:15.123000000+09:00', arrivesAt: '2024-01-14T12:30:00.000000000 EUROPE/MADRID' }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const row = await ctx.conn.insertInto(tFlightLeg)
                .set({
                    id:        11,
                    departsAt: '2024-01-14T19:30:15.123+09:00',
                    arrivesAt: '2024-01-14T12:30:00 Europe/Madrid',
                })
                .returning({
                    id:        tFlightLeg.id,
                    departsAt: tFlightLeg.departsAt,
                    arrivesAt: tFlightLeg.arrivesAt,
                })
                .executeInsertOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into flight_leg (id, departs_at, arrives_at) values (:0, to_timestamp_tz(:1, 'YYYY-MM-DD"T"HH24:MI:SS.FF TZR'), to_timestamp_tz(:2, 'YYYY-MM-DD"T"HH24:MI:SS.FF TZR')) returning id, to_char(departs_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM'), to_char(arrives_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF9 TZR') into :3, :4, :5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                11,
                "2024-01-14T19:30:15.123+09:00",
                "2024-01-14T12:30:00 Europe/Madrid",
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "departsAt",
                  "dir": 3003,
                },
                {
                  "as": "arrivesAt",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, { id: number; departsAt: ZonedDateTime; arrivesAt?: ZonedDateTime }>>()
            expect(row).toEqual(expected)
        })
    })

    test('aggregate-as-array-keeps-the-zone-of-each-value', async () => {
        const expected = [
            { id: 1, departsAt: '2024-07-01T10:30:15.123456000+09:00', arrivesAt: '2024-07-01T07:45:00.000000000 EUROPE/MADRID' },
            { id: 2, departsAt: '2024-07-01T01:30:15.123456000+00:00' },
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select json_arrayagg(json_object('id' value id, 'departsAt' value to_char(departs_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM'), 'arrivesAt' value to_char(arrives_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF9 TZR'))) as "legs" from flight_leg where id in (:0, :1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof row, { legs: { id: number; departsAt: ZonedDateTime; arrivesAt?: ZonedDateTime }[] }>>()
        // json_arrayagg without an order by gives the values in no fixed order
        expect([...row.legs].sort((a, b) => a.id - b.id)).toEqual(expected)
    })

    test('update-writes-the-zone-of-a-value-and-of-another-column', async () => {
        // ends up with the arrival the departure had before the update, with its offset -05:00
        const expected = { departsAt: '2024-07-01T08:00:00.500000000+05:30', arrivesAt: '2024-06-30T22:00:00.000000000 -05:00' }
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update flight_leg set arrives_at = departs_at, departs_at = to_timestamp_tz(:0, 'YYYY-MM-DD"T"HH24:MI:SS.FF TZR') where id = :1"`)
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
        // 1 (+09:00) and 2 (+00:00) depart at 01:30:15.123456 UTC, which Europe/Madrid writes as 03:30:15.123456
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        ctx.mockNext(expected)

        const withOffset = await ctx.conn.selectFrom(tFlightLeg)
            .where(tFlightLeg.departsAt.equals('2024-07-01T01:30:15.123456+00:00'))
            .select({ id: tFlightLeg.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from flight_leg where departs_at = to_timestamp_tz(:0, 'YYYY-MM-DD"T"HH24:MI:SS.FF TZR') order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-07-01T01:30:15.123456+00:00",
          ]
        `)
        assertType<Exact<typeof withOffset, { id: number }[]>>()
        expect(withOffset).toEqual(expected)

        const withRegion = await ctx.conn.selectFrom(tFlightLeg)
            .where(tFlightLeg.departsAt.equals('2024-07-01T03:30:15.123456 Europe/Madrid'))
            .select({ id: tFlightLeg.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-07-01T03:30:15.123456 Europe/Madrid",
          ]
        `)
        expect(withRegion).toEqual(expected)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from flight_leg where departs_at < to_timestamp_tz(:0, 'YYYY-MM-DD"T"HH24:MI:SS.FF TZR') order by "id""`)
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
            { id: 1, departsAt: '2024-07-01T10:30:15.123456000+09:00' },
            { id: 2, departsAt: '2024-07-01T01:30:15.123456000+00:00' },
            { id: 3, departsAt: '2024-06-30T22:00:00.000000000-05:00' },
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char(departs_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM') as "departsAt" from flight_leg order by flight_leg.departs_at, "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, { id: number; departsAt: ZonedDateTime }[]>>()
        expect(rows).toEqual(expected)
    })
})
