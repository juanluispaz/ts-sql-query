// Instants (Temporal.Instant): instant_value row 1 is 2024-01-14T09:15:30.123456Z, written with the offset +09:00
// where the column keeps one, and row 2 is 1969-07-20T20:17:40Z without session_at. instant_at and session_at are a
// datetimeoffset(7), wall_at a datetime2(7) (the wall clock in UTC).

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
            { id: 1, instantAt: '2024-01-14 09:15:30.123456+00', wallAt: '2024-01-14 09:15:30.123456', sessionAt: '2024-01-14 09:15:30.123456+00' },
            { id: 2, instantAt: '1969-07-20 20:17:40+00', wallAt: '1969-07-20 20:17:40', sessionAt: null },
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
        // The columns keep 100 nanoseconds: SQL Server rounds the nanoseconds of the value
        const instant = Temporal.Instant.from('2024-02-29T23:59:58.123456789Z')
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tInstantValue)
                .values({ id: 3, instantAt: instant, wallAt: instant, sessionAt: instant })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into instant_value (id, instant_at, wall_at, session_at) values (@0, @1, @2, @3)"`)
            expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
              [
                "3",
                "2024-02-29T23:59:58.123456789Z",
                "2024-02-29T23:59:58.123456789Z",
                "2024-02-29T23:59:58.123456789Z",
              ]
            `)
            ctx.mockNext([{ instantAt: '2024-02-29 23:59:58.1234568+00', wallAt: '2024-02-29 23:59:58.1234568', sessionAt: '2024-02-29 23:59:58.1234568+00' }])
            const rows = await ctx.conn.selectFrom(tInstantValue)
                .where(tInstantValue.id.equals(3))
                .select({ instantAt: tInstantValue.instantAt, wallAt: tInstantValue.wallAt, sessionAt: tInstantValue.sessionAt })
                .executeSelectMany()
            expect(rows.map(row => [row.instantAt.toString(), row.wallAt?.toString(), row.sessionAt?.toString()])).toEqual([
                ['2024-02-29T23:59:58.1234568Z', '2024-02-29T23:59:58.1234568Z', '2024-02-29T23:59:58.1234568Z'],
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from instant_value where instant_at = @0 and wall_at = @1 and session_at = @2"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from instant_value where instant_at < @0 and wall_at < @1 order by id"`)
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

    test('instants-are-returned-by-a-delete', async () => {
        ctx.mockNext({ instantAt: '2024-01-14 09:15:30.123456+00', wallAt: '2024-01-14 09:15:30.123456', sessionAt: '2024-01-14 09:15:30.123456+00' })
        await ctx.withRollback(async () => {
            const removed = await ctx.conn.deleteFrom(tInstantValue)
                .where(tInstantValue.id.equals(1))
                .returning({
                    instantAt: tInstantValue.instantAt,
                    wallAt: tInstantValue.wallAt,
                    sessionAt: tInstantValue.sessionAt,
                })
                .executeDeleteOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from instant_value output deleted.instant_at as instantAt, deleted.wall_at as wallAt, deleted.session_at as sessionAt where id = @0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof removed, { instantAt: Temporal.Instant; wallAt?: Temporal.Instant; sessionAt?: Temporal.Instant }>>()
            expect([removed.instantAt.toString(), removed.wallAt?.toString(), removed.sessionAt?.toString()]).toEqual(['2024-01-14T09:15:30.123456Z', '2024-01-14T09:15:30.123456Z', '2024-01-14T09:15:30.123456Z'])
        })
    })

    test('an-instant-selected-as-a-constant', async () => {
        // SQL Server keeps 100 nanoseconds: the nanoseconds are rounded
        ctx.mockNext({ moment: '2024-01-14 09:15:30.1234568+00' })
        const row = await ctx.conn.selectFromNoTable()
            .select({ moment: ctx.conn.const(Temporal.Instant.from('2024-01-14T18:15:30.123456789+09:00'), 'instant') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select @0 as moment"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-14T09:15:30.123456789Z",
          ]
        `)
        assertType<Exact<typeof row, { moment: Temporal.Instant }>>()
        expect(row.moment.toString()).toBe('2024-01-14T09:15:30.1234568Z')
    })

    // NOT-SUPPORTED: SQL Server's dates start in the year 1
    /*
    test('an-instant-before-the-year-1', async () => {
        // The year -43 is 44 BC: there is no year 0
        ctx.mockNext({ old: '0044-03-15 09:15:30+00 BC' })
        const row = await ctx.conn.selectFromNoTable()
            .select({ old: ctx.conn.const(Temporal.Instant.from('-000043-03-15T09:15:30Z'), 'instant') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select @0 as old"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "-000043-03-15T09:15:30Z",
          ]
        `)
        expect(row.old.toString()).toBe('-000043-03-15T09:15:30Z')
    })
    */

    test('instants-inside-an-aggregated-array', async () => {
        ctx.mockNext([{ values: [{ instantAt: '2024-01-14T09:15:30.123456+00:00', wallAt: '2024-01-14T09:15:30.123456' }] }])
        const rows = await ctx.conn.selectFrom(tInstantValue)
            .where(tInstantValue.id.equals(1))
            .select({
                values: ctx.conn.aggregateAsArray({
                    instantAt: tInstantValue.instantAt,
                    wallAt: tInstantValue.wallAt,
                }),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select json_arrayagg(json_object('instantAt':instant_at, 'wallAt':wall_at)) as [values] from instant_value where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(rows.map(row => row.values.map(value => [value.instantAt.toString(), value.wallAt?.toString()]))).toEqual([[['2024-01-14T09:15:30.123456Z', '2024-01-14T09:15:30.123456Z']]])
    })

    test('the-current-instant', async () => {
        ctx.mockNext({ now: '2024-05-06 10:11:12.345678+00' })
        const row = await ctx.conn.selectFromNoTable()
            .select({ now: ctx.conn.currentInstant() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sysutcdatetime() as now"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { now: Temporal.Instant }>>()
        expect(row.now).toBeInstanceOf(Temporal.Instant)
    })
})
