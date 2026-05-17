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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into "organization" (name, "plan") values (:0, :1) returning id into :2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Initrode",
                "free",
                {
                  "dir": 3003,
                },
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"begin insert into project (name, organization_id, slug) values (:0, :1, :2) returning id into :3; insert into project (name, organization_id, slug) values (:4, :5, :6) returning id into :7; end;"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mobile app",
                1,
                "mobile-1",
                {
                  "as": "id",
                  "dir": 3003,
                },
                "Dashboard",
                1,
                "dashboard",
                {
                  "as": "id",
                  "dir": 3003,
                },
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, "number", title, status, priority, "body") values (:0, :1, :2, :3, :4, :5) returning id into :6"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                99,
                "Triage backlog",
                "open",
                2,
                "Filled in by setIfNotSet",
                {
                  "dir": 3003,
                },
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) select :0 as "organizationId", name || :1 as "name", slug || :2 as "slug" from project where organization_id = :3"`)
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
})
