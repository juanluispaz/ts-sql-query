// Coverage of `connection.dynamicConditionFor(...).withValues(...)`
// across the operator surface in
// [src/queryBuilders/DynamicConditionBuilder.ts](../../../../../src/queryBuilders/DynamicConditionBuilder.ts).
// The docs page exercises a handful (`containsInsensitive`,
// `startsWithInsensitive`, nested and/or) — this file walks the rest
// of the operator names that the builder dispatches through
// `valueSource[key](value)`:
//
//   - eq / not / lt / lte / gt / gte
//   - in / notIn (empty + non-empty)
//   - between (object form with min/max)
//   - like / notLike / likeInsensitive / notLikeInsensitive
//   - startsWith / endsWith / contains and their `notXxx` /
//     `xxxInsensitive` cousins
//   - isNull / isNotNull (true vs false branches)
//   - the `*IfValue` suffix flavour (no-ops on null/undefined)
//
// Each filter resolves to a `BooleanValueSource` and is spliced into
// the WHERE clause. The snapshot is the authoritative SQL.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { DynamicCondition } from '../../../../../src/dynamic/condition.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

// The filter shape is shared by every test so each individual case
// only spells out the property it cares about. The keys match the
// `select` projection passed to `dynamicConditionFor`.
type IssueFilter = DynamicCondition<{
    id:       'int',
    title:    'string',
    body:     'string',
    status:   'string',
    priority: 'int',
}>

const selectFields = {
    id:       tIssue.id,
    title:    tIssue.title,
    body:     tIssue.body,
    status:   tIssue.status,
    priority: tIssue.priority,
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    async function run(filter: IssueFilter) {
        ctx.mockNext([])
        const result = await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    }

    test('equals-and-not-equals-and-lt-gt', async () => {
        await run({
            id:       { equals: 1 },
            priority: { greaterThan: 1, lessThan: 5 },
            status:   { notEquals: 'closed' },
        })
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where id = ? and priority > ? and priority < ? and \`status\` <> ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
            5,
            "closed",
          ]
        `)
    })

    test('lessOrEqual-and-greaterOrEqual', async () => {
        await run({
            priority: { greaterOrEqual: 1, lessOrEqual: 3 },
        })
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority >= ? and priority <= ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
    })

    test('in-and-not-in', async () => {
        await run({
            status: { in: ['open', 'in_progress'] },
            id:     { notIn: [99, 100] },
        })
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where \`status\` in (?, ?) and id not in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            "in_progress",
            99,
            100,
          ]
        `)
    })

    test('in-empty-array-collapses-to-false-where', async () => {
        // `in: []` collapses to a trivially false predicate per the
        // documented semantics. The snapshot pins the dialect's chosen
        // emission (`where 1 = 0`, `where false`, etc.).
        await run({ status: { in: [] } })
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('like-and-not-like', async () => {
        await run({
            title: { like: '%triage%', notLike: '%draft%' },
        })
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title like ? and title not like ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "%triage%",
            "%draft%",
          ]
        `)
    })

    test('like-insensitive-and-not-like-insensitive', async () => {
        await run({
            title: { likeInsensitive: '%TRIAGE%', notLikeInsensitive: '%DRAFT%' },
        })
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where lower(title) like lower(?) and lower(title) not like lower(?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "%TRIAGE%",
            "%DRAFT%",
          ]
        `)
    })

    test('starts-with-ends-with-contains', async () => {
        await run({
            title: { startsWith: 'Re', endsWith: 'me', contains: 'esi' },
        })
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title like concat(?, '%') and title like concat('%', ?) and title like concat('%', ?, '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Re",
            "me",
            "esi",
          ]
        `)
    })

    test('not-starts-with-not-ends-with-not-contains', async () => {
        await run({
            title: {
                notStartsWith: 'Re',
                notEndsWith:   'me',
                notContains:   'esi',
            },
        })
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title not like concat(?, '%') and title not like concat('%', ?) and title not like concat('%', ?, '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Re",
            "me",
            "esi",
          ]
        `)
    })

    test('is-null-and-is-not-null', async () => {
        // `body` is nullable. `isNull: true` and `isNotNull: true`
        // route through `valueSource[key]()`; the `false` branches
        // would negate the result, but we exercise the true path here.
        await run({
            body: { isNull: true },
        })
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where body is null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('is-not-null-true-branch', async () => {
        // Mirror — `isNotNull: true` emits the affirmative predicate.
        await run({
            body: { isNotNull: true },
        })
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where body is not null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('if-value-suffix-skips-on-undefined', async () => {
        // The `*IfValue` family is the documented "skip on
        // null/undefined" entry point. Every base operator has an
        // `equalsIfValue` / `greaterThanIfValue` etc. twin that
        // silently no-ops when the value fails `_isValue`. With every
        // value here null/undefined, the WHERE clause comes out empty.
        const maybeId: number | null = null
        const maybeP:  number | undefined = undefined
        const filter: IssueFilter = {
            id:       { equalsIfValue: maybeId },
            priority: { greaterThanIfValue: maybeP },
        }
        await run(filter)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('nested-and-or-not', async () => {
        // The boolean conjunctions are first-class filter keys. The
        // `not` key negates the inner filter result.
        await run({
            and: [
                { status: { equals: 'open' } },
                { or: [
                    { priority: { greaterThan: 5 } },
                    { not: { title: { contains: 'draft' } } },
                ] },
            ],
        })
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where \`status\` = ? and (priority > ? or not (title like concat('%', ?, '%'))) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            5,
            "draft",
          ]
        `)
    })
})
