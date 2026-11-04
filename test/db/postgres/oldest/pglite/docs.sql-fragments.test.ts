// Documentation snippets for the SQL fragments page
// (docs/queries/sql-fragments.md).
//
// Fragments embed raw SQL inside a typed expression tree, so their text can
// differ per database.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tProject, tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:sql-fragments/fragment-with-type', async () => {
        const expected = { idAsString: '1', name: 'Ada Lovelace ada@acme.test' }
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const id = 1

        const usersUsingCustomFragment = await connection.selectFrom(tAppUser)
            .where(connection.fragmentWithType('boolean', 'required').sql`${tAppUser.id} = ${connection.const(id, 'int')}`)
            .select({
                idAsString: connection.fragmentWithType('string', 'required').sql`${tAppUser.id}::varchar`,
                name:       tAppUser.fullName.concat(' ').concat(tAppUser.email),
            })
            .executeSelectNoneOrOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id::varchar as "idAsString", full_name || $1 || email as name from app_user where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            " ",
            1,
          ]
        `)
        assertType<Exact<typeof usersUsingCustomFragment, {
            idAsString: string
            name:       string
        } | null>>()
        expect(usersUsingCustomFragment).toEqual(expected)
    })

    test('docs:sql-fragments/reusable-fragment', async () => {
        const expected = [
            { id: 1, name: 'Acme Corp',  idMultiplyBy2: 2 },
            { id: 2, name: 'Globex Ltd', idMultiplyBy2: 4 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const bitwiseMovements = 1
        const multiplier = 2

        const organizationsUsingCustomFunctionFragment = await connection.selectFrom(tOrganization)
            .where(tOrganization.id.multiply(multiplier).equals(connection.intLeftShift(tOrganization.id, bitwiseMovements)))
            .select({
                id:            tOrganization.id,
                name:          tOrganization.name,
                idMultiplyBy2: connection.intLeftShift(tOrganization.id, bitwiseMovements),
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, id::int << $1::int as "idMultiplyBy2" from organization where (id * $2) = (id::int << $3::int)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof organizationsUsingCustomFunctionFragment, Array<{
            id:            number
            name:          string
            idMultiplyBy2: number
        }>>>()
        expect([...organizationsUsingCustomFunctionFragment].sort((a, b) => a.id - b.id)).toEqual(expected)
    })

    test('docs:sql-fragments/conditional-fragment', async () => {
        const expected = [{ id: 2, name: 'Globex Ltd' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const noValue = null
        const withValue = 2

        const organizationsUsingCustomFunctionFragmentIfValue = await connection.selectFrom(tOrganization)
            .where(connection.intEqualsIfValue(tOrganization.id, noValue))
                .or(connection.intEqualsIfValue(tOrganization.id, withValue))
            .select({
                id:   tOrganization.id,
                name: tOrganization.name,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from organization where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof organizationsUsingCustomFunctionFragmentIfValue, Array<{
            id:   number
            name: string
        }>>>()
        expect(organizationsUsingCustomFunctionFragmentIfValue).toEqual(expected)
    })

    test('docs-extra:sql-fragments/if-value-empty-string', async () => {
        // Section "Conditional fragments": an empty string counts as no value
        // when the connection doesn't set `allowEmptyString`.
        const expected = [{ id: 1, email: 'ada@acme.test' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const users = await connection.selectFrom(tAppUser)
            .where(connection.equalsStringIfValue(tAppUser.fullName, ''))
                .or(connection.equalsStringIfValue(tAppUser.email, 'ada@acme.test'))
            .select({
                id:    tAppUser.id,
                email: tAppUser.email,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, email as email from app_user where email = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ada@acme.test",
          ]
        `)
        assertType<Exact<typeof users, Array<{ id: number; email: string }>>>()
        expect(users).toEqual(expected)
    })

    test('docs:sql-fragments/nullable-fragment', async () => {
        // id * 2 = id + 1 holds only for organization 1.
        const expected = [{ id: 1, name: 'Acme Corp', idPlusOne: 2 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const increment = 1
        const multiplier = 2

        const organizationsUsingCustomFunctionFragment = await connection.selectFrom(tOrganization)
            .where(tOrganization.id.multiply(multiplier).equals(connection.intPlus(tOrganization.id, increment)))
            .select({
                id:        tOrganization.id,
                name:      tOrganization.name,
                idPlusOne: connection.intPlus(tOrganization.id, increment),
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, id::int + $1::int as "idPlusOne" from organization where (id * $2) = (id::int + $3::int)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof organizationsUsingCustomFunctionFragment, Array<{
            id:        number
            name:      string
            idPlusOne: number
        }>>>()
        expect(organizationsUsingCustomFunctionFragment).toEqual(expected)
    })

    test('docs:sql-fragments/raw-fragment', async () => {
        // A bare `between` has no place of its own in a query, so the raw
        // fragment holds its column too and goes into an order by: the
        // organization created inside the range (2) comes first.
        const expected = [
            { id: 2, name: 'Globex Ltd' },
            { id: 1, name: 'Acme Corp' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const from = connection.const(new Date('2023-07-01'), 'localDateTime')
        const to = connection.const(new Date('2024-01-01'), 'localDateTime')
        const fragment = connection.rawFragment`case when ${tOrganization.createdAt} between ${from} and ${to} then 0 else 1 end`
        // doc-end

        const organizations = await connection.selectFrom(tOrganization)
            .select({
                id:   tOrganization.id,
                name: tOrganization.name,
            })
            .orderBy(fragment)
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from organization order by case when organization.created_at between $1 and $2 then 0 else 1 end"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2023-07-01T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
          ]
        `)
        assertType<Exact<typeof organizations, Array<{ id: number; name: string }>>>()
        expect(organizations).toEqual(expected)
    })

    test('docs:sql-fragments/table-customization', async () => {
        // The customization is a derived table here, which needs the alias.
        // Project 1 has no archived_at: the optional property isn't set.
        const expected = [{ id: 1, name: 'Marketing site', slug: 'mktg-site' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const customizedProject = connection.withTwoParams(tProject.as('proj'), 'customizedProject', 0, 0)

        const projectsInCustomization = await connection.selectFrom(customizedProject)
            .where(customizedProject.id.equals(1))
            .select({
                id:         customizedProject.id,
                name:       customizedProject.name,
                slug:       customizedProject.slug,
                archivedAt: customizedProject.archivedAt,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select proj.id as id, proj.name as name, proj.slug as slug, proj.archived_at as "archivedAt" from (select * from project where $1 >= 0 and $2 >= 0) as proj where proj.id = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            0,
            1,
          ]
        `)
        assertType<Exact<typeof projectsInCustomization, Array<{
            id:          number
            name:        string
            slug:        string
            archivedAt?: Date
        }>>>()
        expect(projectsInCustomization).toEqual(expected)
    })

    test('docs:sql-fragments/customize-query-select', async () => {
        // Section "Customizing a select" — `customizeQuery` accepts
        // raw-fragment hooks at well-defined extension points. Here we
        // inject `afterSelectKeyword` and `afterQuery`.
        const expected = { id: 1, email: 'ada@acme.test', fullName: 'Ada Lovelace' }
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const row = await connection.selectFrom(tAppUser)
            .where(tAppUser.id.equals(1))
            .select({
                id:       tAppUser.id,
                email:    tAppUser.email,
                fullName: tAppUser.fullName,
            }).customizeQuery({
                afterSelectKeyword: connection.rawFragment`/*+ some hints */`,
                afterQuery:         connection.rawFragment`/* trailing comment */`,
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select /*+ some hints */ id as id, email as email, full_name as "fullName" from app_user where id = $1 /* trailing comment */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:       number
            email:    string
            fullName: string
        }>>()
        expect(row).toEqual(expected)
    })

    test('docs:sql-fragments/customize-query-insert', async () => {
        // Section "Customizing an insert": `afterInsertKeyword` and `afterQuery`
        // extension points; the rest of the chain is just a normal insert.
        ctx.mockNext(1)
        const connection = ctx.conn

        await ctx.withRollback(async () => {
            // doc-start
            const inserted = await connection.insertInto(tAppUser).set({
                    email:    'new@acme.test',
                    fullName: 'New User',
                }).customizeQuery({
                    afterInsertKeyword: connection.rawFragment`/*+ some hints */`,
                    afterQuery:         connection.rawFragment`/* trailing comment */`,
                }).executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert /*+ some hints */ into app_user (email, full_name) values ($1, $2) /* trailing comment */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "new@acme.test",
                "New User",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('docs:sql-fragments/customize-query-update', async () => {
        // Section "Customizing an update" — `afterUpdateKeyword` and
        // `afterQuery` extension points on the UPDATE customizeQuery.
        ctx.mockNext(1)
        const connection = ctx.conn

        await ctx.withRollback(async () => {
            // doc-start
            const affected = await connection.update(tProject)
                .set({ name: 'Marketing site (v2)' })
                .where(tProject.id.equals(1))
                .customizeQuery({
                    afterUpdateKeyword: connection.rawFragment`/*+ some hints */`,
                    afterQuery:         connection.rawFragment`/* trailing comment */`,
                })
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update /*+ some hints */ project set name = $1 where id = $2 /* trailing comment */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site (v2)",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })

    test('docs:sql-fragments/customize-query-delete', async () => {
        // Section "Customizing a delete" — `afterDeleteKeyword` and
        // `afterQuery` extension points on the DELETE customizeQuery.
        ctx.mockNext(0)
        const connection = ctx.conn

        await ctx.withRollback(async () => {
            // doc-start
            const affected = await connection.deleteFrom(tProject)
                .where(tProject.id.equals(9999))
                .customizeQuery({
                    afterDeleteKeyword: connection.rawFragment`/*+ some hints */`,
                    afterQuery:         connection.rawFragment`/* trailing comment */`,
                })
                .executeDelete()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete /*+ some hints */ from project where id = $1 /* trailing comment */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                9999,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })

})
