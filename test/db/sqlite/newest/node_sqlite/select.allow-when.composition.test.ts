// `allowWhen` / `disallowWhen` propagation through SELECT-side compositions.
// The leaf `AllowWhenValueSource.__toSql` at
// [src/internal/ValueSourceImpl.ts:1688-1693](../../../../../src/internal/ValueSourceImpl.ts#L1688-L1693)
// is the *only* enforcement point — it throws during SQL construction when
// the gate is closed. Every composite shape that renders SQL recursively
// (subquery-as-value via `_inlineSelectAsValue`, CTE via `_buildSelect`,
// join.on / having / groupBy / orderBy via the usual `__toSql` recursion)
// inherits the throw automatically because each composite's own `__toSql`
// recurses into the gated leaf when it has to render it.
//
// These tests pin the user-visible defense-in-depth contract:
//
//   - **Favorable path** — when the gate is open (`allowWhen(true)` /
//     `disallowWhen(false)`) the wrapper is transparent: SQL builds, the
//     query runs, no throw. The emitted SQL is identical to what an
//     ungated equivalent would emit; the wrapper adds zero overhead. The
//     introspection walker reports the query as allowed.
//   - **Protection-fires path** — when the gate is closed and the gated
//     value is reached during render, building throws a
//     `TsSqlProcessingError` with `reason: 'DISALLOWED'` BEFORE any SQL
//     is dispatched to the driver. This is the runtime backstop the
//     `dynamicPick` + `allowWhen` security pattern relies on: even if
//     external input (HTTP query params, etc.) instructs the projection
//     to include a column the caller is not allowed to read, the
//     construction step refuses to produce a valid statement and the
//     promise rejects with the configured message — before the database
//     ever sees the column name. The introspection walker reports the
//     query as disallowed before the throw fires.
//
// See [`docs/queries/extreme-dynamic-queries.md` § Restrict access to
// values](../../../../../docs/queries/extreme-dynamic-queries.md#restrict-access-to-values)
// for the canonical pattern; the existing
// [`select.value-source.allow-when.test.ts`](./select.value-source.allow-when.test.ts)
// covers the bare value-source case. This file covers the *composite*
// paths: subquery-as-value, CTE-in-from, join.on, having, groupBy,
// orderBy. Mutations live in
// [`mutation.allow-when.test.ts`](./mutation.allow-when.test.ts).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { isQueryAllowed } from '../../../../lib/isAllowed.js'
import { dynamicPick } from '../../../../../src/dynamicCondition.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('subquery-as-value-allow-when-true-passes', async () => {
        // Subquery used as the RHS of `IN(...)` — the inner SELECT
        // renders via `_inlineSelectAsValue` → `_buildSelect`, which
        // recurses into every projected column's `__toSql`. The gated
        // `tProject.id.allowWhen(true, ...)` rides through that path
        // unchanged: open gate ⇒ transparent wrapper.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .where(tIssue.projectId.in(
                connection.selectFrom(tProject)
                    .selectOneColumn(tProject.id.allowWhen(true, 'project-id gated')),
            ))
            .select({ id: tIssue.id })
            .orderBy('id')

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where project_id in (select id as result from project) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('subquery-as-value-allow-when-false-throws', async () => {
        // Same composition, gate closed. The throw fires from the
        // leaf during the subquery's own render — it bubbles up through
        // `_inlineSelectAsValue` and the outer `_buildSelect` before
        // any SQL is dispatched.
        const connection = ctx.conn
        const query = connection.selectFrom(tIssue)
            .where(tIssue.projectId.in(
                connection.selectFrom(tProject)
                    .selectOneColumn(tProject.id.allowWhen(false, 'subquery-as-value gate blocks')),
            ))
            .select({ id: tIssue.id })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('subquery-as-value gate blocks')
    })

    test('correlated-subquery-exists-allow-when-false-throws', async () => {
        // `connection.exists(subSelectUsing(...).from(...))` renders the
        // correlated subquery inline. The gated column sits inside the
        // correlated body; its `__toSql` is reached during the outer
        // `_buildSelect`'s walk over the WHERE expression.
        const connection = ctx.conn
        const query = connection.selectFrom(tIssue)
            .where(connection.exists(
                connection.subSelectUsing(tIssue)
                    .from(tProject)
                    .where(tProject.id.equals(tIssue.projectId))
                    .selectOneColumn(tProject.id.allowWhen(false, 'correlated subquery gate blocks')),
            ))
            .select({ id: tIssue.id })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('correlated subquery gate blocks')
    })

    test('cte-using-gated-column-allow-when-true-passes', async () => {
        // A CTE built with `.forUseInQueryAs('open_issues')` renders via
        // `WithViewImpl` + `_buildSelect` of the inner select. The
        // gated `tIssue.id.allowWhen(true, ...)` rides through the
        // CTE body unchanged.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const openIssues = connection.selectFrom(tIssue)
            .select({ id: tIssue.id.allowWhen(true, 'cte gate') })
            .forUseInQueryAs('open_issues')

        const query = connection.selectFrom(openIssues)
            .select({ id: openIssues.id })
            .orderBy('id')

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with open_issues as (select id as id from issue) select id as id from open_issues order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('cte-using-gated-column-allow-when-false-throws', async () => {
        // Same CTE shape, gate closed. The throw originates in the CTE
        // body's render and propagates through `_buildSelect` of the
        // outer query.
        const connection = ctx.conn

        const openIssues = connection.selectFrom(tIssue)
            .select({ id: tIssue.id.allowWhen(false, 'cte body gate blocks') })
            .forUseInQueryAs('open_issues')

        const query = connection.selectFrom(openIssues)
            .select({ id: openIssues.id })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('cte body gate blocks')
    })

    test('join-on-allow-when-true-passes', async () => {
        // Join condition is itself a value source. Wrapping it in
        // `allowWhen(true, ...)` lets the SQL build transparently —
        // identical to the ungated join.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .innerJoin(tProject).on(tProject.id.equals(tIssue.projectId).allowWhen(true, 'join gate'))
            .select({ id: tIssue.id })
            .orderBy('id')

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id from issue inner join project on project.id = issue.project_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('join-on-allow-when-false-throws', async () => {
        // Closed gate on the join's ON expression. The build throws
        // when the SqlBuilder renders the FROM/JOIN section.
        const connection = ctx.conn
        const query = connection.selectFrom(tIssue)
            .innerJoin(tProject).on(tProject.id.equals(tIssue.projectId).allowWhen(false, 'join-on gate blocks'))
            .select({ id: tIssue.id })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('join-on gate blocks')
    })

    test('having-allow-when-true-passes', async () => {
        // HAVING expression is gated. Open gate ⇒ transparent.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .groupBy('id')
            .having(connection.count(tProject.id).greaterThan(0).allowWhen(true, 'having gate'))
            .orderBy('id')

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project group by id having count(id) > ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('having-allow-when-false-throws', async () => {
        // Closed gate on HAVING; throw fires when the HAVING expression
        // is appended during render.
        const connection = ctx.conn
        const query = connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .groupBy('id')
            .having(connection.count(tProject.id).greaterThan(0).allowWhen(false, 'having gate blocks'))

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('having gate blocks')
    })

    test('group-by-allow-when-false-throws', async () => {
        // GROUP BY entry is itself a value source. A gated column there
        // throws when the GROUP BY clause is rendered.
        const connection = ctx.conn
        const query = connection.selectFrom(tProject)
            .groupBy(tProject.organizationId.allowWhen(false, 'group-by gate blocks'))
            .select({ orgId: tProject.organizationId })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('group-by gate blocks')
    })

    test('order-by-allow-when-false-throws', async () => {
        // ORDER BY using `orderBy(valueSource)` — gated value source
        // throws on render. (The string-name overload sidesteps the
        // gate because it never sees the value source.)
        const connection = ctx.conn
        const query = connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .orderBy(tProject.organizationId.allowWhen(false, 'order-by gate blocks'))

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('order-by gate blocks')
    })

    test('dynamic-pick-through-subquery-with-gated-column-throws', async () => {
        // Security pattern in composite shape: an external `fieldsToPick`
        // (e.g. from an HTTP request) chooses to include a gated column
        // inside a derived/CTE-flavoured projection. The outer projection
        // looks innocuous; the gated column lives in an embedded
        // subquery-as-value used to compute the visible field. Even so,
        // build still throws — the protection composes through the
        // subquery boundary.
        const connection = ctx.conn
        const isAdmin = false // imagine: req.user.role !== 'admin'

        const availableFields = {
            id:    tProject.id,
            // The 'sensitiveCount' projection is gated; when the caller
            // is not admin and asks for it, the build refuses.
            sensitiveCount: connection.subSelectUsing(tProject)
                .from(tIssue)
                .where(tIssue.projectId.equals(tProject.id))
                .selectOneColumn(connection.count(tIssue.id).allowWhen(isAdmin, 'admin-only metric'))
                .forUseAsInlineQueryValue(),
        }

        const fieldsToPick = {
            id:             true,
            sensitiveCount: true, // attacker / misbehaving caller picks the gated column
        }
        const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

        const query = connection.selectFrom(tProject)
            .select(pickedFields)

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('admin-only metric')
    })

    test('dynamic-pick-not-selecting-gated-column-passes', async () => {
        // Same security pattern, but the caller does NOT pick the gated
        // column. The dynamicPick filters it out structurally before it
        // ever reaches the projection — no throw, no extra SQL, the gate
        // is silently inert. This is the typical happy path of the
        // documented pattern.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const isAdmin = false

        const availableFields = {
            id:    tProject.id,
            sensitiveCount: connection.subSelectUsing(tProject)
                .from(tIssue)
                .where(tIssue.projectId.equals(tProject.id))
                .selectOneColumn(connection.count(tIssue.id).allowWhen(isAdmin, 'admin-only metric'))
                .forUseAsInlineQueryValue(),
        }

        const fieldsToPick = { id: true } // caller did not request sensitiveCount
        const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

        const query = connection.selectFrom(tProject)
            .select(pickedFields)
            .orderBy('id')

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()
        // 4 projects in seed; mock returns whatever is queued.

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })
})
