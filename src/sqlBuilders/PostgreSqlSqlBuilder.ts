import type { ToSql, SelectData, WithValuesData, OrderByEntry, FlatQueryColumns } from './SqlBuilder.js'
import { flattenQueryColumns } from './SqlBuilder.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import { CustomBooleanTypeAdapter } from '../TypeAdapter.js'
import { AbstractSqlBuilder } from './AbstractSqlBuilder.js'
import type { DBColumn } from '../utils/Column.js'
import { isColumn, __getColumnOfObject, __getColumnPrivate } from '../utils/Column.js'
import type { AnyValueSource, ValueType, __AggregatedArrayColumns } from '../expressions/values.js'
import { __getValueSourcePrivate, __isBooleanValueSource, isValueSource } from '../expressions/values.js'
import { isDefault } from '../expressions/Default.js'
import { __getTableOrViewPrivate } from '../utils/ITableOrView.js'

export class PostgreSqlSqlBuilder extends AbstractSqlBuilder {
    postgreSql: true = true
    override _isReservedKeyword(word: string): boolean {
        return word.toUpperCase() in reservedWords
    }
    override _cbrt(params: any[], valueSource: ToSql): string {
        return 'cbrt(' + this._appendSql(valueSource, params, false) + ')'
    }
    override _useUpdateOldValueInFrom(): boolean {
        // PostgreSQL 18 added native OLD/NEW qualifiers to the RETURNING clause
        // (INSERT/UPDATE/DELETE/MERGE), so the FROM-subquery trick used by older
        // versions to capture pre-update values is no longer needed.
        return this._connectionConfiguration.compatibilityVersion < 18_000_000
    }
    override _appendRawColumnName(column: DBColumn, params: any[]): string {
        // PostgreSQL 18+: a column reference on a `.oldValues()` table-or-view is
        // emitted as `old.col` inside RETURNING. Bare references to the updated
        // table emit unqualified column names, which is the post-update value.
        if (this._connectionConfiguration.compatibilityVersion >= 18_000_000) {
            const columnPrivate = __getColumnPrivate(column)
            const tableOrView = columnPrivate.__tableOrView
            if (__getTableOrViewPrivate(tableOrView).__oldValues) {
                return 'old.' + this._escape(columnPrivate.__name, true)
            }
        }
        return super._appendRawColumnName(column, params)
    }
    override _appendColumnAlias(name: string, params: any[]): string {
        if (!this._isWithGeneratedFinished(params)) {
            // Avoid quote identifiers when the with clause is generated
            return this._escape(name, true)
        }
        if (this._isAggregateArrayWrapped(params)) {
            // Avoid quote identifiers when the aggregate array query wrapper is generated
            return this._escape(name, true)
        }
        if (name.toLocaleLowerCase() !== name) {
            // Avoid automatically lowercase identifiers by postgresql when it contains uppercase characters
            return this._forceAsIdentifier(name)
        }
        return this._escape(name, true)
    }
    override _appendColumnValue(value: AnyValueSource, params: any[], isOutermostQuery: boolean): string {
        const valueSourcePrivate = __getValueSourcePrivate(value)
        if (valueSourcePrivate.isConstValue()) {
            return this._appendSql(value, params, true)
        }
        return super._appendColumnValue(value, params, isOutermostQuery)
    }
    override _buildWithValues(withValues: WithValuesData, params: any[]) {
        let result = withValues.__name
        let columns = ''
        for (var columnName in withValues) {
            const column = __getColumnOfObject(withValues.__getTableOrView(), columnName)
            if (!column) {
                continue
            }
            if (columns) {
                columns += ', '
            }
            const columnPrivate = __getColumnPrivate(column)
            columns += this._appendColumnAlias(columnPrivate.__name, params)
        }
        result += '(' + columns + ')'
        result += ' as (values '

        const values = withValues.__values
        let valuesSql = ''
        for (let i = 0, length = values.length; i < length; i++) {
            if (valuesSql) {
                valuesSql += ', '
            }
            const value = values[i]!
            let valueSql = ''
            for (var columnName in withValues) {
                const column = __getColumnOfObject(withValues.__getTableOrView(), columnName)
                if (!column) {
                    continue
                }
                if (valueSql) {
                    valueSql += ', '
                }
                valueSql += this._appendValueForColumn(column, value[columnName], params, true)
            }
            valuesSql += '(' + valueSql + ')'
        }
        result += valuesSql
        result += ')'
        return result
    }
    override _buildSelectLimitOffset(query: SelectData, params: any[]): string {
        let result = ''

        const limit = query.__limit
        if (limit !== null && limit !== undefined) {
            result += ' limit ' + this._appendValue(limit, params, 'int', 'int', undefined, false)
        }

        const offset = query.__offset
        if (offset !== null && offset !== undefined) {
            result += ' offset ' + this._appendValue(offset, params, 'int', 'int', undefined, false)
        }
        return result
    }
    override _appendOrderByColumnAliasInsensitive(entry: OrderByEntry, query: SelectData, params: any[]): string {
        // PostgreSQL collation identifiers are case-folded to lowercase unless
        // quoted — the built-in `"C"` / `"POSIX"` and any mixed-case ICU name
        // resolve only with the quotes. The value-source insensitive ops on
        // this builder already quote; this override aligns the ORDER BY path
        // with them so `... order by col collate "<name>"` is emitted.
        const collation = this._connectionConfiguration.insensitiveCollation
        const stringColumn = this._isStringOrderByColumn(entry, query)
        if (!stringColumn || collation === '') {
            return this._appendOrderByColumnAlias(entry, query, params)
        }
        // PostgreSQL doesn't resolve a SELECT alias inside an ORDER BY
        // expression (see `_supportOrderByColumnAliasInExpression`), so for a
        // plain select emit the alias' underlying source expression; a compound
        // query references a real result column where the alias is fine (see
        // the base method for the full rationale).
        const resolveSource = typeof entry.expression === 'string'
            && query.__type !== 'compound'
            && !this._supportOrderByColumnAliasInExpression()
        const wrapped = resolveSource
            ? this._appendOrderByColumnSourceAsInSelect(entry, query, params)
            : this._appendOrderByColumnAlias(entry, query, params)
        if (collation) {
            return wrapped + ' collate "' + collation + '"'
        }
        return 'lower(' + wrapped + ')'
    }
    override _supportOrderByColumnAliasInExpression(): boolean {
        // PostgreSQL resolves a name inside an ORDER BY expression against the
        // input columns, not the SELECT output aliases, so `lower(<alias>)`
        // fails with "column does not exist". Verified against the real engine.
        return false
    }
    override _collate(params: any[], valueSource: ToSql, collation: string): string {
        // PostgreSQL collation identifiers are case-folded to lowercase unless quoted —
        // the built-in `"C"` / `"POSIX"` / `"ucs_basic"` and any mixed-case ICU name
        // resolve only with the quotes, exactly as the `insensitiveCollation` path already
        // emits `collate "<name>"`. Parenthesis handling matches the base (`_collate` is
        // registered in `_operationsThatNeedParenthesis`).
        return this._appendSqlParenthesis(valueSource, params, false) + ' collate "' + collation + '"'
    }
    override _replaceAllInsensitive(params: any[], valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // PostgreSQL's `REPLACE` ignores collation; fold case with `regexp_replace(..., 'gi')`.
        // The `'gi'` flag is **case-only** — it cannot honour `insensitiveCollation`, a language
        // collation, or accents (a documented per-engine limitation). `g` replaces every match.
        return 'regexp_replace(' + this._appendSql(valueSource, params, false) + ', ' + this._escapeRegexpForReplace(value, params, columnType, columnTypeName, typeAdapter, false) + ', ' + this._escapeRegexpReplacement(value2, params, columnType, columnTypeName, typeAdapter, false) + ", 'gi')"
    }
    override _finalizeAggregatedArrayResult(sql: string): string {
        // node-postgres / postgres / pglite decode a `json` column with `JSON.parse`, rounding
        // every integer past 2^53, before the library sees it. Casting the aggregate to `text`
        // — a no-op reinterpret, since a `json` value is stored as text — makes the driver hand
        // back the raw JSON string, which `parseJsonPreservingNumbers` then decodes losslessly.
        return '(' + sql + ')::text'
    }
    override _appendAggragateArrayColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayDistinct: boolean, params: any[], query: SelectData | undefined): string {
        if (aggregatedArrayDistinct && !isValueSource(aggregatedArrayColumns)) {
            // PostgreSQL's `json` type has no equality operator on any
            // version, so the abstract default
            // `json_agg(distinct json_build_object(...))` fails with
            // "could not identify an equality operator for type json".
            // Build the per-row object with `jsonb_build_object` so
            // DISTINCT can use jsonb's equality; the outer `json_agg`
            // still returns a `json` array (json_agg accepts any
            // element type), so the publicly-visible result type is
            // unchanged. Equivalence is safe for this call pattern
            // because `*_build_object(k1, v1, k2, v2, ...)` with the
            // same key list is deterministic — two rows produce the
            // same canonical form iff their scalar inputs match. The
            // singleton-scalar path
            // (`aggregateAsArrayOfOneColumnDistinct`) is unaffected:
            // scalar column types have native equality and the abstract
            // emission `json_agg(distinct scalar)` works on PG.
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "', " + this._appendSql(columns[prop]!, params, false)
            }
            return 'json_agg(distinct jsonb_build_object(' + result + '))'
        }
        return super._appendAggragateArrayColumns(aggregatedArrayColumns, aggregatedArrayDistinct, params, query)
    }
    override _appendCustomBooleanRemapForColumnIfRequired(column: DBColumn, value: any, params: any[], forceTypeCast: boolean): string | null {
        const columnPrivate = __getColumnPrivate(column)
        const columnTypeAdapter = columnPrivate.__typeAdapter
        const columnTypeName = columnPrivate.__valueTypeName
        const columnType = columnPrivate.__valueType

        if (!__isBooleanValueSource(columnPrivate)) {
            return null // non-boolean
        }

        if (isDefault(value)) {
            return null // the DEFAULT sentinel is a column-level keyword, not a boolean value — let _appendValue emit it via _default(...)
        }

        if (columnTypeAdapter instanceof CustomBooleanTypeAdapter) {
            if (isColumn(value)) {
                const valuePrivate = __getColumnPrivate(value)
                const valueTypeAdapter = valuePrivate.__typeAdapter

                if (valueTypeAdapter instanceof CustomBooleanTypeAdapter) {
                    if (columnTypeAdapter.trueValue === valueTypeAdapter.trueValue && columnTypeAdapter.falseValue === valueTypeAdapter.falseValue) {
                        return this._appendRawColumnName(value, params) // same boolean as column
                    }

                    if (columnPrivate.__optionalType === 'required') {
                        // remapped
                        return 'case when ' + this._appendRawColumnName(value, params) + ' = ' + this._appendLiteralValue(valueTypeAdapter.trueValue, params) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' end'
                    } else {
                        // remapped
                        return 'case ' + this._appendRawColumnName(value, params) + ' when ' + this._appendLiteralValue(valueTypeAdapter.trueValue, params) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' when ' + this._appendLiteralValue(valueTypeAdapter.falseValue, params) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' else null end'
                    }
                } else {
                    if (columnPrivate.__optionalType === 'required') {
                        // remapped
                        return 'case when ' + this._appendConditionValue(value, params, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' end'
                    } else {
                        // remapped
                        return 'case ' + this._appendConditionValue(value, params, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' when ' + this._trueValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' when ' + this._falseValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' else null end'
                    }
                }
            } else if (isValueSource(value)) {
                // There are some boolean expressions involved
                if (columnPrivate.__optionalType === 'required') {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, params, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' end'
                } else {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, params, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' when not ' + this._appendConditionValue(value, params, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' else null end'
                }
            } else {
                if (columnPrivate.__optionalType === 'required') {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, params, columnType, columnTypeName, columnTypeAdapter, true) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' end'
                } else {
                    // remapped
                    return 'case ' + this._appendConditionValue(value, params, columnType, columnTypeName, columnTypeAdapter, true) + ' when ' + this._trueValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' when ' + this._falseValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' else null end'
                }
            }
        }

        // if value is column and its type adapter is CustomBooleanTypeAdapter append value will be required to normalize value
        // if not it is same boolean, nothing to transform here
        return null
    }
    override _appendCastAsDouble(sql: string): string {
        return sql + '::float'
    }
    override _appendCastAsInteger(sql: string): string {
        return sql + '::bigint'
    }
    override _asString(params: any[], valueSource: ToSql): string {
        // Transform an uuid to string
        return this._appendSqlParenthesis(valueSource, params, false) + '::text'
    }
    override _minimumBetweenTwoValues(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // maxValue(x) — the SMALLER of the two. PostgreSQL's `least` ignores a NULL
        // operand, contradicting the optional type the library declares; wrap it so a
        // NULL operand poisons the result. `maxValueFunction` is the user opt-in.
        return this._minAndMaxValueBetweenTwoValuesPoisoningNull(params, valueSource, value, columnType, columnTypeName, typeAdapter, this._connectionConfiguration.maxValueFunction, 'least')
    }
    override _maximumBetweenTwoValues(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // minValue(x) — the LARGER of the two. PostgreSQL's `greatest` ignores a NULL
        // operand; wrap it so a NULL operand poisons the result. `minValueFunction` is
        // the user opt-in.
        return this._minAndMaxValueBetweenTwoValuesPoisoningNull(params, valueSource, value, columnType, columnTypeName, typeAdapter, this._connectionConfiguration.minValueFunction, 'greatest')
    }
    override _asNullValue(_params: any[], _columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeAdapter && typeAdapter.transformPlaceholder) {
            return typeAdapter.transformPlaceholder('null', columnTypeName, true, null, this._defaultTypeAdapter)
        } else {
            return this._defaultTypeAdapter.transformPlaceholder('null', columnTypeName, true, null)
        }
    }
    override _modulo(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._moduloRequiresFloatHandling(columnType, value)) {
            // PostgreSQL defines neither the `%` operator nor `mod(...)` for
            // `double precision` — both exist only for integer / numeric — so
            // the inherited `<col> % <rhs>` form fails at runtime with
            // `operator does not exist: double precision % ...` (or
            // `integer % double precision` when only the right operand is double).
            // Cast both operands to numeric so `mod(numeric, numeric)` resolves
            // (the same numeric-cast strategy `_logn` / `_roundn` use). Pure
            // integer / bigint receivers and operands keep the plain `%` form below.
            return 'mod((' + this._appendSql(valueSource, params, false) + ')::numeric, (' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false) + ')::numeric)'
        }
        return super._modulo(params, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _logn(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // PostgreSQL only defines the two-argument logarithm for `numeric`:
        // `log(b numeric, x numeric) → numeric`. There is no
        // `log(double precision, double precision)` overload, and the
        // implicit numeric → double cast that helps trig functions does not
        // apply in the other direction. Moreover, the `b` argument we emit
        // is an unbound query parameter that PG types as `unknown`, which
        // does not resolve through the implicit cast — so the un-cast form
        // fails at runtime with `function log(unknown, double precision)
        // does not exist`. Cast both operands to numeric so the overload
        // resolves regardless of how the chain was built.
        return 'log((' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false) + ')::numeric, (' + this._appendSql(valueSource, params, false) + ')::numeric)'
    }
    override _roundn(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // PostgreSQL only has the `round(numeric, integer)` overload — there is
        // no `round(double precision, integer)` (the engine errors with
        // `function round(double precision, integer) does not exist`). `_divide`
        // yields a `float`, so without this wrapper `.roundn(n)` would fail at
        // runtime for the common `.divide(...).roundn(n)` pattern. Cast to
        // numeric so the overload resolves; `usePlatformDependentRound` does
        // NOT opt out here because the alternative is invalid SQL, not a
        // different tie-breaking rule. `round(numeric, s)` breaks ties away from
        // zero, the rule ts-sql-query follows on every dialect.
        return 'round((' + this._appendSql(valueSource, params, false) + ')::numeric, ' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false) + ')'
    }
    override _round(params: any[], valueSource: ToSql): string {
        // PostgreSQL has two overloads of `round`: `round(numeric)` breaks ties
        // by rounding away from zero (the rule ts-sql-query follows on every
        // dialect), while `round(double precision)` defers to libm and is
        // "platform dependent" per the PG manual — most platforms use
        // round-to-nearest-even, which makes `round(0.5)` evaluate to `0`
        // instead of `1`. `_divide` and `_asDouble` yield a `float`, so without
        // this wrapper the user-facing `.round()` would silently switch
        // tie-breaking modes depending on what came before it in the chain. Cast
        // to numeric so the behavior is portable; applications that want the
        // platform-dependent behavior can opt in via `usePlatformDependentRound`
        // on the connection.
        if (this._connectionConfiguration.usePlatformDependentRound) {
            return 'round(' + this._appendSql(valueSource, params, false) + ')'
        }
        // The cast is emitted even for an operand that is already exact, where the
        // tie-breaking rule alone wouldn't need it: it also gives the expression a
        // resolved type, which is what lets a downstream operator resolve against an
        // untyped placeholder — `round($1) % $2` is a `double precision % unknown` on
        // PostgreSQL, an operator that does not exist. It does mean `round()` answers a
        // numeric, which the drivers hand back as a string for a custom type carrying no
        // marshalling of its own.
        return 'round((' + this._appendSql(valueSource, params, false) + ')::numeric)'
    }
    override _equalsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' = ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ' collate "' + collation + '"'
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + ' = ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ') = lower(' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
        }
    }
    override _notEqualsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' <> ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ' collate "' + collation + '"'
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + ' <> ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ') <> lower(' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
        }
    }
    override _likeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' ilike ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params, false) + ' ilike ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
        }
    }
    override _notLikeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not ilike ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not ilike ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
        }
    }
    override _startsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' ilike (' +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + " || '%')" + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params, false) + ' ilike (' +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + " || '%')"
        }
    }
    override _notStartsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not ilike (' +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + " || '%')" + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not ilike (' +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + " || '%')"
        }
    }
    override _endsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " ilike ('%' || " +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + ') collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params, false) + " ilike ('%' || " +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
        }
    }
    override _notEndsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " not ilike ('%' || " +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + ') collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params, false) + " not ilike ('%' || " +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
        }
    }
    override _containsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " ilike ('%' || " +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + " || '%')" + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params, false) + " ilike ('%' || " +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + " || '%')"
        }
    }
    override _notContainsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " not ilike ('%' || " +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + " || '%')" + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params, false) + " not ilike ('%' || " +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + " || '%')"
        }
    }
    override _stringConcat(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'string_agg(' + this._appendSql(value, params, false) + ", ',')"
        } else if (separator === '') {
            return 'string_agg(' + this._appendSql(value, params, false) + ", '')"
        } else {
            return 'string_agg(' + this._appendSql(value, params, false) + ', ' + this._appendValue(separator, params, 'string', 'string', undefined, false) + ')'
        }
    }
    override _stringConcatDistinct(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'string_agg(distinct ' + this._appendSql(value, params, false) + ", ',')"
        } else if (separator === '') {
            return 'string_agg(distinct ' + this._appendSql(value, params, false) + ", '')"
        } else {
            return 'string_agg(distinct ' + this._appendSql(value, params, false) + ', ' + this._appendValue(separator, params, 'string', 'string', undefined, false) + ')'
        }
    }
    // `substr()` with a negative start does not count from the end on this dialect, and where
    // it does the out-of-range case still diverges from JS. `right()` / `left()` are exactly
    // `String.prototype.substr`'s negative-start semantics, clamp included. Only the negative
    // arms are overridden; the rest of the family is the base's.
    override _substrToEnd(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'number' && value < 0) {
            return 'right(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(-value, params, 'int', 'int', typeAdapter, false) + ')'
        }
        return super._substrToEnd(params, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _substr(params: any[], valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        value2 = this._clampSubstrCount(value2)
        if (typeof value === 'number' && value < 0) {
            return 'left(right(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(-value, params, 'int', 'int', typeAdapter, false) + '), ' + this._appendValue(value2, params, 'int', 'int', typeAdapter, false) + ')'
        }
        return super._substr(params, valueSource, value, value2, columnType, columnTypeName, typeAdapter)
    }
    // The date-part family (`_getTime` / `_getMonth` / `_getDay` / …) lives in
    // AbstractSqlBuilder, written in this dialect's form, and PostgreSQL reaches it
    // unmodified — do not re-add overrides here; change the base instead.
}

