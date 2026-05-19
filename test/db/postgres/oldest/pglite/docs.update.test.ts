// Documentation snippets for the UPDATE page (docs/queries/update.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:update/update-one-row', async () => {
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const affected = await connection.update(tProject)
                .set({ name: 'Marketing site (v2)' })
                .where(tProject.id.equals(1))
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site (v2)",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('docs:update/update-with-set-if-value', async () => {
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const newTitle: string | null = 'Update hero copy (revised)'
            const newPriority: number | null = null

            const affected = await connection.update(tIssue)
                .set({})
                .setIfValue({ title:    newTitle })
                .setIfValue({ priority: newPriority })
                .where(tIssue.id.equals(1))
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = $1 where id = $2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Update hero copy (revised)",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('docs:update/update-returning', async () => {
        ctx.mockNext({ id: 1, name: 'Marketing site (v2)', slug: 'mktg-site' })

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const updated = await connection.update(tProject)
                .set({ name: 'Marketing site (v2)' })
                .where(tProject.id.equals(1))
                .returning({
                    id:   tProject.id,
                    name: tProject.name,
                    slug: tProject.slug,
                })
                .executeUpdateOne()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2 returning id as id, name as name, slug as slug"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site (v2)",
                1,
              ]
            `)
            assertType<Exact<typeof updated, {
                id:   number
                name: string
                slug: string
            }>>()
            expect(updated.name).toBe('Marketing site (v2)')
        })
    })

    test('docs:update/update-returning-old-values', async () => {
        // Section "Update returning old values" — `tTable.oldValues()`
        // yields a reference whose columns resolve to the PRE-update row.
        // Supported on PostgreSQL, modern MariaDB and SQL Server. SQLite,
        // MySQL and Oracle don't support it.
        ctx.mockNext({ oldName: 'Marketing site', newName: 'Marketing site (v2)' })

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const oldProject = tProject.oldValues()
            const updated = await connection.update(tProject)
                .set({ name: 'Marketing site (v2)' })
                .where(tProject.id.equals(1))
                .returning({
                    oldName: oldProject.name,
                    newName: tProject.name,
                })
                .executeUpdateOne()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project as _new_ set name = $1 from (select _old_.* from project as _old_ where _old_.id = $2 for no key update of _old_) as _old_ where _new_.id = _old_.id returning _old_.name as "oldName", _new_.name as "newName""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site (v2)",
                1,
              ]
            `)
            assertType<Exact<typeof updated, { oldName: string; newName: string }>>()
        })
    })

    test('docs:update/update-from-other-table', async () => {
        // Section "Update using other tables or views" — `.from(other)`
        // joins the other table for use in the SET / WHERE expressions.
        ctx.mockNext(2)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const affected = await connection.update(tProject)
                .from(tOrganization)
                .set({
                    name: tProject.name.concat(' / ').concat(tOrganization.name),
                })
                .where(tProject.organizationId.equals(tOrganization.id))
                .and(tOrganization.plan.equals('pro'))
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = project.name || $1 || organization.name from organization where project.organization_id = organization.id and organization.plan = $2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " / ",
                "pro",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })

    test('docs:update/update-with-shape', async () => {
        // Section "Update with value's shape" — `shapedAs(...)` renames
        // the source-object keys to column names; `extendShape` tacks on
        // additional mappings for chained sets.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const issueId = 1
            const issueData = {
                newTitle:    'Update hero copy (revised)',
                newPriority: 1,
            }
            const newAssignee = 2

            const affected = await connection.update(tIssue)
                .shapedAs({
                    newTitle:    'title',
                    newPriority: 'priority',
                })
                .set(issueData)
                .extendShape({
                    newAssignee: 'assigneeId',
                })
                .set({
                    newAssignee,
                })
                .where(tIssue.id.equals(issueId))
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = $1, priority = $2, assignee_id = $3 where id = $4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Update hero copy (revised)",
                1,
                2,
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })

    test('docs-extra:update/returning-one-column', async () => {
        // "Update returning" prose: `returningOneColumn(col)` is the
        // single-column counterpart of `returning({...})`.
        ctx.mockNext('Marketing site (v2)')

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const newName = await connection.update(tProject)
                .set({ name: 'Marketing site (v2)' })
                .where(tProject.id.equals(1))
                .returningOneColumn(tProject.name)
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2 returning name as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site (v2)",
                1,
              ]
            `)
            assertType<Exact<typeof newName, string>>()
        })
    })

    test('docs-extra:update/dynamic-set', async () => {
        // "Manipulating values to update" prose: `dynamicSet()` lets you
        // start an update with no values; the type system enforces that
        // any required-by-context field is provided before execute.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const affected = await connection.update(tProject)
                .dynamicSet()
                .set({ name: 'Marketing site (v3)' })
                .where(tProject.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site (v3)",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })

    test('docs-extra:update/set-when', async () => {
        // "Manipulating values to update" prose: the `When` variants
        // gate the set with a boolean.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const includePriorityBump = true

            const affected = await connection.update(tIssue)
                .set({ title: 'Triage' })
                .setWhen(includePriorityBump, { priority: 1 })
                .where(tIssue.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = $1, priority = $2 where id = $3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Triage",
                1,
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })
})
