// A localDateTime and a localTime kept in DATE columns, declared with an
// OracleDateAsTimestampTypeAdapter (standup_meeting). Only the getters of the time
// write the column as `cast(<column> as timestamp)`, and getTime counts the DATE
// itself; everywhere else the column is written as it is.
//
// Seed: meeting 1 starts 2024-03-15 09:05:07 (a Friday) and ends 09:20:45, daily
// at 08:30:15; meeting 2 starts 2024-03-18 14:40:00, no end, daily at 16:45:30.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tStandupMeeting } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('getters-of-a-local-date-time-stored-in-a-date', async () => {
        const expected = {
            fullYear:     2024,
            month:        2,
            date:         15,
            day:          5,
            hours:        9,
            minutes:      5,
            seconds:      7,
            milliseconds: 0,
            time:         1710493507000,
            startsAt:     new Date('2024-03-15T09:05:07.000Z'),
        }
        ctx.mockNext(expected)

        const result = await ctx.conn.selectFrom(tStandupMeeting)
            .where(tStandupMeeting.id.equals(1))
            .select({
                fullYear:     tStandupMeeting.startsAt.getFullYear(),
                month:        tStandupMeeting.startsAt.getMonth(),
                date:         tStandupMeeting.startsAt.getDate(),
                day:          tStandupMeeting.startsAt.getDay(),
                hours:        tStandupMeeting.startsAt.getHours(),
                minutes:      tStandupMeeting.startsAt.getMinutes(),
                seconds:      tStandupMeeting.startsAt.getSeconds(),
                milliseconds: tStandupMeeting.startsAt.getMilliseconds(),
                time:         tStandupMeeting.startsAt.getTime(),
                startsAt:     tStandupMeeting.startsAt,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(year from starts_at) as "fullYear", extract(month from starts_at) - 1 as "month", extract(day from starts_at) as "date", mod(trunc(starts_at) - trunc(starts_at, 'IW') + 1, 7) as "day", extract(hour from cast(starts_at as timestamp)) as "hours", extract(minute from cast(starts_at as timestamp)) as "minutes", extract(second from cast(starts_at as timestamp)) as "seconds", to_number(to_char(cast(starts_at as timestamp), 'FF3')) as "milliseconds", round((starts_at - date '1970-01-01') * 86400) * 1000 as "time", starts_at as "startsAt" from standup_meeting where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, {
            fullYear:     number
            month:        number
            date:         number
            day:          number
            hours:        number
            minutes:      number
            seconds:      number
            milliseconds: number
            time:         number
            startsAt:     Date
        }>>()
        expect(result).toEqual(expected)
    })

    test('getters-of-a-local-time-stored-in-a-date', async () => {
        const expected = [
            { id: 1, hours: 8,  minutes: 30, seconds: 15, milliseconds: 0, endHours: 9 },
            { id: 2, hours: 16, minutes: 45, seconds: 30, milliseconds: 0 },
        ]
        ctx.mockNext(expected)

        const result = await ctx.conn.selectFrom(tStandupMeeting)
            .select({
                id:           tStandupMeeting.id,
                hours:        tStandupMeeting.dailyAt.getHours(),
                minutes:      tStandupMeeting.dailyAt.getMinutes(),
                seconds:      tStandupMeeting.dailyAt.getSeconds(),
                milliseconds: tStandupMeeting.dailyAt.getMilliseconds(),
                endHours:     tStandupMeeting.endsAt.getHours(),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", extract(hour from cast(daily_at as timestamp)) as "hours", extract(minute from cast(daily_at as timestamp)) as "minutes", extract(second from cast(daily_at as timestamp)) as "seconds", to_number(to_char(cast(daily_at as timestamp), 'FF3')) as "milliseconds", extract(hour from cast(ends_at as timestamp)) as "endHours" from standup_meeting order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{
            id:           number
            hours:        number
            minutes:      number
            seconds:      number
            milliseconds: number
            endHours?:    number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('column-through-a-with-keeps-the-date-read-as-timestamp', async () => {
        const expected = [{ id: 2, hours: 14, minutes: 40 }]
        ctx.mockNext(expected)

        const meetingStart = ctx.conn.selectFrom(tStandupMeeting)
            .select({
                id:       tStandupMeeting.id,
                startsAt: tStandupMeeting.startsAt,
            })
            .forUseInQueryAs('meeting_start')

        const result = await ctx.conn.selectFrom(meetingStart)
            .where(meetingStart.startsAt.greaterThan(new Date('2024-03-16T00:00:00.000Z')))
            .select({
                id:      meetingStart.id,
                hours:   meetingStart.startsAt.getHours(),
                minutes: meetingStart.startsAt.getMinutes(),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with meeting_start as (select id as id, starts_at as startsAt from standup_meeting) select id as "id", extract(hour from cast(startsAt as timestamp)) as "hours", extract(minute from cast(startsAt as timestamp)) as "minutes" from meeting_start where startsAt > :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-03-16T00:00:00.000Z,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id:      number
            hours:   number
            minutes: number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('comparison-in-the-where-uses-the-column-as-stored', async () => {
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)

        const result = await ctx.conn.selectFrom(tStandupMeeting)
            .where(tStandupMeeting.startsAt.equals(new Date('2024-03-15T09:05:07.000Z')))
            .or(tStandupMeeting.startsAt.between(new Date('2024-03-18T15:00:00.000Z'), new Date('2024-03-18T16:00:00.000Z')))
            .and(tStandupMeeting.endsAt.greaterThan(tStandupMeeting.startsAt))
            .and(tStandupMeeting.dailyAt.lessThan(new Date('1970-01-01T09:00:00.000Z')))
            .select({
                id: tStandupMeeting.id,
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from standup_meeting where (starts_at = :0 or starts_at between :1 and :2) and ends_at > starts_at and daily_at < :3 order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-03-15T09:05:07.000Z,
            2024-03-18T15:00:00.000Z,
            2024-03-18T16:00:00.000Z,
            1970-01-01T09:00:00.000Z,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id: number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('in-is-and-is-null-use-the-column-as-stored', async () => {
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)

        const result = await ctx.conn.selectFrom(tStandupMeeting)
            .where(tStandupMeeting.startsAt.in([new Date('2024-03-15T09:05:07.000Z'), new Date('2024-03-18T14:40:00.000Z')]))
            .and(tStandupMeeting.dailyAt.is(new Date('1970-01-01T16:45:30.000Z')))
            .and(tStandupMeeting.endsAt.isNull())
            .select({
                id: tStandupMeeting.id,
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from standup_meeting where starts_at in (:0, :1) and decode(daily_at, :2, 1, 0 ) = 1 and ends_at is null order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-03-15T09:05:07.000Z,
            2024-03-18T14:40:00.000Z,
            1970-01-01T16:45:30.000Z,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id: number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('insert-sets-the-column-truncated-to-the-second', async () => {
        const expected = { hours: 10, minutes: 0, seconds: 15, milliseconds: 0, dailyHours: 7, startsAt: new Date('2024-04-02T10:00:15.000Z') }
        ctx.mockNext(1)
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tStandupMeeting)
                .set({
                    id:       3,
                    startsAt: new Date('2024-04-02T10:00:15.723Z'),
                    dailyAt:  new Date('1970-01-01T07:15:00.000Z'),
                })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into standup_meeting (id, starts_at, daily_at) values (:0, :1, :2)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                3,
                2024-04-02T10:00:15.723Z,
                1970-01-01T07:15:00.000Z,
              ]
            `)
            expect(inserted).toBe(1)

            const result = await ctx.conn.selectFrom(tStandupMeeting)
                .where(tStandupMeeting.id.equals(3))
                .select({
                    hours:        tStandupMeeting.startsAt.getHours(),
                    minutes:      tStandupMeeting.startsAt.getMinutes(),
                    seconds:      tStandupMeeting.startsAt.getSeconds(),
                    milliseconds: tStandupMeeting.startsAt.getMilliseconds(),
                    dailyHours:   tStandupMeeting.dailyAt.getHours(),
                    startsAt:     tStandupMeeting.startsAt,
                })
                .executeSelectOne()
            assertType<Exact<typeof result, {
                hours:        number
                minutes:      number
                seconds:      number
                milliseconds: number
                dailyHours:   number
                startsAt:     Date
            }>>()
            expect(result).toEqual(expected)
        })
    })

    test('update-sets-the-column-from-a-value-and-from-another-column', async () => {
        const expected = { endsAt: new Date('2024-03-18T14:40:00.000Z'), dailyMinutes: 10 }
        ctx.mockNext(1)
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const updated = await ctx.conn.update(tStandupMeeting)
                .set({
                    endsAt:  tStandupMeeting.startsAt,
                    dailyAt: new Date('1970-01-01T17:10:00.000Z'),
                })
                .where(tStandupMeeting.id.equals(2))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update standup_meeting set ends_at = starts_at, daily_at = :0 where id = :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1970-01-01T17:10:00.000Z,
                2,
              ]
            `)
            expect(updated).toBe(1)

            const result = await ctx.conn.selectFrom(tStandupMeeting)
                .where(tStandupMeeting.id.equals(2))
                .select({
                    endsAt:       tStandupMeeting.endsAt,
                    dailyMinutes: tStandupMeeting.dailyAt.getMinutes(),
                })
                .executeSelectOne()
            assertType<Exact<typeof result, {
                endsAt?:      Date
                dailyMinutes: number
            }>>()
            expect(result).toEqual(expected)
        })
    })

    test('values-made-from-the-column-keep-the-getters-of-the-time', async () => {
        // valueWhenNull of two such columns stays a DATE, and of the column with a value it turns the DATE into a
        // TIMESTAMP (Oracle's nvl has the type of its first operand), so the value keeps its fraction of a second;
        // nullIfValue, max and an inline select keep the DATE
        const expected = [
            { id: 1, endOrStartHours: 9,  endOrStartTime: 1710494445000, endOrValueMilliseconds: 0,   startNullIfEndHours: 9,  startNullIfEndTime: 1710493507000, firstStartMinutes: 5 },
            { id: 2, endOrStartHours: 14, endOrStartTime: 1710772800000, endOrValueMilliseconds: 123, startNullIfEndHours: 14, startNullIfEndTime: 1710772800000, firstStartMinutes: 5 },
        ]
        ctx.mockNext(expected)

        const firstStart = ctx.conn.selectFrom(tStandupMeeting)
            .where(tStandupMeeting.id.equals(1))
            .selectOneColumn(tStandupMeeting.startsAt)
            .forUseAsInlineQueryValue()

        const result = await ctx.conn.selectFrom(tStandupMeeting)
            .select({
                id:                     tStandupMeeting.id,
                endOrStartHours:        tStandupMeeting.endsAt.valueWhenNull(tStandupMeeting.startsAt).getHours(),
                endOrStartTime:         tStandupMeeting.endsAt.valueWhenNull(tStandupMeeting.startsAt).getTime(),
                endOrValueMilliseconds: tStandupMeeting.endsAt.valueWhenNull(new Date('2024-01-01T00:00:00.123Z')).getMilliseconds(),
                startNullIfEndHours:         tStandupMeeting.startsAt.nullIfValue(tStandupMeeting.endsAt).getHours(),
                startNullIfEndTime:          tStandupMeeting.startsAt.nullIfValue(tStandupMeeting.endsAt).getTime(),
                firstStartMinutes:      firstStart.getMinutes(),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", extract(hour from cast(nvl(ends_at, starts_at) as timestamp)) as "endOrStartHours", round((cast(nvl(ends_at, starts_at) as date) - date '1970-01-01') * 86400) * 1000 as "endOrStartTime", to_number(to_char(nvl(cast(ends_at as timestamp), :0), 'FF3')) as "endOrValueMilliseconds", extract(hour from cast(nullif(starts_at, ends_at) as timestamp)) as "startNullIfEndHours", round((cast(nullif(starts_at, ends_at) as date) - date '1970-01-01') * 86400) * 1000 as "startNullIfEndTime", extract(minute from cast((select starts_at as "result" from standup_meeting where id = :1) as timestamp)) as "firstStartMinutes" from standup_meeting order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-01T00:00:00.123Z,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id:                     number
            endOrStartHours:        number
            endOrStartTime:         number
            endOrValueMilliseconds: number
            startNullIfEndHours?:        number
            startNullIfEndTime?:         number
            firstStartMinutes?:     number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('max-of-the-column-keeps-the-getters-of-the-time', async () => {
        const expected = { latestHours: 14, latestTime: 1710772800000 }
        ctx.mockNext(expected)

        const result = await ctx.conn.selectFrom(tStandupMeeting)
            .select({
                latestHours: ctx.conn.max(tStandupMeeting.startsAt).getHours(),
                latestTime:  ctx.conn.max(tStandupMeeting.startsAt).getTime(),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(hour from cast(max(starts_at) as timestamp)) as "latestHours", round((cast(max(starts_at) as date) - date '1970-01-01') * 86400) * 1000 as "latestTime" from standup_meeting"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, {
            latestHours?: number
            latestTime?:  number
        }>>()
        expect(result).toEqual(expected)
    })

    test('value-when-null-with-the-column-second-needs-no-cast', async () => {
        // Oracle's nvl has the type of its first operand: a value bound as a timestamp first makes the result a
        // timestamp, the getters of the time work on it, and the result doesn't keep the adapter of the column
        const expected = { hours: 9, seconds: 7, milliseconds: 0, time: 1710493507000 }
        ctx.mockNext(expected)

        const noValue = ctx.conn.optionalConst(null, 'localDateTime')
        const result = await ctx.conn.selectFrom(tStandupMeeting)
            .where(tStandupMeeting.id.equals(1))
            .select({
                hours:        noValue.valueWhenNull(tStandupMeeting.startsAt).getHours(),
                seconds:      noValue.valueWhenNull(tStandupMeeting.startsAt).getSeconds(),
                milliseconds: noValue.valueWhenNull(tStandupMeeting.startsAt).getMilliseconds(),
                time:         noValue.valueWhenNull(tStandupMeeting.startsAt).getTime(),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(hour from nvl(:0, starts_at)) as "hours", trunc(extract(second from nvl(:1, starts_at))) as "seconds", to_number(to_char(nvl(:2, starts_at), 'FF3')) as "milliseconds", (trunc(timestamp '1970-01-01 00:00:00' + (nvl(:3, starts_at) - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (nvl(:3, starts_at) - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) as "time" from standup_meeting where id = :4"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
            null,
            null,
            null,
            1,
          ]
        `)
        assertType<Exact<typeof result, {
            hours:        number
            seconds:      number
            milliseconds: number
            time:         number
        }>>()
        expect(result).toEqual(expected)
    })

    test('value-when-null-with-the-column-first-casts-it', async () => {
        // The same operands in the other order: the column first makes nvl a DATE, so it is cast to a timestamp, the
        // value of the second keeps its fraction of a second, and the result doesn't keep the adapter of the column
        const expected = [
            { id: 1, hours: 9, seconds: 45, milliseconds: 0,   time: 1710494445000 },
            { id: 2, hours: 0, seconds: 0,  milliseconds: 123, time: 1704067200123 },
        ]
        ctx.mockNext(expected)

        const value = ctx.conn.const(new Date('2024-01-01T00:00:00.123Z'), 'localDateTime')
        const result = await ctx.conn.selectFrom(tStandupMeeting)
            .select({
                id:           tStandupMeeting.id,
                hours:        tStandupMeeting.endsAt.valueWhenNull(value).getHours(),
                seconds:      tStandupMeeting.endsAt.valueWhenNull(value).getSeconds(),
                milliseconds: tStandupMeeting.endsAt.valueWhenNull(value).getMilliseconds(),
                time:         tStandupMeeting.endsAt.valueWhenNull(value).getTime(),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", extract(hour from nvl(cast(ends_at as timestamp), :0)) as "hours", trunc(extract(second from nvl(cast(ends_at as timestamp), :1))) as "seconds", to_number(to_char(nvl(cast(ends_at as timestamp), :2), 'FF3')) as "milliseconds", (trunc(timestamp '1970-01-01 00:00:00' + (nvl(cast(ends_at as timestamp), :3) - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (nvl(cast(ends_at as timestamp), :3) - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) as "time" from standup_meeting order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-01T00:00:00.123Z,
            2024-01-01T00:00:00.123Z,
            2024-01-01T00:00:00.123Z,
            2024-01-01T00:00:00.123Z,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id:           number
            hours:        number
            seconds:      number
            milliseconds: number
            time:         number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('value-when-null-of-two-date-columns-stays-a-date-read-as-timestamp', async () => {
        // Both operands are DATE columns with the adapter: nvl stays a DATE, written as it is, and the result keeps
        // the adapter, so the getters of the time cast it
        const expected = [
            { id: 1, hours: 9,  seconds: 45, milliseconds: 0, time: 1710494445000 },
            { id: 2, hours: 14, seconds: 0,  milliseconds: 0, time: 1710772800000 },
        ]
        ctx.mockNext(expected)

        const endOrStart = tStandupMeeting.endsAt.valueWhenNull(tStandupMeeting.startsAt)
        const result = await ctx.conn.selectFrom(tStandupMeeting)
            .select({
                id:           tStandupMeeting.id,
                hours:        endOrStart.getHours(),
                seconds:      endOrStart.getSeconds(),
                milliseconds: endOrStart.getMilliseconds(),
                time:         endOrStart.getTime(),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", extract(hour from cast(nvl(ends_at, starts_at) as timestamp)) as "hours", extract(second from cast(nvl(ends_at, starts_at) as timestamp)) as "seconds", to_number(to_char(cast(nvl(ends_at, starts_at) as timestamp), 'FF3')) as "milliseconds", round((cast(nvl(ends_at, starts_at) as date) - date '1970-01-01') * 86400) * 1000 as "time" from standup_meeting order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{
            id:           number
            hours:        number
            seconds:      number
            milliseconds: number
            time:         number
        }>>>()
        expect(result).toEqual(expected)
    })
})
