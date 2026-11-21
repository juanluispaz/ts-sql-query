import { instantRoundingOf } from '../utils/instantOptions.js'
import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import { TypeAdapterContextImpl } from '../internal/TypeAdapterContextImpl.js'
import type { QueryParamContextImpl } from '../internal/QueryContextImpl.js'
import { RawFragmentImpl } from '../internal/RawFragmentImpl.js'
import { operationsThatNeedParenthesis, type OperationsThatNeedParenthesis } from '../utils/operationsThatNeedParenthesis.js'
import type { ToSql, SqlBuilder, DeleteData, InsertData, UpdateData, SelectData, PlainSelectData, CompoundSelectData, SqlOperation, WithQueryData, CompoundOperator, JoinData, QueryColumns, FlatQueryColumns, WithSelectData, WithValuesData, OrderByEntry } from './SqlBuilder.js'
import { flattenQueryColumns, getQueryColumn } from './SqlBuilder.js'
import type { AnyTableOrView } from '../utils/ITableOrView.js'
import { __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import { DefaultImpl } from '../expressions/Default.js'
import type { DBColumn } from '../utils/Column.js'
import { __columnPathsOf } from '../utils/columnPaths.js'
import type { DefaultTypeAdapter, ProjectionComparison, ProjectionOutput, DataTypeClass } from '../TypeAdapter.js'
import { CustomBooleanTypeAdapter } from '../TypeAdapter.js'
import type { ConnectionConfiguration } from '../queryRunners/QueryRunner.js'
import { __createSequence, __typeClassOf, __isAggregateValueAsArray, __isAllowWhenAggregateValueAsArray, __isColumn, __asDBColumnValueSource, __asNodeValueSource, isValueSource } from '../typeSystem/valueSourceFactory.js'
import { hasToSql, operationOf } from './SqlBuilder.js'
import { __getColumnOfObject } from '../utils/Column.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { getWithData, hasWithData, isWithValuesData } from './SqlBuilder.js'
import type { RawFragment } from '../utils/RawFragment.js'
import { TsSqlError, TsSqlProcessingError } from '../TsSqlError.js'
import { isUtcTimeZoneName } from '../utils/processTimeZone.js'
import { __durationSqlDataTypeOf, __isIntegerSql, __isJsonDocumentSql, __sqlFamilyOf, __temporalFieldsOf } from '../typeSystem/dataTypes.js'
import { type DurationTotalDate, type DurationTotalUnit } from '../utils/durationTotal.js'
import type { SqlOperation0ValueSource, SqlOperation2ValueSource } from '../nodes/operations.js'
import { __temporalIfAvailable, type TemporalDuration } from '../typeSystem/temporal.js'
import { durationOfArgument, durationOfParts, durationPartsFor, isZeroDuration, type DurationParts, type DurationPartsSql } from '../utils/durationValues.js'
import { plainTemporalFieldsOf, type PlainTemporalFields } from '../utils/plainTemporalFields.js'
import { dateOfStoredTimesOf, dayOfStoredYearMonthsOf, yearOfStoredMonthDaysOf } from '../utils/temporalReference.js'
import { plainTemporalRoundingOf, type PlainTemporalRounding } from '../utils/plainTemporalRounding.js'
import type { ZonedInterpretation } from '../utils/zonedOptions.js'
import { plainTemporalDifferenceOf, type PlainTemporalDifference, type PlainTemporalDifferenceFields } from '../utils/plainTemporalDifference.js'
import { __reusedConstOf } from '../nodes/constants.js'
import type { AnyValueSource, IExecutableDeleteQuery, IExecutableInsertQuery, IExecutableSelectQuery, IExecutableUpdateQuery, __AggregatedArrayColumns } from '../typeSystem/valueSource.js'
import { __getValueSourceOfObject, __isBooleanValueSource, __isStringValueSource } from '../typeSystem/valueSource.js'
import type { AggregatedArrayType } from '../typeSystem/aggregatedArrays.js'
import type { ILogicalValueSource, IValueSource, ValueSource } from '../typeSystem/base.js'
import type { BooleanType } from '../typeSystem/logical.js'
import type { EqualableType } from '../typeSystem/equalable.js'
import { UuidTextType } from '../typeSystem/uuidText.js'
import { __classOf, __adaptedTypeClassOf, __unadaptedClassOf, __sqlDataTypeOf } from '../nodes/adaptedTypeClass.js'
import { __isIntClass, __isPlainYearMonthClass, __isZonedDateTimeClass } from '../typeSystem/dataTypeQuestions.js'
import { isZonedDateTimeValue } from '../utils/instantValues.js'
import { __registeredDataType } from '../typeSystem/dataTypeRegistry.js'
import { __arithmeticOperandClassOf, __valueOperandClassOf } from '../typeSystem/dataTypeClasses.js'
import { __asTableOrViewRoot } from '../internal/TableOrViewRoot.js'

/** A column of the select list as it was written, for the group by that refers to it */
// `name`: the alias of the column; `paramsStart` / `paramsEnd`: the range of the params the column's SQL consumed
export type SelectColumnSql = { sql: string, name: string, position: number, paramsStart: number, paramsEnd: number, shadowedByGroupByColumn?: boolean | undefined }

function isIntersectOperator(operator: CompoundOperator): boolean {
    return operator === 'intersect' || operator === 'intersectAll'
}

/** An entry of an order by as an operand: the column it names written where it is used, again in each place (see _appendOrderByColumnForExpression) */
class OrderByEntryOperand implements ToSql {
    readonly entry: OrderByEntry
    readonly query: SelectData
    constructor(entry: OrderByEntry, query: SelectData) {
        this.entry = entry
        this.query = query
    }
    __toSql(sqlBuilder: SqlBuilder, context: SqlBuildContext): string {
        return (sqlBuilder as unknown as AbstractSqlBuilder)._appendOrderByColumnForExpression(this.entry, this.query, context)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, context: SqlBuildContext): string {
        return this.__toSql(sqlBuilder, context)
    }
}

/** The instant of a zoned date and time kept as text, as an operand of a comparison (see _isZonedTextComparison) */
export class ZonedTextInstantOperand implements ToSql {
    readonly valueSource: ToSql
    constructor(valueSource: ToSql) {
        this.valueSource = valueSource
    }
    __toSql(sqlBuilder: SqlBuilder, context: SqlBuildContext): string {
        return (sqlBuilder as unknown as AbstractSqlBuilder)._zonedToInstant(context, this.valueSource)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, context: SqlBuildContext): string {
        return this.__toSql(sqlBuilder, context)
    }
}

/**
 * The other operand of a comparison of a zoned date and time kept as text, as an instant: a Temporal value, its instant
 * (sent as an instant); a value source, its instant; each one of a list; anything else (a null) as it is
 */
export function __zonedTextInstantValue(value: unknown): unknown {
    if (isZonedDateTimeValue(value)) {
        return value.toInstant()
    }
    if (isValueSource(value)) {
        return new ZonedTextInstantOperand(value as unknown as ToSql)
    }
    if (Array.isArray(value)) {
        return value.map(__zonedTextInstantValue)
    }
    return value
}

export class AbstractSqlBuilder implements SqlBuilder {
    // @ts-ignore
    _defaultTypeAdapter: DefaultTypeAdapter
    /** The next a type adapter receives: the type adapter of the requested type, if any, and then the connection */
    // @ts-ignore
    _nextTypeAdapter: DefaultTypeAdapter
    // @ts-ignore
    _queryRunner: QueryRunner
    // @ts-ignore
    _connectionConfiguration: ConnectionConfiguration
    _operationsThatNeedParenthesis: OperationsThatNeedParenthesis = operationsThatNeedParenthesis
    /** The name of a table or view as it is written in the query (a generated name gets the one it has there) */
    _tableOrViewName(tableRoot: { __name: string, __generatedName?: boolean | undefined }, context: SqlBuildContext): string {
        return tableRoot.__generatedName ? context.generatedNameOf(tableRoot.__name) : tableRoot.__name
    }
    /** Sets the table or view whose columns are written without its name; a dialect may refuse one */
    _setSafeTableOrView(context: SqlBuildContext, tableOrView: AnyTableOrView | undefined): void {
        context.safeTableOrView = tableOrView
    }
    /** The alias, in the wrapped select, of a column the wrapper converts when it passes on every column */
    _resultConversionInnerAlias(property: string): string {
        return property + '_tsq_raw'
    }
    /** The column is converted in the outermost query (`_appendResultColumnProjection` changes it) */
    _isConvertedResultColumn(value: AnyValueSource, context: SqlBuildContext): boolean {
        return this._appendResultColumnProjection(value, '', context) !== ''
    }
    /**
     * The column is converted in the outermost query, and its converted SQL doesn't compare like the value
     * (its `comparison` is `'none'`): where the query compares it, it must use the value, not the converted SQL
     */
    _needsTheValueOfResultColumnToCompare(value: AnyValueSource, context: SqlBuildContext): boolean {
        return this._isConvertedResultColumn(value, context) && this._projectionComparison(value, 'resultColumn') === 'none'
    }
    /**
     * The column is converted in the outermost query, and its converted SQL doesn't compare like the value of another
     * column or expression (its `comparison` is `'columnEquality'` or `'none'`): where the query compares it with
     * other values, like the arms of a compound query, it must use the value
     */
    _needsTheValueOfResultColumnToCompareAcrossColumns(value: AnyValueSource, context: SqlBuildContext): boolean {
        if (!this._isConvertedResultColumn(value, context)) {
            return false
        }
        const comparison = this._projectionComparison(value, 'resultColumn')
        return comparison === 'none' || comparison === 'columnEquality'
    }
    /**
     * The column is converted in the outermost query, and its converted SQL doesn't order like the value
     * (its `comparison` isn't `'value'`): where the query orders it, it must use the value, not the converted SQL
     */
    _needsTheValueOfResultColumnToOrder(value: AnyValueSource, context: SqlBuildContext): boolean {
        return this._isConvertedResultColumn(value, context) && this._projectionComparison(value, 'resultColumn') !== 'value'
    }
    /** A select of the query, or of one of its compound queries, adds columns of its own (`beforeColumns`) */
    _hasCustomizedColumns(query: SelectData): boolean {
        if (query.__type === 'compound') {
            return this._hasCustomizedColumns(query.__firstQuery) || this._hasCustomizedColumns(query.__secondQuery)
        }
        return !!query.__customization?.beforeColumns
    }
    // Read in the query runner
    _getContainsInsertReturningClause(context: SqlBuildContext): boolean | undefined {
        return context.queryContext.containsInsertReturningClause
    }
    _setContainsInsertReturningClause(context: SqlBuildContext, value: boolean | undefined): void {
        context.queryContext.containsInsertReturningClause = value
    }
    // Read in the query runner (AbstractQueryRunner.executeMutationReturning).
    // Set to `false` when the outermost mutation's returning projection collapses
    // to nothing (an empty `returning({})`), so the emitted SQL has no returning
    // clause. The runner then executes it as a plain mutation instead of pushing a
    // no-data statement through the data-returning driver path — which strict
    // drivers reject (better-sqlite3) and others answer with a driver result header
    // instead of rows (mysql2, mariadb). Only set for the outermost query, whose
    // statement is the one actually executed.
    _setContainsMutationReturningClause(context: SqlBuildContext, value: boolean | undefined): void {
        context.queryContext.containsMutationReturningClause = value
    }
    // Read in the query runner (see AbstractQueryRunner.getForcedAffectedRowCount).
    // Set when the affected-row count is known while building the query but the
    // driver can't report it at execution time (Oracle's multi-row INSERT, which
    // is emitted as an anonymous PL/SQL block — Oracle drivers don't populate
    // rowsAffected for PL/SQL blocks). The query runner returns this value as the
    // affected-row count instead of the driver's (absent) one.
    _setForcedAffectedRowCount(context: SqlBuildContext, value: number | undefined): void {
        context.queryContext.forcedAffectedRowCount = value
    }
    _ensureRootQuery(query: SelectData | InsertData | UpdateData | DeleteData, context: SqlBuildContext) {
        if (!context.rootQuery) {
            context.rootQuery = query
        }
    }
    _isCurrentRootQuery(query: SelectData | InsertData | UpdateData | DeleteData, context: SqlBuildContext) {
        return context.rootQuery === query
    }
    _resetRootQuery(query: SelectData | InsertData | UpdateData | DeleteData, context: SqlBuildContext) {
        if (context.rootQuery === query) {
            context.rootQuery = undefined
        }
    }
    _isValue(value: any): boolean {
        if (value === null || value === undefined) {
            return false
        }
        if (!this._connectionConfiguration.allowEmptyString && value === '') {
            return false
        }
        if (Array.isArray(value) && value.length <= 0) {
            return false
        }
        return true
    }
    _isReservedKeyword(_word: string): boolean {
        return false
    }
    _forceAsIdentifier(identifier: string): string {
        return '"' + identifier + '"'
    }
    /** The identifier is already quoted the way the database quotes one (`_forceAsIdentifier`): it is written as it is */
    _isQuotedIdentifier(identifier: string): boolean {
        const quotes = this._forceAsIdentifier('')
        return identifier.length > quotes.length && identifier.startsWith(quotes.slice(0, quotes.length / 2)) && identifier.endsWith(quotes.slice(quotes.length / 2))
    }
    /**
     * The name of an identifier without the quotes of the database, to compose another identifier with it (the alias
     * `<table>__<column>` of the old values of an update): `"plan"` is `plan`, `[s].[t]` is `s.t`
     */
    _identifierWithoutQuotes(identifier: string): string {
        const quotes = this._forceAsIdentifier('')
        let result = identifier
        for (const quote of new Set(quotes)) {
            result = result.split(quote).join('')
        }
        return result
    }
    _escape(identifier: string, strict: boolean, allowReservedKeyword?: boolean): string {
        return this._connectionConfiguration.escape(identifier, strict, allowReservedKeyword)
    }
    _needParenthesis(value: any): boolean {
        const operation = operationOf(value)
        if (!operation) {
            return false
        }
        if (this._operationsThatNeedParenthesis[operation]) {
            return true
        }
        return false
    }
    _needParenthesisExcluding(value: any, excluding: keyof SqlOperation): boolean {
        const operation = operationOf(value)
        if (!operation) {
            return false
        }
        if (operation === excluding) {
            return false
        }
        if (this._operationsThatNeedParenthesis[operation]) {
            return true
        }
        return false
    }
    _appendColumnName(column: DBColumn, context: SqlBuildContext): string {
        const nodeColumn = __asDBColumnValueSource(column)
        const typeAdapter = nodeColumn.__typeAdapter
        if (__isBooleanValueSource(nodeColumn) && typeAdapter instanceof CustomBooleanTypeAdapter) {
            return '(' + this._appendRawColumnName(column, context) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, context) + ')'
        }
        return this._appendRawColumnName(column, context)
    }
    _appendColumnNameForCondition(column: DBColumn, context: SqlBuildContext): string {
        const nodeColumn = __asDBColumnValueSource(column)
        const typeAdapter = nodeColumn.__typeAdapter
        if (__isBooleanValueSource(nodeColumn) && typeAdapter instanceof CustomBooleanTypeAdapter) {
            return this._appendRawColumnName(column, context) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, context)
        }
        return this._appendRawColumnName(column, context)
    }
    _appendRawColumnName(column: DBColumn, context: SqlBuildContext): string {
        const nodeColumn = __asDBColumnValueSource(column)
        const tableOrView = nodeColumn.__tableOrView
        const tableRoot = __asTableOrViewRoot(tableOrView)

        const forceAliasFor = context.forceAliasFor
        const forceAliasAs = context.forceAliasAs
        const fakeNamesOf = context.fakeNamesOf

        if (tableRoot.__valuesForInsert) {
            return this._appendRawColumnNameForValuesForInsert(column, context)
        }

        if (forceAliasFor === tableOrView && forceAliasAs) {
            return this._escape(forceAliasAs, true) + '.' + this._escape(nodeColumn.__name, true)
        }

        if (fakeNamesOf && fakeNamesOf.has(tableOrView)) {
            if (tableRoot.__as) {
                return this._escape('_old_', true) + '.' + this._escape(this._identifierWithoutQuotes(tableRoot.__as + '__' + nodeColumn.__name), true)
            } else {
                return this._escape('_old_', true) + '.' + this._escape(this._identifierWithoutQuotes(this._tableOrViewName(tableRoot, context) + '__' + nodeColumn.__name), true)
            }
        }

        if (tableRoot.__as) {
            return this._escape(tableRoot.__as, true) + '.' + this._escape(nodeColumn.__name, true)
        } else if (context.safeTableOrView === tableOrView) {
                return this._escape(nodeColumn.__name, true)
        } else {
            return this._escape(this._tableOrViewName(tableRoot, context), false) + '.' + this._escape(nodeColumn.__name, true)
        }
    }
    _appendRawColumnNameForValuesForInsert(column: DBColumn, _context: SqlBuildContext): string {
        const nodeColumn = __asDBColumnValueSource(column)
        return 'excluded.' + this._escape(nodeColumn.__name, true)
    }
    /**
     * Emits a number or string as an inline SQL literal **without escaping**.
     * The caller is responsible for guaranteeing the string is safe to embed
     * verbatim (i.e. it contains no `'` and does not come from user input).
     *
     * This method is intentionally fast: it skips the per-character scan that
     * full SQL-injection-safe escaping requires. It is the right choice when
     * the value is library-internal or comes from a trusted, build-time
     * source — notably `CustomBooleanTypeAdapter.trueValue` /
     * `CustomBooleanTypeAdapter.falseValue`, which are programmer-supplied at
     * table-declaration time and consistently use identifier-like strings
     * (`'T'`, `'Y'`, `'yes'`, etc.).
     *
     * For any value that may contain `'` — in particular, anything that
     * propagates from a runtime API argument such as a `stringConcat`
     * separator — use {@link _appendUnsafeLiteralValue} instead.
     */
    _appendLiteralValue(value: number | string, _context: SqlBuildContext) {
        if (typeof value === 'number') {
            return '' + value
        } else {
            return "'" + value + "'"
        }
    }
    /**
     * Emits a string as an inline SQL literal with SQL-92 single-quote
     * escaping (`'` → `''`). Use this when the value may have been influenced
     * by an API consumer at runtime — for example, the `separator` argument
     * of `stringConcat(value, separator)`. Every supported dialect (Postgres,
     * MySQL, MariaDB, SQLite, Oracle, SQL Server) accepts this form.
     *
     * For known-safe library-internal values, prefer {@link _appendLiteralValue}
     * — it skips the per-character scan and is byte-identical for strings
     * with no embedded `'`.
     */
    _appendUnsafeLiteralValue(value: string, _context: SqlBuildContext) {
        return "'" + value.replace(/'/g, "''") + "'"
    }
    _getTableOrViewVisibleName(table: AnyTableOrView): string {
        const t = __asTableOrViewRoot(table)
        let result = this._escape(t.__name, false)
        if (t.__as) {
            result += ' as ' + this._escape(t.__as, true)
        }
        if (t.__customizationName) {
            result += ' (customization name: ' + t.__customizationName + ')'
        }
        return result
    }
    _supportTableAliasWithAs = true
    _appendTableOrViewName(table: AnyTableOrView, context: SqlBuildContext): string {
        const t = __asTableOrViewRoot(table)
        if (t.__template) {
            return this._appendRawFragment(t.__template, context)
        }

        const forceAliasFor = context.forceAliasFor
        const forceAliasAs = context.forceAliasAs

        let result = this._appendTableOrViewNameForFrom(table, context)
        if (forceAliasFor === table && forceAliasAs) {
            if (this._supportTableAliasWithAs) {
                result += ' as '
            } else {
                result += ' '
            }
            result += this._escape(forceAliasAs, true)
        } else if (t.__as) {
            if (this._supportTableAliasWithAs) {
                result += ' as '
            } else {
                result += ' '
            }
            result += this._escape(t.__as, true)
        } else {
            const alias = this._appendTableOrViewNoAliasForFrom(table, context)
            if (alias) {
                if (this._supportTableAliasWithAs) {
                    result += ' as '
                } else {
                    result += ' '
                }
                result += alias
            }
        }
        return result
    }
    _appendTableOrViewNameForFrom(table: AnyTableOrView, context: SqlBuildContext): string {
        const t = __asTableOrViewRoot(table)
        return this._escape(this._tableOrViewName(t, context), false)
    }
    _appendTableOrViewNoAliasForFrom(_table: AnyTableOrView, _context: SqlBuildContext): string {
        return ''
    }
    _appendRawFragment(rawFragment: RawFragment<any>, context: SqlBuildContext): string {
        return this._appendSql(rawFragment as any as ToSql, context, false) // RawFragment has a hidden implemetation of ToSql
    }
    _appendCondition(condition: ILogicalValueSource<any, any>, context: SqlBuildContext): string {
        if (hasToSql(condition)) {
            return this._appendConditionSql(condition, context, false)
        }
        throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'invalid value source' }, 'Conditions must have a __toSqlForCondition method')
    }
    _appendConditionParenthesis(condition: ILogicalValueSource<any, any>, context: SqlBuildContext): string {
        if (this._needParenthesis(condition)) {
            return '(' + this._appendCondition(condition, context) + ')'
        }
        return this._appendCondition(condition, context)
    }
    _appendConditionParenthesisExcluding(condition: ILogicalValueSource<any, any>, context: SqlBuildContext, excluding: keyof SqlOperation): string {
        if (this._needParenthesisExcluding(condition, excluding)) {
            return '(' + this._appendCondition(condition, context) + ')'
        }
        return this._appendCondition(condition, context)
    }
    _appendSql(value: ToSql | AnyValueSource | IExecutableSelectQuery<any, any, any> | IExecutableInsertQuery<any, any> | IExecutableUpdateQuery<any, any> | IExecutableDeleteQuery<any, any>, context: SqlBuildContext, forceTypeCast: boolean): string {
        return (value as ToSql).__toSql(this, context, forceTypeCast) // All ValueSource or Column have a hidden implemetation of ToSql
    }
    _appendSqlParenthesis(value: ToSql | AnyValueSource, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (this._needParenthesis(value)) {
            return '(' + this._appendSql(value, context, forceTypeCast) + ')'
        }
        return this._appendSql(value, context, forceTypeCast)
    }
    _appendSqlParenthesisExcluding(value: ToSql | AnyValueSource, context: SqlBuildContext, excluding: keyof SqlOperation, forceTypeCast: boolean): string {
        if (this._needParenthesisExcluding(value, excluding)) {
            return '(' + this._appendSql(value, context, forceTypeCast) + ')'
        }
        return this._appendSql(value, context, forceTypeCast)
    }
    _appendSpreadValue(value: any, context: SqlBuildContext, typeClass: DataTypeClass, forceTypeCast: boolean): string {
        if (hasToSql(value)) {
            return '(' + this._appendSql(value, context, forceTypeCast) + ')'
        }
        if (Array.isArray(value)) {
            if (value.length <= 0) {
                return '()'
            }

            let arrayResult = '(' + this._appendValue(value[0], context, typeClass, forceTypeCast)

            for (let i = 1, length = value.length; i < length; i++) {
                arrayResult += ', ' + this._appendValue(value[i], context, typeClass, forceTypeCast)
            }
            return arrayResult + ')'
        }
        const adaptedValue = this._transformParamToDB(value, typeClass, context, forceTypeCast)
        return '(' + this._appendParam(adaptedValue, context, typeClass, forceTypeCast) + ')'
    }
    _appendValue(value: any, context: SqlBuildContext, typeClass: DataTypeClass, forceTypeCast: boolean): string {
        if (hasToSql(value)) {
            return this._appendSql(value, context, forceTypeCast)
        }
        const adaptedValue = this._transformParamToDB(value, typeClass, context, forceTypeCast)
        return this._appendParam(adaptedValue, context, typeClass, forceTypeCast)
    }
    _appendValueParenthesis(value: any, context: SqlBuildContext, typeClass: DataTypeClass, forceTypeCast: boolean): string {
        if (this._needParenthesis(value)) {
            return '(' + this._appendValue(value, context, typeClass, forceTypeCast) + ')'
        }
        return this._appendValue(value, context, typeClass, forceTypeCast)
    }
    _appendValueParenthesisExcluding(value: any, context: SqlBuildContext, typeClass: DataTypeClass, excluding: keyof SqlOperation, forceTypeCast: boolean): string {
        if (this._needParenthesisExcluding(value, excluding)) {
            return '(' + this._appendValue(value, context, typeClass, forceTypeCast) + ')'
        }
        return this._appendValue(value, context, typeClass, forceTypeCast)
    }
    _appendConditionSql(value: ToSql | AnyValueSource, context: SqlBuildContext, forceTypeCast: boolean): string {
        return (value as ToSql).__toSqlForCondition(this, context, forceTypeCast) // All ValueSource or Column have a hidden implemetation of ToSql
    }
    _appendConditionSqlParenthesisExcluding(value: ToSql | AnyValueSource, context: SqlBuildContext, excluding: keyof SqlOperation, forceTypeCast: boolean): string {
        if (this._needParenthesisExcluding(value, excluding)) {
            return '(' + this._appendConditionSql(value, context, forceTypeCast) + ')'
        }
        return this._appendConditionSql(value, context, forceTypeCast)
    }
    _appendConditionSqlParenthesis(value: ToSql | AnyValueSource, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (this._needParenthesis(value)) {
            return '(' + this._appendConditionSql(value, context, forceTypeCast) + ')'
        }
        return this._appendConditionSql(value, context, forceTypeCast)
    }
    _appendConditionValue(value: any, context: SqlBuildContext, typeClass: DataTypeClass, forceTypeCast: boolean): string {
        if (hasToSql(value)) {
            return this._appendConditionSql(value, context, forceTypeCast)
        }
        const adaptedValue = this._transformParamToDB(value, typeClass, context, forceTypeCast)
        return this._appendConditionParam(adaptedValue, context, typeClass, forceTypeCast)
    }
    _appendConditionValueParenthesis(value: any, context: SqlBuildContext, typeClass: DataTypeClass, forceTypeCast: boolean): string {
        if (this._needParenthesis(value)) {
            return '(' + this._appendConditionValue(value, context, typeClass, forceTypeCast) + ')'
        }
        return this._appendConditionValue(value, context, typeClass, forceTypeCast)
    }
    _appendConditionValueParenthesisExcluding(value: any, context: SqlBuildContext, typeClass: DataTypeClass, excluding: keyof SqlOperation, forceTypeCast: boolean): string {
        if (this._needParenthesisExcluding(value, excluding)) {
            return '(' + this._appendConditionValue(value, context, typeClass, forceTypeCast) + ')'
        }
        return this._appendConditionValue(value, context, typeClass, forceTypeCast)
    }
    /**
     * The value as it is sent to the database (the transformValueToDB of its type adapter, or of the connection). With
     * the context of a construction, the value is the next parameter: the context of the type adapter points at it,
     * with forceTypeCast, and what the adapter writes applies to it; without one, the value is only looked at
     */
    _transformParamToDB(value: any, typeClass: DataTypeClass, context?: SqlBuildContext, forceTypeCast: boolean = false): any {
        const adapterContext = this._typeAdapterContextOf(context)
        if (context) {
            const index = context.params.length
            adapterContext.prepareParam(context.queryContext.paramAt(index), index, forceTypeCast, typeClass, __sqlDataTypeOf(typeClass))
        } else {
            adapterContext.prepareParam(undefined, undefined, forceTypeCast, typeClass, __sqlDataTypeOf(typeClass))
        }
        try {
            return this._nextTypeAdapter.transformValueToDB(value, adapterContext)
        } catch (e) {
            // The value would be the next parameter: an invalid one tells which of them it is
            if (context && e instanceof TsSqlError && e.errorReason.reason === 'INVALID_VALUE_TO_SEND_TO_DATABASE' && e.errorReason.paramIndex === undefined) {
                e.errorReason.paramIndex = context.params.length
            }
            throw e
        }
    }
    /**
     * The context the type adapters receive: the one of the construction, or the one of the SQL builder for what is
     * not part of one (a value only looked at, a projection, a value read)
     */
    _typeAdapterContextOf(context?: SqlBuildContext | undefined): TypeAdapterContextImpl {
        if (context) {
            let result = context.typeAdapterContext
            if (!result) {
                result = new TypeAdapterContextImpl(this._connectionConfiguration, context.queryContext)
                context.typeAdapterContext = result
                // The configuration of the connection while the query is built, which the binding of a parameter of
                // the query runner reads (the type of its SQL data type); each execution sets it again
                context.queryContext.connectionConfiguration = this._connectionConfiguration
            }
            return result
        }
        let result = this.__typeAdapterContext
        if (!result) {
            result = new TypeAdapterContextImpl(this._connectionConfiguration)
            this.__typeAdapterContext = result
        }
        return result
    }
    /** The context of the type adapters for what is not part of a construction (see _typeAdapterContextOf) */
    __typeAdapterContext: TypeAdapterContextImpl | undefined = undefined
    /**
     * The context of the type adapters for a value read from the database: its requested type is resolved with a
     * projection, which uses the other context of the SQL builder
     */
    _typeAdapterReadContextOf(): TypeAdapterContextImpl {
        let result = this.__typeAdapterReadContext
        if (!result) {
            result = new TypeAdapterContextImpl(this._connectionConfiguration)
            this.__typeAdapterReadContext = result
        }
        return result
    }
    __typeAdapterReadContext: TypeAdapterContextImpl | undefined = undefined
    /**
     * Prepares the read context for the transformValueFromDB of the value, read where it leaves the database in output
     * (its requested type is the one its transformProjection requests), or, without output, read as it is (its
     * requested type is the original one)
     */
    _prepareTypeAdapterReadContext(value: AnyValueSource, output: ProjectionOutput | undefined): TypeAdapterContextImpl {
        const nodeValueSource = __asNodeValueSource(value)
        const result = this._typeAdapterReadContextOf()
        result.prepareRead(__classOf(nodeValueSource), __sqlDataTypeOf(__classOf(nodeValueSource)), output ? this : undefined, value, output ?? 'resultColumn')
        return result
    }
    _appendParam(value: any, context: SqlBuildContext, typeClass: DataTypeClass, forceTypeCast: boolean): string {
        // What the library knows of the parameter, for the query runner. Its value was transformed with the context of
        // the type adapter pointing at it, which then holds the type requested for it and whether the database receives
        // its type (forceTypeCast), which the type adapter can change, and what the adapter kept of it; a value added
        // without that is prepared here with its type and the forceTypeCast of the position
        const index = context.params.length
        const paramContext = context.queryContext.paramAt(index)
        const adapterContext = this._typeAdapterContextOf(context)
        if (adapterContext.index !== index) {
            adapterContext.prepareParam(paramContext, index, forceTypeCast, typeClass, __sqlDataTypeOf(typeClass))
        }
        if (context.assigningValueToColumn) {
            paramContext.isValueForColumn = true
        }
        // The query runner writes the type of the parameter in the placeholder, or sends it with the parameter, when
        // forceTypeCast; it reads the rest from the context of the parameter
        let placeholder = this._queryRunner.addParam(context.params, value, paramContext.requestedType)
        adapterContext.valueSentToDB = value
        adapterContext.startPlaceholder(typeClass)
        placeholder = this._nextTypeAdapter.transformPlaceholder(placeholder, adapterContext)
        adapterContext.clearParam()
        return placeholder
    }
    /**
     * Adds an out parameter of the query that receives the value, with what the library knows of it for the query
     * runner: the original type of the value, and as the type requested, the one the transformProjection of the value
     * requests for output, or without output (the value isn't converted) the original one
     */
    _addOutParam(context: SqlBuildContext, name: string, value: AnyValueSource, output: ProjectionOutput | undefined): string {
        const paramContext = context.queryContext.paramAt(context.params.length)
        const nodeValueSource = __asNodeValueSource(value)
        paramContext.setOriginalType(__unadaptedClassOf(__classOf(nodeValueSource)))
        // The SQL data type of the column; the requested one, the one its transformProjection requests
        paramContext.setOriginalSqlDataType(__sqlDataTypeOf(__classOf(nodeValueSource)))
        if (output) {
            this._resolveRequestedTypeOfProjection(value, output, paramContext)
        }
        paramContext.forceTypeCast = false
        return this._queryRunner.addOutParam(context.params, name, paramContext.requestedType)
    }
    _appendConditionParam(value: any, context: SqlBuildContext, typeClass: DataTypeClass, forceTypeCast: boolean): string {
        return this._appendParam(value, context, typeClass, forceTypeCast)
    }
    _appendColumnAlias(name: string, _context: SqlBuildContext): string {
        return this._escape(name, true)
    }
    // The key of a column in a row returned by the database, for the databases that don't keep the whole alias
    _resultColumnKey(name: string): string {
        return name
    }
    _appendColumnValue(value: AnyValueSource, context: SqlBuildContext, isOutermostQuery: boolean): string {
        const sql = this._appendSql(value, context, false)
        // An aggregated-array column is a JSON document. On the dialects whose connector
        // decodes a `json` column into a JS value (rounding every integer past 2^53) before
        // the library ever sees it, finalise the OUTERMOST such column to text — so the raw
        // JSON string reaches the lossless parser (`parseJsonPreservingNumbers`) instead of a
        // pre-rounded object. Only the outermost column is finalised: a nested aggregate lives
        // *inside* its parent's JSON and must stay a JSON array, not become a quoted string.
        // On the connectors that already hand the aggregate back as text (Oracle, SQL Server,
        // SQLite) `_finalizeAggregatedArrayResult` is the identity, so their SQL is untouched.
        if (isOutermostQuery && isValueSource(value) && __isJsonDocumentSql(__classOf(__asNodeValueSource(value)))) {
            return this._finalizeAggregatedArrayResult(sql)
        }
        return sql
    }
    // See `_appendColumnValue`. Identity by default (Oracle / SQL Server / SQLite connectors
    // return the aggregate as a raw string already); overridden on PostgreSQL and MySQL/MariaDB,
    // whose connectors pre-parse a JSON column.
    _finalizeAggregatedArrayResult(sql: string): string {
        return sql
    }
    /**
     * A column of the result of the outermost query (also of the returning of an insert, an update or a delete), as it
     * leaves the database: the `transformProjection` of the type adapter of the value, or the conversion of the library.
     * The column keeps its SQL in the group by, the having and the order by, which compare and order the value, not its
     * converted form.
     */
    _appendResultColumnProjection(value: AnyValueSource, sql: string, context: SqlBuildContext): string {
        return this._appendValueProjection(value, sql, 'resultColumn', sql ? context : undefined)
    }
    /**
     * A value inside the JSON of an aggregated array, as the JSON function of the database receives it: the
     * `transformProjection` of the type adapter of the value, or the conversion of the library. A converted value is
     * the SQL of a value of any type the JSON function takes, whose text transformValueFromDB receives (as a string in
     * the JSON SQL Server's library writes). The leaf of an aggregated array is written
     * outside the select whose distinct, order by and limit compare and order the value: in the aggregate over the
     * wrapped select (`a_N_.<prop>`), or in an aggregate without them (MariaDB orders inside the aggregate by the
     * expression of the column, not by the leaf).
     */
    _appendAggregatedArrayValueProjection(value: AnyValueSource, sql: string, context?: SqlBuildContext): string {
        return this._appendValueProjection(value, sql, 'aggregatedArrayValue', context)
    }
    /** The value inside the JSON of an aggregated array is converted (`_appendAggregatedArrayValueProjection` changes it) */
    _isConvertedAggregatedArrayValue(value: AnyValueSource): boolean {
        return this._appendAggregatedArrayValueProjection(value, '') !== ''
    }
    /**
     * The value inside the JSON of an aggregated array is converted, and its converted SQL doesn't compare like the
     * value (its `comparison` is `'none'`)
     */
    _needsTheValueOfAggregatedArrayValueToCompare(value: AnyValueSource): boolean {
        return this._isConvertedAggregatedArrayValue(value) && this._projectionComparison(value, 'aggregatedArrayValue') === 'none'
    }
    /**
     * The value inside the JSON of an aggregated array is converted, and its converted SQL doesn't order like the
     * value (its `comparison` isn't `'value'`)
     */
    _needsTheValueOfAggregatedArrayValueToOrder(value: AnyValueSource): boolean {
        return this._isConvertedAggregatedArrayValue(value) && this._projectionComparison(value, 'aggregatedArrayValue') !== 'value'
    }
    /**
     * How the SQL of `_appendValueProjection` compares with the value, as the `transformProjection` of the type adapter
     * of the value, or of the connection, says in its context for `output`
     */
    _projectionComparison(value: AnyValueSource, output: ProjectionOutput): ProjectionComparison {
        if (!isValueSource(value)) {
            return 'value'
        }
        this._appendValueProjection(value, '', output)
        return this._typeAdapterContextOf(undefined).comparison
    }
    /**
     * Writes in `into` the type of the value the SQL of `_appendValueProjection` gives for `output`: the one its
     * `transformProjection` requests when it converts the value, otherwise the original one; and the SQL data type it
     * requests, also when it doesn't convert the SQL
     */
    _resolveRequestedTypeOfProjection(value: AnyValueSource, output: ProjectionOutput, into: QueryParamContextImpl): void {
        const adapterContext = this._typeAdapterContextOf(undefined)
        if (this._appendValueProjection(value, '', output) === '') {
            into.requestedType = into.originalType
            into.requestedSqlDataType = adapterContext.requestedSqlDataType
        } else {
            adapterContext.copyRequestedTypeTo(into)
        }
    }
    /**
     * The `transformProjection` of the type adapter of the value, or of the connection, for `output`; its context then
     * holds what it says of the SQL it returns (how it compares, the type of the value it gives). With the context of
     * the construction of a query, what the transformation keeps of the query goes to its context; without it (a call
     * only to learn what the transformation says), it is discarded
     */
    _appendValueProjection(value: AnyValueSource, sql: string, output: ProjectionOutput, context?: SqlBuildContext): string {
        if (!isValueSource(value)) {
            return sql
        }
        const adapterContext = this._typeAdapterContextOf(undefined)
        const nodeValueSource = __asNodeValueSource(value)
        adapterContext.prepareProjection(__classOf(nodeValueSource), __sqlDataTypeOf(__classOf(nodeValueSource)), output, context?.queryContext)
        return this._nextTypeAdapter.transformProjection(sql, adapterContext)
    }
    /**
     * The outermost query must be wrapped in a select that converts its columns (`_appendResultColumnProjection`),
     * because the conversion can't be written in the query itself: in the arms of a compound, a conversion would
     * change how the rows are compared, and the order by of the alias of a column would order the converted value.
     * True when a column of the query is converted and its conversion doesn't compare like the value of the other arm
     * (`_needsTheValueOfResultColumnToCompareAcrossColumns`), or the order by names a column whose conversion doesn't
     * order like the value (`_isOrderByAliasNeedingTheValue`); any other conversion is written in the query itself.
     */
    _needsResultConversionWrap(query: SelectData, context: SqlBuildContext): boolean {
        const queryColumns = query.__columns
        if (!queryColumns) {
            return false
        }
        const columns: FlatQueryColumns = {}
        flattenQueryColumns(queryColumns, columns, '')
        for (const property in columns) {
            if (this._needsTheValueOfResultColumnToCompareAcrossColumns(columns[property]!, context)) {
                return true
            }
        }
        const orderBy = query.__orderBy
        if (orderBy) {
            return orderBy.some(entry => this._isOrderByAliasNeedingTheValue(entry, query, context))
        }
        return false
    }
    /** A column of the query is converted in the outermost query (`_isConvertedResultColumn`) */
    _hasConvertedResultColumn(query: SelectData, context: SqlBuildContext): boolean {
        const queryColumns = query.__columns
        if (!queryColumns) {
            return false
        }
        const columns: FlatQueryColumns = {}
        flattenQueryColumns(queryColumns, columns, '')
        for (const property in columns) {
            if (this._isConvertedResultColumn(columns[property]!, context)) {
                return true
            }
        }
        return false
    }
    /**
     * A distinct select must be wrapped in a select that converts its columns: the distinct of the select itself would
     * compare the converted SQL of a column whose conversion doesn't compare like the value
     * (`_needsTheValueOfResultColumnToCompare`, a distinct compares the values of each column with each other, so
     * `'columnEquality'` doesn't need it), or order by the converted SQL of a column named by the order by whose
     * conversion doesn't order like the value (`_isOrderByAliasNeedingTheValue`). The distinct is applied to the values,
     * and the wrapper converts them.
     */
    _needsDistinctConversionWrap(query: SelectData, context: SqlBuildContext): boolean {
        if (query.__type !== 'plain' || !query.__distinct || query.__asInlineAggregatedArrayValue || context.resultConversionDeferred || !this._isCurrentRootQuery(query, context)) {
            return false
        }
        const columns: FlatQueryColumns = {}
        flattenQueryColumns(query.__columns, columns, '')
        for (const property in columns) {
            if (this._needsTheValueOfResultColumnToCompare(columns[property]!, context)) {
                return true
            }
        }
        const orderBy = query.__orderBy
        if (orderBy) {
            return orderBy.some(entry => this._isOrderByAliasNeedingTheValue(entry, query, context))
        }
        return false
    }
    /**
     * The distinct of `aggregateAsArrayDistinct` and `aggregateAsArrayOfOneColumnDistinct` is inside the JSON function
     * of the database, which compares what goes in the JSON: a value converted by a conversion that doesn't compare
     * like the value (`_needsTheValueOfAggregatedArrayValueToCompare`) would be compared as its converted SQL. When the
     * aggregate is the only column of a select that isn't grouped (one row, over every row of the from), the select is
     * written as the aggregate, without the distinct, over a select of the distinct values
     * (`select json_agg(<converted a_N_.result>) from (select distinct <value> as result from ...) a_N_`). Undefined
     * when that isn't the case, and the distinct stays inside the aggregate.
     */
    _getDistinctAggregatedArrayToWrap(query: SelectData, columns: FlatQueryColumns): { property: string, __aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource } | undefined {
        if (query.__type !== 'plain' || query.__asInlineAggregatedArrayValue || query.__groupBy.length > 0 || query.__having || query.__orderBy) {
            return undefined
        }
        const customization = query.__customization
        if (customization && (customization.afterSelectKeyword || customization.beforeColumns || customization.customWindow || customization.beforeOrderByItems || customization.afterOrderByItems)) {
            return undefined
        }
        let property: string | undefined
        for (const name in columns) {
            if (property !== undefined) {
                return undefined
            }
            property = name
        }
        if (property === undefined) {
            return undefined
        }
        const column = columns[property]
        if (!__isAggregateValueAsArray(column) || !column.__aggregatedArrayDistinct) {
            return undefined
        }
        if (__isAllowWhenAggregateValueAsArray(column) && !column.__allowed) {
            return undefined
        }
        const aggregatedArrayColumns = column.__aggregatedArrayColumns
        const values: FlatQueryColumns = {}
        if (isValueSource(aggregatedArrayColumns)) {
            values['result'] = aggregatedArrayColumns
        } else {
            flattenQueryColumns(aggregatedArrayColumns, values, '')
        }
        for (const name in values) {
            if (this._needsTheValueOfAggregatedArrayValueToCompare(values[name]!)) {
                return { property, __aggregatedArrayColumns: aggregatedArrayColumns }
            }
        }
        return undefined
    }
    /** The columns of the select of the distinct values of an aggregated array (`_getDistinctAggregatedArrayToWrap`) */
    _appendDistinctAggregatedArrayValues(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, context: SqlBuildContext): string {
        if (isValueSource(aggregatedArrayColumns)) {
            return this._appendColumnValue(aggregatedArrayColumns, context, false) + ' as ' + this._appendColumnAlias('result', context)
        }
        const values: FlatQueryColumns = {}
        flattenQueryColumns(aggregatedArrayColumns, values, '')
        let result = ''
        for (const name in values) {
            if (result) {
                result += ', '
            }
            result += this._appendColumnValue(values[name]!, context, false) + ' as ' + this._appendColumnAlias(name, context)
        }
        return result
    }
    /**
     * The columns of the select that wraps a query to convert them (`_needsResultConversionWrap`), read from the
     * wrapped query, whose alias is `wrapperAlias`.
     */
    _appendResultConversionWrapperColumns(query: SelectData, context: SqlBuildContext, wrapperAlias: string): string {
        const columns: FlatQueryColumns = {}
        flattenQueryColumns(query.__columns, columns, '')
        const withAllColumns = context.resultConversionWithAllColumns
        let result = ''
        for (const property in columns) {
            const alias = this._appendColumnAlias(property, context)
            if (withAllColumns) {
                if (this._isConvertedResultColumn(columns[property]!, context)) {
                    result += (result ? ', ' : '') + this._appendResultColumnProjection(columns[property]!, wrapperAlias + '.' + this._appendColumnAlias(this._resultConversionInnerAlias(property), context), context) + ' as ' + alias
                }
                continue
            }
            if (result) {
                result += ', '
            }
            result += this._appendResultColumnProjection(columns[property]!, wrapperAlias + '.' + alias, context) + ' as ' + alias
        }
        if (withAllColumns) {
            result += (result ? ', ' : '') + wrapperAlias + '.*'
        }
        return result
    }
    _buildWith(withData: WithQueryData, context: SqlBuildContext): string {
        let withs = withData.__withs
        if (context.withGenerated) {
            if (context.generateExternalWith) {
                withs = withData.__withs.filter(value => {
                    return __asTableOrViewRoot(value).__hasExternalDependencies
                })
                context.generateExternalWith = false
            } else {
                return ''
            }
        } else {
            withs = withData.__withs
            context.withGenerated = true
        }

        if (withs.length <= 0) {
            context.withGeneratedFinished = true
            return ''
        }
        let result = ''
        let recursive = false
        for (let i = 0, length = withs.length; i < length; i++) {
            const withView = getWithData(withs[i]!)
            if (isWithValuesData(withView)) {
                const values = this._buildWithValues(withView, context)
                if (values) {
                    if (result) {
                        result += ', '
                    }
                    result += values
                }
                continue
            }
            const customization = withView.__selectData.__customization
            if (result) {
                result += ', '
            }
            result += this._escape(this._tableOrViewName(withView, context), false)
            result += this._appendWithColumns(withView, context)
            result += ' as '
            if (customization && customization.beforeWithQuery) {
                result += this._appendRawFragment(customization.beforeWithQuery, context) + ' '
            }
            result += '('
            result += this._buildSelect(withView.__selectData, context)
            result += ')'
            if (customization && customization.afterWithQuery) {
                result += ' ' + this._appendRawFragment(customization.afterWithQuery, context)
            }
            recursive = recursive || !!withView.__recursive
        }
        context.withGeneratedFinished = true
        return this._appendWithKeyword(recursive) + ' ' + result + ' '
    }
    _buildWithValues(withValues: WithValuesData, context: SqlBuildContext) {
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
                valueSql += this._appendSetValue(columnName, i, column, value[columnName], context)
            }
            valuesSql += this._withValuesRowConstructorKeyword() + '(' + valueSql + ')'
        }
        result += valuesSql
        result += ')'
        return result
    }
    _withValuesRowConstructorKeyword(): string {
        // The SQL-standard table value constructor inside a `WITH name AS
        // (VALUES (a, b), (c, d))` uses bare row parentheses. MySQL is the
        // exception — it requires the `ROW(...)` row constructor — so it
        // overrides this hook to return 'row'.
        return ''
    }
    _appendWithColumns(_withData: WithSelectData, _context: SqlBuildContext): string {
        return ''
    }
    _appendWithKeyword(recursive: boolean): string {
        if (recursive) {
            return 'with recursive'
        }
        return 'with'
    }
    _inlineSelectAsValue(query: SelectData, context: SqlBuildContext): string {
        const result = '(' + this._buildInlineSelect(query, context) + ')'
        return result
    }
    _inlineSelectAsValueForCondition(query: SelectData, context: SqlBuildContext): string {
        const result = '(' + this._buildInlineSelect(query, context) + ')'
        return result
    }
    _buildInlineSelect(query: SelectData, context: SqlBuildContext): string {
        const oldWithGeneratedFinished = context.withGeneratedFinished
        const oldGenerateExternalWith = context.generateExternalWith
        // The and / or of the inner where belong to the inner query: an or around
        // `exists(select … where a and b)` must not see them as its own operand's
        const oldResultingOperation = context.resultingOperation
        context.generateExternalWith = true
        context.withGeneratedFinished = false
        const result = this._buildSelectWithColumnsInfo(query, context, {}, false)
        context.withGeneratedFinished = oldWithGeneratedFinished
        context.generateExternalWith = oldGenerateExternalWith
        context.resultingOperation = oldResultingOperation
        return result
    }
    _buildSelect(query: SelectData, context: SqlBuildContext): string {
        this._ensureRootQuery(query, context)
        const isOutermostQuery = this._isCurrentRootQuery(query, context)
        const result = this._buildSelectWithColumnsInfo(query, context, {}, isOutermostQuery)
        this._resetRootQuery(query, context)
        return result
    }
    _appendCompoundOperator(compoundOperator: CompoundOperator, _context: SqlBuildContext): string {
        switch(compoundOperator) {
            case 'union':
                return ' union '
            case 'unionAll':
                return ' union all '
            case 'intersect':
                return ' intersect '
            case 'intersectAll':
                return ' intersect all '
            case 'except':
                return ' except '
            case 'exceptAll':
                return ' except all '
            case 'minus':
                return ' except '
            case 'minusAll':
                return ' except all '
            default:
                throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'invalid compound operator', operator: compoundOperator }, 'Invalid compound operator: ' + compoundOperator)
        }
    }
    /*
     * The operators compose as they are written in the code: a.union(b).intersect(c) is (a union b) intersect c, and
     * a.except(b.union(c)) is a except (b union c). The SQL must say the same, because the database doesn't read a chain
     * that way: most of them do intersect first, and all of them read it from left to right after that.
     */
    _compoundOperandNeedsGrouping(operand: SelectData, position: 'first' | 'second', operator: CompoundOperator): boolean {
        if (operand.__type !== 'compound') {
            return false
        }
        if (position === 'second') {
            return true
        }
        return this._compoundIntersectHasPrecedence() && isIntersectOperator(operator) && !isIntersectOperator(operand.__compoundOperator)
    }
    _compoundIntersectHasPrecedence(): boolean {
        return true
    }
    _buildSelectWithColumnsInfoForCompound(query: SelectData, context: SqlBuildContext, columnsForInsert: { [name: string]: DBColumn | undefined }, isOutermostQuery: boolean, needsGrouping: boolean): string {
        const result = this._buildSelectWithColumnsInfo(query, context, columnsForInsert, isOutermostQuery)
        if (needsGrouping || query.__limit !== undefined || query.__offset !== undefined || query.__orderBy || query.__customization?.beforeOrderByItems || query.__customization?.afterOrderByItems) {
            return '(' + result + ')'
        }
        return result
    }
    _buildFromJoins(tables: AnyTableOrView[] | undefined, joins: JoinData[] | undefined, requiredTablesOrViews: Set<AnyTableOrView> | undefined, context: SqlBuildContext): string {
        let fromJoins = ''

        if (tables && tables.length > 0) {
            let requireComma = false
            for (let i = 0, length = tables.length; i < length; i++) {
                if (requireComma) {
                    fromJoins += ', '
                }
                fromJoins += this._appendTableOrViewName(tables[i]!, context)
                requireComma = true
            }
        }

        if (!joins || joins.length <= 0) {
            return fromJoins
        }

        for (let i = 0, length = joins.length; i < length; i++) {
            const join = joins[i]!

            if (join.__optional) {
                if (!requiredTablesOrViews!.has(join.__tableOrView)) {
                    continue
                }
            }

            switch (join.__joinType) {
                case 'join':
                    fromJoins += ' join '
                    break
                case 'innerJoin':
                    fromJoins += ' inner join '
                    break
                case 'leftJoin':
                    fromJoins += ' left join '
                    break
                case 'leftOuterJoin':
                    fromJoins += ' left outer join '
                    break
                default:
                    throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'invalid join type', joinType: join.__joinType }, 'Invalid join type: ' + join.__joinType)
            }
            fromJoins += this._appendTableOrViewName(join.__tableOrView, context)
            // A dynamic condition can end up empty (`dynamicOn()` without conditions, or only IfValue conditions
            // without value): it means no restriction, but most databases require the ON clause
            const onCondition = join.__on ? this._appendCondition(join.__on, context) : ''
            const joinedTableOrView = join.__tableOrView
            if (!onCondition && hasWithData(joinedTableOrView) && !isWithValuesData(joinedTableOrView) && joinedTableOrView.__ignoreWith) {
                // The join with the recursive query (the view built by recursiveUnion*) is what links each level
                // with the previous one. Without it every row of the table joins every row of the previous level:
                // union returns every row of the table, and union all never ends (or the database aborts it)
                throw new TsSqlProcessingError({ reason: 'MISSING_RECURSIVE_CONDITION' }, 'No join condition with the recursive query generated')
            }
            fromJoins += ' on ' + (onCondition || this._trueValueForCondition)
        }

        return fromJoins
    }
    _appendGroupBySelectColumn(_entry: AnyValueSource, selectColumn: SelectColumnSql, _context: SqlBuildContext, _isOutermostQuery: boolean): string {
        // A group by entry the user named by its column of the select list (`groupBy('level')`). The alias is not
        // safe: a name in a group by is resolved against the columns of the from first, so it can end up grouping by
        // a column the query doesn't know about. The select list's SQL is the same expression while it has no
        // parameters; with parameters, these databases take each placeholder as a different parameter
        // (`priority + ?` / `priority + ?`), so the position in the select list is used. The databases whose
        // placeholders can be repeated override it to reuse the select list's SQL with the same parameters.
        if (selectColumn.paramsStart === selectColumn.paramsEnd) {
            return selectColumn.sql
        }
        return this._appendGroupByPosition(selectColumn)
    }
    _appendSelectColumnReference(column: AnyValueSource, context: SqlBuildContext): string {
        // A column of the select the having refers to (having(columns => ...))
        const selectColumn = context.selectColumnsSql?.get(column)
        if (!selectColumn) {
            return this._appendSql(column, context, false)
        }
        return this._appendSelectColumnReferenceSql(selectColumn, context)
    }
    _appendSelectColumnReferenceForCondition(column: AnyValueSource, context: SqlBuildContext): string {
        // A boolean column of the select used as a condition of the having: the value the select list writes is
        // a condition too
        return this._appendSelectColumnReference(column, context)
    }
    _appendSelectColumnReferenceSql(selectColumn: SelectColumnSql, _context: SqlBuildContext): string {
        // The same SQL as the select list, with the same parameters: the same expression for the database
        return selectColumn.sql
    }
    _appendGroupByPosition(selectColumn: SelectColumnSql): string {
        return '' + selectColumn.position
    }
    _buildSelectGroupBy(query: PlainSelectData, context: SqlBuildContext, isOutermostQuery: boolean, selectColumnsSql?: Map<AnyValueSource, SelectColumnSql> | undefined): string {
        const groupBy = query.__groupBy
        if (groupBy.length <= 0) {
            return ''
        }
        let result = ' group by '
        for (let i = 0, length = groupBy.length; i < length; i++) {
            if (i > 0) {
                result += ', '
            }
            const entry = groupBy[i]!
            // Only an entry the user named by its select column refers to that column; an expression is written as is
            const selectColumn = query.__groupByColumnNames?.has(entry) ? selectColumnsSql?.get(entry) : undefined
            if (selectColumn) {
                result += this._appendGroupBySelectColumn(entry, selectColumn, context, isOutermostQuery)
            } else {
                result += this._appendSelectColumn(entry, context, undefined, isOutermostQuery)
            }
        }
        return result
    }
    /** The two queries of a compound query joined by its operator, without its order by and its limit */
    _buildCompoundCore(query: CompoundSelectData, context: SqlBuildContext, columnsForInsert: { [name: string]: DBColumn | undefined }, isOutermostQuery: boolean): string {
        if (this._convertUuidTextInCompound()) {
            const uuidTexts = this._uuidTextsMixedWithOtherTexts(query)
            if (uuidTexts) {
                const previous = context.uuidTextsAsText
                if (previous) {
                    previous.forEach(value => uuidTexts.add(value))
                }
                context.uuidTextsAsText = uuidTexts
                try {
                    return this._buildCompoundCoreArms(query, context, columnsForInsert, isOutermostQuery)
                } finally {
                    context.uuidTextsAsText = previous
                }
            }
        }
        return this._buildCompoundCoreArms(query, context, columnsForInsert, isOutermostQuery)
    }
    /**
     * The text of a uuid (`asString()`) in a column of a compound query whose other arm has a text that isn't a uuid
     * must be converted to a text: the database gives the column the type of the uuid (SQL Server rejects the other
     * text, MariaDB's native UUID makes it NULL)
     */
    _convertUuidTextInCompound(): boolean {
        return false
    }
    /**
     * The text of a uuid received in a column of the result (`asString()`) is lowered by the library: the database
     * gives it in upper case (SQL Server)
     */
    _lowerCaseUuidTextReceived(): boolean {
        return false
    }
    /** The text of a uuid written as a text where it meets a text that isn't a uuid (_convertUuidTextInCompound) */
    _appendUuidTextAsText(sql: string): string {
        return sql
    }
    /** The uuid texts of the columns of the arms of a compound query where another arm has a text that isn't a uuid */
    _uuidTextsMixedWithOtherTexts(query: CompoundSelectData): Set<AnyValueSource> | undefined {
        const arms: FlatQueryColumns[] = []
        const collect = (select: SelectData) => {
            if (select.__type === 'compound') {
                collect(select.__firstQuery)
                collect(select.__secondQuery)
            } else {
                const columns: FlatQueryColumns = {}
                flattenQueryColumns(select.__columns, columns, '')
                arms.push(columns)
            }
        }
        collect(query)
        let result: Set<AnyValueSource> | undefined
        for (const name in arms[0]) {
            let uuidText = false
            let otherText = false
            for (const arm of arms) {
                const value = arm[name]
                if (value) {
                    if (value instanceof UuidTextType) {
                        uuidText = true
                    } else {
                        otherText = true
                    }
                }
            }
            if (uuidText && otherText) {
                for (const arm of arms) {
                    const value = arm[name]
                    if (value instanceof UuidTextType) {
                        if (!result) {
                            result = new Set()
                        }
                        result.add(value)
                    }
                }
            }
        }
        return result
    }
    _buildCompoundCoreArms(query: CompoundSelectData, context: SqlBuildContext, columnsForInsert: { [name: string]: DBColumn | undefined }, isOutermostQuery: boolean): string {
        let compoundCore = ''
        compoundCore += this._buildSelectWithColumnsInfoForCompound(query.__firstQuery, context, columnsForInsert, isOutermostQuery, this._compoundOperandNeedsGrouping(query.__firstQuery, 'first', query.__compoundOperator))
        compoundCore += this._appendCompoundOperator(query.__compoundOperator, context)
        compoundCore += this._buildSelectWithColumnsInfoForCompound(query.__secondQuery, context, columnsForInsert, isOutermostQuery, this._compoundOperandNeedsGrouping(query.__secondQuery, 'second', query.__compoundOperator))
        return compoundCore
    }
    _buildSelectWithColumnsInfo(query: SelectData, context: SqlBuildContext, columnsForInsert: { [name: string]: DBColumn | undefined }, isOutermostQuery: boolean): string {
        const oldSafeTableOrView = context.safeTableOrView
        const oldWithGenerated = context.withGenerated
        const oldWithGeneratedFinished = context.withGeneratedFinished
        const oldAggregateArrayWrapped = context.aggregateArrayWrapped

        const customization = query.__customization
        const needAggregateArrayWrapper = this._needAggregateArrayWrapper(query, context)
        const aggregateId = needAggregateArrayWrapper ? context.generateUnique() : 0

        if (query.__type === 'compound') {
            this._setSafeTableOrView(context, undefined)

            let selectQuery = ''

            if (needAggregateArrayWrapper) {
                selectQuery += this._appendAggregateArrayWrapperBegin(query, context, aggregateId)
                context.aggregateArrayWrapped = true
            }

            if (customization && customization.beforeQuery) {
                selectQuery += this._appendRawFragment(customization.beforeQuery, context) + ' '
            }

            selectQuery += this._buildWith(query, context)

            const emitOrderBy = !query.__asInlineAggregatedArrayValue || !this._supportOrderByWhenAggregateArray || context.aggregateArrayWrapped
            // A case-insensitive ordering, or an ordering by a value-source
            // expression, can't live in the compound ORDER BY itself on the
            // strict engines; wrap the whole compound in a plain
            // `select * from (...)` and order there. The inner compound is
            // emitted verbatim so its set semantics and collations survive.
            // The columns of the outermost compound are converted over a query that wraps it, never in its arms
            const conversionWrap = isOutermostQuery && !context.resultConversionDeferred && this._needsResultConversionWrap(query, context)
            const wrapCompoundOrderBy = (emitOrderBy && this._needsCompoundOrderByWrap(query)) || conversionWrap

            const oldResultConversionDeferred = context.resultConversionDeferred
            const oldResultConversionWithAllColumns = context.resultConversionWithAllColumns
            if (conversionWrap) {
                context.resultConversionDeferred = true
                context.resultConversionWithAllColumns = this._hasCustomizedColumns(query)
            }
            const compoundCore = this._buildCompoundCore(query, context, columnsForInsert, isOutermostQuery)
            context.resultConversionDeferred = oldResultConversionDeferred

            if (wrapCompoundOrderBy) {
                const wrapperAlias = 'o_' + context.generateUnique() + '_'
                selectQuery += 'select ' + (conversionWrap ? this._appendResultConversionWrapperColumns(query, context, wrapperAlias) : '*') + ' from (' + compoundCore + ')'
                selectQuery += this._supportTableAliasWithAs ? ' as ' + wrapperAlias : ' ' + wrapperAlias
                if (emitOrderBy) {
                    const oldSafeTableOrViewInOrderBy = context.safeTableOrView
                    const oldResultConversionWrapperAlias = context.resultConversionWrapperAlias
                    this._setSafeTableOrView(context, undefined)
                    context.resultConversionWrapperAlias = conversionWrap ? wrapperAlias : undefined
                    selectQuery += this._buildSelectOrderByForWrapper(query, context)
                    context.resultConversionWrapperAlias = oldResultConversionWrapperAlias
                    this._setSafeTableOrView(context, oldSafeTableOrViewInOrderBy)
                }
            } else {
                selectQuery += compoundCore
                if (emitOrderBy) {
                    const oldSafeTableOrViewInOrderBy = context.safeTableOrView
                    this._setSafeTableOrView(context, undefined)
                    selectQuery += this._buildSelectOrderBy(query, context)
                    this._setSafeTableOrView(context, oldSafeTableOrViewInOrderBy)
                }
            }
            context.resultConversionWithAllColumns = oldResultConversionWithAllColumns
            if (!query.__asInlineAggregatedArrayValue || !this._supportLimitWhenAggregateArray || context.aggregateArrayWrapped) {
                selectQuery += this._buildSelectLimitOffset(query, context)
            }

            selectQuery += this._buildSelectAsAggregatedArray(query, context)

            if (customization && customization.afterQuery) {
                selectQuery += ' ' + this._appendRawFragment(customization.afterQuery, context)
            }

            if (needAggregateArrayWrapper) {
                selectQuery += this._appendAggregateArrayWrapperEnd(query, context, aggregateId)
            }

            this._setSafeTableOrView(context, oldSafeTableOrView)
            context.withGenerated = oldWithGenerated
            context.withGeneratedFinished = oldWithGeneratedFinished
            context.aggregateArrayWrapped = oldAggregateArrayWrapped
            return selectQuery
        }

        // Inside a subquery the fake names (the columns pre-projected into the `_old_` subquery of an update) apply
        // only to the outer tables the subquery references, the ones it declares in subSelectUsing; its own tables
        // keep their names.
        const subSelectUsing = query.__subSelectUsing
        const oldFakeNameOf = context.fakeNamesOf
        if (oldFakeNameOf) {
            if (subSelectUsing) {
                const newFakeNameOf = new Set<AnyTableOrView>()
                for (const v of subSelectUsing) {
                    if (oldFakeNameOf.has(v)) {
                        newFakeNameOf.add(v)
                    }
                }
                if (newFakeNameOf.size > 0) {
                    context.fakeNamesOf = newFakeNameOf
                } else {
                    context.fakeNamesOf = undefined
                }
            } else {
                context.fakeNamesOf = undefined
            }
        }

        const tables = query.__tablesOrViews
        const tablesLength = tables.length
        const joins = query.__joins

        const requiredTablesOrViews = query.__requiredTablesOrViews
        let hasJoins = false
        for (let i = 0, length = joins.length; i < length; i++) {
            const join = joins[i]!

            if (join.__optional) {
                if (!requiredTablesOrViews!.has(join.__tableOrView)) {
                    continue
                }
            }
            hasJoins = true
            break
        }

        if (tablesLength === 1 && !hasJoins) {
            this._setSafeTableOrView(context, tables[0])
        } else {
            this._setSafeTableOrView(context, undefined)
        }

        let selectQuery = ''

        if (needAggregateArrayWrapper) {
            selectQuery += this._appendAggregateArrayWrapperBegin(query, context, aggregateId)
            context.aggregateArrayWrapped = true
        }

        if (customization && customization.beforeQuery) {
            selectQuery += this._appendRawFragment(customization.beforeQuery, context) + ' '
        }

        selectQuery += this._buildWith(query, context)
        const selectStart = selectQuery.length
        selectQuery += 'select '

        if (customization && customization.afterSelectKeyword) {
            selectQuery += this._appendRawFragment(customization.afterSelectKeyword, context) + ' '
        }

        const columns: FlatQueryColumns = {}
        flattenQueryColumns(query.__columns, columns, '')

        // The distinct of an aggregated array whose values are converted, applied to the values: see
        // `_getDistinctAggregatedArrayToWrap`
        const distinctAggregatedArray = this._getDistinctAggregatedArrayToWrap(query, columns)

        if (query.__distinct || distinctAggregatedArray) {
            selectQuery += 'distinct '
        }

        if (customization && customization.beforeColumns) {
            selectQuery += this._appendRawFragment(customization.beforeColumns, context) + ' '
        }

        // An order by written over a query that wraps the select; the columns of the outermost select are converted
        // there when they can't be converted in the select itself
        const emitOrderBy = !query.__asInlineAggregatedArrayValue || !this._supportOrderByWhenAggregateArray || context.aggregateArrayWrapped
        const distinctConversionWrap = isOutermostQuery && !needAggregateArrayWrapper && this._needsDistinctConversionWrap(query, context)
        const conversionOnWrapper = distinctConversionWrap || (isOutermostQuery && !context.resultConversionDeferred && this._hasConvertedResultColumn(query, context) && emitOrderBy && !needAggregateArrayWrapper && this._needsSelectOrderByWrap(query, context))
        const convertColumns = isOutermostQuery && !conversionOnWrapper && !context.resultConversionDeferred
        const oldResultConversionWithAllColumns = context.resultConversionWithAllColumns
        if (conversionOnWrapper) {
            context.resultConversionWithAllColumns = this._hasCustomizedColumns(query)
        }
        // The columns the query that wraps this select converts, when it passes on every column, have another alias here
        const innerAliases = isOutermostQuery && !convertColumns && context.resultConversionWithAllColumns

        // The columns of the select are the values of the JSON of an aggregated array
        const selectOfAggregatedArrayValues = !isOutermostQuery && this._isSelectOfAggregatedArrayValues(query)
        // The SQL of each column of the select, for the group by, the having and the order by that refer to it
        const selectColumnsSql = new Map<AnyValueSource, SelectColumnSql>()
        if (distinctAggregatedArray) {
            selectQuery += this._appendDistinctAggregatedArrayValues(distinctAggregatedArray.__aggregatedArrayColumns, context)
        } else if (needAggregateArrayWrapper || !this._needAggregateArrayColumnsTransformation(query, context)) {
            let requireComma = false
            let position = 0
            for (const property in columns) {
                if (requireComma) {
                    selectQuery += ', '
                }
                position++
                const columnForInsert = columnsForInsert[property]
                const paramsStart = context.params.length
                const columnSql = this._appendSelectColumn(columns[property]!, context, columnForInsert, isOutermostQuery)
                if (!columnForInsert) {
                    selectColumnsSql.set(columns[property]!, { sql: columnSql, name: property, position, paramsStart, paramsEnd: context.params.length })
                }
                if (convertColumns && !columnForInsert) {
                    selectQuery += this._appendResultColumnProjection(columns[property]!, columnSql, context)
                } else if (selectOfAggregatedArrayValues) {
                    selectQuery += this._appendAggregatedArrayValueProjection(columns[property]!, columnSql, context)
                } else {
                    selectQuery += columnSql
                }
                if (property) {
                    const alias = innerAliases && !columnForInsert && this._isConvertedResultColumn(columns[property]!, context) ? this._resultConversionInnerAlias(property) : property
                    selectQuery += ' as ' + this._appendColumnAlias(alias, context)
                }
                requireComma = true
            }
        } else {
            let aggregatedArrayColumns
            if (query.__oneColumn) {
                aggregatedArrayColumns = query.__columns['result']
                if (!aggregatedArrayColumns) {
                    throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'invalid result column' }, 'Result column for a select one column not found')
                }
            } else {
                aggregatedArrayColumns = query.__columns
            }
            selectQuery += this._appendAggregateArrayColumns(aggregatedArrayColumns, false, context, query)
        }

        if (tablesLength <= 0) {
            selectQuery += this._fromNoTable()
        } else {
            selectQuery += ' from '
            selectQuery += this._buildFromJoins(tables, joins, query.__requiredTablesOrViews, context)
        }

        const where = query.__where
        if (where) {
            const whereCondition = this._appendCondition(where, context)
            if (whereCondition) {
                selectQuery += ' where ' + whereCondition
            }
        }

        // Oracle recursive
        const startWith = query.__startWith
        if (startWith) {
            const startWithCondition = this._appendCondition(startWith, context)
            if (startWithCondition) {
                selectQuery += ' start with ' + startWithCondition
            }
        }

        // Oracle recursive
        const connectdBy = query.__connectBy
        if (connectdBy) {
            const connectByCondition = this._appendCondition(connectdBy, context)
            if (!connectByCondition) {
                // Every part of the condition was an IfValue without value. There is no condition with the same
                // meaning: always true walks without end, always false returns only the start rows, and dropping
                // the hierarchical clauses returns every row
                throw new TsSqlProcessingError({ reason: 'MISSING_RECURSIVE_CONDITION' }, 'No connect by condition generated for the hierarchical query')
            } else {
                if (query.__connectByNoCycle) {
                    selectQuery += ' connect by nocycle ' + connectByCondition
                } else {
                    selectQuery += ' connect by ' + connectByCondition
                }
            }
        }

        selectQuery += this._buildSelectGroupBy(query, context, isOutermostQuery, selectColumnsSql)

        const having = query.__having
        if (having) {
            const oldSelectColumnsSql = context.selectColumnsSql
            context.selectColumnsSql = selectColumnsSql
            const havingCondition = this._appendHavingCondition(having, context)
            context.selectColumnsSql = oldSelectColumnsSql
            if (havingCondition) {
                selectQuery += ' having ' + havingCondition
            }
        }

        if (customization && customization.customWindow) {
            selectQuery += ' window '
            selectQuery += this._appendRawFragment(customization.customWindow, context)
        }

        if (distinctAggregatedArray) {
            // The aggregate over the distinct values, which it converts
            const aggregateId = context.generateUnique()
            const wrapperAlias = 'a_' + aggregateId + '_'
            const property = distinctAggregatedArray.property
            let aggregate = this._appendAggregateArrayWrappedColumns(distinctAggregatedArray.__aggregatedArrayColumns, context, aggregateId)
            if (isOutermostQuery) {
                aggregate = this._finalizeAggregatedArrayResult(aggregate)
                if (convertColumns) {
                    aggregate = this._appendResultColumnProjection(columns[property]!, aggregate, context)
                }
            }
            if (property) {
                aggregate += ' as ' + this._appendColumnAlias(property, context)
            }
            selectQuery = selectQuery.substring(0, selectStart) + 'select ' + aggregate + ' from (' + selectQuery.substring(selectStart) + ')' + (this._supportTableAliasWithAs ? ' as ' : ' ') + wrapperAlias
        }

        if (emitOrderBy) {
            const oldSafeTableOrViewInOrderBy = context.safeTableOrView
            const oldOrderBySafeTableOrView = context.orderBySafeTableOrView
            const oldSelectColumnsSql = context.selectColumnsSql
            this._setSafeTableOrView(context, undefined)
            context.orderBySafeTableOrView = oldSafeTableOrViewInOrderBy
            context.selectColumnsSql = selectColumnsSql
            if (distinctConversionWrap || (!needAggregateArrayWrapper && this._needsSelectOrderByWrap(query, context))) {
                // The order by can't be written over the select, or the distinct must compare the values: the select is
                // wrapped, and the order by is written over the query that wraps it, where the columns of the select are
                // the columns of the from
                const wrapperAlias = 'o_' + context.generateUnique() + '_'
                selectQuery = selectQuery.substring(0, selectStart) + 'select ' + (conversionOnWrapper ? this._appendResultConversionWrapperColumns(query, context, wrapperAlias) : '*') + ' from (' + selectQuery.substring(selectStart) + ')'
                selectQuery += this._supportTableAliasWithAs ? ' as ' + wrapperAlias : ' ' + wrapperAlias
                const oldOrderByOnWrapper = context.orderByOnWrapper
                const oldResultConversionWrapperAlias = context.resultConversionWrapperAlias
                context.orderByOnWrapper = true
                context.resultConversionWrapperAlias = conversionOnWrapper ? wrapperAlias : undefined
                selectQuery += this._buildSelectOrderByForWrapper(query, context)
                context.resultConversionWrapperAlias = oldResultConversionWrapperAlias
                context.orderByOnWrapper = oldOrderByOnWrapper
            } else {
                selectQuery += this._buildSelectOrderBy(query, context)
            }
            context.selectColumnsSql = oldSelectColumnsSql
            context.orderBySafeTableOrView = oldOrderBySafeTableOrView
            this._setSafeTableOrView(context, oldSafeTableOrViewInOrderBy)
        }
        context.resultConversionWithAllColumns = oldResultConversionWithAllColumns
        if (!query.__asInlineAggregatedArrayValue || !this._supportLimitWhenAggregateArray || context.aggregateArrayWrapped) {
            selectQuery += this._buildSelectLimitOffset(query, context)
        }

        selectQuery += this._buildSelectAsAggregatedArray(query, context)

        if (customization && customization.afterQuery) {
            selectQuery += ' ' + this._appendRawFragment(customization.afterQuery, context)
        }

        if (needAggregateArrayWrapper) {
            selectQuery += this._appendAggregateArrayWrapperEnd(query, context, aggregateId)
        }

        this._setSafeTableOrView(context, oldSafeTableOrView)
        context.fakeNamesOf = oldFakeNameOf
        context.withGenerated = oldWithGenerated
        context.withGeneratedFinished = oldWithGeneratedFinished
        context.aggregateArrayWrapped = oldAggregateArrayWrapped
        return selectQuery
    }
    _appendSelectColumn(value: AnyValueSource, context: SqlBuildContext, columnForInsert: DBColumn | undefined, isOutermostQuery: boolean): string {
        if (columnForInsert) {
            const sql = this._appendCustomBooleanRemapForColumnIfRequired(columnForInsert, value, context, false)
            if (sql) {
                return sql
            }
        }
        const sql = this._appendColumnValue(value, context, isOutermostQuery)
        if (context.uuidTextsAsText?.has(value)) {
            return this._appendUuidTextAsText(sql)
        }
        return sql
    }
    _fromNoTable() {
        return ''
    }
    _buildSelectOrderBy(query: SelectData, context: SqlBuildContext): string {
        const orderBy = query.__orderBy
        if (!orderBy) {
            let orderByColumns = ''

            const customization = query.__customization
            if (customization && customization.beforeOrderByItems) {
                orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, context)
            }

            if (customization && customization.afterOrderByItems) {
                if (orderByColumns) {
                    orderByColumns += ', '
                }
                orderByColumns += this._appendRawFragment(customization.afterOrderByItems, context)
            }

            if (!orderByColumns) {
                return ''
            }
            if (query.__orderingSiblingsOnly) {
                // Oracle recursive
                return ' order siblings by ' + orderByColumns
            } else {
                return ' order by ' + orderByColumns
            }
        }

        let orderByColumns = ''

        const customization = query.__customization
        if (customization && customization.beforeOrderByItems) {
            orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, context)
        }

        for (let i = 0, length = orderBy.length; i < length; i++) {
            const entry = orderBy[i]!
            if (orderByColumns) {
                orderByColumns += ', '
            }
            const order = entry.order
            const ownTerms = this._appendOrderByEntryTerms(entry, query, context)
            if (ownTerms !== undefined) {
                orderByColumns += ownTerms
            } else if (!order) {
                orderByColumns += this._appendOrderByColumnAlias(entry, query, context)
            } else switch (order) {
                case 'asc':
                case 'desc':
                case 'asc nulls first':
                case 'asc nulls last':
                case 'desc nulls first':
                case 'desc nulls last' :
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, context) + ' ' + order
                    break
                case 'insensitive':
                case 'asc insensitive':
                case 'desc insensitive':
                case 'asc nulls first insensitive':
                case 'asc nulls last insensitive':
                case 'desc nulls first insensitive':
                case 'desc nulls last insensitive': {
                    let sqlOrder =order.substring(0, order.length - 12)
                    if (sqlOrder) {
                        sqlOrder = ' ' + sqlOrder
                    }
                    orderByColumns += this._appendOrderByColumnAliasInsensitive(entry, query, context) + sqlOrder
                    break
                }
                default:
                    throw new TsSqlProcessingError({ reason: 'INVALID_ORDER_BY_ORDERING', column: this._appendOrderByColumnAlias(entry, query, context), ordering: order }, 'Invalid order by: ' + order)
            }
        }

        if (customization && customization.afterOrderByItems) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            orderByColumns += this._appendRawFragment(customization.afterOrderByItems, context)
        }

        if (!orderByColumns) {
            return ''
        }
        if (query.__orderingSiblingsOnly) {
            // Oracle recursive
            return ' order siblings by ' + orderByColumns
        } else {
            return ' order by ' + orderByColumns
        }
    }
    /**
     * The terms of the order by for an entry that a dialect orders by several expressions of its own, with the
     * ordering of the entry already applied to each of them; undefined to order it by one expression, as usual
     */
    _appendOrderByEntryTerms(_entry: OrderByEntry, _query: SelectData, _context: SqlBuildContext): string | undefined {
        return undefined
    }
    /**
     * The order by names a column of the select that is converted in the outermost query
     * (`_isConvertedResultColumn`)
     */
    _isConvertedOrderByAlias(entry: OrderByEntry, query: SelectData, context: SqlBuildContext): boolean {
        const expression = entry.expression
        if (typeof expression !== 'string') {
            return false
        }
        const column = getQueryColumn(query.__columns, expression)
        return !!column && this._isConvertedResultColumn(column, context)
    }
    /**
     * The order by names a column of the select that is converted in the outermost query, and its conversion doesn't
     * order like the value (`_needsTheValueOfResultColumnToOrder`): a bare alias would order by the converted value
     */
    _isOrderByAliasNeedingTheValue(entry: OrderByEntry, query: SelectData, context: SqlBuildContext): boolean {
        const expression = entry.expression
        if (typeof expression !== 'string') {
            return false
        }
        const column = getQueryColumn(query.__columns, expression)
        return !!column && this._needsTheValueOfResultColumnToOrder(column, context)
    }
    _appendOrderByColumnAlias(entry: OrderByEntry, query: SelectData, context: SqlBuildContext): string {
        if (!context.orderByZonedAsInstant && this._isZonedTextOrderByEntry(entry, query)) {
            // Ordered by its instant, as Temporal's compare (its text orders by its wall clock)
            context.orderByZonedAsInstant = true
            try {
                return this._zonedToInstant(context, new OrderByEntryOperand(entry, query))
            } finally {
                context.orderByZonedAsInstant = false
            }
        }
        const wrapperAlias = context.resultConversionWrapperAlias
        if (wrapperAlias && this._isConvertedOrderByAlias(entry, query, context)) {
            // Over the query that wraps the select, the column of the wrapped query, not the converted one
            const name = entry.expression as string
            return wrapperAlias + '.' + this._appendColumnAlias(context.resultConversionWithAllColumns ? this._resultConversionInnerAlias(name) : name, context)
        }
        if (!wrapperAlias && this._isOrderByAliasNeedingTheValue(entry, query, context)) {
            if (query.__type === 'plain' && !context.orderByOnWrapper && !context.resultConversionDeferred && this._isCurrentRootQuery(query, context)) {
                // The expression of the column before converting it. An expression with parameters is written as the select
                // list writes it, with the same parameters; otherwise it is written qualified, because a bare column with
                // the name of the alias would be the alias
                const selectColumn = this._getOrderBySelectColumnWithParams(entry, query, context)
                if (selectColumn) {
                    return this._appendOrderBySelectColumnWithParams(selectColumn, entry, query, context)
                }
                return this._appendOrderByColumnExpression(entry, query, context)
            }
        }
        const expression = entry.expression
        const columns = query.__columns
        if (typeof expression === 'string') {
            const column = getQueryColumn(columns, expression)
            if (!column) {
                throw new TsSqlProcessingError({ reason: 'ORDER_BY_COLUMN_NOT_IN_SELECT', column: expression }, 'Column ' + expression + ' included in the order by not found in the select clause')
            }
            return this._appendColumnAlias(expression, context)
        } else if (isValueSource(expression)) {
            const result = this._appendSql(expression, context, false)
            return result
        } else {
            const result = this._appendRawFragment(expression, context)
            return result
        }
    }
    _appendOrderByColumnAliasInsensitive(entry: OrderByEntry, query: SelectData, context: SqlBuildContext): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        const stringColumn = this._isStringOrderByColumn(entry, query)
        if (!stringColumn || collation === '') {
            // Non-string column, or the engine handles case-insensitivity by
            // its default collation: the insensitive term renders nothing
            // extra, so a bare alias reference is enough.
            return this._appendOrderByColumnAlias(entry, query, context)
        }
        // The insensitive term wraps the column in an expression (`lower(...)` or `<col> collate <name>`)
        const wrapped = this._appendOrderByColumnForExpression(entry, query, context)
        if (collation) {
            return this._appendInsensitiveOrderByCollateReceiver(wrapped, entry, query) + ' collate ' + collation
        }
        return 'lower(' + wrapped + ')'
    }
    /**
     * The receiver a forced `collate` is applied to by `_appendOrderByColumnAliasInsensitive`.
     * The base returns the already-rendered expression unchanged; SQL Server overrides it to
     * convert a `uniqueidentifier` order-by column to `nvarchar(36)` first, since `collate` on a
     * bare `uniqueidentifier` is rejected there — the same treatment its string API applies.
     */
    _appendInsensitiveOrderByCollateReceiver(wrapped: string, _entry: OrderByEntry, _query: SelectData): string {
        return wrapped
    }
    /**
     * The column an order-by entry names, written where the ordering wraps it in an expression: `lower(...)`, a
     * `collate`, or the null check that emulates `nulls first` / `nulls last`. A bare alias is resolved to the column
     * of the select everywhere, but inside an expression it isn't on every database: PostgreSQL and SQL Server don't
     * see the aliases there, and MySQL, MariaDB and SQLite take a column of the from with the same name before the
     * alias. On those databases the column of the select is written as the select list writes it: the names in it are
     * columns of the from, which these databases resolve first. The library doesn't know every column of the tables
     * (only the declared ones), so it is written that way even when no declared column has the name of the alias.
     */
    _appendOrderByColumnForExpression(entry: OrderByEntry, query: SelectData, context: SqlBuildContext): string {
        const expression = entry.expression
        if (typeof expression !== 'string' || query.__type === 'compound' || context.orderByOnWrapper || this._supportOrderByColumnAliasInExpression()) {
            // An expression is written as it is; in the order by of a compound query, or of the query that wraps the
            // select, the aliases are the columns of the from
            return this._appendOrderByColumnAlias(entry, query, context)
        }
        const selectColumn = this._getOrderBySelectColumnWithParams(entry, query, context)
        if (selectColumn) {
            return this._appendOrderBySelectColumnWithParams(selectColumn, entry, query, context)
        }
        return this._appendOrderByColumnSourceAsInSelect(entry, query, context)
    }
    /**
     * The column of the select an order-by entry names, when its SQL carries parameters: written again, the expression
     * would get new parameters, and the database wouldn't take it as the one the query is grouped by.
     */
    _getOrderBySelectColumnWithParams(entry: OrderByEntry, query: SelectData, context: SqlBuildContext): SelectColumnSql | undefined {
        const expression = entry.expression
        if (typeof expression !== 'string') {
            return undefined
        }
        const column = getQueryColumn(query.__columns, expression)
        if (!column) {
            return undefined
        }
        const selectColumn = context.selectColumnsSql?.get(column)
        if (!selectColumn || selectColumn.paramsStart === selectColumn.paramsEnd) {
            return undefined
        }
        return selectColumn
    }
    _appendOrderBySelectColumnWithParams(selectColumn: SelectColumnSql, _entry: OrderByEntry, _query: SelectData, _context: SqlBuildContext): string {
        // The same SQL as the select list, with the same parameters: the same expression for the database
        return selectColumn.sql
    }
    /**
     * Whether the order by must be written over a query that wraps the select (`select * from (<select>) order by
     * ...`), because no way of writing it over the select itself is right
     */
    _needsSelectOrderByWrap(query: SelectData, context: SqlBuildContext): boolean {
        // A distinct select can only order by what it selects, and the converted column is another value that doesn't
        // order like it: the order by goes over a query that wraps the select, which converts the columns
        if (query.__type !== 'plain' || !query.__distinct || !query.__orderBy || context.resultConversionDeferred || !this._isCurrentRootQuery(query, context)) {
            return false
        }
        return query.__orderBy.some(entry => this._isOrderByAliasNeedingTheValue(entry, query, context))
    }
    _appendHavingCondition(having: ILogicalValueSource<any, any>, context: SqlBuildContext): string {
        return this._appendCondition(having, context)
    }
    /**
     * Render the order-by entry's underlying source expression as it appears in
     * the SELECT clause (a bare column name on a single-table select, qualified
     * across a join), independent of the qualified-everything mode the ORDER BY
     * build uses for value-source terms. Used where the ordering wraps a column
     * of the select in an expression (see `_appendOrderByColumnForExpression`),
     * so `lower(<src>)` / `<src> collate <name>` / `<src> is null` reads like the
     * projected column. See `_getOrderBySafeTableOrView`.
     */
    _appendOrderByColumnSourceAsInSelect(entry: OrderByEntry, query: SelectData, context: SqlBuildContext): string {
        const oldSafeTableOrView = context.safeTableOrView
        this._setSafeTableOrView(context, context.orderBySafeTableOrView)
        const result = this._appendOrderByColumnExpression(entry, query, context)
        this._setSafeTableOrView(context, oldSafeTableOrView)
        return result
    }
    _appendOrderByColumnExpression(entry: OrderByEntry, query: SelectData, context: SqlBuildContext): string {
        // Resolve the order-by entry to its underlying source expression.
        // Unlike `_appendOrderByColumnAlias`, a string entry is resolved to the
        // SELECT column it names and rendered as that column's expression (not
        // the output alias). Required wherever the ordering term is wrapped in
        // an expression (`lower(...)`, `collate`, a null check), because the
        // strict engines don't resolve a SELECT alias inside an ORDER BY
        // expression.
        const expression = entry.expression
        if (typeof expression === 'string') {
            const column = getQueryColumn(query.__columns, expression)
            if (!column) {
                throw new TsSqlProcessingError({ reason: 'ORDER_BY_COLUMN_NOT_IN_SELECT', column: expression }, 'Column ' + expression + ' included in the order by not found in the select clause')
            }
            return this._appendSql(column, context, false)
        } else if (isValueSource(expression)) {
            return this._appendSql(expression, context, false)
        } else {
            return this._appendRawFragment(expression, context)
        }
    }
    _isStringOrderByColumn(entry: OrderByEntry, query: SelectData): boolean {
        const expression = entry.expression
        const columns = query.__columns
        if (typeof expression === 'string') {
            const column = getQueryColumn(columns, expression)
            if (!column) {
                throw new TsSqlProcessingError({ reason: 'ORDER_BY_COLUMN_NOT_IN_SELECT', column: expression }, 'Column ' + expression + ' included in the order by not found in the select clause')
            }
            return __isStringValueSource(__asNodeValueSource(column))
        } else if (isValueSource(expression)) {
            return __isStringValueSource(__asNodeValueSource(expression))
        } else {
            return false
        }
    }
    /**
     * Whether this dialect resolves a SELECT output alias when it appears
     * *inside an expression* in the ORDER BY clause (e.g. `order by
     * lower(<alias>)` / `order by <alias> collate <name>`). A bare `order by
     * <alias>` reference works everywhere; the question is only about an alias
     * wrapped in an expression. Verified against the real engines: Oracle
     * resolves it, also when a column of the from has the same name (the alias
     * is quoted); PostgreSQL and SQL Server do not (they resolve any name inside
     * an expression against the input columns and fail with "column does not
     * exist" / error 207); MySQL, MariaDB and SQLite resolve it only when no
     * column of the from has the same name. When `false`, the ordering
     * references the alias' underlying expression instead — see
     * `_appendOrderByColumnForExpression`.
     */
    _supportOrderByColumnAliasInExpression(): boolean {
        return true
    }
    /**
     * Whether this dialect accepts a function call (e.g. `lower(col)`) as an
     * ORDER BY term of a compound query (`UNION` / `INTERSECT` / `EXCEPT`).
     * The SQL standard restricts a compound ORDER BY to result-column names
     * and ordinal positions; only the lenient engines (MySQL / MariaDB) also
     * accept expressions there. When `false`, a case-insensitive ordering
     * that renders as `lower(col)` cannot be emitted inline and is applied on
     * a wrapping `select * from (<compound>)` instead — see
     * `_needsCompoundInsensitiveOrderByWrap`.
     */
    _supportFunctionInCompoundOrderBy(): boolean {
        return false
    }
    /**
     * Whether this dialect accepts a `<col> collate <name>` term as an ORDER
     * BY term of a compound query. SQLite accepts it (COLLATE is a modifier on
     * the result column, not a free expression) together with MySQL / MariaDB;
     * PostgreSQL / SQL Server / Oracle reject any expression there. When
     * `false`, a collation-based case-insensitive ordering is applied on a
     * wrapping select instead — see `_needsCompoundInsensitiveOrderByWrap`.
     */
    _supportCollateInCompoundOrderBy(): boolean {
        return false
    }
    /**
     * A compound query's ORDER BY may reference only result-column names /
     * ordinal positions on the strict engines, so a case-insensitive ordering
     * that renders as `lower(col)` (no `insensitiveCollation` configured) or
     * `col collate <name>` (configured) is illegal inline there. This reports
     * whether such an entry is present and this dialect can't render it inline,
     * in which case the compound is wrapped as `select * from (<compound>)` and
     * the ordering is applied on the (plain) wrapper, where it is legal. The
     * inner compound is emitted untouched so its set semantics (UNION DISTINCT
     * dedup, INTERSECT / EXCEPT matching) and column collations are preserved.
     */
    _needsCompoundInsensitiveOrderByWrap(query: SelectData): boolean {
        if (query.__type !== 'compound') {
            return false
        }
        const orderBy = query.__orderBy
        if (!orderBy) {
            return false
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation === '') {
            return false // the insensitive term is ignored entirely, nothing renders as an expression
        }
        for (let i = 0, length = orderBy.length; i < length; i++) {
            const entry = orderBy[i]!
            const order = entry.order
            if (!order || order.indexOf('insensitive') < 0) {
                continue
            }
            if (!this._isStringOrderByColumn(entry, query)) {
                continue // the insensitive term is ignored for non-string columns, renders as a plain alias
            }
            if (collation) {
                if (!this._supportCollateInCompoundOrderBy()) {
                    return true
                }
            } else if (!this._supportFunctionInCompoundOrderBy()) {
                return true
            }
        }
        return false
    }
    /**
     * Whether the compound query's ORDER BY contains a value-source term that
     * this dialect can't render inline. A compound ORDER BY may reference only
     * result-column names / ordinal positions on the strict engines, so a
     * value source (the only thing the `orderBy(valueSource)` overload accepts —
     * always a no-table expression like a constant) is illegal inline there and
     * the compound must be wrapped as `select * from (<compound>)` so the
     * expression becomes a legal ORDER BY term on the plain wrapper. MySQL /
     * MariaDB accept expressions inline (`_supportFunctionInCompoundOrderBy`),
     * so they render it without the wrapper. A raw fragment that embeds an
     * interpolated value source / subquery renders as an expression or bound
     * parameter (e.g. `` rawFragment`${const(1, 'int')}` `` → `$1`) and slips
     * past the `isValueSource` gate, so it is treated the same way. A raw
     * fragment with no interpolations is a literal the caller owns (an ordinal
     * `order by 1`, an output-column name) and stays inline untouched.
     */
    _needsCompoundExpressionOrderByWrap(query: SelectData): boolean {
        if (query.__type !== 'compound') {
            return false
        }
        const orderBy = query.__orderBy
        if (!orderBy) {
            return false
        }
        if (this._supportFunctionInCompoundOrderBy()) {
            return false // the lenient engines accept the expression inline, no wrapper needed
        }
        for (let i = 0, length = orderBy.length; i < length; i++) {
            const entry = orderBy[i]!
            const expression = entry.expression
            if (isValueSource(expression)) {
                return true
            }
            if (expression instanceof RawFragmentImpl && expression.__params.length > 0) {
                // A raw fragment embedding a value source / subquery renders as
                // an expression or bound parameter, illegal inline here on the
                // strict engines just like a bare value source.
                return true
            }
        }
        return false
    }
    /**
     * Whether the compound query's ORDER BY contains a NULLs-ordering term this
     * dialect emulates with an expression (e.g. `iif(col is null, …)`) instead
     * of a native `nulls first` / `nulls last`. Such an expression is illegal
     * inside a compound ORDER BY on the strict engines, so the compound must be
     * wrapped as `select * from (<compound>)` and the ordering applied on the
     * plain wrapper. Defaults to `false`: the engines with native NULLS ordering
     * emit nothing that needs the wrapper here. Overridden by
     * `SqlServerSqlBuilder`, whose emulation renders an `iif(...)` term.
     */
    _needsCompoundNullsEmulationOrderByWrap(_query: SelectData): boolean {
        return false
    }
    /**
     * Whether the compound query's ORDER BY needs the `select * from (<compound>)`
     * wrapper for any reason — a case-insensitive term that renders as an
     * expression, an ordering by a value-source expression, or a NULLs-ordering
     * term emulated as an expression. Each kind is illegal inside a compound
     * ORDER BY on the strict engines and becomes legal on the plain wrapper.
     */
    _needsCompoundOrderByWrap(query: SelectData): boolean {
        return this._needsCompoundInsensitiveOrderByWrap(query) || this._needsCompoundExpressionOrderByWrap(query) || this._needsCompoundNullsEmulationOrderByWrap(query) || this._needsCompoundZonedOrderByWrap(query)
    }
    /** A compound query can only order by its columns: a zoned date and time kept as text is ordered by its instant over a query that wraps it */
    _needsCompoundZonedOrderByWrap(query: SelectData): boolean {
        return query.__type === 'compound' && !!query.__orderBy && query.__orderBy.some(entry => this._isZonedTextOrderByEntry(entry, query))
    }
    /** The order by names a zoned date and time kept as text (see _zonedKeptAsText) */
    _isZonedTextOrderByEntry(entry: OrderByEntry, query: SelectData): boolean {
        if (!this._zonedKeptAsText()) {
            return false
        }
        const expression = entry.expression
        const column = typeof expression === 'string' ? getQueryColumn(query.__columns, expression) : expression
        return isValueSource(column) && __isZonedDateTimeClass(__classOf(__asNodeValueSource(column as AnyValueSource)))
    }
    /**
     * Render the ORDER BY for the outer `select * from (<compound>)` wrapper
     * emitted when `_needsCompoundInsensitiveOrderByWrap` is `true`. The
     * wrapper is a plain (non-compound) select, so the case-insensitive term
     * (`lower(col)` / `col collate <name>`) is legal here even on the dialects
     * that reject it inside a compound ORDER BY. Defaults to the normal
     * order-by builder; Oracle overrides it because its `_buildSelectOrderBy`
     * switches compound queries to ordinal positions, which is not what the
     * plain wrapper needs.
     */
    _buildSelectOrderByForWrapper(query: SelectData, context: SqlBuildContext): string {
        return this._buildSelectOrderBy(query, context)
    }
    _buildSelectLimitOffset(query: SelectData, context: SqlBuildContext): string {
        let result = ''

        const offset = query.__offset
        if (offset !== null && offset !== undefined) {
            result += ' offset ' + this._appendValue(offset, context, __registeredDataType('int'), false) + ' rows'
        }
        const limit = query.__limit
        if (limit !== null && limit !== undefined) {
            result += ' fetch next ' + this._appendValue(limit, context, __registeredDataType('int'), false) + ' rows only'
        }
        return result
    }
    /**
     * Whether `INSERT` statements support a leading `WITH` clause (i.e. emit
     * `WITH cte AS (...) INSERT INTO ...`). When `false`, any CTEs associated
     * with the INSERT are not emitted at the INSERT level — engines that
     * inline CTEs (e.g. MySQL before 8.0 via `_appendTableOrViewNameForFrom`)
     * rely on that inlining to keep the resulting SQL valid.
     */
    _useInsertSupportWith(): boolean {
        return true
    }
    _buildInsertMultiple(query: InsertData, context: SqlBuildContext): string {
        const multiple = query.__multiple
        if (!multiple) {
            throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'expecting insert of multiple values' }, 'Exepected a multiple insert')
        }
        if (multiple.length <= 0) {
            return ''
        }

        this._ensureRootQuery(query, context)
        const oldSafeTableOrView = context.safeTableOrView
        const oldFakeNameOf = context.fakeNamesOf
        context.fakeNamesOf = undefined

        const table = query.__table
        const customization = query.__customization
        this._setSafeTableOrView(context, table)

        let insertQuery = ''
        if (customization && customization.beforeQuery) {
            insertQuery += this._appendRawFragment(customization.beforeQuery, context) + ' '
        }
        if (this._useInsertSupportWith()) {
            insertQuery += this._buildWith(query, context)
        }
        insertQuery += 'insert '
        if (customization && customization.afterInsertKeyword) {
            insertQuery += this._appendRawFragment(customization.afterInsertKeyword, context) + ' '
        }
        insertQuery += this._buildInsertOnConflictBeforeInto(query, context)
        insertQuery += 'into '
        insertQuery += this._appendTableOrViewName(table, context)

        const shape = query.__shape
        let usedColumns: { [name: string]: boolean | undefined } = {}
        let translationToShape: { [columnName: string]: string /* name in shape */ } | undefined
        if (shape) { // Follow shape order
            for (let i = 0, length = multiple.length; i < length; i++) {
                const sets = multiple[i]
                const properties = Object.getOwnPropertyNames(sets)
                for (let j = 0, length = properties.length; j < length; j++) {
                    const property = properties[j]!
                    const columnName = shape[property]
                    if (typeof columnName !== 'string') {
                        continue
                    }
                    usedColumns[columnName] = true
                }
            }

            // Sort according the shape
            const unorderedUsedColumn = usedColumns
            usedColumns = {}
            translationToShape = {}
            const properties = Object.getOwnPropertyNames(shape)
            for (let i = 0, length = properties.length; i < length; i++) {
                const property = properties[i]!
                const columnName: string = shape[property]!
                const column = __getColumnOfObject(table, columnName)
                if (!column) {
                    // Additional property provided in the value object
                    // Skipped because it is not part of the table
                    // This allows to have more complex objects used in the query
                    continue
                }
                if (!(columnName in unorderedUsedColumn)) {
                    // No value set for that property in the shape
                    continue
                }
                usedColumns[columnName] = true
                translationToShape[columnName] = property
            }
        } else { // No shape, follow set order
            for (let i = 0, length = multiple.length; i < length; i++) {
                const sets = multiple[i]
                const properties = Object.getOwnPropertyNames(sets)
                for (let j = 0, length = properties.length; j < length; j++) {
                    const columnName = properties[j]!
                    usedColumns[columnName] = true
                }
            }
        }

        let columns = ''
        const nextSequenceValues: Array<{ name: string, typeClass: DataTypeClass }> = []
        for (const columnName of __columnPathsOf(table)) {
            if (columnName in usedColumns) {
                // Set in at least one row: emitted with the used columns, a row that doesn't set it gets the next
                // value of the sequence there
                continue
            }
            const column = __getColumnOfObject(table, columnName)
            if (!column) {
                continue
            }
            const nodeColumn = __asDBColumnValueSource(column)
            if (!nodeColumn.__sequenceName) {
                continue
            }

            if (columns) {
                columns += ', '
            }

            columns += this._appendRawColumnName(column, context)
            nextSequenceValues.push({ name: nodeColumn.__sequenceName, typeClass: __classOf(nodeColumn) })
        }
        for (let columnName in usedColumns) {
            const column = __getColumnOfObject(table, columnName)
            if (!column) {
                // Additional property provided in the value object
                // Skipped because it is not part of the table
                // This allows to have more complex objects used in the query
                continue
            }

            if (columns) {
                columns += ', '
            }
            columns += this._appendRawColumnName(column, context)
        }

        insertQuery += ' (' + columns + ')'
        insertQuery += this._buildInsertOutput(query, context)

        let multipleValues = ''
        for (let i = 0, length = multiple.length; i < length; i++) {
            let values = ''
            for (let j = 0, length = nextSequenceValues.length; j < length; j++) {
                if (values) {
                    values += ', '
                }
                const sequence = nextSequenceValues[j]!
                values += this._nextSequenceValue(context, sequence.name, sequence.typeClass)
            }

            const sets = multiple[i]!

            for (let columnName in usedColumns) {
                const column = __getColumnOfObject(table, columnName)
                if (!column) {
                    // Additional property provided in the value object
                    // Skipped because it is not part of the table
                    // This allows to have more complex objects used in the query
                    continue
                }

                if (values) {
                    values += ', '
                }

                let setPropertyName
                if (translationToShape) {
                    setPropertyName = translationToShape[columnName]!
                } else {
                    setPropertyName = columnName
                }
                const value = sets[setPropertyName]
                const nodeColumn = __asDBColumnValueSource(column)
                const sequenceName = nodeColumn.__sequenceName
                if (!(setPropertyName in sets) && sequenceName) {
                    values += this._nextSequenceValue(context, sequenceName, __classOf(nodeColumn))
                } else {
                    values += this._appendSetValue(setPropertyName, i, column, value, context)
                }
            }

            if (multipleValues) {
                multipleValues += ', (' + values + ')'
            } else {
                multipleValues = '(' + values + ')'
            }
        }

        insertQuery += ' values ' + multipleValues
        insertQuery += this._buildInsertOnConflictBeforeReturning(query, context)
        insertQuery += this._buildInsertReturning(query, context)
        if (customization && customization.afterQuery) {
            insertQuery += ' ' + this._appendRawFragment(customization.afterQuery, context)
        }

        this._setSafeTableOrView(context, oldSafeTableOrView)
        context.fakeNamesOf = oldFakeNameOf
        this._resetRootQuery(query, context)
        return insertQuery
    }
    _appendCustomBooleanRemapForColumnIfRequired(column: DBColumn, value: any, context: SqlBuildContext, forceTypeCast: boolean): string | null {
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
                        return 'case ' + this._appendValue(value, context, __adaptedTypeClassOf(__classOf(nodeColumn), columnTypeAdapter), forceTypeCast) + ' when ' + this._true(context) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' when ' + this._false(context) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' else null end'
                    }
                }
            } else if (isValueSource(value)) {
                // There are some boolean expressions involved
                if (nodeColumn.__optionalType === 'required') {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, context, __adaptedTypeClassOf(__classOf(nodeColumn), columnTypeAdapter), forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' end'
                } else {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, context, __adaptedTypeClassOf(__classOf(nodeColumn), columnTypeAdapter), forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' when not ' + this._appendConditionValueParenthesis(value, context, __adaptedTypeClassOf(__classOf(nodeColumn), columnTypeAdapter), forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' else null end'
                }
            } else {
                if (nodeColumn.__optionalType === 'required') {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, context, __adaptedTypeClassOf(__classOf(nodeColumn), columnTypeAdapter), forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' end'
                } else {
                    // remapped
                    return 'case ' + this._appendValue(value, context, __adaptedTypeClassOf(__classOf(nodeColumn), columnTypeAdapter), forceTypeCast) + ' when ' + this._true(context) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' when ' + this._false(context) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' else null end'
                }
            }
        }

        // if value is column and its type adapter is CustomBooleanTypeAdapter append value will be required to normalize value
        // if not it is same boolean, nothing to transform here
        return null
    }
    /**
     * The value of a property in a set or in a row of a `Values`: an invalid value tells the
     * table, the property, and the row when there are several, as the values received from the database do.
     */
    _appendSetValue(columnPath: string, rowIndex: number | undefined, column: DBColumn, value: any, context: SqlBuildContext, forceTypeCast: boolean = false): string {
        try {
            return this._appendValueForColumn(column, value, context, forceTypeCast)
        } catch (e) {
            if (e instanceof TsSqlError && e.errorReason.reason === 'INVALID_VALUE_TO_SEND_TO_DATABASE') {
                e.errorReason.columnPath = columnPath
                e.errorReason.rowIndex = rowIndex
                // The name in the database of the table, view or values the value goes to, as a database error names it
                e.errorReason.tableName = __asTableOrViewRoot(__asDBColumnValueSource(column).__tableOrView).__name
            }
            throw e
        }
    }
    _appendValueForColumn(column: DBColumn, value: any, context: SqlBuildContext, forceTypeCast: boolean): string {
        const sql = this._appendCustomBooleanRemapForColumnIfRequired(column, value, context, forceTypeCast)
        if (sql) {
            return sql
        }
        const nodeColumn = __asDBColumnValueSource(column)
        // A value given for a column of a table takes the type of the column, not the one of its parameter: its parameter
        // is marked so (isValueForColumn in the context of the parameter), which a query runner may use not to cast it
        if (hasToSql(value) || hasWithData(nodeColumn.__tableOrView) && isWithValuesData(nodeColumn.__tableOrView)) {
            return this._appendValue(value, context, __classOf(nodeColumn), forceTypeCast)
        }
        const oldAssigningValueToColumn = context.assigningValueToColumn
        context.assigningValueToColumn = true
        try {
            return this._appendValue(value, context, __classOf(nodeColumn), forceTypeCast)
        } finally {
            context.assigningValueToColumn = oldAssigningValueToColumn
        }
    }
    _buildInsertDefaultValues(query: InsertData, context: SqlBuildContext): string {
        this._ensureRootQuery(query, context)
        const oldSafeTableOrView = context.safeTableOrView
        const oldFakeNameOf = context.fakeNamesOf
        context.fakeNamesOf = undefined

        const table = query.__table
        const customization = query.__customization

        this._setSafeTableOrView(context, table)

        let insertQuery = ''
        if (customization && customization.beforeQuery) {
            insertQuery += this._appendRawFragment(customization.beforeQuery, context) + ' '
        }
        if (this._useInsertSupportWith()) {
            insertQuery += this._buildWith(query, context)
        }
        insertQuery += 'insert '
        if (customization && customization.afterInsertKeyword) {
            insertQuery += this._appendRawFragment(customization.afterInsertKeyword, context) + ' '
        }
        insertQuery += this._buildInsertOnConflictBeforeInto(query, context)
        insertQuery += 'into '
        insertQuery += this._appendTableOrViewName(table, context)

        let columns = ''
        const sequences: Array<{ name: string, typeClass: DataTypeClass }> = []
        for (const columnName of __columnPathsOf(table)) {
            const column = __getColumnOfObject(table, columnName)
            if (!column) {
                continue
            }
            const nodeColumn = __asDBColumnValueSource(column)
            if (!nodeColumn.__sequenceName) {
                continue
            }

            if (columns) {
                columns += ', '
            }

            columns += this._appendRawColumnName(column, context)
            sequences.push({ name: nodeColumn.__sequenceName, typeClass: __classOf(nodeColumn) })
        }

        if (columns) {
            insertQuery += ' (' + columns + ')'
        }
        insertQuery += this._buildInsertOutput(query, context)

        let values = ''
        for (let i = 0, length = sequences.length; i < length; i++) {
            const sequence = sequences[i]!
            if (values) {
                values += ', '
            }

            values += this._nextSequenceValue(context, sequence.name, sequence.typeClass)
        }

        if (values) {
            insertQuery += ' values (' + values + ')'
        } else {
            insertQuery += ' default values'
        }
        insertQuery += this._buildInsertOnConflictBeforeReturning(query, context)
        insertQuery += this._buildInsertReturning(query, context)
        if (customization && customization.afterQuery) {
            insertQuery += ' ' + this._appendRawFragment(customization.afterQuery, context)
        }

        this._setSafeTableOrView(context, oldSafeTableOrView)
        context.fakeNamesOf = oldFakeNameOf
        this._resetRootQuery(query, context)
        return insertQuery
    }
    _buildInsert(query: InsertData, context: SqlBuildContext): string {
        this._ensureRootQuery(query, context)
        const oldSafeTableOrView = context.safeTableOrView
        const oldFakeNameOf = context.fakeNamesOf
        context.fakeNamesOf = undefined

        const table = query.__table
        const sets = query.__sets
        const customization = query.__customization

        this._setSafeTableOrView(context, table)

        let insertQuery = ''
        if (customization && customization.beforeQuery) {
            insertQuery += this._appendRawFragment(customization.beforeQuery, context) + ' '
        }
        if (this._useInsertSupportWith()) {
            insertQuery += this._buildWith(query, context)
        }
        insertQuery += 'insert '
        if (customization && customization.afterInsertKeyword) {
            insertQuery += this._appendRawFragment(customization.afterInsertKeyword, context) + ' '
        }
        insertQuery += this._buildInsertOnConflictBeforeInto(query, context)
        insertQuery += 'into '
        insertQuery += this._appendTableOrViewName(table, context)

        const shape = query.__shape
        let columnsInShape: { [columnName: string] : boolean} | undefined
        if (shape) {
            columnsInShape = {}
            for (let property in shape) {
                const colunName = shape[property]
                if (typeof colunName === 'string') {
                    columnsInShape[colunName] = true
                }
            }
        }

        let columns = ''
        const sequences: Array<{ name: string, typeClass: DataTypeClass }> = []
        for (const columnName of __columnPathsOf(table)) {
            if (columnsInShape) {
                if (columnName in columnsInShape) {
                    continue
                }
            } else {
                if (columnName in sets) {
                    continue
                }
            }
            const column = __getColumnOfObject(table, columnName)
            if (!column) {
                continue
            }
            const nodeColumn = __asDBColumnValueSource(column)
            if (!nodeColumn.__sequenceName) {
                continue
            }

            if (columns) {
                columns += ', '
            }

            columns += this._appendRawColumnName(column, context)
            sequences.push({ name: nodeColumn.__sequenceName, typeClass: __classOf(nodeColumn) })
        }
        if (shape) { // Follow shape order
            const properties = Object.getOwnPropertyNames(shape)
            for (let i = 0, length = properties.length; i < length; i++) {
                const property = properties[i]!
                const columnName = shape[property]!
                const column = __getColumnOfObject(table, columnName)
                if (!column) {
                    // Additional property provided in the value object
                    // Skipped because it is not part of the table
                    // This allows to have more complex objects used in the query
                    continue
                }
                if (!(property in sets)) {
                    // No value set for that property in the shape
                    continue
                }

                if (columns) {
                    columns += ', '
                }
                columns += this._appendRawColumnName(column, context)
            }
        } else { // No shape, follow set order
            const properties = Object.getOwnPropertyNames(sets)
            for (let i = 0, length = properties.length; i < length; i++) {
                const property = properties[i]!
                const column = __getColumnOfObject(table, property)
                if (!column) {
                    // Additional property provided in the value object
                    // Skipped because it is not part of the table
                    // This allows to have more complex objects used in the query
                    continue
                }

                if (columns) {
                    columns += ', '
                }
                columns += this._appendRawColumnName(column, context)
            }
        }

        insertQuery += ' (' + columns + ')'
        insertQuery += this._buildInsertOutput(query, context)

        let values = ''
        for (let i = 0, length = sequences.length; i < length; i++) {
            const sequence = sequences[i]!
            if (values) {
                values += ', '
            }

            values += this._nextSequenceValue(context, sequence.name, sequence.typeClass)
        }

        if (shape) { // Follow shape order
            const properties = Object.getOwnPropertyNames(shape)
            for (let i = 0, length = properties.length; i < length; i++) {
                const property = properties[i]!
                const columnName = shape[property]!
                const column = __getColumnOfObject(table, columnName)
                if (!column) {
                    // Additional property provided in the value object
                    // Skipped because it is not part of the table
                    // This allows to have more complex objects used in the query
                    continue
                }
                if (!(property in sets)) {
                    // No value set for that property in the shape
                    continue
                }

                if (values) {
                    values += ', '
                }
                const value = sets[property]
                values += this._appendSetValue(property, undefined, column, value, context)
            }
        } else { // No shape, follow set order
            const properties = Object.getOwnPropertyNames(sets)
            for (let i = 0, length = properties.length; i < length; i++) {
                const property = properties[i]!
                const column = __getColumnOfObject(table, property)
                if (!column) {
                    // Additional property provided in the value object
                    // Skipped because it is not part of the table
                    // This allows to have more complex objects used in the query
                    continue
                }

                if (values) {
                    values += ', '
                }
                const value = sets[property]
                values += this._appendSetValue(property, undefined, column, value, context)
            }
        }

        insertQuery += ' values (' + values + ')'
        insertQuery += this._buildInsertOnConflictBeforeReturning(query, context)
        insertQuery += this._buildInsertReturning(query, context)
        if (customization && customization.afterQuery) {
            insertQuery += ' ' + this._appendRawFragment(customization.afterQuery, context)
        }

        this._setSafeTableOrView(context, oldSafeTableOrView)
        context.fakeNamesOf = oldFakeNameOf
        this._resetRootQuery(query, context)
        return insertQuery
    }
    _buildInsertFromSelect(query: InsertData, context: SqlBuildContext): string {
        const from = query.__from
        if (!from) {
            throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'expecting insert from select' }, 'Exepected an insert from a subquery')
        }

        this._ensureRootQuery(query, context)
        const oldSafeTableOrView = context.safeTableOrView
        const oldFakeNameOf = context.fakeNamesOf
        context.fakeNamesOf = undefined

        const table = query.__table
        const selectColumns = from.__columns
        const customization = query.__customization

        this._setSafeTableOrView(context, table)

        let insertQuery = ''
        if (customization && customization.beforeQuery) {
            insertQuery += this._appendRawFragment(customization.beforeQuery, context) + ' '
        }
        if (this._useInsertSupportWith()) {
            insertQuery += this._buildWith(query, context)
        }
        insertQuery += 'insert '
        if (customization && customization.afterInsertKeyword) {
            insertQuery += this._appendRawFragment(customization.afterInsertKeyword, context) + ' '
        }
        insertQuery += this._buildInsertOnConflictBeforeInto(query, context)
        insertQuery += 'into '
        insertQuery += this._appendTableOrViewName(table, context)

        const columnsForInsert: { [name: string]: DBColumn | undefined } = {}

        let columns = ''
        const addedColumns: string[] = []
        const flatSelectColumns: FlatQueryColumns = {}
        flattenQueryColumns(selectColumns, flatSelectColumns, '')
        for (const columnName of __columnPathsOf(table)) {
            if (columnName in flatSelectColumns) {
                continue
            }
            const column = __getColumnOfObject(table, columnName)
            if (!column) {
                continue
            }
            const nodeColumn = __asDBColumnValueSource(column)
            if (!nodeColumn.__sequenceName) {
                continue
            }

            addedColumns.push(columnName)
            columnsForInsert[columnName] = column
            const sequenceValue = __createSequence('_nextSequenceValue', nodeColumn.__sequenceName, __adaptedTypeClassOf(__typeClassOf(nodeColumn), nodeColumn.__typeAdapter), 'required')
            selectColumns[columnName] = sequenceValue
            flatSelectColumns[columnName] = sequenceValue
        }
        const properties = Object.getOwnPropertyNames(flatSelectColumns)
        for (let i = 0, length = properties.length; i < length; i++) {
            if (columns) {
                columns += ', '
            }

            const property = properties[i]!
            const column = __getColumnOfObject(table, property)
            if (column) {
                columns += this._appendRawColumnName(column, context)
                columnsForInsert[property] = column
            } else {
                throw new TsSqlProcessingError({ reason: 'COLUMN_FOR_INSERT_COMING_FROM_SUBQUERY_NOT_IN_TABLE', column: property }, 'Unable to find the column "' + property + ' in the table "' + this._getTableOrViewVisibleName(table) +'". The column is not included in the table definition')
            }
        }

        insertQuery += ' (' + columns + ')'
        insertQuery += this._buildInsertOutput(query, context)
        insertQuery += ' ' + this._buildInsertSelectSource(query, from, columns, context, columnsForInsert)
        insertQuery += this._buildInsertOnConflictBeforeReturning(query, context)
        insertQuery += this._buildInsertReturning(query, context)
        if (customization && customization.afterQuery) {
            insertQuery += ' ' + this._appendRawFragment(customization.afterQuery, context)
        }

        for (let i = 0, length = addedColumns.length; i < length; i++) {
            const columnName = addedColumns[i]!
            delete selectColumns[columnName]
        }

        this._setSafeTableOrView(context, oldSafeTableOrView)
        context.fakeNamesOf = oldFakeNameOf
        this._resetRootQuery(query, context)
        return insertQuery
    }
    _buildInsertOutput(_query: InsertData, _context: SqlBuildContext): string {
        return ''
    }
    _buildInsertReturning(query: InsertData, context: SqlBuildContext): string {
        const idColumn = query.__idColumn
        if (idColumn) {
            this._setContainsInsertReturningClause(context, true)
            return ' returning ' + this._appendSql(idColumn, context, false)
        }


        const isOutermostQuery = this._isCurrentRootQuery(query, context)
        const result = this._buildQueryReturning(query.__columns, context, isOutermostQuery)
        this._setContainsInsertReturningClause(context, !!result)
        return result
    }
    _buildQueryReturning(queryColumns: QueryColumns | undefined, context: SqlBuildContext, isOutermostQuery: boolean): string {
        if (!queryColumns) {
            if (isOutermostQuery) {
                this._setContainsMutationReturningClause(context, false)
            }
            return ''
        }
        const columns: FlatQueryColumns = {}
        flattenQueryColumns(queryColumns, columns, '')

        let requireComma = false
        let result = ''
        for (const property in columns) {
            if (requireComma) {
                result += ', '
            }
            const columnSql = this._appendColumnValue(columns[property]!, context, isOutermostQuery)
            result += isOutermostQuery ? this._appendResultColumnProjection(columns[property]!, columnSql, context) : columnSql
            if (property) {
                result += ' as ' + this._appendColumnAlias(property, context)
            }
            requireComma = true
        }
        if (isOutermostQuery) {
            this._setContainsMutationReturningClause(context, !!result)
        }
        if (!result) {
            return ''
        }
        return ' returning ' + result
    }
    _buildInsertSelectSource(_query: InsertData, from: SelectData, _columns: string, context: SqlBuildContext, columnsForInsert: { [name: string]: DBColumn | undefined }): string {
        return this._buildSelectWithColumnsInfo(from, context, columnsForInsert, false)
    }
    _buildInsertOnConflictBeforeInto(_query: InsertData, _context: SqlBuildContext): string {
        return ''
    }
    /*
     * Resolves the on-conflict update-set into the list of `{ column, value }`
     * pairs that will be assigned, honouring shape-renamed keys and skipping
     * properties that don't map to a real table column (the value object is
     * allowed to carry extra properties for more complex usages). Does not touch
     * `params`, so it can be called to inspect the assignment list — e.g. to
     * detect that it resolves to zero columns — before emitting any SQL.
     */
    _resolveInsertOnConflictUpdateSetColumns(query: InsertData): Array<{ property: string, column: DBColumn, value: any }> {
        const result: Array<{ property: string, column: DBColumn, value: any }> = []
        const table = query.__table
        const shape = query.__onConflictUpdateShape
        const sets = query.__onConflictUpdateSets
        if (!sets) {
            return result
        }
        if (shape) { // Follow shape order
            const properties = Object.getOwnPropertyNames(shape)
            for (let i = 0, length = properties.length; i < length; i++) {
                const property = properties[i]!
                const columnName = shape[property]!
                const column = __getColumnOfObject(table, columnName)
                if (!column) {
                    // Additional property provided in the value object
                    // Skipped because it is not part of the table
                    // This allows to have more complex objects used in the query
                    continue
                }
                if (!(property in sets)) {
                    // No value set for that property in the shape
                    continue
                }
                result.push({ property, column, value: sets[property] })
            }
        } else { // No shape, follow set order
            const properties = Object.getOwnPropertyNames(sets)
            for (let i = 0, length = properties.length; i < length; i++) {
                const property = properties[i]!
                const column = __getColumnOfObject(table, property)
                if (!column) {
                    // Additional property provided in the value object
                    // Skipped because it is not part of the table
                    // This allows to have more complex objects used in the query
                    continue
                }
                result.push({ property, column, value: sets[property] })
            }
        }
        return result
    }
    /*
     * True when an on-conflict `do update set` was requested but resolves to no
     * columns to assign — e.g. every staged value was dropped by
     * `ignoreAnySetWithNoValue()` / `doUpdateSetIfValue({ x: undefined })`, or
     * the value object carried only properties that don't map to a table column.
     * The caller degrades the clause to a conflict-ignoring no-op (`do nothing`
     * on PostgreSQL/SQLite, `insert ignore` on MariaDB/MySQL) instead of dropping
     * the whole on-conflict clause. Returns `false` when no update-set was
     * requested at all.
     */
    _isInsertOnConflictUpdateSetEmpty(query: InsertData): boolean {
        if (!query.__onConflictUpdateSets) {
            return false
        }
        return this._resolveInsertOnConflictUpdateSetColumns(query).length <= 0
    }
    /*
     * Builds the `<col> = <value>, ...` assignment list shared by the
     * `do update set` (PostgreSQL/SQLite) and `on duplicate key update`
     * (MariaDB/MySQL) clauses. Resolves shape-renamed keys back to their real
     * column when an on-conflict shape is present, so every dialect honours it.
     */
    _buildInsertOnConflictUpdateSetColumns(query: InsertData, context: SqlBuildContext): string {
        const resolved = this._resolveInsertOnConflictUpdateSetColumns(query)
        let columns = ''
        for (let i = 0, length = resolved.length; i < length; i++) {
            const { property, column, value } = resolved[i]!
            if (columns) {
                columns += ', '
            }
            columns += this._appendColumnNameForUpdate(column, context)
            columns += ' = '
            columns += this._appendSetValue(property, undefined, column, value, context)
        }
        return columns
    }
    _buildInsertOnConflictBeforeReturning(query: InsertData, context: SqlBuildContext): string {
        if (!query.__onConflictDoNothing && !query.__onConflictUpdateSets) {
            return ''
        }

        let result = ' on conflict'

        const onConflictOnColumns = query.__onConflictOnColumns
        if (onConflictOnColumns) {
            result += ' ('
            for (let i = 0, length = onConflictOnColumns.length; i < length; i++) {
                if (i > 0) {
                    result += ', '
                }
                const column = onConflictOnColumns[i]!
                result += this._appendSql(column, context, false)
            }
            result += ')'
            const where = query.__onConflictOnColumnsWhere
            if (where) {
                result += ' where '
                result += this._appendCondition(where, context)
            }
        }

        const constraint = query.__onConflictOnConstraint
        if (constraint) {
            // The conflict target is a constraint **name** — a SQL identifier, not
            // a scalar value. Binding it as a parameter (`$N`) is rejected by the
            // server (`ERROR: syntax error at or near "$N"` on PostgreSQL). We
            // emit the raw fragment verbatim; the API only accepts `RawFragment`
            // for this argument precisely because the caller has to assemble it
            // from database introspection rather than from a runtime value.
            result += ' on constraint '
            result += this._appendRawFragment(constraint, context)
        }

        if (query.__onConflictDoNothing) {
            result += ' do nothing'
        }

        const oldSafeTableOrView = context.safeTableOrView
        this._setSafeTableOrView(context, undefined)
        const columns = this._buildInsertOnConflictUpdateSetColumns(query, context)
        if (query.__onConflictUpdateSets) {
            if (!columns) {
                // The `do update set` resolved to no columns (every staged value
                // was dropped by `ignoreAnySetWithNoValue()` /
                // `doUpdateSetIfValue({ x: undefined })`). An empty assignment
                // list is a syntax error, and dropping the whole clause would
                // turn the upsert back into a plain insert that throws on
                // conflict. Degrade to the conflict-ignoring no-op, keeping the
                // requested conflict target; the update `where` is irrelevant
                // when nothing is updated, so it is omitted.
                result += ' do nothing'
            } else {
                result += ' do update set ' + columns
                const where = query.__onConflictUpdateWhere
                if (where) {
                    result += ' where '
                    result += this._appendCondition(where, context)
                }
            }
        }

        this._setSafeTableOrView(context, oldSafeTableOrView)
        return result
    }
    _nextSequenceValue( _context: SqlBuildContext, sequenceName: string, _typeClass: DataTypeClass) {
        return "nextval('" + sequenceName + "')"
    }
    _currentSequenceValue(_context: SqlBuildContext, sequenceName: string, _typeClass: DataTypeClass): string {
        return "currval('" + sequenceName + "')"
    }
    _buildUpdate(query: UpdateData, context: SqlBuildContext): string {
        this._ensureRootQuery(query, context)
        const oldSafeTableOrView = context.safeTableOrView
        const oldFakeNameOf = context.fakeNamesOf

        const table = query.__table
        const sets = query.__sets
        const customization = query.__customization

        if (query.__froms || query.__joins) {
            this._setSafeTableOrView(context, undefined)
        } else {
            this._setSafeTableOrView(context, table)
        }

        const oldValues = query.__oldValues
        const requiredTables = this._extractAdditionalRequiredTablesForUpdate(query, context)
        const requiredColumns = this._extractAdditionalRequiredColumnsForUpdate(query, requiredTables, context)
        context.fakeNamesOf = requiredTables

        let updateQuery = ''

        if (customization && customization.beforeQuery) {
            updateQuery += this._appendRawFragment(customization.beforeQuery, context) + ' '
        }
        updateQuery += this._buildWith(query, context)
        updateQuery += 'update '

        if (customization && customization.afterUpdateKeyword) {
            updateQuery += this._appendRawFragment(customization.afterUpdateKeyword, context) + ' '
        }

        const oldForceAliasFor = context.forceAliasFor
        const oldForceAliasAs = context.forceAliasAs
        if (this._useUpdateOldValueInFrom() && query.__oldValues) {
            context.forceAliasFor = query.__table
            context.forceAliasAs = this._updateNewAlias
        }
        updateQuery += this._appendTableOrViewName(table, context)
        updateQuery += this._buildAfterUpdateTable(query, context)

        const shape = query.__shape
        let columns = ''
        let updatePrimaryKey = false
        // A dialect can write the assignments in another order (MySQL and MariaDB); undefined keeps the given one
        const orderedProperties = this._updateSetPropertiesInOrder(query, context)
        if (shape) { // Follow shape order
            const properties = orderedProperties || Object.getOwnPropertyNames(shape)
            for (let i = 0, length = properties.length; i < length; i++) {
                const property = properties[i]!
                const shapePropertyValue = shape[property]!
                let column
                if (typeof shapePropertyValue === 'string') {
                    column = __getColumnOfObject(table, shapePropertyValue)
                    if (!column) {
                        throw new TsSqlProcessingError({ reason: 'MAPPED_SHAPED_COLUMN_NOT_IN_TABLE', shapeProperty: property, mappedTo: shapePropertyValue }, 'Unable to find the column "' + shapePropertyValue + '" in the table indicated in the provided shape property "' + property + '"')
                    }
                } else {
                    column = shapePropertyValue
                }
                if (!__isColumn(column)) {
                    // Additional property provided in the value object
                    // Skipped because it is not part of the table
                    // This allows to have more complex objects used in the query
                    continue
                }
                if (!(property in sets)) {
                    // No value set for that property in the shape
                    continue
                }

                const nodeColumn = __asDBColumnValueSource(column)
                updatePrimaryKey = updatePrimaryKey || nodeColumn.__isPrimaryKey

                if (columns) {
                    columns += ', '
                }
                const value = sets[property]

                columns += this._appendColumnNameForUpdate(column, context)
                columns += ' = '
                columns += this._appendSetValue(property, undefined, column, value, context)
            }
        } else { // No shape, follow set order
            const properties = orderedProperties || Object.getOwnPropertyNames(sets)
            for (let i = 0, length = properties.length; i < length; i++) {
                const property = properties[i]!
                const column =  __getColumnOfObject(table, property)
                if (!column) {
                    // Additional property provided in the value object
                    // Skipped because it is not part of the table
                    // This allows to have more complex objects used in the query
                    continue
                }
    
                const nodeColumn = __asDBColumnValueSource(column)
                updatePrimaryKey = updatePrimaryKey || nodeColumn.__isPrimaryKey
    
                if (columns) {
                    columns += ', '
                }
                const value = sets[property]
    
                columns += this._appendColumnNameForUpdate(column, context)
                columns += ' = '
                columns += this._appendSetValue(property, undefined, column, value, context)
            }
        }
        if (context.updateOldRowColumns) {
            // Only the values of the set read the row before the update
            context.updateOldRowColumns = undefined
        }
        updateQuery += ' set ' + columns

        updateQuery += this._buildUpdateOutput(query, context)
        updateQuery += this._buildUpdateFrom(query, updatePrimaryKey, requiredTables, requiredColumns, context)

        if (oldValues && this._useUpdateOldValueInFrom()) {
            let where: ValueSource<any, BooleanType, any> | undefined
            for (const property of __columnPathsOf(table)) {
                const column = __getColumnOfObject(table, property)
                if (!column) {
                    continue
                }
                const nodeColumn = __asDBColumnValueSource(column)
                if (!nodeColumn.__isPrimaryKey) {
                    continue
                }
                const oldCoumn = __getValueSourceOfObject(oldValues, property)
                if (!oldCoumn) {
                    throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'incomplete old value query' }, 'The column ' + property + ' is missing from the old values table')
                }
                const condition = (column as any as ValueSource<any, EqualableType<any, any>, any>).equals(oldCoumn)
                if (where) {
                    where = where.and(condition)
                } else {
                    where = condition
                }
            }
            if (!where) {
                throw new TsSqlProcessingError({ reason: 'NO_PRIMARY_KEY_FOUND' }, 'No primary key found')
            }

            const oldForceAliasFor = context.forceAliasFor
            const oldForceAliasAs = context.forceAliasAs

            context.forceAliasFor = table
            context.forceAliasAs = this._updateNewAlias
            const whereCondition = this._appendCondition(where, context)
            if (whereCondition) {
                updateQuery += ' where ' + whereCondition
            } else if (!query.__allowNoWhere) {
                throw new TsSqlProcessingError({ reason: 'MISSING_WHERE' }, 'No where generated for link with the update old values')
            }
            context.forceAliasFor = oldForceAliasFor
            context.forceAliasAs = oldForceAliasAs
        } else if (query.__where) {
            const whereCondition = this._appendCondition(query.__where, context)
            if (whereCondition) {
                updateQuery += ' where ' + whereCondition
            } else if (!query.__allowNoWhere) {
                throw new TsSqlProcessingError({ reason: 'MISSING_WHERE' }, 'No where defined for the update operation')
            }
        } else if (!query.__allowNoWhere) {
            throw new TsSqlProcessingError({ reason: 'MISSING_WHERE' }, 'No where defined for the update operation')
        }

        updateQuery += this._buildUpdateReturning(query, context)

        if (customization && customization.afterQuery) {
            updateQuery += ' ' + this._appendRawFragment(customization.afterQuery, context)
        }

        context.forceAliasFor = oldForceAliasFor
        context.forceAliasAs = oldForceAliasAs
        this._setSafeTableOrView(context, oldSafeTableOrView)
        context.fakeNamesOf = oldFakeNameOf
        this._resetRootQuery(query, context)
        return updateQuery
    }
    /**
     * The properties of the set (or of the shape) of an update in the order they are written, or undefined to write them
     * in the order given. Every database but MySQL and MariaDB computes all of them with the row as it was before the
     * update, so the order doesn't matter
     */
    _updateSetPropertiesInOrder(_query: UpdateData, _context: SqlBuildContext): string[] | undefined {
        return undefined
    }
    _extractAdditionalRequiredTablesForUpdate(query: UpdateData, _context: SqlBuildContext): Set<AnyTableOrView> | undefined {
        if (!this._useUpdateOldValueInFrom() || !query.__oldValues) {
            return undefined
        }
        const froms = query.__froms
        const joins = query.__joins
        if ((!froms || froms.length <= 0) && (!joins || joins.length <= 0)) {
            return undefined
        }

        const result = new Set<AnyTableOrView>()

        const sets = query.__sets
        for (let property in sets) {
            __registerTableOrView(sets[property], this, result)
        }

        const columns = query.__columns
        if (columns) {
            // Flatten first so a table referenced only through a nested
            // projection sub-object is still discovered (see the matching
            // flatten in `_extractAdditionalRequiredColumnsForUpdate`).
            const flatColumns: FlatQueryColumns = {}
            flattenQueryColumns(columns, flatColumns, '')
            for (let property in flatColumns) {
                __registerTableOrView(flatColumns[property], this, result)
            }
        }

        result.delete(query.__table)
        result.delete(query.__oldValues)
        if (result.size <= 0) {
            return undefined
        }
        return result
    }
    _extractAdditionalRequiredColumnsForUpdate(query: UpdateData, requiredTables: Set<AnyTableOrView> | undefined, _context: SqlBuildContext): Set<DBColumn> | undefined {
        if (!requiredTables) {
            return undefined
        }

        const result = new Set<DBColumn>()

        const sets = query.__sets
        for (let property in sets) {
            __registerRequiredColumn(sets[property], this, result, requiredTables)
        }

        const columns = query.__columns
        if (columns) {
            // Flatten first: a joined-in column folded into a nested projection
            // sub-object must still be pre-projected into the synthetic `_old_`
            // subquery, mirroring how `_buildQueryReturning` flattens the same
            // columns before emitting the RETURNING clause.
            const flatColumns: FlatQueryColumns = {}
            flattenQueryColumns(columns, flatColumns, '')
            for (let property in flatColumns) {
                __registerRequiredColumn(flatColumns[property], this, result, requiredTables)
            }
        }

        if (result.size <= 0) {
            return undefined
        }
        return result
    }
    _updateNewAlias = '_new_'
    _useUpdateOldValueInFrom(): boolean {
        return true
    }
    _appendColumnNameForUpdate(column: DBColumn, _context: SqlBuildContext) {
        const nodeColumn = __asDBColumnValueSource(column)
        return this._escape(nodeColumn.__name, true)
    }
    _appendUpdateOldValueForUpdate(query: UpdateData, updatePrimaryKey: boolean, _requiredTables: Set<AnyTableOrView> | undefined, _context: SqlBuildContext) {
        const oldValues = query.__oldValues
        if (!oldValues) {
            return ''
        }
        const oldValuesRoot = __asTableOrViewRoot(oldValues)
        if (!oldValuesRoot.__as) {
            throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'incomplete old value query' }, 'No alias found for the old values to define the locking strategy')
        }
        let result
        if (updatePrimaryKey) {
            result = ' for update of ' + this._escape(oldValuesRoot.__as, true)
        } else {
            result = ' for no key update of ' + this._escape(oldValuesRoot.__as, true)
        }
        return result
    }
    _buildAfterUpdateTable(_query: UpdateData, _context: SqlBuildContext): string {
        return ''
    }
    _buildUpdateFrom(query: UpdateData, updatePrimaryKey: boolean, requiredTables: Set<AnyTableOrView> | undefined, requiredColumns: Set<DBColumn> | undefined, context: SqlBuildContext): string {
        if (!this._useUpdateOldValueInFrom()) {
            const from = this._buildFromJoins(query.__froms, query.__joins, undefined, context)
            if (from) {
                return ' from ' + from
            }
            return ''
        }
        const oldValues = query.__oldValues
        if (!oldValues) {
            const from = this._buildFromJoins(query.__froms, query.__joins, undefined, context)
            if (from) {
                return ' from ' + from
            }
            return ''
        }

        let from = ' from '

        const oldValuesRoot = __asTableOrViewRoot(oldValues)
        if (!oldValuesRoot.__as) {
            throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'incomplete old value query' }, 'No alias found for the old values')
        }

        const oldForceAliasFor = context.forceAliasFor
        const oldForceAliasAs = context.forceAliasAs
        const oldFakeNameOf = context.fakeNamesOf
        context.fakeNamesOf = undefined

        context.forceAliasFor = query.__table
        context.forceAliasAs = oldValuesRoot.__as

        from += '(select ' + this._escape(oldValuesRoot.__as, true) + '.*'

        if (requiredColumns) {
            const additionalColumns = Array.from(requiredColumns).sort((c1, c2) => {
                const c1Private = __asDBColumnValueSource(c1)
                const c2Private = __asDBColumnValueSource(c2)
                const t1 = c1Private.__tableOrView
                const t2 = c2Private.__tableOrView
                const t1Private = __asTableOrViewRoot(t1)
                const t1Name = t1Private.__as || this._tableOrViewName(t1Private, context)
                const t2Private = __asTableOrViewRoot(t2)
                const t2Name = t2Private.__as || this._tableOrViewName(t2Private, context)

                if (t1Name > t2Name) {
                    return 1;
                }
                if (t1Name < t2Name) {
                    return -1;
                }
                if (c1Private.__name > c2Private.__name) {
                    return 1;
                }
                if (c1Private.__name < c2Private.__name) {
                    return -1;
                }
                return 0;
            })

            for (let i = 0, length = additionalColumns.length; i < length; i++) {
                const column = additionalColumns[i]!
                from += ', '
                from += this._appendSql(column, context, false)
                from += ' as '

                const nodeColumn = __asDBColumnValueSource(column)
                const tableRoot = __asTableOrViewRoot(nodeColumn.__tableOrView)
                if (tableRoot.__as) {
                    from += this._escape(this._identifierWithoutQuotes(tableRoot.__as + '__' + nodeColumn.__name), true)
                } else {
                    from += this._escape(this._identifierWithoutQuotes(this._tableOrViewName(tableRoot, context) + '__' + nodeColumn.__name), true)
                }
            }
        }

        from += ' from '
        from += this._appendTableOrViewName(oldValues, context)

        const innerFrom = this._buildFromJoins(query.__froms, query.__joins, undefined, context)
        if (innerFrom) {
            from = from + ', ' + innerFrom
        }

        if (query.__where) {
            const whereCondition = this._appendCondition(query.__where, context)
            if (whereCondition) {
                from += ' where ' + whereCondition
            } else if (!query.__allowNoWhere) {
                throw new TsSqlProcessingError({ reason: 'MISSING_WHERE' }, 'No where defined for the update operation')
            }
        } else if (!query.__allowNoWhere) {
            throw new TsSqlProcessingError({ reason: 'MISSING_WHERE' }, 'No where defined for the update operation')
        }

        from += this._appendUpdateOldValueForUpdate(query, updatePrimaryKey, requiredTables, context)
        from += ')'

        if (this._supportTableAliasWithAs) {
            from += ' as '
        } else {
            from += ' '
        }

        from += this._escape(oldValuesRoot.__as, true)

        context.forceAliasFor = oldForceAliasFor
        context.forceAliasAs = oldForceAliasAs
        context.fakeNamesOf = oldFakeNameOf
        return from
    }
    _buildUpdateOutput(_query: UpdateData, _context: SqlBuildContext): string {
        return ''
    }
    _buildUpdateReturning(query: UpdateData, context: SqlBuildContext): string {
        const isOutermostQuery = this._isCurrentRootQuery(query, context)
        return this._buildQueryReturning(query.__columns, context, isOutermostQuery)
    }
    _buildDelete(query: DeleteData, context: SqlBuildContext): string {
        this._ensureRootQuery(query, context)
        const oldFakeNameOf = context.fakeNamesOf
        context.fakeNamesOf = undefined
        const oldSafeTableOrView = context.safeTableOrView

        const table = query.__table
        const customization = query.__customization

        if (query.__using || query.__joins) {
            this._setSafeTableOrView(context, undefined)
        } else {
            this._setSafeTableOrView(context, table)
        }

        let deleteQuery = ''
        if (customization && customization.beforeQuery) {
            deleteQuery += this._appendRawFragment(customization.beforeQuery, context) + ' '
        }

        deleteQuery += this._buildWith(query, context)
        deleteQuery += 'delete '

        if (customization && customization.afterDeleteKeyword) {
            deleteQuery += this._appendRawFragment(customization.afterDeleteKeyword, context) + ' '
        }

        deleteQuery += 'from '
        deleteQuery += this._appendTableOrViewName(table, context)

        deleteQuery += this._buildDeleteOutput(query, context)
        deleteQuery += this._buidDeleteUsing(query, context)

        if (query.__where) {
            const whereCondition = this._appendCondition(query.__where, context)
            if (whereCondition) {
                deleteQuery += ' where ' + whereCondition
            } else if (!query.__allowNoWhere) {
                throw new TsSqlProcessingError({ reason: 'MISSING_WHERE' }, 'No where defined for the delete operation')
            }
        } else if (!query.__allowNoWhere) {
            throw new TsSqlProcessingError({ reason: 'MISSING_WHERE' }, 'No where defined for the delete operation')
        }

        deleteQuery += this._buildDeleteReturning(query, context)

        if (customization && customization.afterQuery) {
            deleteQuery += ' ' + this._appendRawFragment(customization.afterQuery, context)
        }

        this._setSafeTableOrView(context, oldSafeTableOrView)
        context.fakeNamesOf = oldFakeNameOf
        this._resetRootQuery(query, context)
        return deleteQuery
    }
    _buidDeleteUsing(query: DeleteData, context: SqlBuildContext): string {
        const result = this._buildFromJoins(query.__using, query.__joins, undefined, context)
        if (result) {
            return ' using ' + result
        }
        return ''
    }
    _buildDeleteOutput(_query: DeleteData, _context: SqlBuildContext): string {
        return ''
    }
    _buildDeleteReturning(query: DeleteData, context: SqlBuildContext): string {
        const isOutermostQuery = this._isCurrentRootQuery(query, context)
        return this._buildQueryReturning(query.__columns, context, isOutermostQuery)
    }

    /*
     * Comparators
     */
    // SqlComparator0
    _isNull(context: SqlBuildContext, valueSource: ToSql): string {
        if (this._isValueKnownWhenTheQueryIsBuilt(valueSource)) {
            return this._isNullValue(valueSource) ? this._trueValueForCondition : this._falseValueForCondition
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' is null'
    }
    _isNotNull(context: SqlBuildContext, valueSource: ToSql): string {
        if (this._isValueKnownWhenTheQueryIsBuilt(valueSource)) {
            return this._isNullValue(valueSource) ? this._falseValueForCondition : this._trueValueForCondition
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' is not null'
    }
    /**
     * Whether the value carries its own value already — a constant — instead of one the database
     * resolves. A missing value is still a value we hold, so `null`/`undefined` answer true;
     * `_isNullValue` is what tells the two apart afterwards.
     *
     * Together they settle a null test while the query is built: asking the database whether a
     * value we are already holding is NULL cannot answer anything else.
     */
    _isValueKnownWhenTheQueryIsBuilt(value: any): boolean {
        if (value === null || value === undefined) {
            return true
        }
        return isValueSource(value) && __asNodeValueSource(value).isConstValue()
    }
    _isNullValue(value: any): boolean {
        if (!this._isValueKnownWhenTheQueryIsBuilt(value)) {
            return false
        }
        if (value === null || value === undefined) {
            return true
        }
        const valueSourceValue = __asNodeValueSource(value).getConstValue()
        return valueSourceValue === null || valueSourceValue === undefined
    }
    /**
     * Whether the database is the one deciding if this value is NULL. A constant carries its
     * value already, so its null state is settled while the query is built and no runtime check
     * over it can ever change: only a value the database resolves needs one emitted.
     *
     * Narrower than `_isOptionalValue`, which answers the DECLARED optionality — the one that
     * governs the result type — and so still reports a constant holding a value as optional.
     */
    _canBeNullWhenTheQueryRuns(value: any): boolean {
        if (this._isValueKnownWhenTheQueryIsBuilt(value)) {
            return this._isNullValue(value)
        }
        return this._isOptionalValue(value)
    }
    _isOptionalValue(value: any): boolean {
        if (this._isNullValue(value)) {
            return true
        }
        if (!isValueSource(value)) {
            return false
        }
        return __asNodeValueSource(value).__optionalType !== 'required'
    }
    _hasSameBooleanTypeAdapter(valueSource: DBColumn, value: DBColumn): valueSource is DBColumn  {
        if (__isColumn(valueSource) && __isColumn(value)) {
            const nodeValueSource = __asDBColumnValueSource(valueSource)
            const nodeValue = __asDBColumnValueSource(value)
            if (__isBooleanValueSource(nodeValueSource) && __isBooleanValueSource(nodeValue)) {
                const valueSourceTypeAdapter = nodeValueSource.__typeAdapter
                const valueTypeAdapter = nodeValue.__typeAdapter
                if (valueSourceTypeAdapter instanceof CustomBooleanTypeAdapter && valueTypeAdapter instanceof CustomBooleanTypeAdapter) {
                    return valueSourceTypeAdapter.trueValue === valueTypeAdapter.trueValue && valueSourceTypeAdapter.falseValue === valueTypeAdapter.falseValue
                }
            }
        }
        return false
    }
    // SqlComparator1
    _equals(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._isZonedTextComparison(typeClass)) {
            return this._equals(context, new ZonedTextInstantOperand(valueSource), __zonedTextInstantValue(value), __registeredDataType('instant'))
        }
        if (__isColumn(valueSource) && __isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, context) + ' = ' + this._appendRawColumnName(value, context)
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' = ' + this._appendValueParenthesis(value, context, __valueOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value))
    }
    _notEquals(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._isZonedTextComparison(typeClass)) {
            return this._notEquals(context, new ZonedTextInstantOperand(valueSource), __zonedTextInstantValue(value), __registeredDataType('instant'))
        }
        if (__isColumn(valueSource) && __isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, context) + ' <> ' + this._appendRawColumnName(value, context)
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' <> ' + this._appendValueParenthesis(value, context, __valueOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value))
    }
    _is(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._isZonedTextComparison(typeClass)) {
            return this._is(context, new ZonedTextInstantOperand(valueSource), __zonedTextInstantValue(value), __registeredDataType('instant'))
        }
        if (__isColumn(valueSource) && __isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, context) + ' is not distinct from ' + this._appendRawColumnName(value, context)
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' is not distinct from ' + this._appendValueParenthesis(value, context, __valueOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value))
    }
    _isNot(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._isZonedTextComparison(typeClass)) {
            return this._isNot(context, new ZonedTextInstantOperand(valueSource), __zonedTextInstantValue(value), __registeredDataType('instant'))
        }
        if (__isColumn(valueSource) && __isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, context) + ' is distinct from ' + this._appendRawColumnName(value, context)
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' is distinct from ' + this._appendValueParenthesis(value, context, __valueOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value))
    }
    _equalsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' = ' + this._appendValueParenthesis(value, context, typeClass, false) + ' collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' = ' + this._appendValueParenthesis(value, context, typeClass, false)
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') = lower(' + this._appendValue(value, context, typeClass, false) + ')'
        }
    }
    _notEqualsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' <> ' + this._appendValueParenthesis(value, context, typeClass, false) + ' collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' <> ' + this._appendValueParenthesis(value, context, typeClass, false)
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') <> lower(' + this._appendValue(value, context, typeClass, false) + ')'
        }
    }
    _lessThan(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._isZonedTextComparison(typeClass)) {
            return this._lessThan(context, new ZonedTextInstantOperand(valueSource), __zonedTextInstantValue(value), __registeredDataType('instant'))
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' < ' + this._appendValueParenthesis(value, context, __valueOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value))
    }
    _greaterThan(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._isZonedTextComparison(typeClass)) {
            return this._greaterThan(context, new ZonedTextInstantOperand(valueSource), __zonedTextInstantValue(value), __registeredDataType('instant'))
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' > ' + this._appendValueParenthesis(value, context, __valueOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value))
    }
    _lessOrEqual(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._isZonedTextComparison(typeClass)) {
            return this._lessOrEqual(context, new ZonedTextInstantOperand(valueSource), __zonedTextInstantValue(value), __registeredDataType('instant'))
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' <= ' + this._appendValueParenthesis(value, context, __valueOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value))
    }
    _greaterOrEqual(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._isZonedTextComparison(typeClass)) {
            return this._greaterOrEqual(context, new ZonedTextInstantOperand(valueSource), __zonedTextInstantValue(value), __registeredDataType('instant'))
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' >= ' + this._appendValueParenthesis(value, context, __valueOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value))
    }
    _in(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._isZonedTextComparison(typeClass)) {
            return this._in(context, new ZonedTextInstantOperand(valueSource), __zonedTextInstantValue(value), __registeredDataType('instant'))
        }
        // An empty array can never match, so short-circuit to the false constant.
        // `<x> in ()` is invalid SQL on every engine, so the guard lives here in the
        // base (not duplicated per dialect) — a dialect that does not override this
        // method still emits valid SQL for the empty-array case.
        if (Array.isArray(value) && value.length <= 0) {
            return this._falseValueForCondition
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' in ' + this._appendSpreadValue(value, context, __valueOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value))
    }
    _notIn(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._isZonedTextComparison(typeClass)) {
            return this._notIn(context, new ZonedTextInstantOperand(valueSource), __zonedTextInstantValue(value), __registeredDataType('instant'))
        }
        // An empty array excludes nothing, so short-circuit to the true constant
        // (`<x> not in ()` is likewise invalid SQL everywhere). See `_in` above.
        if (Array.isArray(value) && value.length <= 0) {
            return this._trueValueForCondition
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' not in ' + this._appendSpreadValue(value, context, __valueOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value))
    }
    // Escape clause appended to the LIKE expressions built by the comparison predicates
    // below (`_like` … `_notContainsInsensitive`). `_escapeLikeWildcard` escapes the
    // `%` / `_` / `\` wildcards of the affix predicates using `\` as the escape
    // character, so the engine must be told `\` is the escape: a dialect whose LIKE
    // already treats `\` as its default escape (PostgreSQL, MySQL, MariaDB) leaves this
    // empty, while a dialect that must declare it explicitly (SQLite, Oracle) sets it to
    // " escape '\\'". Dialects that build a different LIKE shape (SQL Server) override
    // the individual predicates instead of relying on this hook.
    _likeEscape = ''
    // How the insensitive LIKE predicates below write the name of the collation. A dialect that must quote it overrides this.
    _collationName(collation: string): string {
        return collation
    }
    _like(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._appendValue(value, context, typeClass, false) + this._likeEscape
    }
    _notLike(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._appendValue(value, context, typeClass, false) + this._likeEscape
    }
    _likeInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._appendValueParenthesis(value, context, typeClass, false) + ' collate ' + this._collationName(collation) + this._likeEscape
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._appendValueParenthesis(value, context, typeClass, false) + this._likeEscape
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') like lower(' + this._appendValue(value, context, typeClass, false) + ')' + this._likeEscape
        }
    }
    _notLikeInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._appendValueParenthesis(value, context, typeClass, false) + ' collate ' + this._collationName(collation) + this._likeEscape
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._appendValueParenthesis(value, context, typeClass, false) + this._likeEscape
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') not like lower(' + this._appendValue(value, context, typeClass, false) + ')' + this._likeEscape
        }
    }
    /**
     * Glue two already-built SQL fragments into a single string value. Only `_concat`
     * reaches this — the affix patterns have their own methods below, which build each
     * shape in one expression rather than composing calls, because they sit on the
     * emission path of every predicate.
     *
     * Kept as a seam because `||` is not the only way a dialect can be asked to
     * concatenate: Oracle reads NULL as the empty string there, so a connection that
     * cannot live with that installs the functions of the library (`libraryFunctions`) and
     * every concatenation the builder emits goes through it instead. `_concat` and the
     * affix patterns must move together: an affix predicate that propagates NULL while
     * `concat` does not would be its own inconsistency.
     */
    _concatSql(left: string, right: string): string {
        return left + ' || ' + right
    }
    /**
     * The LIKE pattern of the affix predicates: the escaped term with `%` glued to the
     * end, the start, or both. `fold` is the no-collation arm of the insensitive
     * predicates, where the pattern is case-folded and `lower(...)`'s own parenthesis is
     * the only one needed.
     *
     * The method escapes the term itself (rather than receiving it pre-escaped) so a
     * dialect can escape it MORE than once: Oracle's `||` reads NULL as the empty string,
     * so to propagate a NULL term it emits `case when <term> is null then null else <term>
     * || '%' end`, which needs the escaped term twice — and each appearance must be its own
     * emission (a fresh `_escapeLikeWildcard`, hence its own bound parameter), because the
     * library never reuses a placeholder. One method per shape, each a single concatenation:
     * a dialect overrides the three it needs (its concatenation operator, or Oracle's
     * null-handling forms) and pays nothing per call for the generality.
     */
    _likePatternStartingWith(context: SqlBuildContext, value: any, typeClass: DataTypeClass, fold: boolean): string {
        const term = this._escapeLikeWildcard(value, context, typeClass, false)
        return fold ? 'lower(' + term + " || '%')" : '(' + term + " || '%')"
    }
    _likePatternEndingWith(context: SqlBuildContext, value: any, typeClass: DataTypeClass, fold: boolean): string {
        const term = this._escapeLikeWildcard(value, context, typeClass, false)
        return fold ? "lower('%' || " + term + ')' : "('%' || " + term + ')'
    }
    _likePatternContaining(context: SqlBuildContext, value: any, typeClass: DataTypeClass, fold: boolean): string {
        const term = this._escapeLikeWildcard(value, context, typeClass, false)
        return fold ? "lower('%' || " + term + " || '%')" : "('%' || " + term + " || '%')"
    }
    _startsWith(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._likePatternStartingWith(context, value, typeClass, false) + this._likeEscape
    }
    _notStartsWith(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._likePatternStartingWith(context, value, typeClass, false) + this._likeEscape
    }
    _endsWith(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._likePatternEndingWith(context, value, typeClass, false) + this._likeEscape
    }
    _notEndsWith(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._likePatternEndingWith(context, value, typeClass, false) + this._likeEscape
    }
    _startsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._likePatternStartingWith(context, value, typeClass, false) + ' collate ' + this._collationName(collation) + this._likeEscape
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._likePatternStartingWith(context, value, typeClass, false) + this._likeEscape
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') like ' + this._likePatternStartingWith(context, value, typeClass, true) + this._likeEscape
        }
    }
    _notStartsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._likePatternStartingWith(context, value, typeClass, false) + ' collate ' + this._collationName(collation) + this._likeEscape
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._likePatternStartingWith(context, value, typeClass, false) + this._likeEscape
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') not like ' + this._likePatternStartingWith(context, value, typeClass, true) + this._likeEscape
        }
    }
    _endsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._likePatternEndingWith(context, value, typeClass, false) + ' collate ' + this._collationName(collation) + this._likeEscape
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._likePatternEndingWith(context, value, typeClass, false) + this._likeEscape
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') like ' + this._likePatternEndingWith(context, value, typeClass, true) + this._likeEscape
        }
    }
    _notEndsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._likePatternEndingWith(context, value, typeClass, false) + ' collate ' + this._collationName(collation) + this._likeEscape
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._likePatternEndingWith(context, value, typeClass, false) + this._likeEscape
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') not like ' + this._likePatternEndingWith(context, value, typeClass, true) + this._likeEscape
        }
    }
    _contains(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._likePatternContaining(context, value, typeClass, false) + this._likeEscape
    }
    _notContains(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._likePatternContaining(context, value, typeClass, false) + this._likeEscape
    }
    _containsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._likePatternContaining(context, value, typeClass, false) + ' collate ' + this._collationName(collation) + this._likeEscape
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._likePatternContaining(context, value, typeClass, false) + this._likeEscape
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') like ' + this._likePatternContaining(context, value, typeClass, true) + this._likeEscape
        }
    }
    _notContainsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._likePatternContaining(context, value, typeClass, false) + ' collate ' + this._collationName(collation) + this._likeEscape
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._likePatternContaining(context, value, typeClass, false) + this._likeEscape
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') not like ' + this._likePatternContaining(context, value, typeClass, true) + this._likeEscape
        }
    }
    // SqlComparator2
    _between(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, typeClass: DataTypeClass): string {
        if (this._isZonedTextComparison(typeClass)) {
            return this._between(context, new ZonedTextInstantOperand(valueSource), __zonedTextInstantValue(value), __zonedTextInstantValue(value2), __registeredDataType('instant'))
        }
        // Both bounds are compared against the SAME receiver, so they are widened together: one
        // fractional bound decides the data type of the pair.
        const bounds = [value, value2]
        const boundClass = __valueOperandClassOf(typeClass, bounds)
        const boundNeedsTypeCast = this._operandClassNeedsTypeCast(typeClass, boundClass)
        return this._appendSqlParenthesis(valueSource, context, false) + ' between ' + this._appendValueParenthesis(value, context, boundClass, boundNeedsTypeCast) + ' and ' + this._appendValueParenthesis(value2, context, boundClass, boundNeedsTypeCast)
    }
    _notBetween(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, typeClass: DataTypeClass): string {
        if (this._isZonedTextComparison(typeClass)) {
            return this._notBetween(context, new ZonedTextInstantOperand(valueSource), __zonedTextInstantValue(value), __zonedTextInstantValue(value2), __registeredDataType('instant'))
        }
        // Both bounds are compared against the SAME receiver, so they are widened together: one
        // fractional bound decides the data type of the pair.
        const bounds = [value, value2]
        const boundClass = __valueOperandClassOf(typeClass, bounds)
        const boundNeedsTypeCast = this._operandClassNeedsTypeCast(typeClass, boundClass)
        return this._appendSqlParenthesis(valueSource, context, false) + ' not between ' + this._appendValueParenthesis(value, context, boundClass, boundNeedsTypeCast) + ' and ' + this._appendValueParenthesis(value2, context, boundClass, boundNeedsTypeCast)
    }
    // SqlOperationStatic0
    _pi(_context: SqlBuildContext): string {
        return 'pi()'
    }
    _random(_context: SqlBuildContext): string {
        return 'random()'
    }
    _currentDate(_context: SqlBuildContext): string {
        return 'current_date'
    }
    _currentTime(_context: SqlBuildContext): string {
        return 'current_time'
    }
    _currentTimestamp(_context: SqlBuildContext): string {
        return 'current_timestamp'
    }
    /** The date and time of now in the zone of the database, without zone: the current date and time */
    _currentPlainDateTime(context: SqlBuildContext): string {
        return this._currentTimestamp(context)
    }
    /** The instant of now, with all the digits of the fraction of a second the database gives: the current date and time */
    _currentInstant(context: SqlBuildContext): string {
        return this._currentTimestamp(context)
    }
    _default(_context: SqlBuildContext): string {
        return 'default'
    }
    _trueValue = 'true'
    _true(_context: SqlBuildContext): string {
        return this._trueValue
    }
    _trueValueForCondition = 'true'
    _trueForCondition(_context: SqlBuildContext): string {
        return this._trueValueForCondition
    }
    _falseValue = 'false'
    _false(_context: SqlBuildContext): string {
        return this._falseValue
    }
    _falseValueForCondition = 'false'
    _falseForCondition(_context: SqlBuildContext): string {
        return this._falseValueForCondition
    }
    // SqlOperationStatic01
    _const(context: SqlBuildContext, value: any, typeClass: DataTypeClass, forceTypeCast: boolean): string {
        return this._appendValue(value, context, typeClass, forceTypeCast)
    }
    _constForCondition(context: SqlBuildContext, value: any, typeClass: DataTypeClass, forceTypeCast: boolean): string {
        return this._appendConditionValue(value, context, typeClass, forceTypeCast)
    }
    _exists(context: SqlBuildContext, value: any, typeClass: DataTypeClass, forceTypeCast: boolean): string {
        return 'exists(' + this._appendValue(value, context, typeClass, forceTypeCast) + ')'
    }
    _notExists(context: SqlBuildContext, value: any, typeClass: DataTypeClass, forceTypeCast: boolean): string {
        return 'not exists(' + this._appendValue(value, context, typeClass, forceTypeCast) + ')'
    }
    // INTERNAL to the builders, deliberately NOT on the `SqlBuilder` interface: it is only ever reached as
    // `this._escapeLikeWildcard(...)` from the `like`/`startsWith`/`contains` emitters, and dialects override it. Its
    // argument order (`value` first) differs from every interface-dispatched op, so exposing it would let a value
    // source be built over it and emit its arguments in the wrong order.
    _escapeLikeWildcard(value: any, context: SqlBuildContext, typeClass: DataTypeClass, forceTypeCast: boolean): string {
        if (typeof value === 'string') {
            value = value.replace(/\\/g, '\\\\')
            value = value.replace(/%/g, '\\%')
            value = value.replace(/_/g, '\\_')
            return this._appendValue(value, context, typeClass, forceTypeCast)
        } else {
            return "replace(replace(replace(" + this._appendValue(value, context, typeClass, forceTypeCast) + ", '\\', '\\\\'), '%', '\\%'), '_', '\\_')"
        }
    }
    // SqlFunction0
    _negate(context: SqlBuildContext, valueSource: ToSql): string {
        const sql = this._appendConditionSql(valueSource, context, false)
        if (!sql) {
            return sql
        }
        if (sql === this._trueValueForCondition) {
            return this._falseValueForCondition
        } else if (sql === this._falseValueForCondition) {
            return this._trueValueForCondition
        }

        if (this._needParenthesis(valueSource)) {
            return 'not (' + sql + ')'
        }
        return 'not ' + sql
    }
    _collate(context: SqlBuildContext, valueSource: ToSql, collation: string): string {
        // `<expr> collate <name>`. The receiver is parenthesised only when it needs it
        // (`_appendSqlParenthesis`), and the whole `collate` expression is wrapped when it is
        // embedded as an operand via `_operationsThatNeedParenthesis._collate` — no hard-coded
        // parenthesis. Uniform across dialects except PostgreSQL, which quotes the collation
        // name (see `PostgreSqlSqlBuilder._collate`).
        return this._appendSqlParenthesis(valueSource, context, false) + ' collate ' + collation
    }
    _toLowerCase(context: SqlBuildContext, valueSource: ToSql): string {
        return 'lower(' + this._appendSql(valueSource, context, false) + ')'
    }
    _toUpperCase(context: SqlBuildContext, valueSource: ToSql): string {
        return 'upper(' + this._appendSql(valueSource, context, false) + ')'
    }
    _length(context: SqlBuildContext, valueSource: ToSql): string {
        return 'length(' + this._appendSql(valueSource, context, false) + ')'
    }
    _trim(context: SqlBuildContext, valueSource: ToSql): string {
        return 'trim(' + this._appendSql(valueSource, context, false) + ')'
    }
    _trimLeft(context: SqlBuildContext, valueSource: ToSql): string {
        return 'ltrim(' + this._appendSql(valueSource, context, false) + ')'
    }
    _trimRight(context: SqlBuildContext, valueSource: ToSql): string {
        return 'rtrim(' + this._appendSql(valueSource, context, false) + ')'
    }
    _reverse(context: SqlBuildContext, valueSource: ToSql): string {
        return 'reverse(' + this._appendSql(valueSource, context, false) + ')'
    }
    /**
     * The numeric kind of the SQL an operand emits:
     *
     * - `approximate`: a floating point expression.
     * - `exact`: an integer or fixed point expression. Engines divide two exact operands
     *   exactly — or as an integer division, dropping the fractional part entirely.
     * - `unknown`: the declared type doesn't say. A `RealsType` of the user is declared by the
     *   application and may be backed by either (a DECIMAL money column, say), and anything
     *   that is not a value source is a bound value or a raw fragment.
     *
     * Engines apply different rules to each — division, rounding tie-breaks — so a dialect
     * telling them apart asks here instead of guessing from the emitted string. **When the
     * kind is `unknown` the caller must take the safe branch**, which is always to cast.
     */
    _numericKindOf(operand: any): 'approximate' | 'exact' | 'unknown' {
        if (!isValueSource(operand)) {
            return 'unknown'
        }
        switch (__sqlFamilyOf(__classOf(__asNodeValueSource(operand)))) {
            case 'approximate numeric':
                return 'approximate'
            case 'exact numeric':
                return 'exact'
            default:
                return 'unknown'
        }
    }
    _appendCastAsDouble(sql: string): string {
        return 'cast(' + sql + ' as real)'
    }
    _appendCastAsInteger(sql: string): string {
        return 'cast(' + sql + ' as integer)'
    }
    _asDouble(context: SqlBuildContext, valueSource: ToSql): string {
        return this._appendCastAsDouble(this._appendSqlParenthesis(valueSource, context, false))
    }
    _asInt(context: SqlBuildContext, valueSource: ToSql): string {
        // The value is rounded first (the declared type is an integer one) and then cast,
        // so the emitted SQL type matches the type declared to the user. Without the cast
        // the expression stays a floating point one, and any later integer arithmetic is
        // computed in floating point, silently losing precision beyond 2^53.
        return this._appendCastAsInteger(this._round(context, valueSource))
    }
    _asBigint(context: SqlBuildContext, valueSource: ToSql): string {
        return this._appendCastAsInteger(this._round(context, valueSource))
    }
    _abs(context: SqlBuildContext, valueSource: ToSql): string {
        return 'abs(' + this._appendSql(valueSource, context, false) + ')'
    }
    _ceil(context: SqlBuildContext, valueSource: ToSql): string {
        return 'ceil(' + this._appendSql(valueSource, context, false) + ')'
    }
    _floor(context: SqlBuildContext, valueSource: ToSql): string {
        return 'floor(' + this._appendSql(valueSource, context, false) + ')'
    }
    _round(context: SqlBuildContext, valueSource: ToSql): string {
        return 'round(' + this._appendSql(valueSource, context, false) + ')'
    }
    _exp(context: SqlBuildContext, valueSource: ToSql): string {
        return 'exp(' + this._appendSql(valueSource, context, false) + ')'
    }
    _ln(context: SqlBuildContext, valueSource: ToSql): string {
        return 'ln(' + this._appendSql(valueSource, context, false) + ')'
    }
    _log10(context: SqlBuildContext, valueSource: ToSql): string {
        return 'log(' + this._appendSql(valueSource, context, false) + ')'
    }
    _sqrt(context: SqlBuildContext, valueSource: ToSql): string {
        return 'sqrt(' + this._appendSql(valueSource, context, false) + ')'
    }
    _cbrt(context: SqlBuildContext, valueSource: ToSql): string {
        // No portable native CBRT exists across engines, and `power(x, 1/3)` returns NaN
        // (or an error) for negative x on every engine except PostgreSQL. Emulate the cube
        // root as `sign(x) * power(abs(x), 1/3)` so it works for the full real domain.
        //
        // The exponent is spelled with an exponent marker so every engine reads it as an
        // approximate (floating point) literal. Written as `1.0 / 3.0` it is an exact
        // literal on MySQL / MariaDB (DECIMAL) and SQL Server (numeric), where the division
        // truncates to a handful of decimals and the exponent loses most of its digits.
        return 'sign(' + this._appendSql(valueSource, context, false) + ') * power(' + this._cbrtRadicand(context, valueSource) + ', 1.0e0 / 3.0e0)'
    }
    _cbrtRadicand(context: SqlBuildContext, valueSource: ToSql): string {
        return 'abs(' + this._appendSql(valueSource, context, false) + ')'
    }
    _sign(context: SqlBuildContext, valueSource: ToSql): string {
        return 'sign(' + this._appendSql(valueSource, context, false) + ')'
    }
    _acos(context: SqlBuildContext, valueSource: ToSql): string {
        return 'acos(' + this._appendSql(valueSource, context, false) + ')'
    }
    _asin(context: SqlBuildContext, valueSource: ToSql): string {
        return 'asin(' + this._appendSql(valueSource, context, false) + ')'
    }
    _atan(context: SqlBuildContext, valueSource: ToSql): string {
        return 'atan(' + this._appendSql(valueSource, context, false) + ')'
    }
    _cos(context: SqlBuildContext, valueSource: ToSql): string {
        return 'cos(' + this._appendSql(valueSource, context, false) + ')'
    }
    _cot(context: SqlBuildContext, valueSource: ToSql): string {
        return 'cot(' + this._appendSql(valueSource, context, false) + ')'
    }
    _sin(context: SqlBuildContext, valueSource: ToSql): string {
        return 'sin(' + this._appendSql(valueSource, context, false) + ')'
    }
    _tan(context: SqlBuildContext, valueSource: ToSql): string {
        return 'tan(' + this._appendSql(valueSource, context, false) + ')'
    }
    // The date-part family. PostgreSQL is the dialect that reaches it — it declares no
    // override of its own — so this family is written in PostgreSQL's form: the
    // `_appendSqlForDatePartArgument` receiver, the `::integer` casts, and `_monthFromZero`'s
    // `- 1`. Every other dialect overrides all of it. Keep it in step with PostgreSQL:
    // it is not dead code, it is the code PostgreSQL runs.
    _day(context: SqlBuildContext, valueSource: ToSql): string {
        return 'extract(day from ' + this._appendSqlForDatePartArgument(valueSource, context) + ')'
    }
    _epochMilliseconds(context: SqlBuildContext, valueSource: ToSql): string {
        // Mirrors `Date.getTime()`, so the result is in MILLISECONDS. `extract(epoch …)`
        // answers in seconds, including the fractional part; the digits below a millisecond
        // are dropped, as the Date read drops them (floor, also before 1970)
        return 'floor(extract(epoch from ' + this._appendSqlForDatePartArgument(valueSource, context) + ') * 1000)'
    }
    _year(context: SqlBuildContext, valueSource: ToSql): string {
        return 'extract(year from ' + this._appendSqlForDatePartArgument(valueSource, context) + ')'
    }
    _monthFromZero(context: SqlBuildContext, valueSource: ToSql): string {
        // Mirrors `Date.getMonth()`, which is 0-based, while `extract(month …)` is 1-based.
        // The `- 1` is why `_operationsThatNeedParenthesis._monthFromZero` is registered.
        return 'extract(month from ' + this._appendSqlForDatePartArgument(valueSource, context) + ') - 1'
    }
    _dayOfWeekFromSunday(context: SqlBuildContext, valueSource: ToSql): string {
        // `dow` (day of week, 0-based from Sunday) matches `Date.getDay()`. It is a
        // PostgreSQL-only field name — a dialect without it must override this.
        return 'extract(dow from ' + this._appendSqlForDatePartArgument(valueSource, context) + ')'
    }
    _hour(context: SqlBuildContext, valueSource: ToSql): string {
        return 'extract(hour from ' + this._appendSqlForDatePartArgument(valueSource, context) + ')'
    }
    _minute(context: SqlBuildContext, valueSource: ToSql): string {
        return 'extract(minute from ' + this._appendSqlForDatePartArgument(valueSource, context) + ')'
    }
    _second(context: SqlBuildContext, valueSource: ToSql): string {
        // `extract(second …)` yields a numeric that INCLUDES the fraction (45.9996), and
        // `numeric::integer` rounds away from zero — so the bare cast reports 46 for
        // :45.9996 and 60 for :59.9996, a value this method's declared type (and the
        // JS `Date.getSeconds()` contract, an integer 0-59) does not allow.
        return 'trunc(extract(second from ' + this._appendSqlForDatePartArgument(valueSource, context) + '))::integer'
    }
    _millisecond(context: SqlBuildContext, valueSource: ToSql): string {
        // Same rounding cast as `_second`: `extract(millisecond …)` includes the
        // sub-millisecond fraction, so :45.9996 rounds up to 46000, and the `% 1000`
        // then wraps it to 0 instead of 999.
        return 'trunc(extract(millisecond from ' + this._appendSqlForDatePartArgument(valueSource, context) + '))::integer % 1000'
    }
    // The date functions with the semantics of Temporal (plainDate, plainTime, plainDateTime), in PostgreSQL's form, as
    // the family above: every other dialect overrides them
    _month(context: SqlBuildContext, valueSource: ToSql): string {
        return 'extract(month from ' + this._appendSqlForDatePartArgument(valueSource, context) + ')'
    }
    _dayOfWeek(context: SqlBuildContext, valueSource: ToSql): string {
        // `isodow`: 1 Monday to 7 Sunday, as Temporal's dayOfWeek
        return 'extract(isodow from ' + this._appendSqlForDatePartArgument(valueSource, context) + ')'
    }
    _dayOfYear(context: SqlBuildContext, valueSource: ToSql): string {
        return 'extract(doy from ' + this._appendSqlForDatePartArgument(valueSource, context) + ')'
    }
    _microsecond(context: SqlBuildContext, valueSource: ToSql): string {
        // Temporal's microsecond is the one of the millisecond (0 to 999). `extract(microseconds …)` gives the
        // microseconds of the minute, with a fraction a cast would round
        return 'trunc(extract(microseconds from ' + this._appendSqlForDatePartArgument(valueSource, context) + '))::integer % 1000'
    }
    _toPlainDate(context: SqlBuildContext, valueSource: ToSql): string {
        return 'cast(' + this._appendSql(valueSource, context, false) + ' as date)'
    }
    /** The code of the month of a date, `'M01'` to `'M12'` */
    _monthCode(context: SqlBuildContext, valueSource: ToSql): string {
        return "to_char(" + this._appendSqlForDatePartArgument(valueSource, context) + ", '\"M\"MM')"
    }
    /** The days of the month of the date of a value */
    _daysInMonthOf(context: SqlBuildContext, valueSource: ToSql): string {
        return "extract(day from date_trunc('month', " + this._appendSqlForDatePartArgument(valueSource, context) + ") + interval '1 month - 1 day')::integer"
    }
    /** The days of the year of the date of a value: the days of its February plus the 337 of the other months */
    _daysInYearOf(context: SqlBuildContext, valueSource: ToSql): string {
        return '337 + ' + this._daysInMonth(context, this._integerPart(this._year(context, valueSource)), '2')
    }
    /** Whether the year of the date of a value is a leap year: its February has 29 days */
    _inLeapYearOf(context: SqlBuildContext, valueSource: ToSql): string {
        return this._daysInMonth(context, this._integerPart(this._year(context, valueSource)), '2') + ' = 29'
    }
    /** The months of the year of the date of a value: 12 (null for a null value) */
    _monthsInYearOf(context: SqlBuildContext, valueSource: ToSql): string {
        return 'case when ' + this._appendSqlForDatePartArgument(valueSource, context) + ' is not null then 12 end'
    }
    /** The month of the year of a date, kept in the date of its reference day (see _temporalReference) */
    _toPlainYearMonth(context: SqlBuildContext, valueSource: ToSql): string {
        const year = this._integerPart(this._year(context, valueSource))
        const month = this._integerPart(this._month(context, valueSource))
        return this._makeDate(context, year, month, String(this._dayOfStoredYearMonths()))
    }
    /** The day of the month of a date, kept in the date of its reference year (see _temporalReference) */
    _toPlainMonthDay(context: SqlBuildContext, valueSource: ToSql): string {
        const month = this._integerPart(this._month(context, valueSource))
        const day = this._integerPart(this._day(context, valueSource))
        return this._makeDate(context, String(this._yearOfStoredMonthDays()), month, day)
    }
    /** The day of the date a month of a year is stored in (dayOfStoredYearMonths of the connection, 1 by default) */
    _dayOfStoredYearMonths(): number {
        return dayOfStoredYearMonthsOf(this._connectionConfiguration.dayOfStoredYearMonths)
    }
    /** The year of the date a day of a month is stored in (yearOfStoredMonthDays of the connection, 1972 by default) */
    _yearOfStoredMonthDays(): number {
        return yearOfStoredMonthDaysOf(this._connectionConfiguration.yearOfStoredMonthDays)
    }
    _toPlainTime(context: SqlBuildContext, valueSource: ToSql): string {
        return 'cast(' + this._appendSql(valueSource, context, false) + ' as time)'
    }
    _toPlainDateTime(context: SqlBuildContext, valueSource: ToSql): string {
        // A date at 00:00
        return 'cast(' + this._appendSql(valueSource, context, false) + ' as timestamp)'
    }
    /**
     * The nanoseconds since 1970-01-01T00:00Z of an instant: its seconds since the epoch with their fraction (the
     * microseconds PostgreSQL keeps), exact as a numeric, beyond the 64 bits of an integer too (before 1678, after 2262)
     */
    _epochNanoseconds(context: SqlBuildContext, valueSource: ToSql): string {
        return 'trunc(extract(epoch from ' + this._appendSqlForDatePartArgument(valueSource, context) + ') * 1000000000)'
    }
    /**
     * The date and time of an instant in the zone of the database: a timestamp, which converts a timestamptz with the
     * zone of the session (the zone of the database), and is the value itself for a column without zone
     */
    _instantToPlainDateTime(context: SqlBuildContext, valueSource: ToSql): string {
        return this._appendSqlParenthesis(valueSource, context, false) + '::timestamp'
    }
    /**
     * The instant of a date and time, a wall clock of the zone of the database: the same value, which the database
     * completes with the zone of its session where the instant meets a value with zone, or is read
     */
    _toInstant(context: SqlBuildContext, valueSource: ToSql): string {
        return this._appendSql(valueSource, context, false)
    }
    /**
     * The wall clock in UTC of an instant, where Temporal computes its arithmetic: a value without zone of a database in
     * UTC is it, and so is a timestamptz in a session in UTC
     */
    _instantInUtc(context: SqlBuildContext, valueSource: ToSql): string {
        return this._appendSql(valueSource, context, false)
    }
    /** The instant of an integer of milliseconds since 1970-01-01T00:00Z, as Temporal's `Instant.fromEpochMilliseconds` */
    _instantFromEpochMilliseconds(context: SqlBuildContext, valueSource: ToSql): string {
        return this._appendInstantOfEpoch(context, valueSource, 86_400_000n, 1_000_000n)
    }
    /** The instant of an integer of nanoseconds since 1970-01-01T00:00Z, as Temporal's `Instant.fromEpochNanoseconds` */
    _instantFromEpochNanoseconds(context: SqlBuildContext, valueSource: ToSql): string {
        return this._appendInstantOfEpoch(context, valueSource, 86_400_000_000_000n, 1n)
    }
    /**
     * The instant of a number of units since 1970-01-01T00:00Z (perDay in a day, of nanoseconds each): its wall clock in
     * UTC is the day 1970-01-01 plus the whole days, rounded down, plus the nanoseconds of the rest, which the remainder
     * gives from 0 (the remainder of a division has the sign of the dividend). Integers only: exact in every date the
     * database has
     */
    _appendInstantOfEpoch(context: SqlBuildContext, valueSource: ToSql, perDay: bigint, nanoseconds: bigint): string {
        const operand = this._temporalOperand(valueSource)
        const day = this._bigintLiteral(perDay)
        const days = this._truncatedDivision('(' + this._epochOperand(context, operand) + ' - ' + this._epochRemainder(context, operand, day) + ')', day)
        const date = this._addDaysToDate(context, this._epochDate(), this._integerOfBigint(days))
        const rest = this._epochRemainder(context, operand, day)
        return this._instantOfUtc(context, this._dateTimeOfNanoseconds(context, date, nanoseconds === 1n ? rest : rest + ' * ' + this._bigintLiteral(nanoseconds)))
    }
    /** The rest of a number of units since the epoch after its whole days, from 0 */
    _epochRemainder(context: SqlBuildContext, valueSource: ToSql, day: string): string {
        return '(' + this._integerRemainder('(' + this._integerRemainder(this._epochOperand(context, valueSource), day) + ' + ' + day + ')', day) + ')'
    }
    /** An integer of units since the epoch, as an integer of 64 bits, which its products need: an int is cast */
    _epochOperand(context: SqlBuildContext, valueSource: ToSql): string {
        if (isValueSource(valueSource) && __isIntClass(__classOf(valueSource as object))) {
            return this._bigintOfInteger(this._appendSql(valueSource, context, false))
        }
        return this._appendSqlParenthesis(valueSource, context, false)
    }
    /** An integer (or a number without fraction) as an integer of 64 bits */
    _bigintOfInteger(sql: string): string {
        return 'cast(' + sql + ' as bigint)'
    }
    /** The date 1970-01-01 */
    _epochDate(): string {
        return "date '1970-01-01'"
    }
    /**
     * A zoned date and time, which only a database that computes with the rules of the time zones has (Oracle, which
     * also keeps a zone with each value, and PostgreSQL): an error of the construction of the query on the others
     */
    /** Whether the database computes with the rules of the time zones: a zonedDateTime */
    _supportZonedDateTimes(): boolean {
        return false
    }
    _zonedDateTimeUnsupported(): never {
        throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_QUERY' }, 'A zoned date and time (zonedDateTime) needs a database that computes with the rules of the time zones, Oracle or PostgreSQL: this database has none')
    }
    /*
     * A database without a type for a zoned date and time keeps it as its RFC 9557 text, the one of Temporal's toString
     * (`2024-03-02T12:05:00+01:00[Europe/Madrid]`): its SQL is that text, which gives without the rules of the zones its
     * wall clock, its offset, its zone and its instant (the wall clock minus the offset). Each piece is written by the
     * database from the value source, written again in each place it is used (a parameter can't be repeated by its text)
     */
    /** Whether the functions of the library are in the database (`libraryFunctions`) */
    _libraryFunctionsInstalled(): boolean {
        return this._connectionConfiguration.libraryFunctions === 'installed'
    }
    /** The function of the library that replaces ignoring the case of the text, when the database has one (SQLite) */
    _replaceAllInsensitiveFunction(): string | undefined {
        return undefined
    }
    /** Whether a zonedDateTime is kept as its RFC 9557 text: its SQL is that text */
    _zonedKeptAsText(): boolean {
        return false
    }
    /** The wall clock in UTC of the instant of the RFC 9557 text of a zoned date and time, a value without zone of the database */
    _zonedTextUtc(_context: SqlBuildContext, _valueSource: ToSql): string {
        return this._zonedDateTimeUnsupported()
    }
    /** The wall clock in its zone of the RFC 9557 text of a zoned date and time, a plainDateTime */
    _zonedTextWall(_context: SqlBuildContext, _valueSource: ToSql): string {
        return this._zonedDateTimeUnsupported()
    }
    /** The zone in brackets of the RFC 9557 text of a zoned date and time */
    _zonedTextZone(_context: SqlBuildContext, _valueSource: ToSql): string {
        return this._zonedDateTimeUnsupported()
    }
    /** The offset of the RFC 9557 text of a zoned date and time, `+00:00` for a `Z` */
    _zonedTextOffset(_context: SqlBuildContext, _valueSource: ToSql): string {
        return this._zonedDateTimeUnsupported()
    }
    /** The nanoseconds of the offset of the RFC 9557 text of a zoned date and time, an integer */
    _zonedTextOffsetNanoseconds(_context: SqlBuildContext, _valueSource: ToSql): string {
        return this._zonedDateTimeUnsupported()
    }
    /**
     * A comparison of a zoned date and time kept as text (see _zonedKeptAsText), which is the comparison of their
     * instants, as on the databases with zones and as Temporal's compare (its text compares its wall clock)
     */
    _isZonedTextComparison(typeClass: DataTypeClass): boolean {
        return this._zonedKeptAsText() && __isZonedDateTimeClass(typeClass)
    }
    _zonedToInstant(context: SqlBuildContext, valueSource: ToSql): string {
        if (this._zonedKeptAsText()) {
            return this._instantOfUtc(context, this._zonedTextUtc(context, valueSource))
        }
        return this._zonedDateTimeUnsupported()
    }
    _zonedToPlainDateTime(context: SqlBuildContext, valueSource: ToSql): string {
        if (this._zonedKeptAsText()) {
            return this._zonedTextWall(context, valueSource)
        }
        return this._zonedDateTimeUnsupported()
    }
    _zonedTimeZoneId(context: SqlBuildContext, valueSource: ToSql): string {
        if (this._zonedKeptAsText()) {
            return this._zonedTextZone(context, valueSource)
        }
        return this._zonedDateTimeUnsupported()
    }
    _zonedOffset(context: SqlBuildContext, valueSource: ToSql): string {
        if (this._zonedKeptAsText()) {
            return this._zonedTextOffset(context, valueSource)
        }
        return this._zonedDateTimeUnsupported()
    }
    _zonedOffsetNanoseconds(context: SqlBuildContext, valueSource: ToSql): string {
        if (this._zonedKeptAsText()) {
            return this._zonedTextOffsetNanoseconds(context, valueSource)
        }
        return this._zonedDateTimeUnsupported()
    }
    _instantToZoned(_context: SqlBuildContext, _valueSource: ToSql, _value: any, _typeClass: DataTypeClass): string {
        return this._zonedDateTimeUnsupported()
    }
    _zonedInUtc(_context: SqlBuildContext, _valueSource: ToSql): string {
        return this._zonedDateTimeUnsupported()
    }
    /*
     * The arithmetic of a zoned date and time, on the databases that compute with zones (_supportZonedDateTimes), written
     * here with the pieces each of them writes in its own way: the instant is computed on its wall clock in UTC (a value
     * without zone), and taken back to its zone (_zonedOfUtc); the wall clock in its zone is the one of that instant
     * there (_zonedWallOfUtc). A database without variables writes an operand again in each place it is used, so a
     * computed one is computed once in a scalar subquery that names it (_zonedComputedOnce)
     */
    /**
     * Whether an operand of a computation of zones is written in each place it is used: a column, or a text. A computed
     * value, and a parameter (whose placeholder converts the text sent), is computed once, in a scalar subquery that
     * names it (see _zonedComputedOnce)
     */
    _isZonedOperandWrittenInPlace(operand: unknown): boolean {
        return !isValueSource(operand) || __isColumn(__asNodeValueSource(operand as AnyValueSource))
    }
    /** The SQL of an operand of a computation of zones where it is used: the operand, or its name in the scalar subquery that computes it */
    _zonedOperandSql(context: SqlBuildContext, operand: ToSql, name: string): string {
        return this._isZonedOperandWrittenInPlace(operand) ? this._appendSqlParenthesis(operand, context, false) : 'tsq_z.' + name
    }
    /**
     * The SQL of a computation of zones, with its computed operands (see _isZonedOperandWrittenInPlace) computed once in
     * a scalar subquery that names them: without variables, a computed value written in each place it is used would be
     * written again in each use of a computation of it, so the text would grow exponentially with each one
     */
    _zonedComputedOnce(context: SqlBuildContext, sql: string, operand: unknown, name: string, other?: unknown, otherName?: string): string {
        // A const is written with its type: a column of the subquery has the type of what it selects
        let columns = this._isZonedOperandWrittenInPlace(operand) ? '' : this._appendSql(operand as ToSql, context, this._typesTemporalConsts()) + ' as ' + name
        if (other !== undefined && !this._isZonedOperandWrittenInPlace(other)) {
            columns += (columns === '' ? '' : ', ') + this._appendSql(other as ToSql, context, this._typesTemporalConsts()) + ' as ' + otherName
        }
        return columns === '' ? sql : '(select ' + sql + ' from (select ' + columns + this._fromNoTable() + this._zonedComputedOnceFence() + ') tsq_z)'
    }
    /** What keeps the database from computing a value named in a scalar subquery again in each place it is used (see _zonedComputedOnce) */
    _zonedComputedOnceFence(): string {
        return ''
    }
    /** The zone of a zoned date and time (whose SQL where it is used is sql), as _zonedWallOfUtc and _zonedOfUtc take it */
    _zonedZoneOf(_context: SqlBuildContext, _zoned: ToSql, _sql: string): string {
        return this._zonedDateTimeUnsupported()
    }
    /** The wall clock in UTC of a zoned date and time (of its SQL), a value without zone */
    _zonedUtcOf(_sql: string): string {
        return this._zonedDateTimeUnsupported()
    }
    /** The wall clock in its zone of a zoned date and time (of its SQL), a value without zone */
    _zonedWallOf(_sql: string, _zone: string): string {
        return this._zonedDateTimeUnsupported()
    }
    /** The wall clock in a zone of the instant of a wall clock in UTC */
    _zonedWallOfUtc(_utc: string, _zone: string): string {
        return this._zonedDateTimeUnsupported()
    }
    /** The zoned date and time of the instant of a wall clock in UTC, in a zone */
    _zonedOfUtc(_utc: string, _zone: string): string {
        return this._zonedDateTimeUnsupported()
    }
    /** An interval of a number of seconds (with their fraction) */
    _zonedSecondsInterval(_seconds: string): string {
        return this._zonedDateTimeUnsupported()
    }
    /** The midnight of the day of a wall clock, or of the next day */
    _zonedMidnightOf(_wall: string, _nextDay: boolean): string {
        return this._zonedDateTimeUnsupported()
    }
    /** The hours of an interval of days to seconds, with their fraction */
    _zonedHoursOf(_interval: string): string {
        return this._zonedDateTimeUnsupported()
    }
    /** A time zone given to toZonedDateTime or toZonedDateTimeISO, as _zonedWallOfUtc and _zonedOfUtc take it */
    _zonedTimeZoneSql(_context: SqlBuildContext, _value: unknown): string {
        return this._zonedDateTimeUnsupported()
    }
    /** A wall clock plus the months and the days of the date of a duration (see ZonedDurationPartsSql), with Temporal's overflow */
    _zonedWallPlusDate(_context: SqlBuildContext, _wall: string, _months: string | undefined, _days: string | undefined, _reject: boolean): string {
        return this._zonedDateTimeUnsupported()
    }
    /** The parts of a duration (multiplied by sign) a zoned date and time adds; undefined when it adds nothing */
    _zonedDurationParts(_context: SqlBuildContext, _value: unknown, _sign: 1 | -1): ZonedDurationPartsSql | undefined {
        return this._zonedDateTimeUnsupported()
    }
    /** A plainDateTime as the wall clock the computations of zones take */
    _zonedWallClockOfPlain(sql: string): string {
        return sql
    }
    /** Whether the zone gives the wall clock at the instant (its wall clock in UTC) */
    _zonedIsWallClockOf(instant: string, zone: string, wall: string): string {
        return this._zonedWallOfUtc(instant, zone) + ' = ' + wall
    }
    /**
     * A timestamp, or an error of the query: the timestamp plus no day, the day 28 of February 2001 checked (or the 29,
     * which it hasn't, when the day given is 29) minus 28
     */
    _zonedOrError(context: SqlBuildContext, value: string, day: string): string {
        return this._shiftDays(context, value, '(' + this._validDayOrError(context, '2001', '2', day) + ' - 28)', 'timestamp')
    }
    /** A wall clock in a zone, with Temporal's disambiguation */
    _plainDateTimeToZoned(_context: SqlBuildContext, _valueSource: ToSql, _value: any, _value2: any, _typeClass: DataTypeClass): string {
        return this._zonedDateTimeUnsupported()
    }
    /**
     * The zoned date and time a wall clock computed from it refers to (see _zonedOfWallClockIn): the value, or its name
     * in the scalar subquery that computes it
     */
    _zonedOperandReference(context: SqlBuildContext, valueSource: ToSql): string {
        if (!this._supportZonedDateTimes()) {
            return this._zonedDateTimeUnsupported()
        }
        return this._zonedOperandSql(context, valueSource, 'x')
    }
    /** The hours from the start of its day to the start of the next one, in its zone: Temporal's `hoursInDay` */
    _zonedHoursInDay(_context: SqlBuildContext, _valueSource: ToSql): string {
        return this._zonedDateTimeUnsupported()
    }
    /** Rounded to a day, as Temporal's `round('day')`: the start of its day or of the next one in its zone */
    _zonedRoundToDay(_context: SqlBuildContext, _valueSource: ToSql, _value: any, _typeClass: DataTypeClass): string {
        return this._zonedDateTimeUnsupported()
    }
    /**
     * A wall clock (the receiver) in the zone of a zoned date and time (the value) with an offset, as Temporal's option
     * `offset` 'use' (the wall clock minus the offset, of the value or the one given) or 'reject' (the same, failing the
     * query when the zone hasn't that offset for that wall clock). With 'prefer' and 'ignore' the wall clock is taken to
     * its zone, as each database does it. The wall clock is computed from the value by its reference (see
     * _zonedOperandReference), so it is written in each place it is used, inside the scalar subquery that computes the
     * value once
     */
    _zonedOfWallClockIn(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, _typeClass: DataTypeClass): string {
        const interpretation = value2 as ZonedInterpretation
        if (!this._supportZonedDateTimes() || (interpretation.offset !== 'use' && interpretation.offset !== 'reject')) {
            return this._zonedDateTimeUnsupported()
        }
        const zoned = this._zonedOperandSql(context, value as ToSql, 'x')
        const zone = this._zonedZoneOf(context, value as ToSql, zoned)
        const wall = this._zonedWallClockOfPlain(this._appendSql(valueSource, context, false))
        const offset = interpretation.offsetNanoseconds === undefined
            ? '(' + this._zonedWallOf(zoned, zone) + ' - ' + this._zonedUtcOf(zoned) + ')'
            : this._zonedSecondsInterval(secondsOfNanosecondsText(interpretation.offsetNanoseconds))
        const withOffset = '(' + wall + ' - ' + offset + ')'
        const utc = interpretation.offset === 'use' ? withOffset : this._zonedOrError(context, withOffset, 'case when ' + this._zonedIsWallClockOf(withOffset, zone, wall) + ' then 28 else 29 end')
        return this._zonedComputedOnce(context, this._zonedOfUtc(utc, zone), value, 'x')
    }
    _zonedAddDuration(context: SqlBuildContext, valueSource: ToSql, value: any, _typeClass: DataTypeClass): string {
        return this._appendZonedWithDuration(context, valueSource, value, 1, false)
    }
    _zonedSubtractDuration(context: SqlBuildContext, valueSource: ToSql, value: any, _typeClass: DataTypeClass): string {
        return this._appendZonedWithDuration(context, valueSource, value, -1, false)
    }
    _zonedAddDurationRejecting(context: SqlBuildContext, valueSource: ToSql, value: any, _typeClass: DataTypeClass): string {
        return this._appendZonedWithDuration(context, valueSource, value, 1, true)
    }
    _zonedSubtractDurationRejecting(context: SqlBuildContext, valueSource: ToSql, value: any, _typeClass: DataTypeClass): string {
        return this._appendZonedWithDuration(context, valueSource, value, -1, true)
    }
    /** A zoned date and time plus a duration (multiplied by sign), as Temporal adds it */
    _appendZonedWithDuration(_context: SqlBuildContext, _valueSource: ToSql, _value: unknown, _sign: 1 | -1, _reject: boolean): string {
        return this._zonedDateTimeUnsupported()
    }
    _zonedUntil(_context: SqlBuildContext, _valueSource: ToSql, _value: any, _value2: any, _typeClass: DataTypeClass): string {
        return this._zonedDateTimeUnsupported()
    }
    _zonedSince(_context: SqlBuildContext, _valueSource: ToSql, _value: any, _value2: any, _typeClass: DataTypeClass): string {
        return this._zonedDateTimeUnsupported()
    }
    /** The instant of a wall clock in UTC (see _instantInUtc) */
    _instantOfUtc(_context: SqlBuildContext, sql: string): string {
        return sql
    }
    /**
     * The instant rounded as Temporal rounds it: as if it were positive, to a step that divides a day, so its
     * nanoseconds since the midnight in UTC before it are rounded (the receiver is its wall clock in UTC)
     */
    _roundInstant(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const rounding = instantRoundingOf(value)
        if (!rounding) {
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: typeClass.type }, 'Invalid options to round an instant: ' + JSON.stringify(value))
        }
        const tick = this._roundingTick(rounding)
        if (tick === undefined) {
            // A step that divides the smallest unit the database keeps: nothing to round
            return this._instantOfUtc(context, this._appendSql(valueSource, context, false))
        }
        const date = this._dateOfValue(context, valueSource)
        return this._instantOfUtc(context, this._dateTimeOfTicks(context, date, this._roundedSinceMidnight(context, valueSource, rounding, tick), tick))
    }
    /** The instant plus a duration of the time alone, added to its wall clock in UTC (the receiver) */
    _instantAddDuration(context: SqlBuildContext, valueSource: ToSql, value: any, _typeClass: DataTypeClass): string {
        return this._appendInstantWithDuration(context, valueSource, value, 1)
    }
    _instantSubtractDuration(context: SqlBuildContext, valueSource: ToSql, value: any, _typeClass: DataTypeClass): string {
        return this._appendInstantWithDuration(context, valueSource, value, -1)
    }
    /**
     * The instant plus a duration (multiplied by sign), added to its wall clock in UTC (the receiver) as to a date and
     * time. A duration given as a value has only the time (checked when the query is built); a value source may have
     * days or more, which Temporal rejects: the query fails then (see _valueOrErrorWhenDurationHasDays)
     */
    _appendInstantWithDuration(context: SqlBuildContext, valueSource: ToSql, value: any, sign: 1 | -1): string {
        const sum = this._appendWithDuration(context, valueSource, value, __registeredDataType('plainDateTime'), sign)
        if (!isValueSource(value)) {
            return this._instantOfUtc(context, sum)
        }
        return this._instantOfUtc(context, this._valueOrErrorWhenDurationHasDays(context, sum, __asNodeValueSource(value as AnyValueSource) as unknown as ToSql))
    }
    /**
     * A date and time, or an error of the query when the duration has days, weeks, months or years: the date and time
     * plus no day, the day 28 of February 2001 checked (or the 29, which it hasn't, when the duration has them) minus
     * 28. A null duration is no error
     */
    _valueOrErrorWhenDurationHasDays(context: SqlBuildContext, value: string, duration: ToSql): string {
        const day = 'case when ' + this._durationHasDaysSql(context, duration) + ' then 29 else 28 end'
        return this._shiftDays(context, value, '(' + this._validDayOrError(context, '2001', '2', day) + ' - 28)', 'timestamp')
    }
    /** The condition that a duration has days, weeks, months or years: of its ISO 8601 text, its months or days aren't 0 */
    _durationHasDaysSql(context: SqlBuildContext, duration: ToSql): string {
        if (this._isDurationKeptAsText(duration)) {
            return this._durationTextPart(context, duration, 'M') + ' <> 0 or ' + this._durationTextPart(context, duration, 'D') + ' <> 0'
        }
        const interval = this._appendSqlParenthesis(duration, context, false)
        return 'extract(year from ' + interval + ') <> 0 or extract(month from ' + interval + ') <> 0 or extract(day from ' + interval + ') <> 0'
    }
    _toPlainDateTimeAt(context: SqlBuildContext, valueSource: ToSql, value: any, _typeClass: DataTypeClass): string {
        // A date plus a time of the day is the timestamp of that day at that time; a time given as a value is sent with
        // its type, which the operator needs
        return this._appendSqlParenthesisExcluding(valueSource, context, '_toPlainDateTimeAt', false) + ' + ' + this._appendPlainTimeOperand(context, value)
    }
    /** The time of the day of `toPlainDateTime(time)`: a value source as it is, a value as a plainTime with its type */
    _appendPlainTimeOperand(context: SqlBuildContext, value: any): string {
        return this._appendValueParenthesis(value, context, __registeredDataType('plainTime'), true)
    }
    _addDuration(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._appendWithDuration(context, valueSource, value, typeClass, 1)
    }
    _subtractDuration(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._appendWithDuration(context, valueSource, value, typeClass, -1)
    }
    /**
     * A date, a time or a date and time plus a duration (multiplied by sign), as Temporal adds it (see DurationParts):
     * PostgreSQL adds an interval with the same rules (the months first, kept in the month, then the days and the
     * time; a time goes round at midnight and takes only the time of the interval), except a date, which takes the
     * whole days of the time (`-PT36H` is minus one day, where the interval would give two)
     */
    _appendWithDuration(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass, sign: 1 | -1): string {
        const fields = this._temporalFieldsOfDurationOperation(typeClass)
        const parts = this._constantDurationParts(value, typeClass, fields, sign)
        // A const is written with its type: next to an interval PostgreSQL can't tell a date, a time or a timestamp
        const typed = this._isConstOperand(valueSource)
        if (parts) {
            if (isZeroDuration(parts)) {
                return this._appendSql(valueSource, context, false)
            }
            const value = this._appendSqlParenthesis(valueSource, context, typed)
            if (fields === 'date' && parts.months === 0) {
                // A date plus a number of days is a date
                return value + ' + ' + this._appendValue(parts.days, context, __registeredDataType('int'), true)
            }
            const interval = this._appendValue(durationOfParts(parts, 'duration'), context, __registeredDataType('duration'), true)
            return fields === 'date' ? 'cast(' + value + ' + ' + interval + ' as date)' : value + ' + ' + interval
        }
        const duration = __asNodeValueSource(value)
        const operator = sign < 0 ? ' - ' : ' + '
        if (!this._isDurationKeptAsText(duration)) {
            if (fields !== 'date') {
                return this._appendSqlParenthesis(valueSource, context, typed) + operator + this._appendSqlParenthesis(duration, context, false)
            }
            const interval = this._appendSqlParenthesis(duration, context, false)
            const months = '(extract(year from ' + interval + ') * 12 + extract(month from ' + interval + '))::integer'
            const days = '(extract(day from ' + interval + ') + trunc(extract(epoch from ' + interval + " - date_trunc('day', " + interval + ')) / 86400))::integer'
            return 'cast(' + this._appendSqlParenthesis(valueSource, context, typed) + operator + 'make_interval(months => ' + months + ', days => ' + days + ') as date)'
        }
        const months = this._durationTextPart(context, duration, 'M')
        const days = this._durationTextPart(context, duration, 'D')
        const seconds = this._durationTextPart(context, duration, 'S')
        const nanoseconds = this._durationTextPart(context, duration, 'N')
        if (fields === 'date') {
            return 'cast(' + this._appendSqlParenthesis(valueSource, context, typed) + operator + 'make_interval(months => ' + months + '::integer, days => (' + days + ' + trunc(' + seconds + ' / 86400))::integer) as date)'
        }
        const time = 'secs => ' + seconds + ' + ' + nanoseconds + ' / 1000000000.0'
        const interval = fields === 'time' ? 'make_interval(' + time + ')' : 'make_interval(months => ' + months + '::integer, days => ' + days + '::integer, ' + time + ')'
        return this._appendSqlParenthesis(valueSource, context, typed) + operator + interval
    }
    /**
     * The parts of a duration (multiplied by sign) as SQL, in the order months, days, seconds, nanoseconds, each
     * undefined when it adds nothing; undefined when the duration adds nothing. A constant gives its numbers, as
     * parameters; a value source kept as text its parts read with tsq_duration_part (a database with intervals reads
     * the parts of an interval itself). For a date the days take the whole days of the time; for a time only the time
     * counts. With timeInMicroseconds (MariaDB and MySQL) the seconds are the whole time in microseconds, the digits
     * below them dropped, and there are no nanoseconds
     */
    _durationPartsSql(context: SqlBuildContext, value: unknown, typeClass: DataTypeClass, fields: 'date' | 'time' | 'timestamp', sign: 1 | -1, timeInMicroseconds: boolean = false): DurationPartsSql | undefined {
        const parts = this._constantDurationParts(value, typeClass, fields, sign)
        const int = __registeredDataType('int')
        if (parts) {
            if (isZeroDuration(parts)) {
                return undefined
            }
            return {
                months: parts.months === 0 ? undefined : this._appendValue(parts.months, context, int, false),
                days: parts.days === 0 ? undefined : this._appendValue(parts.days, context, int, false),
                seconds: timeInMicroseconds
                    ? (parts.seconds === 0 && Math.trunc(parts.nanoseconds / 1000) === 0 ? undefined : this._appendValue(BigInt(parts.seconds) * 1_000_000n + BigInt(Math.trunc(parts.nanoseconds / 1000)), context, __registeredDataType('bigint'), false))
                    : (parts.seconds === 0 ? undefined : this._appendValue(BigInt(parts.seconds), context, __registeredDataType('bigint'), false)),
                nanoseconds: timeInMicroseconds || parts.nanoseconds === 0 ? undefined : this._appendValue(parts.nanoseconds, context, int, false),
                constant: parts,
            }
        }
        const duration = __asNodeValueSource(value as AnyValueSource)
        if (fields === 'date') {
            const months = this._signedDurationTextPart(context, duration, 'M', sign)
            const days = '(' + this._signedDurationTextPart(context, duration, 'D', sign) + ' + ' + this._truncatedDivision(this._signedDurationTextPart(context, duration, 'S', sign), '86400') + ')'
            return { months, days, seconds: undefined, nanoseconds: undefined, constant: undefined }
        }
        const months = fields === 'time' ? undefined : this._signedDurationTextPart(context, duration, 'M', sign)
        const days = fields === 'time' ? undefined : this._signedDurationTextPart(context, duration, 'D', sign)
        if (timeInMicroseconds) {
            const microseconds = '(' + this._signedDurationTextPart(context, duration, 'S', sign) + ' * 1000000 + ' + this._truncatedDivision(this._signedDurationTextPart(context, duration, 'N', sign), '1000') + ')'
            return { months, days, seconds: microseconds, nanoseconds: undefined, constant: undefined }
        }
        return { months, days, seconds: this._signedDurationTextPart(context, duration, 'S', sign), nanoseconds: this._signedDurationTextPart(context, duration, 'N', sign), constant: undefined }
    }
    /** A part of the ISO 8601 text of a duration (see _durationTextPart), negated when sign is -1 */
    _signedDurationTextPart(context: SqlBuildContext, valueSource: ToSql, part: 'M' | 'D' | 'S' | 'N', sign: 1 | -1): string {
        return (sign < 0 ? '-' : '') + this._durationTextPart(context, valueSource, part)
    }
    /** An integer division that truncates toward zero, as Temporal balances a time into days: a division of integers */
    _truncatedDivision(dividend: string, divisor: string): string {
        return '(' + dividend + ' / ' + divisor + ')'
    }
    /** Whether the operand is a const, a parameter */
    _isConstOperand(operand: ToSql): boolean {
        return isValueSource(operand) && __asNodeValueSource(operand).isConstValue()
    }
    /**
     * A date, a time or a date and time with the fields given in place of its own, as Temporal's `with` (see
     * plainTemporalFieldsOf): built from its parts, each the one given or the one of the value, the day taken to the
     * last one of the month when the month has fewer. The fields are written as integers, checked here: the year and the
     * month appear twice when the day may not fit, and a parameter can't be repeated on every database
     */
    _withFields(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._appendWithFields(context, valueSource, value, typeClass, false)
    }
    /**
     * with of a month of a year (its year, its month or its code; checked when the operation is made): the date of the
     * year and the month, given or of the value, on the reference day, which every month has
     */
    _yearMonthWith(context: SqlBuildContext, valueSource: ToSql, value: any, _typeClass: DataTypeClass): string {
        const given = plainTemporalFieldsOf(value, 'date')!
        const year = given.year === undefined ? this._integerPart(this._year(context, valueSource)) : String(given.year)
        const month = given.month === undefined ? this._integerPart(this._month(context, valueSource)) : String(given.month)
        return this._makeDate(context, year, month, String(this._dayOfStoredYearMonths()))
    }
    /**
     * with of a day of a month without a year (its month or its code and its day): the date in the reference year, a
     * leap year, with the fields, the day taken to the last one of the month or rejected
     */
    _monthDayWith(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._appendWithFields(context, valueSource, value, typeClass, false, this._yearOfStoredMonthDays())
    }
    _monthDayWithRejecting(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._appendWithFields(context, valueSource, value, typeClass, true, this._yearOfStoredMonthDays())
    }
    _withFieldsRejecting(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._appendWithFields(context, valueSource, value, typeClass, true)
    }
    /** with, taking a day the month hasn't to its last day, or rejecting it (reject) as an error of the query */
    _appendWithFields(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass, reject: boolean, inYear?: number): string {
        const fields = this._temporalFieldsOfDurationOperation(typeClass)
        const given = plainTemporalFieldsOf(value, fields, reject, inYear)
        if (!given) {
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: typeClass.type }, 'Invalid fields to put in a ' + typeClass.type + ': ' + JSON.stringify(value))
        }
        if (fields !== 'date' && __withChangesOnlyWholeTime(given)) {
            return this._withWholeTime(context, valueSource, given, fields)
        }
        let year = ''
        let month = ''
        let day = ''
        if (fields !== 'time') {
            year = given.year === undefined ? this._integerPart(this._year(context, valueSource)) : String(given.year)
            month = given.month === undefined ? this._integerPart(this._month(context, valueSource)) : String(given.month)
            day = given.day === undefined ? this._integerPart(this._day(context, valueSource)) : String(given.day)
            // Only a day that may not fit in the month is taken to its last day: one given above 28, or the one of the
            // value in another month
            const mayNotFit = given.day === undefined ? given.year !== undefined || given.month !== undefined : given.day > 28
            if (mayNotFit) {
                day = reject ? this._validDayOrError(context, year, month, day) : this._leastOf(day, this._daysInMonth(context, year, month))
            }
        }
        if (fields === 'date') {
            return this._makeDate(context, year, month, day)
        }
        const hour = given.hour === undefined ? this._integerPart(this._hour(context, valueSource)) : String(given.hour)
        const minute = given.minute === undefined ? this._integerPart(this._minute(context, valueSource)) : String(given.minute)
        const second = given.second === undefined ? this._integerPart(this._second(context, valueSource)) : String(given.second)
        let nanoseconds: string
        if (given.millisecond === undefined && given.microsecond === undefined && given.nanosecond === undefined) {
            nanoseconds = this._nanosecondOfSecond(context, valueSource)
        } else if (given.millisecond !== undefined && given.microsecond !== undefined && given.nanosecond !== undefined) {
            nanoseconds = String(given.millisecond * 1_000_000 + given.microsecond * 1000 + given.nanosecond)
        } else {
            // The parts of the fraction not given are the ones of the value
            const ofTheValue = this._nanosecondOfSecond(context, valueSource)
            const milliseconds = given.millisecond === undefined ? this._truncatedDivision(ofTheValue, '1000000') : String(given.millisecond)
            const microseconds = given.microsecond === undefined ? this._integerRemainder(this._truncatedDivision(ofTheValue, '1000'), '1000') : String(given.microsecond)
            const ofTheMicrosecond = given.nanosecond === undefined ? this._integerRemainder(ofTheValue, '1000') : String(given.nanosecond)
            nanoseconds = '(' + milliseconds + ' * 1000000 + ' + microseconds + ' * 1000 + ' + ofTheMicrosecond + ')'
        }
        if (fields === 'time') {
            return this._makeTime(context, hour, minute, second, nanoseconds)
        }
        return this._makeTimestamp(context, year, month, day, hour, minute, second, nanoseconds)
    }
    /**
     * with of a time or a date and time that changes only its hour, its minute or its second: the value plus the
     * seconds from each of its fields to the one given, a time of the same day (the fields given are valid)
     */
    _withWholeTime(context: SqlBuildContext, valueSource: ToSql, given: PlainTemporalFields, _fields: 'time' | 'timestamp'): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' + make_interval(secs => ' + this._withSeconds(context, valueSource, given) + ')'
    }
    /** The seconds from the hour, the minute and the second of the value to the ones given (see _withWholeTime) */
    _withSeconds(context: SqlBuildContext, valueSource: ToSql, given: PlainTemporalFields): string {
        let result = given.hour === undefined ? '' : '(' + given.hour + ' - ' + this._integerPart(this._hour(context, valueSource)) + ') * 3600'
        if (given.minute !== undefined) {
            result += (result ? ' + ' : '') + '(' + given.minute + ' - ' + this._integerPart(this._minute(context, valueSource)) + ') * 60'
        }
        if (given.second !== undefined) {
            result += (result ? ' + ' : '') + '(' + given.second + ' - ' + this._integerPart(this._second(context, valueSource)) + ')'
        }
        return result
    }
    /**
     * A time or a date and time rounded, as Temporal's `round` (see plainTemporalRoundingOf): the nanoseconds since
     * midnight rounded to multiples of the step, and the time of them (going round at midnight) or the date plus them
     * (the next day for the end of the day). The time since midnight is written again each time it appears: the
     * parameters of MariaDB and MySQL are positional
     */
    _roundTemporal(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const fields = this._temporalFieldsOfDurationOperation(typeClass)
        const rounding = plainTemporalRoundingOf(value, fields)
        if (!rounding) {
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: typeClass.type }, 'Invalid options to round a ' + typeClass.type + ': ' + JSON.stringify(value))
        }
        const tick = this._roundingTick(rounding)
        if (tick === undefined) {
            // A step that divides the smallest unit the database keeps: nothing to round
            return this._appendSql(valueSource, context, false)
        }
        if (fields === 'time') {
            return this._timeOfTicks(context, this._roundedSinceMidnight(context, valueSource, rounding, tick), tick)
        }
        const date = this._dateOfValue(context, valueSource)
        return this._dateTimeOfTicks(context, date, this._roundedSinceMidnight(context, valueSource, rounding, tick), tick)
    }
    /**
     * The nanoseconds of the smallest unit of time the database keeps (_temporalTick), the unit a rounding is computed in;
     * a nanosecond for a step that isn't a multiple of it, and undefined for one that divides it (nothing to round)
     */
    _roundingTick(rounding: PlainTemporalRounding): bigint | undefined {
        const tick = this._temporalTick()
        if (tick % rounding.step === 0n) {
            return undefined
        }
        return rounding.step % tick === 0n ? tick : 1n
    }
    /** The nanoseconds of the smallest unit of time a time or a date and time of the database keeps: a nanosecond by default */
    _temporalTick(): bigint {
        return 1n
    }
    /** The time since midnight of the value in units of tick nanoseconds (see _temporalTick), rounded to the step in its mode */
    _roundedSinceMidnight(context: SqlBuildContext, valueSource: ToSql, rounding: PlainTemporalRounding, tick: bigint): string {
        const stepValue = rounding.step / tick
        const step = this._bigintLiteral(stepValue)
        const twoSteps = this._bigintLiteral(stepValue * 2n)
        switch (rounding.mode) {
            case 'trunc':
                return this._truncatedDivision(this._sinceMidnight(context, valueSource, tick), step) + ' * ' + step
            case 'ceil':
                return this._truncatedDivision('(' + this._sinceMidnight(context, valueSource, tick) + ' + ' + this._bigintLiteral(stepValue - 1n) + ')', step) + ' * ' + step
            case 'halfExpand':
                return this._truncatedDivision('(2 * ' + this._sinceMidnight(context, valueSource, tick) + ' + ' + step + ')', twoSteps) + ' * ' + step
            case 'halfTrunc':
                return this._truncatedDivision('(2 * ' + this._sinceMidnight(context, valueSource, tick) + ' + ' + this._bigintLiteral(stepValue - 1n) + ')', twoSteps) + ' * ' + step
            case 'halfEven': {
                // halfExpand of y = 2 * value + step, less one at half way to an odd multiple, where y is a multiple of four
                // steps plus two: the value appears twice, written left to right, as the parameters appear in the text
                const y = '(2 * ' + this._sinceMidnight(context, valueSource, tick) + ' + ' + step + ')'
                const doubled = '(2 * ' + this._sinceMidnight(context, valueSource, tick) + ' + ' + step + ')'
                return '(' + this._truncatedDivision(y, twoSteps) + ' - case when ' + this._integerRemainder(doubled, this._bigintLiteral(stepValue * 4n)) + ' = ' + twoSteps + ' then 1 else 0 end) * ' + step
            }
        }
    }
    /** The time since midnight of a time or a date and time in units of tick nanoseconds: the database's own unit, or nanoseconds */
    _sinceMidnight(context: SqlBuildContext, valueSource: ToSql, tick: bigint): string {
        return tick === 1n ? this._nanosecondsSinceMidnight(context, valueSource) : this._ticksSinceMidnight(context, valueSource)
    }
    /** The time since midnight of a time or a date and time in the smallest unit the database keeps (see _temporalTick) */
    _ticksSinceMidnight(context: SqlBuildContext, valueSource: ToSql): string {
        return this._nanosecondsSinceMidnight(context, valueSource)
    }
    /** The time of the day of a number of units of tick nanoseconds since midnight, going round at midnight */
    _timeOfTicks(context: SqlBuildContext, ticks: string, tick: bigint): string {
        return tick === 1n ? this._timeOfNanoseconds(context, ticks) : this._timeOfDatabaseTicks(context, ticks)
    }
    /** The date plus a number of units of tick nanoseconds, a date and time */
    _dateTimeOfTicks(context: SqlBuildContext, date: string, ticks: string, tick: bigint): string {
        return tick === 1n ? this._dateTimeOfNanoseconds(context, date, ticks) : this._dateTimeOfDatabaseTicks(context, date, ticks)
    }
    /** The time of the day of a number of the smallest units the database keeps since midnight (see _temporalTick) */
    _timeOfDatabaseTicks(context: SqlBuildContext, ticks: string): string {
        return this._timeOfNanoseconds(context, ticks)
    }
    /** The date plus a number of the smallest units the database keeps (see _temporalTick) */
    _dateTimeOfDatabaseTicks(context: SqlBuildContext, date: string, ticks: string): string {
        return this._dateTimeOfNanoseconds(context, date, ticks)
    }
    /** An integer literal that the database takes as a bigint */
    _bigintLiteral(value: bigint): string {
        return String(value)
    }
    /** The nanoseconds since midnight of a time or a date and time, with the digits the database keeps */
    _nanosecondsSinceMidnight(context: SqlBuildContext, valueSource: ToSql): string {
        // The epoch of a time is its seconds since midnight; a timestamp is taken to its time first
        const value = this._appendSql(valueSource, context, false)
        const time = __temporalFieldsOf(__classOf(valueSource as object)) === 'time' ? value : 'cast(' + value + ' as time)'
        return '(round(extract(epoch from ' + time + ') * 1000000)::bigint * 1000)'
    }
    /** The date of a date and time */
    _dateOfValue(context: SqlBuildContext, valueSource: ToSql): string {
        return 'cast(' + this._appendSql(valueSource, context, false) + ' as date)'
    }
    /** The time of the day of a number of nanoseconds since midnight, going round at midnight */
    _timeOfNanoseconds(_context: SqlBuildContext, nanoseconds: string): string {
        return "time '00:00' + make_interval(secs => (" + nanoseconds + ') / 1000000000.0)'
    }
    /** The date plus a number of nanoseconds, a date and time */
    _dateTimeOfNanoseconds(_context: SqlBuildContext, date: string, nanoseconds: string): string {
        return date + ' + make_interval(secs => (' + nanoseconds + ') / 1000000000.0)'
    }
    /** A part of a date or a time as an integer (PostgreSQL's extract gives a numeric) */
    _integerPart(sql: string): string {
        return 'cast(' + sql + ' as integer)'
    }
    /** The remainder of the division of two integers, with the sign of the dividend */
    _integerRemainder(dividend: string, divisor: string): string {
        return dividend + ' % ' + divisor
    }
    /** The smaller of two integers */
    _leastOf(value: string, other: string): string {
        return 'least(' + value + ', ' + other + ')'
    }
    /** The days of the month of the year */
    _daysInMonth(_context: SqlBuildContext, year: string, month: string): string {
        return 'extract(day from make_date(' + year + ', ' + month + ", 1) + interval '1 month - 1 day')::integer"
    }
    /** The date of its parts, which are in their ranges */
    _makeDate(_context: SqlBuildContext, year: string, month: string, day: string): string {
        return 'make_date(' + year + ', ' + month + ', ' + day + ')'
    }
    /** The nanoseconds of the second of a time, with the digits the database keeps */
    _nanosecondOfSecond(context: SqlBuildContext, valueSource: ToSql): string {
        return '(trunc(extract(microseconds from ' + this._appendSqlForDatePartArgument(valueSource, context) + '))::integer % 1000000 * 1000)'
    }
    /** The time of its parts, which are in their ranges */
    _makeTime(_context: SqlBuildContext, hour: string, minute: string, second: string, nanoseconds: string): string {
        return 'make_time(' + hour + ', ' + minute + ', ' + secondsWithFraction(second, nanoseconds) + ')'
    }
    /** The date and time of its parts, which are in their ranges */
    _makeTimestamp(_context: SqlBuildContext, year: string, month: string, day: string, hour: string, minute: string, second: string, nanoseconds: string): string {
        return 'make_timestamp(' + year + ', ' + month + ', ' + day + ', ' + hour + ', ' + minute + ', ' + secondsWithFraction(second, nanoseconds) + ')'
    }
    _addDurationRejecting(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._appendWithDurationRejecting(context, valueSource, value, typeClass, 1)
    }
    _subtractDurationRejecting(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._appendWithDurationRejecting(context, valueSource, value, typeClass, -1)
    }
    /**
     * A date or a date and time plus a duration rejecting, as an error of the query, a day the month it reaches hasn't
     * (Temporal's overflow 'reject': only the months can reach one): the value plus the duration as always, shifted by
     * the day of the value in that month, checked, minus the day of the value, which is no day. The month reached is
     * year * 12 + month - 1 plus the months of the duration
     */
    _appendWithDurationRejecting(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass, sign: 1 | -1): string {
        const fields = this._temporalFieldsOfDurationOperation(typeClass)
        const result = this._appendWithDuration(context, valueSource, value, typeClass, sign)
        if (fields === 'time' || !this._hasDurationMonths(value, typeClass, fields, sign)) {
            return result
        }
        const monthIndex = '(' + this._integerPart(this._year(context, valueSource)) + ' * 12 + ' + this._integerPart(this._month(context, valueSource)) + ' - 1 + ' + this._durationMonthsSql(context, value, typeClass, fields, sign) + ')'
        const checkedDay = this._validDayOrError(context, this._truncatedDivision(monthIndex, '12'), this._integerRemainder(monthIndex, '12') + ' + 1', this._integerPart(this._day(context, valueSource)))
        return this._shiftDays(context, result, '(' + checkedDay + ' - ' + this._integerPart(this._day(context, valueSource)) + ')', fields)
    }
    /** Whether the duration may have months: a constant with them, or a value source (an interval of days to seconds of Oracle has none) */
    _hasDurationMonths(value: unknown, typeClass: DataTypeClass, fields: 'date' | 'time' | 'timestamp', sign: 1 | -1): boolean {
        const parts = this._constantDurationParts(value, typeClass, fields, sign)
        return parts ? parts.months !== 0 : true
    }
    /** The months of a duration (multiplied by sign), with its years */
    _durationMonthsSql(context: SqlBuildContext, value: unknown, typeClass: DataTypeClass, fields: 'date' | 'time' | 'timestamp', sign: 1 | -1): string {
        const parts = this._constantDurationParts(value, typeClass, fields, sign)
        if (parts) {
            return this._appendValue(parts.months, context, __registeredDataType('int'), false)
        }
        const duration = __asNodeValueSource(value as AnyValueSource)
        if (this._isDurationKeptAsText(duration)) {
            return this._signedDurationTextPart(context, duration, 'M', sign)
        }
        const interval = this._appendSqlParenthesis(duration, context, false)
        return (sign < 0 ? '-' : '') + 'cast(extract(year from ' + interval + ') * 12 + extract(month from ' + interval + ') as integer)'
    }
    /** The day given, that the month of the year has, or an error of the query when it hasn't: the day of a date of them */
    _validDayOrError(_context: SqlBuildContext, year: string, month: string, day: string): string {
        return 'extract(day from make_date(' + year + ', ' + month + ', ' + day + '))::integer'
    }
    /** A date or a date and time plus a number of days */
    _shiftDays(_context: SqlBuildContext, value: string, days: string, fields: 'date' | 'time' | 'timestamp'): string {
        return fields === 'date' ? value + ' + ' + days : value + ' + make_interval(days => ' + days + ')'
    }
    /** What a duration is added to: a date, a time, or a date and time (by the SQL data type of the result) */
    _temporalFieldsOfDurationOperation(typeClass: DataTypeClass): 'date' | 'time' | 'timestamp' {
        return __temporalFieldsOf(typeClass) ?? 'timestamp'
    }
    _until(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, _typeClass: DataTypeClass): string {
        return this._appendDifference(context, valueSource, value, value2, false)
    }
    _since(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, _typeClass: DataTypeClass): string {
        return this._appendDifference(context, valueSource, value, value2, true)
    }
    /**
     * The duration from one date, time or date and time to another, as Temporal's `until` (or `since`: `until` with the
     * rounding mode negated, negated), with its options (see plainTemporalDifferenceOf). Each field of the duration is
     * computed with integers from the parts of both values (see PlainTemporalDifferenceSql), and the duration is made of
     * them (_durationOfDifference). A piece that appears several times is written again each time, in the order of the
     * text: the parameters of MariaDB and MySQL are positional
     */
    _appendDifference(context: SqlBuildContext, valueSource: ToSql, other: ToSql, options: unknown, since: boolean): string {
        return this._durationOfDifference(context, this._differenceSqlOf(valueSource, other, options, since))
    }
    /** The difference to write of two values with the options of until (or since) */
    _differenceSqlOf(valueSource: ToSql, other: ToSql, options: unknown, since: boolean): PlainTemporalDifferenceSql {
        const typeClass = __classOf(valueSource as object)
        const fields = __isPlainYearMonthClass(typeClass) ? 'yearMonth' : __temporalFieldsOf(typeClass) ?? 'timestamp'
        const difference = plainTemporalDifferenceOf(options, fields, since)
        if (!difference) {
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: options, typeName: 'duration' }, 'Invalid options of ' + (since ? 'since' : 'until') + ': ' + JSON.stringify(options))
        }
        if (fields === 'yearMonth') {
            // Counted in months: a year is 12 of them
            const step = (difference.smallestUnit === 'year' ? 12n : 1n) * BigInt(difference.increment)
            return { one: this._temporalOperand(valueSource), two: this._temporalOperand(other), fields, difference, step, tick: 1n, inNanoseconds: false }
        }
        const unit = nanosecondsOfUnit[difference.smallestUnit]
        const step = unit === undefined ? 0n : unit * BigInt(difference.increment)
        const databaseTick = fields === 'date' ? nanosecondsOfUnit['day']! : this._temporalTick()
        const tick = step === 0n || databaseTick % step === 0n || step % databaseTick === 0n ? databaseTick : 1n
        return { one: this._temporalOperand(valueSource), two: this._temporalOperand(other), fields, difference, step, tick, inNanoseconds: tick === 1n && databaseTick !== 1n }
    }
    /**
     * An operand of a computation of dates and times, which writes it several times: a const is written once, and its
     * placeholder repeated (the parameters are numbered), with its type on PostgreSQL (its parts are taken with extract)
     */
    _temporalOperand(operand: ToSql): ToSql {
        if (!this._isConstOperand(operand)) {
            return operand
        }
        return __reusedConstOf(operand as unknown as AnyValueSource, this._typesTemporalConsts()) as unknown as ToSql
    }
    /** Whether a const of a computation of dates and times is written with its type */
    _typesTemporalConsts(): boolean {
        return false
    }
    /**
     * The duration of a difference: its ISO 8601 text (see _durationTextOfDifference), where the database has no type for
     * a duration that keeps its fields; PostgreSQL writes an interval
     */
    _durationOfDifference(context: SqlBuildContext, d: PlainTemporalDifferenceSql): string {
        return this._durationTextOfDifference(context, d)
    }
    /**
     * The duration of a difference as its ISO 8601 text, with the function of the library tsq_duration_text: rounded to
     * the calendar, tsq_duration_round's; otherwise the whole difference written once (see _differenceWhole), the days
     * of a date or the nanoseconds of a time, that the function balances up to the largest unit
     */
    _durationTextOfDifference(context: SqlBuildContext, d: PlainTemporalDifferenceSql): string {
        if (this._differenceIsRoundedToTheCalendar(d)) {
            return this._durationRoundedToTheCalendar(context, d)
        }
        const whole = this._differenceWhole(context, d)
        const unit = "'" + this._differenceBalanceUnit(d) + "'"
        if (d.fields === 'yearMonth') {
            return this._durationTextFunctionName() + '(0, ' + whole + ', 0, 0, 0, ' + unit + ')'
        }
        if (d.fields === 'date') {
            return this._durationTextFunctionName() + '(0, 0, 0, ' + whole + ', 0, ' + unit + ')'
        }
        return this._durationTextFunctionName() + '(0, 0, 0, 0, ' + this._durationTextTimeArgument(this._nanosecondsOfDifference(whole, d)) + ', ' + unit + ')'
    }
    /** The nanoseconds of the time of a difference as the function of the library takes them: as they are */
    _durationTextTimeArgument(nanoseconds: string): string {
        return nanoseconds
    }
    /** The name of the function of the library that writes the ISO 8601 text of a duration of its fields */
    _durationTextFunctionName(): string {
        return 'tsq_duration_text'
    }
    /**
     * The largest unit a difference is balanced up to, as tsq_duration_text takes it: 'week', 'day', 'hour', 'minute' or
     * 'second' (the milliseconds and smaller units are written in the seconds)
     */
    _differenceBalanceUnit(d: PlainTemporalDifferenceSql): string {
        const largest = d.difference.largestUnit
        return largest === 'millisecond' || largest === 'microsecond' || largest === 'nanosecond' ? 'second' : largest
    }
    /** A number of units of the difference (see PlainTemporalDifferenceSql.tick) as nanoseconds */
    _nanosecondsOfDifference(ticks: string, d: PlainTemporalDifferenceSql): string {
        return d.tick === 1n ? ticks : ticks + ' * ' + this._bigintLiteral(d.tick)
    }
    /**
     * Whether a difference is rounded: a step of the calendar, or one that doesn't divide the unit the difference is
     * counted in (see PlainTemporalDifferenceSql.tick), of which the difference is a multiple
     */
    _differenceIsRounded(d: PlainTemporalDifferenceSql): boolean {
        return d.step === 0n || d.tick % d.step !== 0n
    }
    /**
     * Whether a difference is computed by the function of the library tsq_duration_round: in months or years, Temporal
     * counts the whole months from the first value without passing the second one, and no database counts them so;
     * rounded with weeks, months or years, it rounds counting them from the first value, and a rounding of the days that
     * reaches the next one gives it
     */
    _differenceIsRoundedToTheCalendar(d: PlainTemporalDifferenceSql): boolean {
        if (d.fields === 'yearMonth') {
            // Unrounded, its months; rounded only in months (largest and smallest unit), in a mode that isn't half way,
            // its months rounded as integers. Otherwise Temporal rounds with the days from the start of the step to the
            // value and to its end (the length of the months): the function, on the 1st of each month
            const difference = d.difference
            return this._differenceIsRounded(d) && (difference.largestUnit === 'year' || difference.smallestUnit === 'year' || difference.mode.startsWith('half'))
        }
        const largest = unitIndex[d.difference.largestUnit]!
        return largest <= 1 || (largest === 2 && this._differenceIsRounded(d))
    }
    /**
     * The duration of a difference rounded to the calendar, with the function of the library tsq_duration_round: the
     * year, the month, the day and the nanoseconds of the day of each value (a date at 00:00), the units, the increment,
     * the mode of until (since negates it) and the sign of the result (-1 for since)
     */
    _durationRoundedToTheCalendar(context: SqlBuildContext, d: PlainTemporalDifferenceSql): string {
        let result = this._durationRoundFunctionName() + '('
        result += this._differencePartsForFunction(context, d, d.one) + ', '
        result += this._differencePartsForFunction(context, d, d.two) + ', '
        const difference = d.difference
        return result + "'" + difference.largestUnit + "', '" + difference.smallestUnit + "', " + difference.increment + ", '" + difference.mode + "', " + (difference.negated ? '-1' : '1') + ')'
    }
    /** The year, the month, the day and the nanoseconds of the day of a value, as arguments of a function */
    _differencePartsForFunction(context: SqlBuildContext, d: PlainTemporalDifferenceSql, valueSource: ToSql): string {
        const value = this._differenceConstParts(valueSource)
        if (value) {
            // A value given: its parts, computed here, each one a parameter
            const int = __registeredDataType('int')
            let parts = this._appendValue(value.year, context, int, false) + ', ' + this._appendValue(value.month, context, int, false) + ', '
            parts += d.fields === 'yearMonth' ? '1, ' : this._appendValue(value.day, context, int, false) + ', '
            return parts + (d.fields === 'date' || d.fields === 'yearMonth' ? '0' : this._appendValue(value.nanoseconds, context, __registeredDataType('bigint'), false))
        }
        let result = this._integerPart(this._year(context, valueSource)) + ', ' + this._integerPart(this._month(context, valueSource)) + ', '
        // A month of a year is counted from its 1st, as Temporal does
        result += d.fields === 'yearMonth' ? '1, ' : this._integerPart(this._day(context, valueSource)) + ', '
        result += d.fields === 'date' || d.fields === 'yearMonth' ? '0' : this._nanosecondsSinceMidnight(context, valueSource)
        return result
    }
    /**
     * The parts of a value given for a difference computed by a function of the library: of a Temporal date, date and time
     * or month of a year whose time the database keeps whole (no digit below its _temporalTick) and of a year from 1 (a
     * database may count the years before it in its own way); undefined otherwise, written by the database
     */
    _differenceConstParts(valueSource: ToSql): { year: number, month: number, day: number, nanoseconds: bigint } | undefined {
        // A const, also one whose placeholder is repeated (its operation is the one of the const)
        if (!isValueSource(valueSource) || (valueSource as unknown as { __operation?: unknown }).__operation !== '_const') {
            return undefined
        }
        const value = (valueSource as unknown as { __value: unknown }).__value
        const temporal = __temporalIfAvailable()
        if (!temporal || !(value instanceof temporal.PlainDate || value instanceof temporal.PlainDateTime || value instanceof temporal.PlainYearMonth) || value.year < 1) {
            return undefined
        }
        const nanoseconds = value instanceof temporal.PlainDateTime
            ? BigInt(value.hour) * 3600000000000n + BigInt(value.minute) * 60000000000n + BigInt(value.second) * 1000000000n + BigInt(value.millisecond) * 1000000n + BigInt(value.microsecond) * 1000n + BigInt(value.nanosecond)
            : 0n
        if (nanoseconds % this._temporalTick() !== 0n) {
            return undefined
        }
        return { year: value.year, month: value.month, day: value instanceof temporal.PlainYearMonth ? 1 : value.day, nanoseconds }
    }
    /** The name of the function of the library that rounds a difference to the calendar */
    _durationRoundFunctionName(): string {
        return 'tsq_duration_round'
    }
    /**
     * The whole difference of a difference that isn't rounded to the calendar (see _differenceIsRoundedToTheCalendar),
     * in units of d.tick (days for a date): the total, or rounded to multiples of the step in the mode; negated for since
     */
    _differenceWhole(context: SqlBuildContext, d: PlainTemporalDifferenceSql): string {
        const whole = this._differenceIsRounded(d) ? this._differenceRounded(context, d) : this._differenceTotalInTicks(context, d)
        return d.difference.negated ? negatedSql(whole) : whole
    }
    /**
     * The whole difference rounded to multiples of the step in the mode: a division that truncates toward zero of the
     * value moved by the mode, so each mode writes the value once or twice (halfEven, on the magnitude, three times)
     */
    _differenceRounded(context: SqlBuildContext, d: PlainTemporalDifferenceSql): string {
        const stepValue = d.step / d.tick
        const step = this._bigintLiteral(stepValue)
        const twoSteps = this._bigintLiteral(stepValue * 2n)
        const lessOne = this._bigintLiteral(stepValue - 1n)
        const twoLessOne = this._bigintLiteral(stepValue * 2n - 1n)
        let quotient: string
        switch (d.difference.mode) {
            case 'trunc':
                quotient = this._differenceDivision(d, this._differenceTotalInTicks(context, d), step)
                break
            case 'ceil':
                quotient = this._differenceDivision(d, '(' + this._differenceTotalInTicks(context, d) + ' + case when ' + this._differenceTotalInTicks(context, d) + ' > 0 then ' + lessOne + ' else 0 end)', step)
                break
            case 'floor':
                quotient = this._differenceDivision(d, '(' + this._differenceTotalInTicks(context, d) + ' - case when ' + this._differenceTotalInTicks(context, d) + ' < 0 then ' + lessOne + ' else 0 end)', step)
                break
            case 'expand':
                quotient = this._differenceDivision(d, '(' + this._differenceTotalInTicks(context, d) + ' + case when ' + this._differenceTotalInTicks(context, d) + ' < 0 then -' + lessOne + ' else ' + lessOne + ' end)', step)
                break
            case 'halfExpand':
                quotient = this._differenceDivision(d, '(2 * ' + this._differenceTotalInTicks(context, d) + ' + case when ' + this._differenceTotalInTicks(context, d) + ' < 0 then -' + step + ' else ' + step + ' end)', twoSteps)
                break
            case 'halfTrunc':
                quotient = this._differenceDivision(d, '(2 * ' + this._differenceTotalInTicks(context, d) + ' + case when ' + this._differenceTotalInTicks(context, d) + ' < 0 then -' + lessOne + ' else ' + lessOne + ' end)', twoSteps)
                break
            case 'halfCeil':
                // Half way up: the floor of (2 * value + step) / (2 * step)
                quotient = this._differenceDivision(d, '(2 * ' + this._differenceTotalInTicks(context, d) + ' + ' + step + ' - case when 2 * ' + this._differenceTotalInTicks(context, d) + ' + ' + step + ' < 0 then ' + twoLessOne + ' else 0 end)', twoSteps)
                break
            case 'halfFloor':
                // Half way down: the ceiling of (2 * value - step) / (2 * step)
                quotient = this._differenceDivision(d, '(2 * ' + this._differenceTotalInTicks(context, d) + ' - ' + step + ' + case when 2 * ' + this._differenceTotalInTicks(context, d) + ' - ' + step + ' > 0 then ' + twoLessOne + ' else 0 end)', twoSteps)
                break
            case 'halfEven': {
                // On the magnitude: halfExpand of 2 * magnitude + step, less one where that is four steps times something
                // plus two (half way to an odd multiple); with the sign of the value
                if (this._differenceHalfEvenOverTotalOnce()) {
                    // The total is written once, named in a scalar subquery, where it is long (see _differenceHalfEvenOverTotalOnce)
                    const t = 'tsq_r.t'
                    const formula = this._signOf(t) + ' * (' + this._differenceDivision(d, '(2 * abs(' + t + ') + ' + step + ')', twoSteps) + ' - case when ' + this._integerRemainder('(2 * abs(' + t + ') + ' + step + ')', this._bigintLiteral(stepValue * 4n)) + ' = ' + twoSteps + ' then 1 else 0 end) * ' + step
                    return '(select ' + formula + ' from (select ' + this._differenceTotalInTicks(context, d) + ' as t' + this._fromNoTable() + ') tsq_r)'
                }
                const sign = this._signOf(this._differenceTotalInTicks(context, d))
                const moved = '(2 * abs(' + this._differenceTotalInTicks(context, d) + ') + ' + step + ')'
                const movedAgain = '(2 * abs(' + this._differenceTotalInTicks(context, d) + ') + ' + step + ')'
                return '(' + sign + ' * (' + this._differenceDivision(d, moved, twoSteps) + ' - case when ' + this._integerRemainder(movedAgain, this._bigintLiteral(stepValue * 4n)) + ' = ' + twoSteps + ' then 1 else 0 end) * ' + step + ')'
            }
        }
        return '(' + quotient + ' * ' + step + ')'
    }
    /**
     * Whether halfEven, which writes the total of a difference four times, writes it once, named in a scalar subquery: on a
     * database whose total is long and whose derived table sees the columns of the query around it (Oracle, SQL Server)
     */
    _differenceHalfEvenOverTotalOnce(): boolean {
        return false
    }
    /** The sign of a number: -1, 0 or 1 */
    _signOf(value: string): string {
        return 'sign(' + value + ')'
    }
    /** The date of a value of a difference: the value of a date, the date of a date and time */
    _differenceDateOf(context: SqlBuildContext, d: PlainTemporalDifferenceSql, valueSource: ToSql): string {
        return d.fields === 'date' ? this._appendSql(valueSource, context, false) : this._dateOfValue(context, valueSource)
    }
    /** The days from the date of the first value to the one of the second */
    _differenceDays(context: SqlBuildContext, d: PlainTemporalDifferenceSql): string {
        return this._daysBetween(context, this._differenceDateOf(context, d, d.two), this._differenceDateOf(context, d, d.one))
    }
    /**
     * The whole difference in units of d.tick: the total of the database (see _differenceTotal), in nanoseconds for a
     * step that isn't a multiple of the unit of the database
     */
    _differenceTotalInTicks(context: SqlBuildContext, d: PlainTemporalDifferenceSql): string {
        const total = this._differenceTotal(context, d)
        return d.inNanoseconds ? this._nanosecondsOfDatabaseTicks(total, this._temporalTick()) : total
    }
    /**
     * A whole difference in the smallest unit the database keeps as nanoseconds, to round it to a step that isn't a
     * multiple of that unit (a step of Temporal divides the next unit: only SQL Server, of 100 nanoseconds, has one)
     */
    _nanosecondsOfDatabaseTicks(ticks: string, tick: bigint): string {
        return '(' + ticks + ' * ' + this._bigintLiteral(tick) + ')'
    }
    /** An integer division that truncates toward zero of the whole difference (see _nanosecondsOfDatabaseTicks) */
    _differenceDivision(_d: PlainTemporalDifferenceSql, dividend: string, divisor: string): string {
        return this._truncatedDivision(dividend, divisor)
    }
    /**
     * The whole difference: in days for a date, otherwise in the smallest unit of time the database keeps (see
     * _temporalTick): the days of the dates and the time of the day of each value
     */
    _differenceTotal(context: SqlBuildContext, d: PlainTemporalDifferenceSql): string {
        switch (d.fields) {
            case 'date':
                return this._differenceDays(context, d)
            case 'yearMonth':
                return this._differenceMonths(context, d)
            case 'time':
                return this._differenceTime(context, d)
            default:
                return '(' + this._differenceDays(context, d) + ' * ' + this._bigintLiteral(nanosecondsOfUnit['day']! / this._temporalTick()) + ' + ' + this._differenceTime(context, d) + ')'
        }
    }
    /** The months from the month of the year of the first value to the one of the second */
    _differenceMonths(context: SqlBuildContext, d: PlainTemporalDifferenceSql): string {
        const two = this._integerPart(this._year(context, d.two)) + ' * 12 + ' + this._integerPart(this._month(context, d.two))
        const one = this._integerPart(this._year(context, d.one)) + ' * 12 + ' + this._integerPart(this._month(context, d.one))
        return '(' + two + ' - (' + one + '))'
    }
    /** The time from the time of the day of the first value to the one of the second, in the unit of the database */
    _differenceTime(context: SqlBuildContext, d: PlainTemporalDifferenceSql): string {
        return '(' + this._ticksSinceMidnight(context, d.two) + ' - ' + this._ticksSinceMidnight(context, d.one) + ')'
    }
    /** The days from one date to another; the dates appear in the SQL in this order (to, from) where the order matters */
    _daysBetween(_context: SqlBuildContext, to: string, from: string): string {
        return '(' + to + ' - ' + from + ')'
    }
    /** A date plus a number of days */
    _addDaysToDate(_context: SqlBuildContext, date: string, days: string): string {
        return '(' + date + ' + ' + days + ')'
    }
    /** An integer computed from bigints, as the integer the database takes where it needs one (PostgreSQL's make_interval) */
    _integerOfBigint(sql: string): string {
        return sql
    }
    /**
     * The parts of a duration given as a value (a Temporal.Duration or its fields), multiplied by sign, as Temporal adds
     * it to a value of those fields; undefined for a value source, whose parts the SQL reads
     */
    _constantDurationParts(value: unknown, typeClass: DataTypeClass, fields: 'date' | 'time' | 'timestamp', sign: 1 | -1): DurationParts | undefined {
        if (isValueSource(value)) {
            return undefined
        }
        const duration = durationOfArgument(value, typeClass.type)
        if (!duration) {
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: 'duration' }, 'Invalid duration to add or subtract: ' + String(value))
        }
        return durationPartsFor(duration, fields, sign)
    }
    /** Whether the database keeps a duration in an interval of its own (PostgreSQL, Oracle) */
    _supportNativeDurations(): boolean {
        return true
    }
    /** Whether a duration value source is kept as its ISO 8601 text: on a database without intervals, or a text column */
    _isDurationKeptAsText(valueSource: ToSql): boolean {
        if (!this._supportNativeDurations()) {
            return true
        }
        if (__isDurationSum(valueSource)) {
            return this._isDurationSumKeptAsText()
        }
        // A duration computed from another one (negated, abs) is kept as that one
        const from = __durationComputedFrom(valueSource)
        if (from) {
            return this._isDurationKeptAsText(from)
        }
        return __durationSqlDataTypeOf(__sqlDataTypeOf(__classOf(valueSource as object)), __classOf(valueSource as object))?.family === 'character string'
    }
    /**
     * A part of the ISO 8601 text of a duration, with the function of the library tsq_duration_part: 'M' the months
     * (its years too), 'D' the days (its weeks too), 'S' the whole seconds of its time, 'N' the nanoseconds of the
     * second; each with the sign of the duration
     */
    _durationTextPart(context: SqlBuildContext, valueSource: ToSql, part: 'M' | 'D' | 'S' | 'N' | 'sign' | 'largest' | 'years' | 'months' | 'weeks' | 'days' | 'hours' | 'minutes' | 'seconds'): string {
        return this._durationPartFunctionName() + '(' + this._appendSql(valueSource, context, false) + ", '" + part + "')"
    }
    /**
     * A field of a duration as Temporal reads the duration kept: of its ISO 8601 text, the field as written (with
     * tsq_duration_part), the milliseconds, microseconds and nanoseconds of its fraction; of an interval, its fields
     */
    _durationField(context: SqlBuildContext, operand: ToSql, value: any, _typeClass: DataTypeClass): string {
        const valueSource = this._temporalOperand(operand)
        const field = value as DurationField
        if (!this._isDurationKeptAsText(valueSource)) {
            return this._intervalField(context, valueSource, field)
        }
        switch (field) {
            case 'milliseconds':
                return '(' + this._truncatedDivision(this._durationTextPart(context, valueSource, 'N'), '1000000') + ')'
            case 'microseconds':
                return '(' + this._integerRemainder(this._truncatedDivision(this._durationTextPart(context, valueSource, 'N'), '1000'), '1000') + ')'
            case 'nanoseconds':
                return '(' + this._integerRemainder(this._durationTextPart(context, valueSource, 'N'), '1000') + ')'
            default:
                return this._durationTextPart(context, valueSource, field)
        }
    }
    /**
     * A field of an interval of PostgreSQL, as the duration read of it: it keeps months (the years of Temporal are its
     * months / 12), days and a time in microseconds, and no weeks nor nanoseconds (zero, null for a null interval)
     */
    _intervalField(context: SqlBuildContext, valueSource: ToSql, field: DurationField): string {
        const interval = this._appendSqlParenthesis(valueSource, context, false)
        switch (field) {
            case 'years':
            case 'months':
            case 'days':
            case 'hours':
            case 'minutes':
                return 'cast(extract(' + field.slice(0, -1) + ' from ' + interval + ') as integer)'
            case 'seconds':
                return 'cast(trunc(extract(second from ' + interval + ')) as integer)'
            case 'milliseconds':
                return '(cast(trunc(extract(microseconds from ' + interval + ')) as integer) / 1000 % 1000)'
            case 'microseconds':
                return '(cast(trunc(extract(microseconds from ' + interval + ')) as integer) % 1000)'
            default:
                return 'case when ' + interval + ' is not null then 0 end'
        }
    }
    _durationSign(context: SqlBuildContext, operand: ToSql): string {
        const valueSource = this._temporalOperand(operand)
        if (this._isDurationKeptAsText(valueSource)) {
            return this._durationTextPart(context, valueSource, 'sign')
        }
        // An interval whose fields have one sign: the sign of its seconds
        return 'cast(sign(extract(epoch from ' + this._appendSqlParenthesis(valueSource, context, false) + ')) as integer)'
    }
    _durationNegated(context: SqlBuildContext, operand: ToSql): string {
        const valueSource = this._temporalOperand(operand)
        if (!this._isDurationKeptAsText(valueSource)) {
            return negatedSql(this._appendSqlParenthesis(valueSource, context, false))
        }
        // The text without its sign, or with a minus; a duration of zero as it is (Temporal writes it without sign)
        let result = 'case when ' + this._textFirstCharacter(this._appendSql(valueSource, context, false)) + " = '-' then " + this._textFromSecondCharacter(this._appendSql(valueSource, context, false))
        result += ' when ' + this._durationTextPart(context, valueSource, 'sign') + ' = 0 then ' + this._appendSql(valueSource, context, false)
        result += ' when ' + this._textFirstCharacter(this._appendSql(valueSource, context, false)) + " = '+' then " + this._textWithMinus(this._textFromSecondCharacter(this._appendSql(valueSource, context, false)))
        return result + ' else ' + this._textWithMinus(this._appendSql(valueSource, context, false)) + ' end'
    }
    _durationAbs(context: SqlBuildContext, operand: ToSql): string {
        const valueSource = this._temporalOperand(operand)
        if (!this._isDurationKeptAsText(valueSource)) {
            const interval = this._appendSqlParenthesis(valueSource, context, false)
            return 'case when ' + interval + " < interval '0' then " + negatedSql(interval) + ' else ' + interval + ' end'
        }
        let result = 'case when ' + this._textFirstCharacter(this._appendSql(valueSource, context, false)) + " in ('-', '+') then " + this._textFromSecondCharacter(this._appendSql(valueSource, context, false))
        return result + ' else ' + this._appendSql(valueSource, context, false) + ' end'
    }
    /**
     * The duration in a unit, as Temporal's `total`, with the function of the library tsq_duration_total: the months
     * (its years too), the weeks, the days, the whole seconds of the time and the nanoseconds of the second of the
     * duration, the year, the month and the day of the date of reference (0, 0, 0 without one), and the unit. The
     * function computes it with integers, the double rounded once as Temporal's, and fails without a date of reference
     * for a duration with years, months or weeks, as Temporal
     */
    _durationTotal(context: SqlBuildContext, operand: ToSql, value: any, value2: any, _typeClass: DataTypeClass): string {
        const total = { unit: value2 as DurationTotalUnit, relativeTo: value as DurationTotalDate | ToSql | undefined }
        let result = this._durationTotalFunctionName() + '(' + this._durationPartsForTotal(context, this._temporalOperand(operand)) + ', '
        const relativeTo = total.relativeTo
        if (relativeTo === undefined) {
            result += '0, 0, 0'
        } else if (isValueSource(relativeTo)) {
            const date = this._temporalOperand(relativeTo as ToSql)
            result += this._integerPart(this._year(context, date)) + ', ' + this._integerPart(this._month(context, date)) + ', ' + this._integerPart(this._day(context, date))
        } else {
            // The parts of a Temporal value, integers
            const date = relativeTo as DurationTotalDate
            result += String(date.year) + ', ' + String(date.month) + ', ' + String(date.day)
        }
        return result + ", '" + total.unit + "')"
    }
    /**
     * The months, the weeks, the days, the whole seconds and the nanoseconds of a duration, as the arguments of
     * tsq_duration_total: of its ISO 8601 text, with tsq_duration_part; of an interval of PostgreSQL, its fields
     */
    _durationPartsForTotal(context: SqlBuildContext, valueSource: ToSql): string {
        const operation = isValueSource(valueSource) ? (__asNodeValueSource(valueSource) as Partial<SqlOperation2ValueSource>) : undefined
        if (operation && (operation.__operation === '_until' || operation.__operation === '_since')) {
            const d = this._differenceSqlOf(operation.__valueSource as unknown as ToSql, operation.__value, operation.__value2, operation.__operation === '_since')
            if (!this._differenceIsRoundedToTheCalendar(d)) {
                // A difference gives its fields, not the duration made of them: its weeks when they are its largest
                // unit (a duration with weeks needs a date of reference), and the rest as days (of a date) or as its time
                if (d.fields === 'yearMonth') {
                    return this._differenceWhole(context, d) + ', 0, 0, 0, 0'
                }
                if (d.difference.largestUnit !== 'week') {
                    return d.fields === 'date' ? '0, 0, ' + this._differenceWhole(context, d) + ', 0, 0' : '0, 0, 0, ' + this._differenceTimeForTotal(context, d, false)
                }
                const week = this._bigintLiteral(7n * nanosecondsOfUnit['day']! / d.tick)
                const weeks = this._differenceDivision(d, this._differenceWhole(context, d), week)
                return '0, ' + weeks + ', ' + (d.fields === 'date' ? '(' + this._integerRemainder(this._differenceWhole(context, d), week) + '), 0, 0' : '0, ' + this._differenceTimeForTotal(context, d, true))
            }
        }
        if (this._isDurationKeptAsText(valueSource)) {
            return this._durationTextPart(context, valueSource, 'M') + ', ' + this._durationTextPart(context, valueSource, 'weeks') + ', ' + this._durationTextPart(context, valueSource, 'days') + ', '
                + this._durationTextPart(context, valueSource, 'S') + ', ' + this._durationTextPart(context, valueSource, 'N')
        }
        const interval = this._appendSqlParenthesis(valueSource, context, false)
        let result = 'cast(extract(year from ' + interval + ') * 12 + extract(month from ' + interval + ') as bigint), 0, cast(extract(day from ' + interval + ') as bigint), '
        result += 'cast(extract(hour from ' + interval + ') * 3600 + extract(minute from ' + interval + ') * 60 + trunc(extract(second from ' + interval + ')) as bigint), '
        return result + 'cast(extract(microseconds from ' + interval + ') as bigint) % 1000000 * 1000'
    }
    /**
     * The time of a difference as the whole seconds and the nanoseconds tsq_duration_total takes: of a time, its
     * nanoseconds; of a date and time, its seconds and the nanoseconds of the last one. Without its weeks when they are
     * given apart (afterWeeks)
     */
    _differenceTimeForTotal(context: SqlBuildContext, d: PlainTemporalDifferenceSql, afterWeeks: boolean): string {
        if (d.fields === 'time') {
            return '0, ' + this._nanosecondsOfDifference(this._differenceTimeOfTotal(context, d, afterWeeks), d)
        }
        const second = this._bigintLiteral(nanosecondsOfUnit['second']! / d.tick)
        const seconds = this._differenceDivision(d, this._differenceTimeOfTotal(context, d, afterWeeks), second)
        // The nanoseconds of less than a second: a bigint
        const nanoseconds = '(' + this._integerRemainder(this._differenceTimeOfTotal(context, d, afterWeeks), second) + ')'
        return seconds + ', ' + (d.tick === 1n ? nanoseconds : nanoseconds + ' * ' + this._bigintLiteral(d.tick))
    }
    /** The whole difference in units of d.tick, without its weeks when they are given apart (afterWeeks) */
    _differenceTimeOfTotal(context: SqlBuildContext, d: PlainTemporalDifferenceSql, afterWeeks: boolean): string {
        if (!afterWeeks) {
            return this._differenceWhole(context, d)
        }
        return '(' + this._integerRemainder(this._differenceWhole(context, d), this._bigintLiteral(7n * nanosecondsOfUnit['day']! / d.tick)) + ')'
    }
    /**
     * A duration plus or minus another one (sign), as Temporal's add and subtract, with the function of the library
     * tsq_duration_add: the largest field that isn't zero, the days, the whole seconds and the nanoseconds of each one
     * (see _durationPartsForSum), and the sign. Where the database has intervals the sum is one (PostgreSQL), or its ISO
     * 8601 text (see _isDurationSumKeptAsText)
     */
    _durationAdd(context: SqlBuildContext, operand: ToSql, value: any, _typeClass: DataTypeClass): string {
        return this._appendDurationSum(context, operand, value, 1)
    }
    _durationSubtract(context: SqlBuildContext, operand: ToSql, value: any, _typeClass: DataTypeClass): string {
        return this._appendDurationSum(context, operand, value, -1)
    }
    _appendDurationSum(context: SqlBuildContext, operand: ToSql, value: any, sign: 1 | -1): string {
        let result = this._durationAddFunctionName() + '(' + this._durationPartsForSum(context, this._temporalOperand(operand)) + ', '
        if (isValueSource(value)) {
            result += this._durationPartsForSum(context, this._temporalOperand(value as unknown as ToSql))
        } else {
            const duration = durationOfArgument(value, 'duration')
            if (!duration) {
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: 'duration' }, 'Invalid duration to add or subtract: ' + String(value))
            }
            // The parts of a Temporal value, integers
            const time = ((((BigInt(duration.hours) * 60n + BigInt(duration.minutes)) * 60n + BigInt(duration.seconds)) * 1000n + BigInt(duration.milliseconds)) * 1000n + BigInt(duration.microseconds)) * 1000n + BigInt(duration.nanoseconds)
            result += String(largestFieldOf(duration)) + ', ' + String(duration.days) + ', ' + String(time / 1_000_000_000n) + ', ' + String(time % 1_000_000_000n)
        }
        return result + ', ' + sign + ')'
    }
    /**
     * The largest field that isn't zero, the days, the whole seconds of the time and the nanoseconds of the second of a
     * duration, as the arguments of tsq_duration_add: of its ISO 8601 text, with tsq_duration_part; of an interval of
     * PostgreSQL, its fields (its months are its years and months, it has no weeks)
     */
    _durationPartsForSum(context: SqlBuildContext, valueSource: ToSql): string {
        if (this._isDurationKeptAsText(valueSource)) {
            return this._durationTextPart(context, valueSource, 'largest') + ', ' + this._durationTextPart(context, valueSource, 'days') + ', ' + this._durationTextPart(context, valueSource, 'S') + ', ' + this._durationTextPart(context, valueSource, 'N')
        }
        const interval = this._appendSqlParenthesis(valueSource, context, false)
        const fraction = 'abs(cast(extract(microseconds from ' + interval + ') as bigint) % 1000000)'
        let result = 'case when extract(year from ' + interval + ') <> 0 or extract(month from ' + interval + ') <> 0 then 1 when extract(day from ' + interval + ') <> 0 then 3 when extract(hour from ' + interval + ') <> 0 then 4 when extract(minute from ' + interval + ') <> 0 then 5'
        result += ' when trunc(extract(second from ' + interval + ')) <> 0 then 6 when ' + fraction + ' >= 1000 then 7 when ' + fraction + ' <> 0 then 8 else 10 end, '
        result += 'cast(extract(day from ' + interval + ') as bigint), cast(extract(hour from ' + interval + ') * 3600 + extract(minute from ' + interval + ') * 60 + trunc(extract(second from ' + interval + ')) as bigint), '
        return result + 'cast(extract(microseconds from ' + interval + ') as bigint) % 1000000 * 1000'
    }
    /** Whether a duration plus or minus another one is the ISO 8601 text of the sum, where the database has intervals */
    _isDurationSumKeptAsText(): boolean {
        return false
    }
    /** The name of the function of the library that adds and subtracts durations */
    _durationAddFunctionName(): string {
        return 'tsq_duration_add'
    }
    /** The name of the function of the library that gives the total of a duration */
    _durationTotalFunctionName(): string {
        return 'tsq_duration_total'
    }
    /** The first character of a text */
    _textFirstCharacter(text: string): string {
        return 'substr(' + text + ', 1, 1)'
    }
    /** A text from its second character */
    _textFromSecondCharacter(text: string): string {
        return 'substr(' + text + ', 2)'
    }
    /** A minus followed by a text */
    _textWithMinus(text: string): string {
        return "'-' || " + text
    }
    /** The name of the function of the library that reads a part of the ISO 8601 text of a duration */
    _durationPartFunctionName(): string {
        return 'tsq_duration_part'
    }
    /** Whether the database supports a databaseTimeZone other than UTC, completing the zone of a value with its session */
    _supportDatabaseOutsideUtc(): boolean {
        return false
    }
    /** Whether the connection declares a databaseTimeZone other than UTC */
    _isDatabaseOutsideUtc(): boolean {
        const zone = this._connectionConfiguration.databaseTimeZone
        return zone !== undefined && !isUtcTimeZoneName(zone)
    }
    /** Rejects, for each query executed, a configuration of the connection this database can't honor */
    _checkConnectionConfiguration(): void {
        dayOfStoredYearMonthsOf(this._connectionConfiguration.dayOfStoredYearMonths)
        yearOfStoredMonthDaysOf(this._connectionConfiguration.yearOfStoredMonthDays)
        dateOfStoredTimesOf(this._connectionConfiguration.dateOfStoredTimes)
        if (!this._isDatabaseOutsideUtc()) {
            return
        }
        const zone = this._connectionConfiguration.databaseTimeZone
        if (!this._supportDatabaseOutsideUtc()) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'databaseTimeZone', value: zone }, 'A databaseTimeZone other than UTC is not supported on this database (' + zone + '): it can\'t complete the zone of a value without zone for every date (see the known limits of the time zones in the documentation)')
        }
        const referenceDate = this._connectionConfiguration.dateToConvertTimesBetweenZones
        if (referenceDate !== undefined && referenceDate !== 'today' && !/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'dateToConvertTimesBetweenZones', value: referenceDate }, "dateToConvertTimesBetweenZones must be a date 'YYYY-MM-DD' or 'today': " + referenceDate)
        }
    }
    _appendSqlForDatePartArgument(valueSource: ToSql, context: SqlBuildContext): string {
        // A const receiver is forced to carry its type cast: an untyped placeholder inside
        // `extract(... from $1)` has no type for the engine to resolve.
        if (isValueSource(valueSource) && __asNodeValueSource(valueSource).isConstValue()) {
            return this._appendSql(this._typedOperand(valueSource, []), context, true)
        }
        return this._appendSql(valueSource, context, false)
    }
    _asString(context: SqlBuildContext, valueSource: ToSql): string {
        // Transform an uuid to string
        return this._appendSqlParenthesis(valueSource, context, false)
    }
    _asNullValue(context: SqlBuildContext, typeClass: DataTypeClass): string {
        // The literal null is not a parameter
        const adapterContext = this._typeAdapterContextOf(context)
        adapterContext.prepareParam(undefined, undefined, false, typeClass, __sqlDataTypeOf(typeClass))
        adapterContext.valueSentToDB = null
        let result
        result = this._nextTypeAdapter.transformPlaceholder('null', adapterContext)
        adapterContext.clearParam()
        return result
    }
    // Oracle recursive
    _prior(context: SqlBuildContext, valueSource: ToSql): string {
        return 'prior ' + this._appendSql(valueSource, context, false)
    }
    // SqlFunction1
    _valueWhenNull(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return 'coalesce(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, __valueOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value)) + ')'
    }
    _nullIfValue(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return 'nullif(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, __valueOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value)) + ')'
    }
    _and(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        context.resultingOperation = undefined
        const sql = this._appendConditionSql(valueSource, context, false)
        const op = context.resultingOperation
        context.resultingOperation = undefined
        // With nothing on the left the value stands alone, and in a select it needs its type as any other value
        const sql2 = this._appendConditionValue(value, context, typeClass, !sql)
        const op2 = context.resultingOperation
        context.resultingOperation = undefined
        if (!sql || sql === this._trueValueForCondition) {
            // sql === this._trueValueForCondition reduce unnecesary ands allowing dynamic queries
            context.resultingOperation = op2
            return sql2
        } else if (!sql2 || sql2 === this._trueValueForCondition) {
            // sql2 === this._trueValueForCondition reduce unnecesary ands allowing dynamic queries
            context.resultingOperation = op
            return sql
        } else {
            let result
            if (op === '_or') {
                result = '(' + sql + ')'
            } else {
                result = sql
            }
            result += ' and '
            if (op2 === '_or') {
                result += '(' + sql2 + ')'
            } else {
                result += sql2
            }
            context.resultingOperation = '_and'
            return result
        }
    }
    _or(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        context.resultingOperation = undefined
        const sql = this._appendConditionSql(valueSource, context, false)
        const op = context.resultingOperation
        context.resultingOperation = undefined
        // With nothing on the left the value stands alone, and in a select it needs its type as any other value
        const sql2 = this._appendConditionValue(value, context, typeClass, !sql)
        const op2 = context.resultingOperation
        context.resultingOperation = undefined
        if (!sql || sql === this._falseValueForCondition) {
            // !sql || sql === this._falseValueForCondition reduce unnecesary ors allowing dynamic queries
            context.resultingOperation = op2
            return sql2
        } else if (!sql2 || sql2 === this._falseValueForCondition) {
            // !sql2 || sql2 === this._falseValueForCondition reduce unnecesary ors allowing dynamic queries
            context.resultingOperation = op
            return sql
        } else {
            let result
            if (op === '_and') {
                result = '(' + sql + ')'
            } else {
                result = sql
            }
            result += ' or '
            if (op2 === '_and') {
                result += '(' + sql2 + ')'
            } else {
                result += sql2
            }
            context.resultingOperation = '_or'
            return result
        }
    }
    _concat(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._concatSql(
            this._appendSqlParenthesisExcluding(valueSource, context, '_concat', false),
            this._appendValueParenthesisExcluding(value, context, typeClass, '_concat', false)
        )
    }
    /**
     * `concatIgnoringNull`: a NULL operand counts as the empty string. A separate operation from
     * `_concat`, with its own semantics and its own spelling per dialect. An operand already NULL
     * at build time is dropped; one that may be NULL is neutralised; one that cannot costs nothing.
     * A chain needs no walking here — the append excludes this operation from parenthesis, so the
     * inner node renders through this method again and stays flat.
     *
     * What is emitted here — `coalesce(x, '') || …` — needs no compatibility gate: `||` and
     * `coalesce` are available on every version of both engines. It is preferred over the native
     * NULL-ignoring `concat(x, …)`, which PostgreSQL has and SQLite only from 3.44, because
     * `coalesce` is no function call on either engine (a `CoalesceExpr` node / a `NotNull` jump,
     * both short-circuiting) while `concat` is one, and because PostgreSQL declares `concat`
     * STABLE, which bars it from an expression index or a generated column.
     */
    _concatIgnoringNull(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._isNullValue(value)) {
            if (this._isNullValue(valueSource)) {
                // Nothing left to concatenate: the empty string is what the operation answers.
                return "''"
            }
            return this._appendSqlParenthesisExcluding(valueSource, context, '_concatIgnoringNull', false)
        }
        if (this._isNullValue(valueSource)) {
            return this._appendValueParenthesisExcluding(value, context, typeClass, '_concatIgnoringNull', false)
        }
        return this._appendConcatIgnoringNull(context, valueSource, value, typeClass)
    }
    /**
     * Glues two operands that both survived the build-time NULL check above — the only part of
     * `concatIgnoringNull` a dialect changes. This base form is PostgreSQL's and SQLite's: `||`
     * propagates NULL, so each operand that may carry one is neutralised first.
     *
     * What is emitted needs no compatibility gate: `||` and `coalesce` are available on every
     * version of both engines. It is preferred over the native NULL-ignoring `concat(x, …)`, which
     * PostgreSQL has and SQLite only from 3.44, because `coalesce` is no function call on either
     * engine (a `CoalesceExpr` node / a `NotNull` jump, both short-circuiting) while `concat` is
     * one, and because PostgreSQL declares `concat` STABLE, which bars it from an expression index
     * or a generated column.
     */
    _appendConcatIgnoringNull(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        let left = this._appendSqlParenthesisExcluding(valueSource, context, '_concatIgnoringNull', false)
        if (this._isOptionalValue(valueSource)) {
            left = "coalesce(" + left + ", '')"
        }
        let right = this._appendValueParenthesisExcluding(value, context, typeClass, '_concatIgnoringNull', false)
        if (this._isOptionalValue(value)) {
            right = "coalesce(" + right + ", '')"
        }
        return left + ' || ' + right
    }
    // The substr/substring family. These mirror the two JavaScript methods of the same
    // names, which differ ONLY in how they treat a negative index:
    //   'abcdef'.substr(-2)    === 'ef'       (counts from the end)
    //   'abcdef'.substring(-2) === 'abcdef'   (clamps the index to 0)
    // The `+ 1` below converts JS's 0-based index to SQL's 1-based one. It is correct for a
    // NON-NEGATIVE index only: for a negative one JS and SQL already agree on the meaning,
    // so adding 1 shifts the answer by a character. Each negative case is therefore resolved
    // HERE, at build time, where the sign of a literal is known and the emitted SQL stays as
    // clean as the common path's.
    //
    // This family is written in SQLite's form, and SQLite is the dialect that reaches it —
    // every other dialect overrides the negative arms with its own idiom.
    //
    // A value-source index cannot be resolved at build time (the sign is unknown until the
    // query runs) and keeps the `+ 1`: see LIMITATIONS.md.
    _substrToEnd(context: SqlBuildContext, valueSource: ToSql, value: any, _typeClass: DataTypeClass): string {
        if (typeof value === 'number') {
            if (value < 0) {
                // SQLite counts a negative start from the end and clamps an out-of-range one
                // to the whole string, which is exactly `String.prototype.substr`.
                return 'substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, __registeredDataType('int'), false) + ')'
            }
            return 'substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value + 1, context, __registeredDataType('int'), false) + ')'
        } else {
            return 'substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValueParenthesis(value, context, __registeredDataType('int'), false) + ' + 1)'
        }
    }
    _substringToEnd(context: SqlBuildContext, valueSource: ToSql, value: any, _typeClass: DataTypeClass): string {
        if (typeof value === 'number') {
            // `String.prototype.substring` clamps a negative index to 0 — unlike `substr`,
            // it never counts from the end — so the clamp is applied before the `+ 1` and
            // the emitted SQL is the same one a 0 would have produced.
            const start = value < 0 ? 0 : value
            return 'substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(start + 1, context, __registeredDataType('int'), false) + ')'
        } else {
            return 'substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValueParenthesis(value, context, __registeredDataType('int'), false) + ' + 1)'
        }
    }
    /**
     * Whether a value given to an operation needs its type written in the SQL: the class of the data type of the
     * operation says it is an integer and the value is sent as a floating point number (a fraction compared with an
     * int, see the operand classes of the data types). PostgreSQL resolves a bare `$n` from the operator around it
     * (`int4 = $n` pins `$n` to int4) and refuses the fraction before it sees the value; only PostgreSQL acts on
     * `forceTypeCast`, so every other dialect writes the same SQL
     */
    _operandNeedsTypeCast(typeClass: DataTypeClass, value: any): boolean {
        return this._operandClassNeedsTypeCast(typeClass, __valueOperandClassOf(typeClass, value))
    }
    /** Whether a value of the class given, in an operation of the data type of typeClass, needs its type written: see _operandNeedsTypeCast */
    _operandClassNeedsTypeCast(typeClass: DataTypeClass, operandClass: DataTypeClass): boolean {
        return operandClass !== typeClass && __isIntegerSql(typeClass) && __sqlFamilyOf(operandClass) === 'approximate numeric'
    }
    _moduloRequiresFloatHandling(typeClass: DataTypeClass, value: any): boolean {
        // `_modulo` only receives the receiver's column type, but the
        // overloaded-number dispatcher promotes the result to `double` whenever
        // either operand is a floating-point value (a `double` or `RealsType`
        // receiver, or an `int` receiver modulo'd by a `double` or `RealsType`
        // operand or a fractional literal). Detect that here so the dialects whose
        // `%` operator rejects floating-point operands (PostgreSQL, SQL Server) can
        // switch to their numeric form regardless of which side is the double.
        // Pure integer / bigint operands keep the plain `%` form (those engines
        // accept it).
        if (__sqlFamilyOf(typeClass) === 'approximate numeric') {
            return true
        }
        if (isValueSource(value)) {
            return __sqlFamilyOf(__classOf(__asNodeValueSource(value))) === 'approximate numeric'
        }
        return typeof value === 'number' && !Number.isInteger(value)
    }
    _power(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return 'power(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, __arithmeticOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value)) + ')'
    }
    _logn(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        // The public API `value.logn(n)` means log base n of value, i.e. `log_n(value)`.
        // PostgreSQL, MariaDB, MySQL, SQLite and Oracle all spell this as `LOG(base, value)`
        // — base first. SQL Server's LOG is `LOG(value, base)` and overrides this method.
        return 'log(' + this._appendValue(value, context, __arithmeticOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value)) + ', ' + this._appendSql(valueSource, context, false) + ')'
    }
    _roundn(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return 'round(' + this._appendSql(valueSource, context, false) + ', ' + this._appendRoundnScale(value, context, typeClass) + ')'
    }
    /**
     * The scale of roundn is a whole number of decimals, which TypeScript can't express: a number whose value sent to
     * the database (after the type adapter, which can scale it) is fractional is sent rounded, ties away from zero (the
     * rule of round), as an int, so every database receives the same scale. Anything else is kept, and everything with
     * usePlatformDependentRound
     */
    _roundnScale(value: any, typeClass: DataTypeClass): { value: any, typeClass: DataTypeClass } {
        const argumentClass = __arithmeticOperandClassOf(typeClass, value)
        if (typeof value === 'number' && !this._connectionConfiguration.usePlatformDependentRound) {
            const sent = this._transformParamToDB(value, argumentClass)
            if (typeof sent === 'number' && Number.isFinite(sent) && !Number.isInteger(sent)) {
                return { value: Math.sign(sent) * Math.round(Math.abs(sent)), typeClass: __registeredDataType('int') }
            }
        }
        return { value, typeClass: argumentClass }
    }
    /**
     * The database truncates a fractional scale of round (SQLite, SQL Server, Oracle) instead of rounding it as the
     * other databases do: a scale that is a value source and isn't an integer is written rounded
     */
    _roundnTruncatesTheScale = false
    /** The SQL that rounds an expression to an integer, for the scale of roundn */
    _appendRoundToInteger(sql: string): string {
        return 'round(' + sql + ')'
    }
    /** The operand is an integer as sent to the database: a number, a constant or a value source of an integer type */
    _isIntegerOperand(value: any, typeClass: DataTypeClass): boolean {
        // As sent to the database: a type adapter can turn a fractional number into an integer one
        if (typeof value === 'number') {
            return Number.isInteger(this._transformParamToDB(value, typeClass))
        }
        if (isValueSource(value)) {
            const nodeValue = __asNodeValueSource(value)
            if (nodeValue.isConstValue()) {
                return Number.isInteger(this._transformParamToDB(nodeValue.getConstValue(), __classOf(nodeValue)))
            }
            return __isIntegerSql(__classOf(nodeValue))
        }
        return false
    }
    /** The scale of roundn: a fractional number is rounded, and a value source that isn't an integer where the database truncates it */
    _appendRoundnScale(value: any, context: SqlBuildContext, typeClass: DataTypeClass): string {
        const scale = this._roundnScale(value, typeClass)
        const sql = this._appendValue(scale.value, context, scale.typeClass, false)
        if (this._roundnTruncatesTheScale && !this._connectionConfiguration.usePlatformDependentRound && isValueSource(scale.value) && !this._isIntegerOperand(scale.value, scale.typeClass)) {
            return this._appendRoundToInteger(sql)
        }
        return sql
    }
    _minimumBetweenTwoValues(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return 'least(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, __arithmeticOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value)) + ')'
    }
    _maximumBetweenTwoValues(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return 'greatest(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, __arithmeticOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value)) + ')'
    }
    /**
     * Shared min/max builder for the dialects whose native `least`/`greatest` (or
     * `iif`) IGNORES a NULL operand — PostgreSQL and SQL Server. `minValue`/`maxValue`
     * compute their result optionality with `__mergeOptional` (optional if EITHER operand
     * is optional, the same rule `add`/`subtract`/`concat` use); that OR rule **is** the
     * NULL-propagates (poison) contract — a required receiver with an optional argument is
     * typed optional precisely because the library anticipates the argument's NULL reaching
     * the result. Oracle / MySQL / MariaDB (`least`/`greatest`) and SQLite (`min`/`max`)
     * already deliver poison natively and keep the plain base emission; PostgreSQL and SQL
     * Server route here to match the type they declare.
     *
     * Emits the leanest form the build-time optionality allows — only null-check operands
     * that CAN be null:
     *   - both required → `<inner>` (no CASE — nothing can be null).
     *   - one optional  → `case when <that one> is null then null else <inner> end`.
     *   - both optional → `case when a is null or b is null then null else <inner> end`.
     * `<inner>` is `_minAndMaxValueSelection` — the bare `least`/`greatest` here (the coherent
     * base form); `functionName` is `'least'` for the smaller value, `'greatest'` for the
     * larger. SQL Server overrides `_minAndMaxValueSelection` to emulate the pair with `iif`
     * on versions where `least`/`greatest` do not exist, so the poison CASE built here stays
     * dialect-agnostic while each server still emits SQL it accepts.
     *
     * Two opt-outs (the maintainer's principle: what the database provides natively wins,
     * an opt-in is the last resort):
     *   - `ignoreNullInMinAndMaxValue` — keep the native ignore-NULL behaviour (no CASE).
     *   - `userFunction` (the function of the library, with `libraryFunctions` installed) — a
     *     null-propagating function emitted as `func(a, b)`, so the operand is not repeated.
     *
     * The operand appears twice in the optional cases (null check + `<inner>`); accepted,
     * because only a value the DATABASE resolves is checked at all — a constant's null state
     * is settled while the query is built — and the user-function opt-in exists for the rare
     * expensive value-source receiver.
     */
    _minAndMaxValueBetweenTwoValuesPoisoningNull(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass, userFunction: string | undefined, functionName: string): string {
        const argumentClass = __arithmeticOperandClassOf(typeClass, value)
        const argumentNeedsTypeCast = this._operandClassNeedsTypeCast(typeClass, argumentClass)
        if (this._connectionConfiguration.ignoreNullInMinAndMaxValue) {
            // Opt-out: keep the engine's native least/greatest, which ignores a NULL operand.
            return this._minAndMaxValueSelection(context, valueSource, value, argumentClass, functionName, argumentNeedsTypeCast)
        }
        if (userFunction) {
            // Opt-in: a user-provided null-propagating function; it poisons NULL itself, no CASE.
            return userFunction + '(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, argumentClass, argumentNeedsTypeCast) + ')'
        }
        if (this._isNullValue(valueSource) || this._isNullValue(value)) {
            // A NULL operand poisons the result, and this operand is already known to be NULL
            // here, so the result is NULL: asking the database to compute a value it cannot
            // reach is pure noise.
            return this._asNullValue(context, argumentClass)
        }
        const receiverOptional = this._canBeNullWhenTheQueryRuns(valueSource)
        const operandOptional = this._canBeNullWhenTheQueryRuns(value)
        if (!receiverOptional && !operandOptional) {
            // Nothing can be null, emit the bare native form.
            return this._minAndMaxValueSelection(context, valueSource, value, argumentClass, functionName, argumentNeedsTypeCast)
        }
        // Build the null check first so its parameters are appended before the inner's.
        let nullCheck: string
        if (receiverOptional && operandOptional) {
            nullCheck = this._isNull(context, valueSource) + ' or ' + this._isNull(context, value)
        } else if (receiverOptional) {
            nullCheck = this._isNull(context, valueSource)
        } else {
            nullCheck = this._isNull(context, value)
        }
        return 'case when ' + nullCheck + ' then null else ' + this._minAndMaxValueSelection(context, valueSource, value, argumentClass, functionName, argumentNeedsTypeCast) + ' end'
    }
    /**
     * The bare two-value min/max selection with NO null handling: `<functionName>(a, b)`,
     * i.e. `least` / `greatest` — the coherent base form, used by PostgreSQL (and reachable
     * by any dialect that keeps `least`/`greatest`). SQL Server overrides this to emulate
     * the pair with `iif` on the versions where `least`/`greatest` do not exist.
     */
    _minAndMaxValueSelection(context: SqlBuildContext, valueSource: ToSql, value: any, argumentClass: DataTypeClass, functionName: string, argumentNeedsTypeCast: boolean): string {
        return functionName + '(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, argumentClass, argumentNeedsTypeCast) + ')'
    }
    _add(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._appendSqlParenthesisExcluding(valueSource, context, '_add', false) + ' + ' + this._appendValueParenthesisExcluding(value, context, __arithmeticOperandClassOf(typeClass, value), '_add', this._operandNeedsTypeCast(typeClass, value))
    }
    _subtract(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._appendSqlParenthesisExcluding(valueSource, context, '_subtract', false) + ' - ' + this._appendValueParenthesis(value, context, __arithmeticOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value))
    }
    _multiply(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._appendSqlParenthesisExcluding(valueSource, context, '_multiply', false) + ' * ' + this._appendValueParenthesisExcluding(value, context, __arithmeticOperandClassOf(typeClass, value), '_multiply', this._operandNeedsTypeCast(typeClass, value))
    }
    _divide(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        // `divide` always yields a double — it mirrors JavaScript's `/`, which has no
        // integer division. Engines are not so kind: dividing two exact operands either
        // truncates the quotient (MySQL / MariaDB cut it at div_precision_increment
        // decimals) or drops the fraction outright (`1 / 3` is `0` on PostgreSQL and
        // SQL Server). A single floating point operand makes the whole division floating
        // point on every dialect, so the cast is emitted only when neither operand is
        // already known to be one.
        const dividend = this._appendSqlParenthesis(valueSource, context, false)
        const divisor = this._appendValueParenthesis(value, context, __arithmeticOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value))
        if (this._numericKindOf(valueSource) === 'approximate' || this._numericKindOf(value) === 'approximate') {
            return dividend + ' / ' + divisor
        }
        return this._appendCastAsDouble(dividend) + ' / ' + divisor
    }
    _modulo(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' % ' + this._appendValueParenthesis(value, context, __arithmeticOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value))
    }
    _atan2(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return 'atan2(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, __arithmeticOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value)) + ')'
    }
    // SqlFunction2
    /**
     * `String.prototype.substr` clamps a negative count to 0 (`'abcdef'.substr(2, -1)` is
     * `''`), while SQL either rejects a negative length outright (PostgreSQL: "negative
     * substring length not allowed") or reads it as something else entirely (`left(x, -1)`
     * means "all but the last character"). A literal count is clamped here, at build time.
     * A value-source count keeps its own value: see LIMITATIONS.md.
     */
    _clampSubstrCount(count: any): any {
        if (typeof count === 'number' && count < 0) {
            return 0
        }
        return count
    }
    _substr(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, _typeClass: DataTypeClass): string {
        value2 = this._clampSubstrCount(value2)
        if (typeof value === 'number') {
            if (value < 0) {
                // The 3-argument form does NOT clamp an out-of-range negative start the way
                // the 2-argument one does: `substr('abcdef', -10, 2)` is '' here, where JS
                // clamps the start to 0 and answers 'ab'. So the tail is taken with the
                // 2-argument form — which clamps — and the count applied to that tail. This
                // nests rather than guarding with `max(start, -length(x))` so the receiver is
                // still referenced ONCE: a guard would emit it (and bind it) twice.
                return 'substr(substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, __registeredDataType('int'), false) + '), 1, ' + this._appendValue(value2, context, __registeredDataType('int'), false) + ')'
            }
            return 'substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value + 1, context, __registeredDataType('int'), false) + ', ' + this._appendValue(value2, context, __registeredDataType('int'), false) + ')'
        } else {
            return 'substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValueParenthesis(value, context, __registeredDataType('int'), false) + ' + 1, ' + this._appendValue(value2, context, __registeredDataType('int'), false) + ')'
        }
    }
    _substring(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, _typeClass: DataTypeClass): string {
        if (typeof value === 'number' && typeof value2 === 'number') {
            // `String.prototype.substring` clamps both indexes to 0 and SWAPS them when
            // start > end: `'abcdef'.substring(2, 0)` is 'ab', not an error. Emitting the
            // arguments as given produced a negative length, which PostgreSQL rejects
            // outright ("negative substring length not allowed") — a crash on a legal call.
            const [start, end] = this._clampAndOrderSubstringBounds(value, value2)
            return 'substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(start + 1, context, __registeredDataType('int'), false) + ', ' + this._appendValue(end - start, context, __registeredDataType('int'), false) + ')'
        }
        if (typeof value === 'number') {
            const start = value < 0 ? 0 : value
            if (start === 0) {
                return 'substr(' + this._appendSql(valueSource, context, false) + ', 1, ' + this._appendValue(value2, context, __registeredDataType('int'), false) + ')'
            }
            return 'substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(start + 1, context, __registeredDataType('int'), false) + ', ' + this._appendValue(value2, context, __registeredDataType('int'), false) + ' - ' + this._appendValue(start, context, __registeredDataType('int'), false) + ')'
        } else {
            return 'substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValueParenthesis(value, context, __registeredDataType('int'), false) + ' + 1, ' + this._appendValue(value2, context, __registeredDataType('int'), false) + ' - ' + this._appendValue(value, context, __registeredDataType('int'), false) + ')'
        }
    }
    /**
     * `String.prototype.substring`'s index handling: each index is clamped to 0, and the two
     * are swapped when start > end. Both indexes must be known at build time.
     */
    _clampAndOrderSubstringBounds(start: number, end: number): [number, number] {
        const s = start < 0 ? 0 : start
        const e = end < 0 ? 0 : end
        return s > e ? [e, s] : [s, e]
    }
    _replaceAll(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, typeClass: DataTypeClass): string {
        return 'replace(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, typeClass, false) + ', ' + this._appendValue(value2, context, typeClass, false) + ')'
    }
    /**
     * Case-insensitive `replaceAll`. The base form is the SQLite behaviour: emit the
     * function of the library (`_replaceAllInsensitiveFunction`) when the connection has it, and
     * otherwise fall back to plain case-sensitive `replace(...)` — documented, never an
     * error. The engines whose `REPLACE`/`REGEXP_REPLACE` can fold case override this:
     * SQL Server / Oracle (collation-driven), MySQL / MariaDB / PostgreSQL (regex-driven).
     */
    _replaceAllInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, typeClass: DataTypeClass): string {
        const fn = this._replaceAllInsensitiveFunction()
        if (fn) {
            return fn + '(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, typeClass, false) + ', ' + this._appendValue(value2, context, typeClass, false) + ')'
        }
        return this._replaceAll(context, valueSource, value, value2, typeClass)
    }
    /**
     * Escape a search term for use as a regular-expression pattern in the regex-driven
     * `replaceAllInsensitive` engines (MySQL / MariaDB / PostgreSQL). Mirrors
     * `_escapeLikeWildcard`: a known string literal is escaped in JS at build time (the
     * regex metacharacter set) and bound as a parameter; a value source is escaped at the
     * SQL level with nested `replace(...)`. The backslash is escaped first so the
     * backslashes added for the other metacharacters are not doubled again.
     */
    _escapeRegexpForReplace(value: any, context: SqlBuildContext, typeClass: DataTypeClass, forceTypeCast: boolean): string {
        if (typeof value === 'string') {
            return this._appendValue(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), context, typeClass, forceTypeCast)
        }
        let sql = this._appendValue(value, context, typeClass, forceTypeCast)
        sql = "replace(" + sql + ", '\\', '\\\\')"
        const metachars = '.*+?^${}()|[]'
        for (let i = 0, length = metachars.length; i < length; i++) {
            const ch = metachars[i]!
            sql = "replace(" + sql + ", '" + ch + "', '\\" + ch + "')"
        }
        return sql
    }
    /**
     * Escape the REPLACEMENT string of the regex-driven `replaceAllInsensitive`
     * (PostgreSQL / MySQL / MariaDB) — the twin of {@link _escapeRegexpForReplace} for the
     * search term. In `regexp_replace(src, pattern, replacement, …)` the replacement is NOT
     * literal the way `replaceAll`'s is: on PostgreSQL and MariaDB a backslash starts a
     * substitution (`\1` is a backreference, `\&` the whole match); MySQL's ICU engine adds
     * `$` (`$0` / `$1`). Left unescaped, a `\` (or `$`) in the user's replacement is
     * interpreted, so `replaceAllInsensitive` would diverge from `replaceAll` (always literal)
     * and from its case-sensitive twin. Escaping keeps the replacement literal on both.
     * Base = PostgreSQL / MariaDB: only the backslash is a metacharacter. MySQL adds `$`.
     * Mirrors {@link _escapeRegexpForReplace}: a string literal is escaped in JS at build time
     * (bound as a param); a value source is escaped at the SQL level with nested `replace`.
     */
    _escapeRegexpReplacement(value: any, context: SqlBuildContext, typeClass: DataTypeClass, forceTypeCast: boolean): string {
        if (typeof value === 'string') {
            return this._appendValue(value.replace(/\\/g, '\\\\'), context, typeClass, forceTypeCast)
        }
        return "replace(" + this._appendValue(value, context, typeClass, forceTypeCast) + ", '\\', '\\\\')"
    }
    _typedConst(context: SqlBuildContext, value: any, typeClass: DataTypeClass): string {
        // A const that must carry its type (see _typedOperand)
        return this._const(context, value, typeClass, true)
    }
    _typedConstForCondition(context: SqlBuildContext, value: any, typeClass: DataTypeClass): string {
        return this._constForCondition(context, value, typeClass, true)
    }
    _typedOperand<T>(operand: T, _otherOperands: any[], _operation?: string): T {
        // The operand of an operation, written with its type when the database can't learn it from the other
        // operands (see PostgreSqlSqlBuilder); no other database needs it
        return operand
    }
    _forceTypeCastInCallArguments(): boolean {
        // The argument types decide which overload of a function or procedure the database calls
        return false
    }
    _buildCallProcedure(context: SqlBuildContext, procedureName: string, procedureParams: readonly AnyValueSource[]): string {
        const forceTypeCast = this._forceTypeCastInCallArguments()
        let result = 'call ' + this._escape(procedureName, false, true) + '('
        if (procedureParams.length > 0) {
            result += this._appendSql(procedureParams[0]!, context, forceTypeCast)

            for (let i = 1, length = procedureParams.length; i < length; i++) {
                result += ', ' + this._appendSql(procedureParams[i]!, context, forceTypeCast)
            }
        }

        return result + ')'
    }
    /*
     * The function is selected as any other value of a select, so its result is converted by its type as a column is
     * (`_appendColumnValue`): the uuid of a database that doesn't store it as text is read as text, as its parameters
     * are sent in the form it's stored
     */
    _buildCallFunction(context: SqlBuildContext, functionCall: AnyValueSource): string {
        return 'select ' + this._appendResultColumnProjection(functionCall, this._appendColumnValue(functionCall, context, true), context)
    }
    _appendFunctionCall(context: SqlBuildContext, functionName: string, functionParams: readonly AnyValueSource[]): string {
        const forceTypeCast = this._forceTypeCastInCallArguments()
        let result = this._escape(functionName, false, true) + '('
        if (functionParams.length > 0) {
            result += this._appendSql(functionParams[0]!, context, forceTypeCast)

            for (let i = 1, length = functionParams.length; i < length; i++) {
                result += ', ' + this._appendSql(functionParams[i]!, context, forceTypeCast)
            }
        }

        return result + ')'
    }
    _fragment(context: SqlBuildContext, sql: TemplateStringsArray, sqlParams: AnyValueSource[]): string {
        if (sqlParams.length <= 0) {
            return sql[0]!
        }
        let result = ''
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            result += sql[i]
            result += this._appendFragmentParam(sqlParams[i]!, context)
        }
        result += sql[sql.length - 1]
        return result
    }
    /** A value of a fragment (`fragment.sql`), written where the user's SQL puts it */
    _appendFragmentParam(value: AnyValueSource, context: SqlBuildContext): string {
        return this._appendConditionSql(value, context, false)
    }
    _rawFragment(context: SqlBuildContext, sql: TemplateStringsArray, sqlParams: Array<AnyValueSource | IExecutableSelectQuery<any, any, any> | IExecutableInsertQuery<any, any> | IExecutableUpdateQuery<any, any> | IExecutableDeleteQuery<any, any>>): string {
        if (sqlParams.length <= 0) {
            return sql[0]!
        }
        let result = ''
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            result += sql[i]
            result += this._appendRawFragmentParam(sqlParams[i]!, context)
        }
        result += sql[sql.length - 1]
        return result
    }
    /** A value or a query of a raw fragment (`rawFragment`), written where the user's SQL puts it */
    _appendRawFragmentParam(value: AnyValueSource | IExecutableSelectQuery<any, any, any> | IExecutableInsertQuery<any, any> | IExecutableUpdateQuery<any, any> | IExecutableDeleteQuery<any, any>, context: SqlBuildContext): string {
        return this._appendSql(value, context, false)
    }
    _rawFragmentTableName(context: SqlBuildContext, tableOrView: AnyTableOrView): string {
        return this._appendTableOrViewNameForFrom(tableOrView, context)
    }
    _rawFragmentTableAlias(context: SqlBuildContext, tableOrView: AnyTableOrView): string {
        const forceAliasFor = context.forceAliasFor
        const forceAliasAs = context.forceAliasAs
        const as = __asTableOrViewRoot(tableOrView).__as
        const prefix = this._supportTableAliasWithAs ? 'as ' : ''

        if (forceAliasFor === tableOrView && forceAliasAs) {
            return prefix + this._escape(forceAliasAs, true)
        } else if (as) {
            return prefix + this._escape(as, true)
        }
        return ''
    }
    _countAll(_context: SqlBuildContext): string {
        return 'count(*)'
    }
    _count(context: SqlBuildContext, value: any): string {
        return 'count(' + this._appendSql(value, context, false) + ')'
    }
    _countDistinct(context: SqlBuildContext, value: any): string {
        return 'count(distinct ' + this._appendSql(value, context, false) + ')'
    }
    _max(context: SqlBuildContext, value: any): string {
        if (this._zonedKeptAsText() && isValueSource(value) && __isZonedDateTimeClass(__classOf(__asNodeValueSource(value)))) {
            return this._zonedTextMinOrMax('max', context, value as unknown as ToSql)
        }
        return 'max(' + this._appendSql(value, context, false) + ')'
    }
    _min(context: SqlBuildContext, value: any): string {
        if (this._zonedKeptAsText() && isValueSource(value) && __isZonedDateTimeClass(__classOf(__asNodeValueSource(value)))) {
            return this._zonedTextMinOrMax('min', context, value as unknown as ToSql)
        }
        return 'min(' + this._appendSql(value, context, false) + ')'
    }
    /**
     * min or max of a zoned date and time kept as text, by its instant as Temporal's compare: of a text of fixed width of
     * its instant followed by its text, the text after it (of the same instant in two zones, either one)
     */
    _zonedTextMinOrMax(_kind: 'min' | 'max', _context: SqlBuildContext, _value: ToSql): string {
        return this._zonedDateTimeUnsupported()
    }
    _sum(context: SqlBuildContext, value: any): string {
        return 'sum(' + this._appendSql(value, context, false) + ')'
    }
    _sumDistinct(context: SqlBuildContext, value: any): string {
        return 'sum(distinct ' + this._appendSql(value, context, false) + ')'
    }
    _average(context: SqlBuildContext, value: any): string {
        return 'avg(' + this._averageOperandSql(context, value) + ')'
    }
    _averageDistinct(context: SqlBuildContext, value: any): string {
        return 'avg(distinct ' + this._averageOperandSql(context, value) + ')'
    }
    _anyValue(context: SqlBuildContext, value: any): string {
        return 'any_value(' + this._appendSql(value, context, false) + ')'
    }
    _averageOperandSql(context: SqlBuildContext, value: any): string {
        // `average` exposes a fractional NumberValueSource on the typed surface of every
        // dialect, but an engine averaging an exact operand answers in an exact type, and
        // each one loses a different amount of the fraction: SQL Server truncates to the
        // integer itself (`avg({1, 2, 4})` is `2`, not `2.333`), MySQL / MariaDB answer in
        // DECIMAL cut at div_precision_increment decimals (`1.6667`, not
        // `1.6666666666666667`). Casting an exact operand homogenises the result without
        // making the caller wrap the column themselves.
        if (this._numericKindOf(value) === 'exact') {
            return this._appendCastAsDouble(this._appendSql(value, context, false))
        }
        return this._appendSql(value, context, false)
    }
    _stringConcat(context: SqlBuildContext, separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'group_concat(' + this._appendSql(value, context, false) + ')'
        } else if (separator === '') {
            return 'group_concat(' + this._appendSql(value, context, false) + ", '')"
        } else {
            return 'group_concat(' + this._appendSql(value, context, false) + ', ' + this._appendValue(separator, context, __registeredDataType('string'), false) + ')'
        }
    }
    _stringConcatDistinct(context: SqlBuildContext, separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'group_concat(distinct ' + this._appendSql(value, context, false) + ')'
        } else if (separator === '') {
            return 'group_concat(distinct ' + this._appendSql(value, context, false) + ", '')"
        } else {
            return 'group_concat(distinct ' + this._appendSql(value, context, false) + ', ' + this._appendValue(separator, context, __registeredDataType('string'), false) + ')'
        }
    }
    _aggregateValueAsArray(valueSource: IValueSource<any, AggregatedArrayType<any>, any>, context: SqlBuildContext): string {
        const nodeValueSource = __asNodeValueSource(valueSource)
        const aggregatedArrayColumns = nodeValueSource.__aggregatedArrayColumns!
        const aggregatedArrayDistinct = nodeValueSource.__aggregatedArrayDistinct!
        return this._appendAggregateArrayColumns(aggregatedArrayColumns, aggregatedArrayDistinct, context, undefined)
    }
    /**
     * The columns of the select are the values of the JSON of an aggregated array, as the database writes them in the
     * JSON (SQL Server's `for json path`): each one is written as `_appendAggregatedArrayValueProjection` converts it
     */
    _isSelectOfAggregatedArrayValues(_query: SelectData): boolean {
        return false
    }
    _needAggregateArrayColumnsTransformation(query: SelectData, _context: SqlBuildContext): boolean {
        return !!query.__asInlineAggregatedArrayValue
    }
    _supportOrderByWhenAggregateArray = false
    _supportLimitWhenAggregateArray = false
    _needAggregateArrayWrapper(query: SelectData, _context: SqlBuildContext): boolean {
        if (!query.__asInlineAggregatedArrayValue) {
            return false
        }
        if (query.__type === 'compound') {
            return true
        }
        if (query.__distinct) {
            return true
        }
        if (query.__groupBy.length > 0) {
            return true
        }
        if (query.__having) {
            return true
        }
        if (!this._supportOrderByWhenAggregateArray) {
            if (query.__orderBy || query.__customization?.beforeOrderByItems || query.__customization?.afterOrderByItems) {
                return true
            }
        }
        if (!this._supportLimitWhenAggregateArray) {
            if (query.__limit !== undefined) {
                return true
            }
            if (query.__offset !== undefined) {
                return true
            }
        }
        return false
    }
    _buildSelectAsAggregatedArray(_query: SelectData, _context: SqlBuildContext): string {
        return ''
    }
    _appendAggregateArrayWrapperBegin(query: SelectData, context: SqlBuildContext, aggregateId: number): string {
        let aggregatedArrayColumns
        if (query.__oneColumn) {
            aggregatedArrayColumns = query.__columns['result']
            if (!aggregatedArrayColumns) {
                throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'invalid result column' }, 'Result column for a select one column not found')
            }
        } else {
            aggregatedArrayColumns = query.__columns
        }
        return 'select ' +  this._appendAggregateArrayWrappedColumns(aggregatedArrayColumns, context, aggregateId) + ' from ('
    }
    _appendAggregateArrayWrapperEnd(_query: SelectData, _context: SqlBuildContext, aggregateId: number): string {
        let result =  ')'
        if (this._supportTableAliasWithAs) {
            result += ' as '
        } else {
            result += ' '
        }
        result += 'a_' + aggregateId + '_'
        return result
    }
    _appendAggregateArrayColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayDistinct: boolean, context: SqlBuildContext, _query: SelectData | undefined): string {
        const distict = aggregatedArrayDistinct ? 'distinct ' : ''
        if (isValueSource(aggregatedArrayColumns)) {
            return 'json_agg(' + distict + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, this._appendSql(this._typedOperand(aggregatedArrayColumns, []), context, false), context) + ')'
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "', " + this._appendAggregatedArrayValueProjection(columns[prop]!, this._appendSql(this._typedOperand(columns[prop]!, []), context, false), context)
            }

            return 'json_agg(' +  distict + 'json_build_object(' + result + '))'
        }
    }
    _appendAggregateArrayWrappedColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, context: SqlBuildContext, aggregateId: number): string {
        if (isValueSource(aggregatedArrayColumns)) {
            return 'json_agg(' + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, 'a_' + aggregateId + '_.result', context) + ')'
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "', " + this._appendAggregatedArrayValueProjection(columns[prop]!, 'a_' + aggregateId + '_.' + this._escape(prop, true), context)
            }

            return 'json_agg(json_build_object(' + result + '))'
        }
    }
}

