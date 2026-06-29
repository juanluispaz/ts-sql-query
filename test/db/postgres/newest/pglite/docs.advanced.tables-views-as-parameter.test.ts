// Documentation snippets for the Passing tables/views as parameter
// page (docs/advanced/tables-views-as-parameter.md). Demonstrates
// the type-level utilities `TableOrViewOf`, `TableOrViewLeftJoinOf`
// and `fromRef`.

import { beforeAll, afterAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact, type Extends } from '../../../../lib/assertType.js'
import {
    fromRef,
    type TableOrViewOf,
    type TableOrViewLeftJoinOf,
} from '../../../../../src/extras/types.js'
import { tIssue, tProject } from '../../domain/connection.js'
import type { DBConnection } from '../../domain/connection.js'
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
        // The ref resolves to a bare `ITableOrView<NAlias<…>>` marker, so the
        // meaningful relationship is that the aliased table is assignable to it
        // (a full Exact against the column-bearing table is not possible).
        assertType<Extends<typeof project, TableOrViewOf<typeof tProject, 'project'>>>()
    })

    test('docs:tables-views-as-parameter/table-or-view-left-join-of-typing', () => {
        // doc-start
        const issueLJ = tIssue.forUseInLeftJoinAs('issue')
        const ref: TableOrViewLeftJoinOf<typeof tIssue, 'issue'> = issueLJ
        // doc-end
        // Left-join refs are accepted by the type as expected.
        expect(issueLJ).toBeDefined()
        void ref
        // The left-join aliased table is assignable to its ref type.
        assertType<Extends<typeof issueLJ, TableOrViewLeftJoinOf<typeof tIssue, 'issue'>>>()
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

    test('docs-extra:tables-views-as-parameter/table-or-view-of-default-alias-arm', () => {
        // The default (no-alias) arm: with ALIAS defaulting to '' the type is
        // the table/view itself, so the unaliased table is assignable. Only
        // the explicit-alias arm is exercised by the tests above.
        const ref: TableOrViewOf<typeof tProject> = tProject
        void ref
        const refLJ: TableOrViewLeftJoinOf<typeof tIssue> = tIssue.forUseInLeftJoin()
        void refLJ
        // The default (no-alias) arm is the explicit `ALIAS = ''` arm.
        assertType<Exact<TableOrViewOf<typeof tProject>, TableOrViewOf<typeof tProject, ''>>>()
        assertType<Exact<TableOrViewLeftJoinOf<typeof tIssue>, TableOrViewLeftJoinOf<typeof tIssue, ''>>>()
    })

    // Smoke test of the full doc-style pattern executed end-to-end: the
    // documented generic helper builds the correlated subquery, fully typed,
    // and the outer query embeds it as an inline value.
    test('docs-extra:tables-views-as-parameter/helper-pattern-runtime-sql-emission', async () => {
        function buildIssueCountSubquery<PROJECT extends TableOrViewOf<typeof tProject, 'project'>>(connection: DBConnection, projectRef: PROJECT) {
            const project = fromRef(tProject, projectRef)

            return connection
                .subSelectUsing(project)
                .from(tIssue)
                .where(tIssue.projectId.equals(project.id))
                .selectOneColumn(connection.countAll())
                .forUseAsInlineQueryValue()
                .valueWhenNull(0)
        }

        ctx.mockNext({ id: 1, name: 'Marketing site', issueCount: 2 })

        const project = tProject.as('project')

        const row = await ctx.conn.selectFrom(project)
            .where(project.id.equals(1))
            .select({
                id:         project.id,
                name:       project.name,
                issueCount: buildIssueCountSubquery(ctx.conn, project),
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
