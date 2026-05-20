// Coverage of `UPDATE ... RETURNING` / `OUTPUT inserted.*` paths.
// Lights up `_buildUpdateReturning` (PostgreSQL/MariaDB/SQLite),
// `_buildUpdateOutput` (SqlServer) and Oracle's `RETURNING ... INTO`
// override. MySQL has no equivalent, so its cell keeps the test
// commented out for symmetry.
//
// Each mutation runs inside `ctx.withRollback(...)`. Snapshots can be
// refreshed with `bun run tests:focus <cell> --use-vitest -u`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // TODO[BUG]: see test/BUGS.md — `UPDATE ... RETURNING` was added in
    // MariaDB 13.0.1 ([MDEV-5092](https://jira.mariadb.org/browse/MDEV-5092)),
    // but the lib emits it on every `MariaDBConnection` regardless of
    // `compatibilityVersion`. The `mariadb:latest` testcontainer (12.x) parses
    // the statement and rejects with `ER_PARSE_ERROR: syntax error near
    // 'returning ...'`. Until the lib gates emission by version (or the test
    // container moves to MariaDB 13.0.1+) we exercise the SQL emission via the
    // mock pass and skip real-DB execution for the three tests below.

    test('update-returning-one-row', async () => {
        const expectedMock = { id: 1, title: 'Patched', priority: 5 }
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            if (ctx.realDbEnabled) return

            const row = await ctx.conn.update(tIssue)
                .set({ title: 'Patched', priority: 5 })
                .where(tIssue.id.equals(1))
                .returning({
                    id:       tIssue.id,
                    title:    tIssue.title,
                    priority: tIssue.priority,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ?, priority = ? where id = ? returning id as id, title as title, priority as priority"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Patched",
                5,
                1,
              ]
            `)
            assertType<Exact<typeof row, {
                id:       number
                title:    string
                priority: number
            }>>()

            expect(row).toEqual(expectedMock)
        })
    })

    test('update-returning-one-column', async () => {
        ctx.mockNext('Renamed Acme')

        await ctx.withRollback(async () => {
            if (ctx.realDbEnabled) return

            const newName = await ctx.conn.update(tOrganization)
                .set({ name: 'Renamed Acme' })
                .where(tOrganization.id.equals(1))
                .returningOneColumn(tOrganization.name)
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update organization set name = ? where id = ? returning name as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Renamed Acme",
                1,
              ]
            `)
            assertType<Exact<typeof newName, string>>()

            expect(newName).toBe('Renamed Acme')
        })
    })

    test('update-returning-many', async () => {
        // Update every issue with priority 1 and return one row per
        // touched record. Exercises `executeUpdateMany`.
        const expectedMock = [
            { id: 1, title: 'Bumped 1' },
            { id: 2, title: 'Bumped 2' },
        ]
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            if (ctx.realDbEnabled) return

            const rows = await ctx.conn.update(tIssue)
                .set({ priority: 9 })
                .where(tIssue.priority.equals(1))
                .returning({
                    id:    tIssue.id,
                    title: tIssue.title,
                })
                .executeUpdateMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set priority = ? where priority = ? returning id as id, title as title"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                9,
                1,
              ]
            `)
            assertType<Exact<typeof rows, Array<{ id: number; title: string }>>>()

            expect(rows).toEqual(expectedMock)
        })
    })
})
