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
import { assertType, type Exact, type Extends } from '../../../../lib/assertType.js'
import { dynamicPick, dynamicPickPaths, expandTypeFromDynamicPickPaths, expandTypeProjectedAsNullableFromDynamicPickPaths } from '../../../../../src/dynamic/pick.js'
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as "meta.priority" from issue where id = ? order by id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as "group.sub.priority" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:     number
            group?: { sub?: { priority?: number; status?: string } | undefined }
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as "group.sub.priority" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:     number
            group?: { sub?: { priority?: number; status?: string } | undefined }
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as "meta.priority", status as "meta.status" from issue where id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where id = ?"`)
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
        // unchanged and only reshapes the TYPE. The `assertType` pins that
        // reshape so a regression in the projected type can't pass silently.
        // (`Extends`, not `Exact`: the reshaped type is an intersection that
        // `Exact` does not reduce.)
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

        assertType<Extends<typeof expanded, Array<{
            id:     number
            title?: string
            meta?:  { priority?: number }
        }>>>()
        expect(expanded).toBe(rows)
        expect(expanded).toEqual([{ id: 1, meta: { priority: 2 } }])
    })

    test('pick/expand-type-projected-as-nullable-shows-null-leaf', async () => {
        // An OPTIONAL picked leaf is projected as a present `T | null` (not
        // `?: T`). `body` is an optional column, so the reshaped type carries
        // `body: string | null`.
        const availableFields = { id: tIssue.id, body: tIssue.body }
        const rows = [{ id: 1, body: null }, { id: 2, body: 'Use new tokens' }]
        const expanded = expandTypeProjectedAsNullableFromDynamicPickPaths(
            availableFields, ['body'], rows, ['id'])

        assertType<Extends<typeof expanded, Array<{ id: number; body: string | null }>>>()
        expect(expanded).toBe(rows)
        expect(expanded).toEqual([{ id: 1, body: null }, { id: 2, body: 'Use new tokens' }])
    })

    test('pick/expand-type-from-page-paths', async () => {
        // Piping an `executeSelectPage()` result through the helper: `count`
        // is preserved and the `data` rows are reshaped to the picked type.
        const availableFields = { id: tIssue.id, title: tIssue.title, body: tIssue.body }
        const picked = dynamicPickPaths(availableFields, ['title'], ['id'])

        ctx.mockNext([{ id: 1, title: 'Update hero copy' }])
        ctx.mockNext(1)
        const page = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .limit(10)
            .offset(0)
            .executeSelectPage()
        const expanded = expandTypeFromDynamicPickPaths(availableFields, ['title'], page, ['id'])

        assertType<Extends<typeof expanded, {
            data:  Array<{ id: number; title?: string; body?: string }>
            count: number
        }>>()
        // Runtime passthrough: the helper returns its `result` argument as-is.
        expect(expanded).toBe(page)
        expect(expanded.count).toBe(1)
        expect(expanded.data).toEqual([{ id: 1, title: 'Update hero copy' }])
    })

    test('pick/expand-type-from-one-paths', async () => {
        // Piping an `executeSelectOne()` result (a `RESULT | null`) through the
        // helper: runtime passthrough, the type reshaped to the picked object.
        const availableFields = { id: tIssue.id, title: tIssue.title, body: tIssue.body }
        const picked = dynamicPickPaths(availableFields, ['title'], ['id'])

        ctx.mockNext({ id: 1, title: 'Update hero copy' })
        const one = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .executeSelectOne()
        const expanded = expandTypeFromDynamicPickPaths(availableFields, ['title'], one, ['id'])

        assertType<Extends<typeof expanded, { id: number; title?: string; body?: string } | null>>()
        // Runtime passthrough.
        expect(expanded).toBe(one)
        expect(expanded).toEqual({ id: 1, title: 'Update hero copy' })
    })
})
