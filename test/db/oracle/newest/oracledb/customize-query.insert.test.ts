// Exhaustive coverage of `customizeQuery({...})` hooks on INSERT.
// The docs page exercises `afterInsertKeyword` + `afterQuery`; this
// file covers the remaining RawFragment slot - `beforeQuery` -
// plus variants where the fragment interpolates bound values and
// columns, which drives `__registerRequiredColumn`/`__addWiths` on
// the INSERT builder.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('customize-insert-before-query-emits-leading-comment', async () => {
        // `beforeQuery` lands a fragment ahead of the INSERT keyword.
        // Routing-style comments stick to the head of the statement
        // so a downstream proxy can read them before parsing.
        ctx.mockNext(1)
        const connection = ctx.conn
        await ctx.withRollback(async () => {
            const inserted = await connection.insertInto(tProject)
                .values({ name: 'Mobile app', slug: 'mobile-app', organizationId: 1 })
                .customizeQuery({
                    beforeQuery: connection.rawFragment`/* route=primary */ `,
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* route=primary */  insert into project (name, slug, organization_id) values (:0, :1, :2)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mobile app",
                "mobile-app",
                1,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
        })
    })

    test('customize-insert-hook-fragment-with-column-reference', async () => {
        // Column reference inside the hook fragment - drives
        // `__registerRequiredColumn` on the INSERT builder.
        ctx.mockNext(1)
        const connection = ctx.conn
        await ctx.withRollback(async () => {
            const inserted = await connection.insertInto(tIssue)
                .values({ projectId: 1, number: 401, title: 'Wire SAML SSO', status: 'open', priority: 2 })
                .customizeQuery({
                    afterQuery: connection.rawFragment` /* keyed-by ${tIssue.projectId} */`,
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, "number", title, status, priority) values (:0, :1, :2, :3, :4)  /* keyed-by project_id */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                401,
                "Wire SAML SSO",
                "open",
                2,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
        })
    })

    test('customize-insert-all-hooks-combined', async () => {
        // The three RawFragment-typed hooks applied at once on a
        // multi-row insert. The snapshot documents the exact spot
        // each hook occupies in the emitted INSERT.
        ctx.mockNext(2)
        const connection = ctx.conn
        await ctx.withRollback(async () => {
            const inserted = await connection.insertInto(tProject)
                .values([
                    { name: 'Status page', slug: 'status-page', organizationId: 1 },
                    { name: 'Changelog',   slug: 'changelog',   organizationId: 1 },
                ])
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterInsertKeyword: connection.rawFragment`/*+ hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"begin /* head */  insert /*+ hint */ into project (name, slug, organization_id) values (:0, :1, :2)  /* tail */; /* head */  insert /*+ hint */ into project (name, slug, organization_id) values (:3, :4, :5)  /* tail */; end;"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Status page",
                "status-page",
                1,
                "Changelog",
                "changelog",
                1,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
        })
    })

    test('customize-insert-from-select-with-hooks', async () => {
        // INSERT ... FROM (SELECT ...) also accepts `customizeQuery`.
        // Confirms the same three hooks land on the insert-from-select
        // branch of `_appendInsertSelect`
        ctx.mockNext(3)
        const connection = ctx.conn
        await ctx.withRollback(async () => {
            const sourceProjects = connection.selectFrom(tProject)
                .where(tProject.name.startsWith('Marketing'))
                .select({
                    organizationId: tProject.organizationId,
                    name:           tProject.name.concat(' (clone)'),
                    slug:           tProject.slug.concat('-clone'),
                })

            const inserted = await connection.insertInto(tProject)
                .from(sourceProjects)
                .customizeQuery({
                    afterInsertKeyword: connection.rawFragment`/*+ NO_LOG */`,
                    afterQuery:         connection.rawFragment` /* batch-clone */`,
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert /*+ NO_LOG */ into project (organization_id, name, slug) select organization_id as "organizationId", name || :0 as "name", slug || :1 as "slug" from project where name like (:2 || '%') escape '\\'  /* batch-clone */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " (clone)",
                "-clone",
                "Marketing",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
        })
    })

    test('customize-insert-returning-object-with-hooks', async () => {
        // `.returning({...})` yields a composable customizable executable, so
        // the customize hook lands on the same statement while the RETURNING
        // result type (an object) is preserved. The returned columns are exactly
        // what was inserted, so the value is deterministic in both modes.
        const expected = { organizationId: 1, name: 'Mobile app', slug: 'mobile-app' }
        ctx.mockNext(expected)
        const connection = ctx.conn
        await ctx.withRollback(async () => {
            const row = await connection.insertInto(tProject)
                .values({ name: 'Mobile app', slug: 'mobile-app', organizationId: 1 })
                .returning({
                    organizationId: tProject.organizationId,
                    name:           tProject.name,
                    slug:           tProject.slug,
                })
                .customizeQuery({ afterInsertKeyword: connection.rawFragment`/*+ hint */` })
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert /*+ hint */ into project (name, slug, organization_id) values (:0, :1, :2) returning organization_id, name, slug into :3, :4, :5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mobile app",
                "mobile-app",
                1,
                {
                  "as": "organizationId",
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
            assertType<Exact<typeof row, { organizationId: number; name: string; slug: string }>>()
            expect(row).toEqual(expected)
        })
    })

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
//     test('customize-insert-on-conflict-returning-object-with-hooks', async () => {
//         // The ON CONFLICT returning × customizeQuery composition — the
//         // returning×customize combination is covered for plain / from-select /
//         // UPDATE / DELETE, but the on-conflict returning builder was the one
//         // source whose returning×customize pairing was unasserted. The hook
//         // lands on the same statement and the optional (None-or-One) result
//         // type is preserved. No unique key collides, so the insert succeeds and
//         // the row comes back.
//         const expected = { organizationId: 1, name: 'Mobile app', slug: 'mobile-app' }
//         ctx.mockNext(expected)
//         const connection = ctx.conn
//         await ctx.withRollback(async () => {
//             const row = await connection.insertInto(tProject)
//                 .values({ name: 'Mobile app', slug: 'mobile-app', organizationId: 1 })
//                 .onConflictDoNothing()
//                 .returning({
//                     organizationId: tProject.organizationId,
//                     name:           tProject.name,
//                     slug:           tProject.slug,
//                 })
//                 .customizeQuery({ afterInsertKeyword: connection.rawFragment`/*+ hint */` })
//                 .executeInsertNoneOrOne()

//             expect(ctx.lastSql).toMatchInlineSnapshot()
//             expect(ctx.lastParams).toMatchInlineSnapshot()
//             assertType<Exact<typeof row, { organizationId: number; name: string; slug: string } | null>>()
//             expect(row).toEqual(expected)
//         })
//     })
})
