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
import { isQueryAllowed } from '../../../../lib/isAllowed.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

// Every test in this cell is block-commented NOT-APPLICABLE; void the imports
// they reference so noUnusedLocals stays satisfied.
void test
void expect
void isQueryAllowed
void tProject

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
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
    */

    // NOT-APPLICABLE: MariaDB has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
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
    */
})
