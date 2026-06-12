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

type IssueFilter = DynamicCondition<{
    id:             'int',
    title:          'string',
    body:           'string',
    status:         'string',
    priority:       'int',
    viewCount:      'bigint',
    estimatedHours: 'double',
    externalRef:    'uuid',
    createdAt:      'localDateTime',
}>

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

    // Capture the SQL + params a query emits through the interceptor.
    async function capture(run: () => Promise<unknown>): Promise<{ sql: string; params: unknown[] }> {
        ctx.mockNext([])
        await run()
        return { sql: ctx.lastSql, params: ctx.lastParams }
    }

    // The dynamic half: the filter object routed through the builder.
    function dyn(filter: IssueFilter): Promise<unknown> {
        return ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
    }

    test('equivalence/equals-and-not-equals', async () => {
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.equals(2).and(tIssue.priority.notEquals(5)))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({ priority: { equals: 2, notEquals: 5 } }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where priority = ? and priority <> ? order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
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
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.is(2).and(tIssue.status.isNot('closed')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({ priority: { is: 2 }, status: { isNot: 'closed' } }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where priority <=> ? and not (status <=> ?) order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
          [
            2,
            "closed",
          ]
        `)
    })

    test('equivalence/in-and-not-in', async () => {
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.in([1, 2]).and(tIssue.priority.notIn([9])))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({ priority: { in: [1, 2], notIn: [9] } }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where priority in (?, ?) and priority not in (?) order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
          [
            1,
            2,
            9,
          ]
        `)
    })

    test('equivalence/comparable-operators', async () => {
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.greaterThan(1)
                .and(tIssue.priority.lessThan(9))
                .and(tIssue.priority.greaterOrEqual(2))
                .and(tIssue.priority.lessOrEqual(8)))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({
            priority: { greaterThan: 1, lessThan: 9, greaterOrEqual: 2, lessOrEqual: 8 },
        }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where priority > ? and priority < ? and priority >= ? and priority <= ? order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
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
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.body.isNull().negate().and(tIssue.body.isNotNull().negate()))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({ body: { isNull: false, isNotNull: false } }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where not \`body\` is null and not \`body\` is not null order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`[]`)
    })

    test('equivalence/equals-insensitive-and-not-equals-insensitive', async () => {
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.equalsInsensitive('Triage').and(tIssue.title.notEqualsInsensitive('Draft')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({
            title: { equalsInsensitive: 'Triage', notEqualsInsensitive: 'Draft' },
        }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where lower(title) = lower(?) and lower(title) <> lower(?) order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
          [
            "Triage",
            "Draft",
          ]
        `)
    })

    test('equivalence/like-family', async () => {
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.like('%a%')
                .and(tIssue.title.notLike('%b%'))
                .and(tIssue.title.likeInsensitive('%C%'))
                .and(tIssue.title.notLikeInsensitive('%D%')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({
            title: { like: '%a%', notLike: '%b%', likeInsensitive: '%C%', notLikeInsensitive: '%D%' },
        }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where title like ? and title not like ? and lower(title) like lower(?) and lower(title) not like lower(?) order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
          [
            "%a%",
            "%b%",
            "%C%",
            "%D%",
          ]
        `)
    })

    test('equivalence/affix-sensitive', async () => {
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.startsWith('Re')
                .and(tIssue.title.notStartsWith('Un'))
                .and(tIssue.title.endsWith('me'))
                .and(tIssue.title.notEndsWith('xx'))
                .and(tIssue.title.contains('esi'))
                .and(tIssue.title.notContains('zzz')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({
            title: {
                startsWith: 'Re', notStartsWith: 'Un',
                endsWith: 'me', notEndsWith: 'xx',
                contains: 'esi', notContains: 'zzz',
            },
        }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where title like concat(?, '%') and title not like concat(?, '%') and title like concat('%', ?) and title not like concat('%', ?) and title like concat('%', ?, '%') and title not like concat('%', ?, '%') order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
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
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.startsWithInsensitive('Re')
                .and(tIssue.title.notStartsWithInsensitive('Un'))
                .and(tIssue.title.endsWithInsensitive('me'))
                .and(tIssue.title.notEndsWithInsensitive('xx'))
                .and(tIssue.title.containsInsensitive('esi'))
                .and(tIssue.title.notContainsInsensitive('zzz')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({
            title: {
                startsWithInsensitive: 'Re', notStartsWithInsensitive: 'Un',
                endsWithInsensitive: 'me', notEndsWithInsensitive: 'xx',
                containsInsensitive: 'esi', notContainsInsensitive: 'zzz',
            },
        }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where lower(title) like concat(lower(?), '%') and lower(title) not like concat(lower(?), '%') and lower(title) like concat('%', lower(?)) and lower(title) not like concat('%', lower(?)) and lower(title) like concat('%', lower(?), '%') and lower(title) not like concat('%', lower(?), '%') order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
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
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.equalsIfValue(7))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({ priority: { equalsIfValue: 7 } }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where priority = ? order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
          [
            7,
          ]
        `)
    })

    test('equivalence/double-column-dispatch', async () => {
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.estimatedHours.greaterThan(2.5))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({ estimatedHours: { greaterThan: 2.5 } }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours > ? order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
          [
            2.5,
          ]
        `)
    })

    test('equivalence/datetime-column-dispatch', async () => {
        const since = new Date('2020-01-01T00:00:00.000Z')
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.createdAt.greaterOrEqual(since))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({ createdAt: { greaterOrEqual: since } }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where created_at >= ? order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
          [
            2020-01-01T00:00:00.000Z,
          ]
        `)
    })

    test('equivalence/bigint-column-dispatch', async () => {
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.viewCount.greaterThan(10n))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({ viewCount: { greaterThan: 10n } }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where view_count > ? order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
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

        const ref = await capture(() => ctx.conn.selectFrom(tProject)
            .where(tProject.published.equals(true))
            .select({ id: tProject.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => ctx.conn.selectFrom(tProject)
            .where(ctx.conn.dynamicConditionFor(projectFields).withValues(filter))
            .select({ id: tProject.id }).orderBy('id').executeSelectMany())

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from project where (published = 't') = ? order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
    })

    test('equivalence/uuid-as-string-operator-path', async () => {
        // For the like/insensitive operator family the builder rewrites a
        // uuid value source through `.asString()` before dispatching
        // (useAsStringInUuid). The reference spells that rewrite out.
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().containsInsensitive('abc'))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({ externalRef: { containsInsensitive: 'abc' } }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where lower(external_ref) like concat('%', lower(?), '%') order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
          [
            "abc",
          ]
        `)
    })

    test('equivalence/and-combinator', async () => {
        // `{ and: [A, B] }` is the array conjunction — equivalent to the
        // direct `A.and(B)`.
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equals('open').and(tIssue.priority.equals(3)))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({ and: [{ status: { equals: 'open' } }, { priority: { equals: 3 } }] }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where status = ? and priority = ? order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
          [
            "open",
            3,
          ]
        `)
    })

    test('equivalence/or-combinator', async () => {
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equals('open').or(tIssue.priority.equals(3)))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({ or: [{ status: { equals: 'open' } }, { priority: { equals: 3 } }] }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where status = ? or priority = ? order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
          [
            "open",
            3,
          ]
        `)
    })

    test('equivalence/not-combinator', async () => {
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equals('closed').negate())
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({ not: { status: { equals: 'closed' } } }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where not (status = ?) order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
          [
            "closed",
          ]
        `)
    })

    test('equivalence/if-value-equalable-family', async () => {
        // Every equalable `*IfValue` operator paired against its direct
        // `.xxxIfValue` twin; with present values each emits its predicate.
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.equalsIfValue(2)
                .and(tIssue.priority.notEqualsIfValue(3))
                .and(tIssue.priority.isIfValue(4))
                .and(tIssue.priority.isNotIfValue(5))
                .and(tIssue.priority.inIfValue([1, 2]))
                .and(tIssue.priority.notInIfValue([9])))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({
            priority: {
                equalsIfValue: 2, notEqualsIfValue: 3,
                isIfValue: 4, isNotIfValue: 5,
                inIfValue: [1, 2], notInIfValue: [9],
            },
        }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where priority = ? and priority <> ? and priority <=> ? and not (priority <=> ?) and priority in (?, ?) and priority not in (?) order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
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
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.lessThanIfValue(9)
                .and(tIssue.priority.greaterThanIfValue(1))
                .and(tIssue.priority.lessOrEqualIfValue(8))
                .and(tIssue.priority.greaterOrEqualIfValue(2)))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({
            priority: {
                lessThanIfValue: 9, greaterThanIfValue: 1,
                lessOrEqualIfValue: 8, greaterOrEqualIfValue: 2,
            },
        }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where priority < ? and priority > ? and priority <= ? and priority >= ? order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
          [
            9,
            1,
            8,
            2,
          ]
        `)
    })

    test('equivalence/if-value-string-equality-and-like-family', async () => {
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.equalsInsensitiveIfValue('Foo')
                .and(tIssue.title.notEqualsInsensitiveIfValue('Bar'))
                .and(tIssue.title.likeIfValue('%a%'))
                .and(tIssue.title.notLikeIfValue('%b%'))
                .and(tIssue.title.likeInsensitiveIfValue('%C%'))
                .and(tIssue.title.notLikeInsensitiveIfValue('%D%')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({
            title: {
                equalsInsensitiveIfValue: 'Foo', notEqualsInsensitiveIfValue: 'Bar',
                likeIfValue: '%a%', notLikeIfValue: '%b%',
                likeInsensitiveIfValue: '%C%', notLikeInsensitiveIfValue: '%D%',
            },
        }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where lower(title) = lower(?) and lower(title) <> lower(?) and title like ? and title not like ? and lower(title) like lower(?) and lower(title) not like lower(?) order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
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
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.startsWithIfValue('Re')
                .and(tIssue.title.notStartsWithIfValue('Un'))
                .and(tIssue.title.endsWithIfValue('me'))
                .and(tIssue.title.notEndsWithIfValue('xx'))
                .and(tIssue.title.containsIfValue('esi'))
                .and(tIssue.title.notContainsIfValue('zzz')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({
            title: {
                startsWithIfValue: 'Re', notStartsWithIfValue: 'Un',
                endsWithIfValue: 'me', notEndsWithIfValue: 'xx',
                containsIfValue: 'esi', notContainsIfValue: 'zzz',
            },
        }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where title like concat(?, '%') and title not like concat(?, '%') and title like concat('%', ?) and title not like concat('%', ?) and title like concat('%', ?, '%') and title not like concat('%', ?, '%') order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
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
        const ref = await capture(() => ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.startsWithInsensitiveIfValue('Re')
                .and(tIssue.title.notStartsWithInsensitiveIfValue('Un'))
                .and(tIssue.title.endsWithInsensitiveIfValue('me'))
                .and(tIssue.title.notEndsWithInsensitiveIfValue('xx'))
                .and(tIssue.title.containsInsensitiveIfValue('esi'))
                .and(tIssue.title.notContainsInsensitiveIfValue('zzz')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const dynamic = await capture(() => dyn({
            title: {
                startsWithInsensitiveIfValue: 'Re', notStartsWithInsensitiveIfValue: 'Un',
                endsWithInsensitiveIfValue: 'me', notEndsWithInsensitiveIfValue: 'xx',
                containsInsensitiveIfValue: 'esi', notContainsInsensitiveIfValue: 'zzz',
            },
        }))

        expect(dynamic.sql).toBe(ref.sql)
        expect(dynamic.params).toEqual(ref.params)
        expect(ref.sql).toMatchInlineSnapshot(`"select id as id from issue where lower(title) like concat(lower(?), '%') and lower(title) not like concat(lower(?), '%') and lower(title) like concat('%', lower(?)) and lower(title) not like concat('%', lower(?)) and lower(title) like concat('%', lower(?), '%') and lower(title) not like concat('%', lower(?), '%') order by id"`)
        expect(ref.params).toMatchInlineSnapshot(`
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
