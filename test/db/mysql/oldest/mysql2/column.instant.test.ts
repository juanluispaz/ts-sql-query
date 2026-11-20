// Instants (Temporal.Instant): instant_value row 1 is 2024-01-14T09:15:30.123456Z and row 2 is 1969-07-20T20:17:40Z
// without session_at. instant_at and wall_at are a DATETIME(6) (the wall clock in UTC), session_at a TIMESTAMP(6),
// converted with the zone of the session (UTC).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tInstantValue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('instant-columns-are-read-as-instants', async () => {
        ctx.mockNext([
            { id: 1, instantAt: '2024-01-14 09:15:30.123456', wallAt: '2024-01-14 09:15:30.123456', sessionAt: '2024-01-14 09:15:30.123456' },
            { id: 2, instantAt: '1969-07-20 20:17:40', wallAt: '1969-07-20 20:17:40', sessionAt: null },
        ])
        const rows = await ctx.conn.selectFrom(tInstantValue)
            .select({
                id: tInstantValue.id,
                instantAt: tInstantValue.instantAt,
                wallAt: tInstantValue.wallAt,
                sessionAt: tInstantValue.sessionAt,
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, instant_at as instantAt, wall_at as wallAt, session_at as sessionAt from instant_value order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; instantAt: Temporal.Instant; wallAt?: Temporal.Instant; sessionAt?: Temporal.Instant }>>>()
        expect(rows.map(row => [row.id, row.instantAt.toString(), row.wallAt?.toString(), row.sessionAt?.toString()])).toEqual([
            [1, '2024-01-14T09:15:30.123456Z', '2024-01-14T09:15:30.123456Z', '2024-01-14T09:15:30.123456Z'],
            [2, '1969-07-20T20:17:40Z', '1969-07-20T20:17:40Z', undefined],
        ])
        expect(rows[0]!.instantAt).toBeInstanceOf(Temporal.Instant)
    })

    test('an-instant-is-stored-with-the-digits-the-column-keeps', async () => {
        // The columns keep microseconds: MySQL rounds the nanoseconds of the value
        const instant = Temporal.Instant.from('2024-02-29T23:59:58.123456789Z')
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tInstantValue)
                .values({ id: 3, instantAt: instant, wallAt: instant, sessionAt: instant })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into instant_value (id, instant_at, wall_at, session_at) values (?, ?, ?, ?)"`)
            expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
              [
                "3",
                "2024-02-29T23:59:58.123456789Z",
                "2024-02-29T23:59:58.123456789Z",
                "2024-02-29T23:59:58.123456789Z",
              ]
            `)
            ctx.mockNext([{ instantAt: '2024-02-29 23:59:58.123457', wallAt: '2024-02-29 23:59:58.123457', sessionAt: '2024-02-29 23:59:58.123457' }])
            const rows = await ctx.conn.selectFrom(tInstantValue)
                .where(tInstantValue.id.equals(3))
                .select({ instantAt: tInstantValue.instantAt, wallAt: tInstantValue.wallAt, sessionAt: tInstantValue.sessionAt })
                .executeSelectMany()
            expect(rows.map(row => [row.instantAt.toString(), row.wallAt?.toString(), row.sessionAt?.toString()])).toEqual([
                ['2024-02-29T23:59:58.123457Z', '2024-02-29T23:59:58.123457Z', '2024-02-29T23:59:58.123457Z'],
            ])
        })
    })

    test('instants-are-compared-as-parameters', async () => {
        const instant = Temporal.Instant.from('2024-01-14T09:15:30.123456Z')
        ctx.mockNext([{ id: 1 }])
        const rows = await ctx.conn.selectFrom(tInstantValue)
            .where(tInstantValue.instantAt.equals(instant))
            .and(tInstantValue.wallAt.equals(instant))
            .and(tInstantValue.sessionAt.equals(instant))
            .select({ id: tInstantValue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from instant_value where instant_at = ? and wall_at = ? and session_at = ?"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-14T09:15:30.123456Z",
            "2024-01-14T09:15:30.123456Z",
            "2024-01-14T09:15:30.123456Z",
          ]
        `)
        expect(rows).toEqual([{ id: 1 }])
    })

    test('instants-are-ordered-by-their-moment', async () => {
        ctx.mockNext([{ id: 2 }])
        const rows = await ctx.conn.selectFrom(tInstantValue)
            .where(tInstantValue.instantAt.lessThan(Temporal.Instant.from('2000-01-01T00:00:00Z')))
            .and(tInstantValue.wallAt.lessThan(Temporal.Instant.from('2000-01-01T00:00:00Z')))
            .select({ id: tInstantValue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from instant_value where instant_at < ? and wall_at < ? order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2000-01-01T00:00:00Z",
            "2000-01-01T00:00:00Z",
          ]
        `)
        expect(rows).toEqual([{ id: 2 }])
        ctx.mockNext([{ id: 1 }, { id: 2 }])
        const ordered = await ctx.conn.selectFrom(tInstantValue)
            .select({ id: tInstantValue.id })
            .orderBy(tInstantValue.instantAt, 'desc')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from instant_value order by instant_value.instant_at desc"`)
        expect(ordered).toEqual([{ id: 1 }, { id: 2 }])
    })

    // NOT-APPLICABLE: MySQL has no RETURNING
    /*
    test('instants-are-returned-by-a-delete', async () => {
        ctx.mockNext({ instantAt: '2024-01-14 09:15:30.123456', wallAt: '2024-01-14 09:15:30.123456', sessionAt: '2024-01-14 09:15:30.123456' })
        await ctx.withRollback(async () => {
            const removed = await ctx.conn.deleteFrom(tInstantValue)
                .where(tInstantValue.id.equals(1))
                .returning({
                    instantAt: tInstantValue.instantAt,
                    wallAt: tInstantValue.wallAt,
                    sessionAt: tInstantValue.sessionAt,
                })
                .executeDeleteOne()
            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof removed, { instantAt: Temporal.Instant; wallAt?: Temporal.Instant; sessionAt?: Temporal.Instant }>>()
            expect([removed.instantAt.toString(), removed.wallAt?.toString(), removed.sessionAt?.toString()]).toEqual(['2024-01-14T09:15:30.123456Z', '2024-01-14T09:15:30.123456Z', '2024-01-14T09:15:30.123456Z'])
        })
    })
    */

    test('an-instant-selected-as-a-constant', async () => {
        // A constant comes back as the text sent, with all its digits
        ctx.mockNext({ moment: '2024-01-14 09:15:30.123456789' })
        const row = await ctx.conn.selectFromNoTable()
            .select({ moment: ctx.conn.const(Temporal.Instant.from('2024-01-14T18:15:30.123456789+09:00'), 'instant') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as moment"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-14T09:15:30.123456789Z",
          ]
        `)
        assertType<Exact<typeof row, { moment: Temporal.Instant }>>()
        expect(row.moment.toString()).toBe('2024-01-14T09:15:30.123456789Z')
    })

    test('an-instant-before-the-year-1', async () => {
        // The year -43 is 44 BC: there is no year 0
        ctx.mockNext({ old: '-0043-03-15 09:15:30' })
        const row = await ctx.conn.selectFromNoTable()
            .select({ old: ctx.conn.const(Temporal.Instant.from('-000043-03-15T09:15:30Z'), 'instant') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as old"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "-000043-03-15T09:15:30Z",
          ]
        `)
        expect(row.old.toString()).toBe('-000043-03-15T09:15:30Z')
    })

    test('instants-inside-an-aggregated-array', async () => {
        ctx.mockNext([{ values: [{ instantAt: '2024-01-14T09:15:30.123456', wallAt: '2024-01-14T09:15:30.123456' }] }])
        const rows = await ctx.conn.selectFrom(tInstantValue)
            .where(tInstantValue.id.equals(1))
            .select({
                values: ctx.conn.aggregateAsArray({
                    instantAt: tInstantValue.instantAt,
                    wallAt: tInstantValue.wallAt,
                }),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(json_arrayagg(json_object('instantAt', instant_at, 'wallAt', wall_at)) as char) as \`values\` from instant_value where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(rows.map(row => row.values.map(value => [value.instantAt.toString(), value.wallAt?.toString()]))).toEqual([[['2024-01-14T09:15:30.123456Z', '2024-01-14T09:15:30.123456Z']]])
    })

    test('the-current-instant', async () => {
        ctx.mockNext({ now: '2024-05-06 10:11:12.345678' })
        const row = await ctx.conn.selectFromNoTable()
            .select({ now: ctx.conn.currentInstant() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select utc_timestamp(6) as \`now\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { now: Temporal.Instant }>>()
        expect(row.now).toBeInstanceOf(Temporal.Instant)
    })
})
