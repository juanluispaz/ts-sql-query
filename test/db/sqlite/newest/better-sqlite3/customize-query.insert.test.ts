// Exhaustive coverage of `customizeQuery({...})` hooks on INSERT.
// The docs page exercises `afterInsertKeyword` + `afterQuery`; this
// file covers the remaining RawFragment slot - `beforeQuery` -
// plus variants where the fragment interpolates bound values and
// columns, which drives `__registerRequiredColumn`/`__addWiths` on
// the INSERT builder (see
// [src/queryBuilders/InsertQueryBuilder.ts](../../../../../src/queryBuilders/InsertQueryBuilder.ts)).
//
// The hook fields are defined at
// [src/expressions/insert.ts:L14](../../../../../src/expressions/insert.ts#L14).

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* route=primary */  insert into project (name, slug, organization_id) values (?, ?, ?)"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)  /* keyed-by project_id */"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  insert /*+ hint */ into project (name, slug, organization_id) values (?, ?, ?), (?, ?, ?)  /* tail */"`)
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
        // branch of `_appendInsertSelect` in
        // [AbstractSqlBuilder.ts:L1432+](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts#L1432).
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert /*+ NO_LOG */ into project (organization_id, name, slug) select organization_id as organizationId, name || ? as name, slug || ? as slug from project where name like (? || '%') escape '\\'  /* batch-clone */"`)
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
})
