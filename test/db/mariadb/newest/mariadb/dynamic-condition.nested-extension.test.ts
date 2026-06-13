// Coverage gaps in `DynamicConditionBuilder` not reached by the existing
// `dynamic-condition.extension.test.ts` (which covers top-level extension
// rules) nor `docs.extreme-dynamic-queries.test.ts` (which covers depth-2
// nested projections):
//
//   - **Depth-3 nested projection** — `selectFields = { a: { b: { c: col }}}`
//     forces `processFilter` to recurse into itself with a non-empty
//     prefix and a NESTED-DEFINITION (not a ValueSource) at
//     [DynamicConditionBuilder.ts:92-93](../../../../../src/queryBuilders/DynamicConditionBuilder.ts#L92-L93)
//     — the `else if (prefix)` arm that the existing depth-2 nested
//     projection tests never reach.
//   - **Extension scoped under a nested-projection key** — when the
//     filter recurses into a nested definition, `extension[key]` is
//     passed as the new extension scope at
//     [DynamicConditionBuilder.ts:93,95](../../../../../src/queryBuilders/DynamicConditionBuilder.ts#L93-L95).
//     The existing tests use top-level extension functions only; this
//     pins the propagation.
//   - **Extension callback that returns a non-ValueSource** — error
//     path at [DynamicConditionBuilder.ts:63-68](../../../../../src/queryBuilders/DynamicConditionBuilder.ts#L63-L68).
//   - **Extension callback that returns a non-boolean ValueSource** —
//     error path at [DynamicConditionBuilder.ts:70-77](../../../../../src/queryBuilders/DynamicConditionBuilder.ts#L70-L77).
//
// All four are pure-API and behave identically across every dialect; the
// only inline-snapshot divergence is the boolean spelling / alias quoting
// in the emitted WHERE clause.

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
        // Depth-3 shape: `project.assignee.fullName`. The first
        // `processFilter` call has prefix=''; recurses with prefix=
        // 'project' into a NESTED definition; that recurse iterates
        // key='assignee' whose `selectFields['project']['assignee']`
        // is again a nested definition (not a ValueSource) so the
        // `else if (prefix)` arm at L92-93 fires.
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id from issue left join project on project.id = issue.project_id left join app_user on app_user.id = issue.assignee_id where lower(app_user.full_name) like concat('%', lower(?), '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Ada",
          ]
        `)
    })

    test('extension-scoped-under-nested-projection-key-is-invoked-on-recurse', async () => {
        // `extension[key]` is forwarded down the recursion at L93/95.
        // Here the `project` key holds a nested extension whose `withName`
        // callback emits an EXISTS subquery; the outer scope has no
        // matching rule, so the callback is only resolved INSIDE the
        // recursive `processFilter` invocation.
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id from issue left join project on project.id = issue.project_id where exists(select id as result from project where id = issue.project_id and lower(name) like concat('%', lower(?), '%')) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "mktg",
          ]
        `)
    })

    test('extension-callback-returning-non-value-source-throws-typed-error', async () => {
        // L63-68: the callback returns something that is not a
        // ValueSource. The thrown error attaches `processedValue`,
        // `extensionResult`, and `key` so calling code can localise
        // the mistake.
        const connection = ctx.conn

        const selectFields = { id: tIssue.id }
        // The callback body returns a plain string instead of a boolean
        // value source — the single runtime-guard cast reaching the
        // asserted throw.
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
        // L70-77: callback returns a real ValueSource but its value-type
        // is not boolean. The thrown error additionally carries
        // `returnedTypeName` so the caller knows what type came back.
        const connection = ctx.conn

        const selectFields = { id: tIssue.id }
        // The callback returns a string value source (`tIssue.title`),
        // not a boolean — the single runtime-guard cast reaching the
        // asserted throw.
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
        // function) routes through `processAdditionalColumnFilter`
        // ([DynamicConditionBuilder.ts:137-144,193-235](../../../../../src/queryBuilders/DynamicConditionBuilder.ts#L137-L144)).
        // The inner leaf rule (`above`) dispatches and is and-joined into the
        // column's predicate — `id > $1`. (This path forwards the inner
        // `value`, not the whole column filter, so the nested rule resolves
        // at any depth.)
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
        // Two object levels of column-scoped extension before the leaf rule
        // — `processAdditionalColumnFilter` recurses into itself
        // ([DynamicConditionBuilder.ts:226-233](../../../../../src/queryBuilders/DynamicConditionBuilder.ts#L226-L233))
        // until it reaches the leaf function, which dispatches.
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
        // The error path inside `processAdditionalColumnFilter`: a leaf rule
        // that returns a non-boolean value source throws with the returned
        // type name, mirroring the function-extension guards in the other
        // dispatch paths.
        const connection = ctx.conn
        const selectFields = { id: tIssue.id }
        // The leaf rule returns a string value source (`tIssue.title`),
        // not a boolean — the single runtime-guard cast reaching the
        // asserted throw.
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
