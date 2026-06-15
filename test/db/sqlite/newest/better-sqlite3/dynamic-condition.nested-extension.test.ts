// Dynamic-condition coverage for nested projections and nested/object-valued
// extension rules:
//
//   - Depth-3 nested projection — `selectFields = { a: { b: { c: col }}}`
//     forces the filter to recurse into a nested definition with a
//     non-empty prefix.
//   - Extension scoped under a nested-projection key — the extension scope
//     is forwarded down the recursion, so a rule defined only inside a
//     nested key resolves there.
//   - Extension callback that returns a non-ValueSource — throws a typed
//     error.
//   - Extension callback that returns a non-boolean ValueSource — throws
//     naming the returned type.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import type { DynamicCondition } from '../../../../../src/dynamic/condition.js'

// A publicly-typed boolean value source — the type an extension rule
// callback is contractually required to return.
type BoolRule<V> = (rule: V) => ReturnType<typeof tIssue.id.equals>
import { tAppUser, tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('depth-3-nested-projection-recurses-with-non-empty-prefix', async () => {
        // Depth-3 shape: `project.assignee.fullName`. The filter recurses
        // from the top into `project`, then into `assignee` — a nested
        // definition reached with a non-empty prefix.
        ctx.mockNext([])

        const project = tProject.forUseInLeftJoin()
        const assignee = tAppUser.forUseInLeftJoin()

        const selectFields = {
            id: tIssue.id,
            project: {
                id: project.id,
                assignee: {
                    id:       assignee.id,
                    fullName: assignee.fullName,
                },
            },
        }
        type Filter = DynamicCondition<{
            id: 'int',
            project: {
                id: 'int',
                assignee: {
                    id: 'int',
                    fullName: 'string',
                },
            },
        }>
        const filter: Filter = {
            project: { assignee: { fullName: { containsInsensitive: 'Ada' } } },
        }

        await ctx.conn.selectFrom(tIssue)
            .leftJoin(project).on(project.id.equals(tIssue.projectId))
            .leftJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id from issue left join project on project.id = issue.project_id left join app_user on app_user.id = issue.assignee_id where lower(app_user.full_name) like lower('%' || ? || '%') escape '\\' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Ada",
          ]
        `)
    })

    test('extension-scoped-under-nested-projection-key-is-invoked-on-recurse', async () => {
        // The extension scope is forwarded down the recursion. Here the
        // `project` key holds a nested extension whose `withName` callback
        // emits an EXISTS subquery; the outer scope has no matching rule,
        // so the callback resolves only inside the nested recursion.
        ctx.mockNext([])
        const connection = ctx.conn

        const project = tProject.forUseInLeftJoin()
        const selectFields = {
            id: tIssue.id,
            project: {
                id:   project.id,
                name: project.name,
            },
        }
        type Filter = DynamicCondition<{
            id: 'int',
            project: {
                id: 'int',
                name: 'string',
            },
        }, {
            project: {
                withName: (rules: string) => ReturnType<typeof connection.exists>
            },
        }>

        const extension = {
            project: {
                withName: (rules: string) => {
                    const sub = connection.subSelectUsing(tIssue)
                        .from(tProject)
                        .where(tProject.id.equals(tIssue.projectId))
                        .and(tProject.name.containsInsensitive(rules))
                        .selectOneColumn(tProject.id)
                    return connection.exists(sub)
                },
            },
        }
        const filter: Filter = { project: { withName: 'mktg' } }

        await connection.selectFrom(tIssue)
            .leftJoin(project).on(project.id.equals(tIssue.projectId))
            .where(connection.dynamicConditionFor(selectFields, extension).withValues(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id from issue left join project on project.id = issue.project_id where exists(select id as result from project where id = issue.project_id and lower(name) like lower('%' || ? || '%') escape '\\') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "mktg",
          ]
        `)
    })

    test('extension-callback-returning-non-value-source-throws-typed-error', async () => {
        // The callback returns something that is not a ValueSource. The
        // thrown error attaches `processedValue`, `extensionResult`, and
        // `key` so calling code can localise the mistake.
        const connection = ctx.conn

        const selectFields = { id: tIssue.id }
        const extension = {
            broken: ((_v: string) => 'not-a-value-source') as unknown as BoolRule<string>,
        }
        type Filter = DynamicCondition<{ id: 'int' }, { broken: BoolRule<string> }>
        const filter = { broken: 'whatever' } as Filter

        let thrown: unknown
        try {
            await connection.selectFrom(tIssue)
                .where(connection.dynamicConditionFor(selectFields, extension).withValues(filter))
                .select({ id: tIssue.id })
                .executeSelectMany()
        } catch (e) { thrown = e }

        expect(thrown).toBeInstanceOf(Error)
        const err = thrown as Error & { extensionResult?: unknown; processedValue?: unknown; key?: unknown }
        expect(String(err.message)).toContain('Expected a boolean value source')
        expect(err.extensionResult).toBe('not-a-value-source')
        expect(err.processedValue).toBe('whatever')
        expect(err.key).toBe('broken')
    })

    test('extension-callback-returning-non-boolean-value-source-throws-with-type-name', async () => {
        // The callback returns a real ValueSource but its value-type is
        // not boolean. The thrown error message names the type that came
        // back.
        const connection = ctx.conn

        const selectFields = { id: tIssue.id }
        const extension = {
            stringified: ((_v: string) => tIssue.title) as unknown as BoolRule<string>,
        }
        type Filter = DynamicCondition<{ id: 'int' }, { stringified: BoolRule<string> }>
        const filter = { stringified: 'whatever' } as Filter

        let thrown: unknown
        try {
            await connection.selectFrom(tIssue)
                .where(connection.dynamicConditionFor(selectFields, extension).withValues(filter))
                .select({ id: tIssue.id })
                .executeSelectMany()
        } catch (e) { thrown = e }

        expect(thrown).toBeInstanceOf(Error)
        const err = thrown as Error & { processedValue?: unknown; key?: unknown }
        expect(String(err.message)).toContain('found a value source with type')
        expect(String(err.message)).toContain('string')
        expect(err.processedValue).toBe('whatever')
        expect(err.key).toBe('stringified')
    })

    test('column-level-object-valued-extension-rule-dispatches-nested', async () => {
        // A column whose extension entry is an OBJECT of rules (not a single
        // function): the inner leaf rule (`above`) dispatches and is
        // and-joined into the column's predicate (`id > <param>`).
        ctx.mockNext([])
        const connection = ctx.conn
        const selectFields = { id: tIssue.id }
        const extension = {
            idRules: {
                above: (v: number) => tIssue.id.greaterThan(v),
            },
        }
        const filter: DynamicCondition<{ id: 'int' }, { idRules: { above: BoolRule<number> } }> = { id: { idRules: { above: 10 } } }
        await connection.selectFrom(tIssue)
            .where(connection.dynamicConditionFor(selectFields, extension).withValues(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where id > ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            10,
          ]
        `)
    })

    test('column-level-object-extension-rule-recurses-to-any-depth', async () => {
        // Two object levels of column-scoped extension before the leaf
        // rule — the dispatch recurses until it reaches the leaf function.
        ctx.mockNext([])
        const connection = ctx.conn
        const selectFields = { id: tIssue.id }
        const extension = {
            idRules: {
                grp: {
                    above: (v: number) => tIssue.id.greaterThan(v),
                },
            },
        }
        const filter: DynamicCondition<{ id: 'int' }, { idRules: { grp: { above: BoolRule<number> } } }> = { id: { idRules: { grp: { above: 10 } } } }
        await connection.selectFrom(tIssue)
            .where(connection.dynamicConditionFor(selectFields, extension).withValues(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where id > ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            10,
          ]
        `)
    })

    test('column-level-object-extension-non-boolean-return-throws', async () => {
        // The object-of-rules error path: a leaf rule that returns a
        // non-boolean value source throws with the returned type name,
        // mirroring the function-extension guards.
        const connection = ctx.conn
        const selectFields = { id: tIssue.id }
        const extension = {
            idRules: {
                stringify: ((_v: number) => tIssue.title) as unknown as BoolRule<number>,
            },
        }
        const filter = { id: { idRules: { stringify: 5 } } } as DynamicCondition<{ id: 'int' }>

        let thrown: unknown
        try {
            await connection.selectFrom(tIssue)
                .where(connection.dynamicConditionFor(selectFields, extension).withValues(filter))
                .select({ id: tIssue.id })
                .executeSelectMany()
        } catch (e) { thrown = e }

        expect(thrown).toBeInstanceOf(Error)
        const err = thrown as Error
        expect(String(err.message)).toContain('found a value source with type')
        expect(String(err.message)).toContain('string')
    })
})