// Source: https://www.postgresql.org/docs/12/sql-keywords-appendix.html (version: 12, only the ones marked as reserved by postgreSql)
const reservedWords: { [word: string]: boolean | undefined } = {
    ALL: true,
    ANALYSE: true,
    ANALYZE: true,
    AND: true,
    ANY: true,
    ARRAY: true,
    AS: true,
    ASC: true,
    ASYMMETRIC: true,
    BOTH: true,
    CASE: true,
    CAST: true,
    CHECK: true,
    COLLATE: true,
    COLUMN: true,
    CONSTRAINT: true,
    CREATE: true,
    CURRENT_CATALOG: true,
    CURRENT_DATE: true,
    CURRENT_ROLE: true,
    CURRENT_TIME: true,
    CURRENT_TIMESTAMP: true,
    CURRENT_USER: true,
    DEFAULT: true,
    DEFERRABLE: true,
    DESC: true,
    DISTINCT: true,
    DO: true,
    ELSE: true,
    END: true,
    EXCEPT: true,
    FALSE: true,
    FETCH: true,
    FOR: true,
    FOREIGN: true,
    FROM: true,
    GRANT: true,
    GROUP: true,
    HAVING: true,
    IN: true,
    INITIALLY: true,
    INTERSECT: true,
    INTO: true,
    LATERAL: true,
    LEADING: true,
    LIMIT: true,
    LOCALTIME: true,
    LOCALTIMESTAMP: true,
    NOT: true,
    NULL: true,
    OFFSET: true,
    ON: true,
    ONLY: true,
    OR: true,
    ORDER: true,
    PLACING: true,
    PRIMARY: true,
    REFERENCES: true,
    RETURNING: true,
    SELECT: true,
    SESSION_USER: true,
    SOME: true,
    SYMMETRIC: true,
    TABLE: true,
    THEN: true,
    TO: true,
    TRAILING: true,
    TRUE: true,
    UNION: true,
    UNIQUE: true,
    USER: true,
    USING: true,
    VARIADIC: true,
    WHEN: true,
    WHERE: true,
    WINDOW: true,
    WITH: true,
    AUTHORIZATION: true,
    BINARY: true,
    COLLATION: true,
    CONCURRENTLY: true,
    CROSS: true,
    CURRENT_SCHEMA: true,
    FREEZE: true,
    FULL: true,
    ILIKE: true,
    INNER: true,
    IS: true,
    ISNULL: true,
    JOIN: true,
    LEFT: true,
    LIKE: true,
    NATURAL: true,
    NOTNULL: true,
    OUTER: true,
    OVERLAPS: true,
    RIGHT: true,
    SIMILAR: true,
    TABLESAMPLE: true,
    VERBOSE: true
}
