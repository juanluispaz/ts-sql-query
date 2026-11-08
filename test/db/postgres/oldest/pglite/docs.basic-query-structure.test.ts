// Documentation snippets for the "Basic query structure" page
// (docs/queries/basic-query-structure.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tProject, tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:basic-query-structure/how-a-query-reads', async () => {
        const expected = [
            { id: 2, name: 'Internal tools', organizationName: 'Acme Corp' },
            { id: 1, name: 'Marketing site', organizationName: 'Acme Corp' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projects = await connection.selectFrom(tProject)
            .innerJoin(tOrganization).on(tProject.organizationId.equals(tOrganization.id))
            .where(tOrganization.name.equals('Acme Corp'))
            .select({
                id:               tProject.id,
                name:             tProject.name,
                organizationName: tOrganization.name,
            })
            .orderBy('name')
            .limit(10)
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, organization.name as "organizationName" from project inner join organization on project.organization_id = organization.id where organization.name = $1 order by name limit $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Acme Corp",
            10,
          ]
        `)
        assertType<Exact<typeof projects, Array<{
            id:               number
            name:             string
            organizationName: string
        }>>>()
        expect(projects).toEqual(expected)
    })

    test('docs:basic-query-structure/order-of-the-clauses', async () => {
        const connection = ctx.conn

        // doc-start
        const whereFirst = connection.selectFrom(tProject)
            .where(tProject.organizationId.equals(1))
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('name')

        const whereLast = connection.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('name')
            .where(tProject.organizationId.equals(1))
        // doc-end

        expect(whereFirst.query()).toMatchInlineSnapshot(`"select id as id, name as name from project where organization_id = $1 order by name"`)
        expect(whereFirst.params()).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(whereLast.query()).toBe(whereFirst.query())
        expect(whereLast.params()).toEqual(whereFirst.params())
    })

    test('docs-extra:basic-query-structure/select-many', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, email as email, full_name as "fullName" from app_user order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof users, Array<{
            id:       number
            email:    string
            fullName: string
        }>>>()
        expect(users).toEqual(expected)
    })

    test('docs:basic-query-structure/select-one', async () => {
        // Project 1 has no archived_at: the optional property isn't set.
        const expected = { id: 1, name: 'Marketing site', slug: 'mktg-site' }
        ctx.mockNext({ ...expected, archivedAt: null })
        const connection = ctx.conn

        // doc-start
        const projectId = 1

        const projectWithId = await connection.selectFrom(tProject)
            .where(tProject.id.equals(projectId))
            .select({
                id:         tProject.id,
                name:       tProject.name,
                slug:       tProject.slug,
                archivedAt: tProject.archivedAt,
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, slug as slug, archived_at as "archivedAt" from project where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof projectWithId, {
            id:          number
            name:        string
            slug:        string
            archivedAt?: Date
        }>>()
        expect(projectWithId).toEqual(expected)
        expect('archivedAt' in projectWithId).toBe(false)
    })

    test('docs-extra:basic-query-structure/select-none-or-one', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, slug as slug from project where id = $1"`)
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

    test('docs:basic-query-structure/projecting-optional-values-as-nullable', async () => {
        // The page promises that `projectingOptionalValuesAsNullable()`
        // switches an optional projected field from `T?` to `T | null`.
        // tProject.archivedAt is optional in the seed; use it as the
        // documentation does with tCustomer.birthday.
        const expected = { id: 1, name: 'Marketing site', archivedAt: null }
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const project = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:         tProject.id,
                name:       tProject.name,
                archivedAt: tProject.archivedAt,
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, archived_at as "archivedAt" from project where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        // archivedAt MUST appear in the type AND allow null (instead of
        // the default `archivedAt?: Date` shape without the helper).
        assertType<Exact<typeof project, {
            id:         number
            name:       string
            archivedAt: Date | null
        }>>()
        expect(project).toEqual(expected)
    })

    test('docs:basic-query-structure/constant-values', async () => {
        const expected = { id: 1, source: 'import' }
        ctx.mockNext({ ...expected, note: null })
        const connection = ctx.conn

        // doc-start
        const noteForTheProject: string | null = null

        const projectWithNote = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:     tProject.id,
                source: connection.const('import', 'string'),
                note:   connection.optionalConst(noteForTheProject, 'string'),
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, $1 as source, $2 as note from project where id = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "import",
            null,
            1,
          ]
        `)
        assertType<Exact<typeof projectWithNote, {
            id:     number
            source: string
            note?:  string
        }>>()
        expect(projectWithNote).toEqual(expected)
    })

    test('docs-extra:basic-query-structure/select-one-column', async () => {
        // The page lists `selectOneColumn(column)` as the single-column
        // counterpart of `select({...})`. Same fluent shape; result is
        // the bare column value.
        const expected = 'Marketing site'
        ctx.mockNext(expected)
        const connection = ctx.conn

        const name = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .selectOneColumn(tProject.name)
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select name as result from project where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof name, string>>()
        expect(name).toBe(expected)
    })

    test('docs-extra:basic-query-structure/select-count-all', async () => {
        // The page lists `selectCountAll()` as a shortcut for
        // `count(*)`. Result is a plain int.
        ctx.mockNext(4)
        const connection = ctx.conn

        const total = await connection.selectFrom(tProject)
            .selectCountAll()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) as result from project"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof total, number>>()
        expect(total).toBe(4)
    })

    test('docs:basic-query-structure/query-and-params', async () => {
        const connection = ctx.conn

        // doc-start
        const projectQuery = connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:   tProject.id,
                name: tProject.name,
            })

        const sql = projectQuery.query()
        const params = projectQuery.params()
        // doc-end

        expect(sql).toMatchInlineSnapshot(`"select id as id, name as name from project where id = $1"`)
        expect(params).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof sql, string>>()
        // Nothing was executed.
        expect(ctx.history.length).toBe(0)
    })
})
