// Coverage of `_appendAggragateArrayWrappedColumns` — reached when an
// inline aggregate subquery (`forUseAsInlineAggregatedArrayValue()`)
// also carries `group by`, `having`, a compound operator, or — on
// engines that don't support `order by` / `limit` inside the aggregate
// function — those clauses too. `_needAgggregateArrayWrapper` returns
// true and the builder wraps the inner select with the dialect's
// "select aggregate from (subquery)" form.
//
// The existing docs.aggregate-as-object-array tests exercise the
// non-wrapped path. Adding the wrapped path here lights up the wrapped
// branch in the SQL Server builder: a `for json path` subquery whose
// inner select carries `group by` / `having`. The JSON the real DB
// returns is re-parsed by the type adapter into the same shape the mock
// supplies.

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
        expect(row).toEqual(expected)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select project.id as id, count(issue.id) as [count] from project inner join issue on issue.project_id = project.id where project.organization_id = organization.id group by project.id for json path) as projectStats from organization where id = @0"`)
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
        expect(row).toEqual(expected)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select project.id as id, count(issue.id) as [count] from project inner join issue on issue.project_id = project.id where project.organization_id = organization.id group by project.id having count(issue.id) > @0 for json path) as busyProjects from organization where id = @1"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select id as id, name as name from project where organization_id = organization.id order by id offset 0 rows for json path) as projects from organization where id = @0"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select id as id, name as name from project where organization_id = organization.id order by id offset 0 rows for json path) as projects from organization where id = @0"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select id as id, name as name from project where organization_id = organization.id order by id offset 0 rows for json path) as projects from organization where id = @0"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select id as id, name as name from project where organization_id = organization.id order by id offset 0 rows for json path) as projects from organization where id = @0"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, null as projects from organization where id = @0"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, null as projects from organization where id = @0"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as pid, (select id as id, title as title from issue where project_id = project.id order by id offset 0 rows for json path) as [meta.issues] from project where organization_id = @0 order by pid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as pid, null as [meta.issues] from project where organization_id = @0 order by pid"`)
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

    // SQL Server wraps the inline aggregated-array subquery, so the
    // order-by lives in the wrapper, not inside the aggregate function
    // (only MariaDB keeps ORDER BY inside `json_arrayagg(...)`). Bodies
    // copied verbatim from the canonical mariadb cell for parity.
    test('inline-aggregate-order-by-asc-nulls-last', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (select json_arrayagg(a_1_.[result] null on null) from (select name as [result] from project where organization_id = organization.id order by iif(project.name is null, 1, 0), [result] asc offset 0 rows) as a_1_) as projectNames from organization where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:           number
            projectNames: string[]
        }>>()
        expect(row).toEqual({ id: 1, projectNames: ['Internal tools', 'Marketing site'] })
    })

    // SQL Server wraps the inline aggregated-array subquery, so the
    // order-by lives in the wrapper, not inside the aggregate function
    // (only MariaDB keeps ORDER BY inside `json_arrayagg(...)`). Bodies
    // copied verbatim from the canonical mariadb cell for parity.
    test('inline-aggregate-order-by-desc-nulls-first', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (select json_arrayagg(a_1_.[result] null on null) from (select name as [result] from project where organization_id = organization.id order by iif(project.name is not null, 1, 0), [result] desc offset 0 rows) as a_1_) as projectNames from organization where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:           number
            projectNames: string[]
        }>>()
        expect(row).toEqual({ id: 1, projectNames: ['Marketing site', 'Internal tools'] })
    })

    // SQL Server wraps the inline aggregated-array subquery, so the
    // order-by lives in the wrapper, not inside the aggregate function
    // (only MariaDB keeps ORDER BY inside `json_arrayagg(...)`). Bodies
    // copied verbatim from the canonical mariadb cell for parity.
    test('inline-aggregate-order-by-asc-insensitive', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (select json_arrayagg(a_1_.[result] null on null) from (select name as [result] from project where organization_id = organization.id order by lower(name) asc offset 0 rows) as a_1_) as projectNames from organization where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:           number
            projectNames: string[]
        }>>()
        expect(row).toEqual({ id: 1, projectNames: ['Internal tools', 'Marketing site'] })
    })

    // SQL Server wraps the inline aggregated-array subquery, so the
    // order-by lives in the wrapper, not inside the aggregate function
    // (only MariaDB keeps ORDER BY inside `json_arrayagg(...)`). Bodies
    // copied verbatim from the canonical mariadb cell for parity.
    test('inline-aggregate-order-by-asc-nulls-last-insensitive', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (select json_arrayagg(a_1_.[result] null on null) from (select name as [result] from project where organization_id = organization.id order by iif(project.name is null, 1, 0), lower(name) asc offset 0 rows) as a_1_) as projectNames from organization where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:           number
            projectNames: string[]
        }>>()
        expect(row).toEqual({ id: 1, projectNames: ['Internal tools', 'Marketing site'] })
    })


})
