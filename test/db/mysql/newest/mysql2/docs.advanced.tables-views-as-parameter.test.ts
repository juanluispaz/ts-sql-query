// Documentation snippets for the Passing tables/views as parameter
// page (docs/advanced/tables-views-as-parameter.md). Demonstrates
// the type-level utilities `TableOrViewOf`, `TableOrViewLeftJoinOf`
// and `fromRef`.

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

    // Smoke test of the full doc-style pattern executed end-to-end: the
    // documented generic helper builds the correlated subquery, fully typed,
    // and the outer query embeds it as an inline value.
    test('docs-extra:tables-views-as-parameter/helper-pattern-runtime-sql-emission', async () => {
        ctx.mockNext({ id: 1, name: 'Marketing site', issueCount: 2 })

        const connection = ctx.conn

        function buildIssueCountSubquery<PROJECT extends TableOrViewOf<typeof tProject, 'project'>>(projectRef: PROJECT) {
            const project = fromRef(tProject, projectRef)
            return connection
                .subSelectUsing(project)
                .from(tIssue)
                .where(tIssue.projectId.equals(project.id))
                .selectCountAll()
                .forUseAsInlineQueryValue()
                .valueWhenNull(0)
        }

        const project = tProject.as('project')
        const row = await connection.selectFrom(project)
            .where(project.id.equals(1))
            .select({
                id:         project.id,
                name:       project.name,
                issueCount: buildIssueCountSubquery(project),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.\`name\` as \`name\`, ifnull((select count(*) as result from issue where project_id = project.id), ?) as issueCount from project as project where project.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            1,
          ]
        `)
        // Project 1 (Marketing site) has 2 issues (issues 1 and 2).
        expect(row.id).toBe(1)
        expect(row.name).toBe('Marketing site')
        expect(row.issueCount).toBe(2)
    })
})
