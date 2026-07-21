// SQL Server-only: the aggregated-array JSON built by the manual `string_agg` /
// `string_escape` fallback that runs on `compatibilityVersion < 17_000_000` (every SQL
// Server <= 2022), instead of the native `json_arrayagg` used from 17M (2025). The fallback
// is reached here through a `DBConnection` constructed with `compatibilityVersion = 16_000_000`
// that SHARES `ctx.conn`'s capturing real runner, so the emitted SQL is captured and runs
// against the real engine. A dedicated cell for an older compatibility version would be the
// heavier alternative; this pins the one path the newest cell never emits.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { DBConnection, tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('string_agg JSON fallback keeps a double lossless (convert style 3)', async () => {
        // FINDING B: the manual builder converts a `float` leaf to text. A styleless convert keeps
        // only <=6 significant figures (123.456789 -> 123.457, silently wrong); style 3 is the only
        // lossless float->text. The scientific form it emits is a valid JSON number, restored exactly
        // by the lossless parser. `tIssue.estimatedHours` is `optionalColumn('double')` — seeded NULL,
        // so UPDATE issue 1 inside withRollback to a value that needs > 6 significant figures.
        const old = new DBConnection(ctx.conn.queryRunner, 16_000_000)
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 123.456789 }).where(tIssue.id.equals(1)).executeUpdate()

            ctx.mockNext([{ id: 1, hours: [123.456789] }])
            const rows = await old.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({
                    id:    tIssue.id,
                    hours: old.aggregateAsArrayOfOneColumn(tIssue.estimatedHours),
                })
                .groupBy('id')
                .executeSelectMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, concat('[', string_agg(isnull(convert(nvarchar, estimated_hours, 3), 'null'), ','), ']') as hours from issue where id = @0 group by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof rows, Array<{ id: number; hours: number[] }>>>()
            expect(rows).toEqual([{ id: 1, hours: [123.456789] }])
        })
    })
})
