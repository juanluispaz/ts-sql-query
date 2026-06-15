// Documentation snippets for the INSERT page (docs/queries/insert.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:insert/insert-one-set', async () => {
        ctx.mockNext(42)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const id = await connection.insertInto(tOrganization)
                .set({
                    name: 'Initrode',
                    plan: 'free',
                })
                .returningLastInsertedId()
                .executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, "plan") values (?, ?) returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Initrode",
                "free",
              ]
            `)
            assertType<Exact<typeof id, number>>()
            expect(typeof id).toBe('number')
            if (!ctx.realDbEnabled) expect(id).toBe(42)
        })
    })

    test('docs:insert/insert-many-values', async () => {
        ctx.mockNext([{ id: 50 }, { id: 51 }])

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const valuesToInsert = [
                { name: 'Mobile app',  organizationId: 1, slug: 'mobile-1'  },
                { name: 'Dashboard',   organizationId: 1, slug: 'dashboard' },
            ]
            const inserted = await connection.insertInto(tProject)
                .values(valuesToInsert)
                .returning({ id: tProject.id })
                .executeInsertMany()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (name, organization_id, slug) values (?, ?, ?), (?, ?, ?) returning id as id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mobile app",
                1,
                "mobile-1",
                "Dashboard",
                1,
                "dashboard",
              ]
            `)
            assertType<Exact<typeof inserted, Array<{ id: number }>>>()
            expect(inserted).toHaveLength(2)
        })
    })

    test('docs:insert/insert-set-if-not-set', async () => {
        ctx.mockNext(7)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const id = await connection.insertInto(tIssue)
                .set({
                    projectId: 1,
                    number:    99,
                    title:     'Triage backlog',
                    status:    'open',
                    priority:  2,
                })
                .setIfNotSet({
                    body: 'Filled in by setIfNotSet',
                })
                .returningLastInsertedId()
                .executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, body) values (?, ?, ?, ?, ?, ?) returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                99,
                "Triage backlog",
                "open",
                2,
                "Filled in by setIfNotSet",
              ]
            `)
            assertType<Exact<typeof id, number>>()
            expect(typeof id).toBe('number')
            if (!ctx.realDbEnabled) expect(id).toBe(7)
        })
    })

    test('docs:insert/insert-from-select', async () => {
        ctx.mockNext(2)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const inserted = await connection.insertInto(tProject)
                .from(
                    connection.selectFrom(tProject)
                        .where(tProject.organizationId.equals(1))
                        .select({
                            organizationId: connection.const(2, 'int'),
                            name:           tProject.name.concat(' (clone)'),
                            slug:           tProject.slug.concat('-clone'),
                        })
                )
                .executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) select ? as organizationId, name || ? as name, slug || ? as slug from project where organization_id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
                " (clone)",
                "-clone",
                1,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(typeof inserted).toBe('number')
            if (!ctx.realDbEnabled) expect(inserted).toBe(2)
        })
    })

    test('docs:insert/insert-returning', async () => {
        // Section "Insert returning" — `returning({...})` returns columns
        // of the inserted row (via RETURNING / OUTPUT depending on
        // dialect). Final method is `executeInsertOne()` for one returned
        // row.
        ctx.mockNext({ id: 9, name: 'Globex Subsidiary', plan: 'pro' })

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const inserted = await connection.insertInto(tOrganization)
                .set({
                    name: 'Globex Subsidiary',
                    plan: 'pro',
                })
                .returning({
                    id:   tOrganization.id,
                    name: tOrganization.name,
                    plan: tOrganization.plan,
                })
                .executeInsertOne()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, "plan") values (?, ?) returning id as id, name as name, "plan" as "plan""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Globex Subsidiary",
                "pro",
              ]
            `)
            assertType<Exact<typeof inserted, { id: number; name: string; plan: string }>>()
            expect(inserted.name).toBe('Globex Subsidiary')
        })
    })

    test('docs:insert/insert-with-shape', async () => {
        // Section "Insert with value's shape" — `shapedAs(...)` renames
        // the source-object keys to the actual column names; `extendShape`
        // tacks on additional mappings.
        ctx.mockNext(77)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const projectToInsert = {
                projectName: 'Operations',
                projectSlug: 'ops',
            }
            const currentOrgId = 1

            const id = await connection.insertInto(tProject)
                .shapedAs({
                    projectName: 'name',
                    projectSlug: 'slug',
                }).set(projectToInsert)
                .extendShape({
                    projectOrganizationId: 'organizationId',
                }).set({
                    projectOrganizationId: currentOrgId,
                })
                .returningLastInsertedId()
                .executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (name, slug, organization_id) values (?, ?, ?) returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Operations",
                "ops",
                1,
              ]
            `)
            assertType<Exact<typeof id, number>>()
            expect(typeof id).toBe('number')
        })
    })

    test('docs:insert/insert-multiple-with-shape', async () => {
        // Section "Insert multiple with value's shape" — combine
        // `shapedAs` with `values(arr)` + `extendShape` + `setForAll` to
        // apply a constant to every row.
        ctx.mockNext([{ id: 81 }, { id: 82 }])

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const projectsToInsert = [
                { projectName: 'Mobile app', projectSlug: 'mobile' },
                { projectName: 'Dashboard',  projectSlug: 'dash' },
            ]
            const currentOrgId = 1

            const inserted = await connection.insertInto(tProject)
                .shapedAs({
                    projectName: 'name',
                    projectSlug: 'slug',
                })
                .values(projectsToInsert)
                .extendShape({
                    projectOrganizationId: 'organizationId',
                }).setForAll({
                    projectOrganizationId: currentOrgId,
                })
                .returning({ id: tProject.id })
                .executeInsertMany()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (name, slug, organization_id) values (?, ?, ?), (?, ?, ?) returning id as id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mobile app",
                "mobile",
                1,
                "Dashboard",
                "dash",
                1,
              ]
            `)
            assertType<Exact<typeof inserted, Array<{ id: number }>>>()
            expect(inserted).toHaveLength(2)
        })
    })

    test('docs:insert/insert-on-conflict-do-nothing', async () => {
        // Section "Insert on conflict do nothing" — `.onConflictDoNothing()`
        // with RETURNING + executeInsertNoneOrOne
        // the result is `T | null` (the row is null when the conflict
        // suppressed the insert).
        ctx.mockNext({ id: 1, name: 'Acme Corp', plan: 'pro' })

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const maybeInserted = await connection.insertInto(tOrganization)
                .set({
                    name: 'Acme Corp',
                    plan: 'pro',
                })
                .onConflictDoNothing()
                .returning({
                    id:   tOrganization.id,
                    name: tOrganization.name,
                    plan: tOrganization.plan,
                })
                .executeInsertNoneOrOne()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, "plan") values (?, ?) on conflict do nothing returning id as id, name as name, "plan" as "plan""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Acme Corp",
                "pro",
              ]
            `)
            assertType<Exact<typeof maybeInserted, { id: number; name: string; plan: string } | null>>()
        })
    })

    test('docs:insert/insert-on-conflict-do-update', async () => {
        // Section "Insert on conflict do update" — the targeted
        // `.onConflictOn(col).doUpdateSet({...})` form. The bare
        // `.onConflictDoUpdateSet({...})` form lives below as docs-extra.
        ctx.mockNext({ id: 1, name: 'Acme Corp', plan: 'enterprise' })

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const upserted = await connection.insertInto(tOrganization)
                .set({
                    name: 'Acme Corp',
                    plan: 'pro',
                })
                .onConflictOn(tOrganization.id)
                .doUpdateSet({
                    plan: 'enterprise',
                })
                .returning({
                    id:   tOrganization.id,
                    name: tOrganization.name,
                    plan: tOrganization.plan,
                })
                .executeInsertOne()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, "plan") values (?, ?) on conflict (id) do update set "plan" = ? returning id as id, name as name, "plan" as "plan""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Acme Corp",
                "pro",
                "enterprise",
              ]
            `)
            assertType<Exact<typeof upserted, { id: number; name: string; plan: string }>>()
        })
    })

    test('docs-extra:insert/insert-on-conflict-do-update-bare', async () => {
        // The bare upsert variant — `.onConflictDoUpdateSet({...})`
        // without a target column. Any unique-key violation triggers the
        // UPDATE.
        ctx.mockNext({ id: 1, name: 'Acme Corp', plan: 'pro' })

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const upserted = await connection.insertInto(tOrganization)
                .set({
                    name: 'Acme Corp',
                    plan: 'pro',
                })
                .onConflictDoUpdateSet({
                    plan: 'enterprise',
                })
                .returning({
                    id:   tOrganization.id,
                    name: tOrganization.name,
                    plan: tOrganization.plan,
                })
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, "plan") values (?, ?) on conflict do update set "plan" = ? returning id as id, name as name, "plan" as "plan""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Acme Corp",
                "pro",
                "enterprise",
              ]
            `)
            assertType<Exact<typeof upserted, { id: number; name: string; plan: string }>>()
        })
    })

    test('docs-extra:insert/values-for-insert-in-update', async () => {
        // Section trailing block: `valuesForInsert()` gives access to the
        // incoming-row representation so the update body can reference
        // both the existing row's columns and the new values.
        ctx.mockNext({ id: 1, name: 'Acme Corp / Acme Corp', plan: 'pro' })

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const tOrgForInsert = tOrganization.valuesForInsert()
            const upserted = await connection.insertInto(tOrganization)
                .set({
                    name: 'Acme Corp',
                    plan: 'pro',
                })
                .onConflictOn(tOrganization.id)
                .doUpdateSet({
                    name: tOrganization.name.concat(' / ').concat(tOrgForInsert.name),
                })
                .returning({
                    id:   tOrganization.id,
                    name: tOrganization.name,
                    plan: tOrganization.plan,
                })
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, "plan") values (?, ?) on conflict (id) do update set name = organization.name || ? || excluded.name returning id as id, name as name, "plan" as "plan""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Acme Corp",
                "pro",
                " / ",
              ]
            `)
            assertType<Exact<typeof upserted, { id: number; name: string; plan: string }>>()
        })
    })

    test('docs-extra:insert/dynamic-set', async () => {
        // "Manipulating values to insert" prose: `dynamicSet()` lets you
        // start an insert with no values and progressively add them; you
        // get a compile error if a required column is still missing at
        // execute time.
        ctx.mockNext(99)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const id = await connection.insertInto(tOrganization)
                .dynamicSet()
                .set({ name: 'Initech', plan: 'free' })
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, "plan") values (?, ?) returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Initech",
                "free",
              ]
            `)
            assertType<Exact<typeof id, number>>()
        })
    })

    test('docs-extra:insert/set-when', async () => {
        // "Manipulating values to insert" prose: the `When` variants take
        // a boolean and only apply the chained set when it is true.
        ctx.mockNext(100)

        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const includePlan = true

            const id = await connection.insertInto(tOrganization)
                .set({ name: 'Pied Piper', plan: 'free' })
                .setWhen(includePlan, { plan: 'pro' })
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, "plan") values (?, ?) returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Pied Piper",
                "pro",
              ]
            `)
            assertType<Exact<typeof id, number>>()
        })
    })

    test('docs-extra:insert/insert-returning-one-column', async () => {
        // "Insert returning" prose: `returningOneColumn(column)` returns
        // only the requested column value (single column variant of
        // `returning({...})`).
        ctx.mockNext('Initech')

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const name = await connection.insertInto(tOrganization)
                .set({ name: 'Initech', plan: 'free' })
                .returningOneColumn(tOrganization.name)
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, "plan") values (?, ?) returning name as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Initech",
                "free",
              ]
            `)
            assertType<Exact<typeof name, string>>()
        })
    })

    test('docs-extra:insert/set-if-value-null-skips', async () => {
        // "Manipulating values to insert" prose: `setIfValue(...)` only
        // applies entries whose value is not null/undefined/empty-string/
        // empty-array. A null `plan` is dropped, so the column is NOT
        // emitted in the INSERT.
        ctx.mockNext(42)

        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const newPlan: string | null = null

            const id = await connection.insertInto(tOrganization)
                .set({ name: 'Initech', plan: 'free' })
                .setIfValue({ plan: newPlan })
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, "plan") values (?, ?) returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Initech",
                "free",
              ]
            `)
            assertType<Exact<typeof id, number>>()
        })
    })

    test('docs-extra:insert/set-if-value-empty-string-skips', async () => {
        // "Manipulating values to insert" prose: empty strings are treated
        // as "no value" by setIfValue (unless `allowEmptyString` is on,
        // which is off by default).
        ctx.mockNext(42)

        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const newPlan = ''

            const id = await connection.insertInto(tOrganization)
                .set({ name: 'Initech', plan: 'free' })
                .setIfValue({ plan: newPlan })
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, "plan") values (?, ?) returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Initech",
                "free",
              ]
            `)
            assertType<Exact<typeof id, number>>()
        })
    })

    test('docs-extra:insert/set-if-set-overrides-existing', async () => {
        // "Manipulating values to insert" prose: `setIfSet({...})` writes a
        // value ONLY when that key was already set in a previous step;
        // overriding an existing `plan`.
        ctx.mockNext(42)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const id = await connection.insertInto(tOrganization)
                .set({ name: 'Initech', plan: 'free' })
                .setIfSet({ plan: 'pro' })
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, "plan") values (?, ?) returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Initech",
                "pro",
              ]
            `)
            assertType<Exact<typeof id, number>>()
        })
    })

    test('docs-extra:insert/ignore-if-set-drops-column', async () => {
        // "Manipulating values to insert" prose: `ignoreIfSet(col, ...)`
        // removes the listed columns from a previous set, so they are not
        // emitted in the SQL.
        ctx.mockNext(42)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const id = await connection.insertInto(tIssue)
                .set({
                    projectId: 1,
                    number:    99,
                    title:     'Triage backlog',
                    status:    'open',
                    priority:  2,
                    body:      'will be dropped',
                })
                .ignoreIfSet('body')
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?) returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                99,
                "Triage backlog",
                "open",
                2,
              ]
            `)
            assertType<Exact<typeof id, number>>()
        })
    })

    test('docs-extra:insert/keep-only-filters-columns', async () => {
        // "Manipulating values to insert" prose: `keepOnly(col, ...)`
        // drops every previously-set column not in the allowlist.
        ctx.mockNext(42)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const id = await connection.insertInto(tIssue)
                .set({
                    projectId: 1,
                    number:    99,
                    title:     'Triage backlog',
                    status:    'open',
                    priority:  2,
                    body:      'will be dropped',
                })
                .keepOnly('projectId', 'number', 'title', 'status', 'priority')
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?) returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                99,
                "Triage backlog",
                "open",
                2,
              ]
            `)
            assertType<Exact<typeof id, number>>()
        })
    })

    test('docs-extra:insert/ignore-any-set-with-no-value', async () => {
        // "Manipulating values to insert" prose:
        // `ignoreAnySetWithNoValue()` drops every previously-set column
        // whose value is null/undefined/empty-string/empty-array — useful
        // after a chain of `setIfValue` calls when you want a single
        // sweep at the end. Demonstrated on the optional `body` column.
        ctx.mockNext(42)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const id = await connection.insertInto(tIssue)
                .set({
                    projectId: 1,
                    number:    99,
                    title:     'Triage backlog',
                    status:    'open',
                    priority:  2,
                    body:      '',
                })
                .ignoreAnySetWithNoValue()
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?) returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                99,
                "Triage backlog",
                "open",
                2,
              ]
            `)
            assertType<Exact<typeof id, number>>()
        })
    })

    test('docs-extra:insert/disallow-if-set-throws', async () => {
        // "Manipulating values to insert" prose: `disallowIfSet(msg, ...cols)`
        // throws if any listed column was previously set, BEFORE the
        // statement is executed.
        const connection = ctx.conn

        expect(() => {
            connection.insertInto(tOrganization)
                .set({ name: 'Initech', plan: 'free' })
                .disallowIfSet('plan must be assigned by the server', 'plan')
        }).toThrow(/plan must be assigned by the server/)
    })

    test('docs-extra:insert/disallow-if-not-set-throws', async () => {
        // "Manipulating values to insert" prose:
        // `disallowIfNotSet(msg, ...cols)` throws if any listed column is
        // missing. Use it as a defensive check after dynamic chains.
        const connection = ctx.conn

        expect(() => {
            connection.insertInto(tOrganization)
                .dynamicSet()
                .set({ name: 'Initech' })
                .disallowIfNotSet('plan is required by policy', 'plan')
        }).toThrow(/plan is required by policy/)
    })

    test('docs-extra:insert/disallow-any-other-set-throws', async () => {
        // "Manipulating values to insert" prose:
        // `disallowAnyOtherSet(msg, ...allowlist)` throws if any column
        // NOT in the allowlist is set.
        const connection = ctx.conn

        expect(() => {
            connection.insertInto(tOrganization)
                .set({ name: 'Initech', plan: 'free' })
                .disallowAnyOtherSet('only name may be set by this path', 'name')
        }).toThrow(/only name may be set by this path/)
    })

    test('docs-extra:insert/set-when-false-skips', async () => {
        // "Manipulating values to insert" prose: every method has a
        // `When` variant — `setWhen(false, ...)` is a no-op, so the chain
        // emits only what `set(...)` already had.
        ctx.mockNext(42)

        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const includeUpgrade = false

            const id = await connection.insertInto(tOrganization)
                .set({ name: 'Initech', plan: 'free' })
                .setWhen(includeUpgrade, { plan: 'pro' })
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, "plan") values (?, ?) returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Initech",
                "free",
              ]
            `)
            assertType<Exact<typeof id, number>>()
        })
    })

    test('docs-extra:insert/set-for-all-if-value-multi', async () => {
        // "Manipulating values to insert (multiple)" prose:
        // `setForAllIfValue({...})` applies a value to every row of a
        // multi-row insert, but skips null/empty values — the column is
        // omitted from the emitted INSERT entirely.
        ctx.mockNext([{ id: 81 }, { id: 82 }])

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const inserted = await connection.insertInto(tProject)
                .values([
                    { name: 'Mobile app', slug: 'mobile', organizationId: 1 },
                    { name: 'Dashboard',  slug: 'dash',   organizationId: 1 },
                ])
                .setForAllIfValue({ archivedAt: null })
                .returning({ id: tProject.id })
                .executeInsertMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (name, slug, organization_id) values (?, ?, ?), (?, ?, ?) returning id as id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mobile app",
                "mobile",
                1,
                "Dashboard",
                "dash",
                1,
              ]
            `)
            assertType<Exact<typeof inserted, Array<{ id: number }>>>()
        })
    })
})
