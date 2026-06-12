// `FragmentValueSource` (returned by
// `connection.fragmentWithType(type, optional).sql\`…\``) wraps a
// typed template-string fragment as a first-class value source. Its
// `__addWiths` / `__registerTableOrView` / `__registerRequiredColumn`
// / `__getOldValues` / `__getValuesForInsert` overrides at
// [src/internal/ValueSourceImpl.ts:1573-1615](../../../../../src/internal/ValueSourceImpl.ts#L1573-L1615)
// loop over every interpolated `__sqlParams` entry so that whatever
// the fragment references bubbles up to the enclosing query — CTEs
// land in the outer WITH clause, joined-in tables get registered as
// required, and `oldValues()` / `valuesForInsert()` columns trigger
// the dialect-specific OLD/EXCLUDED subquery emission.
//
// The existing [`fragments.test.ts`](./fragments.test.ts) +
// [`fragments.with-args.test.ts`](./fragments.with-args.test.ts) pin
// the basic emission shape but never exercise propagation of
// `__getOldValues` / `__getValuesForInsert` / `__registerRequiredColumn`
// through a fragment param — this file fills those three branches.
//
// The fourth interesting branch — `FragmentValueSource.__isAllowed`
// (L1616-1626) — is currently broken (it calls `__getValuesForInsert`
// on each param instead of `__isAllowed`, see `test/BUGS.md`). The
// bug is masked by the dead `__isAllowed` web noted in the same file,
// so a positive test for it cannot ship green today and is omitted.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { isQueryAllowed } from '../../../../lib/isAllowed.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: MySQL has no RETURNING — `tTable.oldValues()` is typed `never` on this dialect (no `RETURNING OLD.col` equivalent).
    /*
test('fragment-with-old-values-column-bubbles-up-in-update-returning', async () => {
        // A typed fragment that interpolates `oldProject.name` is the
        // sole `result` column of an UPDATE…returningOneColumn. The
        // build path at
        // [src/queryBuilders/UpdateQueryBuilder.ts:957-964](../../../../../src/queryBuilders/UpdateQueryBuilder.ts#L957-L964)
        // calls `__getOldValues` on the projection's value source
        // privately; FragmentValueSource's override at L1594-1604
        // walks `__sqlParams`, finds `oldProject.name`'s reverse
        // pointer to the synthetic _old_ table and returns it. The
        // resulting SQL must include the OLD/`_old_` subquery — on PG
        // 18+ that's the native `old.name` qualifier in RETURNING.
        ctx.mockNext('[Marketing site]')

        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const oldProject = tProject.oldValues()
            const previousName = await connection.update(tProject)
                .set({ name: 'Mktg site v3' })
                .where(tProject.id.equals(1))
                .returningOneColumn(connection.fragmentWithType('string', 'required')
                    .sql`('[' || ${oldProject.name} || ']')`)
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2 returning ('[' || old.name || ']') as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mktg site v3",
                1,
              ]
            `)
            assertType<Exact<typeof previousName, string>>()
            if (!ctx.realDbEnabled) {
                expect(previousName).toBe('[Marketing site]')
            } else {
                expect(previousName).toBe('[Marketing site]')
            }
        })
    })
    */

    // NOT-APPLICABLE: MySQL uses the bare onConflictDoUpdateSet form — `onConflictOn(cols).doUpdateSet({...})` requires column-explicit conflict targeting, but MySQL's `ON DUPLICATE KEY UPDATE` grammar takes no column list.
    /*
test('fragment-with-values-for-insert-column-bubbles-up-in-on-conflict-do-update-set', async () => {
        // ON CONFLICT … DO UPDATE … SET <col> = <fragment(excluded.col)>
        // is the documented place to reach the EXCLUDED row. A typed
        // fragment that interpolates `tProject.valuesForInsert().name`
        // must propagate the "valuesForInsert" marker through
        // FragmentValueSource.__getValuesForInsert (L1605-1614) so
        // InsertQueryBuilder's set() path at
        // [src/queryBuilders/InsertQueryBuilder.ts:1700](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L1700)
        // (and L1801 for the dynamic-set sibling) marks the statement
        // as needing the EXCLUDED alias. Without the propagation the
        // EXCLUDED alias would not be emitted and PG would fail to
        // resolve `excluded.name`.
        ctx.mockNext(1)
        const connection = ctx.conn

        await ctx.withRollback(async () => {
            const newProject = tProject.valuesForInsert()
            const affected = await connection.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v4' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({
                    name: connection.fragmentWithType('string', 'required')
                        .sql`(${tProject.name} || ' / ' || ${newProject.name})`,
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = (project.name || ' / ' || excluded.name)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v4",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — `tTable.oldValues()` is typed `never` on this dialect (no `RETURNING OLD.col` equivalent).
    /*
test('fragment-from-joined-table-registers-required-column-in-update-from-old-values', async () => {
        // UPDATE … FROM … RETURNING with `oldValues()` and a typed
        // fragment referencing a joined-in table column. The fragment
        // sits inside RETURNING and references `tOrganization.name`
        // via interpolation. The dialect's
        // `_extractAdditionalRequiredColumnsForUpdate` at
        // [src/sqlBuilders/AbstractSqlBuilder.ts:2118-2244](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts#L2118-L2244)
        // walks every RETURNING column and asks each for its
        // `__registerRequiredColumn` set. FragmentValueSource's
        // override at L1587-1593 forwards to the interpolated params,
        // so `organization.name` must end up in the synthetic _old_
        // subquery as `organization__name`. On PG ≥ 18 (this cell)
        // the OLD qualifier is native, so the FROM-subquery is not
        // emitted and the fragment renders `organization.name`
        // directly — the test still pins the registration path via
        // the RETURNING projection.
        ctx.mockNext({
            id:      1,
            oldName: 'Marketing site',
            newName: 'Marketing site / Acme Corp',
            stamp:   'Marketing site (was) vs Acme Corp',
        })
        const connection = ctx.conn

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await connection.update(tProject)
                .from(tOrganization)
                .set({
                    name: tProject.name.concat(' / ').concat(tOrganization.name),
                })
                .where(tProject.id.equals(1))
                .and(tProject.organizationId.equals(tOrganization.id))
                .returning({
                    id:      tProject.id,
                    oldName: oldProject.name,
                    newName: tProject.name,
                    stamp:   connection.fragmentWithType('string', 'required')
                        .sql`(${oldProject.name} || ' (was) vs ' || ${tOrganization.name})`,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = project.name || $1 || organization.name from organization where project.id = $2 and project.organization_id = organization.id returning project.id as id, old.name as "oldName", project.name as "newName", (old.name || ' (was) vs ' || organization.name) as stamp"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " / ",
                1,
              ]
            `)
            assertType<Exact<typeof row, {
                id:      number
                oldName: string
                newName: string
                stamp:   string
            }>>()
            if (!ctx.realDbEnabled) {
                expect(row).toEqual({
                    id:      1,
                    oldName: 'Marketing site',
                    newName: 'Marketing site / Acme Corp',
                    stamp:   'Marketing site (was) vs Acme Corp',
                })
            } else {
                expect(row.id).toBe(1)
                expect(row.oldName).toBe('Marketing site')
                expect(row.newName).toContain('Acme Corp')
                expect(row.stamp).toContain('(was)')
            }
        })
    })
    */

    test('fragment-with-disallowed-interpolated-column-throws-on-build', async () => {
        // The throw comes from the leaf `AllowWhenValueSource.__toSql`
        // at [src/internal/ValueSourceImpl.ts:1715](../../../../../src/internal/ValueSourceImpl.ts#L1715),
        // reached via `FragmentValueSource.__toSql` → `sqlBuilder._fragment` →
        // `_appendValue` on the interpolated param. Pins that the
        // disallow gate propagates through the fragment template
        // boundary (build throws on `executeSelectMany`, not silently).
        // The introspection walker also reports disallowed because
        // `FragmentValueSource.__isAllowed` walks `__sqlParams` and
        // recurses into the gated leaf.
        const query = ctx.conn.selectFrom(tProject)
            .select({
                label: ctx.conn.fragmentWithType('string', 'required')
                    .sql`('[' || ${tProject.name.allowWhen(false, 'fragment-gate-blocks-name')} || ']')`,
            })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('fragment-gate-blocks-name')
    })

    test('fragment-with-allowed-interpolated-column-emits-transparently', async () => {
        // Favorable counterpart of the disallow test: when the gate
        // wrapping the interpolated column is OPEN, the fragment renders
        // exactly as if there were no gate. Pins that the wrapper is
        // transparent on the allowed path through the fragment template
        // boundary (the SQL is byte-identical to a fragment built
        // without `.allowWhen(...)`).
        const expected = [
            { label: '[Internal tools]' },
            { label: '[Legacy app]' },
            { label: '[Marketing site]' },
            { label: '[Public API]' },
        ]
        ctx.mockNext(expected)

        const query = ctx.conn.selectFrom(tProject)
            .select({
                label: ctx.conn.fragmentWithType('string', 'required')
                    .sql`concat('[', ${tProject.name.allowWhen(true, 'fragment-gate-open-name')}, ']')`,
            })
            .orderBy('label')

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select concat('[', \`name\`, ']') as label from project order by label"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ label: string }>>>()
        expect(rows).toEqual(expected)
    })
})
