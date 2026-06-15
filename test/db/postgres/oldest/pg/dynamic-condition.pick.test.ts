// Coverage of the `dynamicPick` / `expandType*` utilities that the
// existing docs.* and `dynamic-condition.pick-paths.test.ts` files do not
// reach:
//
//   - `dynamicPick` with a NESTED object pick (`{ meta: { priority: true } }`)
// drives `internalDynamicPick` — every documented `dynamicPick`
//     example uses a FLAT pick, so the recursion was never exercised.
//   - `dynamicPickPaths` against a DEPTH-3 `availableFields` with an
//     `a.b.c` path drives `internalDynamicPickPaths`' own recursion
// the sibling pick-paths file only goes two levels deep.
// `expandTypeProjectedAsNullableFromDynamicPickPaths` — the
//     nullable-projection sibling of the already-covered
//     `expandTypeFromDynamicPickPaths`; a runtime passthrough whose value is
//     the reshaped result TYPE.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { dynamicPick, dynamicPickPaths, expandTypeProjectedAsNullableFromDynamicPickPaths } from '../../../../../src/dynamic/pick.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('pick/nested-dynamic-pick-keeps-only-chosen-leaf', async () => {
        const expected = [{ id: 1, meta: { priority: 2 } }]
        ctx.mockNext(expected)
        const availableFields = {
            id:    tIssue.id,
            title: tIssue.title,
            meta: {
                priority: tIssue.priority,
                status:   tIssue.status,
            },
        }
        // Nested object pick: keep only `meta.priority`, drop `meta.status`
        // and the un-picked top-level `title`. `id` is mandatory.
        const picked = dynamicPick(availableFields, { meta: { priority: true } }, ['id'])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as "meta.priority" from issue where id = $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:     number
            title?: string
            meta?:  { priority?: number; status?: string }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('pick/nested-dynamic-pick-paths-depth-3', async () => {
        // A 3-level path forces `internalDynamicPickPaths` to recurse into
        // itself (group -> sub -> priority) and keep the deep leaf.
        const expected = [{ id: 1, group: { sub: { priority: 2 } } }]
        ctx.mockNext(expected)
        const availableFields = {
            id: tIssue.id,
            group: {
                sub: {
                    priority: tIssue.priority,
                    status:   tIssue.status,
                },
            },
        }
        const picked = dynamicPickPaths(availableFields, ['group.sub.priority'], ['id'])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as "group.sub.priority" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:     number
            group?: { sub?: { priority?: number; status?: string } | null }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('pick/nested-dynamic-pick-depth-3', async () => {
        // dynamicPick's OWN deep recursion (internalDynamicPick calling
        // itself) — the 3-level analogue of the depth-3 dynamicPickPaths
        // above. Unlike dynamicPickPaths, internalDynamicPick sets its
        // `hasContent` flag correctly, so the deep leaf survives and
        // this works as intended.
        const expected = [{ id: 1, group: { sub: { priority: 2 } } }]
        ctx.mockNext(expected)
        const availableFields = {
            id: tIssue.id,
            group: {
                sub: {
                    priority: tIssue.priority,
                    status:   tIssue.status,
                },
            },
        }
        const picked = dynamicPick(availableFields, { group: { sub: { priority: true } } }, ['id'])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as "group.sub.priority" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:     number
            group?: { sub?: { priority?: number; status?: string } | null }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('pick/nested-mandatory-path-keeps-deep-leaf', async () => {
        // A mandatory path that points INTO a nested object
        // (`'meta.priority'`) is kept even though the pick only selects
        // `meta.status` — exercises internalDynamicPick's
        // `(prefix + '.' + prop) in required` branch (the nested-mandatory
        // arm, distinct from the top-level mandatory used elsewhere).
        const expected = [{ id: 1, meta: { priority: 2, status: 'open' } }]
        ctx.mockNext(expected)
        const availableFields = {
            id: tIssue.id,
            meta: {
                priority: tIssue.priority,
                status:   tIssue.status,
            },
        }
        const picked = dynamicPick(availableFields, { meta: { status: true } }, ['id', 'meta.priority'])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as "meta.priority", status as "meta.status" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:   number
            meta: { priority: number; status: string }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('pick/nested-pick-selecting-nothing-drops-branch', async () => {
        // When a nested pick object selects none of its leaves,
        // internalDynamicPick finds no content and returns `undefined`, so
        // the parent drops the whole `meta` branch — only `id` survives.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const availableFields = {
            id: tIssue.id,
            meta: {
                priority: tIssue.priority,
                status:   tIssue.status,
            },
        }
        const picked = dynamicPick(availableFields, { meta: { priority: false, status: false } }, ['id'])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:    number
            meta?: { priority?: number; status?: string }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('pick/expand-type-projected-as-nullable-passthrough', async () => {
        // Runtime passthrough: the helper returns its `result` argument
        // unchanged; the value it adds is the nullable-projected TYPE. The
        // call type-checking is the real assertion (it would not compile if
        // the generic reshape were broken); the runtime check pins the
        // passthrough.
        const availableFields = {
            id:    tIssue.id,
            title: tIssue.title,
            meta: {
                priority: tIssue.priority,
            },
        }
        const rows = [{ id: 1, meta: { priority: 2 } }]
        const expanded = expandTypeProjectedAsNullableFromDynamicPickPaths(
            availableFields, ['meta.priority'], rows, ['id'])

        expect(expanded).toBe(rows)
        expect(expanded).toEqual([{ id: 1, meta: { priority: 2 } }])
    })
})
