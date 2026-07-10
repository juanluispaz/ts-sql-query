// Coverage of INSERT … ON CONFLICT DO NOTHING / DO UPDATE patterns.
// Runs where the dialect supports the ON CONFLICT / upsert syntax;
// commented out elsewhere for symmetry.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tOrganization, tProject, tProjectReview, tReleaseDraft } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('on-conflict-do-nothing', async () => {
        ctx.mockNext(0)

        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .values({ name: 'Acme Corp', plan: 'free' })  // collides with seed
                .onConflictDoNothing()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2) on conflict do nothing"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Acme Corp",
                "free",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            // 0 inserted rows because of the conflict.
            if (ctx.realDbEnabled) {
                // No conflict actually happens here since (name, plan) is
                // not a unique key; but the SQL still includes ON CONFLICT.
                // We just assert the call returns a number.
                expect(typeof inserted).toBe('number')
            } else {
                expect(inserted).toBe(0)
            }
        })
    })

    // NOT-APPLICABLE: PostgreSQL rejects `ON CONFLICT DO UPDATE` without an inference target (`(col)` or `ON CONSTRAINT name`), so the connection blocks the bare form at compile time; PostgreSQL users go through the `on-conflict-on-columns-do-update` test below. The body is kept as commented documentation for cross-cell symmetry.
    /*
    test('on-conflict-do-update', async () => {
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            // tProject has UNIQUE (organization_id, slug). Inserting an
            // existing slug + org pair triggers conflict → update.
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictDoUpdateSet({ name: 'Marketing site v2' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict do update set name = $4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "Marketing site v2",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) {
                expect(typeof affected).toBe('number')
                // Confirm the row was updated, not inserted.
                const project = await ctx.conn.selectFrom(tProject)
                    .where(tProject.id.equals(1))
                    .selectOneColumn(tProject.name)
                    .executeSelectOne()
                expect(project).toBe('Marketing site v2')
            } else {
                expect(affected).toBe(1)
            }
        })
    })
    */

    test('on-conflict-on-columns-do-update', async () => {
        // ON CONFLICT (cols) DO UPDATE. The emitted form is pinned by the
        // snapshot below.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Updated mktg' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Updated mktg' })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Updated mktg",
                "Updated mktg",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) {
                expect(typeof affected).toBe('number')
            } else {
                expect(affected).toBe(1)
            }
        })
    })

    // NOT-APPLICABLE: the bare `.onConflictDoUpdateSet({...})` form is blocked at compile time on PostgreSQL (needs `.onConflictOn(col)` / `.onConflictOnConstraint(name)`); see this dialect's `types.negative` suite and the active `on-conflict-on-columns-do-update` test above.
    /*
    test('on-conflict-do-update-with-expression', async () => {
        // Not applicable on PostgreSQL: the bare `.onConflictDoUpdateSet({...})`
        // form is blocked at compile time on PG (needs `.onConflictOn(col)` /
        // `.onConflictOnConstraint(name)`). See this dialect's `types.negative` suite
        // and the active `on-conflict-on-columns-do-update` test above.
    })
    */

    // NOT-APPLICABLE: the bare `.onConflictDoUpdateSet({...})` form is blocked at compile time on PostgreSQL (needs `.onConflictOn(col)` / `.onConflictOnConstraint(name)`); see this dialect's `types.negative` suite and the active `on-conflict-on-columns-do-update` test above.
    /*
    test('on-conflict-do-update-with-inserted-row-ref', async () => {
        // Not applicable on PostgreSQL: the bare `.onConflictDoUpdateSet({...})`
        // form is blocked at compile time on PG (needs `.onConflictOn(col)` /
        // `.onConflictOnConstraint(name)`). See this dialect's `types.negative` suite
        // and the active `on-conflict-on-columns-do-update` test above.
    })
    */

    test('on-conflict-on-constraint-do-nothing', async () => {
        // `.onConflictOnConstraint(rawFragment\`name\`)` — PostgreSQL accepts
        // both `(cols)` and `ON CONSTRAINT name` as conflict targets. The
        // constraint name is supplied as a raw SQL fragment because it is a
        // SQL identifier (must come from DB introspection, not from runtime
        // values). The unique constraint `app_user_email_key` is the
        // PostgreSQL default name for the inline `email VARCHAR(255) NOT
        // NULL UNIQUE` declaration in domain/schema.sql.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tAppUser)
                .values({ email: 'ada@acme.test', fullName: 'Ada Lovelace v2' })  // collides with seed
                .onConflictOnConstraint(ctx.conn.rawFragment`app_user_email_key`)
                .doNothing()
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values ($1, $2) on conflict on constraint app_user_email_key do nothing"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "ada@acme.test",
                "Ada Lovelace v2",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            if (ctx.realDbEnabled) {
                expect(typeof inserted).toBe('number')
            } else {
                expect(inserted).toBe(0)
            }
        })
    })

    test('on-conflict-do-nothing-returning-last-inserted-id-is-nullable', async () => {
        // chaining returningLastInsertedId() after onConflictDoNothing()
        // makes the last id optional (`number | null`) — a conflict may
        // suppress the insert, so there may be no id to return. (No unique key
        // actually collides here, so the insert succeeds and a real id comes
        // back; the `| null` arm is the type promise this pins.)
        const expectedMock = 100
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const id = await ctx.conn.insertInto(tOrganization)
                .values({ name: 'Conflict demo', plan: 'free' })
                .onConflictDoNothing()
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2) on conflict do nothing returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Conflict demo",
                "free",
              ]
            `)
            assertType<Exact<typeof id, number | null>>()

            if (!ctx.realDbEnabled) expect(id).toBe(100)
            else expect(id).toBeGreaterThan(2) // seed reserves org ids 1, 2

            // The value arm the non-null mock above never realizes: a suppressed
            // insert returns no id, so — with the mock forcing an absent id — the
            // `onConflictDoNothing()` chain must RESOLVE `null` (the guard is
            // skipped for do-nothing) rather than throw. On the real engine no key
            // collides, so a real id still comes back.
            ctx.mockNext(null)
            const suppressedId = await ctx.conn.insertInto(tOrganization)
                .values({ name: 'Conflict demo', plan: 'free' })
                .onConflictDoNothing()
                .returningLastInsertedId()
                .executeInsert()
            assertType<Exact<typeof suppressedId, number | null>>()
            if (!ctx.realDbEnabled) expect(suppressedId).toBeNull()
            else expect(suppressedId).toBeGreaterThan(2)
        })
    })
    test('on-conflict-on-columns-do-update-set-value-source-with-values-for-insert', async () => {
        // `doUpdateSet` accepts a value-source RHS referencing both the
        // existing column and the attempted-insert row via `valuesForInsert()`
        // (PG renders the latter as `excluded.<col>`). On conflict, `name`
        // becomes the old name concatenated with the row that tried to insert.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: '+v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: tProject.name.concat(tProject.valuesForInsert().name) })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = project.name || excluded.name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "+v2",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })

    test('on-conflict-on-constraint-do-update', async () => {
        // `.onConflictOnConstraint(rawFragment`name`).doUpdateSet({...})` — the
        // DO UPDATE arm off a named-constraint conflict target. The do-nothing
        // arm off a constraint is covered by `on-conflict-on-constraint-do-nothing`
        // and the column-target do-update by `on-conflict-on-columns-do-update`;
        // this pins the constraint-target × do-update combination. The unique
        // constraint `app_user_email_key` is PostgreSQL's default name for the
        // inline `email ... UNIQUE` declaration in domain/schema.sql.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tAppUser)
                .values({ email: 'ada@acme.test', fullName: 'Ada Lovelace v2' })  // collides with seed
                .onConflictOnConstraint(ctx.conn.rawFragment`app_user_email_key`)
                .doUpdateSet({ fullName: 'Ada Lovelace v2' })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values ($1, $2) on conflict on constraint app_user_email_key do update set full_name = $3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "ada@acme.test",
                "Ada Lovelace v2",
                "Ada Lovelace v2",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) {
                expect(typeof affected).toBe('number')
            } else {
                expect(affected).toBe(1)
            }
        })
    })

    test('on-conflict-do-nothing-returning-one-column', async () => {
        // `returningOneColumn(...)` after `onConflictDoNothing()` — the conflict
        // arm may suppress the insert, so the column is None-or-One (`string |
        // null`). No unique key actually collides here, so a real row inserts
        // and its `name` comes back.
        ctx.mockNext('Conflict demo')
        await ctx.withRollback(async () => {
            const name = await ctx.conn.insertInto(tOrganization)
                .values({ name: 'Conflict demo', plan: 'free' })
                .onConflictDoNothing()
                .returningOneColumn(tOrganization.name)
                .executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2) on conflict do nothing returning name as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Conflict demo",
                "free",
              ]
            `)
            assertType<Exact<typeof name, string | null>>()
            expect(name).toBe('Conflict demo')
        })
    })

    test('on-conflict-on-columns-do-update-returning-one-column', async () => {
        // `returningOneColumn(...)` after `onConflictOn(...).doUpdateSet(...)` —
        // the upsert always produces a row (insert or update), so the column is
        // required (`string`). tProject has UNIQUE (organization_id, slug);
        // (1, 'mktg-site') collides with the seed, so the row is updated and the
        // new name is returned.
        ctx.mockNext('Updated mktg')
        await ctx.withRollback(async () => {
            const name = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Updated mktg' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Updated mktg' })
                .returningOneColumn(tProject.name)
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4 returning name as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Updated mktg",
                "Updated mktg",
              ]
            `)
            assertType<Exact<typeof name, string>>()
            expect(name).toBe('Updated mktg')
        })
    })

    test('on-conflict-on-columns-do-update-where-returning-object', async () => {
        // `onConflictOn(cols).doUpdateSet(...).where(cond).returning({obj})` --
        // the partial-UPDATE-WHERE node still carries the full RETURNING surface.
        // The WHERE can suppress the update, so RETURNING is None-or-One. tProject
        // has UNIQUE (organization_id, slug); (1, 'mktg-site') collides with the
        // seed and the WHERE (name differs from the new value) is satisfied, so
        // the row is updated and its {id, name} come back.
        const expected = { id: 1, name: 'Updated mktg where' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Updated mktg where' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Updated mktg where' })
                .where(tProject.name.notEquals('Updated mktg where'))
                .returning({ id: tProject.id, name: tProject.name })
                .executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4 where project.name <> $5 returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Updated mktg where",
                "Updated mktg where",
                "Updated mktg where",
              ]
            `)
            assertType<Exact<typeof row, { id: number, name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })

    test('multi-row-on-conflict-on-columns-do-update-returning-object', async () => {
        // Multi-row VALUES + targeted on-conflict + `returning({obj})`
        // (executeInsertMany). `doUpdateSet` uses a `valuesForInsert()` RHS so
        // each conflicting row updates to its own attempted name. Both rows
        // collide on the existing projects 1 ('mktg-site') and 2 ('tools'), so
        // DO UPDATE produces a row for each and RETURNING yields their {id, name}.
        const expected = [
            { id: 1, name: 'Upd A' },
            { id: 2, name: 'Upd B' },
        ]
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const rows = await ctx.conn.insertInto(tProject)
                .values([
                    { organizationId: 1, slug: 'mktg-site', name: 'Upd A' },
                    { organizationId: 1, slug: 'tools', name: 'Upd B' },
                ])
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: tProject.valuesForInsert().name })
                .returning({ id: tProject.id, name: tProject.name })
                .executeInsertMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3), ($4, $5, $6) on conflict (organization_id, slug) do update set name = excluded.name returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Upd A",
                1,
                "tools",
                "Upd B",
              ]
            `)
            assertType<Exact<typeof rows, Array<{ id: number, name: string }>>>()
            expect([...rows].sort((a, b) => a.id - b.id)).toEqual(expected)
        })
    })

    test('multi-row-on-conflict-on-columns-do-update-returning-one-column', async () => {
        // Multi-row VALUES + targeted on-conflict + `returningOneColumn(...)`.
        // `doUpdateSet` uses a `valuesForInsert()` RHS so each conflicting row
        // updates to its own attempted name. Both rows collide on the existing
        // projects 1 ('mktg-site') and 2 ('tools'), so DO UPDATE produces a row
        // for each and RETURNING name yields their new names.
        const expected = ['Upd A', 'Upd B']
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const names = await ctx.conn.insertInto(tProject)
                .values([
                    { organizationId: 1, slug: 'mktg-site', name: 'Upd A' },
                    { organizationId: 1, slug: 'tools', name: 'Upd B' },
                ])
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: tProject.valuesForInsert().name })
                .returningOneColumn(tProject.name)
                .executeInsertMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3), ($4, $5, $6) on conflict (organization_id, slug) do update set name = excluded.name returning name as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Upd A",
                1,
                "tools",
                "Upd B",
              ]
            `)
            assertType<Exact<typeof names, string[]>>()
            expect([...names].sort()).toEqual([...expected].sort())
        })
    })

    test('multi-row-on-conflict-on-columns-do-update-returning-object-with-optional-column', async () => {
        // Multi-row VALUES + targeted on-conflict + `returning({obj})` whose
        // projection includes an OPTIONAL column (`assigneeId`), executed via
        // `executeInsertMany`. Because tIssue.assigneeId is a nullable column,
        // the returned row type carries it as `assigneeId?: number` (optional),
        // unlike the required-only `{id, name}` sibling above. Both rows collide
        // on the seeded issues (project 1, numbers 1 & 2) via UNIQUE(project_id,
        // number), so DO UPDATE refreshes `title` (via `valuesForInsert()`) and
        // RETURNING yields their {id, assigneeId} — the upsert never touches
        // assignee_id, so each row's seeded assignee comes back.
        const expected = [
            { id: 1, assigneeId: 1 },
            { id: 2, assigneeId: 2 },
        ]
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const rows = await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 1, title: 'Upd hero', status: 'open',        priority: 2 },
                    { projectId: 1, number: 2, title: 'Upd nav',  status: 'in_progress', priority: 1 },
                ])
                .onConflictOn(tIssue.projectId, tIssue.number)
                .doUpdateSet({ title: tIssue.valuesForInsert().title })
                .returning({ id: tIssue.id, assigneeId: tIssue.assigneeId })
                .executeInsertMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10) on conflict (project_id, number) do update set title = excluded.title returning id as id, assignee_id as "assigneeId""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                1,
                "Upd hero",
                "open",
                2,
                1,
                2,
                "Upd nav",
                "in_progress",
                1,
              ]
            `)
            assertType<Exact<typeof rows, Array<{ id: number, assigneeId?: number }>>>()
            expect([...rows].sort((a, b) => a.id - b.id)).toEqual(expected)
        })
    })

    test('on-conflict-on-columns-do-update-scaled-adapter-set-and-where', async () => {
        // `tProjectReview.score` carries a value-transform adapter (write ×10 /
        // read ÷10), routed through ON CONFLICT DO UPDATE SET and its WHERE. The
        // insert score 3 binds 30, the DO UPDATE SET value 5 binds 50 and the DO
        // UPDATE WHERE threshold 4 binds 40. The insert takes a fresh id, so no
        // conflict fires and RETURNING reads the inserted score back through the
        // adapter (stored 30 → read 3).
        const expected = { score: 3 }
        // The mock is primed with the RAW db value (30); the scaledTenthAdapter
        // divides by 10 on read to yield the asserted 3.
        ctx.mockNext({ score: 30 })
        await ctx.withRollback(async () => {
            const row = await ctx.conn.insertInto(tProjectReview)
                .values({
                    projectId:    1,
                    reviewerCode: 'R-1',
                    score:        3,
                    reviewTime:   new Date(Date.UTC(1970, 0, 1, 9, 30, 0)),
                })
                .onConflictOn(tProjectReview.id)
                .doUpdateSet({ score: 5 })
                .where(tProjectReview.score.greaterThan(4))
                .returning({ score: tProjectReview.score })
                .executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project_review (project_id, reviewer_code, score, review_time) values ($1, $2, $3, $4) on conflict (id) do update set score = $5 where project_review.score > $6 returning score as score"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "R-1",
                30,
                "09:30:00",
                50,
                40,
              ]
            `)
            assertType<Exact<typeof row, { score: number } | null>>()
            expect(row).toEqual(expected)
        })
    })


    test('on-conflict-on-id-do-update-optional-custom-columns', async () => {
        // DO UPDATE of the optional custom-kind columns (enum / custom / customComparable) via
        // `onConflictOn(<pk>).doUpdateSet(...)`. Inserting id=1 collides with the seeded draft 1
        // (release_draft PK), so the row is updated: stage → 'final', channel → 'stable', minVersion →
        // '3.0.0'. The upsert produces a row, so `executeInsert` returns 1.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tReleaseDraft)
                .values({ id: 1, title: 'Alpha cut (upsert)', stage: 'final', channel: 'stable', minVersion: '3.0.0' })
                .onConflictOn(tReleaseDraft.id)
                .doUpdateSet({ stage: 'final', channel: 'stable', minVersion: '3.0.0' })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into release_draft (id, title, stage, channel, min_version) values ($1, $2, $3, $4, $5) on conflict (id) do update set stage = $6, channel = $7, min_version = $8"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Alpha cut (upsert)",
                "final",
                "stable",
                "3.0.0",
                "final",
                "stable",
                "3.0.0",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) {
                expect(typeof affected).toBe('number')
            } else {
                expect(affected).toBe(1)
            }
        })
    })

    test('on-conflict-on-columns-with-where-do-nothing', async () => {
        // `onConflictOn(cols).where(cond).doNothing()` — the DO NOTHING arm off
        // a partial-INDEX conflict target. The partial-index
        // predicate `.where(tProject.published.equals(true))` targets a real
        // partial unique index. Seeded row id=1 (`mktg-site`, organizationId=1,
        // published='t') matches the target, so the insert is suppressed.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .where(tProject.published.equals(true))
                .doNothing()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) where (published = 't') = $4 do nothing"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                true,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            if (ctx.realDbEnabled) expect(typeof inserted).toBe('number')
            else expect(inserted).toBe(0)
        })
    })

    test('on-conflict-on-columns-dynamic-where-do-nothing', async () => {
        // The conflict-target `dynamicWhere()` variant of the test above: an
        // empty `dynamicWhere()` seeded by a single `.and(...)` builds the same
        // partial-index predicate as the direct `.where(...)` form, terminated by
        // `.doNothing()`. Pins the `dynamicWhere` dispatch on the conflict target
        // paired with DO NOTHING.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .dynamicWhere()
                    .and(tProject.published.equals(true))
                .doNothing()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) where (published = 't') = $4 do nothing"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                true,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            if (ctx.realDbEnabled) expect(typeof inserted).toBe('number')
            else expect(inserted).toBe(0)
        })
    })

    test('from-select-on-conflict-on-columns-with-where-do-nothing', async () => {
        // `from(select).onConflictOn(cols).where(cond).doNothing()` — the
        // partial-index conflict target × DO NOTHING on a from-select upsert.
        // The source re-selects project 1's (organization_id, slug, name), which
        // collides with UNIQUE (organization_id, slug); the partial-index
        // predicate `published = 't'` matches the seeded row, so the insert is
        // suppressed.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const source = ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({
                    organizationId: tProject.organizationId,
                    slug:           tProject.slug,
                    name:           tProject.name,
                })

            const inserted = await ctx.conn.insertInto(tProject)
                .from(source)
                .onConflictOn(tProject.organizationId, tProject.slug)
                .where(tProject.published.equals(true))
                .doNothing()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) select organization_id as "organizationId", slug as slug, name as name from project where id = $1 on conflict (organization_id, slug) where (published = 't') = $2 do nothing"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                true,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            if (ctx.realDbEnabled) expect(typeof inserted).toBe('number')
            else expect(inserted).toBe(0)
        })
    })

    test('on-conflict-on-constraint-do-update-returning-one-column', async () => {
        // `onConflictOnConstraint(rawFragment`name`).doUpdateSet({...}).returningOneColumn(col)`
        // — the single-column RETURNING tail off a named-constraint DO UPDATE.
        // The upsert always writes a row (insert or update), so the column is
        // required (`string`). Inserting `ada@acme.test` collides with the seeded
        // user via the `app_user_email_key` UNIQUE constraint, so DO UPDATE
        // refreshes full_name and RETURNING gives the new full_name back.
        ctx.mockNext('Ada Lovelace v2')
        await ctx.withRollback(async () => {
            const fullName = await ctx.conn.insertInto(tAppUser)
                .values({ email: 'ada@acme.test', fullName: 'Ada Lovelace v2' })
                .onConflictOnConstraint(ctx.conn.rawFragment`app_user_email_key`)
                .doUpdateSet({ fullName: 'Ada Lovelace v2' })
                .returningOneColumn(tAppUser.fullName)
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values ($1, $2) on conflict on constraint app_user_email_key do update set full_name = $3 returning full_name as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "ada@acme.test",
                "Ada Lovelace v2",
                "Ada Lovelace v2",
              ]
            `)
            assertType<Exact<typeof fullName, string>>()
            expect(fullName).toBe('Ada Lovelace v2')
        })
    })

    test('on-conflict-on-constraint-do-update-returning-object', async () => {
        // Object-form RETURNING off the named-constraint DO UPDATE. The upsert
        // always writes a row, so RETURNING is required (`{id, fullName}`).
        // `ada@acme.test` collides with the seeded user id=1 via the
        // `app_user_email_key` UNIQUE constraint, so DO UPDATE refreshes full_name
        // and RETURNING yields the row's {id, fullName}.
        const expected = { id: 1, fullName: 'Ada Lovelace v2' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.insertInto(tAppUser)
                .values({ email: 'ada@acme.test', fullName: 'Ada Lovelace v2' })
                .onConflictOnConstraint(ctx.conn.rawFragment`app_user_email_key`)
                .doUpdateSet({ fullName: 'Ada Lovelace v2' })
                .returning({ id: tAppUser.id, fullName: tAppUser.fullName })
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values ($1, $2) on conflict on constraint app_user_email_key do update set full_name = $3 returning id as id, full_name as "fullName""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "ada@acme.test",
                "Ada Lovelace v2",
                "Ada Lovelace v2",
              ]
            `)
            assertType<Exact<typeof row, { id: number, fullName: string }>>()
            expect(row).toEqual(expected)
        })
    })

    test('on-conflict-on-constraint-do-nothing-returning-object', async () => {
        // Object-form RETURNING off a named-constraint DO NOTHING — the None arm.
        // A DO NOTHING may suppress the insert, so RETURNING is None-or-One
        // (`{email, fullName} | null`). A fresh email is inserted so no unique key
        // collides; the row inserts and its {email, fullName} — exactly what was
        // inserted — come back in both modes.
        const expected = { email: 'grace2@acme.test', fullName: 'Grace Hopper II' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.insertInto(tAppUser)
                .values({ email: 'grace2@acme.test', fullName: 'Grace Hopper II' })
                .onConflictOnConstraint(ctx.conn.rawFragment`app_user_email_key`)
                .doNothing()
                .returning({ email: tAppUser.email, fullName: tAppUser.fullName })
                .executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values ($1, $2) on conflict on constraint app_user_email_key do nothing returning email as email, full_name as "fullName""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "grace2@acme.test",
                "Grace Hopper II",
              ]
            `)
            assertType<Exact<typeof row, { email: string, fullName: string } | null>>()
            expect(row).toEqual(expected)
        })
    })

    test('on-conflict-on-constraint-do-update-returning-last-inserted-id', async () => {
        // `onConflictOnConstraint(name).doUpdateSet(...).returningLastInsertedId()` — the
        // DO UPDATE arm always writes a row (insert or update), so the returned id is
        // required (`number`). `ada@acme.test` collides with the seeded user id=1 via the
        // `app_user_email_key` UNIQUE constraint, so DO UPDATE refreshes full_name and
        // RETURNING id gives the row's id back.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const id = await ctx.conn.insertInto(tAppUser)
                .values({ email: 'ada@acme.test', fullName: 'Ada Lovelace v2' })
                .onConflictOnConstraint(ctx.conn.rawFragment`app_user_email_key`)
                .doUpdateSet({ fullName: 'Ada Lovelace v2' })
                .returningLastInsertedId()
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values ($1, $2) on conflict on constraint app_user_email_key do update set full_name = $3 returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "ada@acme.test",
                "Ada Lovelace v2",
                "Ada Lovelace v2",
              ]
            `)
            assertType<Exact<typeof id, number>>()
            expect(id).toBe(1)
        })
    })

    test('on-conflict-on-constraint-do-nothing-returning-last-inserted-id-is-nullable', async () => {
        // `onConflictOnConstraint(name).doNothing().returningLastInsertedId()` — a DO
        // NOTHING may suppress the insert, so the returned id is nullable (`number | null`).
        // A fresh email is inserted so no unique key collides and a real id comes back (the
        // `| null` arm is the type promise this pins).
        ctx.mockNext(100)
        await ctx.withRollback(async () => {
            const id = await ctx.conn.insertInto(tAppUser)
                .values({ email: 'grace2@acme.test', fullName: 'Grace Hopper II' })
                .onConflictOnConstraint(ctx.conn.rawFragment`app_user_email_key`)
                .doNothing()
                .returningLastInsertedId()
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values ($1, $2) on conflict on constraint app_user_email_key do nothing returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "grace2@acme.test",
                "Grace Hopper II",
              ]
            `)
            assertType<Exact<typeof id, number | null>>()
            if (!ctx.realDbEnabled) expect(id).toBe(100)
            else expect(id).toBeGreaterThan(3) // seed reserves app_user ids 1, 2, 3
        })
    })

    test('on-conflict-on-constraint-do-update-where', async () => {
        // `onConflictOnConstraint(name).doUpdateSet(...).where(cond).and(cond)` — the
        // partial-UPDATE-WHERE (with an `.and` chain) off a named-constraint conflict
        // target. `ada@acme.test` collides via `app_user_email_key`; the WHERE (full_name
        // differs AND email matches) is satisfied, so DO UPDATE runs.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tAppUser)
                .values({ email: 'ada@acme.test', fullName: 'Ada Lovelace v2' })
                .onConflictOnConstraint(ctx.conn.rawFragment`app_user_email_key`)
                .doUpdateSet({ fullName: 'Ada Lovelace v2' })
                .where(tAppUser.fullName.notEquals('Ada Lovelace v2'))
                .and(tAppUser.email.equals('ada@acme.test'))
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values ($1, $2) on conflict on constraint app_user_email_key do update set full_name = $3 where app_user.full_name <> $4 and app_user.email = $5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "ada@acme.test",
                "Ada Lovelace v2",
                "Ada Lovelace v2",
                "Ada Lovelace v2",
                "ada@acme.test",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })
})
