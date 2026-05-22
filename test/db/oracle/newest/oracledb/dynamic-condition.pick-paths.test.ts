// `dynamicPickPaths(availableFields, paths, mandatory?)` from
// [src/dynamicCondition.ts](../../../../../src/dynamicCondition.ts).
// The existing `docs.extreme-dynamic-queries.test.ts` and
// `docs.advanced.utility-dynamic-picks.test.ts` cover the *flat*
// case: `availableFields` is a `{ key: column, ... }` shape and the
// `paths` list contains only top-level keys.
//
// This file pins the recursive branch on
// [L139-L146](../../../../../src/dynamicCondition.ts#L139): when
// `availableFields` contains a nested object whose leaves are
// columns, `dynamicPickPaths` walks into it and matches paths of
// the form `"nested.key"`. The same recursion is what powers the
// real "complex projection" feature ts-sql-query exposes via
// `select(nestedObjectShape)` — but the **pick** step is the part
// the existing tests do not exercise.
//
// Branches covered:
//
//   - shallow `paths` against a nested `availableFields` —
//     `pickedFields` only contains the chosen leaves under their
//     parent;
//   - nested-only pick — top-level keys are dropped entirely;
//   - empty `paths` with `mandatory` — only mandatory columns
//     survive (the "pure mandatory" projection shape).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { dynamicPickPaths } from '../../../../../src/dynamicCondition.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('dynamic-pick-paths-walks-into-nested-availableFields', async () => {
        // `availableFields.meta` is a nested object grouping the
        // issue's priority/status columns under a `meta` key. Picking
        // `'meta.priority'` exercises the recursive
        // `internalDynamicPickPaths` branch — only `meta.priority` is
        // kept; `meta.status` is dropped.
        ctx.mockNext([
            { id: 1, meta: { priority: 2 } },
            { id: 2, meta: { priority: 1 } },
        ])
        const availableFields = {
            id:    tIssue.id,
            title: tIssue.title,
            meta: {
                priority: tIssue.priority,
                status:   tIssue.status,
            },
        }
        const picked = dynamicPickPaths(availableFields, ['meta.priority'], ['id'])

        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select(picked)
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", priority as "meta.priority" from issue where project_id = :0 order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        // The nested `meta` survives with only its picked leaf.
        // Unselected leaves (`meta.status`) become absent on the
        // result row.
        assertType<Exact<typeof rows, Array<{
            id:    number
            title?: string
            meta?: { priority?: number; status?: string }
        }>>>()
    })

    test('dynamic-pick-paths-nested-only-drops-top-level-siblings', async () => {
        // No top-level paths picked, just nested ones. The top-level
        // `title` column is dropped (only `id` mandatory + the
        // nested `meta.status` survives).
        ctx.mockNext([
            { id: 1, meta: { status: 'open' } },
        ])
        const availableFields = {
            id:    tIssue.id,
            title: tIssue.title,
            meta: {
                priority: tIssue.priority,
                status:   tIssue.status,
            },
        }
        const picked = dynamicPickPaths(availableFields, ['meta.status'], ['id'])

        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", status as "meta.status" from issue where id = :0"`)
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
    })

    test('dynamic-pick-paths-empty-list-keeps-only-mandatory', async () => {
        // `paths` is empty — only `mandatory` columns make it into
        // the picked shape. The nested `meta` object is dropped
        // entirely (its `internalDynamicPickPaths` returns
        // `undefined` because no leaves matched).
        ctx.mockNext([
            { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 },
        ])
        const availableFields = {
            id:    tIssue.id,
            title: tIssue.title,
            meta: {
                priority: tIssue.priority,
                status:   tIssue.status,
            },
        }
        const picked = dynamicPickPaths(availableFields, [], ['id'])

        const rows = await ctx.conn.selectFrom(tIssue)
            .select(picked)
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            id:     number
            title?: string
            meta?:  { priority?: number; status?: string }
        }>>>()
    })
})
