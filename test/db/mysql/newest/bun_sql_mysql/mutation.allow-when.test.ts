// `allowWhen` / `disallowWhen` defense-in-depth on mutations
// (INSERT / UPDATE / DELETE). Same enforcement leaf as SELECT (the
// `AllowWhenValueSource.__toSql`
// mutations reach it through the SqlBuilder's `_buildInsert*` /
// `_buildUpdate` / `_buildDelete` walks over the SET values, the WHERE
// expression, and the RETURNING projection.
//
// Each test wraps the mutation in `ctx.withRollback(...)` so real-DB
// cells stay clean even when the favorable path executes the
// statement. The protection-fires cases throw during construction —
// before any SQL is dispatched — so no rollback is strictly needed
// for them, but the wrapper is kept for symmetry with the favorable
// twins.
//
// See [`select.allow-when.composition.test.ts`](./select.allow-when.composition.test.ts)
// for the SELECT-side composition tests and
// [`docs/queries/extreme-dynamic-queries.md` § Restrict access to values](../../../../../docs/queries/extreme-dynamic-queries.md#restrict-access-to-values)
// for the documented pattern.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { isQueryAllowed } from '../../../../lib/queryIntrospection.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('insert-value-allow-when-true-passes', async () => {
        // INSERT … VALUES (…) — the gated value source rides through
        // the SET-list walk transparently when the gate is open.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const query = connection.insertInto(tProject)
                .values({
                    organizationId: 1,
                    name:           connection.const('Insert Gated v1', 'string').allowWhen(true, 'insert-value gate'),
                    slug:           'insert-gated-v1',
                })

            expect(isQueryAllowed(query)).toBe(true)

            const affected = await query.executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, \`name\`, slug) values (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Insert Gated v1",
                "insert-gated-v1",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(1)
        })
    })

    test('insert-value-allow-when-false-throws', async () => {
        // Same shape, gate closed. Building throws before any INSERT is
        // dispatched. No rollback needed (no SQL ran) but kept for
        // symmetry.
        const connection = ctx.conn
        let thrown: unknown
        await ctx.withRollback(async () => {
            const query = connection.insertInto(tProject)
                .values({
                    organizationId: 1,
                    name:           connection.const('blocked', 'string').allowWhen(false, 'insert-value gate blocks'),
                    slug:           'blocked',
                })

            expect(isQueryAllowed(query)).toBe(false)

            try {
                await query.executeInsert()
            } catch (e) {
                thrown = e
            }
        })
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('insert-value gate blocks')
    })

    test('update-set-allow-when-true-passes', async () => {
        // UPDATE … SET col = <gated value source>. Open gate ⇒ the
        // SET clause renders transparently.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const query = connection.update(tProject)
                .set({
                    name: tProject.name.concat(' / updated').allowWhen(true, 'update-set gate'),
                })
                .where(tProject.id.equals(1))

            expect(isQueryAllowed(query)).toBe(true)

            const affected = await query.executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set \`name\` = concat(\`name\`, ?) where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " / updated",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(1)
        })
    })

    test('update-set-allow-when-false-throws', async () => {
        // Closed gate on the SET value. Build throws when the SET list
        // is rendered.
        const connection = ctx.conn
        let thrown: unknown
        await ctx.withRollback(async () => {
            const query = connection.update(tProject)
                .set({
                    name: tProject.name.concat(' / nope').allowWhen(false, 'update-set gate blocks'),
                })
                .where(tProject.id.equals(1))

            expect(isQueryAllowed(query)).toBe(false)

            try {
                await query.executeUpdate()
            } catch (e) {
                thrown = e
            }
        })
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('update-set gate blocks')
    })

    test('update-where-allow-when-false-throws', async () => {
        // Gated value source in the WHERE expression — closed gate
        // throws on render. The whole UPDATE never reaches the DB.
        const connection = ctx.conn
        let thrown: unknown
        await ctx.withRollback(async () => {
            const query = connection.update(tProject)
                .set({ name: 'unused' })
                .where(tProject.id.equals(1).allowWhen(false, 'update-where gate blocks'))

            expect(isQueryAllowed(query)).toBe(false)

            try {
                await query.executeUpdate()
            } catch (e) {
                thrown = e
            }
        })
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('update-where gate blocks')
    })

    test('update-where-allow-when-true-passes', async () => {
        // Open gate — UPDATE proceeds and updates the row.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const query = connection.update(tProject)
                .set({ name: 'updated-name' })
                .where(tProject.id.equals(1).allowWhen(true, 'update-where gate'))

            expect(isQueryAllowed(query)).toBe(true)

            const affected = await query.executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set \`name\` = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "updated-name",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(1)
        })
    })

    test('delete-where-allow-when-false-throws', async () => {
        // DELETE … WHERE <gated expression>. Closed gate ⇒ throws on
        // render; no DELETE reaches the DB.
        const connection = ctx.conn
        let thrown: unknown
        await ctx.withRollback(async () => {
            const query = connection.deleteFrom(tIssue)
                .where(tIssue.id.equals(99999).allowWhen(false, 'delete-where gate blocks'))

            expect(isQueryAllowed(query)).toBe(false)

            try {
                await query.executeDelete()
            } catch (e) {
                thrown = e
            }
        })
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('delete-where gate blocks')
    })

    test('delete-where-allow-when-true-passes', async () => {
        // Open gate — DELETE runs (mock-only; no actual row deleted
        // from the seeded fixture in mock mode).
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const query = connection.deleteFrom(tIssue)
                .where(tIssue.id.equals(99999).allowWhen(true, 'delete-where gate'))

            expect(isQueryAllowed(query)).toBe(true)

            const affected = await query.executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                99999,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(0)
        })
    })

    test('delete-where-in-subquery-with-gated-column-throws', async () => {
        // Composite: DELETE … WHERE id IN (subquery selecting a gated
        // column). The throw originates in the subquery's render via
        // `_inlineSelectAsValue` → `_buildSelect` → leaf. Proves the
        // mutation path inherits the security backstop through the
        // subquery boundary.
        const connection = ctx.conn
        let thrown: unknown
        await ctx.withRollback(async () => {
            const query = connection.deleteFrom(tIssue)
                .where(tIssue.projectId.in(
                    connection.selectFrom(tProject)
                        .selectOneColumn(tProject.id.allowWhen(false, 'delete-subquery gate blocks')),
                ))

            expect(isQueryAllowed(query)).toBe(false)

            try {
                await query.executeDelete()
            } catch (e) {
                thrown = e
            }
        })
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('delete-subquery gate blocks')
    })

    test('update-from-correlated-subquery-with-gated-column-throws', async () => {
        // UPDATE with WHERE containing a correlated subquery (via
        // `subSelectUsing`) whose projection is gated. Throws on render
        // before the UPDATE reaches the DB.
        const connection = ctx.conn
        let thrown: unknown
        await ctx.withRollback(async () => {
            const query = connection.update(tIssue)
                .set({ status: 'archived' })
                .where(connection.exists(
                    connection.subSelectUsing(tIssue)
                        .from(tProject)
                        .where(tProject.id.equals(tIssue.projectId))
                        .selectOneColumn(tProject.id.allowWhen(false, 'update-subquery gate blocks')),
                ))

            expect(isQueryAllowed(query)).toBe(false)

            try {
                await query.executeUpdate()
            } catch (e) {
                thrown = e
            }
        })
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('update-subquery gate blocks')
    })

    test('update-returning-with-gated-column-reports-disallowed', async () => {
        // The UpdateQueryBuilder `__isAllowed` walks the RETURNING
        // projection (`__columns` → `isAllowedQueryColumns`,
        // a gated column in
        // `.returning({...})` must surface through that branch. Cast to
        // `any` for cells where `.returning(...)` is typed `never` on
        // UPDATE (MySQL): the introspection walker traverses the
        // configured `__columns` regardless of dialect typing.
        const connection = ctx.conn
        const query = (connection.update(tIssue).set({ status: 'archived' }).where(tIssue.id.equals(1)) as any)
            .returning({ id: tIssue.id.allowWhen(false, 'update-returning gate blocks') })
        expect(isQueryAllowed(query)).toBe(false)
    })

    test('delete-returning-with-gated-column-reports-disallowed', async () => {
        // Same walker branch on the DeleteQueryBuilder
        // RETURNING projection gated.
        // `as any` covers cells where DELETE RETURNING is narrowed to
        // `never` (MySQL today).
        const connection = ctx.conn
        const query = (connection.deleteFrom(tIssue).where(tIssue.id.equals(1)) as any)
            .returning({ id: tIssue.id.allowWhen(false, 'delete-returning gate blocks') })
        expect(isQueryAllowed(query)).toBe(false)
    })

    test('update-customize-query-with-gated-fragment-throws', async () => {
        // `__isAllowed` walks the `__customization` raw fragments
        // (: beforeQuery,
        // afterUpdateKeyword, afterQuery). A gated value source embedded
        // in any of them must trip the walker AND fire the protection
        // throw at render time.
        const connection = ctx.conn
        let thrown: unknown
        await ctx.withRollback(async () => {
            const query = connection.update(tIssue)
                .set({ status: 'archived' })
                .where(tIssue.id.equals(1))
                .customizeQuery({
                    afterQuery: connection.rawFragment` /* gated ${tIssue.id.allowWhen(false, 'update-customize gate blocks')} */`,
                })

            expect(isQueryAllowed(query)).toBe(false)

            try {
                await query.executeUpdate()
            } catch (e) {
                thrown = e
            }
        })
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('update-customize gate blocks')
    })

    test('delete-customize-query-with-gated-fragment-throws', async () => {
        // Same `__customization` walk on the DeleteQueryBuilder
        // The protection throws when
        // the raw fragment renders the gated value source.
        const connection = ctx.conn
        let thrown: unknown
        await ctx.withRollback(async () => {
            const query = connection.deleteFrom(tIssue)
                .where(tIssue.id.equals(1))
                .customizeQuery({
                    afterQuery: connection.rawFragment` /* gated ${tIssue.id.allowWhen(false, 'delete-customize gate blocks')} */`,
                })

            expect(isQueryAllowed(query)).toBe(false)

            try {
                await query.executeDelete()
            } catch (e) {
                thrown = e
            }
        })
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('delete-customize gate blocks')
    })
    test('insert-customize-query-with-gated-fragment-throws', async () => {
        // A gated value source embedded in an INSERT `customizeQuery` fragment must
        // trip the introspection walker (query disallowed) AND fire the protection
        // throw at render time (`executeInsert`).
        const connection = ctx.conn
        let thrown: unknown
        await ctx.withRollback(async () => {
            const query = connection.insertInto(tProject)
                .values({ organizationId: 1, name: 'x', slug: 'insert-customize-gate' })
                .customizeQuery({
                    afterQuery: connection.rawFragment` /* gated ${tProject.id.allowWhen(false, 'insert-customize gate blocks')} */`,
                })

            expect(isQueryAllowed(query)).toBe(false)

            try {
                await query.executeInsert()
            } catch (e) {
                thrown = e
            }
        })
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('insert-customize gate blocks')
    })

    test('insert-returning-with-gated-column-reports-disallowed', async () => {
        // A gated column in an INSERT `.returning({...})` projection must report the
        // query disallowed. Cast to `any` for cells where
        // `.returning(...)` is typed `never` on INSERT (MySQL); the introspection
        // walker traverses the configured columns regardless of dialect typing.
        const connection = ctx.conn
        const query = (connection.insertInto(tProject).values({ organizationId: 1, name: 'x', slug: 'insert-returning-gate' }) as any)
            .returning({ id: tProject.id.allowWhen(false, 'insert-returning gate blocks') })
        expect(isQueryAllowed(query)).toBe(false)
    })

    test('insert-multi-row-value-with-gated-column-reports-disallowed', async () => {
        // A gated value source in ONE of the rows of a multi-row `.values([...])`
        // insert must report the query disallowed.
        const connection = ctx.conn
        const query = connection.insertInto(tProject)
            .values([
                { organizationId: 1, name: 'row1', slug: 'insert-multi-gate-1' },
                { organizationId: 1, name: connection.const('row2', 'string').allowWhen(false, 'insert-multi-row gate blocks'), slug: 'insert-multi-gate-2' },
            ])
        expect(isQueryAllowed(query)).toBe(false)
    })

    test('insert-from-select-with-gated-source-column-reports-disallowed', async () => {
        // INSERT … SELECT with the gate on a column of the SOURCE SELECT's
        // projection, not on the INSERT's own set-list. The walk descends into the
        // `from(select)` source before it looks at any set value, so a closed gate
        // there must both report the query disallowed and fire the protection throw
        // when the source select renders.
        const connection = ctx.conn
        let thrown: unknown
        await ctx.withRollback(async () => {
            const source = connection.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({
                    organizationId: tProject.organizationId,
                    slug: tProject.slug,
                    name: tProject.name.allowWhen(false, 'insert-from-select source gate blocks'),
                })

            const query = connection.insertInto(tProject).from(source)

            expect(isQueryAllowed(query)).toBe(false)

            try {
                await query.executeInsert()
            } catch (e) {
                thrown = e
            }
        })
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('insert-from-select source gate blocks')
    })

    test('insert-customize-before-query-with-gated-fragment-throws', async () => {
        // The INSERT `customizeQuery` walk visits three fragment slots in order:
        // `beforeQuery`, `afterInsertKeyword`, `afterQuery`. The `afterQuery` slot
        // is already pinned by `insert-customize-query-with-gated-fragment-throws`;
        // this isolates the FIRST slot, so a regression that stopped walking just
        // that limb is visible here and nowhere else.
        const connection = ctx.conn
        let thrown: unknown
        await ctx.withRollback(async () => {
            const query = connection.insertInto(tProject)
                .values({ organizationId: 1, name: 'x', slug: 'insert-before-query-gate' })
                .customizeQuery({
                    beforeQuery: connection.rawFragment`/* gated ${tProject.id.allowWhen(false, 'insert-before-query gate blocks')} */ `,
                })

            expect(isQueryAllowed(query)).toBe(false)

            try {
                await query.executeInsert()
            } catch (e) {
                thrown = e
            }
        })
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('insert-before-query gate blocks')
    })

    test('insert-customize-after-insert-keyword-with-gated-fragment-throws', async () => {
        // The MIDDLE fragment slot — the hint position between the INSERT keyword
        // and the target table. Isolating each slot is what makes a per-limb
        // regression detectable rather than masked by the other two.
        const connection = ctx.conn
        let thrown: unknown
        await ctx.withRollback(async () => {
            const query = connection.insertInto(tProject)
                .values({ organizationId: 1, name: 'x', slug: 'insert-after-insert-keyword-gate' })
                .customizeQuery({
                    afterInsertKeyword: connection.rawFragment` /* gated ${tProject.id.allowWhen(false, 'insert-after-insert-keyword gate blocks')} */`,
                })

            expect(isQueryAllowed(query)).toBe(false)

            try {
                await query.executeInsert()
            } catch (e) {
                thrown = e
            }
        })
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('insert-after-insert-keyword gate blocks')
    })
})
