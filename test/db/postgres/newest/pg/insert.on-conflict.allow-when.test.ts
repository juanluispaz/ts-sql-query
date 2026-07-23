// Gate-walk (`allowWhen`/`disallowWhen`) reaching the ON CONFLICT … DO UPDATE
// nodes. The gate is already covered on INSERT-values, UPDATE-set, WHERE,
// RETURNING, customizeQuery fragments and SELECT compositions, but NOT on the
// on-conflict `doUpdateSet` node (a distinct builder traversal whose RHS is a
// value source) nor the on-conflict `.where(cond)` gated condition. A blocked
// gate makes both the introspection walker report the query disallowed AND the
// build throw on execute — proving the walk visits those nodes.
//
// Reached via `onConflictOn(...)`, so live only where a column-targeted conflict
// clause exists (PostgreSQL / SQLite); commented NOT-APPLICABLE on the dialects
// whose connection narrows `onConflictOn` away.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { isQueryAllowed } from '../../../../lib/queryIntrospection.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('gate-on-on-conflict-do-update-set-rhs-fires-on-build', async () => {
        // `allowWhen(false, ...)` on the value-source RHS of the on-conflict
        // `doUpdateSet`. The introspection walker descends into the conflict
        // update-set node and reports the query disallowed; the build throws when
        // `.query()` runs inside `executeInsert`.
        const query = ctx.conn.insertInto(tProject)
            .values({ organizationId: 1, slug: 'mktg-site', name: 'x' })
            .onConflictOn(tProject.organizationId, tProject.slug)
            .doUpdateSet({ name: tProject.name.allowWhen(false, 'on-conflict update-set gate blocks') })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeInsert()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('on-conflict update-set gate blocks')
    })

    test('gate-on-on-conflict-do-update-where-condition-fires-on-build', async () => {
        // `allowWhen(false, ...)` on the on-conflict `DO UPDATE … WHERE` condition.
        // The partial-update predicate is a distinct builder node; the walker
        // descends into it (query disallowed) and the build throws on execute.
        const query = ctx.conn.insertInto(tProject)
            .values({ organizationId: 1, slug: 'mktg-site', name: 'x' })
            .onConflictOn(tProject.organizationId, tProject.slug)
            .doUpdateSet({ name: 'Updated' })
            .where(tProject.name.equals('Marketing site').allowWhen(false, 'on-conflict where gate blocks'))

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeInsert()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('on-conflict where gate blocks')
    })

    test('gate-on-on-conflict-partial-index-where-condition-fires-on-build', async () => {
        // `allowWhen(false, ...)` on the ON CONFLICT (cols) WHERE <partial-index
        // predicate>, set via `onConflictOn(cols).where(cond)` BEFORE `doUpdateSet`.
        // The walker descends into it (query disallowed) and the build throws on execute.
        const query = ctx.conn.insertInto(tProject)
            .values({ organizationId: 1, slug: 'mktg-site', name: 'x' })
            .onConflictOn(tProject.organizationId, tProject.slug)
            .where(tProject.archivedAt.isNull().allowWhen(false, 'on-conflict partial-index where gate blocks'))
            .doUpdateSet({ name: 'Updated' })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeInsert()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('on-conflict partial-index where gate blocks')
    })

    test('gate-on-on-conflict-target-column-fires-on-build', async () => {
        // `allowWhen(false, ...)` on one of the CONFLICT-TARGET columns — the
        // `onConflictOn(...)` operand list, not the update-set or the predicate.
        // The target list is the only walker limb that is an ARRAY of value
        // sources rather than a single one, so it needs its own iteration: the
        // walker must report the query disallowed here exactly as the build does.
        const query = ctx.conn.insertInto(tProject)
            .values({ organizationId: 1, slug: 'mktg-site', name: 'x' })
            .onConflictOn(tProject.organizationId, tProject.slug.allowWhen(false, 'on-conflict target-column gate blocks'))
            .doUpdateSet({ name: 'Updated' })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeInsert()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('on-conflict target-column gate blocks')
    })

    test('gate-on-on-conflict-on-constraint-fragment-fires-on-build', async () => {
        // A closed gate inside the RawFragment that names the CONFLICT CONSTRAINT.
        // `onConflictOnConstraint(...)` is a separate walker limb from the
        // column-target opener the tests above use, and it is narrower still —
        // PostgreSQL is the only dialect that types it. `project_organization_id_slug_key`
        // is PostgreSQL's default name for the inline `UNIQUE (organization_id, slug)`.
        // The constraint fragment is table-independent, so the gate rides on a
        // constant embedded in it rather than on a column.
        const query = ctx.conn.insertInto(tProject)
            .values({ organizationId: 1, slug: 'mktg-site', name: 'x' })
            .onConflictOnConstraint(ctx.conn.rawFragment`project_organization_id_slug_key /* ${ctx.conn.const(1, 'int').allowWhen(false, 'on-conflict constraint gate blocks')} */`)
            .doUpdateSet({ name: 'Updated' })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeInsert()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('on-conflict constraint gate blocks')
    })

    test('fully-allowed-on-conflict-insert-walks-every-limb-and-reports-allowed', async () => {
        // The OPEN-gate half of the gate-walk pair. Every test above closes ONE gate
        // and asserts the walk bails out; none of them observes the walk running to
        // the END. This populates every limb at once — the set-list, the
        // conflict-target columns, the conflict update-set, the DO UPDATE predicate,
        // the RETURNING projection and all three customizeQuery fragments — with an
        // OPEN gate on each, and asserts the walk reaches the end and reports the
        // query allowed. What the closed-gate siblings cannot detect is a limb whose
        // test is inverted, or a walk that stops reporting allowed at the tail. It is
        // not a bare boolean: every gated leaf carries `allowWhen(true, ...)` so the
        // render must also let each through, and the SQL, params and returned row are
        // all pinned. Seed (org 1, 'mktg-site') is project 1, so the conflict fires
        // and RETURNING gives back id 1.
        ctx.mockNext({ id: 1 })
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const query = connection.insertInto(tProject)
                .values({
                    organizationId: 1,
                    slug: 'mktg-site',
                    name: connection.const('Gated allowed', 'string').allowWhen(true, 'insert-value gate'),
                })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: tProject.name.concat(' / allowed').allowWhen(true, 'on-conflict update-set gate') })
                .where(tProject.name.notEquals('never-matches').allowWhen(true, 'on-conflict where gate'))
                .returning({ id: tProject.id.allowWhen(true, 'insert-returning gate') })
                .customizeQuery({
                    beforeQuery: connection.rawFragment`/* gated ${tProject.id.allowWhen(true, 'before-query gate')} */ `,
                    afterInsertKeyword: connection.rawFragment` /* gated ${tProject.id.allowWhen(true, 'after-insert-keyword gate')} */`,
                    afterQuery: connection.rawFragment` /* gated ${tProject.id.allowWhen(true, 'after-query gate')} */`,
                })

            expect(isQueryAllowed(query)).toBe(true)

            const row = await query.executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* gated id */  insert  /* gated id */ into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = project.name || $4 where project.name <> $5 returning id as id  /* gated id */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Gated allowed",
                " / allowed",
                "never-matches",
              ]
            `)
            assertType<Exact<typeof row, { id: number } | null>>()
            expect(row).toEqual({ id: 1 })
        })
    })
})
