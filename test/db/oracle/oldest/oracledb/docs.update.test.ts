// Documentation snippets for the UPDATE page (docs/queries/update.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

// tOrganization is used only by the update-from-other-table test commented out below.
void tOrganization

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = :0, slug = :1 where id = :2"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = :0 where id = :1 returning name into :2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site (v2)",
                1,
                {
                  "as": "result",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof updatedProjectName, string>>()
            expect(updatedProjectName).toBe('Marketing site (v2)')
        })
    })

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = :0 where id = :1 returning id, name, slug into :2, :3, :4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site (v2)",
                1,
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "name",
                  "dir": 3003,
                },
                {
                  "as": "slug",
                  "dir": 3003,
                },
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

    // `tTable.oldValues()` is only typed on PostgreSqlConnection, MariaDBConnection and SqlServerConnection. Body kept verbatim for cross-cell diff parity per the symmetry rule.
    // NOT-APPLICABLE: Oracle has no RETURNING OLD values
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

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    // requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword
    // at the parser (ORA-00933). Emission is the same standard form on all versions by design.
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof addAcmeNameToProjectName, number>>()
            expect(addAcmeNameToProjectName).toBe(2)
        })
    })
    */

    // NOT-APPLICABLE: Oracle accepts WITH only as a prefix to SELECT, so UPDATE … FROM <Values> (ORA-00928) is not emittable
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof updateProject, number>>()
            expect(updateProject).toBe(1)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = :0 where id = :1"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = :0, priority = :1 where id = :2"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = :0, priority = :1 where id = :2"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = :0, priority = :1, status = :2 where id = :3"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = :0 where id = :1"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = :0 where id = :1"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = :0 where id = :1"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = :0, slug = :1 where id = :2"`)
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

    test('docs:update/update-without-where', async () => {
        // Section "Update without a where": every seeded issue changes.
        ctx.mockNext(4)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const updatedCount = await connection.updateAllowingNoWhere(tIssue)
                .set({ status: 'archived' })
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "archived",
              ]
            `)
            assertType<Exact<typeof updatedCount, number>>()
            expect(updatedCount).toBe(4)
        })
    })

    test('docs:update/minimum-and-maximum-rows', async () => {
        // Section "The number of updated rows": exactly one row must be updated.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const updatedCount = await connection.update(tIssue)
                .set({ status: 'closed' })
                .where(tIssue.id.equals(2))
                .executeUpdate(1, 1)
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = :0 where id = :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "closed",
                2,
              ]
            `)
            assertType<Exact<typeof updatedCount, number>>()
            expect(updatedCount).toBe(1)
        })
    })

    test('docs:update/set-if-value', async () => {
        // Section "Manipulating values to update": a value that didn't arrive isn't written.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const issueChanges: { title?: string, status?: string } = { title: 'New title' }

            const updatedCount = await connection.update(tIssue)
                .setIfValue(issueChanges)
                .where(tIssue.id.equals(2))
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = :0 where id = :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "New title",
                2,
              ]
            `)
            assertType<Exact<typeof updatedCount, number>>()
            expect(updatedCount).toBe(1)
        })
    })

    // NOT-APPLICABLE: a join right after update(...) is only typed on MariaDB and MySQL
    /*
    test('docs:update/update-with-join', async () => {
        // The issue of the "Public API" project: one row.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const updatedCount = await connection.update(tIssue)
                .innerJoin(tProject).on(tIssue.projectId.equals(tProject.id))
                .set({
                    title: tIssue.title.concat(' - ').concat(tProject.name),
                })
                .where(tProject.name.containsInsensitive('Public'))
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof updatedCount, number>>()
            expect(updatedCount).toBe(1)
        })
    })
    */
})
