// Coverage of `DELETE ... RETURNING` / `OUTPUT deleted.*` paths.
//
// Each mutation runs inside `ctx.withRollback(...)`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProjectRelease, tReleaseDraft, type ReleaseStage } from '../../domain/connection.js'
import type { ReleaseChannel } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('delete-returning-one-row', async () => {
        const expectedMock = { id: 1, title: 'Bug A', priority: 1 }
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const removed = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.id.equals(1))
                .returning({
                    id:       tIssue.id,
                    title:    tIssue.title,
                    priority: tIssue.priority,
                })
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = ? returning id as id, title as title, priority as priority"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof removed, {
                id:       number
                title:    string
                priority: number
            }>>()

            if (!ctx.realDbEnabled) expect(removed).toEqual(expectedMock)
            else expect(removed.id).toBe(1)
        })
    })

    test('delete-returning-many', async () => {
        // Delete the two issues belonging to project 1; returns one row
        // per issue. Targeting `tIssue` (a leaf table — nothing FKs into
        // it) keeps the test FK-safe on engines that enforce referential
        // integrity at delete time.
        const expectedMock = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
        ]
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const removed = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.projectId.equals(1))
                .returning({
                    id:    tIssue.id,
                    title: tIssue.title,
                })
                .executeDeleteMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where project_id = ? returning id as id, title as title"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof removed, Array<{ id: number; title: string }>>>()

            // DELETE … RETURNING has no guaranteed order; sort by id.
            expect(removed.slice().sort((a, b) => a.id - b.id)).toEqual(expectedMock)
        })
    })

    test('delete-returning-projecting-optional-values-as-nullable', async () => {
        // optional RETURNING columns become a present `| null` via
        // `projectingOptionalValuesAsNullable()` on a DELETE builder. issue 3
        // has body = NULL (and is not referenced as a parent by any other
        // issue), so the returned value is null (present), not absent.
        const expectedMock = { id: 3, body: null }
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const removed = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.id.equals(3))
                .returning({ id: tIssue.id, body: tIssue.body })
                .projectingOptionalValuesAsNullable()
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = ? returning id as id, \`body\` as \`body\`"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                3,
              ]
            `)
            assertType<Exact<typeof removed, { id: number; body: string | null }>>()
            expect(removed).toEqual({ id: 3, body: null })
        })
    })

    test('delete-returning-one-column-computed-expression', async () => {
        // `returningOneColumn(<computed>)` on a DELETE projecting a COMPUTED
        // expression (a column combined with a const) rather than a bare
        // column. RETURNING on DELETE sees the row as it was, so deleting issue
        // 3 (priority 3) returns priority + 100 = 103. Issue 3 is a leaf
        // (nothing FKs into it), so the delete is referential-integrity-safe.
        ctx.mockNext(103)

        await ctx.withRollback(async () => {
            const bumped = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.id.equals(3))
                .returningOneColumn(tIssue.priority.add(100))
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = ? returning priority + ? as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                3,
                100,
              ]
            `)
            assertType<Exact<typeof bumped, number>>()
            expect(bumped).toBe(103)
        })
    })

    test('delete-returning-object-computed-expression', async () => {
        // Object-form RETURNING projecting a COMPUTED expression (`title || ' [gone]'`)
        // alongside a plain column. DELETE ... RETURNING sees the row as it was before
        // deletion, so removing issue 3 (title 'Migrate to ESM') returns 'Migrate to
        // ESM [gone]'. Issue 3 is a leaf (nothing FKs into it), so the delete is
        // referential-integrity-safe.
        const expected = { id: 3, tag: 'Migrate to ESM [gone]' }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const row = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.id.equals(3))
                .returning({
                    id:  tIssue.id,
                    tag: tIssue.title.concat(' [gone]'),
                })
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = ? returning id as id, concat(title, ?) as tag"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                3,
                " [gone]",
              ]
            `)
            assertType<Exact<typeof row, { id: number; tag: string }>>()
            expect(row).toEqual(expected)
        })
    })

    test('delete-returning-nested-object-projection', async () => {
        // Object-form RETURNING containing a NESTED object projection: the `meta`
        // group folds two projected columns into a sub-object; the RETURNING clause
        // emits both columns flat (aliased `meta.title` / `meta.priority`) and the
        // complex projector reshapes the row. RETURNING sees the pre-delete values of
        // issue 3 (title 'Migrate to ESM', priority 3). Issue 3 is a leaf, so the
        // delete is referential-integrity-safe.
        const expected = { id: 3, meta: { title: 'Migrate to ESM', priority: 3 } }
        // The mock is primed with the FLAT db row (dotted alias keys); the projector
        // folds it into the nested shape asserted below.
        ctx.mockNext({ id: 3, 'meta.title': 'Migrate to ESM', 'meta.priority': 3 })

        await ctx.withRollback(async () => {
            const row = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.id.equals(3))
                .returning({
                    id:   tIssue.id,
                    meta: { title: tIssue.title, priority: tIssue.priority },
                })
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = ? returning id as id, title as \`meta.title\`, priority as \`meta.priority\`"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                3,
              ]
            `)
            assertType<Exact<typeof row, {
                id:   number
                meta: { title: string; priority: number }
            }>>()
            expect(row).toEqual(expected)
        })
    })

    test('delete-project-release-returning-branded-custom-column', async () => {
        // `returningOneColumn(...)` on a DELETE preserves the column's branded
        // value type: reading `channel` back through RETURNING yields
        // `ReleaseChannel`, not a widened `string`. Release 1's channel is
        // 'stable'; nothing FKs into project_release, so the delete is
        // referential-integrity-safe.
        await ctx.withRollback(async () => {
            ctx.mockNext('stable')
            const channel = await ctx.conn.deleteFrom(tProjectRelease)
                .where(tProjectRelease.id.equals(1))
                .returningOneColumn(tProjectRelease.channel)
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from project_release where id = ? returning channel as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof channel, ReleaseChannel>>()
            expect(channel).toBe('stable')
        })
    })

    test('delete-release-draft-returning-one-column-optional-branded', async () => {
        // `returningOneColumn(<optional branded column>)` on DELETE → `ReleaseStage | null`. Deleting
        // draft 1 returns its `stage` ('candidate'); nothing FKs into release_draft, so the delete is
        // referential-integrity-safe.
        ctx.mockNext('candidate')
        await ctx.withRollback(async () => {
            const stage = await ctx.conn.deleteFrom(tReleaseDraft)
                .where(tReleaseDraft.id.equals(1))
                .returningOneColumn(tReleaseDraft.stage)
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from release_draft where id = ? returning stage as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof stage, ReleaseStage | null>>()
            expect(stage).toBe('candidate')
        })
    })

    test('delete-release-draft-returning-object-optional-branded-default', async () => {
        // Object-form RETURNING of an optional branded column on DELETE. Under the default
        // projector the leaf is `stage?: ReleaseStage` (brand preserved, absent when NULL).
        // RETURNING on DELETE sees the pre-delete value; draft 1's stage is 'candidate'.
        // Nothing FKs into release_draft, so the delete is referential-integrity-safe.
        const expected = { id: 1, stage: 'candidate' as ReleaseStage }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.deleteFrom(tReleaseDraft)
                .where(tReleaseDraft.id.equals(1))
                .returning({ id: tReleaseDraft.id, stage: tReleaseDraft.stage })
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from release_draft where id = ? returning id as id, stage as stage"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number; stage?: ReleaseStage }>>()
            expect(row).toEqual(expected)
        })
    })

    test('delete-release-draft-returning-object-optional-branded-as-nullable', async () => {
        // Object-form RETURNING of an optional branded column on DELETE under
        // `projectingOptionalValuesAsNullable()` → `stage: ReleaseStage | null`. Deleting draft 2
        // (stage NULL) returns present-null.
        const expected = { id: 2, stage: null }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.deleteFrom(tReleaseDraft)
                .where(tReleaseDraft.id.equals(2))
                .returning({ id: tReleaseDraft.id, stage: tReleaseDraft.stage })
                .projectingOptionalValuesAsNullable()
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from release_draft where id = ? returning id as id, stage as stage"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
              ]
            `)
            assertType<Exact<typeof row, { id: number; stage: ReleaseStage | null }>>()
            expect(row).toEqual(expected)
        })
    })

    test('delete-returning-rule1-gate-null-drops-object-default', async () => {
        // Object-form RETURNING with a RULE-1 gate on DELETE: `meta.gate` is
        // `tReleaseDraft.stage.asRequiredInOptionalObject()` and `meta.sibling` a
        // value-bearing `tReleaseDraft.title`. When the gate column is NULL the whole
        // `meta` object DROPS (rule-1) even though the sibling has a value — the
        // DELETE-returning entry applies rule-1. Draft 2's stage is NULL, so `meta` is
        // absent under the default projector.
        const expected = { id: 2 }
        ctx.mockNext({ id: 2, 'meta.sibling': 'Nightly build', 'meta.gate': null })
        await ctx.withRollback(async () => {
            const row = await ctx.conn.deleteFrom(tReleaseDraft)
                .where(tReleaseDraft.id.equals(2))
                .returning({
                    id:   tReleaseDraft.id,
                    meta: { sibling: tReleaseDraft.title, gate: tReleaseDraft.stage.asRequiredInOptionalObject() },
                })
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from release_draft where id = ? returning id as id, title as \`meta.sibling\`, stage as \`meta.gate\`"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
              ]
            `)
            assertType<Exact<typeof row, { id: number; meta?: { sibling: string; gate: ReleaseStage } }>>()
            expect(row).toEqual(expected)
            expect('meta' in row).toBe(false)
        })
    })

    test('delete-returning-rule1-gate-null-drops-object-as-nullable', async () => {
        // The same DELETE rule-1 gate under `projectingOptionalValuesAsNullable()`: the
        // `meta` object becomes `{...} | null` and a null gate surfaces it as
        // `meta: null`. Draft 2's stage is NULL, so `meta` comes back present-null.
        const expected = { id: 2, meta: null }
        ctx.mockNext({ id: 2, 'meta.sibling': 'Nightly build', 'meta.gate': null })
        await ctx.withRollback(async () => {
            const row = await ctx.conn.deleteFrom(tReleaseDraft)
                .where(tReleaseDraft.id.equals(2))
                .returning({
                    id:   tReleaseDraft.id,
                    meta: { sibling: tReleaseDraft.title, gate: tReleaseDraft.stage.asRequiredInOptionalObject() },
                })
                .projectingOptionalValuesAsNullable()
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from release_draft where id = ? returning id as id, title as \`meta.sibling\`, stage as \`meta.gate\`"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
              ]
            `)
            assertType<Exact<typeof row, { id: number; meta: { sibling: string; gate: ReleaseStage } | null }>>()
            expect(row).toEqual(expected)
            expect('meta' in row).toBe(true)
            expect(row.meta).toBe(null)
        })
    })
    // ---- round-44 F4-UPDDEL: one-column-many undefined→null per-element coercion
    test('delete-returning-one-column-many-coerces-undefined-to-null', async () => {
        // `returningOneColumn(<optional col>)` consumed by `executeDeleteMany()`
        // maps each returned scalar, coercing a driver-returned `undefined` element
        // to `null` (the per-element coercion line a single-row path never hits).
        // The mock primes `[undefined, 'x']` to force that path; on a real engine
        // the actual bodies come back (issues 1 and 2 of project 1: NULL and
        // 'Use new tokens'). Deleting project 1's issues cascades to their worklogs
        // (ON DELETE CASCADE), so it is referential-integrity-safe. The element type
        // stays `string | null`.
        await ctx.withRollback(async () => {
            ctx.mockNext([undefined, 'Use new tokens'])
            const bodies = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.projectId.equals(1))
                .returningOneColumn(tIssue.body)
                .executeDeleteMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where project_id = ? returning \`body\` as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof bodies, Array<string | null>>>()
            const sortedBodies = [...bodies].sort((a, b) => (a === null ? -1 : b === null ? 1 : a.localeCompare(b)))
            expect(sortedBodies).toEqual([null, 'Use new tokens'])
        })
    })
})
