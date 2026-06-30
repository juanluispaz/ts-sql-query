// Aggregate-element top-level rule-2 (`ObjectResultSameOuterJoin`): every leaf of
// the aggregated element comes from ONE outer-joined table. This is the distinct
// projector arm from rule-3 (own-table, see
// select.aggregate-as-array.element-projection-rules.test.ts) — the existing
// all-left-join element coverage only used originally-required leaves ({id,name}),
// so it could not distinguish rule-2 from rule-4 and had no nullable-projector
// twin. Adding an OPTIONAL leaf (`archivedAt`) over the outer-joined table makes
// the rule observable: the required leaves stay required, the optional leaf
// follows the projector. Output coincides with the own-table rule's shape, which
// is exactly where a rule-2-vs-rule-3 impl divergence would hide.
//
// Organization 1 has projects 1 ('Marketing site') and 2 ('Internal tools'),
// both with archived_at NULL, so the optional `archivedAt` leaf exercises the
// absent-vs-present-null distinction across the two projectors. JSON aggregate
// order is not guaranteed, so the array is sorted by id before comparing; mocks
// are primed with the RAW aggregated rows.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('element-top-rule-2-outer-join-optional-leaf-default-drops-null', async () => {
        // The element is built entirely from a LEFT-JOINED project. Required leaves
        // (id, name) stay required; the optional `archivedAt` leaf is dropped from
        // the element when NULL under the default projector.
        const tProjectLeft = tProject.forUseInLeftJoin()
        ctx.mockNext([{ org: 1, projects: [
            { id: 1, name: 'Marketing site', archivedAt: null },
            { id: 2, name: 'Internal tools', archivedAt: null },
        ] }])
        const rows = await ctx.conn.selectFrom(tOrganization)
            .leftJoin(tProjectLeft).on(tProjectLeft.organizationId.equals(tOrganization.id))
            .where(tOrganization.id.equals(1))
            .select({
                org:      tOrganization.id,
                projects: ctx.conn.aggregateAsArray({
                    id:         tProjectLeft.id,
                    name:       tProjectLeft.name,
                    archivedAt: tProjectLeft.archivedAt,
                }),
            })
            .groupBy('org')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as org, json_group_array(json_object('id', project.id, 'name', project.name, 'archivedAt', project.archived_at)) as projects from organization left join project on project.organization_id = organization.id where organization.id = ? group by organization.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            org:      number
            projects: Array<{ id: number; name: string; archivedAt?: Date }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, projects: [...r.projects].sort((a, b) => a.id - b.id) }))
        expect(sorted).toEqual([{ org: 1, projects: [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
        ] }])
        // The null archivedAt leaf is ABSENT under the default projector.
        const project1 = rows[0]!.projects.find(p => p.id === 1)!
        expect('archivedAt' in project1).toBe(false)
    })

    test('element-top-rule-2-outer-join-optional-leaf-as-nullable-surfaces-null', async () => {
        // `projectingOptionalValuesAsNullable()` keeps the optional `archivedAt`
        // leaf of the outer-joined element as `Date | null` (present-null) instead
        // of dropping it.
        const tProjectLeft = tProject.forUseInLeftJoin()
        ctx.mockNext([{ org: 1, projects: [
            { id: 1, name: 'Marketing site', archivedAt: null },
            { id: 2, name: 'Internal tools', archivedAt: null },
        ] }])
        const rows = await ctx.conn.selectFrom(tOrganization)
            .leftJoin(tProjectLeft).on(tProjectLeft.organizationId.equals(tOrganization.id))
            .where(tOrganization.id.equals(1))
            .select({
                org:      tOrganization.id,
                projects: ctx.conn.aggregateAsArray({
                    id:         tProjectLeft.id,
                    name:       tProjectLeft.name,
                    archivedAt: tProjectLeft.archivedAt,
                }).projectingOptionalValuesAsNullable(),
            })
            .groupBy('org')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as org, json_group_array(json_object('id', project.id, 'name', project.name, 'archivedAt', project.archived_at)) as projects from organization left join project on project.organization_id = organization.id where organization.id = ? group by organization.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            org:      number
            projects: Array<{ id: number; name: string; archivedAt: Date | null }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, projects: [...r.projects].sort((a, b) => a.id - b.id) }))
        expect(sorted).toEqual([{ org: 1, projects: [
            { id: 1, name: 'Marketing site', archivedAt: null },
            { id: 2, name: 'Internal tools', archivedAt: null },
        ] }])
        // The null archivedAt leaf is PRESENT-NULL under the nullable projector.
        const project1 = rows[0]!.projects.find(p => p.id === 1)!
        expect('archivedAt' in project1).toBe(true)
    })
})
