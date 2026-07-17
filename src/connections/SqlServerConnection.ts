import type { NConnection } from '../utils/sourceName.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { SqlServerSqlBuilder } from '../sqlBuilders/SqlServerSqlBuilder.js'
import { AbstractAdvancedConnection } from './AbstractAdvancedConnection.js'
import type { TransactionIsolationLevel } from './AbstractConnection.js'
import type { Default } from '../expressions/Default.js'
import { DefaultImpl } from '../expressions/Default.js'

export abstract class SqlServerConnection<NAME extends string> extends AbstractAdvancedConnection<NConnection<'sqlServer', NAME>> {

    /**
     * Minimum SQL Server version the generated SQL must support, encoded as
     * `major * 1_000_000 + minor * 1_000 + patch` (e.g. `16_000_000` for SQL
     * Server 2022, whose internal version is 16.0). Defaults to
     * `Number.POSITIVE_INFINITY` (latest). Recognized breakpoints:
     *   - `>= 16_000_000` (SQL Server 2022) — `minValue` / `maxValue` use the
     *     native `LEAST(a, b)` / `GREATEST(a, b)` as the inner expression instead
     *     of a double-evaluating `IIF(a < b, a, b)` emulation. Both are wrapped in
     *     a NULL-poisoning `CASE` (see `ignoreNullInMinAndMaxValue`), so the NULL
     *     semantics are identical across versions and only the inner form differs.
     *   - `>= 17_000_000` (SQL Server 2025) — `aggregateAsArray` and
     *     `aggregateAsArrayOfOneColumn` emit the native `json_arrayagg` /
     *     `json_object` aggregates instead of a `string_agg`-based emulation
     *     (the `Distinct` variants still use the emulation because
     *     `json_arrayagg` does not accept `DISTINCT`); `substring(...)` with
     *     no end argument emits `substring(x, start + 1)` instead of
     *     `substring(x, start + 1, len(x) - start)`; `currentDate()` emits
     *     the native `current_date` keyword instead of `cast(getdate() as
     *     date)`.
     */
    protected override compatibilityVersion: number = Number.POSITIVE_INFINITY

    /**
     * Controls whether `.length()` counts trailing blanks on SQL Server.
     *
     * `.length()` mirrors JavaScript's `String.length`, which counts trailing
     * blanks; T-SQL's `LEN()` excludes them (`len('Draft  ')` is 5, not 7). By
     * default (`false`) the builder bridges the gap with a sentinel —
     * `len(<x> + '.') - 1` — so trailing blanks are counted, character-correct
     * for every string shorter than its column's declared maximum. It fails at
     * one exact extreme: a value whose length already equals the column's
     * maximum, because T-SQL string `+` on two non-`max` character types caps the
     * result at the type's maximum and silently drops the appended sentinel, so
     * `len` returns the maximum and the `- 1` yields **maximum − 1**.
     *
     * Setting this flag to `true` drops the sentinel and emits a bare `len(<x>)`,
     * which **excludes trailing blanks** (`len('Draft  ')` = 5, T-SQL's native
     * semantics, diverging from JS `String.length`). The max-length edge then
     * disappears (`len(REPLICATE('a', 8000))` = 8000, correct) and the query is
     * lighter. It is a genuine trade, not a strict improvement — the right choice
     * for an application whose SQL Server columns hold max-length values and whose
     * data does not depend on trailing blanks.
     */
    protected excludeTrailingBlanksInLength: boolean = false

    /**
     * Keep SQL Server's native NULL handling for `.minValue(x)` / `.maxValue(x)`.
     *
     * SQL Server's `least(a, b)` / `greatest(a, b)` (2022+) and the `iif(a < b, a, b)`
     * emulation (older) both **ignore** a NULL operand and return the present value,
     * whereas the library's type declares the result optional whenever either operand
     * is optional (the same OR rule `add` / `subtract` / `concat` use) — i.e. a NULL
     * operand should propagate to a NULL result. By default (`false`) the library wraps
     * the version-appropriate inner expression in a `CASE` so a NULL operand poisons the
     * result, matching the declared type and the other dialects (MySQL / MariaDB / Oracle
     * / SQLite already propagate).
     *
     * Setting this flag to `true` keeps the bare native form, which ignores NULL. Prefer
     * {@link minValueFunction} / {@link maxValueFunction} if you want NULL propagation
     * without the operand-repeating `CASE`.
     */
    protected ignoreNullInMinAndMaxValue: boolean = false

    /**
     * Name of a user-defined SQL function that returns the **larger** of two values
     * and propagates NULL, used to emit `.minValue(x)` as `func(a, b)` instead of the
     * default NULL-poisoning `CASE`. Avoids repeating the operand (the
     * {@link OracleConnection.concatFunction} pattern). Preferred over the `CASE` when set.
     */
    protected minValueFunction?: string

    /**
     * Name of a user-defined SQL function that returns the **smaller** of two values
     * and propagates NULL, used to emit `.maxValue(x)` as `func(a, b)` instead of the
     * default NULL-poisoning `CASE`. Avoids repeating the operand. Preferred over the
     * `CASE` when set.
     */
    protected maxValueFunction?: string

    constructor(queryRunner: QueryRunner, sqlBuilder = new SqlServerSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('sqlServer')
    }

    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'snapshot' | 'serializable'): TransactionIsolationLevel {
        return [level] as any
    }

    default(): Default {
        return new DefaultImpl()
    }

    protected override transformValueToDB(value: unknown, type: string): unknown {
        if (type === 'localTime' && value instanceof Date && !isNaN(value.getTime())) {
            // A localTime parameter is bound as the driver's TIME type, whose
            // validator only accepts a Date — the default 'HH:MI:SS' string is
            // rejected with EPARAM "Invalid time". Bind the Date directly; the
            // TIME type keeps only the time-of-day (the date part is ignored),
            // exactly as localDate / localDateTime already bind their Date values.
            return value
        }
        return super.transformValueToDB(value, type)
    }
}
