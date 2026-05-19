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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2) returning id"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (name, organization_id, slug) values ($1, $2, $3), ($4, $5, $6) returning id as id"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, body) values ($1, $2, $3, $4, $5, $6) returning id"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) select $1::int4 as "organizationId", name || $2 as name, slug || $3 as slug from project where organization_id = $4"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2) returning id as id, name as name, plan as plan"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (name, slug, organization_id) values ($1, $2, $3) returning id"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (name, slug, organization_id) values ($1, $2, $3), ($4, $5, $6) returning id as id"`)
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
        // Section "Insert on conflict do nothing" — postgres/sqlite/mariadb/mysql
        // accept `.onConflictDoNothing()`. With RETURNING + executeInsertNoneOrOne
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2) on conflict do nothing returning id as id, name as name, plan as plan"`)
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
        // Section "Insert on conflict do update" — postgres/sqlite require
        // `.onConflictOn(col).doUpdateSet({...})`. MariaDB/MySQL use the
        // bare `.onConflictDoUpdateSet({...})`. This is the targeted
        // form; the bare form lives below as docs-extra.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2) on conflict (id) do update set plan = $3 returning id as id, name as name, plan as plan"`)
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

    // Not applicable on PostgreSQL: PostgreSQL requires onConflictOn(col).doUpdateSet({...}) or onConflictOnConstraint(name).doUpdateSet({...}). The bare-form onConflictDoUpdateSet is typed only on MariaDB / MySQL / SQLite; see test/db/postgres/types.negative/insert.test.ts for the compile-time negative.
    /*
    test('docs-extra:insert/insert-on-conflict-do-update-bare', async () => {
        // MariaDB/MySQL variant of upsert — `.onConflictDoUpdateSet({...})`
        // without a target column. On those engines any unique-key
        // violation triggers the UPDATE.
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
    */

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2) on conflict (id) do update set name = organization.name || $3 || excluded.name returning id as id, name as name, plan as plan"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2) returning id"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2) returning id"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2) returning name as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Initech",
                "free",
              ]
            `)
            assertType<Exact<typeof name, string>>()
        })
    })
})
