// Negative-path coverage of UpdateQueryBuilder shape guards, the
// counterpart to errors.insert-guards.test.ts (which exercises the
// InsertQueryBuilder copy of the same machinery).
//
//   - `INVALID_SHAPE_OVERRIDE` when `extendShape` re-declares a key the
//     shape already maps. The existing update docs/tests only ADD new
//     keys via `extendShape`, never collide with an existing one, so
// the guard at is otherwise unverified.
//
// The reason is surfaced by `UpdateQueryBuilder` (not
// the dialect SqlBuilder), so the behaviour is identical on every
// dialect and this file is byte-identical across every cell. No SQL
// snapshots: the guard throws while configuring the builder, before any
// query is emitted.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

function reasonOf(e: unknown): string | undefined {
    if (e instanceof TsSqlError) return e.errorReason.reason
    return undefined
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('update-guards/extend-shape-override-throws-invalid-shape-override', () => {
        let caught: unknown
        try {
            // `as any`: after `set(...)` the builder narrows `extendShape`
            // away on some dialects; the runtime override guard is what
            // we are exercising, so reach it dynamically — mirrors the
            // insert twin in errors.insert-guards.test.ts.
            const builder = ctx.conn.update(tProject)
                .shapedAs({ name: 'name' }).set({ name: 'x' }) as any
            builder.extendShape({ name: 'slug' })
        } catch (e) { caught = e }
        expect(reasonOf(caught)).toBe('INVALID_SHAPE_OVERRIDE')
    })
})
