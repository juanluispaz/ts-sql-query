// Behavioral coverage of `connection.Values` used as a `WITH name(c1, c2)
// AS (VALUES ...)` clause. The `WITH ... VALUES` form this dialect emits
// is pinned by the snapshot below.
//
// `Values` is typed on every dialect under test (the `Values.create(...)`
// class form is constrained to all six SQL dialects), so the Values tests
// run live on every cell.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Values } from '../../../../../src/Values.js'
import { DBConnection, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

class VProjectPatch extends Values<DBConnection, 'projectPatch'> {
    id   = this.column('int')
    name = this.column('string')
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('values in select-from', async () => {
        ctx.mockNext([])
        const patch = Values.create(VProjectPatch, 'projectPatch', [
            { id: 1, name: 'one'   },
            { id: 2, name: 'two'   },
        ])
        await ctx.conn.selectFrom(patch)
            .select({ id: patch.id, name: patch.name })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectPatch(id, name) as (values (?, ?), (?, ?)) select id as id, name as name from projectPatch"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "one",
            2,
            "two",
          ]
        `)
    })

    test('values in update-from', async () => {
        // patch.id = 1 matches seed project 1 ('Marketing site'), so the
        // UPDATE ... FROM (VALUES ...) touches exactly one row, renaming it.
        const renamedProject = { id: 1, name: 'renamed' }
        ctx.mockNext(1)              // affected rows from the UPDATE
        ctx.mockNext(renamedProject) // row from the verification SELECT
        await ctx.withRollback(async () => {
            const patch = Values.create(VProjectPatch, 'projectPatch', [
                { id: 1, name: 'renamed' },
            ])
            const affected = await ctx.conn.update(tProject)
                .from(patch)
                .set({ name: patch.name })
                .where(tProject.id.equals(patch.id))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectPatch(id, name) as (values (?, ?)) update project, projectPatch set project.name = projectPatch.name where project.id = projectPatch.id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "renamed",
              ]
            `)
            expect(affected).toBe(1)

            const row = await ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({ id: tProject.id, name: tProject.name })
                .executeSelectOne()
            expect(row).toEqual(renamedProject)
        })
    })

    test('values in a compound-union arm', async () => {
        // An inline `Values` view used as one ARM of a compound (UNION): the arm's
        // `WITH name(cols) AS (VALUES ...)` must bubble up to the TOP-LEVEL compound
        // WITH clause (SelectQueryBuilder collects the arm's WITHs). The seed arm is
        // the Values view (so the result stays required). project 1 ('Marketing
        // site') ∪ the two literal VALUES rows, ordered by id.
        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 100, name: 'from-values-a' },
            { id: 200, name: 'from-values-b' },
        ]
        ctx.mockNext(expected)
        const patch = Values.create(VProjectPatch, 'projectPatch', [
            { id: 100, name: 'from-values-a' },
            { id: 200, name: 'from-values-b' },
        ])
        const result = await ctx.conn.selectFrom(patch)
            .select({ id: patch.id, name: patch.name })
            .union(
                ctx.conn.selectFrom(tProject)
                    .where(tProject.id.equals(1))
                    .select({ id: tProject.id, name: tProject.name }),
            )
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectPatch(id, name) as (values (?, ?), (?, ?)) select id as id, name as name from projectPatch union select id as id, name as name from project where id = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
            "from-values-a",
            200,
            "from-values-b",
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; name: string }>>>()
        expect(result).toEqual(expected)
    })

    // aggregated source / inline scalar operand). Each pins the WITH-clause
    // hoist through the surrounding construct.

    // A one-column int list, used as an arm of INTERSECT / EXCEPT / UNION ALL
    // compounds and as a paged / aggregated `selectFrom(values)` source.
    class VIdList extends Values<DBConnection, 'idList'> {
        id = this.column('int')
    }
    // An int + group-tag list, grouped by its tag column.
    class VGroupRows extends Values<DBConnection, 'groupRows'> {
        n   = this.column('int')
        grp = this.column('string')
    }
    // A project-id + tag list, feeding a scalar inline-query-value operand.
    class VProjectPick extends Values<DBConnection, 'projectPick'> {
        projectId = this.column('int')
        tag       = this.column('string')
    }
    // A tree-node list (id + parent pointer + name), self-joined to its own
    // `.as(alias)` clone to resolve each node's parent name.
    class VTreeNode extends Values<DBConnection, 'treeNode'> {
        id       = this.column('int')
        parentId = this.column('int')
        name     = this.column('string')
    }

    test('values-as-intersect-arm', async () => {
        // U1 — a `selectFrom(Values)` as the SEED arm of an INTERSECT. The
        // values id list {1,2,99} intersected with the real project ids
        // {1,2,3,4} keeps the ids present in both → {1,2}. The values view's
        // `WITH idList(id) AS (values ...)` must hoist to the top of the
        // compound.
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const ids = Values.create(VIdList, 'idList', [
            { id: 1 }, { id: 2 }, { id: 99 },
        ])
        const result = await ctx.conn.selectFrom(ids)
            .select({ id: ids.id })
            .intersect(
                ctx.conn.selectFrom(tProject).select({ id: tProject.id }),
            )
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with idList(id) as (values (?), (?), (?)) select id as id from idList intersect select id as id from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            99,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('values-as-except-arm', async () => {
        // U2 — a `selectFrom(Values)` as the SEED arm of an EXCEPT (emitted as
        // `minus` on Oracle). The values id list {1,2,99} minus the real
        // project ids {1,2,3,4} drops the ids that are projects → {99}. The
        // values view's WITH clause hoists to the top of the compound.
        const expected = [{ id: 99 }]
        ctx.mockNext(expected)
        const ids = Values.create(VIdList, 'idList', [
            { id: 1 }, { id: 2 }, { id: 99 },
        ])
        const result = await ctx.conn.selectFrom(ids)
            .select({ id: ids.id })
            .except(
                ctx.conn.selectFrom(tProject).select({ id: tProject.id }),
            )
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with idList(id) as (values (?), (?), (?)) select id as id from idList except select id as id from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            99,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('values-as-union-all-arm-preserves-duplicates', async () => {
        // U3 — a `selectFrom(Values)` as the SEED arm of a UNION ALL. The values
        // id list {1,2} union-all project 1's id keeps the duplicate 1 → three
        // rows [1,1,2] once ordered. The values view's WITH clause hoists to the
        // top of the compound.
        const expected = [{ id: 1 }, { id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const ids = Values.create(VIdList, 'idList', [
            { id: 1 }, { id: 2 },
        ])
        const result = await ctx.conn.selectFrom(ids)
            .select({ id: ids.id })
            .unionAll(
                ctx.conn.selectFrom(tProject).where(tProject.id.equals(1)).select({ id: tProject.id }),
            )
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with idList(id) as (values (?), (?)) select id as id from idList union all select id as id from project where id = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('values-as-non-seed-trailing-union-arm', async () => {
        // U4 — a `Values` used as the NON-seed (trailing) arm of a UNION: the
        // seed is a real table (`project`) and the values view is the 2nd arm.
        // Its `WITH idList(id) AS (values ...)` must still hoist to the top of
        // the compound even though it is not the first arm. Projects {1,2} union
        // the literal ids {100,200} → [1,2,100,200] once ordered.
        const expected = [{ id: 1 }, { id: 2 }, { id: 100 }, { id: 200 }]
        ctx.mockNext(expected)
        const ids = Values.create(VIdList, 'idList', [
            { id: 100 }, { id: 200 },
        ])
        const result = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.in([1, 2]))
            .select({ id: tProject.id })
            .union(
                ctx.conn.selectFrom(ids).select({ id: ids.id }),
            )
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with idList(id) as (values (?), (?)) select id as id from project where id in (?, ?) union select id as id from idList order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
            200,
            1,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('values-source-with-limit', async () => {
        // U5 — `LIMIT` over a `selectFrom(Values)`. The id list {1,2,3} ordered
        // ascending and capped at 2 returns the first two rows.
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const ids = Values.create(VIdList, 'idList', [
            { id: 1 }, { id: 2 }, { id: 3 },
        ])
        const result = await ctx.conn.selectFrom(ids)
            .select({ id: ids.id })
            .orderBy('id')
            .limit(2)
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with idList(id) as (values (?), (?), (?)) select id as id from idList order by id limit ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('values-source-with-limit-and-offset', async () => {
        // U6 — `LIMIT` + `OFFSET` over a `selectFrom(Values)`. The id list
        // {1,2,3} ordered ascending, offset 1 + limit 1 returns the middle row.
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const ids = Values.create(VIdList, 'idList', [
            { id: 1 }, { id: 2 }, { id: 3 },
        ])
        const result = await ctx.conn.selectFrom(ids)
            .select({ id: ids.id })
            .orderBy('id')
            .limit(1)
            .offset(1)
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with idList(id) as (values (?), (?), (?)) select id as id from idList order by id limit ? offset ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('values-source-count-aggregate', async () => {
        // U7 — an aggregate (`count`) over a `selectFrom(Values)`. The id list
        // {1,2,3} has three non-null ids, so `count(id)` is 3.
        const expected = [{ total: 3 }]
        ctx.mockNext(expected)
        const ids = Values.create(VIdList, 'idList', [
            { id: 1 }, { id: 2 }, { id: 3 },
        ])
        const result = await ctx.conn.selectFrom(ids)
            .select({ total: ctx.conn.count(ids.id) })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with idList(id) as (values (?), (?), (?)) select count(id) as total from idList"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ total: number }>>>()
        expect(result).toEqual(expected)
    })

    test('values-source-group-by', async () => {
        // U8 — `GROUP BY` over a `selectFrom(Values)`. Grouping the rows by
        // their `grp` tag and counting each group: group 'a' has two rows, group
        // 'b' has one.
        const expected = [{ grp: 'a', total: 2 }, { grp: 'b', total: 1 }]
        ctx.mockNext(expected)
        const rows = Values.create(VGroupRows, 'groupRows', [
            { n: 1, grp: 'a' }, { n: 2, grp: 'a' }, { n: 3, grp: 'b' },
        ])
        const result = await ctx.conn.selectFrom(rows)
            .select({ grp: rows.grp, total: ctx.conn.count(rows.n) })
            .groupBy('grp')
            .orderBy('grp')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with groupRows(\`n\`, grp) as (values (?, ?), (?, ?), (?, ?)) select grp as grp, count(\`n\`) as total from groupRows group by grp order by grp"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "a",
            2,
            "a",
            3,
            "b",
          ]
        `)
        assertType<Exact<typeof result, Array<{ grp: string; total: number }>>>()
        expect(result).toEqual(expected)
    })

    test('values-sourced-scalar-inline-equals-operand', async () => {
        // U9 — a `Values` fed to `selectOneColumn(...).forUseAsInlineQueryValue()`
        // and used as the operand of a column `.equals(...)` in a WHERE. The
        // inline subquery picks the project id tagged 'primary' (1), so the outer
        // filter reduces to `project.id = (subquery)` → project 1. The values
        // view's WITH clause hoists to the top of the OUTER query. The inline
        // operand is optional-typed, so the boolean is optional, but the
        // projection (`id`, `name`) stays required.
        const expected = [{ id: 1, name: 'Marketing site' }]
        ctx.mockNext(expected)
        const picks = Values.create(VProjectPick, 'projectPick', [
            { projectId: 1, tag: 'primary'   },
            { projectId: 2, tag: 'secondary' },
        ])
        const pickedId = ctx.conn.selectFrom(picks)
            .where(picks.tag.equals('primary'))
            .selectOneColumn(picks.projectId)
            .forUseAsInlineQueryValue()

        const result = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(pickedId))
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectPick(projectId, tag) as (values (?, ?), (?, ?)) select id as id, name as name from project where id = (select projectId as result from projectPick where tag = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "primary",
            2,
            "secondary",
            "primary",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; name: string }>>>()
        expect(result).toEqual(expected)
    })

    test('values-self-joined-to-its-own-clone-hoists-the-with-once', async () => {
        // A `Values` used as BOTH the FROM source and the join side via its own
        // `.as(alias)` clone. The clone reuses the single hoisted CTE (`treeNode`)
        // and only adds an aliased reference (`treeNode as anc`); the WITH clause
        // must be emitted ONCE, not once per reference (a duplicate WITH name is
        // invalid SQL on every engine). Each node points at its parent; the
        // self-join resolves the parent's name. Node 1↔2 point at each other, so
        // both match: node 1's parent is 2 ('b'), node 2's parent is 1 ('a').
        const expected = [
            { id: 1, ancName: 'b' },
            { id: 2, ancName: 'a' },
        ]
        ctx.mockNext(expected)
        const nodes = Values.create(VTreeNode, 'treeNode', [
            { id: 1, parentId: 2, name: 'a' },
            { id: 2, parentId: 1, name: 'b' },
        ])
        const anc = nodes.as('anc')
        const result = await ctx.conn.selectFrom(nodes)
            .innerJoin(anc).on(anc.id.equals(nodes.parentId))
            .select({ id: nodes.id, ancName: anc.name })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with treeNode(id, parentId, name) as (values (?, ?, ?), (?, ?, ?)) select treeNode.id as id, anc.name as ancName from treeNode inner join treeNode as anc on anc.id = treeNode.parentId order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            "a",
            2,
            1,
            "b",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; ancName: string }>>>()
        expect(result).toEqual(expected)
    })
})
