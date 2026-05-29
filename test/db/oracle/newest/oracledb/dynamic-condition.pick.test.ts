// Coverage of the `dynamicPick` / `expandType*` utilities in
// [src/dynamicCondition.ts](../../../../../src/dynamicCondition.ts) that the
// existing docs.* and `dynamic-condition.pick-paths.test.ts` files do not
// reach:
//
//   - `dynamicPick` with a NESTED object pick (`{ meta: { priority: true } }`)
//     drives `internalDynamicPick` (L62-93) — every documented `dynamicPick`
//     example uses a FLAT pick, so the recursion was never exercised.
//   - `dynamicPickPaths` against a DEPTH-3 `availableFields` with an
//     `a.b.c` path drives `internalDynamicPickPaths`' own recursion
//     (L140-144) — the sibling pick-paths file only goes two levels deep.
//   - `expandTypeProjectedAsNullableFromDynamicPickPaths` (L170-182) — the
//     nullable-projection sibling of the already-covered
//     `expandTypeFromDynamicPickPaths`; a runtime passthrough whose value is
//     the reshaped result TYPE.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { dynamicPick, dynamicPickPaths, expandTypeProjectedAsNullableFromDynamicPickPaths } from '../../../../../src/dynamicCondition.js'
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", priority as "meta.priority" from issue where id = :0 order by "id""`)
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

    // TODO[BUG] dynamicPickPaths drops branches whose only picked leaf is
    // found via recursion ≥2 levels deep: internalDynamicPickPaths
    // (src/dynamicCondition.ts:142) has a bare `hasContent` expression where
    // it means `hasContent = true`, so the intermediate level returns
    // `undefined` and the whole `group` branch is discarded. The path
    // `'group.sub.priority'` is therefore NOT selected — only the mandatory
    // `id` survives. The assertions below pin that (buggy) current behavior;
    // the *type* still describes the intended shape (the type-level pick is
    // correct, only the runtime drops the branch). See test/BUGS.md.
    // `internalDynamicPick` (the dynamicPick sibling, L82) sets the flag
    // correctly, which is why `pick/nested-dynamic-pick-...` above works.
    test('pick/nested-dynamic-pick-paths-depth-3', async () => {
        const expected = [{ id: 1 }] // BUG: should be [{ id: 1, group: { sub: { priority: 2 } } }]
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
        // A 3-level path should force `internalDynamicPickPaths` to recurse
        // into itself (group -> sub -> priority) and keep the leaf.
        const picked = dynamicPickPaths(availableFields, ['group.sub.priority'], ['id'])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .executeSelectMany()

        // BUG: the `group.sub.priority` column is missing — only `id` is selected.
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where id = :0"`)
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
        // `hasContent` flag correctly (L82), so the deep leaf survives and
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", priority as "group.sub.priority" from issue where id = :0"`)
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
