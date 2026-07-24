// Coverage of the inline-aggregate wrapped path — reached when an
// inline aggregate subquery (`forUseAsInlineAggregatedArrayValue()`)
// also carries `group by`, `having`, or a compound operator, forcing the
// builder to wrap the inner select with the "select aggregate from
// (subquery)" form.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tOrganization, tProject, tProjectRelease, type ReleaseChannel } from '../../domain/connection.js'
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
        // org 1 owns projects 1 (issues 1,2 → count 2) and 2 (issue 3 → count 1).
        // The inner the array aggregate has no order by, so sort by id before comparing.
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
        expect({ ...row, projectStats: [...row.projectStats].sort((a, b) => a.id - b.id) }).toEqual({
            id: 1, name: 'Acme Corp',
            projectStats: [
                { id: 1, count: 2 },
                { id: 2, count: 1 },
            ],
        })
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, ((select json_agg(json_build_object('id', a_1_.id, 'count', a_1_.count)) from (select project.id as id, count(issue.id) as count from project inner join issue on issue.project_id = project.id where project.organization_id = organization.id group by project.id) as a_1_))::text as "projectStats" from organization where id = $1"`)
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
        // Only project 1 has more than one issue (count 2), so having count>1
        // leaves a single grouped row.
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
        expect(row).toEqual({
            id: 1, name: 'Acme Corp',
            busyProjects: [{ id: 1, count: 2 }],
        })
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, ((select json_agg(json_build_object('id', a_1_.id, 'count', a_1_.count)) from (select project.id as id, count(issue.id) as count from project inner join issue on issue.project_id = project.id where project.organization_id = organization.id group by project.id having count(issue.id) > $1) as a_1_))::text as "busyProjects" from organization where id = $2"`)
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
        // source is the explicit form. SQL is
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, ((select json_agg(json_build_object('id', a_1_.id, 'name', a_1_.name)) from (select id as id, name as name from project where organization_id = organization.id order by id) as a_1_))::text as projects from organization where id = $1"`)
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
        // → `projects?: ...` — when the
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, ((select json_agg(json_build_object('id', a_1_.id, 'name', a_1_.name)) from (select id as id, name as name from project where organization_id = organization.id order by id) as a_1_))::text as projects from organization where id = $1"`)
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
        // `onlyWhenOrNull(true)` returns `this`;
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, ((select json_agg(json_build_object('id', a_1_.id, 'name', a_1_.name)) from (select id as id, name as name from project where organization_id = organization.id order by id) as a_1_))::text as projects from organization where id = $1"`)
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
        // Type widens to optional; SQL is
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, ((select json_agg(json_build_object('id', a_1_.id, 'name', a_1_.name)) from (select id as id, name as name from project where organization_id = organization.id order by id) as a_1_))::text as projects from organization where id = $1"`)
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
        // the Null class. The subquery collapses
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (null)::text as projects from organization where id = $1"`)
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
        // The subquery collapses to literal
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (null)::text as projects from organization where id = $1"`)
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
        // source (—
        // AggregateSelectValueSource.asRequiredInOptionalObject) makes the
        // subquery the gate of an optional inner object. If the subquery
        // aggregates no rows, the array aggregate returns NULL and the inner
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as pid, ((select json_agg(json_build_object('id', a_1_.id, 'title', a_1_.title)) from (select id as id, title as title from issue where project_id = project.id order by id) as a_1_))::text as "meta.issues" from project where organization_id = $1 order by pid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as pid, (null)::text as "meta.issues" from project where organization_id = $1 order by pid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ((select json_agg(a_1_.result) from (select name as result from project where organization_id = organization.id order by result asc nulls last) as a_1_))::text as "projectNames" from organization where id = $1"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ((select json_agg(a_1_.result) from (select name as result from project where organization_id = organization.id order by result desc nulls first) as a_1_))::text as "projectNames" from organization where id = $1"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ((select json_agg(a_1_.result) from (select name as result from project where organization_id = organization.id order by lower(name) asc) as a_1_))::text as "projectNames" from organization where id = $1"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ((select json_agg(a_1_.result) from (select name as result from project where organization_id = organization.id order by lower(name) asc nulls last) as a_1_))::text as "projectNames" from organization where id = $1"`)
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

    test('inline-aggregate-of-one-column-keeps-the-branded-element-type', async () => {
        // forUseAsInlineAggregatedArrayValue() over a single BRANDED column keeps
        // the brand on the array element type. Project 1's releases have channels
        // {stable, beta} (a custom 'ReleaseChannel'); the aggregated array is
        // ReleaseChannel[], not a widened string[]. The inner aggregate has no
        // order by, so sort before comparing.
        ctx.mockNext({ id: 1, channels: JSON.stringify(['stable', 'beta']) })
        const channels = ctx.conn.subSelectUsing(tProject).from(tProjectRelease)
            .where(tProjectRelease.projectId.equals(tProject.id))
            .selectOneColumn(tProjectRelease.channel)
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, channels })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ((select json_agg(channel) from project_release where project_id = project.id))::text as channels from project where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; channels: ReleaseChannel[] }>>()
        expect({ ...row, channels: [...row.channels].sort() }).toEqual({ id: 1, channels: ['beta', 'stable'] })
    })

    test('inline-aggregate-of-compound-union', async () => {
        // A compound (UNION) select used as the inline aggregated array. The
        // compound is one of the wrap triggers, so the builder wraps it with the
        // aggregate-over-subquery form. The two arms (the org's active and
        // archived projects) union back to all of the org's projects. The inner
        // select has no order by, so sort before comparing.
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projects: JSON.stringify([
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ]),
        })
        const orgProjects = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id)).and(tProject.archivedAt.isNull())
            .select({ id: tProject.id, name: tProject.name })
            .union(
                ctx.conn.subSelectUsing(tOrganization).from(tProject)
                    .where(tProject.organizationId.equals(tOrganization.id)).and(tProject.archivedAt.isNotNull())
                    .select({ id: tProject.id, name: tProject.name }),
            )
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:       tOrganization.id,
                name:     tOrganization.name,
                projects: orgProjects,
            })
            .executeSelectOne()
        assertType<Exact<typeof row, {
            id:       number
            name:     string
            projects: Array<{ id: number; name: string }>
        }>>()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, ((select json_agg(json_build_object('id', a_1_.id, 'name', a_1_.name)) from (select id as id, name as name from project where organization_id = organization.id and archived_at is null union select id as id, name as name from project where organization_id = organization.id and archived_at is not null) as a_1_))::text as projects from organization where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect({ ...row, projects: [...row.projects].sort((a, b) => a.id - b.id) }).toEqual({
            id: 1, name: 'Acme Corp',
            projects: [
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ],
        })
    })

    test('inline-aggregate-of-compound-union-with-customize-query-survives-in-derived-table', async () => {
        // A compound (UNION) consumed via `forUseAsInlineAggregatedArrayValue()` that
        // also carries `.customizeQuery({...})`. The compound is wrapped in a derived
        // table `(...) as a_1_`, and the compound’s `beforeQuery` / `afterQuery` hooks
        // land INSIDE that derived table, bracketing the union. The union returns the
        // org’s active + archived projects; the inner select has no order by, so sort
        // before comparing.
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projects: JSON.stringify([
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ]),
        })
        const orgProjects = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id)).and(tProject.archivedAt.isNull())
            .select({ id: tProject.id, name: tProject.name })
            .union(
                ctx.conn.subSelectUsing(tOrganization).from(tProject)
                    .where(tProject.organizationId.equals(tOrganization.id)).and(tProject.archivedAt.isNotNull())
                    .select({ id: tProject.id, name: tProject.name }),
            )
            .customizeQuery({
                beforeQuery: ctx.conn.rawFragment`/* agg-head */ `,
                afterQuery:  ctx.conn.rawFragment` /* agg-tail */`,
            })
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:       tOrganization.id,
                name:     tOrganization.name,
                projects: orgProjects,
            })
            .executeSelectOne()
        assertType<Exact<typeof row, {
            id:       number
            name:     string
            projects: Array<{ id: number; name: string }>
        }>>()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, ((select json_agg(json_build_object('id', a_1_.id, 'name', a_1_.name)) from (/* agg-head */  select id as id, name as name from project where organization_id = organization.id and archived_at is null union select id as id, name as name from project where organization_id = organization.id and archived_at is not null  /* agg-tail */) as a_1_))::text as projects from organization where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect({ ...row, projects: [...row.projects].sort((a, b) => a.id - b.id) }).toEqual({
            id: 1, name: 'Acme Corp',
            projects: [
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ],
        })
    })

    test('inline-aggregate-of-distinct-one-column', async () => {
        // A `select distinct` source consumed via forUseAsInlineAggregatedArrayValue().
        // `distinct` is a wrap trigger (like group by / having / compound), so the
        // builder wraps the inner select in the aggregate-over-derived-table form:
        // json_agg(...) from (select distinct ...) as a_1_. Project 1 has issue 1
        // (open) and issue 2 (in_progress); the distinct statuses are
        // {open, in_progress}. The inner aggregate has no order by, so sort before
        // comparing.
        ctx.mockNext({ id: 1, statuses: JSON.stringify(['open', 'in_progress']) })
        const distinctStatuses = ctx.conn.subSelectDistinctUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .selectOneColumn(tIssue.status)
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, statuses: distinctStatuses })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ((select json_agg(a_1_.result) from (select distinct status as result from issue where project_id = project.id) as a_1_))::text as statuses from project where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; statuses: string[] }>>()
        expect({ ...row, statuses: [...row.statuses].sort() }).toEqual({ id: 1, statuses: ['in_progress', 'open'] })
    })

    test('inline-aggregate-of-distinct-object', async () => {
        // The distinct-source wrap with a multi-column projection → object array.
        // Project 1's issues have {status, priority} pairs {(open, 2), (in_progress,
        // 1)}, both distinct. The inner aggregate is unordered, so sort before
        // comparing.
        ctx.mockNext({
            id: 1,
            issueKinds: JSON.stringify([
                { status: 'in_progress', priority: 1 },
                { status: 'open', priority: 2 },
            ]),
        })
        const distinctKinds = ctx.conn.subSelectDistinctUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ status: tIssue.status, priority: tIssue.priority })
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, issueKinds: distinctKinds })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ((select json_agg(json_build_object('status', a_1_.status, 'priority', a_1_.priority)) from (select distinct status as status, priority as priority from issue where project_id = project.id) as a_1_))::text as "issueKinds" from project where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:         number
            issueKinds: Array<{ status: string; priority: number }>
        }>>()
        expect({ ...row, issueKinds: [...row.issueKinds].sort((a, b) => a.priority - b.priority) }).toEqual({
            id: 1,
            issueKinds: [
                { status: 'in_progress', priority: 1 },
                { status: 'open', priority: 2 },
            ],
        })
    })

    test('inline-aggregate-with-group-by-projecting-optionals-as-nullable', async () => {
        // The `projectingOptionalValuesAsNullable()` marker coexists with a `group by`
        // wrap: it is applied right after `select(...)`, before `group by`, and survives
        // into the aggregate-over-derived-table wrap. The optional group key `assigneeId`
        // (a nullable column) surfaces present-as-null for the unassigned group instead of
        // being dropped. Org 1 owns issues 1 (assignee 1), 2 (assignee 2), 3 (assignee
        // NULL) → three groups each of count 1; the inner aggregate is unordered, so sort
        // before comparing.
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            byAssignee: JSON.stringify([
                { assigneeId: 1, count: 1 },
                { assigneeId: 2, count: 1 },
                { assigneeId: null, count: 1 },
            ]),
        })
        const byAssignee = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({ assigneeId: tIssue.assigneeId, count: ctx.conn.count(tIssue.id) })
            .projectingOptionalValuesAsNullable()
            .groupBy('assigneeId')
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ id: tOrganization.id, name: tOrganization.name, byAssignee })
            .executeSelectOne()
        assertType<Exact<typeof row, {
            id:         number
            name:       string
            byAssignee: Array<{ assigneeId: number | null; count: number }>
        }>>()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, ((select json_agg(json_build_object('assigneeId', a_1_.assigneeId, 'count', a_1_.count)) from (select issue.assignee_id as assigneeId, count(issue.id) as count from project inner join issue on issue.project_id = project.id where project.organization_id = organization.id group by issue.assignee_id) as a_1_))::text as "byAssignee" from organization where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect({ ...row, byAssignee: [...row.byAssignee].sort((a, b) => (a.assigneeId ?? -1) - (b.assigneeId ?? -1)) }).toEqual({
            id: 1, name: 'Acme Corp',
            byAssignee: [
                { assigneeId: null, count: 1 },
                { assigneeId: 1, count: 1 },
                { assigneeId: 2, count: 1 },
            ],
        })
        // The unassigned group's `assigneeId` is PRESENT as null (not absent).
        const nullGroup = row.byAssignee.find(g => g.assigneeId === null)!
        expect('assigneeId' in nullGroup).toBe(true)
    })

    test('inline-aggregate-with-having-projecting-optionals-as-nullable', async () => {
        // The nullable marker coexisting with a `having` wrap (a `group by` is required
        // before `having`). `having count(...) > 0` keeps every group, and the optional
        // group key `assigneeId` still surfaces present-as-null for the unassigned group
        // through the wrap. Same org-1 grouping; the inner aggregate is unordered.
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            byAssignee: JSON.stringify([
                { assigneeId: 1, count: 1 },
                { assigneeId: 2, count: 1 },
                { assigneeId: null, count: 1 },
            ]),
        })
        const byAssignee = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({ assigneeId: tIssue.assigneeId, count: ctx.conn.count(tIssue.id) })
            .projectingOptionalValuesAsNullable()
            .groupBy('assigneeId')
            .having(ctx.conn.count(tIssue.id).greaterThan(0))
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ id: tOrganization.id, name: tOrganization.name, byAssignee })
            .executeSelectOne()
        assertType<Exact<typeof row, {
            id:         number
            name:       string
            byAssignee: Array<{ assigneeId: number | null; count: number }>
        }>>()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, ((select json_agg(json_build_object('assigneeId', a_1_.assigneeId, 'count', a_1_.count)) from (select issue.assignee_id as assigneeId, count(issue.id) as count from project inner join issue on issue.project_id = project.id where project.organization_id = organization.id group by issue.assignee_id having count(issue.id) > $1) as a_1_))::text as "byAssignee" from organization where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            1,
          ]
        `)
        expect({ ...row, byAssignee: [...row.byAssignee].sort((a, b) => (a.assigneeId ?? -1) - (b.assigneeId ?? -1)) }).toEqual({
            id: 1, name: 'Acme Corp',
            byAssignee: [
                { assigneeId: null, count: 1 },
                { assigneeId: 1, count: 1 },
                { assigneeId: 2, count: 1 },
            ],
        })
    })

    test('inline-aggregate-of-distinct-object-projecting-optionals-as-nullable', async () => {
        // The nullable marker coexisting with a `select distinct` wrap. The distinct
        // (status, body) pairs of project 1's issues surface the optional `body` leaf
        // present-as-null for the null-body row. Issues 1 (open, body NULL) and 2
        // (in_progress, 'Use new tokens') give two distinct pairs; the inner aggregate is
        // unordered, so sort before comparing.
        ctx.mockNext({
            id: 1,
            kinds: JSON.stringify([
                { status: 'open', body: null },
                { status: 'in_progress', body: 'Use new tokens' },
            ]),
        })
        const kinds = ctx.conn.subSelectDistinctUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ status: tIssue.status, body: tIssue.body })
            .projectingOptionalValuesAsNullable()
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, kinds })
            .executeSelectOne()

        assertType<Exact<typeof row, {
            id:    number
            kinds: Array<{ status: string; body: string | null }>
        }>>()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ((select json_agg(json_build_object('status', a_1_.status, 'body', a_1_.body)) from (select distinct status as status, body as body from issue where project_id = project.id) as a_1_))::text as kinds from project where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect({ ...row, kinds: [...row.kinds].sort((a, b) => a.status.localeCompare(b.status)) }).toEqual({
            id: 1,
            kinds: [
                { status: 'in_progress', body: 'Use new tokens' },
                { status: 'open', body: null },
            ],
        })
        // The null-body distinct row surfaces `body` present-as-null (not absent).
        const openRow = row.kinds.find(k => k.status === 'open')!
        expect('body' in openRow).toBe(true)
        expect(openRow.body).toBe(null)
    })

    test('inline-aggregate-of-recursive-union-projecting-optionals-as-nullable', async () => {
        // The nullable marker coexisting with a recursive-union wrap: the marker is applied
        // on the anchor select (before `recursiveUnionAllOn`) and is copied onto the
        // recursive builder, so the optional `body` leaf surfaces present-as-null through
        // the recursive CTE consumed as an inline aggregate. Every seeded issue has a NULL
        // parent_id, so the traversal from issue 1 yields a one-element array; issue 1's
        // body is NULL → present as null.
        const expected = { id: 1, tree: [{ id: 1, title: 'Update hero copy', body: null }] }
        ctx.mockNext(expected)
        const tree = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, title: tIssue.title, body: tIssue.body })
            .projectingOptionalValuesAsNullable()
            .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.id))
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, tree })
            .executeSelectOne()

        assertType<Exact<typeof row, {
            id:   number
            tree: Array<{ id: number; title: string; body: string | null }>
        }>>()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive recursive_select_1 as (select id as id, title as title, body as body from issue where id = $1 union all select issue.id as id, issue.title as title, issue.body as body from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as id, ((select json_agg(json_build_object('id', id, 'title', title, 'body', body)) from recursive_select_1))::text as tree from project where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        expect(row).toEqual(expected)
        // Issue 1's null body is PRESENT as null through the recursive wrap.
        expect('body' in row.tree[0]!).toBe(true)
        expect(row.tree[0]!.body).toBe(null)
    })

    test('inline-aggregate-of-compound-union-projecting-optionals-as-nullable', async () => {
        // The nullable marker applied on BOTH arms BEFORE `.union(...)`, consumed as an
        // inline aggregated array. The compound builder inherits the arms' nullable-
        // projection flag, so an optional `body` leaf surfaces present-as-null (rather than
        // being dropped) through the union wrap. Arm 1 = project 1's issue 1 (body NULL);
        // arm 2 = its issue 2 (body 'Use new tokens'). The inner aggregate is unordered, so
        // sort before comparing.
        ctx.mockNext({
            pid: 1,
            issues: JSON.stringify([
                { title: 'Update hero copy', body: null },
                { title: 'Redesign navbar', body: 'Use new tokens' },
            ]),
        })
        const issues = ctx.conn.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id)).and(tIssue.id.equals(1))
            .select({ title: tIssue.title, body: tIssue.body })
            .projectingOptionalValuesAsNullable()
            .union(
                ctx.conn.subSelectUsing(tProject).from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id)).and(tIssue.id.equals(2))
                    .select({ title: tIssue.title, body: tIssue.body })
                    .projectingOptionalValuesAsNullable(),
            )
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ pid: tProject.id, issues })
            .executeSelectOne()
        assertType<Exact<typeof row, {
            pid:    number
            issues: Array<{ title: string; body: string | null }>
        }>>()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as pid, ((select json_agg(json_build_object('title', a_1_.title, 'body', a_1_.body)) from (select title as title, body as body from issue where project_id = project.id and id = $1 union select title as title, body as body from issue where project_id = project.id and id = $2) as a_1_))::text as issues from project where id = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            1,
          ]
        `)
        expect({ ...row, issues: [...row.issues].sort((a, b) => a.title.localeCompare(b.title)) }).toEqual({
            pid: 1,
            issues: [
                { title: 'Redesign navbar', body: 'Use new tokens' },
                { title: 'Update hero copy', body: null },
            ],
        })
        // Issue 1's null body is present as null even though the marker was applied on the
        // arms before the union.
        const issue1 = row.issues.find(i => i.title === 'Update hero copy')!
        expect('body' in issue1).toBe(true)
        expect(issue1.body).toBe(null)
    })

    test('inline-aggregate-of-compound-union-rule2-left-join-leaf-projecting-optionals-as-nullable', async () => {
        // A compound (union) consumed as an inline aggregated array whose element-top
        // leaf is a RULE-2 leaf from a LEFT-JOINED table (`name` = the issue's assignee
        // full name), tagged `.projectingOptionalValuesAsNullable()` on BOTH arms before
        // the union. The compound preserves the arms' nullable projection, so on a join
        // miss the inline aggregate keeps the element and surfaces `name` PRESENT-null
        // rather than dropping the element. Arm 1 = issue 2 (assignee Grace Hopper →
        // present); arm 2 = issue 3 (assignee NULL → left-join miss → null). The inner
        // aggregate is unordered, so sort before comparing.
        ctx.mockNext({ names: JSON.stringify([
            { name: 'Grace Hopper' },
            { name: null },
        ]) })
        const tAssignee = tAppUser.forUseInLeftJoin()
        const names = ctx.conn.selectFrom(tIssue)
            .leftJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
            .where(tIssue.id.equals(2))
            .select({ name: tAssignee.fullName })
            .projectingOptionalValuesAsNullable()
            .union(
                ctx.conn.selectFrom(tIssue)
                    .leftJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
                    .where(tIssue.id.equals(3))
                    .select({ name: tAssignee.fullName })
                    .projectingOptionalValuesAsNullable(),
            )
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFromNoTable()
            .select({ names })
            .executeSelectOne()

        assertType<Exact<typeof row, {
            names: Array<{ name: string | null }>
        }>>()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ((select json_agg(json_build_object('name', a_1_.name)) from (select app_user.full_name as name from issue left join app_user on app_user.id = issue.assignee_id where issue.id = $1 union select app_user.full_name as name from issue left join app_user on app_user.id = issue.assignee_id where issue.id = $2) as a_1_))::text as names"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            3,
          ]
        `)
        expect({ names: [...row.names].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')) }).toEqual({
            names: [{ name: null }, { name: 'Grace Hopper' }],
        })
        // The join-miss element is PRESENT with `name === null` through the union wrap.
        const missRow = row.names.find(n => n.name === null)!
        expect('name' in missRow).toBe(true)
        expect(missRow.name).toBe(null)
    })

    test('inline-aggregate-of-compound-union-rule1-gate-leaf-projecting-optionals-as-nullable', async () => {
        // A compound (union) consumed as an inline aggregated array with a RULE-1 gate
        // leaf: both arms project `ref = tIssue.body.asRequiredInOptionalObject()` (a
        // requiredInOptionalObject gate) plus an optional `assigneeId` sibling, tagged
        // `.projectingOptionalValuesAsNullable()` before the union. The inline aggregate
        // keeps the gate-null element and, under the nullable projector, surfaces the
        // gate `ref` PRESENT-null (typed `string | null`, not the dropping
        // `aggregateAsArray` non-null shape). Arm 1 = issue 1 (body NULL → gate miss);
        // arm 2 = issue 2 (body 'Use new tokens'). Unordered inner aggregate → sort
        // before comparing.
        ctx.mockNext({ items: JSON.stringify([
            { ref: null, assigneeId: 1 },
            { ref: 'Use new tokens', assigneeId: 2 },
        ]) })
        const items = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ ref: tIssue.body.asRequiredInOptionalObject(), assigneeId: tIssue.assigneeId })
            .projectingOptionalValuesAsNullable()
            .union(
                ctx.conn.selectFrom(tIssue)
                    .where(tIssue.id.equals(2))
                    .select({ ref: tIssue.body.asRequiredInOptionalObject(), assigneeId: tIssue.assigneeId })
                    .projectingOptionalValuesAsNullable(),
            )
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFromNoTable()
            .select({ items })
            .executeSelectOne()

        assertType<Exact<typeof row, {
            items: Array<{ ref: string | null; assigneeId: number | null }>
        }>>()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ((select json_agg(json_build_object('ref', a_1_.ref, 'assigneeId', a_1_.assigneeId)) from (select body as ref, assignee_id as assigneeId from issue where id = $1 union select body as ref, assignee_id as assigneeId from issue where id = $2) as a_1_))::text as items"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        expect({ items: [...row.items].sort((a, b) => a.assigneeId! - b.assigneeId!) }).toEqual({
            items: [
                { ref: null, assigneeId: 1 },
                { ref: 'Use new tokens', assigneeId: 2 },
            ],
        })
        // The gate-null element is KEPT with `ref === null` present (non-dropping inline
        // runtime), through the union wrap.
        const gateNull = row.items.find(i => i.assigneeId === 1)!
        expect('ref' in gateNull).toBe(true)
        expect(gateNull.ref).toBe(null)
    })

    test('inline-aggregate-nested-inside-inline-aggregate-element', async () => {
        // A nested aggregate-of-aggregate: an inline aggregated-array element (`projects`,
        // one per project of the org) that ITSELF contains a nested inline aggregated
        // array leaf (`issues`, one per issue of that project). The runtime recursion
        // over the nested `forUseAsInlineAggregatedArrayValue()` builds a nested
        // `json_agg(... json_agg(...) ...)` scalar subquery. Org 1 owns project 1
        // (issues 1, 2) and project 2 (issue 3); json_agg order is engine-defined, so
        // both array levels are sorted before comparing.
        ctx.mockNext({ orgId: 1, projects: JSON.stringify([
            { pid: 1, issues: [{ iid: 1 }, { iid: 2 }] },
            { pid: 2, issues: [{ iid: 3 }] },
        ]) })
        const projects = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({
                pid: tProject.id,
                issues: ctx.conn.subSelectUsing(tProject).from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id))
                    .select({ iid: tIssue.id })
                    .forUseAsInlineAggregatedArrayValue(),
            })
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ orgId: tOrganization.id, projects })
            .executeSelectOne()

        assertType<Exact<typeof row, {
            orgId:    number
            projects: Array<{ pid: number; issues: Array<{ iid: number }> }>
        }>>()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "orgId", ((select json_agg(json_build_object('pid', id, 'issues', (select json_agg(json_build_object('iid', id)) from issue where project_id = project.id))) from project where organization_id = organization.id))::text as projects from organization where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        const sorted = {
            ...row,
            projects: [...row.projects]
                .map(p => ({ ...p, issues: [...p.issues].sort((a, b) => a.iid - b.iid) }))
                .sort((a, b) => a.pid - b.pid),
        }
        expect(sorted).toEqual({ orgId: 1, projects: [
            { pid: 1, issues: [{ iid: 1 }, { iid: 2 }] },
            { pid: 2, issues: [{ iid: 3 }] },
        ] })
    })

    test('aggregate-as-array-of-one-column-wrapping-inline-object-aggregate-projecting-nullable', async () => {
        // An OUTER `aggregateAsArrayOfOneColumn(...)` wrapping an INNER inline object-aggregate
        // built with `projectingOptionalValuesAsNullable()`. The doubly-nested element keeps its
        // optional `body` leaf present-as-`null` through the outer aggregate. Emits the inline
        // form `json_agg((select json_agg(…) …))`. Project 1 has issues 1 (body null) and 2, so
        // the single grouped row nests one inner array.
        ctx.mockNext([{ pid: 1, nested: [[{ id: 1, body: null }, { id: 2, body: 'Use new tokens' }]] }])
        const inner = ctx.conn.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ id: tIssue.id, body: tIssue.body })
            .projectingOptionalValuesAsNullable()
            .forUseAsInlineAggregatedArrayValue()
        const nested = ctx.conn.aggregateAsArrayOfOneColumn(inner)
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ pid: tProject.id, nested })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as pid, (json_agg((select json_agg(json_build_object('id', id, 'body', body)) from issue where project_id = project.id)))::text as nested from project where id = $1 group by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ pid: number; nested: Array<Array<{ id: number; body: string | null }>> }>>>()
        const inners = rows[0]!.nested.map(arr => [...arr].sort((a, b) => a.id - b.id))
        expect('body' in inners[0]![0]!).toBe(true)
        expect(rows).toEqual([{ pid: 1, nested: [[{ id: 1, body: null }, { id: 2, body: 'Use new tokens' }]] }])
    })

    // Order-by MODES on an inline aggregate, one per remaining ordering; each
    // mode's emitted SQL is pinned by the snapshot below. Org 1 owns 'Marketing
    // site' and 'Internal tools' (both non-null, distinct first letters), so the
    // nulls and insensitivity modifiers don't reorder the two elements — only
    // asc vs desc.
    test('inline-aggregate-order-by-asc', async () => {
        ctx.mockNext({ id: 1, projectNames: JSON.stringify(['Internal tools', 'Marketing site']) })
        const orgNames = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .selectOneColumn(tProject.name)
            .orderBy('result', 'asc')
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ id: tOrganization.id, projectNames: orgNames })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ((select json_agg(a_1_.result) from (select name as result from project where organization_id = organization.id order by result asc) as a_1_))::text as "projectNames" from organization where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; projectNames: string[] }>>()
        expect(row).toEqual({ id: 1, projectNames: ['Internal tools', 'Marketing site'] })
    })

    test('inline-aggregate-order-by-asc-nulls-first', async () => {
        ctx.mockNext({ id: 1, projectNames: JSON.stringify(['Internal tools', 'Marketing site']) })
        const orgNames = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .selectOneColumn(tProject.name)
            .orderBy('result', 'asc nulls first')
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ id: tOrganization.id, projectNames: orgNames })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ((select json_agg(a_1_.result) from (select name as result from project where organization_id = organization.id order by result asc nulls first) as a_1_))::text as "projectNames" from organization where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; projectNames: string[] }>>()
        expect(row).toEqual({ id: 1, projectNames: ['Internal tools', 'Marketing site'] })
    })

    test('inline-aggregate-order-by-desc', async () => {
        ctx.mockNext({ id: 1, projectNames: JSON.stringify(['Marketing site', 'Internal tools']) })
        const orgNames = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .selectOneColumn(tProject.name)
            .orderBy('result', 'desc')
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ id: tOrganization.id, projectNames: orgNames })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ((select json_agg(a_1_.result) from (select name as result from project where organization_id = organization.id order by result desc) as a_1_))::text as "projectNames" from organization where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; projectNames: string[] }>>()
        expect(row).toEqual({ id: 1, projectNames: ['Marketing site', 'Internal tools'] })
    })

    test('inline-aggregate-order-by-desc-nulls-last', async () => {
        ctx.mockNext({ id: 1, projectNames: JSON.stringify(['Marketing site', 'Internal tools']) })
        const orgNames = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .selectOneColumn(tProject.name)
            .orderBy('result', 'desc nulls last')
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ id: tOrganization.id, projectNames: orgNames })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ((select json_agg(a_1_.result) from (select name as result from project where organization_id = organization.id order by result desc nulls last) as a_1_))::text as "projectNames" from organization where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; projectNames: string[] }>>()
        expect(row).toEqual({ id: 1, projectNames: ['Marketing site', 'Internal tools'] })
    })

    test('inline-aggregate-order-by-insensitive', async () => {
        ctx.mockNext({ id: 1, projectNames: JSON.stringify(['Internal tools', 'Marketing site']) })
        const orgNames = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .selectOneColumn(tProject.name)
            .orderBy('result', 'insensitive')
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ id: tOrganization.id, projectNames: orgNames })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ((select json_agg(a_1_.result) from (select name as result from project where organization_id = organization.id order by lower(name)) as a_1_))::text as "projectNames" from organization where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; projectNames: string[] }>>()
        expect(row).toEqual({ id: 1, projectNames: ['Internal tools', 'Marketing site'] })
    })

    test('inline-aggregate-order-by-desc-insensitive', async () => {
        ctx.mockNext({ id: 1, projectNames: JSON.stringify(['Marketing site', 'Internal tools']) })
        const orgNames = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .selectOneColumn(tProject.name)
            .orderBy('result', 'desc insensitive')
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ id: tOrganization.id, projectNames: orgNames })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ((select json_agg(a_1_.result) from (select name as result from project where organization_id = organization.id order by lower(name) desc) as a_1_))::text as "projectNames" from organization where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; projectNames: string[] }>>()
        expect(row).toEqual({ id: 1, projectNames: ['Marketing site', 'Internal tools'] })
    })

    test('inline-aggregate-order-by-desc-nulls-last-insensitive', async () => {
        ctx.mockNext({ id: 1, projectNames: JSON.stringify(['Marketing site', 'Internal tools']) })
        const orgNames = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .selectOneColumn(tProject.name)
            .orderBy('result', 'desc nulls last insensitive')
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ id: tOrganization.id, projectNames: orgNames })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ((select json_agg(a_1_.result) from (select name as result from project where organization_id = organization.id order by lower(name) desc nulls last) as a_1_))::text as "projectNames" from organization where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; projectNames: string[] }>>()
        expect(row).toEqual({ id: 1, projectNames: ['Marketing site', 'Internal tools'] })
    })

    test('inline-aggregate-order-by-desc-nulls-first-insensitive', async () => {
        ctx.mockNext({ id: 1, projectNames: JSON.stringify(['Marketing site', 'Internal tools']) })
        const orgNames = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .selectOneColumn(tProject.name)
            .orderBy('result', 'desc nulls first insensitive')
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ id: tOrganization.id, projectNames: orgNames })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ((select json_agg(a_1_.result) from (select name as result from project where organization_id = organization.id order by lower(name) desc nulls first) as a_1_))::text as "projectNames" from organization where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; projectNames: string[] }>>()
        expect(row).toEqual({ id: 1, projectNames: ['Marketing site', 'Internal tools'] })
    })

})
