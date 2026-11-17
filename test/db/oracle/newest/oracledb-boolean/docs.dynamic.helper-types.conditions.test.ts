// Documentation snippets for the Dynamic conditions utilities page
// (docs/dynamic/helper-types/conditions.md): the filter and descriptor map derived
// from a business model, and their composition with hand-written descriptors.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { DynamicCondition, DynamicConditionForModel, DynamicDefinitionForModel } from '../../../../../src/dynamic/condition.js'
import { tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'
import type { ComparableType, EnumType, EqualableType, IntegersType, LocalDateTimesType, LocalDatesType, LocalTimesType, RealsType, UuidsType, BigintType, BooleanType, FilterOf, IntType, LocalDateTimeType, LocalDateType, LocalTimeType, StringType, DoubleType, UuidType } from '../../../../../src/exports/v2/index.js'

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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "id", project.name as "name", project.slug as "slug", "organization".name as "organization.name" from project inner join "organization" on "organization".id = project.organization_id where lower(project.name) like lower(:0 || '%') escape '\\' and "organization".name = :1"`)
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

        function textFilter(text: string): FilterOf<StringType> {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select name as "name", slug as "slug" from project where lower(name) like lower('%' || :0 || '%') escape '\\' or lower(slug) like lower('%' || :1 || '%') escape '\\'"`)
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
            enum: EnumType<'a' | 'b', string>; custom: EqualableType<'a' | 'b', string>; ownComparable: ComparableType<'a' | 'b', string>
            ownInt: IntegersType<'a' | 'b', string>; ownDouble: RealsType<'a' | 'b', string>; ownUuid: UuidsType<'a' | 'b', string>
            ownLocalDate: LocalDatesType<'a' | 'b', string>; ownLocalTime: LocalTimesType<'a' | 'b', string>; ownLocalDateTime: LocalDateTimesType<'a' | 'b', string>
        }
        type Filter = DynamicCondition<Definition>
        assertType<Exact<NonNullable<Filter['string']>, FilterOf<StringType>>>()
        assertType<Exact<NonNullable<Filter['uuid']>, FilterOf<UuidType>>>()
        assertType<Exact<NonNullable<Filter['int']>, FilterOf<IntType>>>()
        assertType<Exact<NonNullable<Filter['double']>, FilterOf<DoubleType>>>()
        assertType<Exact<NonNullable<Filter['bigint']>, FilterOf<BigintType>>>()
        assertType<Exact<NonNullable<Filter['boolean']>, FilterOf<BooleanType>>>()
        assertType<Exact<NonNullable<Filter['localDate']>, FilterOf<LocalDateType>>>()
        assertType<Exact<NonNullable<Filter['localTime']>, FilterOf<LocalTimeType>>>()
        assertType<Exact<NonNullable<Filter['localDateTime']>, FilterOf<LocalDateTimeType>>>()
        assertType<Exact<NonNullable<Filter['enum']>, FilterOf<EqualableType<'a' | 'b', string>>>>()
        assertType<Exact<NonNullable<Filter['custom']>, FilterOf<EqualableType<'a' | 'b', string>>>>()
        assertType<Exact<NonNullable<Filter['ownComparable']>, FilterOf<ComparableType<'a' | 'b', string>>>>()
        assertType<Exact<NonNullable<Filter['ownInt']>, FilterOf<ComparableType<'a' | 'b', string>>>>()
        assertType<Exact<NonNullable<Filter['ownDouble']>, FilterOf<ComparableType<'a' | 'b', string>>>>()
        assertType<Exact<NonNullable<Filter['ownUuid']>, FilterOf<UuidsType<'a' | 'b', string>>>>()
        assertType<Exact<NonNullable<Filter['ownLocalDate']>, FilterOf<ComparableType<'a' | 'b', string>>>>()
        assertType<Exact<NonNullable<Filter['ownLocalTime']>, FilterOf<ComparableType<'a' | 'b', string>>>>()
        assertType<Exact<NonNullable<Filter['ownLocalDateTime']>, FilterOf<ComparableType<'a' | 'b', string>>>>()
    })

    test('docs-extra:utilities-conditions/a-branded-property-has-equality-and-comparison', () => {
        type Code = string & { __brand: 'code' }
        type Filter = DynamicConditionForModel<{ code: Code; name: string; optional?: string | null }>
        assertType<Exact<NonNullable<Filter['code']>, FilterOf<ComparableType<Code, string>>>>()
        assertType<Exact<NonNullable<DynamicConditionForModel<{ kind: 'a' | 'b' }>['kind']>, FilterOf<EqualableType<'a' | 'b', string>>>>()
        assertType<Exact<NonNullable<Filter['name']>, FilterOf<StringType>>>()
        assertType<Exact<NonNullable<Filter['optional']>, FilterOf<StringType>>>()
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
            slug: EnumType<'mktg-site' | 'tools' | 'public-api' | 'legacy', string>
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "id", project.name as "name" from project inner join "organization" on "organization".id = project.organization_id where lower(project.name) like lower('%' || :0 || '%') escape '\\' and (project.published = 't') = :1 and project.slug in (:2) and project.created_at > :3 and "organization".name = :4 order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "SITE",
            true,
            "mktg-site",
            1990-01-01T00:00:00.000Z,
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

        assertType<Exact<NonNullable<AuditedFilter['id']>, FilterOf<ComparableType<number, string>>>>()
        assertType<Exact<NonNullable<AuditedFilter['auditedAt']>, FilterOf<ComparableType<Date, string>>>>()

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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "id" from project inner join "organization" on "organization".id = project.organization_id where project.name = :0 and project.created_at > :1 and "organization".name = :2 order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Marketing site",
            1990-01-01T00:00:00.000Z,
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
        assertType<Exact<NonNullable<Filter['flag']>, FilterOf<EqualableType<boolean, string>>>>()
        assertType<Exact<NonNullable<Filter['count']>, FilterOf<ComparableType<number, string>>>>()
        assertType<Exact<NonNullable<Filter['big']>, FilterOf<ComparableType<bigint, string>>>>()
        assertType<Exact<NonNullable<Filter['text']>, FilterOf<StringType>>>()
        assertType<Exact<NonNullable<Filter['at']>, FilterOf<ComparableType<Date, string>>>>()
        assertType<Exact<NonNullable<Filter['state']>, FilterOf<EqualableType<'on' | 'off', string>>>>()
        assertType<Exact<NonNullable<Filter['level']>, FilterOf<EqualableType<1 | 2, string>>>>()
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
