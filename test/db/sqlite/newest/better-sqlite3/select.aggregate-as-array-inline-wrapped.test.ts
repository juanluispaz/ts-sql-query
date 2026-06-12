// Coverage of `_appendAggragateArrayWrappedColumns` — reached when an
// inline aggregate subquery (`forUseAsInlineAggregatedArrayValue()`)
// also carries `group by`, `having`, a compound operator, or — on
// engines that don't support `order by` / `limit` inside the aggregate
// function — those clauses too. `_needAgggregateArrayWrapper` returns
// true and the builder wraps the inner select with the dialect's
// "select aggregate from (subquery)" form.
//
// The existing docs.aggregate-as-object-array tests exercise the
// non-wrapped path. Adding the wrapped path here lights up:
//   - AbstractMySqlMariaBDSqlBuilder._appendAggragateArrayWrappedColumns
//     (MariaDB falls through to it; MySQL overrides)
//   - the wrapped branch in every other dialect's override
//
// The JSON returned from the real DB is a string re-parsed by the type
// adapter back into the typed array; SQLite executes the wrapped
// compound-inside-aggregate form, so the value assertion runs in both
// modes. `json_group_array` order isn't guaranteed, so the array is
// sorted by id before comparing.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('inline-aggregate-of-object-with-group-by', async () => {
        // Inline aggregate carrying its own `group by` — forces the
        // wrap (`group by` ≠ identity over the subquery), so the builder
        // wraps the grouped select with the dialect's aggregate-over-
        // subquery form.
        const expected = {
            id: 1, name: 'Acme Corp',
            projectStats: [
                { id: 1, count: 2 },
                { id: 2, count: 1 },
            ],
        }
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projectStats: JSON.stringify([
                { id: 1, count: 2 },
                { id: 2, count: 1 },
            ]),
        })
        const projectStats = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({
                id:    tProject.id,
                count: ctx.conn.count(tIssue.id),
            })
            .groupBy('id')
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:           tOrganization.id,
                name:         tOrganization.name,
                projectStats,
            })
            .executeSelectOne()
        assertType<Exact<typeof row, {
            id:           number
            name:         string
            projectStats: Array<{ id: number; count: number }>
        }>>()
        // json_group_array order is not guaranteed; sort by id before comparing.
        row.projectStats.sort((a, b) => a.id - b.id)
        expect(row).toEqual(expected)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select json_group_array(json_object('id', a_1_.id, 'count', a_1_.count)) from (select project.id as id, count(issue.id) as count from project inner join issue on issue.project_id = project.id where project.organization_id = organization.id group by project.id) as a_1_) as projectStats from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })

    test('inline-aggregate-of-object-with-having', async () => {
        // `having` is one of the wrap triggers in
        // `_needAgggregateArrayWrapper`. A `group by` is required before
        // a `having` clause, so the query carries both.
        const expected = {
            id: 1, name: 'Acme Corp',
            busyProjects: [{ id: 1, count: 2 }],
        }
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            busyProjects: JSON.stringify([{ id: 1, count: 2 }]),
        })
        const busyProjects = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({
                id:    tProject.id,
                count: ctx.conn.count(tIssue.id),
            })
            .groupBy('id')
            .having(ctx.conn.count(tIssue.id).greaterThan(1))
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:           tOrganization.id,
                name:         tOrganization.name,
                busyProjects,
            })
            .executeSelectOne()
        assertType<Exact<typeof row, {
            id:           number
            name:         string
            busyProjects: Array<{ id: number; count: number }>
        }>>()
        // Only project 1 (2 issues) passes `having count > 1`; single
        // deterministic element, but sort by id for safety.
        row.busyProjects.sort((a, b) => a.id - b.id)
        expect(row).toEqual(expected)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select json_group_array(json_object('id', a_1_.id, 'count', a_1_.count)) from (select project.id as id, count(issue.id) as count from project inner join issue on issue.project_id = project.id where project.organization_id = organization.id group by project.id having count(issue.id) > ?) as a_1_) as busyProjects from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
    })
    test('inline-aggregate-use-empty-array-for-no-value-explicit', async () => {
        // `forUseAsInlineAggregatedArrayValue()` already defaults to a
        // required array; `useEmptyArrayForNoValue()` on the inline value
        // source (ValueSourceImpl.ts:2140) is the explicit form. SQL is
        // unchanged — the modifier only pins the result shape.
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projects: JSON.stringify([
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ]),
        })
        const orgProjects = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .forUseAsInlineAggregatedArrayValue()
            .useEmptyArrayForNoValue()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:       tOrganization.id,
                name:     tOrganization.name,
                projects: orgProjects,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select json_group_array(json_object('id', a_1_.id, 'name', a_1_.name)) from (select id as id, name as name from project where organization_id = organization.id order by id) as a_1_) as projects from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:       number
            name:     string
            projects: Array<{ id: number; name: string }>
        }>>()
        expect(row).toEqual({
            id: 1, name: 'Acme Corp',
            projects: [
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ],
        })
    })

    test('inline-aggregate-as-optional-non-empty-array', async () => {
        // `asOptionalNonEmptyArray()` on the inline value source
        // (ValueSourceImpl.ts:2143) → `projects?: ...` — when the
        // subquery aggregates no rows, `projects` is absent.
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projects: JSON.stringify([
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ]),
        })
        const orgProjects = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .forUseAsInlineAggregatedArrayValue()
            .asOptionalNonEmptyArray()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:       tOrganization.id,
                name:     tOrganization.name,
                projects: orgProjects,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select json_group_array(json_object('id', a_1_.id, 'name', a_1_.name)) from (select id as id, name as name from project where organization_id = organization.id order by id) as a_1_) as projects from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:        number
            name:      string
            projects?: Array<{ id: number; name: string }>
        }>>()
        expect(row).toEqual({
            id: 1, name: 'Acme Corp',
            projects: [
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ],
        })
    })

    test('inline-aggregate-only-when-or-null-true-is-passthrough', async () => {
        // `onlyWhenOrNull(true)` returns `this` (ValueSourceImpl.ts:2150);
        // the type signature still widens to optional so the call is a
        // type-only pass-through. SQL is unchanged.
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projects: JSON.stringify([
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ]),
        })
        const orgProjects = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .forUseAsInlineAggregatedArrayValue()
            .onlyWhenOrNull(true)

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:       tOrganization.id,
                name:     tOrganization.name,
                projects: orgProjects,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select json_group_array(json_object('id', a_1_.id, 'name', a_1_.name)) from (select id as id, name as name from project where organization_id = organization.id order by id) as a_1_) as projects from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:        number
            name:      string
            projects?: Array<{ id: number; name: string }>
        }>>()
        expect(row).toEqual({
            id: 1, name: 'Acme Corp',
            projects: [
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ],
        })
    })

    test('inline-aggregate-ignore-when-as-null-false-is-passthrough', async () => {
        // `ignoreWhenAsNull(false)` returns `this`
        // (ValueSourceImpl.ts:2159). Type widens to optional; SQL is
        // unchanged.
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projects: JSON.stringify([
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ]),
        })
        const orgProjects = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .forUseAsInlineAggregatedArrayValue()
            .ignoreWhenAsNull(false)

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:       tOrganization.id,
                name:     tOrganization.name,
                projects: orgProjects,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select json_group_array(json_object('id', a_1_.id, 'name', a_1_.name)) from (select id as id, name as name from project where organization_id = organization.id order by id) as a_1_) as projects from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:        number
            name:      string
            projects?: Array<{ id: number; name: string }>
        }>>()
        expect(row).toEqual({
            id: 1, name: 'Acme Corp',
            projects: [
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ],
        })
    })

    test('null-inline-aggregate-then-use-empty-array-for-no-value', async () => {
        // `onlyWhenOrNull(false)` swaps in NullAggregateSelectValueSource;
        // chaining `useEmptyArrayForNoValue()` exercises that modifier on
        // the Null class (ValueSourceImpl.ts:2257). The subquery collapses
        // to literal `null`; the result is the empty array.
        ctx.mockNext({ id: 1, name: 'Acme Corp', projects: null })
        const orgProjects = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .forUseAsInlineAggregatedArrayValue()
            .onlyWhenOrNull(false)
            .useEmptyArrayForNoValue()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:       tOrganization.id,
                name:     tOrganization.name,
                projects: orgProjects,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, null as projects from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:       number
            name:     string
            projects: Array<{ id: number; name: string }>
        }>>()
        expect(row).toEqual({ id: 1, name: 'Acme Corp', projects: [] })
    })

    test('null-inline-aggregate-then-as-optional-non-empty-array', async () => {
        // The Null variant + `asOptionalNonEmptyArray()`
        // (ValueSourceImpl.ts:2260). The subquery collapses to literal
        // `null`; `projects` is absent in the result.
        ctx.mockNext({ id: 1, name: 'Acme Corp', projects: null })
        const orgProjects = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .forUseAsInlineAggregatedArrayValue()
            .onlyWhenOrNull(false)
            .asOptionalNonEmptyArray()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:       tOrganization.id,
                name:     tOrganization.name,
                projects: orgProjects,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, null as projects from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:        number
            name:      string
            projects?: Array<{ id: number; name: string }>
        }>>()
        expect(row).toEqual({ id: 1, name: 'Acme Corp' })
    })

    test('inline-aggregate-as-required-in-optional-object', async () => {
        // `asRequiredInOptionalObject()` on the inline-aggregate value
        // source (ValueSourceImpl.ts:2145 —
        // AggregateSelectValueSource.asRequiredInOptionalObject) makes the
        // subquery the gate of an optional inner object. If the subquery
        // aggregates no rows, json_agg returns NULL and the inner
        // `meta` object is dropped from the row.
        ctx.mockNext([
            { pid: 3, 'meta.issues': [{ id: 4, title: 'Document /v2/users' }] },
            { pid: 4, 'meta.issues': null },
        ])
        const projectIssues = ctx.conn.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy('id')
            .forUseAsInlineAggregatedArrayValue()
            .asRequiredInOptionalObject()

        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.organizationId.equals(2))
            .select({
                pid: tProject.id,
                meta: { issues: projectIssues },
            })
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as pid, (select json_group_array(json_object('id', a_1_.id, 'title', a_1_.title)) from (select id as id, title as title from issue where project_id = project.id order by id) as a_1_) as "meta.issues" from project where organization_id = ? order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:   number
            meta?: { issues: Array<{ id: number; title: string }> }
        }>>>()
        expect(rows).toEqual([
            { pid: 3, meta: { issues: [{ id: 4, title: 'Document /v2/users' }] } },
            { pid: 4 },
        ])
    })

    test('null-inline-aggregate-as-required-in-optional-object', async () => {
        // The Null variant — chaining `onlyWhenOrNull(false)` swaps in
        // `NullAggregateSelectValueSource`; chaining
        // `asRequiredInOptionalObject()` exercises
        // ValueSourceImpl.ts:2262
        // (NullAggregateSelectValueSource.asRequiredInOptionalObject).
        // The whole expression collapses to literal `null`, so `meta` is
        // always absent.
        ctx.mockNext([
            { pid: 3, 'meta.issues': null },
            { pid: 4, 'meta.issues': null },
        ])
        const projectIssues = ctx.conn.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy('id')
            .forUseAsInlineAggregatedArrayValue()
            .onlyWhenOrNull(false)
            .asRequiredInOptionalObject()

        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.organizationId.equals(2))
            .select({
                pid: tProject.id,
                meta: { issues: projectIssues },
            })
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as pid, null as "meta.issues" from project where organization_id = ? order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:   number
            meta?: { issues: Array<{ id: number; title: string }> }
        }>>>()
        expect(rows).toEqual([{ pid: 3 }, { pid: 4 }])
    })

    // NOT-APPLICABLE: only MariaDB supports ORDER BY inside `json_arrayagg(...)`
    // for inline aggregated arrays; SQLite wraps the subquery, so the order-by
    // lives there instead. Bodies kept commented for cross-cell diff parity.
    /*
    test('inline-aggregate-mariadb-order-by-asc-nulls-last-emits-is-null-then-asc', async () => {
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projectNames: JSON.stringify(['Internal tools', 'Marketing site']),
        })
        const orgNames = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .selectOneColumn(tProject.name)
            .orderBy('result', 'asc nulls last')
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:           tOrganization.id,
                projectNames: orgNames,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof row, {
            id:           number
            projectNames: string[]
        }>>()
        expect(row).toEqual({ id: 1, projectNames: ['Internal tools', 'Marketing site'] })
    })

    test('inline-aggregate-mariadb-order-by-desc-nulls-first-emits-is-not-null-then-desc', async () => {
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projectNames: JSON.stringify(['Marketing site', 'Internal tools']),
        })
        const orgNames = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .selectOneColumn(tProject.name)
            .orderBy('result', 'desc nulls first')
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:           tOrganization.id,
                projectNames: orgNames,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof row, {
            id:           number
            projectNames: string[]
        }>>()
        expect(row).toEqual({ id: 1, projectNames: ['Marketing site', 'Internal tools'] })
    })

    test('inline-aggregate-mariadb-order-by-asc-insensitive-falls-through-without-collation', async () => {
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projectNames: JSON.stringify(['Internal tools', 'Marketing site']),
        })
        const orgNames = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .selectOneColumn(tProject.name)
            .orderBy('result', 'asc insensitive')
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:           tOrganization.id,
                projectNames: orgNames,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof row, {
            id:           number
            projectNames: string[]
        }>>()
        expect(row).toEqual({ id: 1, projectNames: ['Internal tools', 'Marketing site'] })
    })

    test('inline-aggregate-mariadb-order-by-asc-nulls-last-insensitive-combines-is-null-and-insensitive-expression', async () => {
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projectNames: JSON.stringify(['Internal tools', 'Marketing site']),
        })
        const orgNames = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .selectOneColumn(tProject.name)
            .orderBy('result', 'asc nulls last insensitive')
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:           tOrganization.id,
                projectNames: orgNames,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof row, {
            id:           number
            projectNames: string[]
        }>>()
        expect(row).toEqual({ id: 1, projectNames: ['Internal tools', 'Marketing site'] })
    })
    */


})
