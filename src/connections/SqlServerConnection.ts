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
     *   - `>= 16_000_000` (SQL Server 2022) — `minBetweenTwoValues` /
     *     `maxBetweenTwoValues` emit native `LEAST(a, b)` / `GREATEST(a, b)`
     *     instead of a double-evaluating `IIF(a < b, a, b)` emulation.
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
