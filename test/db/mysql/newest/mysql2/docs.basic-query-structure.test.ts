// Documentation snippets for the "Basic query structure" page
// (docs/queries/basic-query-structure.md).
//
// Tests prefixed `docs:` are scraped by the docs build. Inside each test,
// the code BETWEEN `// doc-start` and `// doc-end` is the snippet that
// appears on the page; SQL + params live in `toMatchInlineSnapshot(...)`
// so the test gates the snippet against drift and the snapshot can be
// refreshed in bulk via `bun test --update-snapshots`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:basic/select-many', async () => {
        const expected = [
            { id: 1, email: 'ada@acme.test', fullName: 'Ada Lovelace' },
            { id: 2, email: 'grace@acme.test', fullName: 'Grace Hopper' },
            { id: 3, email: 'alan@globex.test', fullName: 'Alan Turing' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const users = await connection.selectFrom(tAppUser)
            .select({
                id:       tAppUser.id,
                email:    tAppUser.email,
                fullName: tAppUser.fullName,
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, email as email, full_name as fullName from app_user order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof users, Array<{
            id:       number
            email:    string
            fullName: string
        }>>>()
        expect(users).toEqual(expected)
    })

    test('docs:basic/select-one', async () => {
        const expected = { id: 1, name: 'Marketing site', slug: 'mktg-site' }
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const project = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:   tProject.id,
                name: tProject.name,
                slug: tProject.slug,
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\`, slug as slug from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof project, {
            id:   number
            name: string
            slug: string
        }>>()
        expect(project).toEqual(expected)
    })

    test('docs:basic/select-none-or-one', async () => {
        ctx.mockNext(null)
        const connection = ctx.conn

        // doc-start
        const maybe = await connection.selectFrom(tProject)
            .where(tProject.id.equals(9999))
            .select({
                id:   tProject.id,
                name: tProject.name,
                slug: tProject.slug,
            })
            .executeSelectNoneOrOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\`, slug as slug from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            9999,
          ]
        `)
        assertType<Exact<typeof maybe, {
            id:   number
            name: string
            slug: string
        } | null>>()
        expect(maybe).toBeNull()
    })
})
