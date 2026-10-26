// Discovery of the `valuesForInsert()` pseudo-table inside an upsert. While an
// `insertInto(t)…onConflictOn(...)` builds its DO UPDATE branch, the builder
// walks every `doUpdateSet({...})` value and then the DO UPDATE `where(...)`
// predicate, asking each expression whether it reads the row that tried to be
// inserted (`t.valuesForInsert()`, rendered `excluded.<col>` on PostgreSQL /
// SQLite). The walk stops at the first expression that answers; the WHERE is
// only walked when no set value already answered.
//
// The discovery feeds no SQL of its own, so `valuesForInsertTableDiscoveredBy`
// is the observable: it returns the very pseudo-table instance the expression
// reads, or `undefined`. Each test places the pseudo-table column in ONE
// operand position of one wrapper (receiver, operand, list element, fallback,
// fragment argument, …), so a wrapper that stopped recursing into that operand
// reports `undefined` and fails exactly that test. The set-value tests keep the
// WHERE empty; the WHERE tests set a plain literal, so the answer can only come
// from the position under test.
//
// The last tests put subqueries in those positions. A subquery never exposes
// the pseudo-table (it cannot be listed in `subSelectUsing`), so discovery
// through a subquery alone is `undefined`; when a later sibling reads it, the
// walk continues past the subquery and finds it.
//
// Every statement runs inside `ctx.withRollback(...)`. The incoming row
// (organization 1, slug 'mktg-site') collides with seed project 1
// ('Marketing site', published, not archived) on the unique
// (organization_id, slug), so the DO UPDATE branch always fires; the proposed
// row carries the column defaults, so `excluded.published` is 'f' (false).
// `valuesForInsert()` exists only on the dialects with an upsert that can read
// the proposed row (PostgreSQL, SQLite, MariaDB, MySQL).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType } from '../../../../lib/assertType.js'
import { valuesForInsertTableDiscoveredBy } from '../../../../lib/queryIntrospection.js'
import { tIssue, tIssueWorklog, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

// Referenced by the commented-out tests below.
void assertType; void expect; void tIssue; void tIssueWorklog; void tOrganization; void tProject; void test; void valuesForInsertTableDiscoveredBy

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // ---------------------------------------------------------------------
    // doUpdateSet values
    // ---------------------------------------------------------------------

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-set-with-plain-values-discovers-nothing', async () => {
        // The control: the DO UPDATE sets a literal and has no WHERE, so nothing
        // reads the proposed row.
        const expected = { id: 1, name: 'Marketing site (synced)' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const query = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site (synced)' })
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBeUndefined()

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = ? returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "Marketing site (synced)",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-set-proposed-column-is-discovered', async () => {
        // The bare column: the upsert copies the incoming name onto the row.
        const expected = { id: 1, name: 'Marketing site v2' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: newProject.name })
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = value(name) returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-set-walks-constants-before-reaching-the-proposed-column', async () => {
        // A boolean constant and a typed string constant sit BEFORE the
        // proposed-row column, so the walk has to ask both and continue.
        const expected = { id: 1, name: 'Marketing site v2', published: true }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const newProject = tProject.valuesForInsert()
            const query = connection.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({
                    published: connection.true(),
                    slug:      connection.const('mktg-site', 'string'),
                    name:      newProject.name,
                })
                .returning({ id: tProject.id, name: tProject.name, published: tProject.published })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update published = case when true then 't' else 'f' end, slug = ?, name = value(name) returning id as id, name as name, (published = 't') as published"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "mktg-site",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string; published: boolean } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-set-true-when-no-value-over-the-proposed-column-is-discovered', async () => {
        // Publish only when the incoming name is 'Public API'. The value is
        // present, so the comparison renders; 'Marketing site v2' differs, so
        // project 1 becomes unpublished.
        const expected = { id: 1, published: false }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ published: newProject.name.equalsIfValue('Public API').trueWhenNoValue() })
                .returning({ id: tProject.id, published: tProject.published })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update published = case when value(name) = ? then 't' else 'f' end returning id as id, (published = 't') as published"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "Public API",
              ]
            `)
            assertType<Exact<typeof row, { id: number; published: boolean } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-set-value-when-no-value-with-the-proposed-column-in-the-condition-is-discovered', async () => {
        // The proposed column is the RECEIVER of the condition; the fallback is
        // the existing flag. The value is present, so the condition renders and
        // matches: published.
        const expected = { id: 1, published: true }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({
                    published: newProject.name.equalsIfValue('Marketing site v2').valueWhenNoValue(tProject.published),
                })
                .returning({ id: tProject.id, published: tProject.published })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update published = case when value(name) = ? then 't' else 'f' end returning id as id, (published = 't') as published"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "Marketing site v2",
              ]
            `)
            assertType<Exact<typeof row, { id: number; published: boolean } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-set-value-when-no-value-with-the-proposed-column-in-the-fallback-is-discovered', async () => {
        // The condition has no value (`null`), so only the FALLBACK renders: the
        // incoming row's published flag, which took the column default 'f'.
        const expected = { id: 1, published: false }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({
                    published: tProject.name.equalsIfValue(null).valueWhenNoValue(newProject.published),
                })
                .returning({ id: tProject.id, published: tProject.published })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update published = case when value(published) = 't' then 't' else 'f' end returning id as id, (published = 't') as published"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
              ]
            `)
            assertType<Exact<typeof row, { id: number; published: boolean } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-set-to-lower-case-of-the-proposed-column-is-discovered', async () => {
        const expected = { id: 1, name: 'marketing site v2' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: newProject.name.toLowerCase() })
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = lower(value(name)) returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-set-collate-of-the-proposed-column-is-discovered', async () => {
        // The "C" collation is built into every PostgreSQL; it does not change
        // the stored text.
        const expected = { id: 1, name: 'Marketing site v2' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: newProject.name.collate('utf8mb4_bin') })
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = value(name) collate utf8mb4_bin returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-set-concat-if-value-on-the-proposed-column-is-discovered', async () => {
        const expected = { id: 1, name: 'Marketing site v2 (imported)' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: newProject.name.concatIfValue(' (imported)') })
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = concat(value(name), ?) returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                " (imported)",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-set-replace-all-if-value-with-the-proposed-column-as-replacement-is-discovered', async () => {
        // The receiver is the existing name; the proposed slug is the
        // replacement text. 'Marketing site' becomes 'Marketing mktg-site'.
        const expected = { id: 1, name: 'Marketing mktg-site' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: tProject.name.replaceAllIfValue('site', newProject.slug) })
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = replace(name, ?, value(slug)) returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "site",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-set-value-when-null-with-the-proposed-column-as-replacement-is-discovered', async () => {
        // Keep an existing archive date, otherwise take the incoming one.
        // Project 1 is not archived, so it takes 2024-06-01.
        const expected = { id: 1, archived: true }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({
                    organizationId: 1,
                    slug:           'mktg-site',
                    name:           'Marketing site v2',
                    archivedAt:     new Date(Date.UTC(2024, 5, 1, 12, 0, 0)),
                })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ archivedAt: tProject.archivedAt.valueWhenNull(newProject.archivedAt) })
                .returning({ id: tProject.id, archived: tProject.archivedAt.isNotNull() })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name, archived_at) values (?, ?, ?, ?) on duplicate key update archived_at = ifnull(archived_at, value(archived_at)) returning id as id, archived_at is not null as archived"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                2024-06-01T12:00:00.000Z,
              ]
            `)
            assertType<Exact<typeof row, { id: number; archived: boolean } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-set-as-optional-of-the-proposed-column-is-discovered', async () => {
        const expected = { id: 1, archived: true }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({
                    organizationId: 1,
                    slug:           'mktg-site',
                    name:           'Marketing site v2',
                    archivedAt:     new Date(Date.UTC(2024, 5, 1, 12, 0, 0)),
                })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ archivedAt: newProject.archivedAt.asOptional() })
                .returning({ id: tProject.id, archived: tProject.archivedAt.isNotNull() })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name, archived_at) values (?, ?, ?, ?) on duplicate key update archived_at = value(archived_at) returning id as id, archived_at is not null as archived"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                2024-06-01T12:00:00.000Z,
              ]
            `)
            assertType<Exact<typeof row, { id: number; archived: boolean } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-set-open-allow-when-over-the-proposed-column-is-discovered', async () => {
        const expected = { id: 1, name: 'Marketing site v2' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: newProject.name.allowWhen(true, 'rename allowed') })
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = value(name) returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-set-fragment-argument-is-discovered', async () => {
        const expected = { id: 1, name: 'MARKETING SITE V2' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const newProject = tProject.valuesForInsert()
            const query = connection.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: connection.fragmentWithType('string', 'required').sql`upper(${newProject.name})` })
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = upper(value(name)) returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // ---------------------------------------------------------------------
    // DO UPDATE where
    // ---------------------------------------------------------------------

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-where-is-null-and-is-not-with-the-proposed-column-is-discovered', async () => {
        // Sync only active projects whose name really changes: `is(null)` on the
        // existing row first, then the null-safe `isNot` against the proposed
        // name. Project 1 is active and 'Marketing site' differs.
        const expected = { id: 1, name: 'Marketing site (synced)' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site (synced)' })
                .where(tProject.archivedAt.is(null).and(tProject.name.isNot(newProject.name)))
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = ? returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "Marketing site (synced)",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-where-in-n-with-the-proposed-column-as-a-list-element-is-discovered', async () => {
        // The literal sits first, so the list walk continues to index 1.
        const expected = { id: 1, name: 'Marketing site (synced)' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site (synced)' })
                .where(tProject.slug.inN('tools', newProject.slug))
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = ? returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "Marketing site (synced)",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-where-in-n-on-the-proposed-column-as-receiver-is-discovered', async () => {
        const expected = { id: 1, name: 'Marketing site (synced)' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site (synced)' })
                .where(newProject.slug.inN('tools', 'mktg-site'))
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = ? returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "Marketing site (synced)",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-where-not-in-a-single-proposed-column-is-discovered', async () => {
        // `notIn(valueSource)` takes ONE operand, not a list.
        const expected = { id: 1, name: 'Marketing site (synced)' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site (synced)' })
                .where(tProject.name.notIn(newProject.name))
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = ? returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "Marketing site (synced)",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-where-walks-a-plain-list-and-a-subquery-before-a-later-proposed-column', async () => {
        // A literal list and an `in (subquery)` come first and expose nothing;
        // the walk goes on to the last condition. Project 1 has slug 'mktg-site'
        // and an open issue (issue 1).
        const expected = { id: 1, name: 'Marketing site (synced)' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const newProject = tProject.valuesForInsert()
            const query = connection.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site (synced)' })
                .where(tProject.slug.in(['mktg-site', 'tools'])
                    .and(tProject.id.in(
                        connection.selectFrom(tIssue)
                            .where(tIssue.status.equals('open'))
                            .selectOneColumn(tIssue.projectId),
                    ))
                    .and(tProject.name.notEquals(newProject.name)))
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = ? returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "Marketing site (synced)",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-where-walks-an-exists-subquery-before-a-later-proposed-column', async () => {
        // A correlated `exists` over the conflicting row's issues comes first.
        // Project 1 has issues 1 and 2.
        const expected = { id: 1, name: 'Marketing site (synced)' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const newProject = tProject.valuesForInsert()
            const query = connection.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site (synced)' })
                .where(connection.exists(
                    connection.subSelectUsing(tProject).from(tIssue)
                        .where(tIssue.projectId.equals(tProject.id))
                        .selectOneColumn(tIssue.id),
                ).and(tProject.name.notEquals(newProject.name)))
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = ? returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "Marketing site (synced)",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-where-equals-if-value-on-the-proposed-column-is-discovered', async () => {
        const expected = { id: 1, name: 'Marketing site (synced)' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site (synced)' })
                .where(newProject.name.equalsIfValue('Marketing site v2'))
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = ? returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "Marketing site (synced)",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-where-if-value-conditions-without-value-are-skipped-before-a-later-proposed-column', async () => {
        // `equalsIfValue(null)` and `inIfValue(null)` render nothing and expose
        // nothing; `inIfValue([1, 2])` on the existing row renders but exposes
        // nothing either; the last condition reads the proposed name.
        const expected = { id: 1, name: 'Marketing site (synced)' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site (synced)' })
                .where(tProject.name.equalsIfValue(null)
                    .and(tProject.organizationId.inIfValue(null))
                    .and(tProject.id.inIfValue([1, 2]))
                    .and(tProject.name.notEquals(newProject.name)))
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = ? returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "Marketing site (synced)",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-where-in-if-value-on-the-proposed-column-is-discovered', async () => {
        const expected = { id: 1, name: 'Marketing site (synced)' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site (synced)' })
                .where(newProject.organizationId.inIfValue([1, 2]))
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = ? returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "Marketing site (synced)",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-where-between-on-the-proposed-column-as-receiver-is-discovered', async () => {
        const expected = { id: 1, name: 'Marketing site (synced)' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site (synced)' })
                .where(newProject.organizationId.between(1, 2))
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = ? returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "Marketing site (synced)",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-where-between-with-the-proposed-column-as-lower-bound-is-discovered', async () => {
        const expected = { id: 1, name: 'Marketing site (synced)' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site (synced)' })
                .where(tProject.organizationId.between(newProject.organizationId, 2))
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = ? returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "Marketing site (synced)",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-where-between-with-the-proposed-column-as-upper-bound-is-discovered', async () => {
        const expected = { id: 1, name: 'Marketing site (synced)' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const query = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site (synced)' })
                .where(tProject.organizationId.between(0, newProject.organizationId))
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newProject)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = ? returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "Marketing site (synced)",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-where-virtual-column-of-the-proposed-row-is-discovered', async () => {
        // `activityUpper` is a virtual column computed as `upper(activity)`.
        // The incoming worklog reuses id 1 (seed: issue 1, 'coding'), so it
        // conflicts and is relabelled 'review'.
        const expected = { id: 1, activity: 'review' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const newWorklog = tIssueWorklog.valuesForInsert()
            const query = ctx.conn.insertInto(tIssueWorklog)
                .values({ id: 1, issueId: 1, workDate: new Date(Date.UTC(2024, 2, 4)), activity: 'coding' })
                .onConflictOn(tIssueWorklog.id)
                .doUpdateSet({ activity: 'review' })
                .where(newWorklog.activityUpper.equals('CODING'))
                .returning({ id: tIssueWorklog.id, activity: tIssueWorklog.activity })

            expect(valuesForInsertTableDiscoveredBy(query)).toBe(newWorklog)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue_worklog (id, issue_id, work_date, activity) values (?, ?, ?, ?) on duplicate key update activity = ? returning id as id, activity as activity"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                1,
                2024-03-04T00:00:00.000Z,
                "coding",
                "review",
              ]
            `)
            assertType<Exact<typeof row, { id: number; activity: 'coding' | 'review' | 'meeting' } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // ---------------------------------------------------------------------
    // Subqueries
    // ---------------------------------------------------------------------

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-set-correlated-inline-subquery-does-not-expose-the-proposed-row', async () => {
        // Rename the conflicting project after its organization. The subquery
        // reads the EXISTING row (`subSelectUsing(tProject)`), never the
        // proposed one. Project 1 belongs to 'Acme Corp'.
        const expected = { id: 1, name: 'Acme Corp' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const organizationName = connection.subSelectUsing(tProject).from(tOrganization)
                .where(tOrganization.id.equals(tProject.organizationId))
                .selectOneColumn(tOrganization.name)
                .forUseAsInlineQueryValue()
            const query = connection.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: organizationName.valueWhenNull('Unassigned') })
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBeUndefined()

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = ifnull((select name as result from organization where id = project.organization_id), ?) returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "Unassigned",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-set-compound-inline-subquery-does-not-expose-the-proposed-row', async () => {
        // The verified organizations on the 'pro' plan: only 'Acme Corp'
        // (Globex is on 'free' and not verified), so the scalar subquery yields
        // one row.
        const expected = { id: 1, name: 'Acme Corp' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const verifiedProOrganization = connection.selectFrom(tOrganization)
                .where(tOrganization.plan.equals('pro'))
                .selectOneColumn(tOrganization.name)
                .intersect(
                    connection.selectFrom(tOrganization)
                        .where(tOrganization.verified.equals(true))
                        .selectOneColumn(tOrganization.name),
                )
                .forUseAsInlineQueryValue()
            const query = connection.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: verifiedProOrganization.valueWhenNull('Unassigned') })
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBeUndefined()

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = ifnull((select name as result from organization where plan = ? intersect select name as result from organization where (verified = 'Y') = ?), ?) returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "pro",
                true,
                "Unassigned",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-where-in-a-compound-subquery-does-not-expose-the-proposed-row', async () => {
        // Slugs of organization 1's projects plus archived ones: 'mktg-site',
        // 'tools' and 'legacy', so project 1 qualifies.
        const expected = { id: 1, name: 'Marketing site (synced)' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const knownSlugs = connection.selectFrom(tProject)
                .where(tProject.organizationId.equals(1))
                .selectOneColumn(tProject.slug)
                .union(
                    connection.selectFrom(tProject)
                        .where(tProject.archivedAt.isNotNull())
                        .selectOneColumn(tProject.slug),
                )
            const query = connection.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site (synced)' })
                .where(tProject.slug.in(knownSlugs))
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBeUndefined()

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = ? returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "Marketing site (synced)",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('do-update-where-in-a-correlated-subquery-does-not-expose-the-proposed-row', async () => {
        // Only when the conflicting project's organization still exists —
        // organization 1 does.
        const expected = { id: 1, name: 'Marketing site (synced)' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const query = connection.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site (synced)' })
                .where(tProject.organizationId.in(
                    connection.subSelectUsing(tProject).from(tOrganization)
                        .where(tOrganization.id.equals(tProject.organizationId))
                        .selectOneColumn(tOrganization.id),
                ))
                .returning({ id: tProject.id, name: tProject.name })

            expect(valuesForInsertTableDiscoveredBy(query)).toBeUndefined()

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = ? returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "Marketing site (synced)",
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */
})
