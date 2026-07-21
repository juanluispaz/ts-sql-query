// A `Values` view whose `with name(cols) as (values ...)` clause hoists
// through three builder positions, each pinned by that prefix in its snapshot:
//
//   - `projectingOptionalValuesAsNullable()` over a `selectFrom(Values)` whose
//     row set carries an OPTIONAL column: the nullable projector flips the
//     optional leaf from absent (`note?: string`) to present-null (`note:
//     string | null`), so a null VALUES cell reads back as `null`.
//   - a `Values` used as the SELECT source of an INSERT ... FROM SELECT: the
//     values view's WITH clause bubbles up through `InsertQueryBuilder` to the
//     top of the emitted `INSERT ... SELECT ... FROM name` statement.
//   - a `Values` used as the USING source of a DELETE ... USING: the same
//     WITH-hoist through `DeleteQueryBuilder` (`DELETE ... USING name WHERE ...`).
//
// DELETE ... USING is not typed on SqliteConnection and Oracle has no
// WITH-before-DELETE, so the DELETE ... USING test is NOT-APPLICABLE there.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Values } from '../../../../../src/Values.js'
import { DBConnection, tCalendarYear, tCountry } from '../../domain/connection.js'
import { ctx } from './setup.js'

// A values row set with a required `id` and an OPTIONAL `note`, so a null
// `note` cell exercises the nullable-projector null flip.
class VOptNoteSampler extends Values<DBConnection, 'optNoteSampler'> {
    id   = this.column('int')
    note = this.optionalColumn('string')
}

// A values row set matching tCalendarYear's insertable columns (provided int
// PK `yearValue` + required `label`), used as an INSERT ... FROM SELECT source.
class VNewYears extends Values<DBConnection, 'newYears'> {
    yearValue = this.column('int')
    label     = this.column('string')
}

// A values row set of country codes, used as a DELETE ... USING source.
class VCountryCodes extends Values<DBConnection, 'countryCodes'> {
    code = this.column('string')
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('projecting-optional-values-as-nullable-over-values-source', async () => {
        // `projectingOptionalValuesAsNullable()` immediately after the select
        // over a `Values` whose `note` column is OPTIONAL. The projector only
        // changes the TS type (SQL unchanged): the optional `note` becomes a
        // required `string | null`, so row 2's null VALUES cell reads back as
        // present-null instead of being dropped.
        const expected = [
            { id: 1, note: 'alpha' },
            { id: 2, note: null },
        ]
        ctx.mockNext(expected)
        const v = Values.create(VOptNoteSampler, 'optNoteSampler', [
            { id: 1, note: 'alpha' },
            { id: 2, note: null },
        ])
        const rows = await ctx.conn.selectFrom(v)
            .select({ id: v.id, note: v.note })
            .projectingOptionalValuesAsNullable()
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with optNoteSampler(id, note) as (values (?, ?), (?, ?)) select id as id, note as note from optNoteSampler order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "alpha",
            2,
            null,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; note: string | null }>>>()
        expect(rows).toEqual(expected)
        // Row 2's null note is PRESENT-NULL under the nullable projector.
        expect('note' in rows[1]!).toBe(true)
        expect(rows[1]!.note).toBe(null)
    })

    test('values-as-insert-from-select-source', async () => {
        // A `Values` fed as the SELECT source of INSERT … FROM SELECT. The
        // values view's WITH clause hoists to the top of the INSERT, so the
        // statement reads `with newYears(...) as (values ...) insert into
        // calendar_year (...) select ... from newYears`. Two fresh years are
        // inserted (seed holds 2023/2024), so the affected count is 2 and the
        // read-back inside the rollback returns exactly the two new rows.
        ctx.mockNext(2)              // affected rows from the INSERT
        ctx.mockNext([              // rows from the read-back SELECT
            { yearValue: 2025, label: 'FY2025' },
            { yearValue: 2026, label: 'FY2026' },
        ])
        await ctx.withRollback(async () => {
            const newYears = Values.create(VNewYears, 'newYears', [
                { yearValue: 2025, label: 'FY2025' },
                { yearValue: 2026, label: 'FY2026' },
            ])
            const source = ctx.conn.selectFrom(newYears)
                .select({ yearValue: newYears.yearValue, label: newYears.label })

            const affected = await ctx.conn.insertInto(tCalendarYear)
                .from(source)
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into calendar_year (year_value, year_label) with newYears(yearValue, label) as (values (?, ?), (?, ?)) select yearValue as yearValue, label as label from newYears"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2025,
                "FY2025",
                2026,
                "FY2026",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(2)

            const inserted = await ctx.conn.selectFrom(tCalendarYear)
                .where(tCalendarYear.yearValue.in([2025, 2026]))
                .select({ yearValue: tCalendarYear.yearValue, label: tCalendarYear.label })
                .orderBy('yearValue')
                .executeSelectMany()
            assertType<Exact<typeof inserted, Array<{ yearValue: number; label: string }>>>()
            expect(inserted).toEqual([
                { yearValue: 2025, label: 'FY2025' },
                { yearValue: 2026, label: 'FY2026' },
            ])
        })
    })

    // TODO[LIMITATION]: see LIMITATIONS.md — a WITH clause prefixing an UPDATE/DELETE (CTE-on-DML) is only accepted on MariaDB 12.3+; every earlier release rejects it with ER_PARSE_ERROR (1064).
    /*
    test('values-as-delete-using-source', async () => {
        // A `Values` fed as the USING source of DELETE … USING. The values
        // view's WITH clause hoists to the top of the DELETE, so the statement
        // reads `with countryCodes(code) as (values ...) delete from country
        // using countryCodes where country.code = countryCodes.code`. Country
        // 'JP' is the single matched row, so the affected count is 1 and the
        // read-back inside the rollback confirms 'JP' is gone.
        ctx.mockNext(1)   // affected rows from the DELETE
        ctx.mockNext([])  // read-back SELECT: no 'JP' row remains
        await ctx.withRollback(async () => {
            const targets = Values.create(VCountryCodes, 'countryCodes', [
                { code: 'JP' },
            ])
            const affected = await ctx.conn.deleteFrom(tCountry)
                .using(targets)
                .where(tCountry.code.equals(targets.code))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"with countryCodes(code) as (values (?)) delete from country using country, countryCodes where country.code = countryCodes.code"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "JP",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)

            const remaining = await ctx.conn.selectFrom(tCountry)
                .where(tCountry.code.equals('JP'))
                .select({ code: tCountry.code })
                .executeSelectMany()
            assertType<Exact<typeof remaining, Array<{ code: string }>>>()
            expect(remaining).toEqual([])
        })
    })
    */
})

// Tests referencing these are commented out above with TODO[LIMITATION]
// markers; keep the bindings referenced so noUnusedLocals stays green.
void VCountryCodes; void tCountry
