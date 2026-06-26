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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where priority = $1 and priority <> $2 order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where priority is not distinct from $1 and status is distinct from $2 order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where priority in ($1, $2) and priority not in ($3) order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where priority > $1 and priority < $2 and priority >= $3 and priority <= $4 order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where not body is null and not body is not null order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where lower(title) = lower($1) and lower(title) <> lower($2) order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where title like $1 and title not like $2 and title ilike $3 and title not ilike $4 order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where title like ($1 || '%') and title not like ($2 || '%') and title like ('%' || $3) and title not like ('%' || $4) and title like ('%' || $5 || '%') and title not like ('%' || $6 || '%') order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where title ilike ($1 || '%') and title not ilike ($2 || '%') and title ilike ('%' || $3) and title not ilike ('%' || $4) and title ilike ('%' || $5 || '%') and title not ilike ('%' || $6 || '%') order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where priority = $1 order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours > $1 order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where created_at >= $1 order by id"`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "2020-01-01T00:00:00.000Z",
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where view_count > $1 order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from project where (published = 't') = $1 order by id"`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            true,
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref::text ilike ('%' || $1 || '%') order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where status = $1 and priority = $2 order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where status = $1 or priority = $2 order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where not (status = $1) order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where priority = $1 and priority <> $2 and priority is not distinct from $3 and priority is distinct from $4 and priority in ($5, $6) and priority not in ($7) order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where priority < $1 and priority > $2 and priority <= $3 and priority >= $4 order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where lower(title) = lower($1) and lower(title) <> lower($2) and title like $3 and title not like $4 and title ilike $5 and title not ilike $6 order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where title like ($1 || '%') and title not like ($2 || '%') and title like ('%' || $3) and title not like ('%' || $4) and title like ('%' || $5 || '%') and title not like ('%' || $6 || '%') order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where title ilike ($1 || '%') and title not ilike ($2 || '%') and title ilike ('%' || $3) and title not ilike ('%' || $4) and title ilike ('%' || $5 || '%') and title not ilike ('%' || $6 || '%') order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where status = $1 and status in ($2, $3) and status <> $4 order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from project_release where version > $1 and version < $2 and version = $3 order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from project_release where signing_key = $1 and signing_key::text like ('%' || $2 || '%') and signing_key::text like ($3 || '%') order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where work_date >= $1 and work_date < $2 order by id"`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "2024-03-01T00:00:00.000Z",
            "2024-03-31T00:00:00.000Z",
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where started_at >= $1 and started_at < $2 order by id"`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "09:00:00",
            "17:00:00",
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from project_release where version <= $1 and version in ($2, $3) order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from project_release where channel <> $1 and channel in ($2, $3) order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where body is not distinct from $1 and estimated_hours is distinct from $2 order by id"`)
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on >= $1 and released_on < $2 order by id"`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "2024-01-01T10:00:00.000Z",
            "2024-12-31T10:00:00.000Z",
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time >= $1 and cutoff_time < $2 order by id"`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "09:00:00",
            "20:00:00",
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
        expect(refSql).toMatchInlineSnapshot(`"select id as id from project_release where signed_off_at >= $1 and signed_off_at < $2 order by id"`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "2024-01-01T00:00:00.000Z",
            "2024-12-31T00:00:00.000Z",
          ]
        `)
    })

    test('equivalence/custom-double-descriptor-dispatch', async () => {
        // the `['customDouble', T]` descriptor maps to CustomDoubleFilter. There
        // is no filterable customDouble column in the domain (Money is only
        // produced by executeFunction), so a customDouble const value source
        // ('Money') stands in as the dynamicConditionFor field — enough to prove
        // the CustomDoubleFilter dispatch reaches the comparable operators
        // identically to the direct calls.
        const amount = ctx.conn.const(5, 'customDouble', 'Money')
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(amount.greaterThan(3).and(amount.lessThan(9)))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ id: tIssue.id, amount })
                .withValues({ amount: { greaterThan: 3, lessThan: 9 } }))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where $1 > $2 and $3 < $4 order by id"`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            5,
            3,
            5,
            9,
          ]
        `)
    })
})
