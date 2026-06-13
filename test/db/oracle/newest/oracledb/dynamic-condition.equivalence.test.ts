// Equivalence proof: `connection.dynamicConditionFor(...).withValues(...)`
// must emit exactly the SQL + params a hand-written direct-API predicate
// produces. Dynamic conditions exist so an external system can hand a
// JSON-shaped filter that ts-sql-query maps onto the *same* public
// value-source methods the fluent API exposes
// ([src/queryBuilders/DynamicConditionBuilder.ts](../../../../../src/queryBuilders/DynamicConditionBuilder.ts)).
//
// Every test here builds the predicate twice:
//   - REFERENCE — the direct fluent call (`tIssue.priority.equals(3)`),
//     usable on its own and easy to read.
//   - DYNAMIC   — the equivalent filter object fed through
//     `dynamicConditionFor(...).withValues(...)`.
// then asserts the two emit identical SQL + params. The reference SQL is
// pinned with an inline snapshot so the per-dialect emission is
// documented; the dynamic side is proven equal to it. This is the
// systematic way to show the dynamic dispatcher reaches every operator it
// is meant to reach — not just the handful the docs page shows.
//
// The sibling `dynamic-condition.operators.test.ts` pins the dynamic SQL
// directly; this file adds the missing half (equivalence to the direct
// API) and fills the dispatch gaps that file does not reach:
//   - `is` / `isNot` (null-safe equality, distinct from equals/notEquals)
//   - the `isNull(false)` / `isNotNull(false)` negate branch
//     ([DynamicConditionBuilder.ts:158-162](../../../../../src/queryBuilders/DynamicConditionBuilder.ts#L158-L162))
//   - `equalsInsensitive` / `notEqualsInsensitive`
//   - the *insensitive* affix family (startsWith/endsWith/contains)
//   - the `*IfValue` family WITH a value (emits the same as the plain op)
//   - operator dispatch across the bigint / double / localDateTime /
//     boolean (custom adapter) column types, not just int + string
//   - the uuid `asString()` rewrite the builder applies for the
//     like/insensitive operators
//     ([DynamicConditionBuilder.ts:164-166](../../../../../src/queryBuilders/DynamicConditionBuilder.ts#L164-L166)).
//
// The result *type* of a query is unaffected by its WHERE expression, so
// these tests assert SQL + params identity only; result-type coverage for
// the `{ id }` projection lives in the operators / deep-and-or files.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import type { DynamicCondition } from '../../../../../src/dynamic/condition.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

