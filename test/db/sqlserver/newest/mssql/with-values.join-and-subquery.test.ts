// Source-dispatch breadth for `Values` / `View` in positions the rest of
// the with-values / view coverage skips. The existing with-values.* and
// view.basic / select.view-column-types tests only ever drive a Values /
// View through `selectFrom(...)` or `leftJoin(...)`; this file closes:
//
//   A2 — INNER `.innerJoin(view)`: a View as the REQUIRED side of an inner
//        join (columns stay required / non-widened, unlike the leftJoin
//        arm which widens them to optional).
//   A3 — INNER `.innerJoin(values)`: an inline `Values` as the REQUIRED
//        side of an inner join (same required, non-widened projection).
//   A4 — a `Values` fed to `forUseAsInlineQueryValue()` nested inside an
//        inner SELECT: the values view feeds an inline scalar subquery, so
//        its `WITH name(cols) AS (values ...)` clause must bubble up
//        (`__addWiths` / `__registerTableOrView`) to the OUTER query.
//   A5 — the same WITH-hoisting for a `View` fed to
//        `forUseAsInlineQueryValue()` nested inside an inner SELECT.
//
// `Values` is typed on every dialect under test (the `Values.create(...)`
// class form is constrained to all six SQL dialects), so the Values tests
// run live everywhere just like the existing with-values.* files. The View
// tests run on every dialect too.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Values } from '../../../../../src/Values.js'
import { DBConnection, tProject, vReleaseOverview } from '../../domain/connection.js'
import { ctx } from './setup.js'

// An inline Values that maps a project id to an external code, used as the
// required (inner-join) side and as a nested inline-query-value source.
class VProjectCode extends Values<DBConnection, 'projectCode'> {
    projectId = this.column('int')
    code      = this.column('string')
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('inner-join-view-keeps-columns-required', async () => {
        // INNER join a base table to a VIEW. Inner join keeps the view's
        // columns required (no optional widening). vReleaseOverview has
        // releases 1 & 2 for project 1 and release 3 for project 2; filter
        // to project 1 → two matched rows.
        const expected = [
            { projectName: 'Marketing site', version: '1.2.0' },
            { projectName: 'Marketing site', version: '1.3.0-beta.1' },
        ]
        ctx.mockNext(expected)

        const rows = await ctx.conn.selectFrom(tProject)
            .innerJoin(vReleaseOverview).on(vReleaseOverview.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                projectName: tProject.name,
                version:     vReleaseOverview.version,
            })
            .orderBy('version')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.name as projectName, release_overview.version as version from project inner join release_overview on release_overview.project_id = project.id where project.id = @0 order by version"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        // Inner join → version is REQUIRED (`string`), not widened to optional.
        assertType<Exact<typeof rows, Array<{ projectName: string; version: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('inner-join-values-keeps-columns-required', async () => {
        // INNER join a base table to an inline VALUES view. Inner join keeps
        // the values columns required. Only project 1 has a code row, so the
        // inner join yields exactly that one project.
        const expected = [{ name: 'Marketing site', code: 'MKTG' }]
        ctx.mockNext(expected)
        const codes = Values.create(VProjectCode, 'projectCode', [
            { projectId: 1, code: 'MKTG' },
        ])

        const rows = await ctx.conn.selectFrom(tProject)
            .innerJoin(codes).on(codes.projectId.equals(tProject.id))
            .select({
                name: tProject.name,
                code: codes.code,
            })
            .orderBy('name')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectCode as (select * from (values (@0, @1)) as projectCode(projectId, code)) select project.name as name, projectCode.code as code from project inner join projectCode on projectCode.projectId = project.id order by name"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "MKTG",
          ]
        `)
        // Inner join → code is REQUIRED (`string`), not widened to optional.
        assertType<Exact<typeof rows, Array<{ name: string; code: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('values-as-inline-query-value-hoists-with-to-outer', async () => {
        // A `Values` feeding an inline scalar subquery nested inside an
        // outer SELECT. The `WITH projectCode(...) AS (values ...)` clause
        // produced by the inner subquery must bubble up to the OUTER query
        // (`__addWiths` / `__registerTableOrView`). The subquery picks the
        // single code row, so the inline value is 'MKTG'.
        const expected = [{ pickedCode: 'MKTG' }]
        ctx.mockNext(expected)
        const codes = Values.create(VProjectCode, 'projectCode', [
            { projectId: 1, code: 'MKTG' },
        ])

        const pickedCode = ctx.conn.selectFrom(codes)
            .where(codes.projectId.equals(1))
            .selectOneColumn(codes.code)
            .forUseAsInlineQueryValue()

        const rows = await ctx.conn.selectFromNoTable()
            .select({ pickedCode })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectCode as (select * from (values (@0, @1)) as projectCode(projectId, code)) select (select code as [result] from projectCode where projectId = @2) as pickedCode"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "MKTG",
            1,
          ]
        `)
        // Inline subquery operand is optional-typed (the type system can't
        // prove the values view yields exactly one row).
        assertType<Exact<typeof rows, Array<{ pickedCode?: string | undefined }>>>()
        expect(rows).toEqual(expected)
    })

    test('view-as-inline-query-value-hoists-source-to-outer', async () => {
        // A `View` feeding an inline scalar subquery nested inside an outer
        // SELECT — pins the View `__registerTableOrView` hoisting through the
        // inline-query-value path. The subquery picks release 1's version.
        const expected = [{ firstVersion: '1.2.0' }]
        ctx.mockNext(expected)

        const firstVersion = ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .selectOneColumn(vReleaseOverview.version)
            .forUseAsInlineQueryValue()

        const rows = await ctx.conn.selectFromNoTable()
            .select({ firstVersion })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select version as [result] from release_overview where id = @0) as firstVersion"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ firstVersion?: string | undefined }>>>()
        expect(rows).toEqual(expected)
    })
})
