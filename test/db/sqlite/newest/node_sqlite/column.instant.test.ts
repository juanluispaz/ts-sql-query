// Instants (Temporal.Instant): instant_value row 1 is 2024-01-14T09:15:30.123Z and row 2 is 1969-07-20T20:17:40Z
// without session_at. SQLite keeps them as a localDateTime, in the format of the connection: the text of their wall
// clock to the millisecond.

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
            { id: 1, instantAt: '2024-01-14 09:15:30.123', wallAt: '2024-01-14 09:15:30.123', sessionAt: '2024-01-14 09:15:30.123' },
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
            [1, '2024-01-14T09:15:30.123Z', '2024-01-14T09:15:30.123Z', '2024-01-14T09:15:30.123Z'],
            [2, '1969-07-20T20:17:40Z', '1969-07-20T20:17:40Z', undefined],
        ])
        expect(rows[0]!.instantAt).toBeInstanceOf(Temporal.Instant)
    })

    test('an-instant-is-stored-with-the-digits-the-column-keeps', async () => {
        // The format keeps milliseconds: the digits below are dropped
        const instant = Temporal.Instant.from('2024-02-29T23:59:58.123456789Z')
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tInstantValue)
                .values({ id: 3, instantAt: instant, wallAt: instant, sessionAt: instant })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into instant_value (id, instant_at, wall_at, session_at) values (?1, ?2, ?3, ?4)"`)
            expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
              [
                "3",
                "2024-02-29 23:59:58.123",
                "2024-02-29 23:59:58.123",
                "2024-02-29 23:59:58.123",
              ]
            `)
            ctx.mockNext([{ instantAt: '2024-02-29 23:59:58.123', wallAt: '2024-02-29 23:59:58.123', sessionAt: '2024-02-29 23:59:58.123' }])
            const rows = await ctx.conn.selectFrom(tInstantValue)
                .where(tInstantValue.id.equals(3))
                .select({ instantAt: tInstantValue.instantAt, wallAt: tInstantValue.wallAt, sessionAt: tInstantValue.sessionAt })
                .executeSelectMany()
            expect(rows.map(row => [row.instantAt.toString(), row.wallAt?.toString(), row.sessionAt?.toString()])).toEqual([
                ['2024-02-29T23:59:58.123Z', '2024-02-29T23:59:58.123Z', '2024-02-29T23:59:58.123Z'],
            ])
        })
    })

    test('instants-are-compared-as-parameters', async () => {
        const instant = Temporal.Instant.from('2024-01-14T09:15:30.123Z')
        ctx.mockNext([{ id: 1 }])
        const rows = await ctx.conn.selectFrom(tInstantValue)
            .where(tInstantValue.instantAt.equals(instant))
            .and(tInstantValue.wallAt.equals(instant))
            .and(tInstantValue.sessionAt.equals(instant))
            .select({ id: tInstantValue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from instant_value where instant_at = ?1 and wall_at = ?2 and session_at = ?3"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-14 09:15:30.123",
            "2024-01-14 09:15:30.123",
            "2024-01-14 09:15:30.123",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from instant_value where instant_at < ?1 and wall_at < ?2 order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2000-01-01 00:00:00.000",
            "2000-01-01 00:00:00.000",
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

    test('instants-are-returned-by-a-delete', async () => {
        ctx.mockNext({ instantAt: '2024-01-14 09:15:30.123', wallAt: '2024-01-14 09:15:30.123', sessionAt: '2024-01-14 09:15:30.123' })
        await ctx.withRollback(async () => {
            const removed = await ctx.conn.deleteFrom(tInstantValue)
                .where(tInstantValue.id.equals(1))
                .returning({
                    instantAt: tInstantValue.instantAt,
                    wallAt: tInstantValue.wallAt,
                    sessionAt: tInstantValue.sessionAt,
                })
                .executeDeleteOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from instant_value where id = ?1 returning instant_at as instantAt, wall_at as wallAt, session_at as sessionAt"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof removed, { instantAt: Temporal.Instant; wallAt?: Temporal.Instant; sessionAt?: Temporal.Instant }>>()
            expect([removed.instantAt.toString(), removed.wallAt?.toString(), removed.sessionAt?.toString()]).toEqual(['2024-01-14T09:15:30.123Z', '2024-01-14T09:15:30.123Z', '2024-01-14T09:15:30.123Z'])
        })
    })

    test('an-instant-selected-as-a-constant', async () => {
        // The format keeps milliseconds: the digits below are dropped
        ctx.mockNext({ moment: '2024-01-14 09:15:30.123' })
        const row = await ctx.conn.selectFromNoTable()
            .select({ moment: ctx.conn.const(Temporal.Instant.from('2024-01-14T18:15:30.123456789+09:00'), 'instant') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ?1 as moment"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-14 09:15:30.123",
          ]
        `)
        assertType<Exact<typeof row, { moment: Temporal.Instant }>>()
        expect(row.moment.toString()).toBe('2024-01-14T09:15:30.123Z')
    })

    test('an-instant-before-the-year-1', async () => {
        // The year -43 is 44 BC: there is no year 0
        ctx.mockNext({ old: '-0043-03-15 09:15:30.000' })
        const row = await ctx.conn.selectFromNoTable()
            .select({ old: ctx.conn.const(Temporal.Instant.from('-000043-03-15T09:15:30Z'), 'instant') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ?1 as old"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "-0043-03-15 09:15:30.000",
          ]
        `)
        expect(row.old.toString()).toBe('-000043-03-15T09:15:30Z')
    })

    test('instants-inside-an-aggregated-array', async () => {
        ctx.mockNext([{ values: [{ instantAt: '2024-01-14T09:15:30.123', wallAt: '2024-01-14T09:15:30.123' }] }])
        const rows = await ctx.conn.selectFrom(tInstantValue)
            .where(tInstantValue.id.equals(1))
            .select({
                values: ctx.conn.aggregateAsArray({
                    instantAt: tInstantValue.instantAt,
                    wallAt: tInstantValue.wallAt,
                }),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select json_group_array(json_object('instantAt', instant_at, 'wallAt', wall_at)) as "values" from instant_value where id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(rows.map(row => row.values.map(value => [value.instantAt.toString(), value.wallAt?.toString()]))).toEqual([[['2024-01-14T09:15:30.123Z', '2024-01-14T09:15:30.123Z']]])
    })

    test('the-current-instant', async () => {
        ctx.mockNext({ now: '2024-05-06 10:11:12.345' })
        const row = await ctx.conn.selectFromNoTable()
            .select({ now: ctx.conn.currentInstant() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select strftime('%Y-%m-%d %H:%M:%f', 'now', 'localtime') as now"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { now: Temporal.Instant }>>()
        expect(row.now).toBeInstanceOf(Temporal.Instant)
    })
})