const selectFields = {
    id:             tIssue.id,
    title:          tIssue.title,
    body:           tIssue.body,
    status:         tIssue.status,
    priority:       tIssue.priority,
    viewCount:      tIssue.viewCount,
    estimatedHours: tIssue.estimatedHours,
    externalRef:    tIssue.externalRef,
    createdAt:      tIssue.createdAt,
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('equivalence/equals-and-not-equals', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.equals(2).and(tIssue.priority.notEquals(5)))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({ priority: { equals: 2, notEquals: 5 } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where priority = :0 and priority <> :1 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2,
            5,
          ]
        `)
    })

    test('equivalence/is-and-is-not', async () => {
        // `is` / `isNot` are the null-safe equality operators, dispatched
        // distinctly from equals/notEquals and special-cased in the
        // builder's `_isValue` guard so they survive even on null input.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.is(2).and(tIssue.status.isNot('closed')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({ priority: { is: 2 }, status: { isNot: 'closed' } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where decode(priority, :0, 1, 0 ) = 1 and decode(status, :1, 1, 0 ) = 0 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2,
            "closed",
          ]
        `)
    })

    test('equivalence/in-and-not-in', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.in([1, 2]).and(tIssue.priority.notIn([9])))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({ priority: { in: [1, 2], notIn: [9] } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where priority in (:0, :1) and priority not in (:2) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            9,
          ]
        `)
    })

    test('equivalence/comparable-operators', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.greaterThan(1)
                .and(tIssue.priority.lessThan(9))
                .and(tIssue.priority.greaterOrEqual(2))
                .and(tIssue.priority.lessOrEqual(8)))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({
            priority: { greaterThan: 1, lessThan: 9, greaterOrEqual: 2, lessOrEqual: 8 },
        }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where priority > :0 and priority < :1 and priority >= :2 and priority <= :3 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1,
            9,
            2,
            8,
          ]
        `)
    })

    test('equivalence/is-null-and-is-not-null-false-branch-negates', async () => {
        // `isNull: false` / `isNotNull: false` route through the builder's
        // negate branch: it calls `valueSource.isNull()` then `.negate()`
        // when the supplied boolean is false. The reference spells that out.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.body.isNull().negate().and(tIssue.body.isNotNull().negate()))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({ body: { isNull: false, isNotNull: false } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where not "body" is null and not "body" is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`[]`)
    })

    test('equivalence/equals-insensitive-and-not-equals-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.equalsInsensitive('Triage').and(tIssue.title.notEqualsInsensitive('Draft')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({
            title: { equalsInsensitive: 'Triage', notEqualsInsensitive: 'Draft' },
        }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where lower(title) = lower(:0) and lower(title) <> lower(:1) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "Triage",
            "Draft",
          ]
        `)
    })

    test('equivalence/like-family', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.like('%a%')
                .and(tIssue.title.notLike('%b%'))
                .and(tIssue.title.likeInsensitive('%C%'))
                .and(tIssue.title.notLikeInsensitive('%D%')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({
            title: { like: '%a%', notLike: '%b%', likeInsensitive: '%C%', notLikeInsensitive: '%D%' },
        }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where title like :0 escape '\\' and title not like :1 escape '\\' and lower(title) like lower(:2) escape '\\' and lower(title) not like lower(:3) escape '\\' order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "%a%",
            "%b%",
            "%C%",
            "%D%",
          ]
        `)
    })

    test('equivalence/affix-sensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.startsWith('Re')
                .and(tIssue.title.notStartsWith('Un'))
                .and(tIssue.title.endsWith('me'))
                .and(tIssue.title.notEndsWith('xx'))
                .and(tIssue.title.contains('esi'))
                .and(tIssue.title.notContains('zzz')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({
            title: {
                startsWith: 'Re', notStartsWith: 'Un',
                endsWith: 'me', notEndsWith: 'xx',
                contains: 'esi', notContains: 'zzz',
            },
        }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where title like (:0 || '%') escape '\\' and title not like (:1 || '%') escape '\\' and title like ('%' || :2) escape '\\' and title not like ('%' || :3) escape '\\' and title like ('%' || :4 || '%') escape '\\' and title not like ('%' || :5 || '%') escape '\\' order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "Re",
            "Un",
            "me",
            "xx",
            "esi",
            "zzz",
          ]
        `)
    })

    test('equivalence/affix-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.startsWithInsensitive('Re')
                .and(tIssue.title.notStartsWithInsensitive('Un'))
                .and(tIssue.title.endsWithInsensitive('me'))
                .and(tIssue.title.notEndsWithInsensitive('xx'))
                .and(tIssue.title.containsInsensitive('esi'))
                .and(tIssue.title.notContainsInsensitive('zzz')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({
            title: {
                startsWithInsensitive: 'Re', notStartsWithInsensitive: 'Un',
                endsWithInsensitive: 'me', notEndsWithInsensitive: 'xx',
                containsInsensitive: 'esi', notContainsInsensitive: 'zzz',
            },
        }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where lower(title) like lower(:0 || '%') escape '\\' and lower(title) not like lower(:1 || '%') escape '\\' and lower(title) like lower('%' || :2) escape '\\' and lower(title) not like lower('%' || :3) escape '\\' and lower(title) like lower('%' || :4 || '%') escape '\\' and lower(title) not like lower('%' || :5 || '%') escape '\\' order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "Re",
            "Un",
            "me",
            "xx",
            "esi",
            "zzz",
          ]
        `)
    })

    test('equivalence/if-value-maps-to-direct-if-value', async () => {
        // The `*IfValue` family maps identically on both sides: the
        // non-dynamic equivalent of the dynamic `equalsIfValue` is the
        // direct `.equalsIfValue`. With a present value both emit the
        // predicate; both short-circuit on null/undefined.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.equalsIfValue(7))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({ priority: { equalsIfValue: 7 } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where priority = :0 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            7,
          ]
        `)
    })

    test('equivalence/double-column-dispatch', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.estimatedHours.greaterThan(2.5))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({ estimatedHours: { greaterThan: 2.5 } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where estimated_hours > :0 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2.5,
          ]
        `)
    })

    test('equivalence/datetime-column-dispatch', async () => {
        const since = new Date('2020-01-01T00:00:00.000Z')
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.createdAt.greaterOrEqual(since))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({ createdAt: { greaterOrEqual: since } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where created_at >= :0 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2020-01-01T00:00:00.000Z,
          ]
        `)
    })

    test('equivalence/bigint-column-dispatch', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.viewCount.greaterThan(10n))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({ viewCount: { greaterThan: 10n } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where view_count > :0 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            10n,
          ]
        `)
    })

    test('equivalence/boolean-column-custom-adapter-dispatch', async () => {
        // `tProject.published` carries a CustomBooleanTypeAdapter ('t'/'f').
        // The dynamic 'boolean' filter must dispatch through `.equals(true)`
        // and apply the same adapter remap, so the emitted param is the
        // adapter's truthy token — proven by matching the direct call.
        const projectFields = { id: tProject.id, published: tProject.published }
        type ProjectFilter = DynamicCondition<{ id: 'int', published: 'boolean' }>
        const filter: ProjectFilter = { published: { equals: true } }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProject)
            .where(tProject.published.equals(true))
            .select({ id: tProject.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProject)
            .where(ctx.conn.dynamicConditionFor(projectFields).withValues(filter))
            .select({ id: tProject.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project where case when published = 't' then 1 else 0 end = :0 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })

    test('equivalence/uuid-as-string-operator-path', async () => {
        // For the like/insensitive operator family the builder rewrites a
        // uuid value source through `.asString()` before dispatching
        // (useAsStringInUuid). The reference spells that rewrite out.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().containsInsensitive('abc'))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({ externalRef: { containsInsensitive: 'abc' } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where lower(raw_to_uuid(external_ref)) like lower('%' || :0 || '%') escape '\\' order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "abc",
          ]
        `)
    })

    test('equivalence/and-combinator', async () => {
        // `{ and: [A, B] }` is the array conjunction — equivalent to the
        // direct `A.and(B)`.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equals('open').and(tIssue.priority.equals(3)))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({ and: [{ status: { equals: 'open' } }, { priority: { equals: 3 } }] }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where status = :0 and priority = :1 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "open",
            3,
          ]
        `)
    })

    test('equivalence/or-combinator', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equals('open').or(tIssue.priority.equals(3)))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({ or: [{ status: { equals: 'open' } }, { priority: { equals: 3 } }] }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where status = :0 or priority = :1 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "open",
            3,
          ]
        `)
    })

    test('equivalence/not-combinator', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equals('closed').negate())
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({ not: { status: { equals: 'closed' } } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where not (status = :0) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "closed",
          ]
        `)
    })

    test('equivalence/if-value-equalable-family', async () => {
        // Every equalable `*IfValue` operator paired against its direct
        // `.xxxIfValue` twin; with present values each emits its predicate.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.equalsIfValue(2)
                .and(tIssue.priority.notEqualsIfValue(3))
                .and(tIssue.priority.isIfValue(4))
                .and(tIssue.priority.isNotIfValue(5))
                .and(tIssue.priority.inIfValue([1, 2]))
                .and(tIssue.priority.notInIfValue([9])))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({
            priority: {
                equalsIfValue: 2, notEqualsIfValue: 3,
                isIfValue: 4, isNotIfValue: 5,
                inIfValue: [1, 2], notInIfValue: [9],
            },
        }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where priority = :0 and priority <> :1 and decode(priority, :2, 1, 0 ) = 1 and decode(priority, :3, 1, 0 ) = 0 and priority in (:4, :5) and priority not in (:6) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2,
            3,
            4,
            5,
            1,
            2,
            9,
          ]
        `)
    })

    test('equivalence/if-value-comparable-family', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.lessThanIfValue(9)
                .and(tIssue.priority.greaterThanIfValue(1))
                .and(tIssue.priority.lessOrEqualIfValue(8))
                .and(tIssue.priority.greaterOrEqualIfValue(2)))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({
            priority: {
                lessThanIfValue: 9, greaterThanIfValue: 1,
                lessOrEqualIfValue: 8, greaterOrEqualIfValue: 2,
            },
        }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where priority < :0 and priority > :1 and priority <= :2 and priority >= :3 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            9,
            1,
            8,
            2,
          ]
        `)
    })

    test('equivalence/if-value-string-equality-and-like-family', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.equalsInsensitiveIfValue('Foo')
                .and(tIssue.title.notEqualsInsensitiveIfValue('Bar'))
                .and(tIssue.title.likeIfValue('%a%'))
                .and(tIssue.title.notLikeIfValue('%b%'))
                .and(tIssue.title.likeInsensitiveIfValue('%C%'))
                .and(tIssue.title.notLikeInsensitiveIfValue('%D%')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({
            title: {
                equalsInsensitiveIfValue: 'Foo', notEqualsInsensitiveIfValue: 'Bar',
                likeIfValue: '%a%', notLikeIfValue: '%b%',
                likeInsensitiveIfValue: '%C%', notLikeInsensitiveIfValue: '%D%',
            },
        }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where lower(title) = lower(:0) and lower(title) <> lower(:1) and title like :2 escape '\\' and title not like :3 escape '\\' and lower(title) like lower(:4) escape '\\' and lower(title) not like lower(:5) escape '\\' order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "Foo",
            "Bar",
            "%a%",
            "%b%",
            "%C%",
            "%D%",
          ]
        `)
    })

    test('equivalence/if-value-affix-sensitive-family', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.startsWithIfValue('Re')
                .and(tIssue.title.notStartsWithIfValue('Un'))
                .and(tIssue.title.endsWithIfValue('me'))
                .and(tIssue.title.notEndsWithIfValue('xx'))
                .and(tIssue.title.containsIfValue('esi'))
                .and(tIssue.title.notContainsIfValue('zzz')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({
            title: {
                startsWithIfValue: 'Re', notStartsWithIfValue: 'Un',
                endsWithIfValue: 'me', notEndsWithIfValue: 'xx',
                containsIfValue: 'esi', notContainsIfValue: 'zzz',
            },
        }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where title like (:0 || '%') escape '\\' and title not like (:1 || '%') escape '\\' and title like ('%' || :2) escape '\\' and title not like ('%' || :3) escape '\\' and title like ('%' || :4 || '%') escape '\\' and title not like ('%' || :5 || '%') escape '\\' order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "Re",
            "Un",
            "me",
            "xx",
            "esi",
            "zzz",
          ]
        `)
    })

    test('equivalence/if-value-affix-insensitive-family', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.startsWithInsensitiveIfValue('Re')
                .and(tIssue.title.notStartsWithInsensitiveIfValue('Un'))
                .and(tIssue.title.endsWithInsensitiveIfValue('me'))
                .and(tIssue.title.notEndsWithInsensitiveIfValue('xx'))
                .and(tIssue.title.containsInsensitiveIfValue('esi'))
                .and(tIssue.title.notContainsInsensitiveIfValue('zzz')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({
            title: {
                startsWithInsensitiveIfValue: 'Re', notStartsWithInsensitiveIfValue: 'Un',
                endsWithInsensitiveIfValue: 'me', notEndsWithInsensitiveIfValue: 'xx',
                containsInsensitiveIfValue: 'esi', notContainsInsensitiveIfValue: 'zzz',
            },
        }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where lower(title) like lower(:0 || '%') escape '\\' and lower(title) not like lower(:1 || '%') escape '\\' and lower(title) like lower('%' || :2) escape '\\' and lower(title) not like lower('%' || :3) escape '\\' and lower(title) like lower('%' || :4 || '%') escape '\\' and lower(title) not like lower('%' || :5 || '%') escape '\\' order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "Re",
            "Un",
            "me",
            "xx",
            "esi",
            "zzz",
          ]
        `)
    })
})
