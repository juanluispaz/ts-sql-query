import type { NAggregate, NConnection, NSource } from '../utils/sourceName.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { OracleSqlBuilder } from '../sqlBuilders/OracleSqlBuilder.js'
import { AbstractAdvancedConnection } from './AbstractAdvancedConnection.js'
import type { TransactionIsolationLevel } from './AbstractConnection.js'
import type { IStringValueSource, StringValueSource, ValueSourceOf } from '../expressions/values.js'
import { __getValueSourcePrivate } from '../expressions/values.js'
import { AggregateFunctions1or2ValueSource } from '../internal/ValueSourceImpl.js'
import type { SameDB } from '../utils/ITableOrView.js'
import type { Default } from '../expressions/Default.js'
import { DefaultImpl } from '../expressions/Default.js'

export abstract class OracleConnection<NAME extends string> extends AbstractAdvancedConnection<NConnection<'oracle', NAME>> {

    protected uuidStrategy: 'string' | 'custom-functions' | 'built-in' = 'built-in'

    /**
     * Keep Oracle's native NULL handling for concatenation (`.concat(...)` and the affix
     * predicates `startsWith` / `endsWith` / `contains` and their `Insensitive` variants).
     *
     * Oracle's `||` treats NULL as the empty string, so `'x' || null` is `'x'` where every
     * other supported database answers NULL. That makes `concat` return a present string
     * where its declared type says the result is optional, and — worse — it makes an affix
     * predicate built on a NULL term collapse to `like '%'` and match the whole table
     * instead of nothing. By default (`false`) the library wraps the concatenation in a
     * `CASE` so a NULL operand poisons the result, matching the declared type and the other
     * dialects (MySQL / MariaDB propagate through `concat(...)`, PostgreSQL / SQLite through
     * `||`, SQL Server through `+`). Only operands that can be NULL at build time are
     * null-checked, so a concatenation of required operands is still the bare `||`.
     *
     * Setting this flag to `true` keeps the bare native `||`, which reads NULL as the empty
     * string. Prefer {@link concatFunction} if you want NULL propagation without the
     * operand-repeating `CASE`.
     */
    protected ignoreNullInConcat: boolean = false

    /**
     * Name of a null-propagating concatenation function to emit instead of the default
     * NULL-poisoning `CASE`, so the operand is not repeated (the same trade-off
     * {@link minValueFunction} makes on other dialects). Preferred over the `CASE` when set.
     *
     * By default (unset, and with {@link ignoreNullInConcat} left `false`) the builder wraps
     * every concatenation it emits — `concat` and the affix patterns alike — in a `CASE` that
     * propagates a NULL operand, matching the other databases. That `CASE` repeats the operand
     * (once in the null check, once in the `||`); free for a column, but not for an expensive
     * value-source receiver. Set this to the name of a function you created and every
     * concatenation goes through `func(a, b)` instead, each operand appearing once. `concat`
     * and the affix predicates always move together: a `startsWith` that propagates NULL while
     * `concat` does not would only relocate the inconsistency.
     *
     * The name is yours: pass whatever you called it, package-qualified if it lives in a
     * package (which it must, if you want the overloads that keep CLOB values from being
     * truncated). See the Oracle page of the documentation for an implementation.
     */
    protected concatFunction?: string

    /**
     * Collation forced on the **match** operands of `.replaceAll(...)`.
     *
     * Oracle's `REPLACE` honours the session collation, so on a database configured
     * case-insensitive (`NLS_COMP=LINGUISTIC` with a `..._CI` / `..._AI` sort)
     * `'ABCabc'.replaceAll('abc', 'X')` matches **both** cases and returns `'XX'`, corrupting the
     * value. By default the library pins the **binary/code-point** collation (`BINARY`) so
     * `replaceAll` is case-sensitive whichever collation the session uses, and resets the result
     * with `collate USING_NLS_COMP` so the forced collation does not leak into a chained comparison:
     *
     * ```sql
     * replace(<src> collate BINARY, <from> collate BINARY, <to>) collate USING_NLS_COMP
     * ```
     *
     * Set it to another collation name to force a different one, or to the **empty string**
     * `''` to opt out entirely and emit the bare native `replace(<src>, <from>, <to>)` (which
     * follows the session collation — case-sensitive by default, `BINARY`, on Oracle).
     */
    protected replaceCollation: string = 'BINARY'

