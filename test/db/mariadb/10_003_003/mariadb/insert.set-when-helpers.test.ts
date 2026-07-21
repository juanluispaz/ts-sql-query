// Coverage of every `*When(when: boolean, …)` conditional helper
// Each helper is a thin dispatcher (~3 lines) that routes to its
// non-`When` sibling when the boolean is true, or returns `this`
// unchanged when false.
//
// The behaviour of the underlying methods (`setIfValue`, `setIfSet`,
// `setForAllIfHasValue`, `disallowIfSet`, …) is exercised by
// [insert.conditional-sets.test.ts](./insert.conditional-sets.test.ts);
// this file pins **the dispatch itself**. Each test pairs
// `*When(false, …)` against `*When(true, …)` so the snapshot delta
// shows the dispatch actually fired.
//
// The scenarios read as realistic triage flows on the seeded `Marketing
// site` project (id=1): a triage agent walks staged issue drafts and
// conditionally overrides the title (`set-if-*`), fills in a
// description body (`set-if-not-set-*`, `set-if-has-no-value-*`),
// drops user-supplied overrides (`ignore-if-*`), or short-circuits
// (`disallow-*`). Issue numbers stay above the seed's `1`–`2` range
// for project id=1 so the `(project_id, number)` UNIQUE constraint
// keeps the inserts admissible against the real DB.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('set-if-value-when-false-is-noop-true-overrides', async () => {
        // when=false → setIfValueWhen returns `this` so `title` is
        // unchanged. when=true → dispatches to setIfValue → updates
        // title to the triage agent's curated value.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 11, title: 'Fix CSV export encoding', status: 'open', priority: 2 })
                .setIfValueWhen(false, { title: 'Triage churn alert' })
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 12, title: 'Fix CSV export encoding', status: 'open', priority: 2 })
                .setIfValueWhen(true, { title: 'Triage churn alert' })
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)"`)
            expect(falseSql).toBe(trueSql) // both emit same column list — only param values differ
        })
    })

    test('set-if-set-when-dispatches-on-true', async () => {
        // setIfSetWhen(true) → setIfSet → reassigns columns already
        // staged. when=false leaves the original draft title intact.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 13, title: 'Patch login redirect', status: 'open', priority: 2 })
                .setIfSetWhen(false, { title: 'Investigate SSO regression' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 14, title: 'Patch login redirect', status: 'open', priority: 2 })
                .setIfSetWhen(true, { title: 'Investigate SSO regression' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                13,
                "Patch login redirect",
                "open",
                2,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                14,
                "Investigate SSO regression",
                "open",
                2,
              ]
            `)
        })
    })

    test('set-if-set-if-value-when-dispatches-on-true', async () => {
        // setIfSetIfValueWhen(true) → setIfSetIfValue: only assigns
        // columns that are BOTH already staged AND pass `_isValue`.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 15, title: 'Refresh pricing page', status: 'open', priority: 2 })
                .setIfSetIfValueWhen(false, { title: 'Update support email' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 16, title: 'Refresh pricing page', status: 'open', priority: 2 })
                .setIfSetIfValueWhen(true, { title: 'Update support email' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                15,
                "Refresh pricing page",
                "open",
                2,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                16,
                "Update support email",
                "open",
                2,
              ]
            `)
        })
    })

    test('set-if-not-set-when-dispatches-on-true', async () => {
        // setIfNotSetWhen(true) → setIfNotSet: only assigns columns
        // that are NOT already staged. `body` is unstaged → filled
        // in the true branch; ignored in the false branch.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 17, title: 'Document webhook retries', status: 'open', priority: 2 })
                .setIfNotSetWhen(false, { body: 'See ADR-021 for the retry policy.' })
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 18, title: 'Document webhook retries', status: 'open', priority: 2 })
                .setIfNotSetWhen(true, { body: 'See ADR-021 for the retry policy.' })
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, \`body\`) values (?, ?, ?, ?, ?, ?)"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('set-if-not-set-if-value-when-dispatches-on-true', async () => {
        // setIfNotSetIfValueWhen(true) → setIfNotSetIfValue: only
        // assigns unstaged columns whose incoming value passes
        // `_isValue`.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 19, title: 'Add OAuth login', status: 'open', priority: 2 })
                .setIfNotSetIfValueWhen(false, { body: 'Customers report intermittent timeouts.' })
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 110, title: 'Add OAuth login', status: 'open', priority: 2 })
                .setIfNotSetIfValueWhen(true, { body: 'Customers report intermittent timeouts.' })
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, \`body\`) values (?, ?, ?, ?, ?, ?)"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('ignore-if-set-when-dispatches-on-true', async () => {
        // ignoreIfSetWhen(true, 'body') → ignoreIfSet → removes `body`
        // from the staged columns. when=false keeps the user-supplied
        // body intact.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 111, title: 'Backfill audit log', body: 'Spotted during the SOC2 prep.', status: 'open', priority: 2 })
                .ignoreIfSetWhen(false, 'body')
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 112, title: 'Backfill audit log', body: 'Spotted during the SOC2 prep.', status: 'open', priority: 2 })
                .ignoreIfSetWhen(true, 'body')
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, \`body\`, status, priority) values (?, ?, ?, ?, ?, ?)"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('keep-only-when-dispatches-on-true', async () => {
        // keepOnlyWhen(true, 'projectId', 'title', …) → keepOnly:
        // drops any staged column that is NOT in the kept list. Here
        // the body the user typed is intentionally dropped before the
        // INSERT.
        //
        // Type lock: keepOnlyWhen(true, …) dispatches straight to
        // keepOnly(…) at runtime, so their result types must coincide —
        // including how a still-missing required key is folded. Opened
        // from dynamicSet() every required column is still missing, so
        // keepOnly over that exact set keeps them all in the missing-keys
        // set (the insert stays non-executable); keepOnlyWhen(true, …)
        // must agree and not silently clear them.
        const keepOnlyResult = ctx.conn.insertInto(tIssue).dynamicSet()
            .keepOnly('projectId', 'number', 'title', 'status', 'priority')
        const keepOnlyWhenTrueResult = ctx.conn.insertInto(tIssue).dynamicSet()
            .keepOnlyWhen(true, 'projectId', 'number', 'title', 'status', 'priority')
        assertType<Exact<typeof keepOnlyResult, typeof keepOnlyWhenTrueResult>>()
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 113, title: 'Migrate metrics to OTLP', body: 'Draft body to be discarded.', status: 'open', priority: 2 })
                .keepOnlyWhen(false, 'projectId', 'number', 'title', 'status', 'priority')
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 114, title: 'Migrate metrics to OTLP', body: 'Draft body to be discarded.', status: 'open', priority: 2 })
                .keepOnlyWhen(true, 'projectId', 'number', 'title', 'status', 'priority')
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, \`body\`, status, priority) values (?, ?, ?, ?, ?, ?)"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('set-if-has-value-when-dispatches-on-true', async () => {
        // setIfHasValueWhen(true) → setIfHasValue: only overwrites
        // columns whose currently-staged value is non-null. `body` is
        // staged as null so it stays out of the override; `title` has
        // a value so it gets re-assigned in the true branch.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 115, title: 'Refactor onboarding wizard', body: null, status: 'open', priority: 2 })
                .setIfHasValueWhen(false, { title: 'Translate help center FAQ', body: 'Should remain null.' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 116, title: 'Refactor onboarding wizard', body: null, status: 'open', priority: 2 })
                .setIfHasValueWhen(true, { title: 'Translate help center FAQ', body: 'Should remain null.' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                115,
                "Refactor onboarding wizard",
                null,
                "open",
                2,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                116,
                "Translate help center FAQ",
                null,
                "open",
                2,
              ]
            `)
        })
    })

    test('set-if-has-value-if-value-when-dispatches-on-true', async () => {
        // setIfHasValueIfValueWhen(true) → setIfHasValueIfValue: both
        // the staged value must be non-null AND the incoming must pass
        // `_isValue`.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 117, title: 'Wire export to CSV', status: 'open', priority: 2 })
                .setIfHasValueIfValueWhen(false, { title: 'Patch CVE-2024-1234' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 118, title: 'Wire export to CSV', status: 'open', priority: 2 })
                .setIfHasValueIfValueWhen(true, { title: 'Patch CVE-2024-1234' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                117,
                "Wire export to CSV",
                "open",
                2,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                118,
                "Patch CVE-2024-1234",
                "open",
                2,
              ]
            `)
        })
    })

    test('set-if-has-no-value-when-dispatches-on-true', async () => {
        // setIfHasNoValueWhen(true) → setIfHasNoValue: only assigns
        // columns whose currently-staged value IS null. The triage
        // agent supplies a default body for issues created without one.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 119, title: 'Investigate latency spike', body: null, status: 'open', priority: 2 })
                .setIfHasNoValueWhen(false, { body: 'Pending triage notes.' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 120, title: 'Investigate latency spike', body: null, status: 'open', priority: 2 })
                .setIfHasNoValueWhen(true, { body: 'Pending triage notes.' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                119,
                "Investigate latency spike",
                null,
                "open",
                2,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                120,
                "Investigate latency spike",
                "Pending triage notes.",
                "open",
                2,
              ]
            `)
        })
    })

    test('set-if-has-no-value-if-value-when-dispatches-on-true', async () => {
        // setIfHasNoValueIfValueWhen(true) → setIfHasNoValueIfValue:
        // intersect of HasNoValue + IfValue.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 121, title: 'Audit dependency tree', body: null, status: 'open', priority: 2 })
                .setIfHasNoValueIfValueWhen(false, { body: 'Run `npm audit --omit=dev`.' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 122, title: 'Audit dependency tree', body: null, status: 'open', priority: 2 })
                .setIfHasNoValueIfValueWhen(true, { body: 'Run `npm audit --omit=dev`.' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                121,
                "Audit dependency tree",
                null,
                "open",
                2,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                122,
                "Audit dependency tree",
                "Run \`npm audit --omit=dev\`.",
                "open",
                2,
              ]
            `)
        })
    })

    test('ignore-if-has-value-when-dispatches-on-true', async () => {
        // ignoreIfHasValueWhen(true, 'body') → ignoreIfHasValue: drops
        // `body` from staged columns if its current value is non-null.
        // The argument is `OptionalColumnsForSetOf<T>` — `body` (which
        // is `optionalColumn`) qualifies; required columns do not.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 123, title: 'Restore staging snapshots', body: 'Provided by the SRE team.', status: 'open', priority: 2 })
                .ignoreIfHasValueWhen(false, 'body')
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 124, title: 'Restore staging snapshots', body: 'Provided by the SRE team.', status: 'open', priority: 2 })
                .ignoreIfHasValueWhen(true, 'body')
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, \`body\`, status, priority) values (?, ?, ?, ?, ?, ?)"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('ignore-if-has-no-value-when-dispatches-on-true', async () => {
        // ignoreIfHasNoValueWhen(true, 'body') → ignoreIfHasNoValue:
        // drops `body` if its current value is null.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 125, title: 'Deprecate legacy webhooks', body: null, status: 'open', priority: 2 })
                .ignoreIfHasNoValueWhen(false, 'body')
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 126, title: 'Deprecate legacy webhooks', body: null, status: 'open', priority: 2 })
                .ignoreIfHasNoValueWhen(true, 'body')
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, \`body\`, status, priority) values (?, ?, ?, ?, ?, ?)"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('ignore-any-set-with-no-value-when-dispatches-on-true', async () => {
        // ignoreAnySetWithNoValueWhen(true) → ignoreAnySetWithNoValue:
        // drops every staged column whose value is null/undefined.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 127, title: 'Add changelog to release notes', body: null, status: 'open', priority: 2 })
                .ignoreAnySetWithNoValueWhen(false)
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 128, title: 'Add changelog to release notes', body: null, status: 'open', priority: 2 })
                .ignoreAnySetWithNoValueWhen(true)
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, \`body\`, status, priority) values (?, ?, ?, ?, ?, ?)"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('set-for-all-when-dispatches-on-true-multi-row', async () => {
        // setForAllWhen(true, {...}) → setForAll: applies the value
        // to every row in a multi-row insert. Here a triage sweep
        // bumps every batched issue from priority 1 to priority 5.
        ctx.mockNext(2)
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 129, title: 'Localise onboarding flow', status: 'open', priority: 1 },
                    { projectId: 1, number: 130, title: 'Translate help center FAQ', status: 'open', priority: 1 },
                ])
                .setForAllWhen(false, { priority: 5 })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 131, title: 'Localise onboarding flow', status: 'open', priority: 1 },
                    { projectId: 1, number: 132, title: 'Translate help center FAQ', status: 'open', priority: 1 },
                ])
                .setForAllWhen(true, { priority: 5 })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                129,
                "Localise onboarding flow",
                "open",
                1,
                1,
                130,
                "Translate help center FAQ",
                "open",
                1,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                131,
                "Localise onboarding flow",
                "open",
                5,
                1,
                132,
                "Translate help center FAQ",
                "open",
                5,
              ]
            `)
        })
    })

    test('set-for-all-if-value-when-dispatches-on-true', async () => {
        ctx.mockNext(2)
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 133, title: 'Localise onboarding flow', status: 'open', priority: 1 },
                    { projectId: 1, number: 134, title: 'Translate help center FAQ', status: 'open', priority: 1 },
                ])
                .setForAllIfValueWhen(false, { priority: 5 })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 135, title: 'Localise onboarding flow', status: 'open', priority: 1 },
                    { projectId: 1, number: 136, title: 'Translate help center FAQ', status: 'open', priority: 1 },
                ])
                .setForAllIfValueWhen(true, { priority: 5 })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                133,
                "Localise onboarding flow",
                "open",
                1,
                1,
                134,
                "Translate help center FAQ",
                "open",
                1,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                135,
                "Localise onboarding flow",
                "open",
                5,
                1,
                136,
                "Translate help center FAQ",
                "open",
                5,
              ]
            `)
        })
    })

    test('set-for-all-if-set-when-dispatches-on-true', async () => {
        // First row has a body, second doesn't. setForAllIfSet only
        // touches the first.
        ctx.mockNext(2)
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 137, title: 'Localise onboarding flow', body: 'Original triage notes.', status: 'open', priority: 1 },
                    { projectId: 1, number: 138, title: 'Translate help center FAQ', status: 'open', priority: 1 },
                ])
                .setForAllIfSetWhen(false, { body: 'Triage sweep override.' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 139, title: 'Localise onboarding flow', body: 'Original triage notes.', status: 'open', priority: 1 },
                    { projectId: 1, number: 140, title: 'Translate help center FAQ', status: 'open', priority: 1 },
                ])
                .setForAllIfSetWhen(true, { body: 'Triage sweep override.' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                137,
                "Localise onboarding flow",
                "Original triage notes.",
                "open",
                1,
                1,
                138,
                "Translate help center FAQ",
                null,
                "open",
                1,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                139,
                "Localise onboarding flow",
                "Triage sweep override.",
                "open",
                1,
                1,
                140,
                "Translate help center FAQ",
                null,
                "open",
                1,
              ]
            `)
        })
    })

    test('set-for-all-if-set-if-value-when-dispatches-on-true', async () => {
        ctx.mockNext(2)
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 141, title: 'Localise onboarding flow', body: 'Original triage notes.', status: 'open', priority: 1 },
                    { projectId: 1, number: 142, title: 'Translate help center FAQ', status: 'open', priority: 1 },
                ])
                .setForAllIfSetIfValueWhen(false, { body: 'Triage sweep override.' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 143, title: 'Localise onboarding flow', body: 'Original triage notes.', status: 'open', priority: 1 },
                    { projectId: 1, number: 144, title: 'Translate help center FAQ', status: 'open', priority: 1 },
                ])
                .setForAllIfSetIfValueWhen(true, { body: 'Triage sweep override.' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                141,
                "Localise onboarding flow",
                "Original triage notes.",
                "open",
                1,
                1,
                142,
                "Translate help center FAQ",
                null,
                "open",
                1,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                143,
                "Localise onboarding flow",
                "Triage sweep override.",
                "open",
                1,
                1,
                144,
                "Translate help center FAQ",
                null,
                "open",
                1,
              ]
            `)
        })
    })

    test('set-for-all-if-not-set-when-dispatches-on-true', async () => {
        // Only the second row has no body, so setForAllIfNotSet fills
        // it; the first row's body is preserved.
        ctx.mockNext(2)
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 145, title: 'Localise onboarding flow', body: 'Original triage notes.', status: 'open', priority: 1 },
                    { projectId: 1, number: 146, title: 'Translate help center FAQ', status: 'open', priority: 1 },
                ])
                .setForAllIfNotSetWhen(false, { body: 'Pending triage notes.' })
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 147, title: 'Localise onboarding flow', body: 'Original triage notes.', status: 'open', priority: 1 },
                    { projectId: 1, number: 148, title: 'Translate help center FAQ', status: 'open', priority: 1 },
                ])
                .setForAllIfNotSetWhen(true, { body: 'Pending triage notes.' })
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, \`body\`, status, priority) values (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, \`body\`, status, priority) values (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)"`)
        })
    })

    test('set-for-all-if-not-set-if-value-when-dispatches-on-true', async () => {
        ctx.mockNext(2)
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 149, title: 'Localise onboarding flow', body: 'Original triage notes.', status: 'open', priority: 1 },
                    { projectId: 1, number: 150, title: 'Translate help center FAQ', status: 'open', priority: 1 },
                ])
                .setForAllIfNotSetIfValueWhen(false, { body: 'Pending triage notes.' })
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 151, title: 'Localise onboarding flow', body: 'Original triage notes.', status: 'open', priority: 1 },
                    { projectId: 1, number: 152, title: 'Translate help center FAQ', status: 'open', priority: 1 },
                ])
                .setForAllIfNotSetIfValueWhen(true, { body: 'Pending triage notes.' })
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, \`body\`, status, priority) values (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, \`body\`, status, priority) values (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)"`)
        })
    })

    test('set-for-all-if-has-value-when-dispatches-on-true', async () => {
        // First row body is a real string (qualifies for HasValue);
        // second body is null (does not).
        ctx.mockNext(2)
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 153, title: 'Localise onboarding flow', body: 'Original triage notes.', status: 'open', priority: 1 },
                    { projectId: 1, number: 154, title: 'Translate help center FAQ', body: null, status: 'open', priority: 1 },
                ])
                .setForAllIfHasValueWhen(false, { body: 'Triage sweep override.' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 155, title: 'Localise onboarding flow', body: 'Original triage notes.', status: 'open', priority: 1 },
                    { projectId: 1, number: 156, title: 'Translate help center FAQ', body: null, status: 'open', priority: 1 },
                ])
                .setForAllIfHasValueWhen(true, { body: 'Triage sweep override.' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                153,
                "Localise onboarding flow",
                "Original triage notes.",
                "open",
                1,
                1,
                154,
                "Translate help center FAQ",
                null,
                "open",
                1,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                155,
                "Localise onboarding flow",
                "Triage sweep override.",
                "open",
                1,
                1,
                156,
                "Translate help center FAQ",
                null,
                "open",
                1,
              ]
            `)
        })
    })

    test('set-for-all-if-has-value-if-value-when-dispatches-on-true', async () => {
        ctx.mockNext(2)
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 157, title: 'Localise onboarding flow', body: 'Original triage notes.', status: 'open', priority: 1 },
                    { projectId: 1, number: 158, title: 'Translate help center FAQ', body: null, status: 'open', priority: 1 },
                ])
                .setForAllIfHasValueIfValueWhen(false, { body: 'Triage sweep override.' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 159, title: 'Localise onboarding flow', body: 'Original triage notes.', status: 'open', priority: 1 },
                    { projectId: 1, number: 160, title: 'Translate help center FAQ', body: null, status: 'open', priority: 1 },
                ])
                .setForAllIfHasValueIfValueWhen(true, { body: 'Triage sweep override.' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                157,
                "Localise onboarding flow",
                "Original triage notes.",
                "open",
                1,
                1,
                158,
                "Translate help center FAQ",
                null,
                "open",
                1,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                159,
                "Localise onboarding flow",
                "Triage sweep override.",
                "open",
                1,
                1,
                160,
                "Translate help center FAQ",
                null,
                "open",
                1,
              ]
            `)
        })
    })

    test('set-for-all-if-has-no-value-when-dispatches-on-true', async () => {
        ctx.mockNext(2)
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 161, title: 'Localise onboarding flow', body: 'Original triage notes.', status: 'open', priority: 1 },
                    { projectId: 1, number: 162, title: 'Translate help center FAQ', body: null, status: 'open', priority: 1 },
                ])
                .setForAllIfHasNoValueWhen(false, { body: 'Pending triage notes.' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 163, title: 'Localise onboarding flow', body: 'Original triage notes.', status: 'open', priority: 1 },
                    { projectId: 1, number: 164, title: 'Translate help center FAQ', body: null, status: 'open', priority: 1 },
                ])
                .setForAllIfHasNoValueWhen(true, { body: 'Pending triage notes.' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                161,
                "Localise onboarding flow",
                "Original triage notes.",
                "open",
                1,
                1,
                162,
                "Translate help center FAQ",
                null,
                "open",
                1,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                163,
                "Localise onboarding flow",
                "Original triage notes.",
                "open",
                1,
                1,
                164,
                "Translate help center FAQ",
                "Pending triage notes.",
                "open",
                1,
              ]
            `)
        })
    })

    test('set-for-all-if-has-no-value-if-value-when-dispatches-on-true', async () => {
        ctx.mockNext(2)
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 165, title: 'Localise onboarding flow', body: 'Original triage notes.', status: 'open', priority: 1 },
                    { projectId: 1, number: 166, title: 'Translate help center FAQ', body: null, status: 'open', priority: 1 },
                ])
                .setForAllIfHasNoValueIfValueWhen(false, { body: 'Pending triage notes.' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 167, title: 'Localise onboarding flow', body: 'Original triage notes.', status: 'open', priority: 1 },
                    { projectId: 1, number: 168, title: 'Translate help center FAQ', body: null, status: 'open', priority: 1 },
                ])
                .setForAllIfHasNoValueIfValueWhen(true, { body: 'Pending triage notes.' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                165,
                "Localise onboarding flow",
                "Original triage notes.",
                "open",
                1,
                1,
                166,
                "Translate help center FAQ",
                null,
                "open",
                1,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                167,
                "Localise onboarding flow",
                "Original triage notes.",
                "open",
                1,
                1,
                168,
                "Translate help center FAQ",
                "Pending triage notes.",
                "open",
                1,
              ]
            `)
        })
    })

    test('disallow-if-set-when-dispatches-on-true', async () => {
        // disallowIfSetWhen(true, error, col) → disallowIfSet: throws
        // immediately when the column is staged. The argument type is
        // `OptionalColumnsForSetOf<T>` so the column must be one the
        // user *could* legitimately omit — `body` (optionalColumn) here.
        // when=false is silent. The scenario models a "self-service
        // form rejects user-supplied bodies" policy.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            // when=false: builds and executes normally (no throw)
            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 169, title: 'Add changelog to release notes', body: 'User-supplied body.', status: 'open', priority: 2 })
                .disallowIfSetWhen(false, 'body must be assigned by the triage agent, not the reporter', 'body')
                .executeInsert()

            // when=true: throws synchronously inside the builder chain
            let caught: unknown
            try {
                await ctx.conn.insertInto(tIssue)
                    .set({ projectId: 1, number: 170, title: 'Add changelog to release notes', body: 'User-supplied body.', status: 'open', priority: 2 })
                    .disallowIfSetWhen(true, 'body must be assigned by the triage agent, not the reporter', 'body')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/body must be assigned by the triage agent|disallow/i)
        })
    })

    test('disallow-if-not-set-when-dispatches-on-true', async () => {
        // disallowIfNotSetWhen(true, ..., 'body') models a "must
        // include a body" gate on a curated workflow.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 171, title: 'Document webhook retries', status: 'open', priority: 2 })
                .disallowIfNotSetWhen(false, 'body is required on this workflow', 'body')
                .executeInsert()

            let caught: unknown
            try {
                await ctx.conn.insertInto(tIssue)
                    .set({ projectId: 1, number: 172, title: 'Document webhook retries', status: 'open', priority: 2 })
                    .disallowIfNotSetWhen(true, 'body is required on this workflow', 'body')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/body is required on this workflow|disallow/i)
        })
    })

    test('disallow-if-value-when-dispatches-on-true', async () => {
        // disallowIfValueWhen — guards against a staged value passing
        // `_isValue`. Used by a "title can only be assigned by triage"
        // policy.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 173, title: 'Patch CVE-2024-1234', status: 'open', priority: 2 })
                .disallowIfValueWhen(false, 'title is reserved for the triage agent', 'title')
                .executeInsert()

            let caught: unknown
            try {
                await ctx.conn.insertInto(tIssue)
                    .set({ projectId: 1, number: 174, title: 'Patch CVE-2024-1234', status: 'open', priority: 2 })
                    .disallowIfValueWhen(true, 'title is reserved for the triage agent', 'title')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/title is reserved for the triage agent|disallow/i)
        })
    })

    test('disallow-if-no-value-when-dispatches-on-true', async () => {
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 175, title: 'Capture stacktrace from sentry', body: null, status: 'open', priority: 2 })
                .disallowIfNoValueWhen(false, 'body must include a sentry link', 'body')
                .executeInsert()

            let caught: unknown
            try {
                await ctx.conn.insertInto(tIssue)
                    .set({ projectId: 1, number: 176, title: 'Capture stacktrace from sentry', body: null, status: 'open', priority: 2 })
                    .disallowIfNoValueWhen(true, 'body must include a sentry link', 'body')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/body must include a sentry link|disallow/i)
        })
    })

    test('disallow-any-other-set-when-dispatches-on-true', async () => {
        // disallowAnyOtherSetWhen(true, error, allowedCols) → throws
        // when any staged column is outside the allow-list. Models a
        // "this form only accepts the bare-minimum identification
        // columns" entry point.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 177, title: 'Investigate p99 latency', status: 'open', priority: 2 })
                .disallowAnyOtherSetWhen(false, 'this entry point only accepts projectId/number', 'projectId', 'number')
                .executeInsert()

            let caught: unknown
            try {
                await ctx.conn.insertInto(tIssue)
                    .set({ projectId: 1, number: 178, title: 'Investigate p99 latency', status: 'open', priority: 2 })
                    .disallowAnyOtherSetWhen(true, 'this entry point only accepts projectId/number', 'projectId', 'number')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/this entry point only accepts projectId\/number|disallow/i)
        })
    })
})
