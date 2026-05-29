// Coverage of INSERT ... SELECT where the source columns are COMPUTED
// value-source expressions (arithmetic, string ops, column-vs-column,
// coalesce/least), not plain column references. This drives the
// expression-tree traversal the SqlBuilder runs over an insert-from-
// select source (`__registerRequiredColumn` / `__registerTableOrView` /
// `__getValuesForInsert` on a wider set of ValueSourceImpl subclasses
// than the plain-column from-select tests reach).
//
// Uses `executeInsert()` (affected-row count, no RETURNING) so the body
// is identical across every dialect — MySQL has no RETURNING but the
// from-select + count form works everywhere. Mutations run inside
// `ctx.withRollback(...)`; the computed rows satisfy issue's FK +
// uniqueness constraints (project ids 1/2 exist, the synthetic `number`
// values do not collide with the seed).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject, tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('insert-from-select-arithmetic-string-and-column-ops', async () => {
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const source = ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({
                    projectId: tProject.id,
                    number:    tProject.id.add(900),
                    title:     tProject.name.concat(' (clone)'),
                    status:    ctx.conn.const('open', 'string'),
                    priority:  tProject.id.add(tProject.organizationId),
                })

            const inserted = await ctx.conn.insertInto(tIssue)
                .from(source)
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) select id as projectId, id + ? as number, concat(name, ?) as title, ? as status, id + organization_id as priority from project where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                900,
                " (clone)",
                "open",
                1,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            if (!ctx.realDbEnabled) expect(inserted).toBe(1)
        })
    })

    test('insert-from-select-multiply-substring-and-least', async () => {
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const source = ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(2))
                .select({
                    projectId: tProject.id,
                    number:    tProject.id.multiply(100).add(2),
                    title:     tProject.name.substring(0, 6),
                    status:    ctx.conn.const('open', 'string'),
                    priority:  tProject.id.maxValue(5),
                })

            const inserted = await ctx.conn.insertInto(tIssue)
                .from(source)
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) select id as projectId, (id * ?) + ? as number, substr(name, ?, ?) as title, ? as status, least(id, ?) as priority from project where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                100,
                2,
                1,
                6,
                "open",
                5,
                2,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            if (!ctx.realDbEnabled) expect(inserted).toBe(1)
        })
    })
})