/** The seconds and the nanoseconds of a second, as seconds with a fraction: the seconds alone when there are none */
function secondsWithFraction(seconds: string, nanoseconds: string): string {
    return nanoseconds === '0' ? seconds : seconds + ' + ' + nanoseconds + ' / 1000000000.0'
}

/** A field of a duration, as Temporal names it */
export type DurationField = 'years' | 'months' | 'weeks' | 'days' | 'hours' | 'minutes' | 'seconds' | 'milliseconds' | 'microseconds' | 'nanoseconds'

/** Whether a value source is a duration plus or minus another one */
export function __isDurationSum(valueSource: ToSql): boolean {
    if (!isValueSource(valueSource)) {
        return false
    }
    const operation = (__asNodeValueSource(valueSource) as Partial<SqlOperation0ValueSource>).__operation as string | undefined
    return operation === '_durationAdd' || operation === '_durationSubtract'
}

/** The index of the largest field of a duration that isn't zero, from 0 (the years) to 9 (the nanoseconds); 10 for zero */
function largestFieldOf(duration: TemporalDuration): number {
    const fields = [duration.years, duration.months, duration.weeks, duration.days, duration.hours, duration.minutes, duration.seconds, duration.milliseconds, duration.microseconds, duration.nanoseconds]
    const index = fields.findIndex(field => field !== 0)
    return index < 0 ? 10 : index
}

