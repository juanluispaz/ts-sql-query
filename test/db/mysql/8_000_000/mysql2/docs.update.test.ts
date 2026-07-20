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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set \`name\` = ? where id = ?"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ? where id = ?"`)
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

    // NOT-APPLICABLE: MySQL has no RETURNING
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = ? where id = ? returning id as id, name as name, slug as slug"`)
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
    */

    // NOT-APPLICABLE: `tTable.oldValues()` is not typed on this dialect — `update returning old values` is not supported here. Body kept verbatim for cross-cell diff parity per the symmetry rule.
    /*
    test('docs:update/update-returning-old-values', async () => {
        // Section "Update returning old values" — `tTable.oldValues()`
        // yields a reference whose columns resolve to the PRE-update row.
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof updated, { oldName: string; newName: string }>>()
        })
    })
    */

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project, \`organization\` set project.\`name\` = concat(project.\`name\`, ?, \`organization\`.\`name\`) where project.organization_id = \`organization\`.id and \`organization\`.plan = ?"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ?, priority = ?, assignee_id = ? where id = ?"`)
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

    // NOT-APPLICABLE: MySQL has no RETURNING
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = ? where id = ? returning name as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site (v2)",
                1,
              ]
            `)
            assertType<Exact<typeof newName, string>>()
        })
    })
    */

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set \`name\` = ? where id = ?"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ?, priority = ? where id = ?"`)
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

    test('docs-extra:update/set-if-set-overrides-existing', async () => {
        // "Manipulating values to update" prose: `setIfSet({...})` only
        // writes when the same column was already set in a previous step.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const affected = await connection.update(tIssue)
                .set({ title: 'Triage', priority: 2 })
                .setIfSet({ priority: 1 })
                .where(tIssue.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ?, priority = ? where id = ?"`)
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

    test('docs-extra:update/set-if-not-set-skips-when-already-set', async () => {
        // "Manipulating values to update" prose: `setIfNotSet({...})`
        // assigns only the columns that were NOT previously set; existing
        // entries are left untouched.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const affected = await connection.update(tIssue)
                .set({ title: 'Triage', priority: 2 })
                .setIfNotSet({ priority: 1, status: 'closed' })
                .where(tIssue.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ?, priority = ?, \`status\` = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Triage",
                2,
                "closed",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })

    test('docs-extra:update/ignore-if-set-drops-column', async () => {
        // "Manipulating values to update" prose: `ignoreIfSet(col, ...)`
        // removes the listed columns from the previous set so they are
        // not emitted in the UPDATE statement.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const affected = await connection.update(tIssue)
                .set({ title: 'Triage', priority: 1 })
                .ignoreIfSet('priority')
                .where(tIssue.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Triage",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })

    test('docs-extra:update/keep-only-filters-columns', async () => {
        // "Manipulating values to update" prose: `keepOnly(col, ...)`
        // drops every previously-set column not in the allowlist.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const affected = await connection.update(tIssue)
                .set({ title: 'Triage', priority: 1, status: 'open' })
                .keepOnly('title')
                .where(tIssue.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Triage",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })

    test('docs-extra:update/ignore-any-set-with-no-value', async () => {
        // "Manipulating values to update" prose:
        // `ignoreAnySetWithNoValue()` sweeps every previously-set column
        // whose value is null/undefined/empty-string/empty-array — handy
        // after a chain of `setIfValue` calls.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const affected = await connection.update(tIssue)
                .set({ title: 'Triage' })
                .set({ body: '' })
                .ignoreAnySetWithNoValue()
                .where(tIssue.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Triage",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })

    test('docs-extra:update/disallow-if-set-throws', async () => {
        // "Manipulating values to update" prose:
        // `disallowIfSet(msg, ...cols)` throws BEFORE execute if any
        // listed column was set — defensive policy check.
        const connection = ctx.conn

        expect(() => {
            connection.update(tIssue)
                .set({ title: 'Triage', status: 'closed' })
                .disallowIfSet('status is managed by the workflow', 'status')
                .where(tIssue.id.equals(1))
        }).toThrow(/status is managed by the workflow/)
    })

    test('docs-extra:update/disallow-if-not-set-throws', async () => {
        // "Manipulating values to update" prose:
        // `disallowIfNotSet(msg, ...cols)` throws if any listed column is
        // missing — defensive check for required-by-policy columns.
        const connection = ctx.conn

        expect(() => {
            connection.update(tIssue)
                .dynamicSet()
                .set({ title: 'Triage' })
                .disallowIfNotSet('priority must always be set', 'priority')
                .where(tIssue.id.equals(1))
        }).toThrow(/priority must always be set/)
    })

    test('docs-extra:update/disallow-any-other-set-throws', async () => {
        // "Manipulating values to update" prose:
        // `disallowAnyOtherSet(msg, ...allowlist)` throws if any column
        // not in the allowlist was set.
        const connection = ctx.conn

        expect(() => {
            connection.update(tIssue)
                .set({ title: 'Triage', status: 'closed' })
                .disallowAnyOtherSet('only title may be updated by this path', 'title')
                .where(tIssue.id.equals(1))
        }).toThrow(/only title may be updated by this path/)
    })
})
