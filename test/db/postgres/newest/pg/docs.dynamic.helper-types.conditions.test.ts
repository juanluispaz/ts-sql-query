// Documentation snippets for the Dynamic conditions utilities page
// (docs/dynamic/helper-types/conditions.md): the filter and descriptor map derived
// from a business model, and their composition with hand-written descriptors.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { DynamicCondition, DynamicConditionForModel, DynamicDefinitionForModel, BigintFilter, BooleanFilter, ComparableFilter, CustomDoubleFilter, CustomIntFilter, CustomLocalDateFilter, CustomLocalDateTimeFilter, CustomLocalTimeFilter, CustomUuidFilter, DateFilter, DateTimeFilter, EqualableFilter, NumberFilter, StringFilter, TimeFilter } from '../../../../../src/dynamic/condition.js'
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

    test('docs:utilities-conditions/dynamic-condition', async () => {
        const expected = [{ id: 1, name: 'Marketing site', slug: 'mktg-site', organization: { name: 'Acme Corp' } }]
        ctx.mockNext([{ id: 1, name: 'Marketing site', slug: 'mktg-site', 'organization.name': 'Acme Corp' }])

        // doc-start
        type ProjectFilter = DynamicCondition<{
            id: 'int'
            name: 'string'
            slug: 'string'
            organization: {
                name: 'string'
            }
        }>

        const filter: ProjectFilter = {
            name: { startsWithInsensitive: 'MARKETING' },
            organization: { name: { equals: 'Acme Corp' } }
        }

        const selectFields = {
            id: tProject.id,
            name: tProject.name,
            slug: tProject.slug,
            organization: {
                name: tOrganization.name
            }
        }

        const rows = await ctx.conn.selectFrom(tProject)
            .innerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues(filter))
            .select(selectFields)
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, project.slug as slug, organization.name as "organization.name" from project inner join organization on organization.id = project.organization_id where project.name ilike ($1 || '%') and organization.name = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "MARKETING",
            "Acme Corp",
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('docs:utilities-conditions/filter-of-a-field', async () => {
        const expected = [{ name: 'Marketing site', slug: 'mktg-site' }]
        ctx.mockNext(expected)

        // doc-start
        type ProjectFilter = DynamicCondition<{
            name: 'string'
            slug: 'string'
        }>

        function textFilter(text: string): StringFilter {
            return { containsInsensitive: text }
        }

        const filter: ProjectFilter = {
            or: [
                { name: textFilter('MKTG') },
                { slug: textFilter('MKTG') }
            ]
        }

        const selectFields = {
            name: tProject.name,
            slug: tProject.slug
        }

        const rows = await ctx.conn.selectFrom(tProject)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues(filter))
            .select(selectFields)
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select name as name, slug as slug from project where name ilike ('%' || $1 || '%') or slug ilike ('%' || $2 || '%')"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "MKTG",
            "MKTG",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ name: string; slug: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('docs-extra:utilities-conditions/each-type-name-maps-to-its-filter', () => {
        type Definition = {
            string: 'string'; uuid: 'uuid'; int: 'int'; double: 'double'; bigint: 'bigint'; boolean: 'boolean'
            localDate: 'localDate'; localTime: 'localTime'; localDateTime: 'localDateTime'
            enum: ['enum', 'a' | 'b']; custom: ['custom', 'a' | 'b']; customComparable: ['customComparable', 'a' | 'b']
            customInt: ['customInt', 'a' | 'b']; customDouble: ['customDouble', 'a' | 'b']; customUuid: ['customUuid', 'a' | 'b']
            customLocalDate: ['customLocalDate', 'a' | 'b']; customLocalTime: ['customLocalTime', 'a' | 'b']; customLocalDateTime: ['customLocalDateTime', 'a' | 'b']
        }
        type Filter = DynamicCondition<Definition>
        assertType<Exact<NonNullable<Filter['string']>, StringFilter>>()
        assertType<Exact<NonNullable<Filter['uuid']>, StringFilter>>()
        assertType<Exact<NonNullable<Filter['int']>, NumberFilter>>()
        assertType<Exact<NonNullable<Filter['double']>, NumberFilter>>()
        assertType<Exact<NonNullable<Filter['bigint']>, BigintFilter>>()
        assertType<Exact<NonNullable<Filter['boolean']>, BooleanFilter>>()
        assertType<Exact<NonNullable<Filter['localDate']>, DateFilter>>()
        assertType<Exact<NonNullable<Filter['localTime']>, TimeFilter>>()
        assertType<Exact<NonNullable<Filter['localDateTime']>, DateTimeFilter>>()
        assertType<Exact<NonNullable<Filter['enum']>, EqualableFilter<'a' | 'b'>>>()
        assertType<Exact<NonNullable<Filter['custom']>, EqualableFilter<'a' | 'b'>>>()
        assertType<Exact<NonNullable<Filter['customComparable']>, ComparableFilter<'a' | 'b'>>>()
        assertType<Exact<NonNullable<Filter['customInt']>, CustomIntFilter<'a' | 'b'>>>()
        assertType<Exact<NonNullable<Filter['customDouble']>, CustomDoubleFilter<'a' | 'b'>>>()
        assertType<Exact<NonNullable<Filter['customUuid']>, CustomUuidFilter<'a' | 'b'>>>()
        assertType<Exact<NonNullable<Filter['customLocalDate']>, CustomLocalDateFilter<'a' | 'b'>>>()
        assertType<Exact<NonNullable<Filter['customLocalTime']>, CustomLocalTimeFilter<'a' | 'b'>>>()
        assertType<Exact<NonNullable<Filter['customLocalDateTime']>, CustomLocalDateTimeFilter<'a' | 'b'>>>()
    })

    test('docs-extra:utilities-conditions/a-branded-property-has-equality-and-comparison', () => {
        type Code = string & { __brand: 'code' }
        type Filter = DynamicConditionForModel<{ code: Code; name: string; optional?: string | null }>
        assertType<Exact<NonNullable<Filter['code']>, ComparableFilter<Code>>>()
        assertType<Exact<NonNullable<DynamicConditionForModel<{ kind: 'a' | 'b' }>['kind']>, EqualableFilter<'a' | 'b'>>>()
        assertType<Exact<NonNullable<Filter['name']>, StringFilter>>()
        assertType<Exact<NonNullable<Filter['optional']>, StringFilter>>()
    })

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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name from project inner join organization on organization.id = project.organization_id where project.name ilike ('%' || $1 || '%') and (project.published = 't') = $2 and project.slug in ($3) and project.created_at > $4 and organization.name = $5 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "SITE",
            true,
            "mktg-site",
            "1990-01-01 00:00:00.000+00",
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id from project inner join organization on organization.id = project.organization_id where project.name = $1 and project.created_at > $2 and organization.name = $3 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Marketing site",
            "1990-01-01 00:00:00.000+00",
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
