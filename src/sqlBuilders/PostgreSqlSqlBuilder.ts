import type { ToSql, SelectData, WithValuesData, OrderByEntry, FlatQueryColumns } from './SqlBuilder.js'
import { flattenQueryColumns } from './SqlBuilder.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import { CustomBooleanTypeAdapter } from '../TypeAdapter.js'
import { AbstractSqlBuilder, type SelectColumnSql } from './AbstractSqlBuilder.js'
import type { DBColumn } from '../utils/Column.js'
import { __columnPathsOf } from '../utils/columnPaths.js'
import { isColumn, __getColumnOfObject, __getColumnPrivate } from '../utils/Column.js'
import type { AnyValueSource, ValueType, __AggregatedArrayColumns } from '../expressions/values.js'
import { __getValueSourcePrivate, __isBooleanValueSource, isValueSource } from '../expressions/values.js'
import { isDefault } from '../expressions/Default.js'
import { __getTableOrViewPrivate } from '../utils/ITableOrView.js'
import { __conversionType, __typeCategoryOf } from '../utils/typeCategory.js'
import { postgreSqlParamType } from '../utils/postgreSqlParamTypes.js'

export class PostgreSqlSqlBuilder extends AbstractSqlBuilder {
    postgreSql: true = true
    override _appendGroupBySelectColumn(_entry: AnyValueSource, selectColumn: SelectColumnSql, _params: any[], _isOutermostQuery: boolean): string {
        // The same SQL as the select list: a numbered placeholder ($1) can be repeated, and it is the same expression
        return selectColumn.sql
    }
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
        name = this._resultColumnKey(name)
        if (name.toLocaleLowerCase() !== name) {
            // Avoid automatically lowercase identifiers by postgresql when it contains uppercase characters
            return this._forceAsIdentifier(name)
        }
        return this._escape(name, true)
    }
    /*
     * PostgreSQL keeps the first 63 bytes of an identifier and silently drops the rest, so the column of a long path
     * wouldn't be found in the row. A long alias is written as its beginning and a hash of the whole name.
     */
    override _resultColumnKey(name: string): string {
        const encoder = new TextEncoder()
        if (encoder.encode(name).length <= 63) {
            return name
        }
        let hash = 0x811c9dc5 // FNV-1a
        for (const byte of encoder.encode(name)) {
            hash = Math.imul(hash ^ byte, 0x01000193)
        }
        let result = ''
        for (const char of name) {
            if (encoder.encode(result + char).length > 50) {
                break
            }
            result += char
        }
        return result + '_' + (hash >>> 0).toString(16)
    }
    override _appendColumnValue(value: AnyValueSource, params: any[], isOutermostQuery: boolean): string {
        const valueSourcePrivate = __getValueSourcePrivate(value)
        if (valueSourcePrivate.isConstValue()) {
            return this._appendSql(value, params, true)
        }
        return super._appendColumnValue(value, params, isOutermostQuery)
    }
    override _typedOperand<T>(operand: T, otherOperands: any[], operation?: string): T {
        // A const is a parameter, `unknown` to PostgreSQL until something next to it gives it a type: a column, an
        // expression. When every other operand is a parameter too, some operations fail or compute on text
        // (`$1 + $2`, `$1 < $2`, `coalesce($1, $2)`, `greatest($1, $2)`, `sum($1)`, a uuid or a date compared with
        // `=`); only there the const is written with its type. Next to a typed operand, in an operation that
        // resolves `unknown` well (a single overload, a string read as text) or in one that casts the operand
        // itself, it stays a bare parameter.
        if (!isValueSource(operand)) {
            return operand
        }
        const operandPrivate = __getValueSourcePrivate(operand)
        if (!operandPrivate.isConstValue()) {
            return operand
        }
        if (operation !== undefined) {
            // An aggregated array (`json_agg($1)`, `json_build_object('a', $1)`) has no operation and always needs it
            if (operandPrivate.__valueType === 'string' || !this._operationNeedsTypedConst(operation, operand, operandPrivate.__valueType, otherOperands)) {
                return operand
            }
        }
        if (otherOperands.some(other => this._isTypedOperand(other))) {
            return operand
        }
        const typed = Object.create(operand as object)
        typed.__forceTypeCast = true
        return typed
    }
    _operationNeedsTypedConst(operation: string, operand: unknown, valueType: ValueType, otherOperands: any[]): boolean {
        switch (operation) {
            case '_add':
            case '_subtract':
            case '_multiply':
            case '_lessThan':
            case '_greaterThan':
            case '_lessOrEqual':
            case '_greaterOrEqual':
            case '_between':
            case '_notBetween':
            case '_minimumBetweenTwoValues':
            case '_maximumBetweenTwoValues':
            case '_valueWhenNull':
            case '_nullIfValue':
            case '_count':
            case '_countDistinct':
            case '_max':
            case '_min':
            case '_sum':
            case '_sumDistinct':
            case '_average':
            case '_averageDistinct':
            case '_anyValue':
                return true
            case '_divide':
                // An exact division casts the dividend to double itself
                return this._numericKindOf(operand) === 'approximate' || this._numericKindOf(otherOperands[0]) === 'approximate'
            case '_modulo':
                // The fractional form casts its operands to numeric itself
                return !this._moduloRequiresFloatHandling(valueType, otherOperands[0])
            case '_equals':
            case '_notEquals':
            case '_is':
            case '_isNot':
            case '_in':
            case '_notIn':
                // Compared as text, a uuid ignores the case and a date the time of day it was sent with
                switch (valueType) {
                    case 'uuid':
                    case 'customUuid':
                    case 'localDate':
                    case 'localTime':
                    case 'localDateTime':
                    case 'customLocalDate':
                    case 'customLocalTime':
                    case 'customLocalDateTime':
                        return true
                }
                return false
        }
        return false
    }
    _isTypedOperand(operand: any): boolean {
        if (Array.isArray(operand)) {
            return operand.some(element => this._isTypedOperand(element))
        }
        return isValueSource(operand) && !__getValueSourcePrivate(operand).isConstValue()
    }
    override _forceTypeCastInCallArguments(): boolean {
        // The drivers send the parameters untyped, and PostgreSQL can't choose an overload by an unknown type
        // (`function mod(unknown, unknown) is not unique`)
        return true
    }
    override _buildWithValues(withValues: WithValuesData, params: any[]) {
        let result = withValues.__name
        let columns = ''
        for (const columnName of __columnPathsOf(withValues.__getTableOrView())) {
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
            for (const columnName of __columnPathsOf(withValues.__getTableOrView())) {
                const column = __getColumnOfObject(withValues.__getTableOrView(), columnName)
                if (!column) {
                    continue
                }
                if (valueSql) {
                    valueSql += ', '
                }
                valueSql += this._appendSetValue(columnName, i, column, value[columnName], params, true)
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
        // expression (see `_appendOrderByColumnForExpression`)
        const wrapped = this._appendOrderByColumnForExpression(entry, query, params)
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
                result += "'" + prop + "', " + this._appendAggregatedArrayValueProjection(columns[prop]!, this._appendSql(this._typedOperand(columns[prop]!, []), params, false))
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
    override _asNullValue(params: any[], columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // A null of a type PostgreSQL knows is a parameter that carries its type, written as a cast or sent with it by
        // the query runner: a bare null has none where the position gives it none (a row of a union, a Values row, a
        // case). A null of any other type stays a literal null, that PostgreSQL resolves as text where it can't infer it.
        if (postgreSqlParamType(columnTypeName, __typeCategoryOf(columnType), null)) {
            return this._appendParam(null, params, columnType, columnTypeName, typeAdapter, true)
        }
        return super._asNullValue(params, columnType, columnTypeName, typeAdapter)
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
            return 'mod((' + this._appendSql(valueSource, params, false) + ')::numeric, (' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ')::numeric)'
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
        return 'log((' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ')::numeric, (' + this._appendSql(valueSource, params, false) + ')::numeric)'
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
        const receiver = this._appendSql(valueSource, params, false)
        const integerScale = this._isIntegerOperand(value, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter)
        const scale = this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, !integerScale)
        if (integerScale) {
            return 'round((' + receiver + ')::numeric, ' + scale + ')'
        }
        // The scale must be an integer (`round(numeric, integer)`): a double operand or a fractional number is
        // rounded to one
        return 'round((' + receiver + ')::numeric, (' + scale + ')::int4)'
    }
    _isIntegerOperand(value: any, valueType: ValueType, valueTypeName: string, typeAdapter: TypeAdapter | undefined): boolean {
        // As sent to the database: a type adapter can turn a fractional number into an integer one
        if (typeof value === 'number') {
            return Number.isInteger(this._transformParamToDB(value, valueType, valueTypeName, typeAdapter))
        }
        if (isValueSource(value)) {
            const valuePrivate = __getValueSourcePrivate(value)
            if (valuePrivate.isConstValue()) {
                return Number.isInteger(this._transformParamToDB(valuePrivate.getConstValue(), valuePrivate.__valueType, valuePrivate.__valueTypeName, valuePrivate.__typeAdapter))
            }
            return valuePrivate.__valueType === 'int' || valuePrivate.__valueType === 'bigint' || valuePrivate.__valueType === 'customInt' || valuePrivate.__valueType === 'customBigint'
        }
        return false
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
    override _collationName(collation: string): string {
        // PostgreSQL folds an unquoted name to lowercase, and `und-x-icu` isn't valid without the quotes.
        return '"' + collation + '"'
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
        if (this._connectionConfiguration.useLikeInsteadOfIlike) {
            return super._likeInsensitive(params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' ilike ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params, false) + ' ilike ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
        }
    }
    override _notLikeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._connectionConfiguration.useLikeInsteadOfIlike) {
            return super._notLikeInsensitive(params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not ilike ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not ilike ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
        }
    }
    override _startsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._connectionConfiguration.useLikeInsteadOfIlike) {
            return super._startsWithInsensitive(params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' ilike (' +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + " || '%')" + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params, false) + ' ilike (' +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + " || '%')"
        }
    }
    override _notStartsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._connectionConfiguration.useLikeInsteadOfIlike) {
            return super._notStartsWithInsensitive(params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not ilike (' +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + " || '%')" + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not ilike (' +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + " || '%')"
        }
    }
    override _endsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._connectionConfiguration.useLikeInsteadOfIlike) {
            return super._endsWithInsensitive(params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " ilike ('%' || " +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + ') collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params, false) + " ilike ('%' || " +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
        }
    }
    override _notEndsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._connectionConfiguration.useLikeInsteadOfIlike) {
            return super._notEndsWithInsensitive(params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " not ilike ('%' || " +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + ') collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params, false) + " not ilike ('%' || " +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
        }
    }
    override _containsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._connectionConfiguration.useLikeInsteadOfIlike) {
            return super._containsInsensitive(params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " ilike ('%' || " +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + " || '%')" + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params, false) + " ilike ('%' || " +  this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + " || '%')"
        }
    }
    override _notContainsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._connectionConfiguration.useLikeInsteadOfIlike) {
            return super._notContainsInsensitive(params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
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
    override _supportDatabaseOutsideUtc(): boolean {
        return true
    }
    /**
     * With a databaseTimeZone other than UTC, the date functions of a localDateTime or a localTime give the parts in
     * UTC of its instant, which the database completes with its session (see postgreSqlZonedValueSql)
     */
    override _appendSqlForDatePartArgument(valueSource: ToSql, params: any[]): string {
        const sql = super._appendSqlForDatePartArgument(valueSource, params)
        if (!this._isDatabaseOutsideUtc() || !isValueSource(valueSource)) {
            return sql
        }
        const zoned = postgreSqlZonedValueSql(sql, __conversionType(__getValueSourcePrivate(valueSource).__valueTypeName, __typeCategoryOf(__getValueSourcePrivate(valueSource).__valueType)), this._connectionConfiguration.localTimeReferenceDate)
        return zoned ? '(' + zoned + " at time zone 'UTC')" : sql
    }
}

/**
 * The instant of a localDateTime or a localTime of a database outside UTC, as a timestamptz the database completes with
 * the zone of its session (the zone of the database): `<sql>::timestamptz`, a no-op on a timestamptz; a localTime on
 * the day of the localTimeReferenceDate, `(date '1970-01-01' + <sql>)::timestamptz` or `(current_date + <sql>)…`.
 * Undefined for any other type.
 */
export function postgreSqlZonedValueSql(sql: string, conversionType: string, localTimeReferenceDate: string | undefined): string | undefined {
    if (conversionType === 'localDateTime') {
        // A column, or a qualified one, needs no parenthesis
        return (/^[\w."]+$/.test(sql) ? sql : '(' + sql + ')') + '::timestamptz'
    }
    if (conversionType === 'localTime') {
        const day = localTimeReferenceDate === 'today' ? 'current_date' : "date '" + (localTimeReferenceDate ?? '1970-01-01') + "'"
        return '(' + day + ' + ' + sql + ')::timestamptz'
    }
    return undefined
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
