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
//      every dialect that supports `ON CONFLICT`. Dialects without
//      `ON CONFLICT` keep the test commented out for symmetry.

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) select ? as projectId, number as number, title as title, ? as status, priority as priority from issue where project_id = ?"`)
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

    test('insert-from-select-returning-full-row', async () => {
        // Multi-column RETURNING on a from-select. Pins the projection
        // shape coming out of `_buildInsertReturning` when paired with
        // `__from`. Project 3 has exactly one seeded issue (id=4,
        // 'Document /v2/users', number=1, priority=2), cloned with
        // status='draft' onto project 4 — every column except the
        // engine-assigned `id` is deterministic, so the unconditional
        // assertion checks those and just types `id` as a number.
        const expectedMock = [
            { id: 100, projectId: 4, number: 1, title: 'Document /v2/users', status: 'draft', priority: 2 },
        ]
        ctx.mockNext(expectedMock)

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

            const inserted = await ctx.conn.insertInto(tIssue)
                .from(source)
                .returning({
                    id:        tIssue.id,
                    projectId: tIssue.projectId,
                    number:    tIssue.number,
                    title:     tIssue.title,
                    status:    tIssue.status,
                    priority:  tIssue.priority,
                })
                .executeInsertMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) select ? as projectId, number as number, title as title, ? as status, priority as priority from issue where project_id = ? returning id as id, project_id as projectId, number as number, title as title, status as status, priority as priority"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
                "draft",
                3,
              ]
            `)
            assertType<Exact<typeof inserted, Array<{
                id:        number
                projectId: number
                number:    number
                title:     string
                status:    string
                priority:  number
            }>>>()
            expect(inserted).toHaveLength(1)
            const { id, ...rest } = inserted[0]!
            expect(typeof id).toBe('number')
            expect(rest).toEqual({ projectId: 4, number: 1, title: 'Document /v2/users', status: 'draft', priority: 2 })
        })
    })

    test('insert-from-select-source-with-cte', async () => {
        // The source SELECT exposes a CTE via `.forUseInQueryAs(...)`.
        // The expected SQL starts with `with active_projects as (...)`
        // because `__addWiths` walks through the select source and the
        // INSERT statement bubbles it up to the top level.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const activeProjects = ctx.conn.selectFrom(tProject)
                .where(tProject.archivedAt.isNull())
                .select({ id: tProject.id })
                .forUseInQueryAs('active_projects')

            const source = ctx.conn.selectFrom(tIssue)
                .innerJoin(activeProjects).on(activeProjects.id.equals(tIssue.projectId))
                .where(tIssue.projectId.equals(99999))
                .select({
                    projectId: tIssue.projectId,
                    number:    tIssue.number.add(1000),
                    title:     tIssue.title,
                    status:    ctx.conn.const('draft', 'string'),
                    priority:  tIssue.priority,
                })

            const affected = await ctx.conn.insertInto(tIssue)
                .from(source)
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"with active_projects as (select id as id from project where archived_at is null) insert into issue (project_id, number, title, status, priority) select issue.project_id as projectId, issue.number + ? as number, issue.title as title, ? as status, issue.priority as priority from issue inner join active_projects on active_projects.id = issue.project_id where issue.project_id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1000,
                "draft",
                99999,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(0)
            else expect(typeof affected).toBe('number')
        })
    })

    test('insert-from-select-with-on-conflict-do-nothing', async () => {
        // `CustomizableExecutableInsertFromSelectOnConflictOptional` —
        // ON CONFLICT chained off `from(select)`. Here the row source is
        // a select, so the builder uses the `__from` rendering branch and
        // *then* appends the ON CONFLICT suffix. Commented out where the
        // dialect has no ON CONFLICT clause.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) select organization_id as organizationId, slug as slug, name as name from project where organization_id = ? on conflict do nothing"`)
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
    test('insert-from-select-with-on-conflict-on-columns-do-nothing', async () => {
        // `from(select).onConflictOn(cols).doNothing()` — the TARGETED do-nothing
        // form. Targeted on-conflict is typed only on dialects with a conflict
        // target (PostgreSQL, SQLite); commented out elsewhere.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const source = ctx.conn.selectFrom(tProject)
                .where(tProject.organizationId.equals(1))
                .select({
                    organizationId: tProject.organizationId,
                    slug:           tProject.slug,
                    name:           tProject.name,
                })

            const affected = await ctx.conn.insertInto(tProject)
                .from(source)
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doNothing()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) select organization_id as organizationId, slug as slug, name as name from project where organization_id = ? on conflict (organization_id, slug) do nothing"`)
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

    test('insert-from-select-on-conflict-returning-last-id-and-one-column', async () => {
        // from-select + on-conflict + the `returningLastInsertedId()` and
        // `returningOneColumn(...)` array forms. The source matches no rows
        // (org 99999), so both return []. Commented out where on-conflict /
        // RETURNING is unavailable (RETURNING from a from-select is not typed on
        // oracle).
        await ctx.withRollback(async () => {
            const source = () => ctx.conn.selectFrom(tProject)
                .where(tProject.organizationId.equals(99999))
                .select({ organizationId: tProject.organizationId, slug: tProject.slug, name: tProject.name })

            ctx.mockNext([])
            const ids = await ctx.conn.insertInto(tProject)
                .from(source())
                .onConflictDoNothing()
                .returningLastInsertedId()
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) select organization_id as organizationId, slug as slug, name as name from project where organization_id = ? on conflict do nothing returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                99999,
              ]
            `)
            assertType<Exact<typeof ids, number[]>>()
            expect(ids).toEqual([])

            ctx.mockNext([])
            const oneCol = await ctx.conn.insertInto(tProject)
                .from(source())
                .onConflictDoNothing()
                .returningOneColumn(tProject.id)
                .executeInsertMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) select organization_id as organizationId, slug as slug, name as name from project where organization_id = ? on conflict do nothing returning id as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                99999,
              ]
            `)
            assertType<Exact<typeof oneCol, number[]>>()
            expect(oneCol).toEqual([])
        })
    })

})
