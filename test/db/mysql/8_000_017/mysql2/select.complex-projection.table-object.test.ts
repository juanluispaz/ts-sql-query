// Projecting a whole table object instead of listing its columns: as the root
// projection (`select(tTable)`), as a nested object (`{ org: tTable }`), and as
// a nested object over a left-joined table, where it follows the same-left-join
// rule (present with every column, or absent when the join misses).
//
// Seed: organization 1 is Acme Corp (pro, verified, created 2023-06-15 08:00),
// organization 2 is Globex Ltd (free, not verified, created 2023-09-20 14:30).
// Projects 1 and 2 belong to Acme Corp, projects 3 and 4 to Globex Ltd.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('select-whole-table-object-as-root-projection', async () => {
        const expected = [
            { id: 1, name: 'Acme Corp', plan: 'pro', verified: true, createdAt: new Date(Date.UTC(2023, 5, 15, 8, 0, 0)) },
            { id: 2, name: 'Globex Ltd', plan: 'free', verified: false, createdAt: new Date(Date.UTC(2023, 8, 20, 14, 30, 0)) },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .select(tOrganization)
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\`, plan as plan, (verified = 'Y') as verified, created_at as createdAt from \`organization\` order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            id:        number
            name:      string
            plan:      string
            verified:  boolean
            createdAt: Date
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('select-whole-table-object-as-nested-object', async () => {
        const acme = { id: 1, name: 'Acme Corp', plan: 'pro', verified: true, createdAt: new Date(Date.UTC(2023, 5, 15, 8, 0, 0)) }
        const globex = { id: 2, name: 'Globex Ltd', plan: 'free', verified: false, createdAt: new Date(Date.UTC(2023, 8, 20, 14, 30, 0)) }
        const expected = [
            { projectId: 1, organization: acme },
            { projectId: 3, organization: globex },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .join(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
            .where(tProject.id.in([1, 3]))
            .select({
                projectId:    tProject.id,
                organization: tOrganization,
            })
            .orderBy('projectId')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as projectId, \`organization\`.id as \`organization.id\`, \`organization\`.\`name\` as \`organization.name\`, \`organization\`.plan as \`organization.plan\`, (\`organization\`.verified = 'Y') as \`organization.verified\`, \`organization\`.created_at as \`organization.createdAt\` from project join \`organization\` on \`organization\`.id = project.organization_id where project.id in (?, ?) order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            projectId:    number
            organization: { id: number; name: string; plan: string; verified: boolean; createdAt: Date }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('select-left-joined-table-object-as-nested-object-is-absent-on-join-miss', async () => {
        // Only pro-plan organizations are joined: Acme Corp's projects 1 and 2
        // carry it, Globex Ltd's projects 3 and 4 miss and drop the object. The
        // join is optional, so it is kept only because the table object is
        // projected.
        const acme = { id: 1, name: 'Acme Corp', plan: 'pro', verified: true, createdAt: new Date(Date.UTC(2023, 5, 15, 8, 0, 0)) }
        const expected = [
            { projectId: 1, proOrganization: acme },
            { projectId: 2, proOrganization: acme },
            { projectId: 3 },
            { projectId: 4 },
        ]
        const missingOrganization = {
            'proOrganization.id':        null,
            'proOrganization.name':      null,
            'proOrganization.plan':      null,
            'proOrganization.verified':  null,
            'proOrganization.createdAt': null,
        }
        ctx.mockNext([
            { projectId: 1, proOrganization: acme },
            { projectId: 2, proOrganization: acme },
            { projectId: 3, ...missingOrganization },
            { projectId: 4, ...missingOrganization },
        ])
        const proOrganization = tOrganization.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .optionalLeftJoin(proOrganization).on(proOrganization.id.equals(tProject.organizationId).and(proOrganization.plan.equals('pro')))
            .select({
                projectId: tProject.id,
                proOrganization,
            })
            .orderBy('projectId')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as projectId, \`organization\`.id as \`proOrganization.id\`, \`organization\`.\`name\` as \`proOrganization.name\`, \`organization\`.plan as \`proOrganization.plan\`, (\`organization\`.verified = 'Y') as \`proOrganization.verified\`, \`organization\`.created_at as \`proOrganization.createdAt\` from project left join \`organization\` on \`organization\`.id = project.organization_id and \`organization\`.plan = ? order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "pro",
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            projectId:        number
            proOrganization?: { id: number; name: string; plan: string; verified: boolean; createdAt: Date }
        }>>>()
        expect(rows).toEqual(expected)
        expect('proOrganization' in rows[2]!).toBe(false)
    })
})
