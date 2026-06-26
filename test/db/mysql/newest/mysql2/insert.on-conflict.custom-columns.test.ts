// ON CONFLICT (cols) DO UPDATE over the branded custom columns, with the
// `doUpdateSet` RHS referencing the attempted-insert row via `valuesForInsert()`
// on `tProjectRelease`'s custom `channel` column.
//
// `onConflictOn(...).doUpdateSet(...)` is the PostgreSQL/SQLite inference-target
// form; MariaDB/MySQL use `ON DUPLICATE KEY UPDATE` and Oracle/SQL Server have
// no equivalent, so the test is commented out (NOT-APPLICABLE) in those cells.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: MySQL uses `ON DUPLICATE KEY UPDATE`, not `ON CONFLICT (cols) DO UPDATE`, so `onConflictOn(...)` is not typed on MySqlConnection.
    /*
    test('on-conflict-on-custom-columns-do-update-with-values-for-insert', async () => {
        // `project_release` has UNIQUE (project_id, version). Inserting project
        // 1 / version 1.2.0 collides with release 1 -> DO UPDATE SET the custom
        // `channel` column to the attempted-insert value via `valuesForInsert()`
        // (so the existing row's channel becomes 'beta').
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const affected = await ctx.conn.insertInto(tProjectRelease)
                .values({
                    projectId:  1,
                    version:    '1.2.0',
                    channel:    'beta',
                    releasedOn: new Date(Date.UTC(2024, 5, 1, 10, 0, 0)),
                    cutoffTime: new Date(Date.UTC(1970, 0, 1, 18, 0, 0)),
                })
                .onConflictOn(tProjectRelease.projectId, tProjectRelease.version)
                .doUpdateSet({ channel: tProjectRelease.valuesForInsert().channel })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project_release (project_id, version, channel, released_on, cutoff_time) values ($1, $2, $3, $4, $5) on conflict (project_id, version) do update set channel = excluded.channel"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "1.2.0",
                "beta",
                2024-06-01T10:00:00.000Z,
                "18:00:00",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) {
                expect(typeof affected).toBe('number')
                const channel = await ctx.conn.selectFrom(tProjectRelease)
                    .where(tProjectRelease.id.equals(1))
                    .selectOneColumn(tProjectRelease.channel)
                    .executeSelectOne()
                expect(channel).toBe('beta')
            } else {
                expect(affected).toBe(1)
            }
        })
    })
    */
})
