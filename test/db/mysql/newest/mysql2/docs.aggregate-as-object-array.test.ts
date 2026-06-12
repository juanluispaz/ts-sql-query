// Documentation snippets for the Aggregate-as-object-array page
// (docs/queries/aggregate-as-object-array.md). Covers
// `aggregateAsArray`, `aggregateAsArrayOfOneColumn`, their distinct
// variants, the `forUseAsInlineAggregatedArrayValue` inline form, and
// `projectingOptionalValuesAsNullable`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:aggregate-as-object-array/aggregate-as-array', async () => {
        const expected = {
            id: 1, name: 'Acme Corp',
            projects: [
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ],
        }
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projects: JSON.stringify([
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ]),
        })
        const connection = ctx.conn

        // doc-start
        const tProjectLeftJoin = tProject.forUseInLeftJoin()
        const row = await connection.selectFrom(tOrganization)
            .leftJoin(tProjectLeftJoin).on(tProjectLeftJoin.organizationId.equals(tOrganization.id)
                .and(tProjectLeftJoin.archivedAt.isNull()))
            .where(tOrganization.id.equals(1))
            .select({
                id:   tOrganization.id,
                name: tOrganization.name,
                projects: connection.aggregateAsArray({
                    id:   tProjectLeftJoin.id,
                    name: tProjectLeftJoin.name,
                }).asOptionalNonEmptyArray(),
            })
            .groupBy('id', 'name')
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`organization\`.id as id, \`organization\`.\`name\` as \`name\`, json_arrayagg(json_object('id', project.id, 'name', project.\`name\`)) as projects from \`organization\` left join project on project.organization_id = \`organization\`.id and project.archived_at is null where \`organization\`.id = ? group by \`organization\`.id, \`organization\`.\`name\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:   number
            name: string
            projects?: Array<{ id: number; name: string }>
        }>>()
        expect(row).toEqual(expected)
    })

    test('docs:aggregate-as-object-array/aggregate-as-array-of-one-column', async () => {
        const expected = {
            id: 1, name: 'Acme Corp',
            projectNames: ['Marketing site', 'Internal tools'],
        }
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projectNames: JSON.stringify(['Marketing site', 'Internal tools']),
        })
        const connection = ctx.conn

        // doc-start
        const tProjectLeftJoin = tProject.forUseInLeftJoin()
        const row = await connection.selectFrom(tOrganization)
            .leftJoin(tProjectLeftJoin).on(tProjectLeftJoin.organizationId.equals(tOrganization.id))
            .where(tOrganization.id.equals(1))
            .select({
                id:           tOrganization.id,
                name:         tOrganization.name,
                projectNames: connection.aggregateAsArrayOfOneColumn(tProjectLeftJoin.name),
            })
            .groupBy('id', 'name')
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`organization\`.id as id, \`organization\`.\`name\` as \`name\`, json_arrayagg(project.\`name\`) as projectNames from \`organization\` left join project on project.organization_id = \`organization\`.id where \`organization\`.id = ? group by \`organization\`.id, \`organization\`.\`name\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:           number
            name:         string
            projectNames: string[]
        }>>()
        expect(row).toEqual(expected)
    })

    test('docs:aggregate-as-object-array/inline-aggregated-array', async () => {
        const expected = {
            id: 1, name: 'Acme Corp',
            projects: [
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ],
        }
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projects: JSON.stringify([
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ]),
        })
        const connection = ctx.conn

        // doc-start
        const orgProjects = connection.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id)
                .and(tProject.archivedAt.isNull()))
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('id')
            .forUseAsInlineAggregatedArrayValue()

        const row = await connection.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:       tOrganization.id,
                name:     tOrganization.name,
                projects: orgProjects,
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\`, (select json_arrayagg(json_object('id', a_1_.id, 'name', a_1_.\`name\`)) from (select id as id, \`name\` as \`name\` from project where organization_id = \`organization\`.id and archived_at is null order by id limit 2147483647) as a_1_) as projects from \`organization\` where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:       number
            name:     string
            projects: Array<{ id: number; name: string }>
        }>>()
        expect(row).toEqual(expected)
    })

    test('docs:aggregate-as-object-array/inline-aggregated-of-one-column', async () => {
        // orderBy('result') → real DB returns the names alphabetically.
        const expected = {
            id: 1, name: 'Acme Corp',
            projectNames: ['Internal tools', 'Marketing site'],
        }
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projectNames: JSON.stringify(['Internal tools', 'Marketing site']),
        })
        const connection = ctx.conn

        // doc-start
        const orgProjectNames = connection.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .selectOneColumn(tProject.name)
            .orderBy('result')
            .forUseAsInlineAggregatedArrayValue()

        const row = await connection.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:           tOrganization.id,
                name:         tOrganization.name,
                projectNames: orgProjectNames,
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\`, (select json_arrayagg(a_1_.result) from (select \`name\` as result from project where organization_id = \`organization\`.id order by result limit 2147483647) as a_1_) as projectNames from \`organization\` where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:           number
            name:         string
            projectNames: string[]
        }>>()
        expect(row).toEqual(expected)
    })

    // `aggregateAsArrayOfOneColumnDistinct` is not exposed on
    // `MySqlConnection` — MySQL's `JSON_ARRAYAGG` does not accept the
    // DISTINCT quantifier (`ER_PARSE_ERROR: syntax error near 'distinct …'`)
    // and the same-query emulation is not portable (it would require
    // restructuring the outer SELECT). The method is therefore only
    // declared on PostgreSqlConnection, MariaDBConnection,
    // SqliteConnection and NoopDBConnection, so calling it on a
    // MySqlConnection is a TypeScript compile error. The test body is
    // kept commented out for cross-cell symmetry. Documented workaround
    // for users:
    // `subSelectUsing(...).distinct().select(...).forUseAsInlineAggregatedArrayValue()`.
    // NOT-APPLICABLE: MySQL's JSON_ARRAYAGG does not accept DISTINCT, so aggregateAsArrayOfOneColumnDistinct is not declared on MySqlConnection
    /*
    test('docs:aggregate-as-object-array/aggregate-as-array-distinct', async () => {
        ctx.mockNext({
            id: 1, name: 'Marketing site',
            priorities: JSON.stringify([1, 2]),
        })
        const connection = ctx.conn

        // doc-start
        const tIssueLeftJoin = tIssue.forUseInLeftJoin()
        const row = await connection.selectFrom(tProject)
            .leftJoin(tIssueLeftJoin).on(tIssueLeftJoin.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                id:         tProject.id,
                name:       tProject.name,
                priorities: connection.aggregateAsArrayOfOneColumnDistinct(tIssueLeftJoin.priority),
            })
            .groupBy('id', 'name')
            .executeSelectOne()
        // doc-end

        expect(row?.priorities).toEqual(expect.arrayContaining([1, 2]))
    })
    */
})
