// Coverage of the 2-arg form `dynamicConditionFor(definition, extension)`
// in [src/queryBuilders/DynamicConditionBuilder.ts](../../../../../src/queryBuilders/DynamicConditionBuilder.ts).
// An extension supplies custom filter rules (callbacks) that get
// dispatched in `processFilter` whenever the caller's filter object
// contains a matching top-level key.
//
// Branches exercised here:
//
//   - top-level rule keyed on `definition` — invoked when the filter
//     object includes that key with a non-null value
//   - the silent no-op path: extension key in filter but value is
//     `null` / `undefined` → rule callback is NOT invoked
//   - composition of extension rule + regular column filter
//     (and-joined in iteration order)
//   - extension rule under `not` (negation passes the same extension
//     down to the recursive `processFilter` call)
//
// (Nested column-level rules — `{ column: { customRule: ... } }` —
// require a nested `selectFields` shape and are exercised in the
// docs.extreme-dynamic-queries test instead.)

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { DynamicCondition } from '../../../../../src/dynamicCondition.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

// `withProjectName` is the extension rule: a top-level key whose
// value is a string and whose callback emits an `EXISTS (...)`
// correlated subquery.
type ExtendedFilter = DynamicCondition<{
    id:       'int',
    status:   'string',
    priority: 'int',
}, {
    withProjectName: (rules: string) => ReturnType<ReturnType<typeof buildExtension>['withProjectName']>
}>

function buildExtension(connection: typeof ctx.conn) {
    return {
        withProjectName: (rules: string) => {
            const sub = connection.subSelectUsing(tIssue)
                .from(tProject)
                .where(tProject.id.equals(tIssue.projectId))
                .and(tProject.name.containsInsensitive(rules))
                .selectOneColumn(tProject.id)
            return connection.exists(sub)
        },
    }
}

const selectFields = {
    id:       tIssue.id,
    status:   tIssue.status,
    priority: tIssue.priority,
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('top-level-extension-rule-invokes-callback', async () => {
        // A top-level extension key in the filter triggers the rule
        // callback. The callback's return value is and-joined with
        // the rest of the WHERE.
        ctx.mockNext([])
        const connection = ctx.conn
        const extension = buildExtension(connection)
        const filter: ExtendedFilter = { withProjectName: 'mktg' }
        const result = await connection.selectFrom(tIssue)
            .where(connection.dynamicConditionFor(selectFields, extension).withValues(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where exists(select id as "result" from project where id = issue.project_id and lower(name) like lower('%' || :0 || '%') escape '\\') order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "mktg",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('extension-noop-when-value-is-null-or-undefined', async () => {
        // The documented short-circuit: when the extension key's value
        // is null/undefined the callback is NOT invoked and the WHERE
        // clause is empty.
        ctx.mockNext([])
        const connection = ctx.conn
        const extension = buildExtension(connection)
        const noopFilter: ExtendedFilter = {
            withProjectName: undefined as unknown as string,
        }
        await connection.selectFrom(tIssue)
            .where(connection.dynamicConditionFor(selectFields, extension).withValues(noopFilter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('extension-rule-composes-with-regular-column-filters', async () => {
        // Extension rules and regular column filters are and-joined.
        // The SQL order follows the iteration order of the filter
        // object — pinning it locks the dispatch sequence.
        ctx.mockNext([])
        const connection = ctx.conn
        const extension = buildExtension(connection)
        const filter: ExtendedFilter = {
            status: { equals: 'open' },
            withProjectName: 'mktg',
        }
        await connection.selectFrom(tIssue)
            .where(connection.dynamicConditionFor(selectFields, extension).withValues(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where status = :0 and exists(select id as "result" from project where id = issue.project_id and lower(name) like lower('%' || :1 || '%') escape '\\') order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            "mktg",
          ]
        `)
    })

    test('extension-rule-under-not-is-negated', async () => {
        // `not` wraps the inner filter and negates the result. The
        // extension is passed down the recursive call so the rule is
        // still dispatched, then the whole subtree is negated.
        ctx.mockNext([])
        const connection = ctx.conn
        const extension = buildExtension(connection)
        const filter: ExtendedFilter = {
            not: { withProjectName: 'legacy' },
        }
        await connection.selectFrom(tIssue)
            .where(connection.dynamicConditionFor(selectFields, extension).withValues(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where not (exists(select id as "result" from project where id = issue.project_id and lower(name) like lower('%' || :0 || '%') escape '\\')) order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "legacy",
          ]
        `)
    })
})
