// Documentation snippets for the UPDATE page (docs/queries/update.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject, type DBConnection } from '../../domain/connection.js'
import { Values } from '../../../../../src/Values.js'
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
            const updateProject = await connection.update(tProject).set({
                    name:       'Marketing site (v2)',
                    slug:       'mktg-site-v2',
                    archivedAt: new Date('2024-01-01'),
                }).ignoreIfSet('archivedAt')
                .where(tProject.id.equals(1))
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set \`name\` = ?, slug = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site (v2)",
                "mktg-site-v2",
                1,
              ]
            `)
            assertType<Exact<typeof updateProject, number>>()
            expect(updateProject).toBe(1)
        })
    })

    // NOT-APPLICABLE: MySQL has no RETURNING
    /*
    test('docs:update/returning-one-column', async () => {
        ctx.mockNext('Marketing site (v2)')

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const updatedProjectName = await connection.update(tProject)
                .set({
                    name: 'Marketing site (v2)',
                })
                .where(tProject.id.equals(1))
                .returningOneColumn(tProject.name)
                .executeUpdateOne()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof updatedProjectName, string>>()
            expect(updatedProjectName).toBe('Marketing site (v2)')
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING
    /*
    test('docs-extra:update/update-returning', async () => {
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
        const expected = { oldName: 'Marketing site', newName: 'Marketing site (v2)' }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const oldProjectValues = tProject.oldValues()
            const updatedNames = await connection.update(tProject)
                .set({
                    name: 'Marketing site (v2)',
                })
                .where(tProject.id.equals(1))
                .returning({
                    oldName: oldProjectValues.name,
                    newName: tProject.name,
                })
                .executeUpdateOne()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof updatedNames, { oldName: string; newName: string }>>()
            expect(updatedNames).toEqual(expected)
        })
    })
    */

    test('docs:update/update-from-other-table', async () => {
        // The seeded 'Acme Corp' owns two projects.
        ctx.mockNext(2)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const addAcmeNameToProjectName = await connection.update(tProject)
                .from(tOrganization)
                .set({
                    name: tProject.name.concat(' - ').concat(tOrganization.name),
                })
                .where(tProject.organizationId.equals(tOrganization.id))
                .and(tOrganization.name.containsInsensitive('ACME'))
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project, \`organization\` set project.\`name\` = concat(project.\`name\`, ?, \`organization\`.\`name\`) where project.organization_id = \`organization\`.id and lower(\`organization\`.\`name\`) like concat('%', lower(?), '%')"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " - ",
                "ACME",
              ]
            `)
            assertType<Exact<typeof addAcmeNameToProjectName, number>>()
            expect(addAcmeNameToProjectName).toBe(2)
        })
    })

    test('docs:update/bulk-update', async () => {
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            class VProjectForUpdate extends Values<DBConnection, 'projectForUpdate'> {
                id   = this.column('int')
                name = this.column('string')
                slug = this.column('string')
            }
            const projectForUpdate = Values.create(VProjectForUpdate, 'projectForUpdate', [{
                id:   1,
                name: 'First name',
                slug: 'first-slug',
            }])

            const updateProject = await connection.update(tProject)
                .from(projectForUpdate)
                .set({
                    name: projectForUpdate.name,
                    slug: projectForUpdate.slug,
                })
                .where(tProject.id.equals(projectForUpdate.id))
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectForUpdate(id, \`name\`, slug) as (values row(?, ?, ?)) update project, projectForUpdate set project.\`name\` = projectForUpdate.\`name\`, project.slug = projectForUpdate.slug where project.id = projectForUpdate.id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "First name",
                "first-slug",
              ]
            `)
            assertType<Exact<typeof updateProject, number>>()
            expect(updateProject).toBe(1)
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

    test('docs:update/update-multiple-tables', async () => {
        // Both tables change, so the engine counts one row in each.
        ctx.mockNext(2)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const projectNameAndOrganizationName = {
                id:               1,
                projectName:      'Marketing site (v2)',
                projectSlug:      'mktg-site-v2',
                organizationName: 'Acme Inc.',
            }

            const updatedCount = await connection.update(tProject)
                .innerJoin(tOrganization).on(tProject.organizationId.equals(tOrganization.id))
                .shapedAs({
                    projectName:      tProject.name,
                    projectSlug:      tProject.slug,
                    organizationName: tOrganization.name,
                })
                .set(projectNameAndOrganizationName)
                .where(tProject.id.equals(projectNameAndOrganizationName.id))
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project inner join \`organization\` on project.organization_id = \`organization\`.id set project.\`name\` = ?, project.slug = ?, \`organization\`.\`name\` = ? where project.id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site (v2)",
                "mktg-site-v2",
                "Acme Inc.",
                1,
              ]
            `)
            assertType<Exact<typeof updatedCount, number>>()
            expect(updatedCount).toBe(2)
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

    test('docs:update/ignore-if-set-when', async () => {
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const canChangeTheOrganization = false

            const updatedCount = await connection.update(tProject).set({
                    name:           'Marketing site (v2)',
                    slug:           'mktg-site-v2',
                    organizationId: 2,
                })
                .ignoreIfSetWhen(!canChangeTheOrganization, 'organizationId')
                .where(tProject.id.equals(1))
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set \`name\` = ?, slug = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site (v2)",
                "mktg-site-v2",
                1,
              ]
            `)
            assertType<Exact<typeof updatedCount, number>>()
            expect(updatedCount).toBe(1)
        })
    })
})