/** Whether the fields of a with are only an hour, a minute or a second, at least one (see _withWholeTime) */
export function __withChangesOnlyWholeTime(given: PlainTemporalFields): boolean {
    return given.year === undefined && given.month === undefined && given.day === undefined && given.millisecond === undefined && given.microsecond === undefined && given.nanosecond === undefined
        && (given.hour !== undefined || given.minute !== undefined || given.second !== undefined)
}

/** The SQL negated with a minus; between parentheses when it starts with one, since `--` starts a comment */
function negatedSql(sql: string): string {
    return sql.startsWith('-') ? '-(' + sql + ')' : '-' + sql
}

/**
 * The duration a duration is computed from, keeping its storage (an interval, of days to seconds or of years to months,
 * or its text): the one negated or without its sign; undefined for any other value
 */
export function __durationComputedFrom(valueSource: ToSql): ToSql | undefined {
    if (!isValueSource(valueSource)) {
        return undefined
    }
    const operation = __asNodeValueSource(valueSource) as Partial<SqlOperation0ValueSource>
    if (operation.__operation === '_durationNegated' || operation.__operation === '_durationAbs') {
        return operation.__valueSource as unknown as ToSql
    }
    return undefined
}

/** The difference of two values of a date, a time or a date and time to write (see _appendDifference) */
export interface PlainTemporalDifferenceSql {
    readonly one: ToSql
    readonly two: ToSql
    readonly fields: PlainTemporalDifferenceFields
    readonly difference: PlainTemporalDifference
    /**
     * The nanoseconds of the step of the rounding (the smallest unit times the increment); 0 for weeks, months and years,
     * the units of the calendar
     */
    readonly step: bigint
    /**
     * The nanoseconds of the unit the whole difference is counted in: a day for a date; for a time or a date and time,
     * the smallest unit the database keeps (see _temporalTick), or a nanosecond for a step that isn't a multiple of it
     */
    readonly tick: bigint
    /** Whether the whole difference is counted in nanoseconds, for a step that isn't a multiple of the unit of the database */
    readonly inNanoseconds: boolean
}

