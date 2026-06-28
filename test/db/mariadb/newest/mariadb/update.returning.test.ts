// Coverage of `UPDATE ... RETURNING` / `OUTPUT inserted.*` paths.
//
// Each mutation runs inside `ctx.withRollback(...)`. Snapshots can be
// refreshed with `bun run tests <cell> --use-vitest -u`.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('update-returning-one-row', async () => {
        const expectedMock = { id: 1, title: 'Patched', priority: 5 }
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
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

            if (ctx.realDbEnabled) {
                expect(row.id).toBe(1)
                expect(row.title).toBe('Patched')
                expect(row.priority).toBe(5)
            } else {
                expect(row).toEqual(expectedMock)
            }
        })
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('update-returning-one-column', async () => {
        ctx.mockNext('Renamed Acme')

        await ctx.withRollback(async () => {
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
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('update-returning-many', async () => {
        // Update every issue with priority 1 and return one row per
        // touched record. Exercises `executeUpdateMany`.
        const expectedMock = [
            { id: 1, title: 'Bumped 1' },
            { id: 2, title: 'Bumped 2' },
        ]
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
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

            if (!ctx.realDbEnabled) expect(rows).toEqual(expectedMock)
            else expect(Array.isArray(rows)).toBe(true)
        })
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('update-returning-projecting-optional-values-as-nullable', async () => {
        // optional RETURNING columns become a present `| null` via
        // `projectingOptionalValuesAsNullable()` on an UPDATE builder. issue 3
        // has body = NULL, so the returned value is null (present), not absent.
        const expectedMock = { id: 3, body: null }
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const updated = await ctx.conn.update(tIssue)
                .set({ status: 'in_progress' })
                .where(tIssue.id.equals(3))
                .returning({ id: tIssue.id, body: tIssue.body })
                .projectingOptionalValuesAsNullable()
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof updated, { id: number; body: string | null }>>()
            expect(updated).toEqual({ id: 3, body: null })
        })
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('update-returning-object-none-or-one', async () => {
        // `executeUpdateNoneOrOne()` with an OBJECT-shape returning yields
        // `{...} | null`. Only the single-column branch (returningOneColumn) was
        // asserted for UPDATE noneOrOne; INSERT and DELETE both cover their
        // object noneOrOne — this pins the UPDATE object noneOrOne arm. Issue 1
        // exists, so the update matches exactly one row and returns it (the
        // `| null` arm is the type promise the None case would take).
        const expectedMock = { id: 1, title: 'Reordered' }
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tIssue)
                .set({ title: 'Reordered' })
                .where(tIssue.id.equals(1))
                .returning({ id: tIssue.id, title: tIssue.title })
                .executeUpdateNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof row, { id: number; title: string } | null>>()
            expect(row).toEqual(expectedMock)
        })
    })
    */
})
