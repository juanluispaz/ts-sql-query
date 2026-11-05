// Documentation snippets for the Dynamic conditions utilities page
// (docs/dynamic/utilities/conditions.md): the filter and descriptor map derived
// from a business model, and their composition with hand-written descriptors.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { DynamicCondition, DynamicConditionForModel, DynamicDefinitionForModel, ComparableFilter, EqualableFilter, StringFilter } from '../../../../../src/dynamic/condition.js'
import { tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    const projectFields = {
        id:        tProject.id,
        name:      tProject.name,
        createdAt: tProject.createdAt,
        published: tProject.published,
        slug:      tProject.slug,
        organization: {
            id:   tOrganization.id,
            name: tOrganization.name,
        },
    }

    test('docs:utilities-conditions/dynamic-condition-for-model', async () => {
        // doc-start
        interface Project {
            id: number
            name: string
            createdAt: Date
            published: boolean
            slug: 'mktg-site' | 'tools' | 'public-api' | 'legacy'
            organization?: {
                id: number
                name: string
            }
        }

        // the filter type derived from the model
        type ProjectFilter = DynamicConditionForModel<Project>

        // the descriptor map it builds on
        type ProjectDefinition = DynamicDefinitionForModel<Project>

        // a criteria object, fully checked against the model
        const filter: ProjectFilter = {
            name: { containsInsensitive: 'SITE' },
            published: { equals: true },
            slug: { in: ['mktg-site'] },
            createdAt: { greaterThan: new Date('1990-01-01') },
            organization: { name: { equals: 'Acme Corp' } }
        }
        // doc-end

        assertType<Exact<ProjectDefinition, {
            id: 'int'
            name: 'string'
            createdAt: 'localDateTime'
            published: 'boolean'
            slug: ['enum', 'mktg-site' | 'tools' | 'public-api' | 'legacy']
            organization: { id: 'int'; name: 'string' }
        }>>()

        const expected = [{ id: 1, name: 'Marketing site' }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .innerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
            .where(ctx.conn.dynamicConditionFor(projectFields).withValues(filter))
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name from project inner join organization on organization.id = project.organization_id where lower(project.name) like lower('%' || ?1 || '%') escape '\\' and (project.published = 't') = ?2 and project.slug in (?3) and project.created_at > ?4 and organization.name = ?5 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "SITE",
            1,
            "mktg-site",
            "1990-01-01 00:00:00",
            "Acme Corp",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('docs:utilities-conditions/definition-composition', async () => {
        // doc-start
        interface Project {
            id: number
            name: string
            organization?: {
                id: number
                name: string
            }
        }

        // compose the model-derived descriptor with hand-written descriptor fields
        type AuditedFilter = DynamicCondition<DynamicDefinitionForModel<Project> & { auditedAt: 'localDateTime' }>
        // doc-end

        assertType<Exact<NonNullable<AuditedFilter['id']>, ComparableFilter<number>>>()
        assertType<Exact<NonNullable<AuditedFilter['auditedAt']>, ComparableFilter<Date>>>()

        const filter: AuditedFilter = {
            name: { equals: 'Marketing site' },
            auditedAt: { greaterThan: new Date('1990-01-01') },
            organization: { name: { equals: 'Acme Corp' } },
        }
        const fields = {
            id:        tProject.id,
            name:      tProject.name,
            auditedAt: tProject.createdAt,
            organization: {
                id:   tOrganization.id,
                name: tOrganization.name,
            },
        }
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .innerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
            .where(ctx.conn.dynamicConditionFor(fields).withValues(filter))
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id from project inner join organization on organization.id = project.organization_id where project.name = ?1 and project.created_at > ?2 and organization.name = ?3 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Marketing site",
            "1990-01-01 00:00:00",
            "Acme Corp",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('docs-extra:utilities-conditions/each-model-type-maps-to-its-filter', () => {
        type Filter = DynamicConditionForModel<{
            flag:    boolean
            count:   number
            big:     bigint
            text:    string
            at:      Date
            state:   'on' | 'off'
            level:   1 | 2
            nested?: { id: number }
        }>
        assertType<Exact<NonNullable<Filter['flag']>, EqualableFilter<boolean>>>()
        assertType<Exact<NonNullable<Filter['count']>, ComparableFilter<number>>>()
        assertType<Exact<NonNullable<Filter['big']>, ComparableFilter<bigint>>>()
        assertType<Exact<NonNullable<Filter['text']>, StringFilter>>()
        assertType<Exact<NonNullable<Filter['at']>, ComparableFilter<Date>>>()
        assertType<Exact<NonNullable<Filter['state']>, EqualableFilter<'on' | 'off'>>>()
        assertType<Exact<NonNullable<Filter['level']>, EqualableFilter<1 | 2>>>()
        assertType<Exact<NonNullable<Filter['nested']>, DynamicCondition<{ id: 'int' }>>>()
    })

    test('docs-extra:utilities-conditions/non-filterable-values-are-not-mapped', () => {
        // Arrays, Map/Set and binary buffers have no filter: the key isn't in the produced type.
        type Filter = DynamicConditionForModel<{
            id:     number
            tags:   string[]
            scores: Map<string, number>
            seen:   Set<string>
            blob:   Uint8Array
        }>
        assertType<Exact<keyof Filter, 'id' | 'and' | 'or' | 'not'>>()
    })
})