/** The position of each unit, from the year */
const unitIndex: Record<string, number | undefined> = {
    year: 0, month: 1, week: 2, day: 3, hour: 4, minute: 5, second: 6, millisecond: 7, microsecond: 8, nanosecond: 9,
}

/** The nanoseconds of each unit of the time, and of the day */
const nanosecondsOfUnit: Record<string, bigint | undefined> = {
    day: 86_400_000_000_000n, hour: 3_600_000_000_000n, minute: 60_000_000_000n, second: 1_000_000_000n, millisecond: 1_000_000n, microsecond: 1000n, nanosecond: 1n,
}

/**
 * The parts of a duration a zoned date and time adds: the months (its years too) and the days (its weeks too) of its
 * date, the interval of its time, and, for a value source, the condition that it has a date (when it may have none)
 */
export interface ZonedDurationPartsSql {
    readonly months: string | undefined
    readonly days: string | undefined
    readonly seconds: string | undefined
    readonly hasDate: string | undefined
}

/** The seconds of a number of nanoseconds, as an exact decimal number */
export function secondsOfNanosecondsText(nanoseconds: bigint): string {
    const negative = nanoseconds < 0n
    const absolute = negative ? -nanoseconds : nanoseconds
    const fraction = String(absolute % 1_000_000_000n).padStart(9, '0').replace(/0+$/, '')
    return (negative ? '-' : '') + String(absolute / 1_000_000_000n) + (fraction === '' ? '' : '.' + fraction)
}
