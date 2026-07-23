// When a mutation projects RETURNING, the library walks every projected column
// to decide whether the statement needs the synthetic pre-update row. A projected
// column is rarely a bare `oldValues()` column: it is normally an EXPRESSION, and
// the old-values reference sits in one of the expression's OPERANDS. Every
// operator wrapper therefore has to recurse into its operands, and it is those
// operand paths this file pins — one wrapper family per test:
//
//   `in` / `notIn` / `inN` / `notInN`
//     - value-source operand, not an array          → test 1
//     - value source inside the array               → test 2
//     - old-values RECEIVER rather than operand     → test 9
//   `is` / `isNot`                                  → test 3
//   `valueWhenNull`                                 → test 4
//   `between` (2nd operand) / `replaceAll` (1st)    → tests 5, 6
//   `replaceAllIfValue` (2nd operand)               → test 7
//   `.valueWhenNoValue(...)`                        → test 8
//
// WHERE THIS IS FALSIFIABLE. The discovery walk reaches the emitted SQL only where
// the dialect has to synthesise the pre-update row — PostgreSQL below
// compatibilityVersion 18_000_000. PostgreSQL 18+ and SQL Server both emit the
// qualifier natively instead (`old.col` / `deleted.col`), read off the column's own
// table, so in those cells these snapshots would be byte-identical with the operand
// recursion removed: there the tests pin the typing, the values and the native
// emission, not the walk. `postgres/oldest/*` is the falsifiable cell set — there a
// missed operand collapses `update project as _new_ … from (select _old_.* from
// project as _old_ where … for no key update of _old_) as _old_ where _new_.id =
// _old_.id` down to a plain `update project … where id = $N`, and the statement
// stops being executable SQL. That is the cell set to real-validate.
//
// `inN` / `notInN` are used wherever an array operand has to carry a value source:
// `in([...])` accepts plain values only.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('returning-in-with-old-value-single-operand', async () => {
        // Idempotency probe on a rename: `name in (old.name)` answers "was this
        // write a no-op?" in the same round-trip. The operand is a single value
        // source rather than an array. Project 1 is renamed 'Marketing site' ->
        // 'Marketing site v1', so the new name is not the old one: false.
        const expected = { id: 1, nameUnchanged: false }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Marketing site v1' })
                .where(tProject.id.equals(1))
                .returning({
                    id: tProject.id,
                    nameUnchanged: tProject.name.in(oldProject.name),
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2 returning id as id, name in (old.name) as "nameUnchanged""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v1",
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number, nameUnchanged: boolean }>>()
            expect(row).toEqual(expected)
        })
    })

    test('returning-in-n-with-old-value-later-in-array-operand', async () => {
        // Normalising a project's display name to its slug, and reporting whether
        // the new name matches one of the row's previous identifiers. The plain
        // literal sits FIRST so the array walk has to continue past a non-table
        // element before it finds `old.slug` at index 1. Project 1: name
        // 'Marketing site' -> 'mktg-site', old slug 'mktg-site' -> true.
        const expected = { id: 1, nameMatchesPriorIdentity: true }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'mktg-site' })
                .where(tProject.id.equals(1))
                .returning({
                    id: tProject.id,
                    nameMatchesPriorIdentity: tProject.name.inN('Marketing site', oldProject.slug),
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2 returning id as id, name in ($3, old.slug) as "nameMatchesPriorIdentity""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "mktg-site",
                1,
                "Marketing site",
              ]
            `)
            assertType<Exact<typeof row, { id: number, nameMatchesPriorIdentity: boolean }>>()
            expect(row).toEqual(expected)
        })
    })

    test('returning-is-not-with-old-value-operand', async () => {
        // The NULL-safe comparison family — the audit-friendly "did this UPDATE
        // actually change anything?" flag. Each dialect renders it its own way,
        // pinned per cell by the snapshot below. Project 1 is renamed, so: true.
        const expected = { id: 1, renamed: true }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Marketing site v3' })
                .where(tProject.id.equals(1))
                .returning({
                    id: tProject.id,
                    renamed: tProject.name.isNot(oldProject.name),
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2 returning id as id, name is distinct from old.name as renamed"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v3",
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number, renamed: boolean }>>()
            expect(row).toEqual(expected)
        })
    })

    test('returning-value-when-null-with-old-value-operand', async () => {
        // `coalesce(body, old.title)`. Clearing an issue's body should still give
        // the caller something to show in a notification, so RETURNING falls back
        // to the pre-update title — the fallback operand is the only reference to
        // the old row. Issue 1's title is 'Update hero copy' and its body is set to
        // NULL, so the coalesce falls through; the fallback is required, so the
        // projected type stays a required string.
        const expected = { id: 1, summary: 'Update hero copy' }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldIssue = tIssue.oldValues()
            const row = await ctx.conn.update(tIssue)
                .set({ body: null })
                .where(tIssue.id.equals(1))
                .returning({
                    id: tIssue.id,
                    summary: tIssue.body.valueWhenNull(oldIssue.title),
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set body = $1 where id = $2 returning id as id, coalesce(body, old.title) as summary"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                null,
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number, summary: string }>>()
            expect(row).toEqual(expected)
        })
    })

    test('returning-between-with-old-value-lower-bound-operand', async () => {
        // A two-operand comparator with the pre-update value as the UPPER bound, so
        // the old column sits in the operator's SECOND operand — a different slot
        // from the `replaceAll` test below, which puts it in the first.
        // `priority between 1 and old.priority` reports whether the triage kept the
        // issue at or above its previous urgency (lower number = more urgent here).
        // Issue 1 is escalated from priority 2 to 1, which falls inside [1, old=2]:
        // true.
        const expected = { id: 1, notEscalated: true }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldIssue = tIssue.oldValues()
            const row = await ctx.conn.update(tIssue)
                .set({ priority: 1 })
                .where(tIssue.id.equals(1))
                .returning({
                    id: tIssue.id,
                    notEscalated: tIssue.priority.between(1, oldIssue.priority),
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set priority = $1 where id = $2 returning id as id, priority between $3 and old.priority as "notEscalated""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                1,
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number, notEscalated: boolean }>>()
            expect(row).toEqual(expected)
        })
    })

    test('returning-replace-all-with-old-value-find-operand', async () => {
        // The same two-operand family through a non-comparator, with the
        // pre-update name as the search term: `replace(name, old.name, $n)`
        // collapses a regionalised rename down to the part that actually changed.
        // Project 1 becomes 'Marketing site (EMEA)', so replacing the old name with
        // the short form yields 'Mktg (EMEA)'.
        const expected = { id: 1, shortName: 'Mktg (EMEA)' }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Marketing site (EMEA)' })
                .where(tProject.id.equals(1))
                .returning({
                    id: tProject.id,
                    shortName: tProject.name.replaceAll(oldProject.name, 'Mktg'),
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2 returning id as id, replace(name, old.name, $3) as "shortName""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site (EMEA)",
                1,
                "Mktg",
              ]
            `)
            assertType<Exact<typeof row, { id: number, shortName: string }>>()
            expect(row).toEqual(expected)
        })
    })

    test('returning-replace-all-if-value-with-old-value-replacement-operand', async () => {
        // The IfValue sibling of the test above, and the only *IfValue wrapper
        // whose operands are typed to accept a value source. Here the old column
        // sits in the SECOND operand, which the plain `replaceAll` test never
        // reaches. Scenario: build the machine-readable label by swapping the human
        // name for the row's stable slug — 'Marketing site (EMEA)' becomes
        // 'mktg-site (EMEA)'. Both operands have a value, so the operator emits.
        const expected = { id: 1, slugLabel: 'mktg-site (EMEA)' }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Marketing site (EMEA)' })
                .where(tProject.id.equals(1))
                .returning({
                    id: tProject.id,
                    slugLabel: tProject.name.replaceAllIfValue('Marketing site', oldProject.slug),
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2 returning id as id, replace(name, $3, old.slug) as "slugLabel""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site (EMEA)",
                1,
                "Marketing site",
              ]
            `)
            assertType<Exact<typeof row, { id: number, slugLabel: string }>>()
            expect(row).toEqual(expected)
        })
    })

    test('returning-value-when-no-value-with-old-value-fallback-operand', async () => {
        // The fallback arm of a dynamic predicate projected into RETURNING. With no
        // slug filter supplied the `equalsIfValue` receiver renders to nothing, so
        // the emitted expression is ENTIRELY the fallback operand — `old.name = $n`
        // is then the only thing referencing the pre-update row. Project 1 was
        // 'Marketing site' before the rename: true.
        const slugFilter: string | undefined = undefined
        const expected = { id: 1, wasMarketingSite: true }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Marketing site v5' })
                .where(tProject.id.equals(1))
                .returning({
                    id: tProject.id,
                    wasMarketingSite: tProject.slug.equalsIfValue(slugFilter)
                        .valueWhenNoValue(oldProject.name.equals('Marketing site')),
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2 returning id as id, old.name = $3 as "wasMarketingSite""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v5",
                1,
                "Marketing site",
              ]
            `)
            assertType<Exact<typeof row, { id: number, wasMarketingSite: boolean }>>()
            expect(row).toEqual(expected)
        })
    })

    test('returning-in-n-on-old-value-receiver-column', async () => {
        // The mirror of test 2: the old-values column is the operator's RECEIVER
        // rather than one of its operands, so the discovery answers from the left
        // side and never walks the array at all. Scenario: classify the rename by
        // whether the row was carrying one of the known legacy names before it was
        // touched — project 1 was 'Marketing site': true.
        const expected = { id: 1, wasKnownName: true }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Marketing site v6' })
                .where(tProject.id.equals(1))
                .returning({
                    id: tProject.id,
                    wasKnownName: oldProject.name.inN('Marketing site', 'Legacy marketing'),
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2 returning id as id, old.name in ($3, $4) as "wasKnownName""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v6",
                1,
                "Marketing site",
                "Legacy marketing",
              ]
            `)
            assertType<Exact<typeof row, { id: number, wasKnownName: boolean }>>()
            expect(row).toEqual(expected)
        })
    })
})
