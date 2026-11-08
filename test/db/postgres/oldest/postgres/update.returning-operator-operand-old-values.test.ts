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
import { tIssue, tProject, DBConnection, tOrganization, vProjectOverview } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { Values } from '../../../../../src/Values.js'

// A rename list joined in through a VALUES source.
class VProjectRename extends Values<DBConnection, 'projectRename'> {
    id   = this.column('int')
    name = this.column('string')
}


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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project as _new_ set name = $1 from (select _old_.* from project as _old_ where _old_.id = $2 for no key update of _old_) as _old_ where _new_.id = _old_.id returning _new_.id as id, _new_.name in (_old_.name) as "nameUnchanged""`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project as _new_ set name = $1 from (select _old_.* from project as _old_ where _old_.id = $2 for no key update of _old_) as _old_ where _new_.id = _old_.id returning _new_.id as id, _new_.name in ($3, _old_.slug) as "nameMatchesPriorIdentity""`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project as _new_ set name = $1 from (select _old_.* from project as _old_ where _old_.id = $2 for no key update of _old_) as _old_ where _new_.id = _old_.id returning _new_.id as id, _new_.name is distinct from _old_.name as renamed"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue as _new_ set body = $1 from (select _old_.* from issue as _old_ where _old_.id = $2 for no key update of _old_) as _old_ where _new_.id = _old_.id returning _new_.id as id, coalesce(_new_.body, _old_.title) as summary"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue as _new_ set priority = $1 from (select _old_.* from issue as _old_ where _old_.id = $2 for no key update of _old_) as _old_ where _new_.id = _old_.id returning _new_.id as id, _new_.priority between $3 and _old_.priority as "notEscalated""`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project as _new_ set name = $1 from (select _old_.* from project as _old_ where _old_.id = $2 for no key update of _old_) as _old_ where _new_.id = _old_.id returning _new_.id as id, replace(_new_.name, _old_.name, $3) as "shortName""`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project as _new_ set name = $1 from (select _old_.* from project as _old_ where _old_.id = $2 for no key update of _old_) as _old_ where _new_.id = _old_.id returning _new_.id as id, replace(_new_.name, $3, _old_.slug) as "slugLabel""`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project as _new_ set name = $1 from (select _old_.* from project as _old_ where _old_.id = $2 for no key update of _old_) as _old_ where _new_.id = _old_.id returning _new_.id as id, _old_.name = $3 as "wasMarketingSite""`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project as _new_ set name = $1 from (select _old_.* from project as _old_ where _old_.id = $2 for no key update of _old_) as _old_ where _new_.id = _old_.id returning _new_.id as id, _old_.name in ($3, $4) as "wasKnownName""`)
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

    test('returning-equals-if-value-with-old-value-receiver-and-a-present-value', async () => {
        // The `*IfValueOrNoop` old-values arm the file's `valueWhenNoValue` test
        // does not reach. There the `equalsIfValue` receiver has NO value, so the
        // operator collapses to a noop and its old-values walk returns early; here
        // the value IS present, so the noop guard falls through and the walk
        // descends into the RECEIVER — an old-values column — which is what pulls
        // the pre-update row into the statement. (`equalsIfValue` yields an
        // if-value source, not directly projectable, so `valueWhenNoValue(false)`
        // resolves it; the value being present means that fallback never fires.)
        // Project 1's slug is 'mktg-site' and renaming the name leaves it untouched,
        // so the pre-update slug still equals 'mktg-site': true.
        const expected = { id: 1, wasMktgSite: true }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Marketing site v2' })
                .where(tProject.id.equals(1))
                .returning({
                    id: tProject.id,
                    wasMktgSite: oldProject.slug.equalsIfValue('mktg-site').valueWhenNoValue(false),
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project as _new_ set name = $1 from (select _old_.* from project as _old_ where _old_.id = $2 for no key update of _old_) as _old_ where _new_.id = _old_.id returning _new_.id as id, _old_.slug = $3 as "wasMktgSite""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v2",
                1,
                "mktg-site",
              ]
            `)
            assertType<Exact<typeof row, { id: number, wasMktgSite: boolean }>>()
            expect(row).toEqual(expected)
        })
    })

    test('returning-concat-if-value-with-old-value-receiver', async () => {
        // The `concatIfValue` twin — a value-present `*IfValueOrIgnore` operator
        // whose receiver is an old-values column. `concatIfValue` yields a plain
        // string value source (projectable directly), and with the value present it
        // emits `old.name || $n`, its operand walk descending into the receiver.
        // Project 1's pre-update name is 'Marketing site', so the label reads
        // 'Marketing site (was)'.
        const expected = { id: 1, label: 'Marketing site (was)' }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Marketing site v3' })
                .where(tProject.id.equals(1))
                .returning({
                    id: tProject.id,
                    label: oldProject.name.concatIfValue(' (was)'),
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project as _new_ set name = $1 from (select _old_.* from project as _old_ where _old_.id = $2 for no key update of _old_) as _old_ where _new_.id = _old_.id returning _new_.id as id, _old_.name || $3 as label"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v3",
                1,
                " (was)",
              ]
            `)
            assertType<Exact<typeof row, { id: number, label: string }>>()
            expect(row).toEqual(expected)
        })
    })

    test('returning-lower-of-collated-old-value', async () => {
        // Two single-operand wrappers stacked over the old column: the
        // case-folded pre-update name, compared under the "C" collation. Project
        // 1 was 'Marketing site'.
        const expected = { id: 1, oldKey: 'marketing site' }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Marketing site v7' })
                .where(tProject.id.equals(1))
                .returning({
                    id:     tProject.id,
                    oldKey: oldProject.name.collate('C').toLowerCase(),
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project as _new_ set name = $1 from (select _old_.* from project as _old_ where _old_.id = $2 for no key update of _old_) as _old_ where _new_.id = _old_.id returning _new_.id as id, lower(_old_.name collate "C") as "oldKey""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v7",
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number, oldKey: string }>>()
            expect(row).toEqual(expected)
        })
    })

    test('returning-is-null-over-old-value', async () => {
        // Renaming a project and reporting whether it was active before the
        // write. Project 1 had no `archived_at`: true.
        const expected = { id: 1, wasActive: true }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Marketing website' })
                .where(tProject.id.equals(1))
                .returning({
                    id:        tProject.id,
                    wasActive: oldProject.archivedAt.isNull(),
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project as _new_ set name = $1 from (select _old_.* from project as _old_ where _old_.id = $2 for no key update of _old_) as _old_ where _new_.id = _old_.id returning _new_.id as id, _old_.archived_at is null as "wasActive""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing website",
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number, wasActive: boolean }>>()
            expect(row).toEqual(expected)
        })
    })

    test('returning-in-if-value-on-old-value-receiver', async () => {
        // A dynamic id filter over the pre-update row, resolved with
        // `trueWhenNoValue()`. The filter is supplied, so it renders as
        // `old.id in (...)`; project 1 is in it: true.
        const watchedIds: number[] | null = [1, 2]
        const expected = { id: 1, watched: true }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Marketing site v8' })
                .where(tProject.id.equals(1))
                .returning({
                    id:      tProject.id,
                    watched: oldProject.id.inIfValue(watchedIds).trueWhenNoValue(),
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project as _new_ set name = $1 from (select _old_.* from project as _old_ where _old_.id = $2 for no key update of _old_) as _old_ where _new_.id = _old_.id returning _new_.id as id, _old_.id in ($3, $4) as watched"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v8",
                1,
                1,
                2,
              ]
            `)
            assertType<Exact<typeof row, { id: number, watched: boolean }>>()
            expect(row).toEqual(expected)
        })
    })

    test('returning-correlated-subqueries-before-old-value', async () => {
        // Correlated subqueries over the updated row projected AHEAD of the old
        // column, so each is searched for an old-values reference (none) before
        // `old.name` is reached. Project 1 has issues 1 and 2 and belongs to Acme
        // Corp; the disabled aggregated array reads back as the empty array.
        const expected = {
            id:        1,
            hasIssues: true,
            orgName:   'Acme Corp',
            issues:    [{ id: 1, title: 'Update hero copy' }, { id: 2, title: 'Redesign navbar' }],
            noIssues:  [],
            oldName:   'Marketing site',
        }
        ctx.mockNext({ ...expected, issues: JSON.stringify(expected.issues), noIssues: null })

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Marketing site v9' })
                .where(tProject.id.equals(1))
                .returning({
                    id:        tProject.id,
                    hasIssues: ctx.conn.exists(
                        ctx.conn.subSelectUsing(tProject).from(tIssue)
                            .where(tIssue.projectId.equals(tProject.id))
                            .selectOneColumn(tIssue.id),
                    ),
                    orgName:   ctx.conn.subSelectUsing(tProject).from(tOrganization)
                        .where(tOrganization.id.equals(tProject.organizationId))
                        .selectOneColumn(tOrganization.name)
                        .forUseAsInlineQueryValue(),
                    issues:    ctx.conn.subSelectUsing(tProject).from(tIssue)
                        .where(tIssue.projectId.equals(tProject.id))
                        .select({ id: tIssue.id, title: tIssue.title })
                        .orderBy('id')
                        .forUseAsInlineAggregatedArrayValue(),
                    noIssues:  ctx.conn.subSelectUsing(tProject).from(tIssue)
                        .where(tIssue.projectId.equals(tProject.id))
                        .select({ id: tIssue.id, title: tIssue.title })
                        .forUseAsInlineAggregatedArrayValue()
                        .onlyWhenOrNull(false)
                        .useEmptyArrayForNoValue(),
                    oldName:   oldProject.name,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project as _new_ set name = $1 from (select _old_.* from project as _old_ where _old_.id = $2 for no key update of _old_) as _old_ where _new_.id = _old_.id returning _new_.id as id, exists(select id as result from issue where project_id = _new_.id) as "hasIssues", (select name as result from organization where id = _new_.organization_id) as "orgName", ((select json_agg(json_build_object('id', a_1_.id, 'title', a_1_.title)) from (select id as id, title as title from issue where project_id = _new_.id order by id) as a_1_))::text as issues, (null)::text as "noIssues", _old_.name as "oldName""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v9",
                1,
              ]
            `)
            assertType<Exact<typeof row, {
                id:        number
                hasIssues: boolean
                orgName?:  string
                issues:    Array<{ id: number; title: string }>
                noIssues:  Array<{ id: number; title: string }>
                oldName:   string
            }>>()
            expect(row).toEqual(expected)
        })
    })

    test('returning-scalar-wrappers-without-old-value-before-old-value', async () => {
        // Expressions over the NEW row only, projected ahead of the old column:
        // a typed fragment, a constant, `is(null)`, `in` over plain values and
        // `inIfValue` both supplied and absent. None references the pre-update
        // row, so the search continues to `old.name`.
        const orgIds: number[] | null = [1]
        const noIds: number[] | null = null
        const expected = {
            id:          1,
            shout:       'MARKETING SITE V10',
            audited:     true,
            nameMissing: false,
            knownSlug:   true,
            inOrg:       true,
            anyId:       true,
            oldName:     'Marketing site',
        }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Marketing site v10' })
                .where(tProject.id.equals(1))
                .returning({
                    id:          tProject.id,
                    shout:       ctx.conn.fragmentWithType('string', 'required').sql`upper(${tProject.name})`,
                    audited:     ctx.conn.true(),
                    nameMissing: tProject.name.is(null),
                    knownSlug:   tProject.slug.in(['mktg-site', 'tools']),
                    inOrg:       tProject.organizationId.inIfValue(orgIds).trueWhenNoValue(),
                    anyId:       tProject.id.inIfValue(noIds).trueWhenNoValue(),
                    oldName:     oldProject.name,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project as _new_ set name = $1 from (select _old_.* from project as _old_ where _old_.id = $2 for no key update of _old_) as _old_ where _new_.id = _old_.id returning _new_.id as id, upper(_new_.name) as shout, true as audited, _new_.name is not distinct from $3 as "nameMissing", _new_.slug in ($4, $5) as "knownSlug", _new_.organization_id in ($6) as "inOrg", true as "anyId", _old_.name as "oldName""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v10",
                1,
                null,
                "mktg-site",
                "tools",
                1,
              ]
            `)
            assertType<Exact<typeof row, {
                id:          number
                shout:       string
                audited:     boolean
                nameMissing: boolean
                knownSlug:   boolean
                inOrg:       boolean
                anyId:       boolean
                oldName:     string
            }>>()
            expect(row).toEqual(expected)
        })
    })

    test('returning-from-view-values-and-cte-columns-before-old-value', async () => {
        // UPDATE … FROM a view, a VALUES rename list and a CTE, with a column of
        // each projected ahead of the old column. Project 1 (org 1, Acme Corp,
        // plan 'pro') is renamed to 'Marketing hub'.
        const expected = {
            orgName:   'Acme Corp',
            renamedTo: 'Marketing hub',
            plan:      'pro',
            id:        1,
            oldName:   'Marketing site',
        }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const renames = Values.create(VProjectRename, 'projectRename', [{ id: 1, name: 'Marketing hub' }])
            const orgPlans = ctx.conn.selectFrom(tOrganization)
                .select({ id: tOrganization.id, plan: tOrganization.plan })
                .forUseInQueryAs('orgPlan')
            const row = await ctx.conn.update(tProject)
                .from(vProjectOverview)
                .from(renames)
                .from(orgPlans)
                .set({ name: renames.name })
                .where(tProject.id.equals(renames.id))
                .and(vProjectOverview.id.equals(tProject.id))
                .and(orgPlans.id.equals(tProject.organizationId))
                .returning({
                    orgName:   vProjectOverview.organizationName,
                    renamedTo: renames.name,
                    plan:      orgPlans.plan,
                    id:        tProject.id,
                    oldName:   oldProject.name,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectRename(id, name) as (values ($1, $2)), orgPlan as (select id as id, plan as plan from organization) update project as _new_ set name = _old_.projectRename__name from (select _old_.*, orgPlan.plan as orgPlan__plan, projectRename.name as projectRename__name, project_overview.organization_name as project_overview__organization_name from project as _old_, project_overview, projectRename, orgPlan where _old_.id = projectRename.id and project_overview.id = _old_.id and orgPlan.id = _old_.organization_id for no key update of _old_) as _old_ where _new_.id = _old_.id returning _old_.project_overview__organization_name as "orgName", _old_.projectRename__name as "renamedTo", _old_.orgPlan__plan as plan, _new_.id as id, _old_.name as "oldName""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Marketing hub",
              ]
            `)
            assertType<Exact<typeof row, {
                orgName:   string
                renamedTo: string
                plan:      string
                id:        number
                oldName:   string
            }>>()
            expect(row).toEqual(expected)
        })
    })
})
