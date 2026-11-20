import { isPlainTemporalClass } from '../utils/plainTemporalValues.js'
import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { ToSql, SelectData, WithValuesData, OrderByEntry, FlatQueryColumns } from './SqlBuilder.js'
import { flattenQueryColumns } from './SqlBuilder.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import { CustomBooleanTypeAdapter } from '../TypeAdapter.js'
import { AbstractSqlBuilder, type SelectColumnSql, type ZonedDurationPartsSql } from './AbstractSqlBuilder.js'
import type { DBColumn } from '../utils/Column.js'
import { __columnPathsOf } from '../utils/columnPaths.js'
import { __getColumnOfObject } from '../utils/Column.js'
import { DefaultImpl } from '../expressions/Default.js'
import { __sqlFamilyOf, __temporalFieldsOf } from '../typeSystem/dataTypes.js'
import { postgreSqlParamType } from '../utils/postgreSql/postgreSqlParamTypes.js'
import { isPostgreSqlReservedWord } from '../utils/postgreSql/postgreSqlReservedWords.js'
import type { AnyValueSource, __AggregatedArrayColumns } from '../typeSystem/valueSource.js'
import { __isBooleanValueSource } from '../typeSystem/valueSource.js'
import { __isColumn, __isConst, __asDBColumnValueSource, __asNodeValueSource, isValueSource } from '../typeSystem/valueSourceFactory.js'
import { __isZonedDateTimeClass } from '../typeSystem/dataTypeQuestions.js'
import { noopValueSourceNode } from '../nodes/operations.js'
import { isZonedDateTimeValue } from '../utils/instantValues.js'
import { __temporal } from '../typeSystem/temporal.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { durationOfParts, isZeroDuration } from '../utils/durationValues.js'
import { plainTemporalDifferenceOf } from '../utils/plainTemporalDifference.js'
import { __classOf, __adaptedTypeClassOf } from '../nodes/adaptedTypeClass.js'
import { __registeredDataType } from '../typeSystem/dataTypeRegistry.js'
import { __arithmeticOperandClassOf } from '../typeSystem/dataTypeClasses.js'
import { __asTableOrViewRoot } from '../internal/TableOrViewRoot.js'

