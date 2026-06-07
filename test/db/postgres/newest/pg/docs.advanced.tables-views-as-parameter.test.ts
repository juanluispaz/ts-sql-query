// Documentation snippets for the Passing tables/views as parameter
// page (docs/advanced/tables-views-as-parameter.md). Demonstrates
// the type-level utilities `TableOrViewOf`, `TableOrViewLeftJoinOf`
// and `fromRef`.
//
// The full doc example wires those helpers into a `subSelectUsing`
// inline value — that flow exercises ts-sql-query's source-tagging
// across generic table refs and currently doesn't typecheck in
// user-test code (the published doc snippet appears to rely on
// inference that's narrower in practice). Here we keep the test
// focused on type assignability and `fromRef`'s runtime behaviour.

import { beforeAll, afterAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import {
    fromRef,
    type TableOrViewOf,
    type TableOrViewLeftJoinOf,
} from '../../../../../src/extras/types.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:tables-views-as-parameter/table-or-view-of-accepts-aliased-table', () => {
        // doc-start
        const project = tProject.as('project')
        const ref: TableOrViewOf<typeof tProject, 'project'> = project
        // doc-end
        // ref is a typed reference; at runtime it's just the aliased table.
        expect(project).toBeDefined()
        void ref
    })

    test('docs:tables-views-as-parameter/table-or-view-left-join-of-typing', () => {
        // doc-start
        const issueLJ = tIssue.forUseInLeftJoinAs('issue')
        const ref: TableOrViewLeftJoinOf<typeof tIssue, 'issue'> = issueLJ
        // doc-end
        // Left-join refs are accepted by the type as expected.
        expect(issueLJ).toBeDefined()
        void ref
    })

    test('docs:tables-views-as-parameter/from-ref-recovers-columns-from-a-ref', () => {
        // doc-start
        const project = tProject.as('project')
        const ref: TableOrViewOf<typeof tProject, 'project'> = project
        const recovered = fromRef(tProject, ref)
        // doc-end
        // At runtime fromRef returns its input — that's the documented
        // identity behaviour.
        expect(recovered).toBe(project)
        void recovered
    })

    // Smoke test of the full doc-style pattern executed end-to-end. The
    // documented generic helper does not typecheck, so the inner subquery is
    // built untyped (connection cast to `any`) and only the SQL emission is
    // validated.
    // TODO[BUG] (see test/BUGS.md): the documented tables-views-as-parameter
    // helper fails to compile (subSelectUsing source-tagging).
    test('docs-extra:tables-views-as-parameter/helper-pattern-runtime-sql-emission', async () => {
        ctx.mockNext({ id: 1, name: 'Marketing site', issueCount: 2 })

        const project = tProject.as('project')

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const conn: any = ctx.conn
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const projectId: any = (project as { id: unknown }).id
        const innerSub = conn
            .subSelectUsing(project)
            .from(tIssue)
            .where(tIssue.projectId.equals(projectId))
            .selectCountAll()
            .forUseAsInlineQueryValue()
            .valueWhenNull(0)

        const row = await conn.selectFrom(project)
            .where(project.id.equals(1))
            .select({
                id:         project.id,
                name:       project.name,
                issueCount: innerSub,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, coalesce((select count(*) as result from issue where project_id = project.id), $1) as "issueCount" from project as project where project.id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            1,
          ]
        `)
        // project 1 (Marketing site) has issues 1 and 2 → issueCount 2
        expect(row).toEqual({ id: 1, name: 'Marketing site', issueCount: 2 })
    })
})