    /**
     * Collation forced on the **match** operands of `.replaceAllInsensitive(...)`.
     *
     * Oracle's default collation is case-sensitive (`BINARY`), so a bare `replace()` would not
     * fold case — `.replaceAllInsensitive(...)` needs a case-insensitive collation forced on the
     * operands. When {@link insensitiveCollation} names a collation, that one is used (so a shared
     * language collation carries over); otherwise this value is forced, defaulting to Oracle's
     * neutral case-insensitive `BINARY_CI`, with a `USING_NLS_COMP` reset so it does not leak
     * downstream:
     *
     * ```sql
     * replace(<src> collate BINARY_CI, <from> collate BINARY_CI, <to>) collate USING_NLS_COMP
     * ```
     *
     * Set it to another collation name to force a different one (e.g. `BINARY_AI` to also fold
     * accents), or to the **empty string** `''` to opt out and emit the bare native
     * `replace(<src>, <from>, <to>)` (which follows the session collation — case-sensitive by
     * default on Oracle). Setting {@link insensitiveCollation} to `''` opts out the same way.
     */
    protected replaceInsensitiveCollation: string = 'BINARY_CI'

    /**
     * Minimum Oracle Database version the generated SQL must support, encoded as
     * `major * 1_000_000 + minor * 1_000 + patch` (e.g. `23_009_000` for Oracle
     * Database 23.9). Defaults to `Number.POSITIVE_INFINITY` (latest). Recognized
     * breakpoints:
     *   - `>= 23_004_000` (Oracle Database 23ai) — the [[Values]] feature emits
     *     the SQL-standard `WITH name(cols) AS (VALUES (…), …)` table constructor
     *     introduced in 23ai. On older Oracle versions ts-sql-query emulates it
     *     as `WITH name(cols) AS (SELECT … FROM dual UNION ALL SELECT … FROM
     *     dual)` so the feature still works.
     *
     * Independent of `compatibilityVersion`, `stringConcatDistinct` emits
     * `LISTAGG(DISTINCT …)`, which requires Oracle Database 19c or later (the
     * `DISTINCT` keyword inside `LISTAGG` was added in 19c).
     */
    protected override compatibilityVersion: number = Number.POSITIVE_INFINITY

    constructor(queryRunner: QueryRunner, sqlBuilder = new OracleSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('oracle')
    }

    stringConcatDistinct<SOURCE extends NSource>(value: IStringValueSource<SOURCE, any> & SameDB<NConnection<'oracle', NAME>>): StringValueSource<SOURCE | NAggregate<NConnection<'oracle', NAME>>, 'optional'>
    stringConcatDistinct<SOURCE extends NSource>(value: IStringValueSource<SOURCE, any> & SameDB<NConnection<'oracle', NAME>>, separator: string): StringValueSource<SOURCE | NAggregate<NConnection<'oracle', NAME>>, 'optional'>
    stringConcatDistinct(value: ValueSourceOf<any>, separator?: string): ValueSourceOf<any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1or2ValueSource('_stringConcatDistinct', separator, value, valuePrivate.__valueType, valuePrivate.__valueTypeName, 'optional', valuePrivate.__typeAdapter)
    }

    default(): Default {
        return new DefaultImpl()
    }

    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable'): TransactionIsolationLevel
    isolationLevel(accessMode: 'read write' | 'read only'): TransactionIsolationLevel
    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable' | 'read write' | 'read only'): TransactionIsolationLevel {
        if (level === 'read write' || level === 'read only') {
            return [undefined, level] as any
        }
        return [level] as any
    }

    protected override transformValueToDB(value: unknown, type: string): unknown {
        if (type === 'boolean' && typeof value === 'boolean') {
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number#number_coercion
            return Number(value);
        }
        if (type === 'localTime' && value instanceof Date && !isNaN(value.getTime())) {
            // Oracle has no TIME type, so a localTime is carried in a TIMESTAMP
            // anchored at 1970-01-01 (the same anchor used when reading it back).
            // The default marshalling sends a bare 'HH24:MI:SS' string, which
            // Oracle feeds through its implicit string→DATE conversion — that has
            // no month component and raises ORA-01843. Binding a Date instead lets
            // oracledb send it as a TIMESTAMP, exactly like localDateTime already does.
            return new Date(1970, 0, 1, value.getHours(), value.getMinutes(), value.getSeconds(), value.getMilliseconds())
        }
        return super.transformValueToDB(value, type)
    }
}
