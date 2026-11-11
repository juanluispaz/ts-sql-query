// Documentation snippets for the INSERT page (docs/queries/insert.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject, tLedgerEntry } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:insert/insert-one-row', async () => {
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, body) values (?1, ?2, ?3, ?4, ?5, ?6) returning id"`)
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

    test('docs:insert/insert-many-values', async () => {
        ctx.mockNext([50, 51])

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const valuesToInsert = [
                {
                    name:           'Mobile app',
                    slug:           'mobile-1',
                    organizationId: 1,
                },
                {
                    name:           'Dashboard',
                    slug:           'dashboard',
                    organizationId: 1,
                },
            ]

            const insertMultipleProjects = await connection.insertInto(tProject)
                .values(valuesToInsert)
                .returningLastInsertedId()
                .executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (name, slug, organization_id) values (?1, ?2, ?3), (?4, ?5, ?6) returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mobile app",
                "mobile-1",
                1,
                "Dashboard",
                "dashboard",
                1,
              ]
            `)
            assertType<Exact<typeof insertMultipleProjects, number[]>>()
            expect(insertMultipleProjects).toHaveLength(2)
        })
    })

    test('docs:insert/insert-from-select', async () => {
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const insertOrganizationsFromSelect = await connection.insertInto(tOrganization)
                .from(
                    connection.selectFrom(tOrganization)
                        .where(
                            tOrganization.plan.equals('pro')
                        )
                        .select({
                            name: tOrganization.name,
                            plan: tOrganization.plan,
                        })
                )
                .executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) select name as name, plan as plan from organization where plan = ?1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "pro",
              ]
            `)
            assertType<Exact<typeof insertOrganizationsFromSelect, number>>()
            // Only the seeded 'Acme Corp' has the plan 'pro'.
            expect(insertOrganizationsFromSelect).toBe(1)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values (?1, ?2) returning id as id, name as name, plan as plan"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values (?1, ?2) returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Initech",
                "free",
              ]
            `)
            assertType<Exact<typeof id, number>>()
        })
    })

    test('docs:insert/set-when', async () => {
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const assignTheDefaultPlan = true

            const insertedCount = await connection.insertInto(tOrganization).set({
                    name: 'Pied Piper',
                    plan: 'pro',
                })
                .setWhen(assignTheDefaultPlan, { plan: 'free' })
                .executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values (?1, ?2)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Pied Piper",
                "free",
              ]
            `)
            assertType<Exact<typeof insertedCount, number>>()
            expect(insertedCount).toBe(1)
        })
    })

    test('docs-extra:insert/set-when-does-not-set-required', async () => {
        // A required column set only through a `When` variant stays missing: the
        // execute methods appear once `set` provides it.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const missingPlan = connection.insertInto(tOrganization)
                .dynamicSet()
                .set({ name: 'Pied Piper' })
                .setWhen(true, { plan: 'pro' })
            assertType<Exact<'executeInsert' extends keyof typeof missingPlan ? true : false, false>>()

            const withPlan = missingPlan.set({ plan: 'free' })
            assertType<Exact<'executeInsert' extends keyof typeof withPlan ? true : false, true>>()

            const insertedCount = await withPlan.executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values (?1, ?2)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Pied Piper",
                "free",
              ]
            `)
            assertType<Exact<typeof insertedCount, number>>()
            expect(insertedCount).toBe(1)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values (?1, ?2) returning name as result"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values (?1, ?2) returning id"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values (?1, ?2) returning id"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values (?1, ?2) returning id"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?1, ?2, ?3, ?4, ?5) returning id"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?1, ?2, ?3, ?4, ?5) returning id"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?1, ?2, ?3, ?4, ?5) returning id"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values (?1, ?2) returning id"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (name, slug, organization_id) values (?1, ?2, ?3), (?4, ?5, ?6) returning id as id"`)
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

    test('docs:insert/set-for-all-when', async () => {
        ctx.mockNext(2)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const assignTheDefaultOrganization = true

            const insertedCount = await connection.insertInto(tProject).values([
                    { name: 'Mobile app', slug: 'mobile', organizationId: 2 },
                    { name: 'Dashboard',  slug: 'dash',   organizationId: 2 },
                ])
                .setForAllWhen(assignTheDefaultOrganization, { organizationId: 1 })
                .executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (name, slug, organization_id) values (?1, ?2, ?3), (?4, ?5, ?6)"`)
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
            assertType<Exact<typeof insertedCount, number>>()
            expect(insertedCount).toBe(2)
        })
    })

    test('docs:insert/returning-one-column', async () => {
        ctx.mockNext('Triage backlog')

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const insertedTitle = await connection.insertInto(tIssue)
                .set({
                    projectId: 1,
                    number:    99,
                    title:     'Triage backlog',
                    status:    'open',
                    priority:  2,
                })
                .returningOneColumn(tIssue.title)
                .executeInsertOne()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?1, ?2, ?3, ?4, ?5) returning title as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                99,
                "Triage backlog",
                "open",
                2,
              ]
            `)
            assertType<Exact<typeof insertedTitle, string>>()
            expect(insertedTitle).toBe('Triage backlog')
        })
    })

    test('docs:insert/manipulating-values', async () => {
        ctx.mockNext(7)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const received = {
                id:        9999,
                projectId: 1,
                number:    99,
                title:     'Triage backlog',
                status:    'open',
                priority:  2,
                body:      null,
            }

            const issueId = await connection.insertInto(tIssue)
                .set(received)
                .ignoreIfSet('id')
                .ignoreIfHasNoValue('body')
                .disallowIfNoValue('The title is mandatory', 'title')
                .returningLastInsertedId()
                .executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?1, ?2, ?3, ?4, ?5) returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                99,
                "Triage backlog",
                "open",
                2,
              ]
            `)
            assertType<Exact<typeof issueId, number>>()
            expect(typeof issueId).toBe('number')
            if (!ctx.realDbEnabled) expect(issueId).toBe(7)
        })
    })

    test('docs:insert/insert-default-values', async () => {
        ctx.mockNext(1001)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const entryNo = await connection.insertInto(tLedgerEntry)
                .defaultValues()
                .returningLastInsertedId()
                .executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into ledger_entry default values returning entry_no"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof entryNo, number>>()
            expect(typeof entryNo).toBe('number')
        })
    })
})
