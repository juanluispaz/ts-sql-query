// Equivalence proof: `connection.dynamicConditionFor(...).withValues(...)`
// must emit exactly the SQL + params a hand-written direct-API predicate
// produces. Dynamic conditions exist so an external system can hand a
// JSON-shaped filter that ts-sql-query maps onto the *same* public
// value-source methods the fluent API exposes
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
//   - `equalsInsensitive` / `notEqualsInsensitive`
//   - the *insensitive* affix family (startsWith/endsWith/contains)
//   - the `*IfValue` family WITH a value (emits the same as the plain op)
//   - operator dispatch across the bigint / double / localDateTime /
//     boolean (custom adapter) column types, not just int + string
//   - the uuid `asString()` rewrite the builder applies for the
//     like/insensitive operators
//
// The result *type* of a query is unaffected by its WHERE expression, so
// these tests assert SQL + params identity only; result-type coverage for
// the `{ id }` projection lives in the operators / deep-and-or files.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import type { DynamicCondition } from '../../../../../src/dynamic/condition.js'
import { tIssue, tIssueWorklog, tProject, tProjectRelease } from '../../domain/connection.js'
import type { ReleaseChannel } from '../../domain/connection.js'
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

    test('equivalence/enum-descriptor-dispatch', async () => {
        // The `['enum', T]` descriptor maps to an EqualableFilter<T>. Only the
        // *type* mapping is pinned elsewhere (from-model); this runs an enum
        // filter through `withValues` and proves it emits exactly what the
        // direct equalable calls do. `tIssue.status` stores the enum values in
        // a plain string column, so the field map dispatches the enum filter
        // through the string value source.
        type StatusFilter = DynamicCondition<{ id: 'int', status: ['enum', 'open' | 'closed'] }>
        const filter: StatusFilter = {
            status: { equals: 'open', in: ['open', 'closed'], notEquals: 'closed' },
        }
        const statusFields = { id: tIssue.id, status: tIssue.status }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equals('open')
                .and(tIssue.status.in(['open', 'closed']))
                .and(tIssue.status.notEquals('closed')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(statusFields).withValues(filter))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where status = :0 and status in (:1, :2) and status <> :3 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "open",
            "open",
            "closed",
            "closed",
          ]
        `)
    })

    test('equivalence/custom-comparable-descriptor-dispatch', async () => {
        // the `['customComparable', T]` descriptor maps to a
        // ComparableFilter<T>. tProjectRelease.version is a branded
        // customComparable column; the dynamic filter must emit exactly the
        // direct comparable calls. The model path cannot reach custom arms
        // (it can't map adapters), so the descriptor map is the only route.
        type ReleaseFilter = DynamicCondition<{ id: 'int', version: ['customComparable', string] }>
        const filter: ReleaseFilter = { version: { greaterThan: '0.5.0', lessThan: '1.3.0', equals: '1.2.0' } }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.greaterThan('0.5.0')
                .and(tProjectRelease.version.lessThan('1.3.0'))
                .and(tProjectRelease.version.equals('1.2.0')))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, version: tProjectRelease.version }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where version > :0 and version < :1 and version = :2 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "0.5.0",
            "1.3.0",
            "1.2.0",
          ]
        `)
    })

    test('equivalence/custom-uuid-descriptor-dispatch', async () => {
        // the `['customUuid', T]` descriptor maps to CustomUuidFilter<T> —
        // a bespoke equality + like/affix interface over the branded uuid.
        // signingKey is an optional customUuid column. The like-family
        // operators route through the same `asString()` rewrite the plain
        // uuid path uses (useAsStringInUuid).
        type ReleaseFilter = DynamicCondition<{ id: 'int', signingKey: ['customUuid', string] }>
        const filter: ReleaseFilter = {
            signingKey: { equals: '0a8f9c1e-1111-4222-8333-444455556666', contains: 'abc', startsWith: '0a8f' },
        }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.equals('0a8f9c1e-1111-4222-8333-444455556666')
                .and(tProjectRelease.signingKey.asString().contains('abc'))
                .and(tProjectRelease.signingKey.asString().startsWith('0a8f')))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, signingKey: tProjectRelease.signingKey }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where signing_key = uuid_to_raw(:0) and raw_to_uuid(signing_key) like ('%' || :1 || '%') escape '\\' and raw_to_uuid(signing_key) like (:2 || '%') escape '\\' order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
            "abc",
            "0a8f",
          ]
        `)
    })

    test('equivalence/local-date-descriptor-dispatch', async () => {
        // the `'localDate'` descriptor maps to a DateFilter. workDate is a
        // plain localDate column; the comparable filter emits the same SQL +
        // params as the direct comparable calls (date-only literal encoding,
        // distinct from localDateTime). TZ=UTC forced by the suite.
        type WorklogFilter = DynamicCondition<{ id: 'int', workDate: 'localDate' }>
        const lo = new Date(Date.UTC(2024, 2, 1, 0, 0, 0))
        const hi = new Date(Date.UTC(2024, 2, 31, 0, 0, 0))
        const filter: WorklogFilter = { workDate: { greaterOrEqual: lo, lessThan: hi } }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.greaterOrEqual(lo).and(tIssueWorklog.workDate.lessThan(hi)))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, workDate: tIssueWorklog.workDate }).withValues(filter))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where work_date >= :0 and work_date < :1 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2024-03-01T00:00:00.000Z,
            2024-03-31T00:00:00.000Z,
          ]
        `)
    })

    test('equivalence/local-time-descriptor-dispatch', async () => {
        // the `'localTime'` descriptor maps to a TimeFilter. startedAt is a
        // plain localTime column; the comparable filter emits the same SQL +
        // params as the direct calls (time-only literal encoding, distinct
        // from both localDate and localDateTime).
        type WorklogFilter = DynamicCondition<{ id: 'int', startedAt: 'localTime' }>
        const lo = new Date(Date.UTC(1970, 0, 1, 9, 0, 0))
        const hi = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        const filter: WorklogFilter = { startedAt: { greaterOrEqual: lo, lessThan: hi } }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.greaterOrEqual(lo).and(tIssueWorklog.startedAt.lessThan(hi)))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, startedAt: tIssueWorklog.startedAt }).withValues(filter))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where started_at >= :0 and started_at < :1 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1970-01-01T09:00:00.000Z,
            1970-01-01T17:00:00.000Z,
          ]
        `)
    })

    test('equivalence/custom-comparable-ifvalue-dispatch', async () => {
        // The customComparable (`version`/'Semver') comparison surface via the
        // dynamic dispatcher, proven equal to the direct *IfValue calls
        // (lessOrEqual + in, both present so the IfValue twin emits the same as
        // the plain op).
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.lessOrEqualIfValue('1.3.0')
                .and(tProjectRelease.version.inIfValue(['1.2.0', '0.9.0'])))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ version: tProjectRelease.version })
                .withValues({ version: { lessOrEqual: '1.3.0', in: ['1.2.0', '0.9.0'] } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where version <= :0 and version in (:1, :2) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "1.3.0",
            "1.2.0",
            "0.9.0",
          ]
        `)
    })

    test('equivalence/custom-equality-ifvalue-dispatch', async () => {
        // The equality-only (`channel`/'ReleaseChannel') comparison surface via
        // the dynamic dispatcher, equal to the direct *IfValue calls
        // (notEquals + in).
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.notEqualsIfValue('canary')
                .and(tProjectRelease.channel.inIfValue(['stable', 'beta'])))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ channel: tProjectRelease.channel })
                .withValues({ channel: { notEquals: 'canary', in: ['stable', 'beta'] } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where channel <> :0 and channel in (:1, :2) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "canary",
            "stable",
            "beta",
          ]
        `)
    })

    test('equivalence/is-and-is-not-with-explicit-null', async () => {
        // `is` / `isNot` are special-cased in the builder's `_isValue` guard
        // so they survive an explicit `null` value where the other
        // non-`*IfValue` operators short-circuit. `{ col: { is: null } }`
        // therefore still emits a null-safe predicate, identical to the
        // direct `.is(null)` / `.isNot(null)` call.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.body.is(null).and(tIssue.estimatedHours.isNot(null)))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({ body: { is: null }, estimatedHours: { isNot: null } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where decode("body", :0, 1, 0 ) = 1 and decode(estimated_hours, :1, 1, 0 ) = 0 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            null,
            null,
          ]
        `)
    })

    test('equivalence/custom-local-date-descriptor-dispatch', async () => {
        // the `['customLocalDate', T]` descriptor maps to CustomLocalDateFilter.
        // releasedOn ('ReleaseDay') is a customLocalDate column; the comparable
        // filter must emit exactly the direct comparable calls. The model path
        // can't reach custom arms (it can't map adapters), so dynamicConditionFor
        // over the column is the route. TZ=UTC forced by the suite.
        const lo = new Date(Date.UTC(2024, 0, 1, 10, 0, 0))
        const hi = new Date(Date.UTC(2024, 11, 31, 10, 0, 0))
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.releasedOn.greaterOrEqual(lo).and(tProjectRelease.releasedOn.lessThan(hi)))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, releasedOn: tProjectRelease.releasedOn })
                .withValues({ releasedOn: { greaterOrEqual: lo, lessThan: hi } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where released_on >= :0 and released_on < :1 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2024-01-01T10:00:00.000Z,
            2024-12-31T10:00:00.000Z,
          ]
        `)
    })

    test('equivalence/custom-local-time-descriptor-dispatch', async () => {
        // the `['customLocalTime', T]` descriptor maps to CustomLocalTimeFilter.
        // cutoffTime ('CutoffClock') is a customLocalTime column.
        const lo = new Date(Date.UTC(1970, 0, 1, 9, 0, 0))
        const hi = new Date(Date.UTC(1970, 0, 1, 20, 0, 0))
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.greaterOrEqual(lo).and(tProjectRelease.cutoffTime.lessThan(hi)))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, cutoffTime: tProjectRelease.cutoffTime })
                .withValues({ cutoffTime: { greaterOrEqual: lo, lessThan: hi } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where cutoff_time >= :0 and cutoff_time < :1 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1970-01-01T09:00:00.000Z,
            1970-01-01T20:00:00.000Z,
          ]
        `)
    })

    test('equivalence/custom-local-date-time-descriptor-dispatch', async () => {
        // the `['customLocalDateTime', T]` descriptor maps to
        // CustomLocalDateTimeFilter. signedOffAt ('SignOffStamp') is an optional
        // customLocalDateTime column.
        const lo = new Date(Date.UTC(2024, 0, 1, 0, 0, 0))
        const hi = new Date(Date.UTC(2024, 11, 31, 0, 0, 0))
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.greaterOrEqual(lo).and(tProjectRelease.signedOffAt.lessThan(hi)))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, signedOffAt: tProjectRelease.signedOffAt })
                .withValues({ signedOffAt: { greaterOrEqual: lo, lessThan: hi } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where signed_off_at >= :0 and signed_off_at < :1 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2024-01-01T00:00:00.000Z,
            2024-12-31T00:00:00.000Z,
          ]
        `)
    })

    test('equivalence/custom-double-descriptor-dispatch', async () => {
        // No filterable customDouble column exists in the domain, so a customDouble
        // const value source stands in as the dynamicConditionFor field. The filter
        // carries an explicit `DynamicCondition<...>` column-type (not an inline
        // literal) so the comparable operators are checked against that column-type.
        const amount = ctx.conn.const(5, 'customDouble', 'Money')
        type AmountFilter = DynamicCondition<{ id: 'int', amount: ['customDouble', number] }>
        const filter: AmountFilter = { amount: { greaterThan: 3, lessThan: 9 } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(amount.greaterThan(3).and(amount.lessThan(9)))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, amount })
                .withValues(filter))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where :0 > :1 and :2 < :3 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            5,
            3,
            5,
            9,
          ]
        `)
    })

    test('equivalence/uuid-descriptor-dispatch', async () => {
        // uuid like/insensitive operators are emitted via the `asString()` text
        // rewrite (see the direct equivalent). The filter carries an explicit
        // `DynamicCondition<...>` column-type (not an inline literal).
        type IssueFilter = DynamicCondition<{ id: 'int', externalRef: 'uuid' }>
        const filter: IssueFilter = { externalRef: { containsInsensitive: 'abc' } }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().containsInsensitive('abc'))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, externalRef: tIssue.externalRef }).withValues(filter))
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

    test('equivalence/double-descriptor-dispatch', async () => {
        // The filter carries an explicit `DynamicCondition<...>` column-type
        // (a `'double'` column) rather than an inline literal.
        type IssueFilter = DynamicCondition<{ id: 'int', estimatedHours: 'double' }>
        const filter: IssueFilter = { estimatedHours: { greaterThan: 2.5 } }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.estimatedHours.greaterThan(2.5))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, estimatedHours: tIssue.estimatedHours }).withValues(filter))
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

    test('equivalence/custom-int-descriptor-dispatch', async () => {
        // No filterable customInt column exists in the domain, so a customInt const
        // value source stands in as the dynamicConditionFor field. The filter
        // carries an explicit `DynamicCondition<...>` column-type (not an inline
        // literal).
        const tag = ctx.conn.const(5, 'customInt', 'ReleaseTag')
        type TagFilter = DynamicCondition<{ id: 'int', tag: ['customInt', number] }>
        const filter: TagFilter = { tag: { greaterThan: 3, lessThan: 9 } }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tag.greaterThan(3).and(tag.lessThan(9)))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, tag }).withValues(filter))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where :0 > :1 and :2 < :3 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            5,
            3,
            5,
            9,
          ]
        `)
    })

    test('equivalence/custom-equality-descriptor-dispatch', async () => {
        // `channel` is an equality-only `custom` column. The filter carries an
        // explicit `DynamicCondition<...>` column-type (not an inline literal).
        type ChannelFilter = DynamicCondition<{ id: 'int', channel: ['custom', ReleaseChannel] }>
        const filter: ChannelFilter = { channel: { notEquals: 'canary', in: ['stable', 'beta'] } }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.notEquals('canary').and(tProjectRelease.channel.in(['stable', 'beta'])))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, channel: tProjectRelease.channel }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where channel <> :0 and channel in (:1, :2) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "canary",
            "stable",
            "beta",
          ]
        `)
    })

    test('equivalence/custom-local-date-descriptor-typed-dispatch', async () => {
        // `releasedOn` is a customLocalDate column. The filter carries an explicit
        // `DynamicCondition<...>` column-type (not an inline literal). TZ=UTC is
        // forced by the suite.
        const lo = new Date(Date.UTC(2024, 0, 1, 10, 0, 0))
        const hi = new Date(Date.UTC(2024, 11, 31, 10, 0, 0))
        type ReleaseFilter = DynamicCondition<{ id: 'int', releasedOn: ['customLocalDate', Date] }>
        const filter: ReleaseFilter = { releasedOn: { greaterOrEqual: lo, lessThan: hi } }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.releasedOn.greaterOrEqual(lo).and(tProjectRelease.releasedOn.lessThan(hi)))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, releasedOn: tProjectRelease.releasedOn }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where released_on >= :0 and released_on < :1 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2024-01-01T10:00:00.000Z,
            2024-12-31T10:00:00.000Z,
          ]
        `)
    })

    test('equivalence/custom-local-time-descriptor-typed-dispatch', async () => {
        // `cutoffTime` is a customLocalTime column. The filter carries an explicit
        // `DynamicCondition<...>` column-type (not an inline literal).
        const lo = new Date(Date.UTC(1970, 0, 1, 9, 0, 0))
        const hi = new Date(Date.UTC(1970, 0, 1, 20, 0, 0))
        type ReleaseFilter = DynamicCondition<{ id: 'int', cutoffTime: ['customLocalTime', Date] }>
        const filter: ReleaseFilter = { cutoffTime: { greaterOrEqual: lo, lessThan: hi } }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.greaterOrEqual(lo).and(tProjectRelease.cutoffTime.lessThan(hi)))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, cutoffTime: tProjectRelease.cutoffTime }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where cutoff_time >= :0 and cutoff_time < :1 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1970-01-01T09:00:00.000Z,
            1970-01-01T20:00:00.000Z,
          ]
        `)
    })

    test('equivalence/custom-local-date-time-descriptor-typed-dispatch', async () => {
        // `signedOffAt` is an optional customLocalDateTime column. The filter carries
        // an explicit `DynamicCondition<...>` column-type (not an inline literal).
        const lo = new Date(Date.UTC(2024, 0, 1, 0, 0, 0))
        const hi = new Date(Date.UTC(2024, 11, 31, 0, 0, 0))
        type ReleaseFilter = DynamicCondition<{ id: 'int', signedOffAt: ['customLocalDateTime', Date] }>
        const filter: ReleaseFilter = { signedOffAt: { greaterOrEqual: lo, lessThan: hi } }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.greaterOrEqual(lo).and(tProjectRelease.signedOffAt.lessThan(hi)))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, signedOffAt: tProjectRelease.signedOffAt }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where signed_off_at >= :0 and signed_off_at < :1 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2024-01-01T00:00:00.000Z,
            2024-12-31T00:00:00.000Z,
          ]
        `)
    })

    test('equivalence/uuid-equals-insensitive-rewrite', async () => {
        // `equalsInsensitive` on a uuid source is emitted via the `asString()`
        // text rewrite — `lower(signing_key::text) = lower(...)` (see the direct
        // equivalent). `signingKey` is an optional customUuid column.
        type ReleaseFilter = DynamicCondition<{ id: 'int', signingKey: ['customUuid', string] }>
        const filter: ReleaseFilter = { signingKey: { equalsInsensitive: '0A8F9C1E-1111-4222-8333-444455556666' } }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.asString().equalsInsensitive('0A8F9C1E-1111-4222-8333-444455556666'))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, signingKey: tProjectRelease.signingKey }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where lower(raw_to_uuid(signing_key)) = lower(:0) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "0A8F9C1E-1111-4222-8333-444455556666",
          ]
        `)
    })
    test('equivalence/boolean-custom-adapter-notequals-and-in-dispatch', async () => {
        // The custom-boolean adapter renders `published` as `(published = 't')`
        // for every operator, not just `=`, so `notEquals` / `in` wrap it the
        // same way.
        const projectFields = { id: tProject.id, published: tProject.published }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProject)
            .where(tProject.published.notEquals(true).and(tProject.published.in([true, false])))
            .select({ id: tProject.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProject)
            .where(ctx.conn.dynamicConditionFor(projectFields).withValues({ published: { notEquals: true, in: [true, false] } }))
            .select({ id: tProject.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project where case when published = 't' then 1 else 0 end <> :0 and case when published = 't' then 1 else 0 end in (:1, :2) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1,
            1,
            0,
          ]
        `)
    })

    test('equivalence/boolean-plain-column-is-and-is-null-dispatch', async () => {
        // `billable` is a plain boolean column (no adapter). `is` is null-safe
        // equality and `isNull` the unary null test.
        const worklogFields = { id: tIssueWorklog.id, billable: tIssueWorklog.billable }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.is(true).and(tIssueWorklog.billable.isNull()))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor(worklogFields).withValues({ billable: { is: true, isNull: true } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where decode(billable, :0, 1, 0 ) = 1 and billable is null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })

    test('equivalence/boolean-descriptor-dispatch', async () => {
        // The filter is typed via an explicit `DynamicCondition<{ billable:
        // 'boolean' }>` descriptor instead of being inferred from the column.
        type WorklogFilter = DynamicCondition<{ id: 'int', billable: 'boolean' }>
        const filter: WorklogFilter = { billable: { notEquals: true, in: [true, false] } }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.notEquals(true).and(tIssueWorklog.billable.in([true, false])))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, billable: tIssueWorklog.billable }).withValues(filter))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where billable <> :0 and billable in (:1, :2) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1,
            1,
            0,
          ]
        `)
    })


    test('equivalence/bigint-descriptor-dispatch', async () => {
        // The `'bigint'` descriptor maps to a ComparableFilter<bigint>.
        // `viewCount` is a bigint column; the descriptor-typed filter emits
        // exactly the same SQL + params as the direct comparable calls.
        type IssueFilter = DynamicCondition<{ id: 'int', viewCount: 'bigint' }>
        const filter: IssueFilter = { viewCount: { greaterThan: 10n, lessOrEqual: 99n } }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.viewCount.greaterThan(10n).and(tIssue.viewCount.lessOrEqual(99n)))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, viewCount: tIssue.viewCount }).withValues(filter))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where view_count > :0 and view_count <= :1 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            10n,
            99n,
          ]
        `)
    })

    test('equivalence/uuid-not-equals-insensitive-rewrite', async () => {
        // `notEqualsInsensitive` on a plain uuid column routes through the
        // `asString()` text rewrite, like its `equalsInsensitive` sibling —
        // `lower(external_ref::text) <> lower(...)` — so the comparison runs on
        // text the engine accepts. `FilterTypeOf<'uuid'>` is StringFilter, so
        // the operator is reachable through the typed dynamic-condition path.
        type IssueFilter = DynamicCondition<{ id: 'int', externalRef: 'uuid' }>
        const filter: IssueFilter = { externalRef: { notEqualsInsensitive: '0A8F9C1E-1111-4222-8333-444455556666' } }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().notEqualsInsensitive('0A8F9C1E-1111-4222-8333-444455556666'))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, externalRef: tIssue.externalRef }).withValues(filter))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where lower(raw_to_uuid(external_ref)) <> lower(:0) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "0A8F9C1E-1111-4222-8333-444455556666",
          ]
        `)
    })

    test('equivalence/custom-uuid-not-equals-insensitive-rewrite', async () => {
        // The customUuid filter accepts `notEqualsInsensitive` and routes it
        // through `asString()` like the `equalsInsensitive` arm —
        // `lower(signing_key::text) <> lower(...)`. `signingKey` is an optional
        // customUuid column.
        type ReleaseFilter = DynamicCondition<{ id: 'int', signingKey: ['customUuid', string] }>
        const filter: ReleaseFilter = { signingKey: { notEqualsInsensitive: '0A8F9C1E-1111-4222-8333-444455556666' } }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.asString().notEqualsInsensitive('0A8F9C1E-1111-4222-8333-444455556666'))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, signingKey: tProjectRelease.signingKey }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where lower(raw_to_uuid(signing_key)) <> lower(:0) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "0A8F9C1E-1111-4222-8333-444455556666",
          ]
        `)
    })

    test('equivalence/custom-int-column-inline-filter', async () => {
        // The inline `MapValueSourceToFilter` arm for a customInt column: a real
        // filterable customInt column (`cost_cents`, 'Cents') fed through
        // `dynamicConditionFor(...).withValues({...})` with an INLINE literal —
        // no `DynamicCondition<...>` annotation — so the filter type is inferred
        // from the value source (ICustomIntValueSource extends
        // IComparableValueSource, so the comparable operators are available).
        // The sibling `custom-int-descriptor-dispatch` test covers the annotated
        // FilterTypeOf path; this reaches the un-annotated inline mapping.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.greaterThan(50).and(tIssueWorklog.costCents.lessThan(300)))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, costCents: tIssueWorklog.costCents })
                .withValues({ costCents: { greaterThan: 50, lessThan: 300 } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where cost_cents > :0 and cost_cents < :1 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            50,
            300,
          ]
        `)
    })

    test('equivalence/custom-double-column-inline-filter', async () => {
        // The inline `MapValueSourceToFilter` arm for a customDouble column: the
        // real filterable customDouble column (`billed_amount`, 'Money') fed
        // through an INLINE `withValues({...})` literal with no
        // `DynamicCondition<...>` annotation. Sibling of the customInt inline
        // test above; the `custom-double-descriptor-dispatch` test covers the
        // annotated FilterTypeOf path.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billedAmount.greaterThan(100).and(tIssueWorklog.billedAmount.lessThan(500)))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, billedAmount: tIssueWorklog.billedAmount })
                .withValues({ billedAmount: { greaterThan: 100, lessThan: 500 } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where billed_amount > :0 and billed_amount < :1 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            100,
            500,
          ]
        `)
    })


    test('equivalence/local-date-value-source-map-dispatch', async () => {
        // The filter is passed inline (un-annotated) to `withValues`, so the
        // value-source-map inference arm validates the localDate mapping rather
        // than an explicit `DynamicCondition<{...}>` descriptor annotation; the
        // dynamic predicate must still emit the same SQL + params as the direct
        // calls.
        const lo = new Date(Date.UTC(2024, 2, 1, 0, 0, 0))
        const hi = new Date(Date.UTC(2024, 2, 31, 0, 0, 0))
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.greaterOrEqual(lo).and(tIssueWorklog.workDate.lessThan(hi)))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, workDate: tIssueWorklog.workDate })
                .withValues({ workDate: { greaterOrEqual: lo, lessThan: hi } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where work_date >= :0 and work_date < :1 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2024-03-01T00:00:00.000Z,
            2024-03-31T00:00:00.000Z,
          ]
        `)
    })

    test('equivalence/local-time-value-source-map-dispatch', async () => {
        // The filter is passed inline (un-annotated) to `withValues`, so the
        // value-source-map inference arm validates the localTime mapping rather
        // than an explicit `DynamicCondition<{...}>` descriptor annotation.
        const lo = new Date(Date.UTC(1970, 0, 1, 9, 0, 0))
        const hi = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.greaterOrEqual(lo).and(tIssueWorklog.startedAt.lessThan(hi)))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, startedAt: tIssueWorklog.startedAt })
                .withValues({ startedAt: { greaterOrEqual: lo, lessThan: hi } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where started_at >= :0 and started_at < :1 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1970-01-01T09:00:00.000Z,
            1970-01-01T17:00:00.000Z,
          ]
        `)
    })

    test('equivalence/custom-uuid-value-source-map-dispatch', async () => {
        // The filter is passed inline (un-annotated) to `withValues`, so the
        // value-source-map inference arm validates the branded `customUuid`
        // (`signingKey`) mapping; the like/affix operators still route through
        // the `asString()` rewrite.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.equals('0a8f9c1e-1111-4222-8333-444455556666')
                .and(tProjectRelease.signingKey.asString().contains('abc'))
                .and(tProjectRelease.signingKey.asString().startsWith('0a8f')))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, signingKey: tProjectRelease.signingKey })
                .withValues({ signingKey: { equals: '0a8f9c1e-1111-4222-8333-444455556666', contains: 'abc', startsWith: '0a8f' } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where signing_key = uuid_to_raw(:0) and raw_to_uuid(signing_key) like ('%' || :1 || '%') escape '\\' and raw_to_uuid(signing_key) like (:2 || '%') escape '\\' order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
            "abc",
            "0a8f",
          ]
        `)
    })

    test('equivalence/plain-local-date-time-descriptor-dispatch', async () => {
        // The filter is typed via an explicit
        // `DynamicCondition<{ createdAt: 'localDateTime' }>` annotation, so the
        // descriptor inference arm validates the localDateTime mapping rather
        // than the inline value-source-map.
        type IssueFilter = DynamicCondition<{ id: 'int', createdAt: 'localDateTime' }>
        const since = new Date('2020-01-01T00:00:00.000Z')
        const filter: IssueFilter = { createdAt: { greaterOrEqual: since } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.createdAt.greaterOrEqual(since))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, createdAt: tIssue.createdAt }).withValues(filter))
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
    // ---- DYN numeric/boolean/enum per-op fan-out (round-44 T4)
    // Per-operator × type × path fan-out for the numeric / boolean / enum
    // dynamic-condition filter surface. Each op is proven to reach the same
    // builder method its direct-API twin does (identical SQL + params), and is
    // covered on BOTH dispatch paths: the `FilterTypeOf<descriptor>` path (the
    // filter is annotated `DynamicCondition<{ col: '<descriptor>' }>`) and the
    // inline `MapValueSourceToFilter` path (the filter object is passed to
    // `withValues({...})` un-annotated, inferred from the value source). Both
    // paths emit identical SQL at runtime; the annotation only changes which
    // type alias validates the filter shape.

    // -- B1 bigint (tIssueWorklog.durationMs, a nullable bigint) --------------
    test('dyn/bigint-descriptor-equalable-ops', async () => {
        type Filter = DynamicCondition<{ id: 'int', durationMs: 'bigint' }>
        const filter: Filter = { durationMs: { equals: 10n, notEquals: 20n, is: 30n, isNot: 40n, in: [1n, 2n], notIn: [9n] } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.equals(10n)
                .and(tIssueWorklog.durationMs.notEquals(20n))
                .and(tIssueWorklog.durationMs.is(30n))
                .and(tIssueWorklog.durationMs.isNot(40n))
                .and(tIssueWorklog.durationMs.in([1n, 2n]))
                .and(tIssueWorklog.durationMs.notIn([9n])))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, durationMs: tIssueWorklog.durationMs }).withValues(filter))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where duration_ms = :0 and duration_ms <> :1 and decode(duration_ms, :2, 1, 0 ) = 1 and decode(duration_ms, :3, 1, 0 ) = 0 and duration_ms in (:4, :5) and duration_ms not in (:6) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            10n,
            20n,
            30n,
            40n,
            1n,
            2n,
            9n,
          ]
        `)
    })

    test('dyn/bigint-inline-equalable-ops', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.equals(10n)
                .and(tIssueWorklog.durationMs.notEquals(20n))
                .and(tIssueWorklog.durationMs.is(30n))
                .and(tIssueWorklog.durationMs.isNot(40n))
                .and(tIssueWorklog.durationMs.in([1n, 2n]))
                .and(tIssueWorklog.durationMs.notIn([9n])))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, durationMs: tIssueWorklog.durationMs })
                .withValues({ durationMs: { equals: 10n, notEquals: 20n, is: 30n, isNot: 40n, in: [1n, 2n], notIn: [9n] } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where duration_ms = :0 and duration_ms <> :1 and decode(duration_ms, :2, 1, 0 ) = 1 and decode(duration_ms, :3, 1, 0 ) = 0 and duration_ms in (:4, :5) and duration_ms not in (:6) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            10n,
            20n,
            30n,
            40n,
            1n,
            2n,
            9n,
          ]
        `)
    })

    test('dyn/bigint-descriptor-comparable-nullable-ops', async () => {
        type Filter = DynamicCondition<{ id: 'int', durationMs: 'bigint' }>
        const filter: Filter = { durationMs: { lessThan: 100n, greaterOrEqual: 5n, isNull: true, isNotNull: true } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.lessThan(100n)
                .and(tIssueWorklog.durationMs.greaterOrEqual(5n))
                .and(tIssueWorklog.durationMs.isNull())
                .and(tIssueWorklog.durationMs.isNotNull()))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, durationMs: tIssueWorklog.durationMs }).withValues(filter))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where duration_ms < :0 and duration_ms >= :1 and duration_ms is null and duration_ms is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            100n,
            5n,
          ]
        `)
    })

    test('dyn/bigint-inline-comparable-nullable-ops', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.lessThan(100n)
                .and(tIssueWorklog.durationMs.greaterOrEqual(5n))
                .and(tIssueWorklog.durationMs.isNull())
                .and(tIssueWorklog.durationMs.isNotNull()))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, durationMs: tIssueWorklog.durationMs })
                .withValues({ durationMs: { lessThan: 100n, greaterOrEqual: 5n, isNull: true, isNotNull: true } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where duration_ms < :0 and duration_ms >= :1 and duration_ms is null and duration_ms is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            100n,
            5n,
          ]
        `)
    })

    test('dyn/bigint-descriptor-ifvalue-fire', async () => {
        type Filter = DynamicCondition<{ id: 'int', durationMs: 'bigint' }>
        const filter: Filter = { durationMs: {
            equalsIfValue: 10n, notEqualsIfValue: 20n, isIfValue: 30n, isNotIfValue: 40n,
            inIfValue: [1n, 2n], notInIfValue: [9n], lessThanIfValue: 100n, greaterOrEqualIfValue: 5n,
        } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.equalsIfValue(10n)
                .and(tIssueWorklog.durationMs.notEqualsIfValue(20n))
                .and(tIssueWorklog.durationMs.isIfValue(30n))
                .and(tIssueWorklog.durationMs.isNotIfValue(40n))
                .and(tIssueWorklog.durationMs.inIfValue([1n, 2n]))
                .and(tIssueWorklog.durationMs.notInIfValue([9n]))
                .and(tIssueWorklog.durationMs.lessThanIfValue(100n))
                .and(tIssueWorklog.durationMs.greaterOrEqualIfValue(5n)))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, durationMs: tIssueWorklog.durationMs }).withValues(filter))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where duration_ms = :0 and duration_ms <> :1 and decode(duration_ms, :2, 1, 0 ) = 1 and decode(duration_ms, :3, 1, 0 ) = 0 and duration_ms in (:4, :5) and duration_ms not in (:6) and duration_ms < :7 and duration_ms >= :8 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            10n,
            20n,
            30n,
            40n,
            1n,
            2n,
            9n,
            100n,
            5n,
          ]
        `)
    })

    test('dyn/bigint-inline-ifvalue-fire', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.equalsIfValue(10n)
                .and(tIssueWorklog.durationMs.notEqualsIfValue(20n))
                .and(tIssueWorklog.durationMs.isIfValue(30n))
                .and(tIssueWorklog.durationMs.isNotIfValue(40n))
                .and(tIssueWorklog.durationMs.inIfValue([1n, 2n]))
                .and(tIssueWorklog.durationMs.notInIfValue([9n]))
                .and(tIssueWorklog.durationMs.lessThanIfValue(100n))
                .and(tIssueWorklog.durationMs.greaterOrEqualIfValue(5n)))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, durationMs: tIssueWorklog.durationMs })
                .withValues({ durationMs: {
                    equalsIfValue: 10n, notEqualsIfValue: 20n, isIfValue: 30n, isNotIfValue: 40n,
                    inIfValue: [1n, 2n], notInIfValue: [9n], lessThanIfValue: 100n, greaterOrEqualIfValue: 5n,
                } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where duration_ms = :0 and duration_ms <> :1 and decode(duration_ms, :2, 1, 0 ) = 1 and decode(duration_ms, :3, 1, 0 ) = 0 and duration_ms in (:4, :5) and duration_ms not in (:6) and duration_ms < :7 and duration_ms >= :8 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            10n,
            20n,
            30n,
            40n,
            1n,
            2n,
            9n,
            100n,
            5n,
          ]
        `)
    })

    test('dyn/bigint-ifvalue-elide', async () => {
        // Every `*IfValue` twin fed a null/undefined value short-circuits, so
        // the whole WHERE collapses to empty (the elide half of the fire test
        // above). Path-agnostic — the skip happens in the value-source method.
        const maybeN: bigint | undefined = undefined
        const maybeNull: bigint | null = null
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, durationMs: tIssueWorklog.durationMs })
                .withValues({ durationMs: {
                    equalsIfValue: maybeN, notEqualsIfValue: maybeNull, isIfValue: maybeN, isNotIfValue: maybeNull,
                    inIfValue: undefined, notInIfValue: undefined, lessThanIfValue: maybeN, greaterOrEqualIfValue: maybeNull,
                } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    // -- B2 double (tIssue.estimatedHours, a nullable double) -----------------
    test('dyn/double-descriptor-equalable-ops', async () => {
        type Filter = DynamicCondition<{ id: 'int', estimatedHours: 'double' }>
        const filter: Filter = { estimatedHours: { equals: 2.5, notEquals: 3.5, is: 4.5, in: [1.5, 2.5], notIn: [9.5] } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.estimatedHours.equals(2.5)
                .and(tIssue.estimatedHours.notEquals(3.5))
                .and(tIssue.estimatedHours.is(4.5))
                .and(tIssue.estimatedHours.in([1.5, 2.5]))
                .and(tIssue.estimatedHours.notIn([9.5])))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, estimatedHours: tIssue.estimatedHours }).withValues(filter))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where estimated_hours = :0 and estimated_hours <> :1 and decode(estimated_hours, :2, 1, 0 ) = 1 and estimated_hours in (:3, :4) and estimated_hours not in (:5) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2.5,
            3.5,
            4.5,
            1.5,
            2.5,
            9.5,
          ]
        `)
    })

    test('dyn/double-inline-equalable-ops', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.estimatedHours.equals(2.5)
                .and(tIssue.estimatedHours.notEquals(3.5))
                .and(tIssue.estimatedHours.is(4.5))
                .and(tIssue.estimatedHours.in([1.5, 2.5]))
                .and(tIssue.estimatedHours.notIn([9.5])))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, estimatedHours: tIssue.estimatedHours })
                .withValues({ estimatedHours: { equals: 2.5, notEquals: 3.5, is: 4.5, in: [1.5, 2.5], notIn: [9.5] } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where estimated_hours = :0 and estimated_hours <> :1 and decode(estimated_hours, :2, 1, 0 ) = 1 and estimated_hours in (:3, :4) and estimated_hours not in (:5) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2.5,
            3.5,
            4.5,
            1.5,
            2.5,
            9.5,
          ]
        `)
    })

    test('dyn/double-descriptor-comparable-nullable-ops', async () => {
        type Filter = DynamicCondition<{ id: 'int', estimatedHours: 'double' }>
        const filter: Filter = { estimatedHours: { lessThan: 9.5, lessOrEqual: 8.5, greaterOrEqual: 1.5, isNull: true, isNotNull: true } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.estimatedHours.lessThan(9.5)
                .and(tIssue.estimatedHours.lessOrEqual(8.5))
                .and(tIssue.estimatedHours.greaterOrEqual(1.5))
                .and(tIssue.estimatedHours.isNull())
                .and(tIssue.estimatedHours.isNotNull()))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, estimatedHours: tIssue.estimatedHours }).withValues(filter))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where estimated_hours < :0 and estimated_hours <= :1 and estimated_hours >= :2 and estimated_hours is null and estimated_hours is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            9.5,
            8.5,
            1.5,
          ]
        `)
    })

    test('dyn/double-inline-comparable-nullable-ops', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.estimatedHours.lessThan(9.5)
                .and(tIssue.estimatedHours.lessOrEqual(8.5))
                .and(tIssue.estimatedHours.greaterOrEqual(1.5))
                .and(tIssue.estimatedHours.isNull())
                .and(tIssue.estimatedHours.isNotNull()))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, estimatedHours: tIssue.estimatedHours })
                .withValues({ estimatedHours: { lessThan: 9.5, lessOrEqual: 8.5, greaterOrEqual: 1.5, isNull: true, isNotNull: true } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where estimated_hours < :0 and estimated_hours <= :1 and estimated_hours >= :2 and estimated_hours is null and estimated_hours is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            9.5,
            8.5,
            1.5,
          ]
        `)
    })

    test('dyn/double-descriptor-ifvalue-fire', async () => {
        type Filter = DynamicCondition<{ id: 'int', estimatedHours: 'double' }>
        const filter: Filter = { estimatedHours: {
            equalsIfValue: 2.5, notEqualsIfValue: 3.5, isIfValue: 4.5, inIfValue: [1.5, 2.5],
            notInIfValue: [9.5], lessThanIfValue: 9.5, lessOrEqualIfValue: 8.5, greaterOrEqualIfValue: 1.5,
        } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.estimatedHours.equalsIfValue(2.5)
                .and(tIssue.estimatedHours.notEqualsIfValue(3.5))
                .and(tIssue.estimatedHours.isIfValue(4.5))
                .and(tIssue.estimatedHours.inIfValue([1.5, 2.5]))
                .and(tIssue.estimatedHours.notInIfValue([9.5]))
                .and(tIssue.estimatedHours.lessThanIfValue(9.5))
                .and(tIssue.estimatedHours.lessOrEqualIfValue(8.5))
                .and(tIssue.estimatedHours.greaterOrEqualIfValue(1.5)))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, estimatedHours: tIssue.estimatedHours }).withValues(filter))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where estimated_hours = :0 and estimated_hours <> :1 and decode(estimated_hours, :2, 1, 0 ) = 1 and estimated_hours in (:3, :4) and estimated_hours not in (:5) and estimated_hours < :6 and estimated_hours <= :7 and estimated_hours >= :8 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2.5,
            3.5,
            4.5,
            1.5,
            2.5,
            9.5,
            9.5,
            8.5,
            1.5,
          ]
        `)
    })

    test('dyn/double-inline-ifvalue-fire', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.estimatedHours.equalsIfValue(2.5)
                .and(tIssue.estimatedHours.notEqualsIfValue(3.5))
                .and(tIssue.estimatedHours.isIfValue(4.5))
                .and(tIssue.estimatedHours.inIfValue([1.5, 2.5]))
                .and(tIssue.estimatedHours.notInIfValue([9.5]))
                .and(tIssue.estimatedHours.lessThanIfValue(9.5))
                .and(tIssue.estimatedHours.lessOrEqualIfValue(8.5))
                .and(tIssue.estimatedHours.greaterOrEqualIfValue(1.5)))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, estimatedHours: tIssue.estimatedHours })
                .withValues({ estimatedHours: {
                    equalsIfValue: 2.5, notEqualsIfValue: 3.5, isIfValue: 4.5, inIfValue: [1.5, 2.5],
                    notInIfValue: [9.5], lessThanIfValue: 9.5, lessOrEqualIfValue: 8.5, greaterOrEqualIfValue: 1.5,
                } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where estimated_hours = :0 and estimated_hours <> :1 and decode(estimated_hours, :2, 1, 0 ) = 1 and estimated_hours in (:3, :4) and estimated_hours not in (:5) and estimated_hours < :6 and estimated_hours <= :7 and estimated_hours >= :8 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2.5,
            3.5,
            4.5,
            1.5,
            2.5,
            9.5,
            9.5,
            8.5,
            1.5,
          ]
        `)
    })

    test('dyn/double-ifvalue-elide', async () => {
        const maybeN: number | undefined = undefined
        const maybeNull: number | null = null
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, estimatedHours: tIssue.estimatedHours })
                .withValues({ estimatedHours: {
                    equalsIfValue: maybeN, notEqualsIfValue: maybeNull, isIfValue: maybeN, inIfValue: undefined,
                    notInIfValue: undefined, lessThanIfValue: maybeN, lessOrEqualIfValue: maybeNull, greaterOrEqualIfValue: maybeN,
                } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    // -- B16 boolean (tIssueWorklog.billable, a nullable plain boolean) -------
    test('dyn/boolean-descriptor-isnot-notin-isnotnull', async () => {
        type Filter = DynamicCondition<{ id: 'int', billable: 'boolean' }>
        const filter: Filter = { billable: { isNot: true, notIn: [true, false], isNotNull: true } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.isNot(true)
                .and(tIssueWorklog.billable.notIn([true, false]))
                .and(tIssueWorklog.billable.isNotNull()))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, billable: tIssueWorklog.billable }).withValues(filter))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where decode(billable, :0, 1, 0 ) = 0 and billable not in (:1, :2) and billable is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1,
            1,
            0,
          ]
        `)
    })

    test('dyn/boolean-inline-isnot-notin-isnotnull', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.isNot(true)
                .and(tIssueWorklog.billable.notIn([true, false]))
                .and(tIssueWorklog.billable.isNotNull()))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, billable: tIssueWorklog.billable })
                .withValues({ billable: { isNot: true, notIn: [true, false], isNotNull: true } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where decode(billable, :0, 1, 0 ) = 0 and billable not in (:1, :2) and billable is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1,
            1,
            0,
          ]
        `)
    })

    test('dyn/boolean-descriptor-ifvalue-fire', async () => {
        type Filter = DynamicCondition<{ id: 'int', billable: 'boolean' }>
        const filter: Filter = { billable: {
            equalsIfValue: true, notEqualsIfValue: false, isIfValue: true,
            isNotIfValue: false, inIfValue: [true, false], notInIfValue: [false],
        } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.equalsIfValue(true)
                .and(tIssueWorklog.billable.notEqualsIfValue(false))
                .and(tIssueWorklog.billable.isIfValue(true))
                .and(tIssueWorklog.billable.isNotIfValue(false))
                .and(tIssueWorklog.billable.inIfValue([true, false]))
                .and(tIssueWorklog.billable.notInIfValue([false])))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, billable: tIssueWorklog.billable }).withValues(filter))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where billable = :0 and billable <> :1 and decode(billable, :2, 1, 0 ) = 1 and decode(billable, :3, 1, 0 ) = 0 and billable in (:4, :5) and billable not in (:6) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1,
            0,
            1,
            0,
            1,
            0,
            0,
          ]
        `)
    })

    test('dyn/boolean-inline-ifvalue-fire', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.equalsIfValue(true)
                .and(tIssueWorklog.billable.notEqualsIfValue(false))
                .and(tIssueWorklog.billable.isIfValue(true))
                .and(tIssueWorklog.billable.isNotIfValue(false))
                .and(tIssueWorklog.billable.inIfValue([true, false]))
                .and(tIssueWorklog.billable.notInIfValue([false])))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, billable: tIssueWorklog.billable })
                .withValues({ billable: {
                    equalsIfValue: true, notEqualsIfValue: false, isIfValue: true,
                    isNotIfValue: false, inIfValue: [true, false], notInIfValue: [false],
                } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where billable = :0 and billable <> :1 and decode(billable, :2, 1, 0 ) = 1 and decode(billable, :3, 1, 0 ) = 0 and billable in (:4, :5) and billable not in (:6) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1,
            0,
            1,
            0,
            1,
            0,
            0,
          ]
        `)
    })

    test('dyn/boolean-ifvalue-elide', async () => {
        const maybeB: boolean | undefined = undefined
        const maybeNull: boolean | null = null
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, billable: tIssueWorklog.billable })
                .withValues({ billable: {
                    equalsIfValue: maybeB, notEqualsIfValue: maybeNull, isIfValue: maybeB,
                    isNotIfValue: maybeNull, inIfValue: undefined, notInIfValue: undefined,
                } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    // -- B17 enum (tIssueWorklog.activity, a required WorklogActivity enum) ---
    test('dyn/enum-descriptor-is-isnot-notin-nullable', async () => {
        type Filter = DynamicCondition<{ id: 'int', activity: ['enum', 'coding' | 'review' | 'meeting'] }>
        const filter: Filter = { activity: { is: 'coding', isNot: 'review', notIn: ['meeting'], isNull: true, isNotNull: true } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.is('coding')
                .and(tIssueWorklog.activity.isNot('review'))
                .and(tIssueWorklog.activity.notIn(['meeting']))
                .and(tIssueWorklog.activity.isNull())
                .and(tIssueWorklog.activity.isNotNull()))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, activity: tIssueWorklog.activity }).withValues(filter))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where decode(activity, :0, 1, 0 ) = 1 and decode(activity, :1, 1, 0 ) = 0 and activity not in (:2) and activity is null and activity is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "coding",
            "review",
            "meeting",
          ]
        `)
    })

    test('dyn/enum-inline-is-isnot-notin-nullable', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.is('coding')
                .and(tIssueWorklog.activity.isNot('review'))
                .and(tIssueWorklog.activity.notIn(['meeting']))
                .and(tIssueWorklog.activity.isNull())
                .and(tIssueWorklog.activity.isNotNull()))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, activity: tIssueWorklog.activity })
                .withValues({ activity: { is: 'coding', isNot: 'review', notIn: ['meeting'], isNull: true, isNotNull: true } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where decode(activity, :0, 1, 0 ) = 1 and decode(activity, :1, 1, 0 ) = 0 and activity not in (:2) and activity is null and activity is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "coding",
            "review",
            "meeting",
          ]
        `)
    })

    test('dyn/enum-descriptor-ifvalue-fire', async () => {
        type Filter = DynamicCondition<{ id: 'int', activity: ['enum', 'coding' | 'review' | 'meeting'] }>
        const filter: Filter = { activity: {
            equalsIfValue: 'coding', notEqualsIfValue: 'review', isIfValue: 'meeting',
            isNotIfValue: 'coding', inIfValue: ['coding', 'review'], notInIfValue: ['meeting'],
        } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.equalsIfValue('coding')
                .and(tIssueWorklog.activity.notEqualsIfValue('review'))
                .and(tIssueWorklog.activity.isIfValue('meeting'))
                .and(tIssueWorklog.activity.isNotIfValue('coding'))
                .and(tIssueWorklog.activity.inIfValue(['coding', 'review']))
                .and(tIssueWorklog.activity.notInIfValue(['meeting'])))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, activity: tIssueWorklog.activity }).withValues(filter))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where activity = :0 and activity <> :1 and decode(activity, :2, 1, 0 ) = 1 and decode(activity, :3, 1, 0 ) = 0 and activity in (:4, :5) and activity not in (:6) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "coding",
            "review",
            "meeting",
            "coding",
            "coding",
            "review",
            "meeting",
          ]
        `)
    })

    test('dyn/enum-inline-ifvalue-fire', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.equalsIfValue('coding')
                .and(tIssueWorklog.activity.notEqualsIfValue('review'))
                .and(tIssueWorklog.activity.isIfValue('meeting'))
                .and(tIssueWorklog.activity.isNotIfValue('coding'))
                .and(tIssueWorklog.activity.inIfValue(['coding', 'review']))
                .and(tIssueWorklog.activity.notInIfValue(['meeting'])))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, activity: tIssueWorklog.activity })
                .withValues({ activity: {
                    equalsIfValue: 'coding', notEqualsIfValue: 'review', isIfValue: 'meeting',
                    isNotIfValue: 'coding', inIfValue: ['coding', 'review'], notInIfValue: ['meeting'],
                } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where activity = :0 and activity <> :1 and decode(activity, :2, 1, 0 ) = 1 and decode(activity, :3, 1, 0 ) = 0 and activity in (:4, :5) and activity not in (:6) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "coding",
            "review",
            "meeting",
            "coding",
            "coding",
            "review",
            "meeting",
          ]
        `)
    })

    test('dyn/enum-ifvalue-elide', async () => {
        const maybeA: ('coding' | 'review' | 'meeting') | undefined = undefined
        const maybeNull: ('coding' | 'review' | 'meeting') | null = null
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, activity: tIssueWorklog.activity })
                .withValues({ activity: {
                    equalsIfValue: maybeA, notEqualsIfValue: maybeNull, isIfValue: maybeA,
                    isNotIfValue: maybeNull, inIfValue: undefined, notInIfValue: undefined,
                } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    // -- B18 int residue (tIssue.priority, a required int) --------------------
    test('dyn/int-descriptor-nullable-ops', async () => {
        type Filter = DynamicCondition<{ id: 'int', priority: 'int' }>
        const filter: Filter = { priority: { isNull: true, isNotNull: true } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.isNull().and(tIssue.priority.isNotNull()))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, priority: tIssue.priority }).withValues(filter))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where priority is null and priority is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`[]`)
    })

    test('dyn/int-inline-nullable-ops', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.isNull().and(tIssue.priority.isNotNull()))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, priority: tIssue.priority })
                .withValues({ priority: { isNull: true, isNotNull: true } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where priority is null and priority is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`[]`)
    })

    test('dyn/int-notin-empty-array', async () => {
        // `notIn: []` — an empty array fails `_isValue`, so the operator is
        // skipped entirely (the whole WHERE collapses to empty), mirroring the
        // documented `in: []` collapse. Dynamic-only: the direct `.notIn([])`
        // path is not gated by `_isValue`, so only the dynamic dispatcher
        // exhibits the skip.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, priority: tIssue.priority })
                .withValues({ priority: { notIn: [] } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })
    // ---- DYN string/uuid/temporal/custom per-op fan-out (round-44 T4)
    // Per-operator × type × path fan-out for the string / uuid / temporal /
    // custom dynamic-condition filter surface (sibling of the numeric/boolean/
    // enum block above). Each op is proven to reach the same builder method its
    // direct-API twin does (identical SQL + params), on BOTH dispatch paths: the
    // `FilterTypeOf<descriptor>` path (annotated `DynamicCondition<{...}>`) and
    // the inline `MapValueSourceToFilter` path (`withValues({...})` un-annotated).
    // The uuid / customUuid like/affix/insensitive family routes through the
    // `asString()` rewrite (useAsStringInUuid) on the direct side, exactly as the
    // dynamic dispatcher does.

    // -- B3 string raw-comparable (tIssue.title) ------------------------------
    test('dyn/string-descriptor-comparable-notin', async () => {
        type Filter = DynamicCondition<{ id: 'int', title: 'string' }>
        const filter: Filter = { title: { lessThan: 'm', greaterThan: 'a', lessOrEqual: 'z', greaterOrEqual: 'b', notIn: ['zzz', 'yyy'] } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.lessThan('m')
                .and(tIssue.title.greaterThan('a'))
                .and(tIssue.title.lessOrEqual('z'))
                .and(tIssue.title.greaterOrEqual('b'))
                .and(tIssue.title.notIn(['zzz', 'yyy'])))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, title: tIssue.title }).withValues(filter))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where title < :0 and title > :1 and title <= :2 and title >= :3 and title not in (:4, :5) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "m",
            "a",
            "z",
            "b",
            "zzz",
            "yyy",
          ]
        `)
    })

    test('dyn/string-inline-comparable-notin', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.lessThan('m')
                .and(tIssue.title.greaterThan('a'))
                .and(tIssue.title.lessOrEqual('z'))
                .and(tIssue.title.greaterOrEqual('b'))
                .and(tIssue.title.notIn(['zzz', 'yyy'])))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, title: tIssue.title })
                .withValues({ title: { lessThan: 'm', greaterThan: 'a', lessOrEqual: 'z', greaterOrEqual: 'b', notIn: ['zzz', 'yyy'] } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where title < :0 and title > :1 and title <= :2 and title >= :3 and title not in (:4, :5) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "m",
            "a",
            "z",
            "b",
            "zzz",
            "yyy",
          ]
        `)
    })

    test('dyn/string-descriptor-ifvalue-fire', async () => {
        type Filter = DynamicCondition<{ id: 'int', title: 'string' }>
        const filter: Filter = { title: {
            equalsIfValue: 'a', notEqualsIfValue: 'b', lessThanIfValue: 'm', greaterThanIfValue: 'a',
            lessOrEqualIfValue: 'z', greaterOrEqualIfValue: 'b',
        } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.equalsIfValue('a')
                .and(tIssue.title.notEqualsIfValue('b'))
                .and(tIssue.title.lessThanIfValue('m'))
                .and(tIssue.title.greaterThanIfValue('a'))
                .and(tIssue.title.lessOrEqualIfValue('z'))
                .and(tIssue.title.greaterOrEqualIfValue('b')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, title: tIssue.title }).withValues(filter))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where title = :0 and title <> :1 and title < :2 and title > :3 and title <= :4 and title >= :5 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "a",
            "b",
            "m",
            "a",
            "z",
            "b",
          ]
        `)
    })

    test('dyn/string-inline-ifvalue-fire', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.equalsIfValue('a')
                .and(tIssue.title.notEqualsIfValue('b'))
                .and(tIssue.title.lessThanIfValue('m'))
                .and(tIssue.title.greaterThanIfValue('a'))
                .and(tIssue.title.lessOrEqualIfValue('z'))
                .and(tIssue.title.greaterOrEqualIfValue('b')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, title: tIssue.title })
                .withValues({ title: {
                    equalsIfValue: 'a', notEqualsIfValue: 'b', lessThanIfValue: 'm', greaterThanIfValue: 'a',
                    lessOrEqualIfValue: 'z', greaterOrEqualIfValue: 'b',
                } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where title = :0 and title <> :1 and title < :2 and title > :3 and title <= :4 and title >= :5 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "a",
            "b",
            "m",
            "a",
            "z",
            "b",
          ]
        `)
    })

    test('dyn/string-ifvalue-elide', async () => {
        const maybeS: string | undefined = undefined
        const maybeNull: string | null = null
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, title: tIssue.title })
                .withValues({ title: {
                    equalsIfValue: maybeS, notEqualsIfValue: maybeNull, lessThanIfValue: maybeS,
                    greaterThanIfValue: maybeNull, lessOrEqualIfValue: maybeS, greaterOrEqualIfValue: maybeNull,
                } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    // -- B6 localDate (tIssueWorklog.workDate) --------------------------------
    test('dyn/localdate-descriptor-ops', async () => {
        type Filter = DynamicCondition<{ id: 'int', workDate: 'localDate' }>
        const d1 = new Date(Date.UTC(2024, 0, 1)), d2 = new Date(Date.UTC(2024, 3, 1)), d3 = new Date(Date.UTC(2024, 6, 1))
        const filter: Filter = { workDate: { equals: d1, notEquals: d2, is: d3, isNot: d1, in: [d1, d2], notIn: [d3], lessOrEqual: d2, greaterThan: d1, isNull: true, isNotNull: true } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.equals(d1)
                .and(tIssueWorklog.workDate.notEquals(d2))
                .and(tIssueWorklog.workDate.is(d3))
                .and(tIssueWorklog.workDate.isNot(d1))
                .and(tIssueWorklog.workDate.in([d1, d2]))
                .and(tIssueWorklog.workDate.notIn([d3]))
                .and(tIssueWorklog.workDate.lessOrEqual(d2))
                .and(tIssueWorklog.workDate.greaterThan(d1))
                .and(tIssueWorklog.workDate.isNull())
                .and(tIssueWorklog.workDate.isNotNull()))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, workDate: tIssueWorklog.workDate }).withValues(filter))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where work_date = :0 and work_date <> :1 and decode(work_date, :2, 1, 0 ) = 1 and decode(work_date, :3, 1, 0 ) = 0 and work_date in (:4, :5) and work_date not in (:6) and work_date <= :7 and work_date > :8 and work_date is null and work_date is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2024-01-01T00:00:00.000Z,
            2024-04-01T00:00:00.000Z,
            2024-07-01T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
            2024-04-01T00:00:00.000Z,
            2024-07-01T00:00:00.000Z,
            2024-04-01T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
          ]
        `)
    })

    test('dyn/localdate-inline-ops', async () => {
        const d1 = new Date(Date.UTC(2024, 0, 1)), d2 = new Date(Date.UTC(2024, 3, 1)), d3 = new Date(Date.UTC(2024, 6, 1))
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.equals(d1)
                .and(tIssueWorklog.workDate.notEquals(d2))
                .and(tIssueWorklog.workDate.is(d3))
                .and(tIssueWorklog.workDate.isNot(d1))
                .and(tIssueWorklog.workDate.in([d1, d2]))
                .and(tIssueWorklog.workDate.notIn([d3]))
                .and(tIssueWorklog.workDate.lessOrEqual(d2))
                .and(tIssueWorklog.workDate.greaterThan(d1))
                .and(tIssueWorklog.workDate.isNull())
                .and(tIssueWorklog.workDate.isNotNull()))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, workDate: tIssueWorklog.workDate })
                .withValues({ workDate: { equals: d1, notEquals: d2, is: d3, isNot: d1, in: [d1, d2], notIn: [d3], lessOrEqual: d2, greaterThan: d1, isNull: true, isNotNull: true } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where work_date = :0 and work_date <> :1 and decode(work_date, :2, 1, 0 ) = 1 and decode(work_date, :3, 1, 0 ) = 0 and work_date in (:4, :5) and work_date not in (:6) and work_date <= :7 and work_date > :8 and work_date is null and work_date is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2024-01-01T00:00:00.000Z,
            2024-04-01T00:00:00.000Z,
            2024-07-01T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
            2024-04-01T00:00:00.000Z,
            2024-07-01T00:00:00.000Z,
            2024-04-01T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
          ]
        `)
    })

    test('dyn/localdate-descriptor-ifvalue-fire', async () => {
        type Filter = DynamicCondition<{ id: 'int', workDate: 'localDate' }>
        const d1 = new Date(Date.UTC(2024, 0, 1)), d2 = new Date(Date.UTC(2024, 3, 1)), d3 = new Date(Date.UTC(2024, 6, 1))
        const filter: Filter = { workDate: {
            equalsIfValue: d1, notEqualsIfValue: d2, isIfValue: d3, isNotIfValue: d1, inIfValue: [d1, d2],
            notInIfValue: [d3], lessOrEqualIfValue: d2, greaterThanIfValue: d1,
        } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.equalsIfValue(d1)
                .and(tIssueWorklog.workDate.notEqualsIfValue(d2))
                .and(tIssueWorklog.workDate.isIfValue(d3))
                .and(tIssueWorklog.workDate.isNotIfValue(d1))
                .and(tIssueWorklog.workDate.inIfValue([d1, d2]))
                .and(tIssueWorklog.workDate.notInIfValue([d3]))
                .and(tIssueWorklog.workDate.lessOrEqualIfValue(d2))
                .and(tIssueWorklog.workDate.greaterThanIfValue(d1)))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, workDate: tIssueWorklog.workDate }).withValues(filter))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where work_date = :0 and work_date <> :1 and decode(work_date, :2, 1, 0 ) = 1 and decode(work_date, :3, 1, 0 ) = 0 and work_date in (:4, :5) and work_date not in (:6) and work_date <= :7 and work_date > :8 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2024-01-01T00:00:00.000Z,
            2024-04-01T00:00:00.000Z,
            2024-07-01T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
            2024-04-01T00:00:00.000Z,
            2024-07-01T00:00:00.000Z,
            2024-04-01T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
          ]
        `)
    })

    test('dyn/localdate-inline-ifvalue-fire', async () => {
        const d1 = new Date(Date.UTC(2024, 0, 1)), d2 = new Date(Date.UTC(2024, 3, 1)), d3 = new Date(Date.UTC(2024, 6, 1))
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.equalsIfValue(d1)
                .and(tIssueWorklog.workDate.notEqualsIfValue(d2))
                .and(tIssueWorklog.workDate.isIfValue(d3))
                .and(tIssueWorklog.workDate.isNotIfValue(d1))
                .and(tIssueWorklog.workDate.inIfValue([d1, d2]))
                .and(tIssueWorklog.workDate.notInIfValue([d3]))
                .and(tIssueWorklog.workDate.lessOrEqualIfValue(d2))
                .and(tIssueWorklog.workDate.greaterThanIfValue(d1)))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, workDate: tIssueWorklog.workDate })
                .withValues({ workDate: {
                    equalsIfValue: d1, notEqualsIfValue: d2, isIfValue: d3, isNotIfValue: d1, inIfValue: [d1, d2],
                    notInIfValue: [d3], lessOrEqualIfValue: d2, greaterThanIfValue: d1,
                } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where work_date = :0 and work_date <> :1 and decode(work_date, :2, 1, 0 ) = 1 and decode(work_date, :3, 1, 0 ) = 0 and work_date in (:4, :5) and work_date not in (:6) and work_date <= :7 and work_date > :8 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2024-01-01T00:00:00.000Z,
            2024-04-01T00:00:00.000Z,
            2024-07-01T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
            2024-04-01T00:00:00.000Z,
            2024-07-01T00:00:00.000Z,
            2024-04-01T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
          ]
        `)
    })

    test('dyn/localdate-ifvalue-elide', async () => {
        const maybeD: Date | undefined = undefined
        const maybeNull: Date | null = null
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, workDate: tIssueWorklog.workDate })
                .withValues({ workDate: {
                    equalsIfValue: maybeD, notEqualsIfValue: maybeNull, isIfValue: maybeD, isNotIfValue: maybeNull,
                    inIfValue: undefined, notInIfValue: undefined, lessOrEqualIfValue: maybeD, greaterThanIfValue: maybeNull,
                } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    // -- B7 localTime (tIssueWorklog.startedAt) -------------------------------
    test('dyn/localtime-descriptor-ops', async () => {
        type Filter = DynamicCondition<{ id: 'int', startedAt: 'localTime' }>
        const t1 = new Date(Date.UTC(1970, 0, 1, 8, 0, 0)), t2 = new Date(Date.UTC(1970, 0, 1, 12, 0, 0)), t3 = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        const filter: Filter = { startedAt: { equals: t1, notEquals: t2, is: t3, isNot: t1, in: [t1, t2], notIn: [t3], lessOrEqual: t2, greaterThan: t1, isNull: true, isNotNull: true } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.equals(t1)
                .and(tIssueWorklog.startedAt.notEquals(t2))
                .and(tIssueWorklog.startedAt.is(t3))
                .and(tIssueWorklog.startedAt.isNot(t1))
                .and(tIssueWorklog.startedAt.in([t1, t2]))
                .and(tIssueWorklog.startedAt.notIn([t3]))
                .and(tIssueWorklog.startedAt.lessOrEqual(t2))
                .and(tIssueWorklog.startedAt.greaterThan(t1))
                .and(tIssueWorklog.startedAt.isNull())
                .and(tIssueWorklog.startedAt.isNotNull()))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, startedAt: tIssueWorklog.startedAt }).withValues(filter))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where started_at = :0 and started_at <> :1 and decode(started_at, :2, 1, 0 ) = 1 and decode(started_at, :3, 1, 0 ) = 0 and started_at in (:4, :5) and started_at not in (:6) and started_at <= :7 and started_at > :8 and started_at is null and started_at is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1970-01-01T08:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T17:00:00.000Z,
            1970-01-01T08:00:00.000Z,
            1970-01-01T08:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T17:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T08:00:00.000Z,
          ]
        `)
    })

    test('dyn/localtime-inline-ops', async () => {
        const t1 = new Date(Date.UTC(1970, 0, 1, 8, 0, 0)), t2 = new Date(Date.UTC(1970, 0, 1, 12, 0, 0)), t3 = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.equals(t1)
                .and(tIssueWorklog.startedAt.notEquals(t2))
                .and(tIssueWorklog.startedAt.is(t3))
                .and(tIssueWorklog.startedAt.isNot(t1))
                .and(tIssueWorklog.startedAt.in([t1, t2]))
                .and(tIssueWorklog.startedAt.notIn([t3]))
                .and(tIssueWorklog.startedAt.lessOrEqual(t2))
                .and(tIssueWorklog.startedAt.greaterThan(t1))
                .and(tIssueWorklog.startedAt.isNull())
                .and(tIssueWorklog.startedAt.isNotNull()))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, startedAt: tIssueWorklog.startedAt })
                .withValues({ startedAt: { equals: t1, notEquals: t2, is: t3, isNot: t1, in: [t1, t2], notIn: [t3], lessOrEqual: t2, greaterThan: t1, isNull: true, isNotNull: true } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where started_at = :0 and started_at <> :1 and decode(started_at, :2, 1, 0 ) = 1 and decode(started_at, :3, 1, 0 ) = 0 and started_at in (:4, :5) and started_at not in (:6) and started_at <= :7 and started_at > :8 and started_at is null and started_at is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1970-01-01T08:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T17:00:00.000Z,
            1970-01-01T08:00:00.000Z,
            1970-01-01T08:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T17:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T08:00:00.000Z,
          ]
        `)
    })

    test('dyn/localtime-descriptor-ifvalue-fire', async () => {
        type Filter = DynamicCondition<{ id: 'int', startedAt: 'localTime' }>
        const t1 = new Date(Date.UTC(1970, 0, 1, 8, 0, 0)), t2 = new Date(Date.UTC(1970, 0, 1, 12, 0, 0)), t3 = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        const filter: Filter = { startedAt: {
            equalsIfValue: t1, notEqualsIfValue: t2, isIfValue: t3, isNotIfValue: t1, inIfValue: [t1, t2],
            notInIfValue: [t3], lessOrEqualIfValue: t2, greaterThanIfValue: t1,
        } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.equalsIfValue(t1)
                .and(tIssueWorklog.startedAt.notEqualsIfValue(t2))
                .and(tIssueWorklog.startedAt.isIfValue(t3))
                .and(tIssueWorklog.startedAt.isNotIfValue(t1))
                .and(tIssueWorklog.startedAt.inIfValue([t1, t2]))
                .and(tIssueWorklog.startedAt.notInIfValue([t3]))
                .and(tIssueWorklog.startedAt.lessOrEqualIfValue(t2))
                .and(tIssueWorklog.startedAt.greaterThanIfValue(t1)))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, startedAt: tIssueWorklog.startedAt }).withValues(filter))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where started_at = :0 and started_at <> :1 and decode(started_at, :2, 1, 0 ) = 1 and decode(started_at, :3, 1, 0 ) = 0 and started_at in (:4, :5) and started_at not in (:6) and started_at <= :7 and started_at > :8 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1970-01-01T08:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T17:00:00.000Z,
            1970-01-01T08:00:00.000Z,
            1970-01-01T08:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T17:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T08:00:00.000Z,
          ]
        `)
    })

    test('dyn/localtime-inline-ifvalue-fire', async () => {
        const t1 = new Date(Date.UTC(1970, 0, 1, 8, 0, 0)), t2 = new Date(Date.UTC(1970, 0, 1, 12, 0, 0)), t3 = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.equalsIfValue(t1)
                .and(tIssueWorklog.startedAt.notEqualsIfValue(t2))
                .and(tIssueWorklog.startedAt.isIfValue(t3))
                .and(tIssueWorklog.startedAt.isNotIfValue(t1))
                .and(tIssueWorklog.startedAt.inIfValue([t1, t2]))
                .and(tIssueWorklog.startedAt.notInIfValue([t3]))
                .and(tIssueWorklog.startedAt.lessOrEqualIfValue(t2))
                .and(tIssueWorklog.startedAt.greaterThanIfValue(t1)))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, startedAt: tIssueWorklog.startedAt })
                .withValues({ startedAt: {
                    equalsIfValue: t1, notEqualsIfValue: t2, isIfValue: t3, isNotIfValue: t1, inIfValue: [t1, t2],
                    notInIfValue: [t3], lessOrEqualIfValue: t2, greaterThanIfValue: t1,
                } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where started_at = :0 and started_at <> :1 and decode(started_at, :2, 1, 0 ) = 1 and decode(started_at, :3, 1, 0 ) = 0 and started_at in (:4, :5) and started_at not in (:6) and started_at <= :7 and started_at > :8 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1970-01-01T08:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T17:00:00.000Z,
            1970-01-01T08:00:00.000Z,
            1970-01-01T08:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T17:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T08:00:00.000Z,
          ]
        `)
    })

    test('dyn/localtime-ifvalue-elide', async () => {
        const maybeT: Date | undefined = undefined
        const maybeNull: Date | null = null
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, startedAt: tIssueWorklog.startedAt })
                .withValues({ startedAt: {
                    equalsIfValue: maybeT, notEqualsIfValue: maybeNull, isIfValue: maybeT, isNotIfValue: maybeNull,
                    inIfValue: undefined, notInIfValue: undefined, lessOrEqualIfValue: maybeT, greaterThanIfValue: maybeNull,
                } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    // -- B8 localDateTime (tIssue.createdAt) ----------------------------------
    test('dyn/localdatetime-descriptor-ops', async () => {
        type Filter = DynamicCondition<{ id: 'int', createdAt: 'localDateTime' }>
        const s1 = new Date('2020-01-01T00:00:00.000Z'), s2 = new Date('2021-06-15T12:00:00.000Z'), s3 = new Date('2022-12-31T23:00:00.000Z')
        const filter: Filter = { createdAt: { equals: s1, notEquals: s2, is: s3, isNot: s1, in: [s1, s2], notIn: [s3], lessThan: s3, lessOrEqual: s2, greaterThan: s1, isNull: true, isNotNull: true } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.createdAt.equals(s1)
                .and(tIssue.createdAt.notEquals(s2))
                .and(tIssue.createdAt.is(s3))
                .and(tIssue.createdAt.isNot(s1))
                .and(tIssue.createdAt.in([s1, s2]))
                .and(tIssue.createdAt.notIn([s3]))
                .and(tIssue.createdAt.lessThan(s3))
                .and(tIssue.createdAt.lessOrEqual(s2))
                .and(tIssue.createdAt.greaterThan(s1))
                .and(tIssue.createdAt.isNull())
                .and(tIssue.createdAt.isNotNull()))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, createdAt: tIssue.createdAt }).withValues(filter))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where created_at = :0 and created_at <> :1 and decode(created_at, :2, 1, 0 ) = 1 and decode(created_at, :3, 1, 0 ) = 0 and created_at in (:4, :5) and created_at not in (:6) and created_at < :7 and created_at <= :8 and created_at > :9 and created_at is null and created_at is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2020-01-01T00:00:00.000Z,
            2021-06-15T12:00:00.000Z,
            2022-12-31T23:00:00.000Z,
            2020-01-01T00:00:00.000Z,
            2020-01-01T00:00:00.000Z,
            2021-06-15T12:00:00.000Z,
            2022-12-31T23:00:00.000Z,
            2022-12-31T23:00:00.000Z,
            2021-06-15T12:00:00.000Z,
            2020-01-01T00:00:00.000Z,
          ]
        `)
    })

    test('dyn/localdatetime-inline-ops', async () => {
        const s1 = new Date('2020-01-01T00:00:00.000Z'), s2 = new Date('2021-06-15T12:00:00.000Z'), s3 = new Date('2022-12-31T23:00:00.000Z')
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.createdAt.equals(s1)
                .and(tIssue.createdAt.notEquals(s2))
                .and(tIssue.createdAt.is(s3))
                .and(tIssue.createdAt.isNot(s1))
                .and(tIssue.createdAt.in([s1, s2]))
                .and(tIssue.createdAt.notIn([s3]))
                .and(tIssue.createdAt.lessThan(s3))
                .and(tIssue.createdAt.lessOrEqual(s2))
                .and(tIssue.createdAt.greaterThan(s1))
                .and(tIssue.createdAt.isNull())
                .and(tIssue.createdAt.isNotNull()))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, createdAt: tIssue.createdAt })
                .withValues({ createdAt: { equals: s1, notEquals: s2, is: s3, isNot: s1, in: [s1, s2], notIn: [s3], lessThan: s3, lessOrEqual: s2, greaterThan: s1, isNull: true, isNotNull: true } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where created_at = :0 and created_at <> :1 and decode(created_at, :2, 1, 0 ) = 1 and decode(created_at, :3, 1, 0 ) = 0 and created_at in (:4, :5) and created_at not in (:6) and created_at < :7 and created_at <= :8 and created_at > :9 and created_at is null and created_at is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2020-01-01T00:00:00.000Z,
            2021-06-15T12:00:00.000Z,
            2022-12-31T23:00:00.000Z,
            2020-01-01T00:00:00.000Z,
            2020-01-01T00:00:00.000Z,
            2021-06-15T12:00:00.000Z,
            2022-12-31T23:00:00.000Z,
            2022-12-31T23:00:00.000Z,
            2021-06-15T12:00:00.000Z,
            2020-01-01T00:00:00.000Z,
          ]
        `)
    })

    test('dyn/localdatetime-descriptor-ifvalue-fire', async () => {
        type Filter = DynamicCondition<{ id: 'int', createdAt: 'localDateTime' }>
        const s1 = new Date('2020-01-01T00:00:00.000Z'), s2 = new Date('2021-06-15T12:00:00.000Z'), s3 = new Date('2022-12-31T23:00:00.000Z')
        const filter: Filter = { createdAt: {
            equalsIfValue: s1, notEqualsIfValue: s2, isIfValue: s3, isNotIfValue: s1, inIfValue: [s1, s2],
            notInIfValue: [s3], lessThanIfValue: s3, lessOrEqualIfValue: s2, greaterThanIfValue: s1,
        } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.createdAt.equalsIfValue(s1)
                .and(tIssue.createdAt.notEqualsIfValue(s2))
                .and(tIssue.createdAt.isIfValue(s3))
                .and(tIssue.createdAt.isNotIfValue(s1))
                .and(tIssue.createdAt.inIfValue([s1, s2]))
                .and(tIssue.createdAt.notInIfValue([s3]))
                .and(tIssue.createdAt.lessThanIfValue(s3))
                .and(tIssue.createdAt.lessOrEqualIfValue(s2))
                .and(tIssue.createdAt.greaterThanIfValue(s1)))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, createdAt: tIssue.createdAt }).withValues(filter))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where created_at = :0 and created_at <> :1 and decode(created_at, :2, 1, 0 ) = 1 and decode(created_at, :3, 1, 0 ) = 0 and created_at in (:4, :5) and created_at not in (:6) and created_at < :7 and created_at <= :8 and created_at > :9 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2020-01-01T00:00:00.000Z,
            2021-06-15T12:00:00.000Z,
            2022-12-31T23:00:00.000Z,
            2020-01-01T00:00:00.000Z,
            2020-01-01T00:00:00.000Z,
            2021-06-15T12:00:00.000Z,
            2022-12-31T23:00:00.000Z,
            2022-12-31T23:00:00.000Z,
            2021-06-15T12:00:00.000Z,
            2020-01-01T00:00:00.000Z,
          ]
        `)
    })

    test('dyn/localdatetime-inline-ifvalue-fire', async () => {
        const s1 = new Date('2020-01-01T00:00:00.000Z'), s2 = new Date('2021-06-15T12:00:00.000Z'), s3 = new Date('2022-12-31T23:00:00.000Z')
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.createdAt.equalsIfValue(s1)
                .and(tIssue.createdAt.notEqualsIfValue(s2))
                .and(tIssue.createdAt.isIfValue(s3))
                .and(tIssue.createdAt.isNotIfValue(s1))
                .and(tIssue.createdAt.inIfValue([s1, s2]))
                .and(tIssue.createdAt.notInIfValue([s3]))
                .and(tIssue.createdAt.lessThanIfValue(s3))
                .and(tIssue.createdAt.lessOrEqualIfValue(s2))
                .and(tIssue.createdAt.greaterThanIfValue(s1)))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, createdAt: tIssue.createdAt })
                .withValues({ createdAt: {
                    equalsIfValue: s1, notEqualsIfValue: s2, isIfValue: s3, isNotIfValue: s1, inIfValue: [s1, s2],
                    notInIfValue: [s3], lessThanIfValue: s3, lessOrEqualIfValue: s2, greaterThanIfValue: s1,
                } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where created_at = :0 and created_at <> :1 and decode(created_at, :2, 1, 0 ) = 1 and decode(created_at, :3, 1, 0 ) = 0 and created_at in (:4, :5) and created_at not in (:6) and created_at < :7 and created_at <= :8 and created_at > :9 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2020-01-01T00:00:00.000Z,
            2021-06-15T12:00:00.000Z,
            2022-12-31T23:00:00.000Z,
            2020-01-01T00:00:00.000Z,
            2020-01-01T00:00:00.000Z,
            2021-06-15T12:00:00.000Z,
            2022-12-31T23:00:00.000Z,
            2022-12-31T23:00:00.000Z,
            2021-06-15T12:00:00.000Z,
            2020-01-01T00:00:00.000Z,
          ]
        `)
    })

    test('dyn/localdatetime-ifvalue-elide', async () => {
        const maybeS: Date | undefined = undefined
        const maybeNull: Date | null = null
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, createdAt: tIssue.createdAt })
                .withValues({ createdAt: {
                    equalsIfValue: maybeS, notEqualsIfValue: maybeNull, isIfValue: maybeS, isNotIfValue: maybeNull,
                    inIfValue: undefined, notInIfValue: undefined, lessThanIfValue: maybeS, greaterThanIfValue: maybeNull,
                } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    // -- B9 customInt (tIssueWorklog.costCents, branded 'Cents') --------------
    test('dyn/customint-descriptor-ops', async () => {
        type Filter = DynamicCondition<{ id: 'int', costCents: ['customInt', number] }>
        const filter: Filter = { costCents: { equals: 10, notEquals: 20, is: 30, isNot: 40, in: [1, 2], notIn: [9], lessOrEqual: 100, greaterOrEqual: 5, isNull: true, isNotNull: true } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.equals(10)
                .and(tIssueWorklog.costCents.notEquals(20))
                .and(tIssueWorklog.costCents.is(30))
                .and(tIssueWorklog.costCents.isNot(40))
                .and(tIssueWorklog.costCents.in([1, 2]))
                .and(tIssueWorklog.costCents.notIn([9]))
                .and(tIssueWorklog.costCents.lessOrEqual(100))
                .and(tIssueWorklog.costCents.greaterOrEqual(5))
                .and(tIssueWorklog.costCents.isNull())
                .and(tIssueWorklog.costCents.isNotNull()))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, costCents: tIssueWorklog.costCents }).withValues(filter))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where cost_cents = :0 and cost_cents <> :1 and decode(cost_cents, :2, 1, 0 ) = 1 and decode(cost_cents, :3, 1, 0 ) = 0 and cost_cents in (:4, :5) and cost_cents not in (:6) and cost_cents <= :7 and cost_cents >= :8 and cost_cents is null and cost_cents is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            10,
            20,
            30,
            40,
            1,
            2,
            9,
            100,
            5,
          ]
        `)
    })

    test('dyn/customint-inline-ops', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.equals(10)
                .and(tIssueWorklog.costCents.notEquals(20))
                .and(tIssueWorklog.costCents.is(30))
                .and(tIssueWorklog.costCents.isNot(40))
                .and(tIssueWorklog.costCents.in([1, 2]))
                .and(tIssueWorklog.costCents.notIn([9]))
                .and(tIssueWorklog.costCents.lessOrEqual(100))
                .and(tIssueWorklog.costCents.greaterOrEqual(5))
                .and(tIssueWorklog.costCents.isNull())
                .and(tIssueWorklog.costCents.isNotNull()))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, costCents: tIssueWorklog.costCents })
                .withValues({ costCents: { equals: 10, notEquals: 20, is: 30, isNot: 40, in: [1, 2], notIn: [9], lessOrEqual: 100, greaterOrEqual: 5, isNull: true, isNotNull: true } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where cost_cents = :0 and cost_cents <> :1 and decode(cost_cents, :2, 1, 0 ) = 1 and decode(cost_cents, :3, 1, 0 ) = 0 and cost_cents in (:4, :5) and cost_cents not in (:6) and cost_cents <= :7 and cost_cents >= :8 and cost_cents is null and cost_cents is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            10,
            20,
            30,
            40,
            1,
            2,
            9,
            100,
            5,
          ]
        `)
    })

    test('dyn/customint-descriptor-ifvalue-fire', async () => {
        type Filter = DynamicCondition<{ id: 'int', costCents: ['customInt', number] }>
        const filter: Filter = { costCents: {
            equalsIfValue: 10, notEqualsIfValue: 20, isIfValue: 30, isNotIfValue: 40, inIfValue: [1, 2],
            notInIfValue: [9], lessOrEqualIfValue: 100, greaterOrEqualIfValue: 5,
        } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.equalsIfValue(10)
                .and(tIssueWorklog.costCents.notEqualsIfValue(20))
                .and(tIssueWorklog.costCents.isIfValue(30))
                .and(tIssueWorklog.costCents.isNotIfValue(40))
                .and(tIssueWorklog.costCents.inIfValue([1, 2]))
                .and(tIssueWorklog.costCents.notInIfValue([9]))
                .and(tIssueWorklog.costCents.lessOrEqualIfValue(100))
                .and(tIssueWorklog.costCents.greaterOrEqualIfValue(5)))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, costCents: tIssueWorklog.costCents }).withValues(filter))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where cost_cents = :0 and cost_cents <> :1 and decode(cost_cents, :2, 1, 0 ) = 1 and decode(cost_cents, :3, 1, 0 ) = 0 and cost_cents in (:4, :5) and cost_cents not in (:6) and cost_cents <= :7 and cost_cents >= :8 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            10,
            20,
            30,
            40,
            1,
            2,
            9,
            100,
            5,
          ]
        `)
    })

    test('dyn/customint-inline-ifvalue-fire', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.equalsIfValue(10)
                .and(tIssueWorklog.costCents.notEqualsIfValue(20))
                .and(tIssueWorklog.costCents.isIfValue(30))
                .and(tIssueWorklog.costCents.isNotIfValue(40))
                .and(tIssueWorklog.costCents.inIfValue([1, 2]))
                .and(tIssueWorklog.costCents.notInIfValue([9]))
                .and(tIssueWorklog.costCents.lessOrEqualIfValue(100))
                .and(tIssueWorklog.costCents.greaterOrEqualIfValue(5)))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, costCents: tIssueWorklog.costCents })
                .withValues({ costCents: {
                    equalsIfValue: 10, notEqualsIfValue: 20, isIfValue: 30, isNotIfValue: 40, inIfValue: [1, 2],
                    notInIfValue: [9], lessOrEqualIfValue: 100, greaterOrEqualIfValue: 5,
                } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where cost_cents = :0 and cost_cents <> :1 and decode(cost_cents, :2, 1, 0 ) = 1 and decode(cost_cents, :3, 1, 0 ) = 0 and cost_cents in (:4, :5) and cost_cents not in (:6) and cost_cents <= :7 and cost_cents >= :8 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            10,
            20,
            30,
            40,
            1,
            2,
            9,
            100,
            5,
          ]
        `)
    })

    test('dyn/customint-ifvalue-elide', async () => {
        const maybeN: number | undefined = undefined
        const maybeNull: number | null = null
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, costCents: tIssueWorklog.costCents })
                .withValues({ costCents: {
                    equalsIfValue: maybeN, notEqualsIfValue: maybeNull, isIfValue: maybeN, isNotIfValue: maybeNull,
                    inIfValue: undefined, notInIfValue: undefined, lessOrEqualIfValue: maybeN, greaterOrEqualIfValue: maybeNull,
                } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    // -- B10 customDouble (tIssueWorklog.billedAmount, branded 'Money') -------
    test('dyn/customdouble-descriptor-ops', async () => {
        type Filter = DynamicCondition<{ id: 'int', billedAmount: ['customDouble', number] }>
        const filter: Filter = { billedAmount: { equals: 10.5, notEquals: 20.5, is: 30.5, isNot: 40.5, in: [1.5, 2.5], notIn: [9.5], lessOrEqual: 100.5, greaterOrEqual: 5.5, isNull: true, isNotNull: true } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billedAmount.equals(10.5)
                .and(tIssueWorklog.billedAmount.notEquals(20.5))
                .and(tIssueWorklog.billedAmount.is(30.5))
                .and(tIssueWorklog.billedAmount.isNot(40.5))
                .and(tIssueWorklog.billedAmount.in([1.5, 2.5]))
                .and(tIssueWorklog.billedAmount.notIn([9.5]))
                .and(tIssueWorklog.billedAmount.lessOrEqual(100.5))
                .and(tIssueWorklog.billedAmount.greaterOrEqual(5.5))
                .and(tIssueWorklog.billedAmount.isNull())
                .and(tIssueWorklog.billedAmount.isNotNull()))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, billedAmount: tIssueWorklog.billedAmount }).withValues(filter))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where billed_amount = :0 and billed_amount <> :1 and decode(billed_amount, :2, 1, 0 ) = 1 and decode(billed_amount, :3, 1, 0 ) = 0 and billed_amount in (:4, :5) and billed_amount not in (:6) and billed_amount <= :7 and billed_amount >= :8 and billed_amount is null and billed_amount is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            10.5,
            20.5,
            30.5,
            40.5,
            1.5,
            2.5,
            9.5,
            100.5,
            5.5,
          ]
        `)
    })

    test('dyn/customdouble-inline-ops', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billedAmount.equals(10.5)
                .and(tIssueWorklog.billedAmount.notEquals(20.5))
                .and(tIssueWorklog.billedAmount.is(30.5))
                .and(tIssueWorklog.billedAmount.isNot(40.5))
                .and(tIssueWorklog.billedAmount.in([1.5, 2.5]))
                .and(tIssueWorklog.billedAmount.notIn([9.5]))
                .and(tIssueWorklog.billedAmount.lessOrEqual(100.5))
                .and(tIssueWorklog.billedAmount.greaterOrEqual(5.5))
                .and(tIssueWorklog.billedAmount.isNull())
                .and(tIssueWorklog.billedAmount.isNotNull()))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, billedAmount: tIssueWorklog.billedAmount })
                .withValues({ billedAmount: { equals: 10.5, notEquals: 20.5, is: 30.5, isNot: 40.5, in: [1.5, 2.5], notIn: [9.5], lessOrEqual: 100.5, greaterOrEqual: 5.5, isNull: true, isNotNull: true } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where billed_amount = :0 and billed_amount <> :1 and decode(billed_amount, :2, 1, 0 ) = 1 and decode(billed_amount, :3, 1, 0 ) = 0 and billed_amount in (:4, :5) and billed_amount not in (:6) and billed_amount <= :7 and billed_amount >= :8 and billed_amount is null and billed_amount is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            10.5,
            20.5,
            30.5,
            40.5,
            1.5,
            2.5,
            9.5,
            100.5,
            5.5,
          ]
        `)
    })

    test('dyn/customdouble-descriptor-ifvalue-fire', async () => {
        type Filter = DynamicCondition<{ id: 'int', billedAmount: ['customDouble', number] }>
        const filter: Filter = { billedAmount: {
            equalsIfValue: 10.5, notEqualsIfValue: 20.5, isIfValue: 30.5, isNotIfValue: 40.5, inIfValue: [1.5, 2.5],
            notInIfValue: [9.5], lessOrEqualIfValue: 100.5, greaterOrEqualIfValue: 5.5,
        } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billedAmount.equalsIfValue(10.5)
                .and(tIssueWorklog.billedAmount.notEqualsIfValue(20.5))
                .and(tIssueWorklog.billedAmount.isIfValue(30.5))
                .and(tIssueWorklog.billedAmount.isNotIfValue(40.5))
                .and(tIssueWorklog.billedAmount.inIfValue([1.5, 2.5]))
                .and(tIssueWorklog.billedAmount.notInIfValue([9.5]))
                .and(tIssueWorklog.billedAmount.lessOrEqualIfValue(100.5))
                .and(tIssueWorklog.billedAmount.greaterOrEqualIfValue(5.5)))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, billedAmount: tIssueWorklog.billedAmount }).withValues(filter))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where billed_amount = :0 and billed_amount <> :1 and decode(billed_amount, :2, 1, 0 ) = 1 and decode(billed_amount, :3, 1, 0 ) = 0 and billed_amount in (:4, :5) and billed_amount not in (:6) and billed_amount <= :7 and billed_amount >= :8 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            10.5,
            20.5,
            30.5,
            40.5,
            1.5,
            2.5,
            9.5,
            100.5,
            5.5,
          ]
        `)
    })

    test('dyn/customdouble-inline-ifvalue-fire', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billedAmount.equalsIfValue(10.5)
                .and(tIssueWorklog.billedAmount.notEqualsIfValue(20.5))
                .and(tIssueWorklog.billedAmount.isIfValue(30.5))
                .and(tIssueWorklog.billedAmount.isNotIfValue(40.5))
                .and(tIssueWorklog.billedAmount.inIfValue([1.5, 2.5]))
                .and(tIssueWorklog.billedAmount.notInIfValue([9.5]))
                .and(tIssueWorklog.billedAmount.lessOrEqualIfValue(100.5))
                .and(tIssueWorklog.billedAmount.greaterOrEqualIfValue(5.5)))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, billedAmount: tIssueWorklog.billedAmount })
                .withValues({ billedAmount: {
                    equalsIfValue: 10.5, notEqualsIfValue: 20.5, isIfValue: 30.5, isNotIfValue: 40.5, inIfValue: [1.5, 2.5],
                    notInIfValue: [9.5], lessOrEqualIfValue: 100.5, greaterOrEqualIfValue: 5.5,
                } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog where billed_amount = :0 and billed_amount <> :1 and decode(billed_amount, :2, 1, 0 ) = 1 and decode(billed_amount, :3, 1, 0 ) = 0 and billed_amount in (:4, :5) and billed_amount not in (:6) and billed_amount <= :7 and billed_amount >= :8 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            10.5,
            20.5,
            30.5,
            40.5,
            1.5,
            2.5,
            9.5,
            100.5,
            5.5,
          ]
        `)
    })

    test('dyn/customdouble-ifvalue-elide', async () => {
        const maybeN: number | undefined = undefined
        const maybeNull: number | null = null
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.dynamicConditionFor({ id: tIssueWorklog.id, billedAmount: tIssueWorklog.billedAmount })
                .withValues({ billedAmount: {
                    equalsIfValue: maybeN, notEqualsIfValue: maybeNull, isIfValue: maybeN, isNotIfValue: maybeNull,
                    inIfValue: undefined, notInIfValue: undefined, lessOrEqualIfValue: maybeN, greaterOrEqualIfValue: maybeNull,
                } }))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue_worklog order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    // -- B11 customComparable (tProjectRelease.version, branded 'Semver') -----
    test('dyn/customcomparable-descriptor-ops', async () => {
        type Filter = DynamicCondition<{ id: 'int', version: ['customComparable', string] }>
        const filter: Filter = { version: { notEquals: '2.0.0', is: '1.5.0', isNot: '0.9.0', in: ['1.0.0', '1.2.0'], notIn: ['3.0.0'], lessOrEqual: '2.0.0', greaterOrEqual: '1.0.0', isNull: true, isNotNull: true } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.notEquals('2.0.0')
                .and(tProjectRelease.version.is('1.5.0'))
                .and(tProjectRelease.version.isNot('0.9.0'))
                .and(tProjectRelease.version.in(['1.0.0', '1.2.0']))
                .and(tProjectRelease.version.notIn(['3.0.0']))
                .and(tProjectRelease.version.lessOrEqual('2.0.0'))
                .and(tProjectRelease.version.greaterOrEqual('1.0.0'))
                .and(tProjectRelease.version.isNull())
                .and(tProjectRelease.version.isNotNull()))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, version: tProjectRelease.version }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where version <> :0 and decode(version, :1, 1, 0 ) = 1 and decode(version, :2, 1, 0 ) = 0 and version in (:3, :4) and version not in (:5) and version <= :6 and version >= :7 and version is null and version is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "2.0.0",
            "1.5.0",
            "0.9.0",
            "1.0.0",
            "1.2.0",
            "3.0.0",
            "2.0.0",
            "1.0.0",
          ]
        `)
    })

    test('dyn/customcomparable-inline-ops', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.notEquals('2.0.0')
                .and(tProjectRelease.version.is('1.5.0'))
                .and(tProjectRelease.version.isNot('0.9.0'))
                .and(tProjectRelease.version.in(['1.0.0', '1.2.0']))
                .and(tProjectRelease.version.notIn(['3.0.0']))
                .and(tProjectRelease.version.lessOrEqual('2.0.0'))
                .and(tProjectRelease.version.greaterOrEqual('1.0.0'))
                .and(tProjectRelease.version.isNull())
                .and(tProjectRelease.version.isNotNull()))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, version: tProjectRelease.version })
                .withValues({ version: { notEquals: '2.0.0', is: '1.5.0', isNot: '0.9.0', in: ['1.0.0', '1.2.0'], notIn: ['3.0.0'], lessOrEqual: '2.0.0', greaterOrEqual: '1.0.0', isNull: true, isNotNull: true } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where version <> :0 and decode(version, :1, 1, 0 ) = 1 and decode(version, :2, 1, 0 ) = 0 and version in (:3, :4) and version not in (:5) and version <= :6 and version >= :7 and version is null and version is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "2.0.0",
            "1.5.0",
            "0.9.0",
            "1.0.0",
            "1.2.0",
            "3.0.0",
            "2.0.0",
            "1.0.0",
          ]
        `)
    })

    test('dyn/customcomparable-descriptor-ifvalue-fire', async () => {
        type Filter = DynamicCondition<{ id: 'int', version: ['customComparable', string] }>
        const filter: Filter = { version: {
            equalsIfValue: '1.2.0', notEqualsIfValue: '2.0.0', isIfValue: '1.5.0', isNotIfValue: '0.9.0',
            notInIfValue: ['3.0.0'], lessThanIfValue: '2.0.0', greaterThanIfValue: '0.5.0', greaterOrEqualIfValue: '1.0.0',
        } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.equalsIfValue('1.2.0')
                .and(tProjectRelease.version.notEqualsIfValue('2.0.0'))
                .and(tProjectRelease.version.isIfValue('1.5.0'))
                .and(tProjectRelease.version.isNotIfValue('0.9.0'))
                .and(tProjectRelease.version.notInIfValue(['3.0.0']))
                .and(tProjectRelease.version.lessThanIfValue('2.0.0'))
                .and(tProjectRelease.version.greaterThanIfValue('0.5.0'))
                .and(tProjectRelease.version.greaterOrEqualIfValue('1.0.0')))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, version: tProjectRelease.version }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where version = :0 and version <> :1 and decode(version, :2, 1, 0 ) = 1 and decode(version, :3, 1, 0 ) = 0 and version not in (:4) and version < :5 and version > :6 and version >= :7 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "1.2.0",
            "2.0.0",
            "1.5.0",
            "0.9.0",
            "3.0.0",
            "2.0.0",
            "0.5.0",
            "1.0.0",
          ]
        `)
    })

    test('dyn/customcomparable-inline-ifvalue-fire', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.equalsIfValue('1.2.0')
                .and(tProjectRelease.version.notEqualsIfValue('2.0.0'))
                .and(tProjectRelease.version.isIfValue('1.5.0'))
                .and(tProjectRelease.version.isNotIfValue('0.9.0'))
                .and(tProjectRelease.version.notInIfValue(['3.0.0']))
                .and(tProjectRelease.version.lessThanIfValue('2.0.0'))
                .and(tProjectRelease.version.greaterThanIfValue('0.5.0'))
                .and(tProjectRelease.version.greaterOrEqualIfValue('1.0.0')))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, version: tProjectRelease.version })
                .withValues({ version: {
                    equalsIfValue: '1.2.0', notEqualsIfValue: '2.0.0', isIfValue: '1.5.0', isNotIfValue: '0.9.0',
                    notInIfValue: ['3.0.0'], lessThanIfValue: '2.0.0', greaterThanIfValue: '0.5.0', greaterOrEqualIfValue: '1.0.0',
                } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where version = :0 and version <> :1 and decode(version, :2, 1, 0 ) = 1 and decode(version, :3, 1, 0 ) = 0 and version not in (:4) and version < :5 and version > :6 and version >= :7 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "1.2.0",
            "2.0.0",
            "1.5.0",
            "0.9.0",
            "3.0.0",
            "2.0.0",
            "0.5.0",
            "1.0.0",
          ]
        `)
    })

    test('dyn/customcomparable-ifvalue-elide', async () => {
        const maybeV: string | undefined = undefined
        const maybeNull: string | null = null
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, version: tProjectRelease.version })
                .withValues({ version: {
                    equalsIfValue: maybeV, notEqualsIfValue: maybeNull, isIfValue: maybeV, isNotIfValue: maybeNull,
                    notInIfValue: undefined, lessThanIfValue: maybeV, greaterThanIfValue: maybeNull, greaterOrEqualIfValue: maybeV,
                } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from project_release order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    // -- B12 custom eq-only (tProjectRelease.channel, 'ReleaseChannel') -------
    test('dyn/custom-descriptor-equalable-nullable', async () => {
        type Filter = DynamicCondition<{ id: 'int', channel: ['custom', 'stable' | 'beta' | 'canary'] }>
        const filter: Filter = { channel: { equals: 'stable', is: 'beta', isNot: 'canary', notIn: ['canary'], isNull: true, isNotNull: true } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.equals('stable')
                .and(tProjectRelease.channel.is('beta'))
                .and(tProjectRelease.channel.isNot('canary'))
                .and(tProjectRelease.channel.notIn(['canary']))
                .and(tProjectRelease.channel.isNull())
                .and(tProjectRelease.channel.isNotNull()))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, channel: tProjectRelease.channel }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where channel = :0 and decode(channel, :1, 1, 0 ) = 1 and decode(channel, :2, 1, 0 ) = 0 and channel not in (:3) and channel is null and channel is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "stable",
            "beta",
            "canary",
            "canary",
          ]
        `)
    })

    test('dyn/custom-inline-equalable-nullable', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.equals('stable')
                .and(tProjectRelease.channel.is('beta'))
                .and(tProjectRelease.channel.isNot('canary'))
                .and(tProjectRelease.channel.notIn(['canary']))
                .and(tProjectRelease.channel.isNull())
                .and(tProjectRelease.channel.isNotNull()))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, channel: tProjectRelease.channel })
                .withValues({ channel: { equals: 'stable', is: 'beta', isNot: 'canary', notIn: ['canary'], isNull: true, isNotNull: true } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where channel = :0 and decode(channel, :1, 1, 0 ) = 1 and decode(channel, :2, 1, 0 ) = 0 and channel not in (:3) and channel is null and channel is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "stable",
            "beta",
            "canary",
            "canary",
          ]
        `)
    })

    test('dyn/custom-descriptor-ifvalue-fire', async () => {
        type Filter = DynamicCondition<{ id: 'int', channel: ['custom', 'stable' | 'beta' | 'canary'] }>
        const filter: Filter = { channel: { equalsIfValue: 'stable', isIfValue: 'beta', isNotIfValue: 'canary', notInIfValue: ['canary'] } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.equalsIfValue('stable')
                .and(tProjectRelease.channel.isIfValue('beta'))
                .and(tProjectRelease.channel.isNotIfValue('canary'))
                .and(tProjectRelease.channel.notInIfValue(['canary'])))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, channel: tProjectRelease.channel }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where channel = :0 and decode(channel, :1, 1, 0 ) = 1 and decode(channel, :2, 1, 0 ) = 0 and channel not in (:3) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "stable",
            "beta",
            "canary",
            "canary",
          ]
        `)
    })

    test('dyn/custom-inline-ifvalue-fire', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.equalsIfValue('stable')
                .and(tProjectRelease.channel.isIfValue('beta'))
                .and(tProjectRelease.channel.isNotIfValue('canary'))
                .and(tProjectRelease.channel.notInIfValue(['canary'])))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, channel: tProjectRelease.channel })
                .withValues({ channel: { equalsIfValue: 'stable', isIfValue: 'beta', isNotIfValue: 'canary', notInIfValue: ['canary'] } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where channel = :0 and decode(channel, :1, 1, 0 ) = 1 and decode(channel, :2, 1, 0 ) = 0 and channel not in (:3) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "stable",
            "beta",
            "canary",
            "canary",
          ]
        `)
    })

    test('dyn/custom-ifvalue-elide', async () => {
        const maybeC: ('stable' | 'beta' | 'canary') | undefined = undefined
        const maybeNull: ('stable' | 'beta' | 'canary') | null = null
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, channel: tProjectRelease.channel })
                .withValues({ channel: { equalsIfValue: maybeC, isIfValue: maybeNull, isNotIfValue: maybeC, notInIfValue: undefined } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from project_release order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    // -- B13 customLocalDate (tProjectRelease.releasedOn, 'ReleaseDay') -------
    test('dyn/customlocaldate-descriptor-ops', async () => {
        type Filter = DynamicCondition<{ id: 'int', releasedOn: ['customLocalDate', Date] }>
        const d1 = new Date(Date.UTC(2024, 0, 1, 10, 0, 0)), d2 = new Date(Date.UTC(2024, 5, 1, 10, 0, 0)), d3 = new Date(Date.UTC(2024, 11, 1, 10, 0, 0))
        const filter: Filter = { releasedOn: { equals: d1, notEquals: d2, is: d3, isNot: d1, in: [d1, d2], notIn: [d3], lessOrEqual: d2, greaterThan: d1, isNull: true, isNotNull: true } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.releasedOn.equals(d1)
                .and(tProjectRelease.releasedOn.notEquals(d2))
                .and(tProjectRelease.releasedOn.is(d3))
                .and(tProjectRelease.releasedOn.isNot(d1))
                .and(tProjectRelease.releasedOn.in([d1, d2]))
                .and(tProjectRelease.releasedOn.notIn([d3]))
                .and(tProjectRelease.releasedOn.lessOrEqual(d2))
                .and(tProjectRelease.releasedOn.greaterThan(d1))
                .and(tProjectRelease.releasedOn.isNull())
                .and(tProjectRelease.releasedOn.isNotNull()))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, releasedOn: tProjectRelease.releasedOn }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where released_on = :0 and released_on <> :1 and decode(released_on, :2, 1, 0 ) = 1 and decode(released_on, :3, 1, 0 ) = 0 and released_on in (:4, :5) and released_on not in (:6) and released_on <= :7 and released_on > :8 and released_on is null and released_on is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2024-01-01T10:00:00.000Z,
            2024-06-01T10:00:00.000Z,
            2024-12-01T10:00:00.000Z,
            2024-01-01T10:00:00.000Z,
            2024-01-01T10:00:00.000Z,
            2024-06-01T10:00:00.000Z,
            2024-12-01T10:00:00.000Z,
            2024-06-01T10:00:00.000Z,
            2024-01-01T10:00:00.000Z,
          ]
        `)
    })

    test('dyn/customlocaldate-inline-ops', async () => {
        const d1 = new Date(Date.UTC(2024, 0, 1, 10, 0, 0)), d2 = new Date(Date.UTC(2024, 5, 1, 10, 0, 0)), d3 = new Date(Date.UTC(2024, 11, 1, 10, 0, 0))
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.releasedOn.equals(d1)
                .and(tProjectRelease.releasedOn.notEquals(d2))
                .and(tProjectRelease.releasedOn.is(d3))
                .and(tProjectRelease.releasedOn.isNot(d1))
                .and(tProjectRelease.releasedOn.in([d1, d2]))
                .and(tProjectRelease.releasedOn.notIn([d3]))
                .and(tProjectRelease.releasedOn.lessOrEqual(d2))
                .and(tProjectRelease.releasedOn.greaterThan(d1))
                .and(tProjectRelease.releasedOn.isNull())
                .and(tProjectRelease.releasedOn.isNotNull()))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, releasedOn: tProjectRelease.releasedOn })
                .withValues({ releasedOn: { equals: d1, notEquals: d2, is: d3, isNot: d1, in: [d1, d2], notIn: [d3], lessOrEqual: d2, greaterThan: d1, isNull: true, isNotNull: true } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where released_on = :0 and released_on <> :1 and decode(released_on, :2, 1, 0 ) = 1 and decode(released_on, :3, 1, 0 ) = 0 and released_on in (:4, :5) and released_on not in (:6) and released_on <= :7 and released_on > :8 and released_on is null and released_on is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2024-01-01T10:00:00.000Z,
            2024-06-01T10:00:00.000Z,
            2024-12-01T10:00:00.000Z,
            2024-01-01T10:00:00.000Z,
            2024-01-01T10:00:00.000Z,
            2024-06-01T10:00:00.000Z,
            2024-12-01T10:00:00.000Z,
            2024-06-01T10:00:00.000Z,
            2024-01-01T10:00:00.000Z,
          ]
        `)
    })

    test('dyn/customlocaldate-descriptor-ifvalue-fire', async () => {
        type Filter = DynamicCondition<{ id: 'int', releasedOn: ['customLocalDate', Date] }>
        const d1 = new Date(Date.UTC(2024, 0, 1, 10, 0, 0)), d2 = new Date(Date.UTC(2024, 5, 1, 10, 0, 0)), d3 = new Date(Date.UTC(2024, 11, 1, 10, 0, 0))
        const filter: Filter = { releasedOn: {
            equalsIfValue: d1, notEqualsIfValue: d2, isIfValue: d3, isNotIfValue: d1, inIfValue: [d1, d2],
            notInIfValue: [d3], lessOrEqualIfValue: d2, greaterThanIfValue: d1,
        } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.releasedOn.equalsIfValue(d1)
                .and(tProjectRelease.releasedOn.notEqualsIfValue(d2))
                .and(tProjectRelease.releasedOn.isIfValue(d3))
                .and(tProjectRelease.releasedOn.isNotIfValue(d1))
                .and(tProjectRelease.releasedOn.inIfValue([d1, d2]))
                .and(tProjectRelease.releasedOn.notInIfValue([d3]))
                .and(tProjectRelease.releasedOn.lessOrEqualIfValue(d2))
                .and(tProjectRelease.releasedOn.greaterThanIfValue(d1)))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, releasedOn: tProjectRelease.releasedOn }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where released_on = :0 and released_on <> :1 and decode(released_on, :2, 1, 0 ) = 1 and decode(released_on, :3, 1, 0 ) = 0 and released_on in (:4, :5) and released_on not in (:6) and released_on <= :7 and released_on > :8 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2024-01-01T10:00:00.000Z,
            2024-06-01T10:00:00.000Z,
            2024-12-01T10:00:00.000Z,
            2024-01-01T10:00:00.000Z,
            2024-01-01T10:00:00.000Z,
            2024-06-01T10:00:00.000Z,
            2024-12-01T10:00:00.000Z,
            2024-06-01T10:00:00.000Z,
            2024-01-01T10:00:00.000Z,
          ]
        `)
    })

    test('dyn/customlocaldate-inline-ifvalue-fire', async () => {
        const d1 = new Date(Date.UTC(2024, 0, 1, 10, 0, 0)), d2 = new Date(Date.UTC(2024, 5, 1, 10, 0, 0)), d3 = new Date(Date.UTC(2024, 11, 1, 10, 0, 0))
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.releasedOn.equalsIfValue(d1)
                .and(tProjectRelease.releasedOn.notEqualsIfValue(d2))
                .and(tProjectRelease.releasedOn.isIfValue(d3))
                .and(tProjectRelease.releasedOn.isNotIfValue(d1))
                .and(tProjectRelease.releasedOn.inIfValue([d1, d2]))
                .and(tProjectRelease.releasedOn.notInIfValue([d3]))
                .and(tProjectRelease.releasedOn.lessOrEqualIfValue(d2))
                .and(tProjectRelease.releasedOn.greaterThanIfValue(d1)))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, releasedOn: tProjectRelease.releasedOn })
                .withValues({ releasedOn: {
                    equalsIfValue: d1, notEqualsIfValue: d2, isIfValue: d3, isNotIfValue: d1, inIfValue: [d1, d2],
                    notInIfValue: [d3], lessOrEqualIfValue: d2, greaterThanIfValue: d1,
                } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where released_on = :0 and released_on <> :1 and decode(released_on, :2, 1, 0 ) = 1 and decode(released_on, :3, 1, 0 ) = 0 and released_on in (:4, :5) and released_on not in (:6) and released_on <= :7 and released_on > :8 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2024-01-01T10:00:00.000Z,
            2024-06-01T10:00:00.000Z,
            2024-12-01T10:00:00.000Z,
            2024-01-01T10:00:00.000Z,
            2024-01-01T10:00:00.000Z,
            2024-06-01T10:00:00.000Z,
            2024-12-01T10:00:00.000Z,
            2024-06-01T10:00:00.000Z,
            2024-01-01T10:00:00.000Z,
          ]
        `)
    })

    test('dyn/customlocaldate-ifvalue-elide', async () => {
        const maybeD: Date | undefined = undefined
        const maybeNull: Date | null = null
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, releasedOn: tProjectRelease.releasedOn })
                .withValues({ releasedOn: {
                    equalsIfValue: maybeD, notEqualsIfValue: maybeNull, isIfValue: maybeD, isNotIfValue: maybeNull,
                    inIfValue: undefined, notInIfValue: undefined, lessOrEqualIfValue: maybeD, greaterThanIfValue: maybeNull,
                } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from project_release order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    // -- B14 customLocalTime (tProjectRelease.cutoffTime, 'CutoffClock') ------
    test('dyn/customlocaltime-descriptor-ops', async () => {
        type Filter = DynamicCondition<{ id: 'int', cutoffTime: ['customLocalTime', Date] }>
        const t1 = new Date(Date.UTC(1970, 0, 1, 8, 0, 0)), t2 = new Date(Date.UTC(1970, 0, 1, 12, 0, 0)), t3 = new Date(Date.UTC(1970, 0, 1, 20, 0, 0))
        const filter: Filter = { cutoffTime: { equals: t1, notEquals: t2, is: t3, isNot: t1, in: [t1, t2], notIn: [t3], lessOrEqual: t2, greaterThan: t1, isNull: true, isNotNull: true } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.equals(t1)
                .and(tProjectRelease.cutoffTime.notEquals(t2))
                .and(tProjectRelease.cutoffTime.is(t3))
                .and(tProjectRelease.cutoffTime.isNot(t1))
                .and(tProjectRelease.cutoffTime.in([t1, t2]))
                .and(tProjectRelease.cutoffTime.notIn([t3]))
                .and(tProjectRelease.cutoffTime.lessOrEqual(t2))
                .and(tProjectRelease.cutoffTime.greaterThan(t1))
                .and(tProjectRelease.cutoffTime.isNull())
                .and(tProjectRelease.cutoffTime.isNotNull()))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, cutoffTime: tProjectRelease.cutoffTime }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where cutoff_time = :0 and cutoff_time <> :1 and decode(cutoff_time, :2, 1, 0 ) = 1 and decode(cutoff_time, :3, 1, 0 ) = 0 and cutoff_time in (:4, :5) and cutoff_time not in (:6) and cutoff_time <= :7 and cutoff_time > :8 and cutoff_time is null and cutoff_time is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1970-01-01T08:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T20:00:00.000Z,
            1970-01-01T08:00:00.000Z,
            1970-01-01T08:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T20:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T08:00:00.000Z,
          ]
        `)
    })

    test('dyn/customlocaltime-inline-ops', async () => {
        const t1 = new Date(Date.UTC(1970, 0, 1, 8, 0, 0)), t2 = new Date(Date.UTC(1970, 0, 1, 12, 0, 0)), t3 = new Date(Date.UTC(1970, 0, 1, 20, 0, 0))
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.equals(t1)
                .and(tProjectRelease.cutoffTime.notEquals(t2))
                .and(tProjectRelease.cutoffTime.is(t3))
                .and(tProjectRelease.cutoffTime.isNot(t1))
                .and(tProjectRelease.cutoffTime.in([t1, t2]))
                .and(tProjectRelease.cutoffTime.notIn([t3]))
                .and(tProjectRelease.cutoffTime.lessOrEqual(t2))
                .and(tProjectRelease.cutoffTime.greaterThan(t1))
                .and(tProjectRelease.cutoffTime.isNull())
                .and(tProjectRelease.cutoffTime.isNotNull()))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, cutoffTime: tProjectRelease.cutoffTime })
                .withValues({ cutoffTime: { equals: t1, notEquals: t2, is: t3, isNot: t1, in: [t1, t2], notIn: [t3], lessOrEqual: t2, greaterThan: t1, isNull: true, isNotNull: true } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where cutoff_time = :0 and cutoff_time <> :1 and decode(cutoff_time, :2, 1, 0 ) = 1 and decode(cutoff_time, :3, 1, 0 ) = 0 and cutoff_time in (:4, :5) and cutoff_time not in (:6) and cutoff_time <= :7 and cutoff_time > :8 and cutoff_time is null and cutoff_time is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1970-01-01T08:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T20:00:00.000Z,
            1970-01-01T08:00:00.000Z,
            1970-01-01T08:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T20:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T08:00:00.000Z,
          ]
        `)
    })

    test('dyn/customlocaltime-descriptor-ifvalue-fire', async () => {
        type Filter = DynamicCondition<{ id: 'int', cutoffTime: ['customLocalTime', Date] }>
        const t1 = new Date(Date.UTC(1970, 0, 1, 8, 0, 0)), t2 = new Date(Date.UTC(1970, 0, 1, 12, 0, 0)), t3 = new Date(Date.UTC(1970, 0, 1, 20, 0, 0))
        const filter: Filter = { cutoffTime: {
            equalsIfValue: t1, notEqualsIfValue: t2, isIfValue: t3, isNotIfValue: t1, inIfValue: [t1, t2],
            notInIfValue: [t3], lessOrEqualIfValue: t2, greaterThanIfValue: t1,
        } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.equalsIfValue(t1)
                .and(tProjectRelease.cutoffTime.notEqualsIfValue(t2))
                .and(tProjectRelease.cutoffTime.isIfValue(t3))
                .and(tProjectRelease.cutoffTime.isNotIfValue(t1))
                .and(tProjectRelease.cutoffTime.inIfValue([t1, t2]))
                .and(tProjectRelease.cutoffTime.notInIfValue([t3]))
                .and(tProjectRelease.cutoffTime.lessOrEqualIfValue(t2))
                .and(tProjectRelease.cutoffTime.greaterThanIfValue(t1)))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, cutoffTime: tProjectRelease.cutoffTime }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where cutoff_time = :0 and cutoff_time <> :1 and decode(cutoff_time, :2, 1, 0 ) = 1 and decode(cutoff_time, :3, 1, 0 ) = 0 and cutoff_time in (:4, :5) and cutoff_time not in (:6) and cutoff_time <= :7 and cutoff_time > :8 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1970-01-01T08:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T20:00:00.000Z,
            1970-01-01T08:00:00.000Z,
            1970-01-01T08:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T20:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T08:00:00.000Z,
          ]
        `)
    })

    test('dyn/customlocaltime-inline-ifvalue-fire', async () => {
        const t1 = new Date(Date.UTC(1970, 0, 1, 8, 0, 0)), t2 = new Date(Date.UTC(1970, 0, 1, 12, 0, 0)), t3 = new Date(Date.UTC(1970, 0, 1, 20, 0, 0))
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.equalsIfValue(t1)
                .and(tProjectRelease.cutoffTime.notEqualsIfValue(t2))
                .and(tProjectRelease.cutoffTime.isIfValue(t3))
                .and(tProjectRelease.cutoffTime.isNotIfValue(t1))
                .and(tProjectRelease.cutoffTime.inIfValue([t1, t2]))
                .and(tProjectRelease.cutoffTime.notInIfValue([t3]))
                .and(tProjectRelease.cutoffTime.lessOrEqualIfValue(t2))
                .and(tProjectRelease.cutoffTime.greaterThanIfValue(t1)))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, cutoffTime: tProjectRelease.cutoffTime })
                .withValues({ cutoffTime: {
                    equalsIfValue: t1, notEqualsIfValue: t2, isIfValue: t3, isNotIfValue: t1, inIfValue: [t1, t2],
                    notInIfValue: [t3], lessOrEqualIfValue: t2, greaterThanIfValue: t1,
                } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where cutoff_time = :0 and cutoff_time <> :1 and decode(cutoff_time, :2, 1, 0 ) = 1 and decode(cutoff_time, :3, 1, 0 ) = 0 and cutoff_time in (:4, :5) and cutoff_time not in (:6) and cutoff_time <= :7 and cutoff_time > :8 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1970-01-01T08:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T20:00:00.000Z,
            1970-01-01T08:00:00.000Z,
            1970-01-01T08:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T20:00:00.000Z,
            1970-01-01T12:00:00.000Z,
            1970-01-01T08:00:00.000Z,
          ]
        `)
    })

    test('dyn/customlocaltime-ifvalue-elide', async () => {
        const maybeT: Date | undefined = undefined
        const maybeNull: Date | null = null
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, cutoffTime: tProjectRelease.cutoffTime })
                .withValues({ cutoffTime: {
                    equalsIfValue: maybeT, notEqualsIfValue: maybeNull, isIfValue: maybeT, isNotIfValue: maybeNull,
                    inIfValue: undefined, notInIfValue: undefined, lessOrEqualIfValue: maybeT, greaterThanIfValue: maybeNull,
                } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from project_release order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    // -- B15 customLocalDateTime (tProjectRelease.signedOffAt, 'SignOffStamp') --
    test('dyn/customlocaldatetime-descriptor-ops', async () => {
        type Filter = DynamicCondition<{ id: 'int', signedOffAt: ['customLocalDateTime', Date] }>
        const s1 = new Date('2024-01-01T00:00:00.000Z'), s2 = new Date('2024-06-15T12:00:00.000Z'), s3 = new Date('2024-12-31T00:00:00.000Z')
        const filter: Filter = { signedOffAt: { equals: s1, notEquals: s2, is: s3, isNot: s1, in: [s1, s2], notIn: [s3], lessOrEqual: s2, greaterThan: s1, isNull: true, isNotNull: true } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.equals(s1)
                .and(tProjectRelease.signedOffAt.notEquals(s2))
                .and(tProjectRelease.signedOffAt.is(s3))
                .and(tProjectRelease.signedOffAt.isNot(s1))
                .and(tProjectRelease.signedOffAt.in([s1, s2]))
                .and(tProjectRelease.signedOffAt.notIn([s3]))
                .and(tProjectRelease.signedOffAt.lessOrEqual(s2))
                .and(tProjectRelease.signedOffAt.greaterThan(s1))
                .and(tProjectRelease.signedOffAt.isNull())
                .and(tProjectRelease.signedOffAt.isNotNull()))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, signedOffAt: tProjectRelease.signedOffAt }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where signed_off_at = :0 and signed_off_at <> :1 and decode(signed_off_at, :2, 1, 0 ) = 1 and decode(signed_off_at, :3, 1, 0 ) = 0 and signed_off_at in (:4, :5) and signed_off_at not in (:6) and signed_off_at <= :7 and signed_off_at > :8 and signed_off_at is null and signed_off_at is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2024-01-01T00:00:00.000Z,
            2024-06-15T12:00:00.000Z,
            2024-12-31T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
            2024-06-15T12:00:00.000Z,
            2024-12-31T00:00:00.000Z,
            2024-06-15T12:00:00.000Z,
            2024-01-01T00:00:00.000Z,
          ]
        `)
    })

    test('dyn/customlocaldatetime-inline-ops', async () => {
        const s1 = new Date('2024-01-01T00:00:00.000Z'), s2 = new Date('2024-06-15T12:00:00.000Z'), s3 = new Date('2024-12-31T00:00:00.000Z')
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.equals(s1)
                .and(tProjectRelease.signedOffAt.notEquals(s2))
                .and(tProjectRelease.signedOffAt.is(s3))
                .and(tProjectRelease.signedOffAt.isNot(s1))
                .and(tProjectRelease.signedOffAt.in([s1, s2]))
                .and(tProjectRelease.signedOffAt.notIn([s3]))
                .and(tProjectRelease.signedOffAt.lessOrEqual(s2))
                .and(tProjectRelease.signedOffAt.greaterThan(s1))
                .and(tProjectRelease.signedOffAt.isNull())
                .and(tProjectRelease.signedOffAt.isNotNull()))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, signedOffAt: tProjectRelease.signedOffAt })
                .withValues({ signedOffAt: { equals: s1, notEquals: s2, is: s3, isNot: s1, in: [s1, s2], notIn: [s3], lessOrEqual: s2, greaterThan: s1, isNull: true, isNotNull: true } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where signed_off_at = :0 and signed_off_at <> :1 and decode(signed_off_at, :2, 1, 0 ) = 1 and decode(signed_off_at, :3, 1, 0 ) = 0 and signed_off_at in (:4, :5) and signed_off_at not in (:6) and signed_off_at <= :7 and signed_off_at > :8 and signed_off_at is null and signed_off_at is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2024-01-01T00:00:00.000Z,
            2024-06-15T12:00:00.000Z,
            2024-12-31T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
            2024-06-15T12:00:00.000Z,
            2024-12-31T00:00:00.000Z,
            2024-06-15T12:00:00.000Z,
            2024-01-01T00:00:00.000Z,
          ]
        `)
    })

    test('dyn/customlocaldatetime-descriptor-ifvalue-fire', async () => {
        type Filter = DynamicCondition<{ id: 'int', signedOffAt: ['customLocalDateTime', Date] }>
        const s1 = new Date('2024-01-01T00:00:00.000Z'), s2 = new Date('2024-06-15T12:00:00.000Z'), s3 = new Date('2024-12-31T00:00:00.000Z')
        const filter: Filter = { signedOffAt: {
            equalsIfValue: s1, notEqualsIfValue: s2, isIfValue: s3, isNotIfValue: s1, inIfValue: [s1, s2],
            notInIfValue: [s3], lessOrEqualIfValue: s2, greaterThanIfValue: s1,
        } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.equalsIfValue(s1)
                .and(tProjectRelease.signedOffAt.notEqualsIfValue(s2))
                .and(tProjectRelease.signedOffAt.isIfValue(s3))
                .and(tProjectRelease.signedOffAt.isNotIfValue(s1))
                .and(tProjectRelease.signedOffAt.inIfValue([s1, s2]))
                .and(tProjectRelease.signedOffAt.notInIfValue([s3]))
                .and(tProjectRelease.signedOffAt.lessOrEqualIfValue(s2))
                .and(tProjectRelease.signedOffAt.greaterThanIfValue(s1)))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, signedOffAt: tProjectRelease.signedOffAt }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where signed_off_at = :0 and signed_off_at <> :1 and decode(signed_off_at, :2, 1, 0 ) = 1 and decode(signed_off_at, :3, 1, 0 ) = 0 and signed_off_at in (:4, :5) and signed_off_at not in (:6) and signed_off_at <= :7 and signed_off_at > :8 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2024-01-01T00:00:00.000Z,
            2024-06-15T12:00:00.000Z,
            2024-12-31T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
            2024-06-15T12:00:00.000Z,
            2024-12-31T00:00:00.000Z,
            2024-06-15T12:00:00.000Z,
            2024-01-01T00:00:00.000Z,
          ]
        `)
    })

    test('dyn/customlocaldatetime-inline-ifvalue-fire', async () => {
        const s1 = new Date('2024-01-01T00:00:00.000Z'), s2 = new Date('2024-06-15T12:00:00.000Z'), s3 = new Date('2024-12-31T00:00:00.000Z')
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.equalsIfValue(s1)
                .and(tProjectRelease.signedOffAt.notEqualsIfValue(s2))
                .and(tProjectRelease.signedOffAt.isIfValue(s3))
                .and(tProjectRelease.signedOffAt.isNotIfValue(s1))
                .and(tProjectRelease.signedOffAt.inIfValue([s1, s2]))
                .and(tProjectRelease.signedOffAt.notInIfValue([s3]))
                .and(tProjectRelease.signedOffAt.lessOrEqualIfValue(s2))
                .and(tProjectRelease.signedOffAt.greaterThanIfValue(s1)))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, signedOffAt: tProjectRelease.signedOffAt })
                .withValues({ signedOffAt: {
                    equalsIfValue: s1, notEqualsIfValue: s2, isIfValue: s3, isNotIfValue: s1, inIfValue: [s1, s2],
                    notInIfValue: [s3], lessOrEqualIfValue: s2, greaterThanIfValue: s1,
                } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where signed_off_at = :0 and signed_off_at <> :1 and decode(signed_off_at, :2, 1, 0 ) = 1 and decode(signed_off_at, :3, 1, 0 ) = 0 and signed_off_at in (:4, :5) and signed_off_at not in (:6) and signed_off_at <= :7 and signed_off_at > :8 order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            2024-01-01T00:00:00.000Z,
            2024-06-15T12:00:00.000Z,
            2024-12-31T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
            2024-01-01T00:00:00.000Z,
            2024-06-15T12:00:00.000Z,
            2024-12-31T00:00:00.000Z,
            2024-06-15T12:00:00.000Z,
            2024-01-01T00:00:00.000Z,
          ]
        `)
    })

    test('dyn/customlocaldatetime-ifvalue-elide', async () => {
        const maybeS: Date | undefined = undefined
        const maybeNull: Date | null = null
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, signedOffAt: tProjectRelease.signedOffAt })
                .withValues({ signedOffAt: {
                    equalsIfValue: maybeS, notEqualsIfValue: maybeNull, isIfValue: maybeS, isNotIfValue: maybeNull,
                    inIfValue: undefined, notInIfValue: undefined, lessOrEqualIfValue: maybeS, greaterThanIfValue: maybeNull,
                } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from project_release order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    // -- B4 uuid (tIssue.externalRef) -----------------------------------------
    // Core ops (equals/comparable/nullable) dispatch directly on the uuid value
    // source; the like/affix/insensitive family routes through the `asString()`
    // text rewrite (useAsStringInUuid), matched on the direct side.
    test('dyn/uuid-descriptor-core-ops', async () => {
        type Filter = DynamicCondition<{ id: 'int', externalRef: 'uuid' }>
        const u1 = '0a8f9c1e-1111-4222-8333-444455556661', u2 = '0a8f9c1e-1111-4222-8333-444455556662', u3 = '0a8f9c1e-1111-4222-8333-444455556663'
        const filter: Filter = { externalRef: { equals: u1, notEquals: u2, is: u3, isNot: u1, in: [u1, u2], notIn: [u3], lessThan: u3, lessOrEqual: u2, greaterThan: u1, greaterOrEqual: u1, isNull: true, isNotNull: true } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.equals(u1)
                .and(tIssue.externalRef.notEquals(u2))
                .and(tIssue.externalRef.is(u3))
                .and(tIssue.externalRef.isNot(u1))
                .and(tIssue.externalRef.in([u1, u2]))
                .and(tIssue.externalRef.notIn([u3]))
                .and(tIssue.externalRef.lessThan(u3))
                .and(tIssue.externalRef.lessOrEqual(u2))
                .and(tIssue.externalRef.greaterThan(u1))
                .and(tIssue.externalRef.greaterOrEqual(u1))
                .and(tIssue.externalRef.isNull())
                .and(tIssue.externalRef.isNotNull()))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, externalRef: tIssue.externalRef }).withValues(filter))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where external_ref = uuid_to_raw(:0) and external_ref <> uuid_to_raw(:1) and decode(external_ref, uuid_to_raw(:2), 1, 0 ) = 1 and decode(external_ref, uuid_to_raw(:3), 1, 0 ) = 0 and external_ref in (uuid_to_raw(:4), uuid_to_raw(:5)) and external_ref not in (uuid_to_raw(:6)) and external_ref < uuid_to_raw(:7) and external_ref <= uuid_to_raw(:8) and external_ref > uuid_to_raw(:9) and external_ref >= uuid_to_raw(:10) and external_ref is null and external_ref is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556661",
          ]
        `)
    })

    test('dyn/uuid-inline-core-ops', async () => {
        const u1 = '0a8f9c1e-1111-4222-8333-444455556661', u2 = '0a8f9c1e-1111-4222-8333-444455556662', u3 = '0a8f9c1e-1111-4222-8333-444455556663'
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.equals(u1)
                .and(tIssue.externalRef.notEquals(u2))
                .and(tIssue.externalRef.is(u3))
                .and(tIssue.externalRef.isNot(u1))
                .and(tIssue.externalRef.in([u1, u2]))
                .and(tIssue.externalRef.notIn([u3]))
                .and(tIssue.externalRef.lessThan(u3))
                .and(tIssue.externalRef.lessOrEqual(u2))
                .and(tIssue.externalRef.greaterThan(u1))
                .and(tIssue.externalRef.greaterOrEqual(u1))
                .and(tIssue.externalRef.isNull())
                .and(tIssue.externalRef.isNotNull()))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, externalRef: tIssue.externalRef })
                .withValues({ externalRef: { equals: u1, notEquals: u2, is: u3, isNot: u1, in: [u1, u2], notIn: [u3], lessThan: u3, lessOrEqual: u2, greaterThan: u1, greaterOrEqual: u1, isNull: true, isNotNull: true } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where external_ref = uuid_to_raw(:0) and external_ref <> uuid_to_raw(:1) and decode(external_ref, uuid_to_raw(:2), 1, 0 ) = 1 and decode(external_ref, uuid_to_raw(:3), 1, 0 ) = 0 and external_ref in (uuid_to_raw(:4), uuid_to_raw(:5)) and external_ref not in (uuid_to_raw(:6)) and external_ref < uuid_to_raw(:7) and external_ref <= uuid_to_raw(:8) and external_ref > uuid_to_raw(:9) and external_ref >= uuid_to_raw(:10) and external_ref is null and external_ref is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556661",
          ]
        `)
    })

    test('dyn/uuid-descriptor-string-family', async () => {
        type Filter = DynamicCondition<{ id: 'int', externalRef: 'uuid' }>
        const filter: Filter = { externalRef: {
            equalsInsensitive: '0A8F', notEqualsInsensitive: 'FFFF', like: '%1111%', notLike: '%9999%',
            likeInsensitive: '%1111%', notLikeInsensitive: '%9999%', startsWith: '0a8f', notStartsWith: 'ffff',
            endsWith: '6666', notEndsWith: '0000', contains: '4222', notContains: '9999',
            startsWithInsensitive: '0A8F', notStartsWithInsensitive: 'FFFF', endsWithInsensitive: '6666',
            notEndsWithInsensitive: '0000', containsInsensitive: '4222', notContainsInsensitive: '9999',
        } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().equalsInsensitive('0A8F')
                .and(tIssue.externalRef.asString().notEqualsInsensitive('FFFF'))
                .and(tIssue.externalRef.asString().like('%1111%'))
                .and(tIssue.externalRef.asString().notLike('%9999%'))
                .and(tIssue.externalRef.asString().likeInsensitive('%1111%'))
                .and(tIssue.externalRef.asString().notLikeInsensitive('%9999%'))
                .and(tIssue.externalRef.asString().startsWith('0a8f'))
                .and(tIssue.externalRef.asString().notStartsWith('ffff'))
                .and(tIssue.externalRef.asString().endsWith('6666'))
                .and(tIssue.externalRef.asString().notEndsWith('0000'))
                .and(tIssue.externalRef.asString().contains('4222'))
                .and(tIssue.externalRef.asString().notContains('9999'))
                .and(tIssue.externalRef.asString().startsWithInsensitive('0A8F'))
                .and(tIssue.externalRef.asString().notStartsWithInsensitive('FFFF'))
                .and(tIssue.externalRef.asString().endsWithInsensitive('6666'))
                .and(tIssue.externalRef.asString().notEndsWithInsensitive('0000'))
                .and(tIssue.externalRef.asString().containsInsensitive('4222'))
                .and(tIssue.externalRef.asString().notContainsInsensitive('9999')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, externalRef: tIssue.externalRef }).withValues(filter))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where lower(raw_to_uuid(external_ref)) = lower(:0) and lower(raw_to_uuid(external_ref)) <> lower(:1) and raw_to_uuid(external_ref) like :2 escape '\\' and raw_to_uuid(external_ref) not like :3 escape '\\' and lower(raw_to_uuid(external_ref)) like lower(:4) escape '\\' and lower(raw_to_uuid(external_ref)) not like lower(:5) escape '\\' and raw_to_uuid(external_ref) like (:6 || '%') escape '\\' and raw_to_uuid(external_ref) not like (:7 || '%') escape '\\' and raw_to_uuid(external_ref) like ('%' || :8) escape '\\' and raw_to_uuid(external_ref) not like ('%' || :9) escape '\\' and raw_to_uuid(external_ref) like ('%' || :10 || '%') escape '\\' and raw_to_uuid(external_ref) not like ('%' || :11 || '%') escape '\\' and lower(raw_to_uuid(external_ref)) like lower(:12 || '%') escape '\\' and lower(raw_to_uuid(external_ref)) not like lower(:13 || '%') escape '\\' and lower(raw_to_uuid(external_ref)) like lower('%' || :14) escape '\\' and lower(raw_to_uuid(external_ref)) not like lower('%' || :15) escape '\\' and lower(raw_to_uuid(external_ref)) like lower('%' || :16 || '%') escape '\\' and lower(raw_to_uuid(external_ref)) not like lower('%' || :17 || '%') escape '\\' order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "0A8F",
            "FFFF",
            "%1111%",
            "%9999%",
            "%1111%",
            "%9999%",
            "0a8f",
            "ffff",
            "6666",
            "0000",
            "4222",
            "9999",
            "0A8F",
            "FFFF",
            "6666",
            "0000",
            "4222",
            "9999",
          ]
        `)
    })

    test('dyn/uuid-inline-string-family', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().equalsInsensitive('0A8F')
                .and(tIssue.externalRef.asString().notEqualsInsensitive('FFFF'))
                .and(tIssue.externalRef.asString().like('%1111%'))
                .and(tIssue.externalRef.asString().notLike('%9999%'))
                .and(tIssue.externalRef.asString().likeInsensitive('%1111%'))
                .and(tIssue.externalRef.asString().notLikeInsensitive('%9999%'))
                .and(tIssue.externalRef.asString().startsWith('0a8f'))
                .and(tIssue.externalRef.asString().notStartsWith('ffff'))
                .and(tIssue.externalRef.asString().endsWith('6666'))
                .and(tIssue.externalRef.asString().notEndsWith('0000'))
                .and(tIssue.externalRef.asString().contains('4222'))
                .and(tIssue.externalRef.asString().notContains('9999'))
                .and(tIssue.externalRef.asString().startsWithInsensitive('0A8F'))
                .and(tIssue.externalRef.asString().notStartsWithInsensitive('FFFF'))
                .and(tIssue.externalRef.asString().endsWithInsensitive('6666'))
                .and(tIssue.externalRef.asString().notEndsWithInsensitive('0000'))
                .and(tIssue.externalRef.asString().containsInsensitive('4222'))
                .and(tIssue.externalRef.asString().notContainsInsensitive('9999')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, externalRef: tIssue.externalRef })
                .withValues({ externalRef: {
                    equalsInsensitive: '0A8F', notEqualsInsensitive: 'FFFF', like: '%1111%', notLike: '%9999%',
                    likeInsensitive: '%1111%', notLikeInsensitive: '%9999%', startsWith: '0a8f', notStartsWith: 'ffff',
                    endsWith: '6666', notEndsWith: '0000', contains: '4222', notContains: '9999',
                    startsWithInsensitive: '0A8F', notStartsWithInsensitive: 'FFFF', endsWithInsensitive: '6666',
                    notEndsWithInsensitive: '0000', containsInsensitive: '4222', notContainsInsensitive: '9999',
                } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where lower(raw_to_uuid(external_ref)) = lower(:0) and lower(raw_to_uuid(external_ref)) <> lower(:1) and raw_to_uuid(external_ref) like :2 escape '\\' and raw_to_uuid(external_ref) not like :3 escape '\\' and lower(raw_to_uuid(external_ref)) like lower(:4) escape '\\' and lower(raw_to_uuid(external_ref)) not like lower(:5) escape '\\' and raw_to_uuid(external_ref) like (:6 || '%') escape '\\' and raw_to_uuid(external_ref) not like (:7 || '%') escape '\\' and raw_to_uuid(external_ref) like ('%' || :8) escape '\\' and raw_to_uuid(external_ref) not like ('%' || :9) escape '\\' and raw_to_uuid(external_ref) like ('%' || :10 || '%') escape '\\' and raw_to_uuid(external_ref) not like ('%' || :11 || '%') escape '\\' and lower(raw_to_uuid(external_ref)) like lower(:12 || '%') escape '\\' and lower(raw_to_uuid(external_ref)) not like lower(:13 || '%') escape '\\' and lower(raw_to_uuid(external_ref)) like lower('%' || :14) escape '\\' and lower(raw_to_uuid(external_ref)) not like lower('%' || :15) escape '\\' and lower(raw_to_uuid(external_ref)) like lower('%' || :16 || '%') escape '\\' and lower(raw_to_uuid(external_ref)) not like lower('%' || :17 || '%') escape '\\' order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "0A8F",
            "FFFF",
            "%1111%",
            "%9999%",
            "%1111%",
            "%9999%",
            "0a8f",
            "ffff",
            "6666",
            "0000",
            "4222",
            "9999",
            "0A8F",
            "FFFF",
            "6666",
            "0000",
            "4222",
            "9999",
          ]
        `)
    })

    test('dyn/uuid-descriptor-ifvalue-fire', async () => {
        type Filter = DynamicCondition<{ id: 'int', externalRef: 'uuid' }>
        const u1 = '0a8f9c1e-1111-4222-8333-444455556661', u2 = '0a8f9c1e-1111-4222-8333-444455556662', u3 = '0a8f9c1e-1111-4222-8333-444455556663'
        const filter: Filter = { externalRef: {
            equalsIfValue: u1, notEqualsIfValue: u2, isIfValue: u3, isNotIfValue: u1, inIfValue: [u1, u2],
            notInIfValue: [u3], lessThanIfValue: u3, lessOrEqualIfValue: u2, greaterThanIfValue: u1, greaterOrEqualIfValue: u1,
            likeIfValue: '%1111%', containsIfValue: '4222', startsWithIfValue: '0a8f', equalsInsensitiveIfValue: '0A8F',
        } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.equalsIfValue(u1)
                .and(tIssue.externalRef.notEqualsIfValue(u2))
                .and(tIssue.externalRef.isIfValue(u3))
                .and(tIssue.externalRef.isNotIfValue(u1))
                .and(tIssue.externalRef.inIfValue([u1, u2]))
                .and(tIssue.externalRef.notInIfValue([u3]))
                .and(tIssue.externalRef.lessThanIfValue(u3))
                .and(tIssue.externalRef.lessOrEqualIfValue(u2))
                .and(tIssue.externalRef.greaterThanIfValue(u1))
                .and(tIssue.externalRef.greaterOrEqualIfValue(u1))
                .and(tIssue.externalRef.asString().likeIfValue('%1111%'))
                .and(tIssue.externalRef.asString().containsIfValue('4222'))
                .and(tIssue.externalRef.asString().startsWithIfValue('0a8f'))
                .and(tIssue.externalRef.asString().equalsInsensitiveIfValue('0A8F')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, externalRef: tIssue.externalRef }).withValues(filter))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where external_ref = uuid_to_raw(:0) and external_ref <> uuid_to_raw(:1) and decode(external_ref, uuid_to_raw(:2), 1, 0 ) = 1 and decode(external_ref, uuid_to_raw(:3), 1, 0 ) = 0 and external_ref in (uuid_to_raw(:4), uuid_to_raw(:5)) and external_ref not in (uuid_to_raw(:6)) and external_ref < uuid_to_raw(:7) and external_ref <= uuid_to_raw(:8) and external_ref > uuid_to_raw(:9) and external_ref >= uuid_to_raw(:10) and raw_to_uuid(external_ref) like :11 escape '\\' and raw_to_uuid(external_ref) like ('%' || :12 || '%') escape '\\' and raw_to_uuid(external_ref) like (:13 || '%') escape '\\' and lower(raw_to_uuid(external_ref)) = lower(:14) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "%1111%",
            "4222",
            "0a8f",
            "0A8F",
          ]
        `)
    })

    test('dyn/uuid-inline-ifvalue-fire', async () => {
        const u1 = '0a8f9c1e-1111-4222-8333-444455556661', u2 = '0a8f9c1e-1111-4222-8333-444455556662', u3 = '0a8f9c1e-1111-4222-8333-444455556663'
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.equalsIfValue(u1)
                .and(tIssue.externalRef.notEqualsIfValue(u2))
                .and(tIssue.externalRef.isIfValue(u3))
                .and(tIssue.externalRef.isNotIfValue(u1))
                .and(tIssue.externalRef.inIfValue([u1, u2]))
                .and(tIssue.externalRef.notInIfValue([u3]))
                .and(tIssue.externalRef.lessThanIfValue(u3))
                .and(tIssue.externalRef.lessOrEqualIfValue(u2))
                .and(tIssue.externalRef.greaterThanIfValue(u1))
                .and(tIssue.externalRef.greaterOrEqualIfValue(u1))
                .and(tIssue.externalRef.asString().likeIfValue('%1111%'))
                .and(tIssue.externalRef.asString().containsIfValue('4222'))
                .and(tIssue.externalRef.asString().startsWithIfValue('0a8f'))
                .and(tIssue.externalRef.asString().equalsInsensitiveIfValue('0A8F')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, externalRef: tIssue.externalRef })
                .withValues({ externalRef: {
                    equalsIfValue: u1, notEqualsIfValue: u2, isIfValue: u3, isNotIfValue: u1, inIfValue: [u1, u2],
                    notInIfValue: [u3], lessThanIfValue: u3, lessOrEqualIfValue: u2, greaterThanIfValue: u1, greaterOrEqualIfValue: u1,
                    likeIfValue: '%1111%', containsIfValue: '4222', startsWithIfValue: '0a8f', equalsInsensitiveIfValue: '0A8F',
                } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from issue where external_ref = uuid_to_raw(:0) and external_ref <> uuid_to_raw(:1) and decode(external_ref, uuid_to_raw(:2), 1, 0 ) = 1 and decode(external_ref, uuid_to_raw(:3), 1, 0 ) = 0 and external_ref in (uuid_to_raw(:4), uuid_to_raw(:5)) and external_ref not in (uuid_to_raw(:6)) and external_ref < uuid_to_raw(:7) and external_ref <= uuid_to_raw(:8) and external_ref > uuid_to_raw(:9) and external_ref >= uuid_to_raw(:10) and raw_to_uuid(external_ref) like :11 escape '\\' and raw_to_uuid(external_ref) like ('%' || :12 || '%') escape '\\' and raw_to_uuid(external_ref) like (:13 || '%') escape '\\' and lower(raw_to_uuid(external_ref)) = lower(:14) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "%1111%",
            "4222",
            "0a8f",
            "0A8F",
          ]
        `)
    })

    test('dyn/uuid-ifvalue-elide', async () => {
        const maybeU: string | undefined = undefined
        const maybeNull: string | null = null
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, externalRef: tIssue.externalRef })
                .withValues({ externalRef: {
                    equalsIfValue: maybeU, lessThanIfValue: maybeNull, likeIfValue: maybeU,
                    containsIfValue: maybeNull, startsWithIfValue: undefined, equalsInsensitiveIfValue: undefined,
                } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    // -- B5 customUuid (tProjectRelease.signingKey, branded 'SigningKey') -----
    test('dyn/customuuid-descriptor-core-ops', async () => {
        type Filter = DynamicCondition<{ id: 'int', signingKey: ['customUuid', string] }>
        const u1 = '0a8f9c1e-1111-4222-8333-444455556661', u2 = '0a8f9c1e-1111-4222-8333-444455556662', u3 = '0a8f9c1e-1111-4222-8333-444455556663'
        const filter: Filter = { signingKey: { notEquals: u2, is: u3, isNot: u1, in: [u1, u2], notIn: [u3], lessThan: u3, greaterThan: u1, lessOrEqual: u2, greaterOrEqual: u1, isNull: true, isNotNull: true } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.notEquals(u2)
                .and(tProjectRelease.signingKey.is(u3))
                .and(tProjectRelease.signingKey.isNot(u1))
                .and(tProjectRelease.signingKey.in([u1, u2]))
                .and(tProjectRelease.signingKey.notIn([u3]))
                .and(tProjectRelease.signingKey.lessThan(u3))
                .and(tProjectRelease.signingKey.greaterThan(u1))
                .and(tProjectRelease.signingKey.lessOrEqual(u2))
                .and(tProjectRelease.signingKey.greaterOrEqual(u1))
                .and(tProjectRelease.signingKey.isNull())
                .and(tProjectRelease.signingKey.isNotNull()))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, signingKey: tProjectRelease.signingKey }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where signing_key <> uuid_to_raw(:0) and decode(signing_key, uuid_to_raw(:1), 1, 0 ) = 1 and decode(signing_key, uuid_to_raw(:2), 1, 0 ) = 0 and signing_key in (uuid_to_raw(:3), uuid_to_raw(:4)) and signing_key not in (uuid_to_raw(:5)) and signing_key < uuid_to_raw(:6) and signing_key > uuid_to_raw(:7) and signing_key <= uuid_to_raw(:8) and signing_key >= uuid_to_raw(:9) and signing_key is null and signing_key is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556661",
          ]
        `)
    })

    test('dyn/customuuid-inline-core-ops', async () => {
        const u1 = '0a8f9c1e-1111-4222-8333-444455556661', u2 = '0a8f9c1e-1111-4222-8333-444455556662', u3 = '0a8f9c1e-1111-4222-8333-444455556663'
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.notEquals(u2)
                .and(tProjectRelease.signingKey.is(u3))
                .and(tProjectRelease.signingKey.isNot(u1))
                .and(tProjectRelease.signingKey.in([u1, u2]))
                .and(tProjectRelease.signingKey.notIn([u3]))
                .and(tProjectRelease.signingKey.lessThan(u3))
                .and(tProjectRelease.signingKey.greaterThan(u1))
                .and(tProjectRelease.signingKey.lessOrEqual(u2))
                .and(tProjectRelease.signingKey.greaterOrEqual(u1))
                .and(tProjectRelease.signingKey.isNull())
                .and(tProjectRelease.signingKey.isNotNull()))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, signingKey: tProjectRelease.signingKey })
                .withValues({ signingKey: { notEquals: u2, is: u3, isNot: u1, in: [u1, u2], notIn: [u3], lessThan: u3, greaterThan: u1, lessOrEqual: u2, greaterOrEqual: u1, isNull: true, isNotNull: true } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where signing_key <> uuid_to_raw(:0) and decode(signing_key, uuid_to_raw(:1), 1, 0 ) = 1 and decode(signing_key, uuid_to_raw(:2), 1, 0 ) = 0 and signing_key in (uuid_to_raw(:3), uuid_to_raw(:4)) and signing_key not in (uuid_to_raw(:5)) and signing_key < uuid_to_raw(:6) and signing_key > uuid_to_raw(:7) and signing_key <= uuid_to_raw(:8) and signing_key >= uuid_to_raw(:9) and signing_key is null and signing_key is not null order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556661",
          ]
        `)
    })

    test('dyn/customuuid-descriptor-string-family', async () => {
        type Filter = DynamicCondition<{ id: 'int', signingKey: ['customUuid', string] }>
        const filter: Filter = { signingKey: {
            like: '%1111%', notLike: '%9999%', likeInsensitive: '%1111%', notLikeInsensitive: '%9999%',
            notStartsWith: 'ffff', endsWith: '6666', notEndsWith: '0000', notContains: '9999',
            startsWithInsensitive: '0A8F', notStartsWithInsensitive: 'FFFF', endsWithInsensitive: '6666',
            notEndsWithInsensitive: '0000', containsInsensitive: '4222', notContainsInsensitive: '9999',
        } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.asString().like('%1111%')
                .and(tProjectRelease.signingKey.asString().notLike('%9999%'))
                .and(tProjectRelease.signingKey.asString().likeInsensitive('%1111%'))
                .and(tProjectRelease.signingKey.asString().notLikeInsensitive('%9999%'))
                .and(tProjectRelease.signingKey.asString().notStartsWith('ffff'))
                .and(tProjectRelease.signingKey.asString().endsWith('6666'))
                .and(tProjectRelease.signingKey.asString().notEndsWith('0000'))
                .and(tProjectRelease.signingKey.asString().notContains('9999'))
                .and(tProjectRelease.signingKey.asString().startsWithInsensitive('0A8F'))
                .and(tProjectRelease.signingKey.asString().notStartsWithInsensitive('FFFF'))
                .and(tProjectRelease.signingKey.asString().endsWithInsensitive('6666'))
                .and(tProjectRelease.signingKey.asString().notEndsWithInsensitive('0000'))
                .and(tProjectRelease.signingKey.asString().containsInsensitive('4222'))
                .and(tProjectRelease.signingKey.asString().notContainsInsensitive('9999')))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, signingKey: tProjectRelease.signingKey }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where raw_to_uuid(signing_key) like :0 escape '\\' and raw_to_uuid(signing_key) not like :1 escape '\\' and lower(raw_to_uuid(signing_key)) like lower(:2) escape '\\' and lower(raw_to_uuid(signing_key)) not like lower(:3) escape '\\' and raw_to_uuid(signing_key) not like (:4 || '%') escape '\\' and raw_to_uuid(signing_key) like ('%' || :5) escape '\\' and raw_to_uuid(signing_key) not like ('%' || :6) escape '\\' and raw_to_uuid(signing_key) not like ('%' || :7 || '%') escape '\\' and lower(raw_to_uuid(signing_key)) like lower(:8 || '%') escape '\\' and lower(raw_to_uuid(signing_key)) not like lower(:9 || '%') escape '\\' and lower(raw_to_uuid(signing_key)) like lower('%' || :10) escape '\\' and lower(raw_to_uuid(signing_key)) not like lower('%' || :11) escape '\\' and lower(raw_to_uuid(signing_key)) like lower('%' || :12 || '%') escape '\\' and lower(raw_to_uuid(signing_key)) not like lower('%' || :13 || '%') escape '\\' order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "%1111%",
            "%9999%",
            "%1111%",
            "%9999%",
            "ffff",
            "6666",
            "0000",
            "9999",
            "0A8F",
            "FFFF",
            "6666",
            "0000",
            "4222",
            "9999",
          ]
        `)
    })

    test('dyn/customuuid-inline-string-family', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.asString().like('%1111%')
                .and(tProjectRelease.signingKey.asString().notLike('%9999%'))
                .and(tProjectRelease.signingKey.asString().likeInsensitive('%1111%'))
                .and(tProjectRelease.signingKey.asString().notLikeInsensitive('%9999%'))
                .and(tProjectRelease.signingKey.asString().notStartsWith('ffff'))
                .and(tProjectRelease.signingKey.asString().endsWith('6666'))
                .and(tProjectRelease.signingKey.asString().notEndsWith('0000'))
                .and(tProjectRelease.signingKey.asString().notContains('9999'))
                .and(tProjectRelease.signingKey.asString().startsWithInsensitive('0A8F'))
                .and(tProjectRelease.signingKey.asString().notStartsWithInsensitive('FFFF'))
                .and(tProjectRelease.signingKey.asString().endsWithInsensitive('6666'))
                .and(tProjectRelease.signingKey.asString().notEndsWithInsensitive('0000'))
                .and(tProjectRelease.signingKey.asString().containsInsensitive('4222'))
                .and(tProjectRelease.signingKey.asString().notContainsInsensitive('9999')))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, signingKey: tProjectRelease.signingKey })
                .withValues({ signingKey: {
                    like: '%1111%', notLike: '%9999%', likeInsensitive: '%1111%', notLikeInsensitive: '%9999%',
                    notStartsWith: 'ffff', endsWith: '6666', notEndsWith: '0000', notContains: '9999',
                    startsWithInsensitive: '0A8F', notStartsWithInsensitive: 'FFFF', endsWithInsensitive: '6666',
                    notEndsWithInsensitive: '0000', containsInsensitive: '4222', notContainsInsensitive: '9999',
                } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where raw_to_uuid(signing_key) like :0 escape '\\' and raw_to_uuid(signing_key) not like :1 escape '\\' and lower(raw_to_uuid(signing_key)) like lower(:2) escape '\\' and lower(raw_to_uuid(signing_key)) not like lower(:3) escape '\\' and raw_to_uuid(signing_key) not like (:4 || '%') escape '\\' and raw_to_uuid(signing_key) like ('%' || :5) escape '\\' and raw_to_uuid(signing_key) not like ('%' || :6) escape '\\' and raw_to_uuid(signing_key) not like ('%' || :7 || '%') escape '\\' and lower(raw_to_uuid(signing_key)) like lower(:8 || '%') escape '\\' and lower(raw_to_uuid(signing_key)) not like lower(:9 || '%') escape '\\' and lower(raw_to_uuid(signing_key)) like lower('%' || :10) escape '\\' and lower(raw_to_uuid(signing_key)) not like lower('%' || :11) escape '\\' and lower(raw_to_uuid(signing_key)) like lower('%' || :12 || '%') escape '\\' and lower(raw_to_uuid(signing_key)) not like lower('%' || :13 || '%') escape '\\' order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "%1111%",
            "%9999%",
            "%1111%",
            "%9999%",
            "ffff",
            "6666",
            "0000",
            "9999",
            "0A8F",
            "FFFF",
            "6666",
            "0000",
            "4222",
            "9999",
          ]
        `)
    })

    test('dyn/customuuid-descriptor-ifvalue-fire', async () => {
        type Filter = DynamicCondition<{ id: 'int', signingKey: ['customUuid', string] }>
        const u1 = '0a8f9c1e-1111-4222-8333-444455556661', u2 = '0a8f9c1e-1111-4222-8333-444455556662', u3 = '0a8f9c1e-1111-4222-8333-444455556663'
        const filter: Filter = { signingKey: {
            equalsIfValue: u1, notEqualsIfValue: u2, isIfValue: u3, isNotIfValue: u1, inIfValue: [u1, u2],
            notInIfValue: [u3], lessThanIfValue: u3, lessOrEqualIfValue: u2, greaterThanIfValue: u1, greaterOrEqualIfValue: u1,
            likeIfValue: '%1111%', containsInsensitiveIfValue: '4222', notStartsWithIfValue: 'ffff', notEqualsInsensitiveIfValue: 'FFFF',
        } }
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.equalsIfValue(u1)
                .and(tProjectRelease.signingKey.notEqualsIfValue(u2))
                .and(tProjectRelease.signingKey.isIfValue(u3))
                .and(tProjectRelease.signingKey.isNotIfValue(u1))
                .and(tProjectRelease.signingKey.inIfValue([u1, u2]))
                .and(tProjectRelease.signingKey.notInIfValue([u3]))
                .and(tProjectRelease.signingKey.lessThanIfValue(u3))
                .and(tProjectRelease.signingKey.lessOrEqualIfValue(u2))
                .and(tProjectRelease.signingKey.greaterThanIfValue(u1))
                .and(tProjectRelease.signingKey.greaterOrEqualIfValue(u1))
                .and(tProjectRelease.signingKey.asString().likeIfValue('%1111%'))
                .and(tProjectRelease.signingKey.asString().containsInsensitiveIfValue('4222'))
                .and(tProjectRelease.signingKey.asString().notStartsWithIfValue('ffff'))
                .and(tProjectRelease.signingKey.asString().notEqualsInsensitiveIfValue('FFFF')))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, signingKey: tProjectRelease.signingKey }).withValues(filter))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where signing_key = uuid_to_raw(:0) and signing_key <> uuid_to_raw(:1) and decode(signing_key, uuid_to_raw(:2), 1, 0 ) = 1 and decode(signing_key, uuid_to_raw(:3), 1, 0 ) = 0 and signing_key in (uuid_to_raw(:4), uuid_to_raw(:5)) and signing_key not in (uuid_to_raw(:6)) and signing_key < uuid_to_raw(:7) and signing_key <= uuid_to_raw(:8) and signing_key > uuid_to_raw(:9) and signing_key >= uuid_to_raw(:10) and raw_to_uuid(signing_key) like :11 escape '\\' and lower(raw_to_uuid(signing_key)) like lower('%' || :12 || '%') escape '\\' and raw_to_uuid(signing_key) not like (:13 || '%') escape '\\' and lower(raw_to_uuid(signing_key)) <> lower(:14) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "%1111%",
            "4222",
            "ffff",
            "FFFF",
          ]
        `)
    })

    test('dyn/customuuid-inline-ifvalue-fire', async () => {
        const u1 = '0a8f9c1e-1111-4222-8333-444455556661', u2 = '0a8f9c1e-1111-4222-8333-444455556662', u3 = '0a8f9c1e-1111-4222-8333-444455556663'
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.equalsIfValue(u1)
                .and(tProjectRelease.signingKey.notEqualsIfValue(u2))
                .and(tProjectRelease.signingKey.isIfValue(u3))
                .and(tProjectRelease.signingKey.isNotIfValue(u1))
                .and(tProjectRelease.signingKey.inIfValue([u1, u2]))
                .and(tProjectRelease.signingKey.notInIfValue([u3]))
                .and(tProjectRelease.signingKey.lessThanIfValue(u3))
                .and(tProjectRelease.signingKey.lessOrEqualIfValue(u2))
                .and(tProjectRelease.signingKey.greaterThanIfValue(u1))
                .and(tProjectRelease.signingKey.greaterOrEqualIfValue(u1))
                .and(tProjectRelease.signingKey.asString().likeIfValue('%1111%'))
                .and(tProjectRelease.signingKey.asString().containsInsensitiveIfValue('4222'))
                .and(tProjectRelease.signingKey.asString().notStartsWithIfValue('ffff'))
                .and(tProjectRelease.signingKey.asString().notEqualsInsensitiveIfValue('FFFF')))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, signingKey: tProjectRelease.signingKey })
                .withValues({ signingKey: {
                    equalsIfValue: u1, notEqualsIfValue: u2, isIfValue: u3, isNotIfValue: u1, inIfValue: [u1, u2],
                    notInIfValue: [u3], lessThanIfValue: u3, lessOrEqualIfValue: u2, greaterThanIfValue: u1, greaterOrEqualIfValue: u1,
                    likeIfValue: '%1111%', containsInsensitiveIfValue: '4222', notStartsWithIfValue: 'ffff', notEqualsInsensitiveIfValue: 'FFFF',
                } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as "id" from project_release where signing_key = uuid_to_raw(:0) and signing_key <> uuid_to_raw(:1) and decode(signing_key, uuid_to_raw(:2), 1, 0 ) = 1 and decode(signing_key, uuid_to_raw(:3), 1, 0 ) = 0 and signing_key in (uuid_to_raw(:4), uuid_to_raw(:5)) and signing_key not in (uuid_to_raw(:6)) and signing_key < uuid_to_raw(:7) and signing_key <= uuid_to_raw(:8) and signing_key > uuid_to_raw(:9) and signing_key >= uuid_to_raw(:10) and raw_to_uuid(signing_key) like :11 escape '\\' and lower(raw_to_uuid(signing_key)) like lower('%' || :12 || '%') escape '\\' and raw_to_uuid(signing_key) not like (:13 || '%') escape '\\' and lower(raw_to_uuid(signing_key)) <> lower(:14) order by "id""`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556663",
            "0a8f9c1e-1111-4222-8333-444455556662",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "0a8f9c1e-1111-4222-8333-444455556661",
            "%1111%",
            "4222",
            "ffff",
            "FFFF",
          ]
        `)
    })

    test('dyn/customuuid-ifvalue-elide', async () => {
        const maybeU: string | undefined = undefined
        const maybeNull: string | null = null
        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ id: tProjectRelease.id, signingKey: tProjectRelease.signingKey })
                .withValues({ signingKey: {
                    equalsIfValue: maybeU, lessThanIfValue: maybeNull, likeIfValue: maybeU,
                    containsInsensitiveIfValue: maybeNull, notStartsWithIfValue: undefined, notEqualsInsensitiveIfValue: undefined,
                } }))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from project_release order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })
})
