// Documentation snippets for the SQL fragments page
// (docs/queries/sql-fragments.md).
//
// Fragments embed raw SQL inside a typed expression tree, so their text can
// differ per database.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tProject, tOrganization, tServicePlan, tIssue, tIssueWorklog } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:sql-fragments/fragment-with-type', async () => {
        const expected = { lowerFullName: 'ada lovelace', name: 'Ada Lovelace ada@acme.test' }
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const id = 1

        const usersUsingCustomFragment = await connection.selectFrom(tAppUser)
            .where(connection.fragmentWithType('boolean', 'required').sql`abs(${tAppUser.id}) = abs(${connection.const(id, 'int')})`)
            .select({
                lowerFullName: connection.fragmentWithType('string', 'required').sql`lower(${tAppUser.fullName})`,
                name:          tAppUser.fullName.concat(' ').concat(tAppUser.email),
            })
            .executeSelectNoneOrOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select lower(full_name) as lowerFullName, full_name + @0 + email as name from app_user where abs(id) = abs(@1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            " ",
            1,
          ]
        `)
        assertType<Exact<typeof usersUsingCustomFragment, {
            lowerFullName: string
            name:          string
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, id << @0 as idMultiplyBy2 from organization where (id * @1) = (id << @2)"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from organization where id = @0"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, email as email from app_user where email = @0"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, id + @0 as idPlusOne from organization where (id * @1) = (id + @2)"`)
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
        // The domain has no temporal table for a `for system_time` clause, so the
        // raw fragment holds its own column and goes into an order by: the
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from organization order by case when organization.created_at between @0 and @1 then 0 else 1 end"`)
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
        // Bounds wide enough to hold every version whenever the seed ran. Plan 2 was
        // never updated and has no description: the optional property isn't set.
        const expected = [{ id: 2, name: 'Enterprise' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const planInSystemTime = connection.forSystemTimeBetween(tServicePlan, 'planInSystemTime', new Date('2000-01-01'), new Date('2100-01-01'))

        const plansInSystemTime = await connection.selectFrom(planInSystemTime)
            .where(planInSystemTime.id.equals(2))
            .select({
                id:          planInSystemTime.id,
                name:        planInSystemTime.name,
                description: planInSystemTime.description,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, description as description from service_plan for system_time between @0 and @1  where id = @2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2000-01-01T00:00:00.000Z,
            2100-01-01T00:00:00.000Z,
            2,
          ]
        `)
        assertType<Exact<typeof plansInSystemTime, Array<{
            id:           number
            name:         string
            description?: string
        }>>>()
        expect(plansInSystemTime).toEqual(expected)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select /*+ some hints */ id as id, email as email, full_name as fullName from app_user where id = @0 /* trailing comment */"`)
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

    test('docs:sql-fragments/values-as-parameters', async () => {
        // Section "Values in a fragment": the value goes as a parameter, so it's
        // compared as text and no user has that name.
        ctx.mockNext([])
        const connection = ctx.conn

        // doc-start
        const searchedName = "x' or '1'='1"

        const usersWithName = await connection.selectFrom(tAppUser)
            .where(connection.fragmentWithType('boolean', 'required').sql`lower(${tAppUser.fullName}) = lower(${connection.const(searchedName, 'string')})`)
            .select({
                id: tAppUser.id,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(full_name) = lower(@0)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "x' or '1'='1",
          ]
        `)
        assertType<Exact<typeof usersWithName, Array<{ id: number }>>>()
        expect(usersWithName).toEqual([])
    })

    test('docs:sql-fragments/declared-custom-type', async () => {
        // Section "The type you declare".
        const expected = [
            { id: 1, sizeGroup: 'first' as const },
            { id: 2, sizeGroup: 'other' as const },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const organizationsWithGroup = await connection.selectFrom(tOrganization)
            .select({
                id:        tOrganization.id,
                sizeGroup: connection.fragmentWithType<'first' | 'other', 'sizeGroup'>('enum', 'sizeGroup', 'required')
                    .sql`case when ${tOrganization.id} = 1 then 'first' else 'other' end`,
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, case when id = 1 then 'first' else 'other' end as sizeGroup from organization order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof organizationsWithGroup, Array<{ id: number; sizeGroup: 'first' | 'other' }>>>()
        expect(organizationsWithGroup).toEqual(expected)
    })

    test('docs:sql-fragments/aggregate-page-total', async () => {
        // Section "What changes when a fragment is an aggregate": one row, so the
        // total is 1.
        const expected = { data: [{ projects: 4 }], count: 1 }
        ctx.mockNext([{ projects: 4 }])
        ctx.mockNext(1)
        const connection = ctx.conn

        // doc-start
        const totalProjects = await connection.selectFrom(tProject)
            .select({
                projects: connection.aggregateFragmentWithType('int', 'required').sql`count(*)`,
            })
            .executeSelectPage()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with result_for_count as (select count(*) as projects from project) select count(*) from result_for_count"`)
        assertType<Exact<typeof totalProjects, { data: Array<{ projects: number }>; count: number }>>()
        expect(totalProjects).toEqual(expected)
    })

    test('docs:sql-fragments/aggregate-group-by-non-aggregated', async () => {
        // Section "What changes when a fragment is an aggregate".
        const expected = [
            { organizationId: 1, total: 3 },
            { organizationId: 2, total: 7 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const idsPerOrganization = await connection.selectFrom(tProject)
            .select({
                organizationId: tProject.organizationId,
                total:          connection.aggregateFragmentWithType('int', 'required').sql`sum(${tProject.id})`,
            })
            .groupByNonAggregatedColumns()
            .orderBy('organizationId')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as organizationId, sum(id) as total from project group by organization_id order by organizationId"`)
        assertType<Exact<typeof idsPerOrganization, Array<{ organizationId: number; total: number }>>>()
        expect(idsPerOrganization).toEqual(expected)
    })

    test('docs-extra:sql-fragments/aggregate-in-a-value-of-the-fragment', async () => {
        // Same section: an aggregate passed in a value is seen without marking it.
        const expected = { data: [{ projects: 4 }], count: 1 }
        ctx.mockNext([{ projects: 4 }])
        ctx.mockNext(1)
        const connection = ctx.conn

        const totalProjects = await connection.selectFrom(tProject)
            .select({
                projects: connection.fragmentWithType('int', 'required').sql`abs(${connection.count(tProject.id)})`,
            })
            .executeSelectPage()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with result_for_count as (select abs(count(id)) as projects from project) select count(*) from result_for_count"`)
        assertType<Exact<typeof totalProjects, { data: Array<{ projects: number }>; count: number }>>()
        expect(totalProjects).toEqual(expected)
    })

    test('docs-extra:sql-fragments/aggregate-only-in-the-text', async () => {
        // Same section: an aggregate only in the text isn't seen, so the total is
        // counted over the rows of the table.
        const expected = { data: [{ projects: 4 }], count: 4 }
        ctx.mockNext([{ projects: 4 }])
        ctx.mockNext(4)
        const connection = ctx.conn

        const totalProjects = await connection.selectFrom(tProject)
            .select({
                projects: connection.fragmentWithType('int', 'required').sql`count(*)`,
            })
            .executeSelectPage()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) from project"`)
        assertType<Exact<typeof totalProjects, { data: Array<{ projects: number }>; count: number }>>()
        expect(totalProjects).toEqual(expected)
    })

    test('docs:sql-fragments/virtual-column', async () => {
        // Section "Virtual columns": worklog 1 has the activity 'coding'.
        const expected = { id: 1, activityUpper: 'CODING' }
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const worklog = await connection.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id:            tIssueWorklog.id,
                activityUpper: tIssueWorklog.activityUpper,
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, upper(activity) as activityUpper from issue_worklog where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof worklog, { id: number; activityUpper?: string }>>()
        expect(worklog).toEqual(expected)
    })

    test('docs:sql-fragments/order-by-fragment', async () => {
        // Section "Ordering by a fragment": the preferred organization goes first.
        const expected = [
            { id: 2, name: 'Globex Ltd' },
            { id: 1, name: 'Acme Corp' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const preferredOrganizationId = 2

        const organizationsInOrder = await connection.selectFrom(tOrganization)
            .select({
                id:   tOrganization.id,
                name: tOrganization.name,
            })
            .orderBy(connection.rawFragment`case when ${tOrganization.id} = ${connection.const(preferredOrganizationId, 'int')} then 0 else 1 end`)
            .orderBy('name')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from organization order by case when organization.id = @0 then 0 else 1 end, name"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof organizationsInOrder, Array<{ id: number; name: string }>>>()
        expect(organizationsInOrder).toEqual(expected)
    })

    test('docs:sql-fragments/customize-query-all-hooks', async () => {
        // Section "Customizing a select": ordered by slug descending, 'tools' (2)
        // goes before 'mktg-site' (1).
        const expected = [
            { id: 2, name: 'Internal tools' },
            { id: 1, name: 'Marketing site' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectsWithHooks = await connection.selectFrom(tProject)
            .where(tProject.organizationId.equals(1))
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('name')
            .limit(10)
            .customizeQuery({
                beforeQuery:        connection.rawFragment`/* beforeQuery */`,
                afterSelectKeyword: connection.rawFragment`/* afterSelectKeyword */`,
                beforeColumns:      connection.rawFragment`/* beforeColumns */`,
                beforeOrderByItems: connection.rawFragment`${tProject.slug} desc`,
                afterOrderByItems:  connection.rawFragment`${tProject.id} desc`,
                afterQuery:         connection.rawFragment`/* afterQuery */`,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* beforeQuery */ select /* afterSelectKeyword */ /* beforeColumns */ id as id, name as name from project where organization_id = @0 order by project.slug desc, name, project.id desc offset 0 rows fetch next @1 rows only /* afterQuery */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            10,
          ]
        `)
        assertType<Exact<typeof projectsWithHooks, Array<{ id: number; name: string }>>>()
        expect(projectsWithHooks).toEqual(expected)
    })

    test('docs:sql-fragments/customize-query-window', async () => {
        // Section "A window": position of each issue inside its project.
        const expected = [
            { id: 1, position: 1 },
            { id: 2, position: 2 },
            { id: 3, position: 1 },
            { id: 4, position: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const issuesWithPosition = await connection.selectFrom(tIssue)
            .select({
                id:       tIssue.id,
                position: connection.fragmentWithType('int', 'required').sql`row_number() over project_window`,
            })
            .orderBy('id')
            .customizeQuery({
                customWindow: connection.rawFragment`project_window as (partition by ${tIssue.projectId} order by ${tIssue.id})`,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, row_number() over project_window as position from issue window project_window as (partition by project_id order by id) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issuesWithPosition, Array<{ id: number; position: number }>>>()
        expect(issuesWithPosition).toEqual(expected)
    })

    test('docs:sql-fragments/customize-query-with-hooks', async () => {
        // Section "A select used inside another query".
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectIds = connection.selectFrom(tProject)
            .select({
                id: tProject.id,
            })
            .customizeQuery({
                beforeWithQuery: connection.rawFragment`/* beforeWithQuery */`,
                afterWithQuery:  connection.rawFragment`/* afterWithQuery */`,
            })
            .forUseInQueryAs('project_ids')

        const idsFromCte = await connection.selectFrom(projectIds)
            .select({
                id: projectIds.id,
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with project_ids as /* beforeWithQuery */ (select id as id from project) /* afterWithQuery */ select id as id from project_ids order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof idsFromCte, Array<{ id: number }>>>()
        expect(idsFromCte).toEqual(expected)
    })

    test('docs:sql-fragments/customize-query-execution-name', async () => {
        // Section "A name and metadata for the execution": the SQL doesn't change.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectsOfTheList = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id: tProject.id,
            })
            .customizeQuery({
                queryExecutionName:     'Projects of the list',
                queryExecutionMetadata: { screen: 'project-list' },
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof projectsOfTheList, Array<{ id: number }>>>()
        expect(projectsOfTheList).toEqual(expected)
    })

    test('docs:sql-fragments/customize-query-compound', async () => {
        // Section "Customizing a compound select".
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const allIds = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id: tProject.id,
            }).unionAll(
                connection.selectFrom(tOrganization)
                .where(tOrganization.id.equals(2))
                .select({
                    id: tOrganization.id,
                })
            ).orderBy('id')
            .customizeQuery({
                beforeQuery: connection.rawFragment`/* beforeQuery */`,
                afterQuery:  connection.rawFragment`/* afterQuery */`,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* beforeQuery */ select id as id from project where id = @0 union all select id as id from organization where id = @1 order by id /* afterQuery */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof allIds, Array<{ id: number }>>>()
        expect(allIds).toEqual(expected)
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
                    beforeQuery:        connection.rawFragment`/* before query */`,
                    afterInsertKeyword: connection.rawFragment`/*+ some hints */`,
                    afterQuery:         connection.rawFragment`/* trailing comment */`,
                }).executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* before query */ insert /*+ some hints */ into app_user (email, full_name) values (@0, @1) /* trailing comment */"`)
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
                    beforeQuery:        connection.rawFragment`/* before query */`,
                    afterUpdateKeyword: connection.rawFragment`/*+ some hints */`,
                    afterQuery:         connection.rawFragment`/* trailing comment */`,
                })
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* before query */ update /*+ some hints */ project set name = @0 where id = @1 /* trailing comment */"`)
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
                    beforeQuery:        connection.rawFragment`/* before query */`,
                    afterDeleteKeyword: connection.rawFragment`/*+ some hints */`,
                    afterQuery:         connection.rawFragment`/* trailing comment */`,
                })
                .executeDelete()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* before query */ delete /*+ some hints */ from project where id = @0 /* trailing comment */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                9999,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })

})
