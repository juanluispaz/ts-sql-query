// Extra coverage for `INSERT ... SELECT` (the `.from(select)` path on
// `InsertQueryBuilder`). The existing `insert.from-select.test.ts`
// only pins the canonical `executeInsertMany` + `returning({ id })`
// branch; this file walks the remaining code paths reached through
// `_buildInsertFromSelect`:
//
//   1. `.executeInsert()` (no returning) — exercises the count-only
//      branch of `InsertQueryBuilder.executeInsert` when `__from` is
//      set. Distinct from the single-row VALUES path that calls
//      `executeInsertReturningLastInsertedId`.
//   2. `.returning({ ...full row })` on `from(select)` — pins the
//      multi-column projection of the RETURNING clause when the source
//      is a select (mock returns the row shape).
//   3. Source carries its own `WITH cte AS (...)` — exercises the
//      `__addWiths` walk through the select source so the CTE bubbles
//      up to the outer INSERT statement.
//   4. `.from(select).onConflictDoNothing()` — exercises
//      `CustomizableExecutableInsertFromSelectOnConflictOptional` on
//      every dialect that supports `ON CONFLICT` (postgres / sqlite /
//      mariadb / mysql). Oracle and SQL Server keep the test commented
//      out for symmetry — see those cells.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('insert-from-select-without-returning', async () => {
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const source = ctx.conn.selectFrom(tIssue)
                .where(tIssue.projectId.equals(3))
                .select({
                    projectId: ctx.conn.const(4, 'int'),
                    number:    tIssue.number,
                    title:     tIssue.title,
                    status:    ctx.conn.const('draft', 'string'),
                    priority:  tIssue.priority,
                })

            const affected = await ctx.conn.insertInto(tIssue)
                .from(source)
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, \`number\`, title, \`status\`, priority) select ? as projectId, \`number\` as \`number\`, title as title, ? as \`status\`, priority as priority from issue where project_id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
                "draft",
                3,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(2)
            else expect(typeof affected).toBe('number')
        })
    })

    // `insertInto(t).from(source)` does not expose `.returning(...)`
    // here. The library mirrors that by not typing the method on the
    // mysql `CustomizableExecutableInsertFromSelect` surface, so the
    // canonical body would not compile. See the canonical cell for the
    // full body.
    // NOT-APPLICABLE: MySQL has no RETURNING — the from-select insert surface does not type `.returning(...)`.
    /*
    test('insert-from-select-returning-full-row', async () => {
        // ... see other cells for the full body — uses `.returning({...})`
        // which is not typed on MySqlConnection's from-select insert.
    })
    */

    // MySQL accepts CTEs inside a SELECT but not as the prefix of an
    // INSERT statement. See other cells for the canonical body.
    // NOT-APPLICABLE: MySQL rejects the `WITH cte AS (...) INSERT INTO ... SELECT ...` form (parse error at `insert`).
    /*
    test('insert-from-select-source-with-cte', async () => {
        // ... see other cells for the full body — pins the bubbled
        // `with active_projects as (...) insert into issue ...`.
    })
    */

    test('insert-from-select-with-on-conflict-do-nothing', async () => {
        // `CustomizableExecutableInsertFromSelectOnConflictOptional` —
        // ON CONFLICT chained off `from(select)`. Distinct from the
        // VALUES-based on-conflict in `insert.on-conflict.test.ts`;
        // here the row source is a select, so the SqlBuilder uses the
        // `__from` rendering branch and *then* appends the ON CONFLICT
        // suffix. Comment-out cells: Oracle / SQL Server (no ON
        // CONFLICT in the dialect).
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            // Try to clone every project as `(orgId=org, slug=existing-slug)`
            // — the unique (org, slug) constraint would fire, but
            // DO NOTHING swallows it.
            const source = ctx.conn.selectFrom(tProject)
                .where(tProject.organizationId.equals(1))
                .select({
                    organizationId: tProject.organizationId,
                    slug:           tProject.slug,
                    name:           tProject.name,
                })

            const affected = await ctx.conn.insertInto(tProject)
                .from(source)
                .onConflictDoNothing()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert ignore into project (organization_id, slug, \`name\`) select organization_id as organizationId, slug as slug, \`name\` as \`name\` from project where organization_id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(0)
            else expect(typeof affected).toBe('number')
        })
    })
})