export class PostgreSqlSqlBuilder extends AbstractSqlBuilder {
    postgreSql: true = true
    override _appendGroupBySelectColumn(_entry: AnyValueSource, selectColumn: SelectColumnSql, _context: SqlBuildContext, _isOutermostQuery: boolean): string {
        // The same SQL as the select list: a numbered placeholder ($1) can be repeated, and it is the same expression
        return selectColumn.sql
    }
    override _isReservedKeyword(word: string): boolean {
        return isPostgreSqlReservedWord(word)
    }
    override _cbrt(context: SqlBuildContext, valueSource: ToSql): string {
        return 'cbrt(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _useUpdateOldValueInFrom(): boolean {
        // PostgreSQL 18 added native OLD/NEW qualifiers to the RETURNING clause
        // (INSERT/UPDATE/DELETE/MERGE), so the FROM-subquery trick used by older
        // versions to capture pre-update values is no longer needed.
        return this._connectionConfiguration.compatibilityVersion < 18_000_000
    }
    override _appendRawColumnName(column: DBColumn, context: SqlBuildContext): string {
        // PostgreSQL 18+: a column reference on a `.oldValues()` table-or-view is
        // emitted as `old.col` inside RETURNING. Bare references to the updated
        // table emit unqualified column names, which is the post-update value.
        if (__isZonedDateTimeClass(__classOf(__asNodeValueSource(column as unknown as AnyValueSource)))) {
            return this._pgZonedColumnUnsupported()
        }
        if (this._connectionConfiguration.compatibilityVersion >= 18_000_000) {
            const nodeColumn = __asDBColumnValueSource(column)
            const tableOrView = nodeColumn.__tableOrView
            if (__asTableOrViewRoot(tableOrView).__oldValues) {
                return 'old.' + this._escape(nodeColumn.__name, true)
            }
        }
        return super._appendRawColumnName(column, context)
    }
    override _appendColumnAlias(name: string, context: SqlBuildContext): string {
        if (this._isQuotedIdentifier(name)) {
            // Already quoted by the user, the way the database quotes one
            return name
        }
        if (!context.withGeneratedFinished) {
            // Avoid quote identifiers when the with clause is generated
            return this._escape(name, true)
        }
        if (context.aggregateArrayWrapped) {
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
    override _appendColumnValue(value: AnyValueSource, context: SqlBuildContext, isOutermostQuery: boolean): string {
        const nodeValueSource = __asNodeValueSource(value)
        if (nodeValueSource.isConstValue()) {
            return this._appendSql(value, context, true)
        }
        return super._appendColumnValue(value, context, isOutermostQuery)
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
        const nodeOperand = __asNodeValueSource(operand)
        if (!nodeOperand.isConstValue()) {
            return operand
        }
        if (operation !== undefined) {
            // An aggregated array (`json_agg($1)`, `json_build_object('a', $1)`) has no operation and always needs it
            if (__sqlFamilyOf(__classOf(nodeOperand)) === 'character string' || !this._operationNeedsTypedConst(operation, operand, __classOf(nodeOperand), otherOperands)) {
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
    override _typesTemporalConsts(): boolean {
        // The parts of a const are taken with extract, and two dates subtracted: they need its type
        return true
    }
    override _integerOfBigint(sql: string): string {
        return 'cast(' + sql + ' as integer)'
    }
    _operationNeedsTypedConst(operation: string, operand: unknown, typeClass: DataTypeClass, otherOperands: any[]): boolean {
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
            // The parts of a const are taken with extract, which needs its type
            case '_withFields':
            case '_withFieldsRejecting':
            case '_addDurationRejecting':
            case '_subtractDurationRejecting':
            case '_roundTemporal':
            case '_durationField':
            case '_durationSign':
            case '_durationNegated':
            case '_durationAbs':
            case '_durationTotal':
            case '_durationAdd':
            case '_durationSubtract':
                return true
            case '_divide':
                // An exact division casts the dividend to double itself
                return this._numericKindOf(operand) === 'approximate' || this._numericKindOf(otherOperands[0]) === 'approximate'
            case '_modulo':
                // The fractional form casts its operands to numeric itself
                return !this._moduloRequiresFloatHandling(typeClass, otherOperands[0])
            case '_equals':
            case '_notEquals':
            case '_is':
            case '_isNot':
            case '_in':
            case '_notIn':
                // Compared as text, a uuid ignores the case and a date the time of day it was sent with
                return __sqlFamilyOf(typeClass) === 'uuid' || __temporalFieldsOf(typeClass) !== undefined
        }
        return false
    }
    _isTypedOperand(operand: any): boolean {
        if (Array.isArray(operand)) {
            return operand.some(element => this._isTypedOperand(element))
        }
        return isValueSource(operand) && !__asNodeValueSource(operand).isConstValue()
    }
    override _forceTypeCastInCallArguments(): boolean {
        // The drivers send the parameters untyped, and PostgreSQL can't choose an overload by an unknown type
        // (`function mod(unknown, unknown) is not unique`)
        return true
    }
    override _buildWithValues(withValues: WithValuesData, context: SqlBuildContext) {
        let result = this._escape(withValues.__name, false)
        let columns = ''
        for (const columnName of __columnPathsOf(withValues.__getTableOrView())) {
            const column = __getColumnOfObject(withValues.__getTableOrView(), columnName)
            if (!column) {
                continue
            }
            if (columns) {
                columns += ', '
            }
            const nodeColumn = __asDBColumnValueSource(column)
            columns += this._appendColumnAlias(nodeColumn.__name, context)
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
                valueSql += this._appendSetValue(columnName, i, column, value[columnName], context, true)
            }
            valuesSql += '(' + valueSql + ')'
        }
        result += valuesSql
        result += ')'
        return result
    }
    override _buildSelectLimitOffset(query: SelectData, context: SqlBuildContext): string {
        let result = ''

        const limit = query.__limit
        if (limit !== null && limit !== undefined) {
            result += ' limit ' + this._appendValue(limit, context, __registeredDataType('int'), false)
        }

        const offset = query.__offset
        if (offset !== null && offset !== undefined) {
            result += ' offset ' + this._appendValue(offset, context, __registeredDataType('int'), false)
        }
        return result
    }
    override _appendOrderByColumnAliasInsensitive(entry: OrderByEntry, query: SelectData, context: SqlBuildContext): string {
        // PostgreSQL collation identifiers are case-folded to lowercase unless
        // quoted — the built-in `"C"` / `"POSIX"` and any mixed-case ICU name
        // resolve only with the quotes. The value-source insensitive ops on
        // this builder already quote; this override aligns the ORDER BY path
        // with them so `... order by col collate "<name>"` is emitted.
        const collation = this._connectionConfiguration.insensitiveCollation
        const stringColumn = this._isStringOrderByColumn(entry, query)
        if (!stringColumn || collation === '') {
            return this._appendOrderByColumnAlias(entry, query, context)
        }
        // PostgreSQL doesn't resolve a SELECT alias inside an ORDER BY
        // expression (see `_appendOrderByColumnForExpression`)
        const wrapped = this._appendOrderByColumnForExpression(entry, query, context)
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
    override _collate(context: SqlBuildContext, valueSource: ToSql, collation: string): string {
        // PostgreSQL collation identifiers are case-folded to lowercase unless quoted —
        // the built-in `"C"` / `"POSIX"` / `"ucs_basic"` and any mixed-case ICU name
        // resolve only with the quotes, exactly as the `insensitiveCollation` path already
        // emits `collate "<name>"`. Parenthesis handling matches the base (`_collate` is
        // registered in `_operationsThatNeedParenthesis`).
        return this._appendSqlParenthesis(valueSource, context, false) + ' collate "' + collation + '"'
    }
    override _replaceAllInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, typeClass: DataTypeClass): string {
        // PostgreSQL's `REPLACE` ignores collation; fold case with `regexp_replace(..., 'gi')`.
        // The `'gi'` flag is **case-only** — it cannot honour `insensitiveCollation`, a language
        // collation, or accents (a documented per-engine limitation). `g` replaces every match.
        return 'regexp_replace(' + this._appendSql(valueSource, context, false) + ', ' + this._escapeRegexpForReplace(value, context, typeClass, false) + ', ' + this._escapeRegexpReplacement(value2, context, typeClass, false) + ", 'gi')"
    }
    override _finalizeAggregatedArrayResult(sql: string): string {
        // node-postgres / postgres / pglite decode a `json` column with `JSON.parse`, rounding
        // every integer past 2^53, before the library sees it. Casting the aggregate to `text`
        // — a no-op reinterpret, since a `json` value is stored as text — makes the driver hand
        // back the raw JSON string, which `parseJsonPreservingNumbers` then decodes losslessly.
        return '(' + sql + ')::text'
    }
    override _appendAggregateArrayColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayDistinct: boolean, context: SqlBuildContext, query: SelectData | undefined): string {
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
                result += "'" + prop + "', " + this._appendAggregatedArrayValueProjection(columns[prop]!, this._appendSql(this._typedOperand(columns[prop]!, []), context, false), context)
            }
            return 'json_agg(distinct jsonb_build_object(' + result + '))'
        }
        return super._appendAggregateArrayColumns(aggregatedArrayColumns, aggregatedArrayDistinct, context, query)
    }
    override _appendCustomBooleanRemapForColumnIfRequired(column: DBColumn, value: any, context: SqlBuildContext, forceTypeCast: boolean): string | null {
        const nodeColumn = __asDBColumnValueSource(column)
        const columnTypeAdapter = nodeColumn.__typeAdapter

        if (!__isBooleanValueSource(nodeColumn)) {
            return null // non-boolean
        }

        if (value instanceof DefaultImpl) {
            return null // the DEFAULT sentinel is a column-level keyword, not a boolean value — let _appendValue emit it via _default(...)
        }

        if (columnTypeAdapter instanceof CustomBooleanTypeAdapter) {
            if (__isColumn(value)) {
                const nodeValue = __asDBColumnValueSource(value)
                const valueTypeAdapter = nodeValue.__typeAdapter

                if (valueTypeAdapter instanceof CustomBooleanTypeAdapter) {
                    if (columnTypeAdapter.trueValue === valueTypeAdapter.trueValue && columnTypeAdapter.falseValue === valueTypeAdapter.falseValue) {
                        return this._appendRawColumnName(value, context) // same boolean as column
                    }

                    if (nodeColumn.__optionalType === 'required') {
                        // remapped
                        return 'case when ' + this._appendRawColumnName(value, context) + ' = ' + this._appendLiteralValue(valueTypeAdapter.trueValue, context) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' end'
                    } else {
                        // remapped
                        return 'case ' + this._appendRawColumnName(value, context) + ' when ' + this._appendLiteralValue(valueTypeAdapter.trueValue, context) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' when ' + this._appendLiteralValue(valueTypeAdapter.falseValue, context) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' else null end'
                    }
                } else {
                    if (nodeColumn.__optionalType === 'required') {
                        // remapped
                        return 'case when ' + this._appendConditionValue(value, context, __adaptedTypeClassOf(__classOf(nodeColumn), columnTypeAdapter), forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' end'
                    } else {
                        // remapped
                        return 'case ' + this._appendConditionValue(value, context, __adaptedTypeClassOf(__classOf(nodeColumn), columnTypeAdapter), forceTypeCast) + ' when ' + this._trueValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' when ' + this._falseValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' else null end'
                    }
                }
            } else if (isValueSource(value)) {
                // There are some boolean expressions involved
                if (nodeColumn.__optionalType === 'required') {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, context, __adaptedTypeClassOf(__classOf(nodeColumn), columnTypeAdapter), forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' end'
                } else {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, context, __adaptedTypeClassOf(__classOf(nodeColumn), columnTypeAdapter), forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' when not ' + this._appendConditionValue(value, context, __adaptedTypeClassOf(__classOf(nodeColumn), columnTypeAdapter), forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' else null end'
                }
            } else {
                if (nodeColumn.__optionalType === 'required') {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, context, __adaptedTypeClassOf(__classOf(nodeColumn), columnTypeAdapter), true) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' end'
                } else {
                    // remapped
                    return 'case ' + this._appendConditionValue(value, context, __adaptedTypeClassOf(__classOf(nodeColumn), columnTypeAdapter), true) + ' when ' + this._trueValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' when ' + this._falseValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' else null end'
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
    override _asString(context: SqlBuildContext, valueSource: ToSql): string {
        // Transform an uuid to string
        return this._appendSqlParenthesis(valueSource, context, false) + '::text'
    }
    override _minimumBetweenTwoValues(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        // maxValue(x) — the SMALLER of the two. PostgreSQL's `least` ignores a NULL
        // operand, contradicting the optional type the library declares; wrap it so a
        // NULL operand poisons the result. `maxValueFunction` is the user opt-in.
        return this._minAndMaxValueBetweenTwoValuesPoisoningNull(context, valueSource, value, typeClass, this._connectionConfiguration.maxValueFunction, 'least')
    }
    override _maximumBetweenTwoValues(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        // minValue(x) — the LARGER of the two. PostgreSQL's `greatest` ignores a NULL
        // operand; wrap it so a NULL operand poisons the result. `minValueFunction` is
        // the user opt-in.
        return this._minAndMaxValueBetweenTwoValuesPoisoningNull(context, valueSource, value, typeClass, this._connectionConfiguration.minValueFunction, 'greatest')
    }
    override _asNullValue(context: SqlBuildContext, typeClass: DataTypeClass): string {
        // A null of a type PostgreSQL knows is a parameter that carries its type, written as a cast or sent with it by
        // the query runner: a bare null has none where the position gives it none (a row of a union, a Values row, a
        // case). A null of any other type stays a literal null, that PostgreSQL resolves as text where it can't infer it.
        if (postgreSqlParamType(typeClass, null)) {
            const sent = this._transformParamToDB(null, typeClass, context, true)
            return this._appendParam(sent, context, typeClass, true)
        }
        return super._asNullValue(context, typeClass)
    }
    override _modulo(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._moduloRequiresFloatHandling(typeClass, value)) {
            // PostgreSQL defines neither the `%` operator nor `mod(...)` for
            // `double precision` — both exist only for integer / numeric — so
            // the inherited `<col> % <rhs>` form fails at runtime with
            // `operator does not exist: double precision % ...` (or
            // `integer % double precision` when only the right operand is double).
            // Cast both operands to numeric so `mod(numeric, numeric)` resolves
            // (the same numeric-cast strategy `_logn` / `_roundn` use). Pure
            // integer / bigint receivers and operands keep the plain `%` form below.
            return 'mod((' + this._appendSql(valueSource, context, false) + ')::numeric, (' + this._appendValue(value, context, __arithmeticOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value)) + ')::numeric)'
        }
        return super._modulo(context, valueSource, value, typeClass)
    }
    override _logn(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
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
        return 'log((' + this._appendValue(value, context, __arithmeticOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value)) + ')::numeric, (' + this._appendSql(valueSource, context, false) + ')::numeric)'
    }
    override _roundn(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        // PostgreSQL only has the `round(numeric, integer)` overload — there is
        // no `round(double precision, integer)` (the engine errors with
        // `function round(double precision, integer) does not exist`). `_divide`
        // yields a `float`, so without this wrapper `.roundn(n)` would fail at
        // runtime for the common `.divide(...).roundn(n)` pattern. Cast to
        // numeric so the overload resolves; `usePlatformDependentRound` does
        // NOT opt out here because the alternative is invalid SQL, not a
        // different tie-breaking rule. `round(numeric, s)` breaks ties away from
        // zero, the rule ts-sql-query follows on every dialect.
        const receiver = this._appendSql(valueSource, context, false)
        const roundnScale = this._roundnScale(value, typeClass)
        const integerScale = this._isIntegerOperand(roundnScale.value, roundnScale.typeClass)
        const scale = this._appendValue(roundnScale.value, context, roundnScale.typeClass, !integerScale)
        if (integerScale) {
            return 'round((' + receiver + ')::numeric, ' + scale + ')'
        }
        // The scale must be an integer (`round(numeric, integer)`): a double operand or a fractional number is
        // rounded to one
        return 'round((' + receiver + ')::numeric, (' + scale + ')::int4)'
    }
    override _round(context: SqlBuildContext, valueSource: ToSql): string {
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
            return 'round(' + this._appendSql(valueSource, context, false) + ')'
        }
        // The cast is emitted even for an operand that is already exact, where the
        // tie-breaking rule alone wouldn't need it: it also gives the expression a
        // resolved type, which is what lets a downstream operator resolve against an
        // untyped placeholder — `round($1) % $2` is a `double precision % unknown` on
        // PostgreSQL, an operator that does not exist. It does mean `round()` answers a
        // numeric, which the drivers hand back as a string for a type of the user carrying no
        // marshalling of its own.
        return 'round((' + this._appendSql(valueSource, context, false) + ')::numeric)'
    }
    override _collationName(collation: string): string {
        // PostgreSQL folds an unquoted name to lowercase, and `und-x-icu` isn't valid without the quotes.
        return '"' + collation + '"'
    }
    override _equalsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' = ' + this._appendValueParenthesis(value, context, typeClass, false) + ' collate "' + collation + '"'
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' = ' + this._appendValueParenthesis(value, context, typeClass, false)
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') = lower(' + this._appendValue(value, context, typeClass, false) + ')'
        }
    }
    override _notEqualsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' <> ' + this._appendValueParenthesis(value, context, typeClass, false) + ' collate "' + collation + '"'
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' <> ' + this._appendValueParenthesis(value, context, typeClass, false)
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') <> lower(' + this._appendValue(value, context, typeClass, false) + ')'
        }
    }
    override _likeInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._connectionConfiguration.useLikeInsteadOfIlike) {
            return super._likeInsensitive(context, valueSource, value, typeClass)
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' ilike ' + this._appendValueParenthesis(value, context, typeClass, false) + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, context, false) + ' ilike ' + this._appendValueParenthesis(value, context, typeClass, false)
        }
    }
    override _notLikeInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._connectionConfiguration.useLikeInsteadOfIlike) {
            return super._notLikeInsensitive(context, valueSource, value, typeClass)
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not ilike ' + this._appendValueParenthesis(value, context, typeClass, false) + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not ilike ' + this._appendValueParenthesis(value, context, typeClass, false)
        }
    }
    override _startsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._connectionConfiguration.useLikeInsteadOfIlike) {
            return super._startsWithInsensitive(context, valueSource, value, typeClass)
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' ilike (' +  this._escapeLikeWildcard(value, context, typeClass, false) + " || '%')" + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, context, false) + ' ilike (' +  this._escapeLikeWildcard(value, context, typeClass, false) + " || '%')"
        }
    }
    override _notStartsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._connectionConfiguration.useLikeInsteadOfIlike) {
            return super._notStartsWithInsensitive(context, valueSource, value, typeClass)
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not ilike (' +  this._escapeLikeWildcard(value, context, typeClass, false) + " || '%')" + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not ilike (' +  this._escapeLikeWildcard(value, context, typeClass, false) + " || '%')"
        }
    }
    override _endsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._connectionConfiguration.useLikeInsteadOfIlike) {
            return super._endsWithInsensitive(context, valueSource, value, typeClass)
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + " ilike ('%' || " +  this._escapeLikeWildcard(value, context, typeClass, false) + ') collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, context, false) + " ilike ('%' || " +  this._escapeLikeWildcard(value, context, typeClass, false) + ')'
        }
    }
    override _notEndsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._connectionConfiguration.useLikeInsteadOfIlike) {
            return super._notEndsWithInsensitive(context, valueSource, value, typeClass)
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + " not ilike ('%' || " +  this._escapeLikeWildcard(value, context, typeClass, false) + ') collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, context, false) + " not ilike ('%' || " +  this._escapeLikeWildcard(value, context, typeClass, false) + ')'
        }
    }
    override _containsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._connectionConfiguration.useLikeInsteadOfIlike) {
            return super._containsInsensitive(context, valueSource, value, typeClass)
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + " ilike ('%' || " +  this._escapeLikeWildcard(value, context, typeClass, false) + " || '%')" + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, context, false) + " ilike ('%' || " +  this._escapeLikeWildcard(value, context, typeClass, false) + " || '%')"
        }
    }
    override _notContainsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._connectionConfiguration.useLikeInsteadOfIlike) {
            return super._notContainsInsensitive(context, valueSource, value, typeClass)
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + " not ilike ('%' || " +  this._escapeLikeWildcard(value, context, typeClass, false) + " || '%')" + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, context, false) + " not ilike ('%' || " +  this._escapeLikeWildcard(value, context, typeClass, false) + " || '%')"
        }
    }
    override _stringConcat(context: SqlBuildContext, separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'string_agg(' + this._appendSql(value, context, false) + ", ',')"
        } else if (separator === '') {
            return 'string_agg(' + this._appendSql(value, context, false) + ", '')"
        } else {
            return 'string_agg(' + this._appendSql(value, context, false) + ', ' + this._appendValue(separator, context, __registeredDataType('string'), false) + ')'
        }
    }
    override _stringConcatDistinct(context: SqlBuildContext, separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'string_agg(distinct ' + this._appendSql(value, context, false) + ", ',')"
        } else if (separator === '') {
            return 'string_agg(distinct ' + this._appendSql(value, context, false) + ", '')"
        } else {
            return 'string_agg(distinct ' + this._appendSql(value, context, false) + ', ' + this._appendValue(separator, context, __registeredDataType('string'), false) + ')'
        }
    }
    // `substr()` with a negative start does not count from the end on this dialect, and where
    // it does the out-of-range case still diverges from JS. `right()` / `left()` are exactly
    // `String.prototype.substr`'s negative-start semantics, clamp included. Only the negative
    // arms are overridden; the rest of the family is the base's.
    override _substrToEnd(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (typeof value === 'number' && value < 0) {
            return 'right(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(-value, context, __registeredDataType('int'), false) + ')'
        }
        return super._substrToEnd(context, valueSource, value, typeClass)
    }
    override _substr(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, typeClass: DataTypeClass): string {
        value2 = this._clampSubstrCount(value2)
        if (typeof value === 'number' && value < 0) {
            return 'left(right(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(-value, context, __registeredDataType('int'), false) + '), ' + this._appendValue(value2, context, __registeredDataType('int'), false) + ')'
        }
        return super._substr(context, valueSource, value, value2, typeClass)
    }
    // The date-part family (`_epochMilliseconds` / `_monthFromZero` / `_dayOfWeekFromSunday` / …) lives in
    // AbstractSqlBuilder, written in this dialect's form, and PostgreSQL reaches it
    // unmodified — do not re-add overrides here; change the base instead.
    /*
     * A zoned date and time: PostgreSQL keeps no zone with a value, so a zoned date and time is computed in the query,
     * never a column: its SQL is its instant, a timestamptz, which compares, orders and groups it as Temporal's compare;
     * its zone is known when the query is built, from the operation that computed it (_pgZoneOf)
     */
    override _supportZonedDateTimes(): boolean {
        return true
    }
    /** A column can't be a zonedDateTime: PostgreSQL would keep its instant without its zone */
    override _appendColumnName(column: DBColumn, context: SqlBuildContext): string {
        if (__isZonedDateTimeClass(__classOf(__asNodeValueSource(column as unknown as AnyValueSource)))) {
            return this._pgZonedColumnUnsupported()
        }
        return super._appendColumnName(column, context)
    }
    _pgZonedColumnUnsupported(): never {
        throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_QUERY' }, 'PostgreSQL keeps no time zone with a value: a column can\'t be a zonedDateTime; keep its instant in a timestamptz and its zone in a text, and compute it with toZonedDateTimeISO')
    }
    /**
     * The zone of a zoned date and time, as `at time zone` takes it (see _zonedTimeZoneSql): the one of the operation
     * that computed it (toZonedDateTimeISO, toZonedDateTime, withTimeZone), of a value, or of the zoned date and time
     * its arithmetic starts from. Any other one (a column, valueWhenNull, a case, an aggregate, a column of a subquery)
     * has no zone the query knows
     */
    _pgZoneOf(context: SqlBuildContext, zoned: ToSql): string {
        let node: any = isValueSource(zoned) ? __asNodeValueSource(zoned as unknown as AnyValueSource) : undefined
        while (node) {
            if (__isConst(node)) {
                const value = (node as unknown as { __value: unknown }).__value
                if (isZonedDateTimeValue(value)) {
                    return this._zonedTimeZoneSql(context, value.timeZoneId)
                }
                break
            }
            switch (node.__operation) {
                case '_instantToZoned':
                case '_plainDateTimeToZoned':
                    return this._zonedTimeZoneSql(context, node.__value)
                case '_zonedOfWallClockIn':
                    node = isValueSource(node.__value) ? __asNodeValueSource(node.__value) : undefined
                    continue
                case '_zonedAddDuration':
                case '_zonedSubtractDuration':
                case '_zonedAddDurationRejecting':
                case '_zonedSubtractDurationRejecting':
                case '_zonedRoundToDay':
                case '_zonedOperandReference':
                    node = node.__valueSource
                    continue
            }
            if (node.__node === noopValueSourceNode) {
                node = node.__valueSource
                continue
            }
            break
        }
        throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_QUERY' }, 'PostgreSQL keeps no time zone with a value: the zone of a zoned date and time is known only where the query computes it, with toZonedDateTimeISO, toZonedDateTime, withTimeZone, a value or its arithmetic')
    }
    /**
     * A time zone where `at time zone` takes it: the name Temporal checked as Temporal writes it, as a text; an offset
     * as an interval (PostgreSQL reads a text like '+05:30' as a POSIX zone, west of UTC); a string of the query as it
     * is (see _pgWallAt)
     */
    override _zonedTimeZoneSql(context: SqlBuildContext, value: unknown): string {
        const zone = __isConst(value) ? (value as unknown as { __value: unknown }).__value : value
        if (typeof zone === 'string') {
            const id = new (__temporal('zonedDateTime').ZonedDateTime)(0n, zone).timeZoneId
            return (id.startsWith('+') || id.startsWith('-') ? "interval '" : "'") + id.replace(/'/g, "''") + "'"
        }
        return this._appendSqlParenthesis(value as ToSql, context, false)
    }
    /** The text of a zone (see _zonedTimeZoneSql): its name, its offset, or the string of the query */
    _pgZoneText(zone: string): string {
        return zone.startsWith("interval '") ? zone.slice('interval '.length) : zone
    }
    /**
     * The wall clock of a timestamptz in a zone (see _zonedTimeZoneSql). A string of the query is an offset when it
     * starts with its sign, which PostgreSQL reads as a POSIX zone, west of UTC: its sign is inverted
     */
    _pgWallAt(timestamptz: string, zone: string): string {
        if (zone.startsWith("'") || zone.startsWith("interval '")) {
            return '(' + timestamptz + ' at time zone ' + zone + ')'
        }
        return '(' + timestamptz + ' at time zone (case when ' + zone + " ~ '^[+-]' then translate(" + zone + ", '+-', '-+') else " + zone + ' end))'
    }
    /**
     * PostgreSQL pulls a subquery up into the query that uses it, writing its value again in each place it is used,
     * unless it has an offset: without it a chain of operations would be planned with an exponential expression
     */
    override _zonedComputedOnceFence(): string {
        return ' offset 0'
    }
    override _zonedZoneOf(context: SqlBuildContext, zoned: ToSql, _sql: string): string {
        return this._pgZoneOf(context, zoned)
    }
    override _zonedUtcOf(sql: string): string {
        return '(' + sql + " at time zone 'UTC')"
    }
    override _zonedWallOf(sql: string, zone: string): string {
        return this._pgWallAt(sql, zone)
    }
    override _zonedWallOfUtc(utc: string, zone: string): string {
        return this._pgWallAt('(' + utc + " at time zone 'UTC')", zone)
    }
    override _zonedOfUtc(utc: string, _zone: string): string {
        return '(' + utc + ") at time zone 'UTC'"
    }
    /** `timestamp at time zone` gives the later instant of a wall clock the zone repeats, and moves one it skips forward */
    override _zonedLaterOfWallClock(wall: string, zone: string): string | undefined {
        return this._zonedUtcOf(this._pgWallAt(wall, zone))
    }
    /** A wall clock that is not a name, nor the wall clock of a name in a zone given, is computed once */
    override _zonedNamesWallClock(wall: string): boolean {
        return !/^(?:[\w."]+|\([\w."]+ at time zone (?:interval )?'[^']*'\))$/.test(wall)
    }
    override _zonedDayInterval(): string {
        return "interval '1 day'"
    }
    override _zonedSecondsInterval(seconds: string): string {
        return 'make_interval(secs => ' + seconds + ')'
    }
    override _zonedMidnightOf(wall: string, nextDay: boolean): string {
        return "date_trunc('day', " + wall + ')' + (nextDay ? " + interval '1 day'" : '')
    }
    override _zonedHoursOf(interval: string): string {
        return '(extract(epoch from ' + interval + ') / 3600)::float8'
    }
    /** A wall clock plus the months (the day kept in the month, as PostgreSQL adds them, or rejected) and the days of a duration */
    override _zonedWallPlusDate(context: SqlBuildContext, wall: string, months: string | undefined, days: string | undefined, reject: boolean): string {
        let added = wall + ' + make_interval(' + (months === undefined ? '' : 'months => ' + months + (days === undefined ? '' : ', ')) + (days === undefined ? '' : 'days => ' + days) + ')'
        if (reject && months !== undefined) {
            // The day of the value in the month reached, checked, minus the day of the value: no day
            const monthIndex = '(extract(year from ' + wall + ')::integer * 12 + extract(month from ' + wall + ')::integer - 1 + ' + months + ')'
            const checkedDay = this._validDayOrError(context, this._truncatedDivision(monthIndex, '12'), this._integerRemainder(monthIndex, '12') + ' + 1', 'extract(day from ' + wall + ')::integer')
            added = this._shiftDays(context, added, '(' + checkedDay + ' - extract(day from ' + wall + ')::integer)', 'timestamp')
        }
        return '(' + added + ')'
    }
    /**
     * The parts of a duration (multiplied by sign) a zoned date and time adds (see ZonedDurationPartsSql): an interval
     * keeps its months, its days and its time apart, so 28 hours are a time, as in Temporal
     */
    override _zonedDurationParts(context: SqlBuildContext, value: unknown, sign: 1 | -1): ZonedDurationPartsSql | undefined {
        const int = __registeredDataType('int')
        if (!isValueSource(value)) {
            const parts = this._constantDurationParts(value, __registeredDataType('zonedDateTime'), 'timestamp', sign)!
            if (isZeroDuration(parts)) {
                return undefined
            }
            return {
                months: parts.months === 0 ? undefined : this._appendValue(parts.months, context, int, false),
                days: parts.days === 0 ? undefined : this._appendValue(parts.days, context, int, false),
                seconds: parts.seconds === 0 && parts.nanoseconds === 0 ? undefined : this._appendValue(durationOfParts({ months: 0, days: 0, seconds: parts.seconds, nanoseconds: parts.nanoseconds }, 'duration'), context, __registeredDataType('duration'), true),
                hasDate: undefined,
            }
        }
        const duration = __asNodeValueSource(value as AnyValueSource) as unknown as ToSql
        const sql = this._isZonedOperandWrittenInPlace(duration) ? this._appendSqlParenthesis(duration, context, false) : 'tsq_z.d'
        const negative = sign < 0 ? '-' : ''
        if (this._isDurationKeptAsText(duration)) {
            const months = this._durationPartFunctionName() + '(' + sql + ", 'M')::integer"
            const days = this._durationPartFunctionName() + '(' + sql + ", 'D')::integer"
            const seconds = 'make_interval(secs => ' + negative + this._durationPartFunctionName() + '(' + sql + ", 'S') + " + negative + this._durationPartFunctionName() + '(' + sql + ", 'N') / 1000000000.0)"
            return { months: negative + months, days: negative + days, seconds, hasDate: months + ' <> 0 or ' + days + ' <> 0' }
        }
        const months = '(extract(year from ' + sql + ') * 12 + extract(month from ' + sql + '))::integer'
        const days = 'extract(day from ' + sql + ')::integer'
        return { months: negative + months, days: negative + days, seconds: negative + '(' + sql + " - date_trunc('day', " + sql + '))', hasDate: months + ' <> 0 or ' + days + ' <> 0' }
    }
    /** The SQL of a zoned date and time, its instant: a value with its type (a timestamptz) */
    _pgZonedSql(context: SqlBuildContext, valueSource: ToSql): string {
        return this._appendSqlParenthesis(valueSource, context, this._isConstOperand(valueSource))
    }
    /** A zoned date and time is its instant, a timestamptz */
    override _zonedToInstant(context: SqlBuildContext, valueSource: ToSql): string {
        return this._pgZonedSql(context, valueSource)
    }
    override _zonedToPlainDateTime(context: SqlBuildContext, valueSource: ToSql): string {
        return this._pgWallAt(this._pgZonedSql(context, valueSource), this._pgZoneOf(context, valueSource))
    }
    /** The name of its zone: a name given, as Temporal writes it; a string of the query, as it is */
    override _zonedTimeZoneId(context: SqlBuildContext, valueSource: ToSql): string {
        return this._pgZoneText(this._pgZoneOf(context, valueSource))
    }
    /** Its offset at its instant, as Temporal writes it: `+01:00`, with its seconds when it has them (`-00:14:44`) */
    override _zonedOffset(context: SqlBuildContext, valueSource: ToSql): string {
        const zoned = this._pgZonedSql(context, valueSource)
        const zone = this._pgZoneOf(context, valueSource)
        let result = "(select case when o.s < 0 then '-' else '+' end || lpad((abs(o.s) / 3600)::text, 2, '0') || ':' || lpad((abs(o.s) / 60 % 60)::text, 2, '0')"
        result += " || case when abs(o.s) % 60 <> 0 then ':' || lpad((abs(o.s) % 60)::text, 2, '0') else '' end"
        return result + ' from (select extract(epoch from ' + this._pgWallAt(zoned, zone) + ' - ' + this._zonedUtcOf(zoned) + ')::integer as s) o)'
    }
    override _zonedOffsetNanoseconds(context: SqlBuildContext, valueSource: ToSql): string {
        const zoned = this._pgZonedSql(context, valueSource)
        return '(extract(epoch from ' + this._pgWallAt(zoned, this._pgZoneOf(context, valueSource)) + ' - ' + this._zonedUtcOf(zoned) + ') * 1000000000)::bigint'
    }
    /** The instant in a zone: the instant itself, a timestamptz; the zone is the one of the query (see _pgZoneOf) */
    override _instantToZoned(context: SqlBuildContext, valueSource: ToSql, _value: any, _typeClass: DataTypeClass): string {
        const sql = this._appendSql(valueSource, context, this._isConstOperand(valueSource))
        // A parameter with its type, and the instant of a zoned date and time, are already a timestamptz
        if (/^\$\d+::timestamptz$/.test(sql) || (isValueSource(valueSource) && (__asNodeValueSource(valueSource as unknown as AnyValueSource) as { __operation?: unknown }).__operation === '_zonedToInstant')) {
            return sql
        }
        return (/^(?:[\w."]+|\$\d+)$/.test(sql) ? sql : '(' + sql + ')') + '::timestamptz'
    }
    override _zonedInUtc(context: SqlBuildContext, valueSource: ToSql): string {
        return this._zonedUtcOf(this._pgZonedSql(context, valueSource))
    }
    /**
     * The duration from one zoned date and time to another in days or larger units, as Temporal's `until` (or `since`),
     * with the function of the library tsq_zoned_until, which receives the instant and the zone of each one
     */
    override _zonedUntil(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, _typeClass: DataTypeClass): string {
        return this._pgZonedDifference(context, valueSource, value, value2, false)
    }
    override _zonedSince(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, _typeClass: DataTypeClass): string {
        return this._pgZonedDifference(context, valueSource, value, value2, true)
    }
    _pgZonedDifference(context: SqlBuildContext, valueSource: ToSql, other: ToSql, options: unknown, since: boolean): string {
        const difference = plainTemporalDifferenceOf(options, 'timestamp', since, 'hour')
        if (!difference) {
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: options, typeName: 'duration' }, 'Invalid options of ' + (since ? 'since' : 'until') + ': ' + JSON.stringify(options))
        }
        let result = 'tsq_zoned_until(' + this._pgZonedSql(context, valueSource) + ', ' + this._pgZoneText(this._pgZoneOf(context, valueSource)) + ', '
        result += this._pgZonedSql(context, other) + ', ' + this._pgZoneText(this._pgZoneOf(context, other)) + ', '
        return result + "'" + difference.largestUnit + "', '" + difference.smallestUnit + "', " + difference.increment + ", '" + difference.mode + "', " + (difference.negated ? '-1' : '1') + ')'
    }
    /**
     * A zoned date and time leaves the database as the text Temporal reads: its instant in UTC with all its digits and
     * its era, and its zone in brackets (null for a null instant: PostgreSQL concatenates a null as a null)
     */
    override _appendResultColumnProjection(value: AnyValueSource, sql: string, context: SqlBuildContext): string {
        if (isValueSource(value) && __isZonedDateTimeClass(__classOf(__asNodeValueSource(value)))) {
            if (sql === '') {
                // Only whether the column is converted is asked
                return 'zonedDateTime'
            }
            const zone = this._pgZoneText(this._pgZoneOf(context, value as unknown as ToSql))
            const instant = /^(?:[\w."]+|\$\d+(?:::timestamptz)?)$/.test(sql) ? sql : '(' + sql + ')'
            const bracketed = zone.startsWith("'") ? "'[" + zone.slice(1, -1) + "]'" : "'[' || " + zone + " || ']'"
            return "to_char(" + instant + " at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\" BC') || " + bracketed
        }
        return super._appendResultColumnProjection(value, sql, context)
    }
    override _supportDatabaseOutsideUtc(): boolean {
        return true
    }
    /**
     * The wall clock in UTC of an instant: with a databaseTimeZone other than UTC, its timestamptz (a value without zone
     * completed with the session) at time zone 'UTC'
     */
    override _instantInUtc(context: SqlBuildContext, valueSource: ToSql): string {
        return this._appendSqlForDatePartArgument(valueSource, context)
    }
    override _instantOfUtc(_context: SqlBuildContext, sql: string): string {
        return this._isDatabaseOutsideUtc() ? '(' + sql + ") at time zone 'UTC'" : sql
    }
    /**
     * With a databaseTimeZone other than UTC, the date functions of a localDateTime or a localTime give the parts in
     * UTC of its instant, which the database completes with its session (see postgreSqlZonedValueSql)
     */
    override _appendSqlForDatePartArgument(valueSource: ToSql, context: SqlBuildContext): string {
        const sql = super._appendSqlForDatePartArgument(valueSource, context)
        if (!this._isDatabaseOutsideUtc() || !isValueSource(valueSource)) {
            return sql
        }
        const nodeValueSource = __asNodeValueSource(valueSource)
        const zoned = postgreSqlZonedValueSql(sql, __classOf(nodeValueSource), this._connectionConfiguration.localTimeReferenceDate)
        return zoned ? '(' + zoned + " at time zone 'UTC')" : sql
    }
}

/**
 * The instant of a localDateTime, a localTime or an instant of a database outside UTC, as a timestamptz the database completes with
 * the zone of its session (the zone of the database): `<sql>::timestamptz`, a no-op on a timestamptz; a localTime on
 * the day of the localTimeReferenceDate, `(date '1970-01-01' + <sql>)::timestamptz` or `(current_date + <sql>)…`.
 * Undefined for any other type.
 */
export function postgreSqlZonedValueSql(sql: string, typeClass: DataTypeClass, localTimeReferenceDate: string | undefined): string | undefined {
    if (isPlainTemporalClass(typeClass) || __isZonedDateTimeClass(typeClass)) {
        // A Temporal value without zone is a wall clock: nothing completes it; a zoned date and time is a timestamptz
        return undefined
    }
    const fields = __temporalFieldsOf(typeClass)
    if (fields === 'timestamp') {
        // A parameter of a database outside UTC is already a timestamptz
        if (/^\$\d+::timestamptz$/.test(sql)) {
            return sql
        }
        // A column, a qualified one, or a parameter, needs no parenthesis
        return (/^(?:[\w."]+|\$\d+)$/.test(sql) ? sql : '(' + sql + ')') + '::timestamptz'
    }
    if (fields === 'time') {
        const day = localTimeReferenceDate === 'today' ? 'current_date' : "date '" + (localTimeReferenceDate ?? '1970-01-01') + "'"
        return '(' + day + ' + ' + sql + ')::timestamptz'
    }
    return undefined
}
