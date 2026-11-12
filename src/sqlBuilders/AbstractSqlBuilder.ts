import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import { operationsThatNeedParenthesis, type OperationsThatNeedParenthesis } from '../utils/operationsThatNeedParenthesis.js'
import type { ToSql, SqlBuilder, DeleteData, InsertData, UpdateData, SelectData, PlainSelectData, CompoundSelectData, SqlOperation, WithQueryData, CompoundOperator, JoinData, QueryColumns, FlatQueryColumns, WithSelectData, WithValuesData, OrderByEntry } from './SqlBuilder.js'
import { flattenQueryColumns, getQueryColumn } from './SqlBuilder.js'
import type { AnyTableOrView, __ITableOrViewPrivate } from '../utils/ITableOrView.js'
import { __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import type { AnyValueSource, BooleanValueSource, EqualableValueSource, IAggregatedArrayValueSource, IAnyBooleanValueSource, IExecutableDeleteQuery, IExecutableInsertQuery, IExecutableSelectQuery, IExecutableUpdateQuery, __AggregatedArrayColumns, __ValueSourcePrivate, ValueType } from '../expressions/values.js'
import { isValueSource, __getValueSourceOfObject, __isStringValueSource, __isBooleanValueSource } from '../expressions/values.js'
import { isDefault } from '../expressions/Default.js'
import type { __ColumnPrivate, DBColumn } from '../utils/Column.js'
import { __columnPathsOf } from '../utils/columnPaths.js'
import { isColumn } from '../utils/Column.js'
import type { DefaultTypeAdapter, ProjectionComparison, ProjectionOutput, TypeAdapter } from '../TypeAdapter.js'
import { CustomBooleanTypeAdapter } from '../TypeAdapter.js'
import type { ConnectionConfiguration } from '../queryRunners/QueryRunner.js'
import { AggregateValueAsArrayValueSource, AllowWhenAggregateValueAsArrayValueSource, SequenceValueSource } from '../internal/ValueSourceImpl.js'
import { RawFragmentImpl } from '../internal/RawFragmentImpl.js'
import { hasToSql, operationOf } from './SqlBuilder.js'
import { __getTableOrViewPrivate } from '../utils/ITableOrView.js'
import { __getColumnOfObject, __getColumnPrivate } from '../utils/Column.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { getWithData, hasWithData } from './SqlBuilder.js'
import { __getValueSourcePrivate } from '../expressions/values.js'
import type { RawFragment } from '../utils/RawFragment.js'
import { TsSqlError, TsSqlProcessingError } from '../TsSqlError.js'
import { isUtcTimeZoneName } from '../utils/processTimeZone.js'
import { getMetadata, queryContainsInsertReturningClause, queryContainsMutationReturningClause, queryForcedAffectedRowCount, queryParamValueForColumn, setMetadata, setParamMetadata } from '../utils/metadataSymbols.js'
import { __typeCategoryOf } from '../utils/typeCategory.js'
import { __isDecimalCategory } from '../utils/typeCategory.js'

/** A column of the select list as it was written, for the group by that refers to it */
// `name`: the alias of the column; `paramsStart` / `paramsEnd`: the range of the params the column's SQL consumed
export type SelectColumnSql = { sql: string, name: string, position: number, paramsStart: number, paramsEnd: number, shadowedByGroupByColumn?: boolean | undefined }

function isIntersectOperator(operator: CompoundOperator): boolean {
    return operator === 'intersect' || operator === 'intersectAll'
}

export class AbstractSqlBuilder implements SqlBuilder {
    // @ts-ignore
    _defaultTypeAdapter: DefaultTypeAdapter
    // @ts-ignore
    _queryRunner: QueryRunner
    // @ts-ignore
    _connectionConfiguration: ConnectionConfiguration
    _operationsThatNeedParenthesis: OperationsThatNeedParenthesis = operationsThatNeedParenthesis
    /** The name of a table or view as it is written in the query (a generated name gets the one it has there) */
    _tableOrViewName(tablePrivate: { __name: string, __generatedName?: boolean | undefined }, context: SqlBuildContext): string {
        return tablePrivate.__generatedName ? context.generatedNameOf(tablePrivate.__name) : tablePrivate.__name
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
     * (`projectionComparison` is `'none'`): where the query compares it, it must use the value, not the converted SQL
     */
    _needsTheValueOfResultColumnToCompare(value: AnyValueSource, context: SqlBuildContext): boolean {
        return this._isConvertedResultColumn(value, context) && this._projectionComparison(value, 'resultColumn') === 'none'
    }
    /**
     * The column is converted in the outermost query, and its converted SQL doesn't compare like the value of another
     * column or expression (`projectionComparison` is `'columnEquality'` or `'none'`): where the query compares it with
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
     * (`projectionComparison` isn't `'value'`): where the query orders it, it must use the value, not the converted SQL
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
        return getMetadata<boolean>(context.params, queryContainsInsertReturningClause)
    }
    _setContainsInsertReturningClause(context: SqlBuildContext, value: boolean | undefined): void {
        setMetadata(context.params, queryContainsInsertReturningClause, value)
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
        setMetadata(context.params, queryContainsMutationReturningClause, value)
    }
    // Read in the query runner (see AbstractQueryRunner.getForcedAffectedRowCount).
    // Set when the affected-row count is known while building the query but the
    // driver can't report it at execution time (Oracle's multi-row INSERT, which
    // is emitted as an anonymous PL/SQL block — Oracle drivers don't populate
    // rowsAffected for PL/SQL blocks). The query runner returns this value as the
    // affected-row count instead of the driver's (absent) one.
    _setForcedAffectedRowCount(context: SqlBuildContext, value: number | undefined): void {
        setMetadata(context.params, queryForcedAffectedRowCount, value)
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
        const columnPrivate = __getColumnPrivate(column)
        const typeAdapter = columnPrivate.__typeAdapter
        if (__isBooleanValueSource(columnPrivate) && typeAdapter instanceof CustomBooleanTypeAdapter) {
            return '(' + this._appendRawColumnName(column, context) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, context) + ')'
        }
        return this._appendRawColumnName(column, context)
    }
    _appendColumnNameForCondition(column: DBColumn, context: SqlBuildContext): string {
        const columnPrivate = __getColumnPrivate(column)
        const typeAdapter = columnPrivate.__typeAdapter
        if (__isBooleanValueSource(columnPrivate) && typeAdapter instanceof CustomBooleanTypeAdapter) {
            return this._appendRawColumnName(column, context) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, context)
        }
        return this._appendRawColumnName(column, context)
    }
    _appendRawColumnName(column: DBColumn, context: SqlBuildContext): string {
        const columnPrivate = __getColumnPrivate(column)
        const tableOrView = columnPrivate.__tableOrView
        const tablePrivate = __getTableOrViewPrivate(tableOrView)

        const forceAliasFor = context.forceAliasFor
        const forceAliasAs = context.forceAliasAs
        const fakeNamesOf = context.fakeNamesOf

        if (tablePrivate.__valuesForInsert) {
            return this._appendRawColumnNameForValuesForInsert(column, context)
        }

        if (forceAliasFor === tableOrView && forceAliasAs) {
            return this._escape(forceAliasAs, true) + '.' + this._escape(columnPrivate.__name, true)
        }

        if (fakeNamesOf && fakeNamesOf.has(tableOrView)) {
            if (tablePrivate.__as) {
                return this._escape('_old_', true) + '.' + this._escape(this._identifierWithoutQuotes(tablePrivate.__as + '__' + columnPrivate.__name), true)
            } else {
                return this._escape('_old_', true) + '.' + this._escape(this._identifierWithoutQuotes(this._tableOrViewName(tablePrivate, context) + '__' + columnPrivate.__name), true)
            }
        }

        if (tablePrivate.__as) {
            return this._escape(tablePrivate.__as, true) + '.' + this._escape(columnPrivate.__name, true)
        } else if (context.safeTableOrView === tableOrView) {
                return this._escape(columnPrivate.__name, true)
        } else {
            return this._escape(this._tableOrViewName(tablePrivate, context), false) + '.' + this._escape(columnPrivate.__name, true)
        }
    }
    _appendRawColumnNameForValuesForInsert(column: DBColumn, _context: SqlBuildContext): string {
        const columnPrivate = __getColumnPrivate(column)
        return 'excluded.' + this._escape(columnPrivate.__name, true)
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
        const t = __getTableOrViewPrivate(table)
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
        const t = __getTableOrViewPrivate(table)
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
        const t = __getTableOrViewPrivate(table)
        return this._escape(this._tableOrViewName(t, context), false)
    }
    _appendTableOrViewNoAliasForFrom(_table: AnyTableOrView, _context: SqlBuildContext): string {
        return ''
    }
    _appendRawFragment(rawFragment: RawFragment<any>, context: SqlBuildContext): string {
        return this._appendSql(rawFragment as any as ToSql, context, false) // RawFragment has a hidden implemetation of ToSql
    }
    _appendCondition(condition: IAnyBooleanValueSource<any, any>, context: SqlBuildContext): string {
        if (hasToSql(condition)) {
            return this._appendConditionSql(condition, context, false)
        }
        throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'invalid value source' }, 'Conditions must have a __toSqlForCondition method')
    }
    _appendConditionParenthesis(condition: IAnyBooleanValueSource<any, any>, context: SqlBuildContext): string {
        if (this._needParenthesis(condition)) {
            return '(' + this._appendCondition(condition, context) + ')'
        }
        return this._appendCondition(condition, context)
    }
    _appendConditionParenthesisExcluding(condition: IAnyBooleanValueSource<any, any>, context: SqlBuildContext, excluding: keyof SqlOperation): string {
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
    _appendSpreadValue(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (hasToSql(value)) {
            return '(' + this._appendSql(value, context, forceTypeCast) + ')'
        }
        if (Array.isArray(value)) {
            if (value.length <= 0) {
                return '()'
            }

            let arrayResult = '(' + this._appendValue(value[0], context, columnType, columnTypeName, typeAdapter, forceTypeCast)

            for (let i = 1, length = value.length; i < length; i++) {
                arrayResult += ', ' + this._appendValue(value[i], context, columnType, columnTypeName, typeAdapter, forceTypeCast)
            }
            return arrayResult + ')'
        }
        const adaptedValue = this._transformParamToDB(value, columnType, columnTypeName, typeAdapter, context)
        return '(' + this._appendParam(adaptedValue, context, columnType, columnTypeName, typeAdapter, forceTypeCast) + ')'
    }
    _appendValue(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (hasToSql(value)) {
            return this._appendSql(value, context, forceTypeCast)
        }
        const adaptedValue = this._transformParamToDB(value, columnType, columnTypeName, typeAdapter, context)
        return this._appendParam(adaptedValue, context, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    _appendValueParenthesis(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (this._needParenthesis(value)) {
            return '(' + this._appendValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast) + ')'
        }
        return this._appendValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    _appendValueParenthesisExcluding(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, excluding: keyof SqlOperation, forceTypeCast: boolean): string {
        if (this._needParenthesisExcluding(value, excluding)) {
            return '(' + this._appendValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast) + ')'
        }
        return this._appendValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast)
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
    _appendConditionValue(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (hasToSql(value)) {
            return this._appendConditionSql(value, context, forceTypeCast)
        }
        const adaptedValue = this._transformParamToDB(value, columnType, columnTypeName, typeAdapter, context)
        return this._appendConditionParam(adaptedValue, context, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    _appendConditionValueParenthesis(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (this._needParenthesis(value)) {
            return '(' + this._appendConditionValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast) + ')'
        }
        return this._appendConditionValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    _appendConditionValueParenthesisExcluding(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, excluding: keyof SqlOperation, forceTypeCast: boolean): string {
        if (this._needParenthesisExcluding(value, excluding)) {
            return '(' + this._appendConditionValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast) + ')'
        }
        return this._appendConditionValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    _transformParamToDB(value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, context?: SqlBuildContext): any {
        try {
            if (typeAdapter) {
                return typeAdapter.transformValueToDB(value, columnTypeName, __typeCategoryOf(columnType), this._defaultTypeAdapter)
            } else {
                return this._defaultTypeAdapter.transformValueToDB(value, columnTypeName, __typeCategoryOf(columnType))
            }
        } catch (e) {
            // The value would be the next parameter: an invalid one tells which of them it is
            if (context && e instanceof TsSqlError && e.errorReason.reason === 'INVALID_VALUE_TO_SEND_TO_DATABASE' && e.errorReason.paramIndex === undefined) {
                e.errorReason.paramIndex = context.params.length
            }
            throw e
        }
    }
    _appendParam(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        const typeCategory = __typeCategoryOf(columnType)
        // The query runner writes the type of the parameter in the placeholder, or sends it with the parameter, where
        // the position gives it none, or where the type adapter asks for it (like ForceTypeCast)
        if (typeAdapter && typeAdapter.forceTypeCast) {
            forceTypeCast = typeAdapter.forceTypeCast(columnTypeName, typeCategory, value, forceTypeCast, this._defaultTypeAdapter)
        } else {
            forceTypeCast = this._defaultTypeAdapter.forceTypeCast(columnTypeName, typeCategory, value, forceTypeCast)
        }
        if (context.assigningValueToColumn) {
            setParamMetadata(context.params, context.params.length, queryParamValueForColumn, true)
        }
        // What the type adapter or the connection keeps for the query runner, before the parameter is added
        if (typeAdapter && typeAdapter.addQueryParamMetadata) {
            typeAdapter.addQueryParamMetadata(context.params, context.params.length, columnTypeName, typeCategory, value, this._defaultTypeAdapter)
        } else {
            this._defaultTypeAdapter.addQueryParamMetadata(context.params, context.params.length, columnTypeName, typeCategory, value)
        }
        let placeholder = this._queryRunner.addParam(context.params, value, columnTypeName, typeCategory, forceTypeCast)
        if (typeAdapter && typeAdapter.transformPlaceholder) {
            placeholder = typeAdapter.transformPlaceholder(placeholder, columnTypeName, typeCategory, value, this._defaultTypeAdapter)
        } else {
            placeholder = this._defaultTypeAdapter.transformPlaceholder(placeholder, columnTypeName, typeCategory, value)
        }
        return placeholder
    }
    _appendConditionParam(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        return this._appendParam(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast)
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
        if (isOutermostQuery && isValueSource(value) && __getValueSourcePrivate(value).__valueType === 'aggregatedArray') {
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
    _appendResultColumnProjection(value: AnyValueSource, sql: string, _context: SqlBuildContext): string {
        return this._appendValueProjection(value, sql, 'resultColumn')
    }
    /**
     * A value inside the JSON of an aggregated array, as the JSON function of the database receives it: the
     * `transformProjection` of the type adapter of the value, or the conversion of the library (the identity). A
     * converted value is the SQL of a text, written in the JSON as a string. The leaf of an aggregated array is written
     * outside the select whose distinct, order by and limit compare and order the value: in the aggregate over the
     * wrapped select (`a_N_.<prop>`), or in an aggregate without them (MariaDB orders inside the aggregate by the
     * expression of the column, not by the leaf).
     */
    _appendAggregatedArrayValueProjection(value: AnyValueSource, sql: string): string {
        return this._appendValueProjection(value, sql, 'aggregatedArrayValue')
    }
    /** The value inside the JSON of an aggregated array is converted (`_appendAggregatedArrayValueProjection` changes it) */
    _isConvertedAggregatedArrayValue(value: AnyValueSource): boolean {
        return this._appendAggregatedArrayValueProjection(value, '') !== ''
    }
    /**
     * The value inside the JSON of an aggregated array is converted, and its converted SQL doesn't compare like the
     * value (`projectionComparison` is `'none'`)
     */
    _needsTheValueOfAggregatedArrayValueToCompare(value: AnyValueSource): boolean {
        return this._isConvertedAggregatedArrayValue(value) && this._projectionComparison(value, 'aggregatedArrayValue') === 'none'
    }
    /**
     * The value inside the JSON of an aggregated array is converted, and its converted SQL doesn't order like the
     * value (`projectionComparison` isn't `'value'`)
     */
    _needsTheValueOfAggregatedArrayValueToOrder(value: AnyValueSource): boolean {
        return this._isConvertedAggregatedArrayValue(value) && this._projectionComparison(value, 'aggregatedArrayValue') !== 'value'
    }
    /**
     * The `projectionComparison` of the type adapter of the value, or of the connection, for `output`: how the SQL of
     * `_appendValueProjection` compares with the value
     */
    _projectionComparison(value: AnyValueSource, output: ProjectionOutput): ProjectionComparison {
        if (!isValueSource(value)) {
            return 'value'
        }
        const valueSourcePrivate = __getValueSourcePrivate(value)
        const typeAdapter = valueSourcePrivate.__typeAdapter
        const typeCategory = __typeCategoryOf(valueSourcePrivate.__valueType)
        if (typeAdapter && typeAdapter.projectionComparison) {
            return typeAdapter.projectionComparison(valueSourcePrivate.__valueTypeName, typeCategory, output, this._defaultTypeAdapter)
        }
        return this._defaultTypeAdapter.projectionComparison(valueSourcePrivate.__valueTypeName, typeCategory, output)
    }
    /** The `transformProjection` of the type adapter of the value, or of the connection, for `output` */
    _appendValueProjection(value: AnyValueSource, sql: string, output: ProjectionOutput): string {
        if (!isValueSource(value)) {
            return sql
        }
        const valueSourcePrivate = __getValueSourcePrivate(value)
        const typeAdapter = valueSourcePrivate.__typeAdapter
        const typeCategory = __typeCategoryOf(valueSourcePrivate.__valueType)
        if (typeAdapter && typeAdapter.transformProjection) {
            return typeAdapter.transformProjection(sql, valueSourcePrivate.__valueTypeName, typeCategory, output, this._defaultTypeAdapter)
        }
        return this._defaultTypeAdapter.transformProjection(sql, valueSourcePrivate.__valueTypeName, typeCategory, output)
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
        if (!(column instanceof AggregateValueAsArrayValueSource) || !column.__aggregatedArrayDistinct) {
            return undefined
        }
        if (column instanceof AllowWhenAggregateValueAsArrayValueSource && !column.__allowed) {
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
                    return __getTableOrViewPrivate(value).__hasExternalDependencies
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
            if (withView.__type === 'values') {
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
            const columnPrivate = __getColumnPrivate(column)
            columns += this._appendColumnAlias(columnPrivate.__name, context)
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
            if (!onCondition && hasWithData(joinedTableOrView) && joinedTableOrView.__type === 'with' && joinedTableOrView.__ignoreWith) {
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
                    if (__getValueSourcePrivate(value).__uuidString) {
                        uuidText = true
                    } else {
                        otherText = true
                    }
                }
            }
            if (uuidText && otherText) {
                for (const arm of arms) {
                    const value = arm[name]
                    if (value && __getValueSourcePrivate(value).__uuidString) {
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
                    selectQuery += this._appendAggregatedArrayValueProjection(columns[property]!, columnSql)
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
    _appendHavingCondition(having: IAnyBooleanValueSource<any, any>, context: SqlBuildContext): string {
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
            return __isStringValueSource(__getValueSourcePrivate(column))
        } else if (isValueSource(expression)) {
            return __isStringValueSource(__getValueSourcePrivate(expression))
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
        return this._needsCompoundInsensitiveOrderByWrap(query) || this._needsCompoundExpressionOrderByWrap(query) || this._needsCompoundNullsEmulationOrderByWrap(query)
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
            result += ' offset ' + this._appendValue(offset, context, 'int', 'int', undefined, false) + ' rows'
        }
        const limit = query.__limit
        if (limit !== null && limit !== undefined) {
            result += ' fetch next ' + this._appendValue(limit, context, 'int', 'int', undefined, false) + ' rows only'
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
        const nextSequenceValues: Array<{ name: string, valueType: ValueType }> = []
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
            const columnPrivate = __getColumnPrivate(column)
            if (!columnPrivate.__sequenceName) {
                continue
            }

            if (columns) {
                columns += ', '
            }

            columns += this._appendRawColumnName(column, context)
            nextSequenceValues.push({ name: columnPrivate.__sequenceName, valueType: columnPrivate.__valueType })
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
                values += this._nextSequenceValue(context, sequence.name, sequence.valueType)
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
                const columnPrivate = __getColumnPrivate(column)
                const sequenceName = columnPrivate.__sequenceName
                if (!(setPropertyName in sets) && sequenceName) {
                    values += this._nextSequenceValue(context, sequenceName, columnPrivate.__valueType)
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
                        return this._appendRawColumnName(value, context) // same boolean as column
                    }

                    if (columnPrivate.__optionalType === 'required') {
                        // remapped
                        return 'case when ' + this._appendRawColumnName(value, context) + ' = ' + this._appendLiteralValue(valueTypeAdapter.trueValue, context) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' end'
                    } else {
                        // remapped
                        return 'case ' + this._appendRawColumnName(value, context) + ' when ' + this._appendLiteralValue(valueTypeAdapter.trueValue, context) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' when ' + this._appendLiteralValue(valueTypeAdapter.falseValue, context) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' else null end'
                    }
                } else {
                    if (columnPrivate.__optionalType === 'required') {
                        // remapped
                        return 'case when ' + this._appendConditionValue(value, context, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' end'
                    } else {
                        // remapped
                        return 'case ' + this._appendValue(value, context, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' when ' + this._true(context) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' when ' + this._false(context) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' else null end'
                    }
                }
            } else if (isValueSource(value)) {
                // There are some boolean expressions involved
                if (columnPrivate.__optionalType === 'required') {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, context, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' end'
                } else {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, context, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' when not ' + this._appendConditionValueParenthesis(value, context, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' else null end'
                }
            } else {
                if (columnPrivate.__optionalType === 'required') {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, context, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' end'
                } else {
                    // remapped
                    return 'case ' + this._appendValue(value, context, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' when ' + this._true(context) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, context) + ' when ' + this._false(context) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, context) + ' else null end'
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
                e.errorReason.tableName = __getTableOrViewPrivate(__getColumnPrivate(column).__tableOrView).__name
            }
            throw e
        }
    }
    _appendValueForColumn(column: DBColumn, value: any, context: SqlBuildContext, forceTypeCast: boolean): string {
        const sql = this._appendCustomBooleanRemapForColumnIfRequired(column, value, context, forceTypeCast)
        if (sql) {
            return sql
        }
        const columnPrivate = __getColumnPrivate(column)
        // A value given for a column of a table takes the type of the column, not the one of its parameter: its parameter
        // is marked so (see isQueryParamValueForColumn), which a query runner may use not to cast it
        if (hasToSql(value) || __getTableOrViewPrivate(columnPrivate.__tableOrView).__type === 'values') {
            return this._appendValue(value, context, columnPrivate.__valueType, columnPrivate.__valueTypeName, columnPrivate.__typeAdapter, forceTypeCast)
        }
        const oldAssigningValueToColumn = context.assigningValueToColumn
        context.assigningValueToColumn = true
        try {
            return this._appendValue(value, context, columnPrivate.__valueType, columnPrivate.__valueTypeName, columnPrivate.__typeAdapter, forceTypeCast)
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
        const sequences: Array<{ name: string, valueType: ValueType }> = []
        for (const columnName of __columnPathsOf(table)) {
            const column = __getColumnOfObject(table, columnName)
            if (!column) {
                continue
            }
            const columnPrivate = __getColumnPrivate(column)
            if (!columnPrivate.__sequenceName) {
                continue
            }

            if (columns) {
                columns += ', '
            }

            columns += this._appendRawColumnName(column, context)
            sequences.push({ name: columnPrivate.__sequenceName, valueType: columnPrivate.__valueType })
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

            values += this._nextSequenceValue(context, sequence.name, sequence.valueType)
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
        const sequences: Array<{ name: string, valueType: ValueType }> = []
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
            const columnPrivate = __getColumnPrivate(column)
            if (!columnPrivate.__sequenceName) {
                continue
            }

            if (columns) {
                columns += ', '
            }

            columns += this._appendRawColumnName(column, context)
            sequences.push({ name: columnPrivate.__sequenceName, valueType: columnPrivate.__valueType })
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

            values += this._nextSequenceValue(context, sequence.name, sequence.valueType)
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
            const columnPrivate = __getColumnPrivate(column)
            if (!columnPrivate.__sequenceName) {
                continue
            }

            addedColumns.push(columnName)
            columnsForInsert[columnName] = column
            const sequenceValue = new SequenceValueSource('_nextSequenceValue', columnPrivate.__sequenceName, columnPrivate.__valueType, columnPrivate.__valueTypeName, 'required', columnPrivate.__typeAdapter)
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
    _nextSequenceValue( _context: SqlBuildContext, sequenceName: string, _columnType: ValueType) {
        return "nextval('" + sequenceName + "')"
    }
    _currentSequenceValue(_context: SqlBuildContext, sequenceName: string, _columnType: ValueType): string {
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
                if (!isColumn(column)) {
                    // Additional property provided in the value object
                    // Skipped because it is not part of the table
                    // This allows to have more complex objects used in the query
                    continue
                }
                if (!(property in sets)) {
                    // No value set for that property in the shape
                    continue
                }

                const columnPrivate = __getColumnPrivate(column)
                updatePrimaryKey = updatePrimaryKey || columnPrivate.__isPrimaryKey

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
    
                const columnPrivate = __getColumnPrivate(column)
                updatePrimaryKey = updatePrimaryKey || columnPrivate.__isPrimaryKey
    
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
            let where: BooleanValueSource<any, any> | undefined
            for (const property of __columnPathsOf(table)) {
                const column = __getColumnOfObject(table, property)
                if (!column) {
                    continue
                }
                const columnPrivate = __getColumnPrivate(column)
                if (!columnPrivate.__isPrimaryKey) {
                    continue
                }
                const oldCoumn = __getValueSourceOfObject(oldValues, property)
                if (!oldCoumn) {
                    throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'incomplete old value query' }, 'The column ' + property + ' is missing from the old values table')
                }
                const condition = (column as any as EqualableValueSource<any, any, any, any>).equals(oldCoumn)
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
        const columnPrivate = __getColumnPrivate(column)
        return this._escape(columnPrivate.__name, true)
    }
    _appendUpdateOldValueForUpdate(query: UpdateData, updatePrimaryKey: boolean, _requiredTables: Set<AnyTableOrView> | undefined, _context: SqlBuildContext) {
        const oldValues = query.__oldValues
        if (!oldValues) {
            return ''
        }
        const oldValuesPrivate = __getTableOrViewPrivate(oldValues)
        if (!oldValuesPrivate.__as) {
            throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'incomplete old value query' }, 'No alias found for the old values to define the locking strategy')
        }
        let result
        if (updatePrimaryKey) {
            result = ' for update of ' + this._escape(oldValuesPrivate.__as, true)
        } else {
            result = ' for no key update of ' + this._escape(oldValuesPrivate.__as, true)
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

        const oldValuesPrivate = __getTableOrViewPrivate(oldValues)
        if (!oldValuesPrivate.__as) {
            throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'incomplete old value query' }, 'No alias found for the old values')
        }

        const oldForceAliasFor = context.forceAliasFor
        const oldForceAliasAs = context.forceAliasAs
        const oldFakeNameOf = context.fakeNamesOf
        context.fakeNamesOf = undefined

        context.forceAliasFor = query.__table
        context.forceAliasAs = oldValuesPrivate.__as

        from += '(select ' + this._escape(oldValuesPrivate.__as, true) + '.*'

        if (requiredColumns) {
            const additionalColumns = Array.from(requiredColumns).sort((c1, c2) => {
                const c1Private = __getColumnPrivate(c1)
                const c2Private = __getColumnPrivate(c2)
                const t1 = c1Private.__tableOrView
                const t2 = c2Private.__tableOrView
                const t1Private = __getTableOrViewPrivate(t1)
                const t1Name = t1Private.__as || this._tableOrViewName(t1Private, context)
                const t2Private = __getTableOrViewPrivate(t2)
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

                const columnPrivate = __getColumnPrivate(column)
                const tablePrivate = __getTableOrViewPrivate(columnPrivate.__tableOrView)
                if (tablePrivate.__as) {
                    from += this._escape(this._identifierWithoutQuotes(tablePrivate.__as + '__' + columnPrivate.__name), true)
                } else {
                    from += this._escape(this._identifierWithoutQuotes(this._tableOrViewName(tablePrivate, context) + '__' + columnPrivate.__name), true)
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

        from += this._escape(oldValuesPrivate.__as, true)

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
        return isValueSource(value) && __getValueSourcePrivate(value).isConstValue()
    }
    _isNullValue(value: any): boolean {
        if (!this._isValueKnownWhenTheQueryIsBuilt(value)) {
            return false
        }
        if (value === null || value === undefined) {
            return true
        }
        const valueSourceValue = __getValueSourcePrivate(value).getConstValue()
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
        return __getValueSourcePrivate(value).__optionalType !== 'required'
    }
    _hasSameBooleanTypeAdapter(valueSource: DBColumn, value: DBColumn): valueSource is DBColumn  {
        if (isColumn(valueSource) && isColumn(value)) {
            const valueSourcePrivate = __getColumnPrivate(valueSource)
            const valuePrivate = __getColumnPrivate(value)
            if (__isBooleanValueSource(valueSourcePrivate) && __isBooleanValueSource(valuePrivate)) {
                const valueSourceTypeAdapter = valueSourcePrivate.__typeAdapter
                const valueTypeAdapter = valuePrivate.__typeAdapter
                if (valueSourceTypeAdapter instanceof CustomBooleanTypeAdapter && valueTypeAdapter instanceof CustomBooleanTypeAdapter) {
                    return valueSourceTypeAdapter.trueValue === valueTypeAdapter.trueValue && valueSourceTypeAdapter.falseValue === valueTypeAdapter.falseValue
                }
            }
        }
        return false
    }
    // SqlComparator1
    _equals(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, context) + ' = ' + this._appendRawColumnName(value, context)
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' = ' + this._appendValueParenthesis(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value))
    }
    _notEquals(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, context) + ' <> ' + this._appendRawColumnName(value, context)
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' <> ' + this._appendValueParenthesis(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value))
    }
    _is(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, context) + ' is not distinct from ' + this._appendRawColumnName(value, context)
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' is not distinct from ' + this._appendValueParenthesis(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value))
    }
    _isNot(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, context) + ' is distinct from ' + this._appendRawColumnName(value, context)
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' is distinct from ' + this._appendValueParenthesis(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value))
    }
    _equalsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' = ' + this._appendValueParenthesis(value, context, columnType, columnTypeName, typeAdapter, false) + ' collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' = ' + this._appendValueParenthesis(value, context, columnType, columnTypeName, typeAdapter, false)
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') = lower(' + this._appendValue(value, context, columnType, columnTypeName, typeAdapter, false) + ')'
        }
    }
    _notEqualsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' <> ' + this._appendValueParenthesis(value, context, columnType, columnTypeName, typeAdapter, false) + ' collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' <> ' + this._appendValueParenthesis(value, context, columnType, columnTypeName, typeAdapter, false)
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') <> lower(' + this._appendValue(value, context, columnType, columnTypeName, typeAdapter, false) + ')'
        }
    }
    _lessThan(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' < ' + this._appendValueParenthesis(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value))
    }
    _greaterThan(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' > ' + this._appendValueParenthesis(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value))
    }
    _lessOrEqual(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' <= ' + this._appendValueParenthesis(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value))
    }
    _greaterOrEqual(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' >= ' + this._appendValueParenthesis(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value))
    }
    _in(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // An empty array can never match, so short-circuit to the false constant.
        // `<x> in ()` is invalid SQL on every engine, so the guard lives here in the
        // base (not duplicated per dialect) — a dialect that does not override this
        // method still emits valid SQL for the empty-array case.
        if (Array.isArray(value) && value.length <= 0) {
            return this._falseValueForCondition
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' in ' + this._appendSpreadValue(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value))
    }
    _notIn(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // An empty array excludes nothing, so short-circuit to the true constant
        // (`<x> not in ()` is likewise invalid SQL everywhere). See `_in` above.
        if (Array.isArray(value) && value.length <= 0) {
            return this._trueValueForCondition
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' not in ' + this._appendSpreadValue(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value))
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
    _like(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._appendValue(value, context, columnType, columnTypeName, typeAdapter, false) + this._likeEscape
    }
    _notLike(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._appendValue(value, context, columnType, columnTypeName, typeAdapter, false) + this._likeEscape
    }
    _likeInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._appendValueParenthesis(value, context, columnType, columnTypeName, typeAdapter, false) + ' collate ' + this._collationName(collation) + this._likeEscape
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._appendValueParenthesis(value, context, columnType, columnTypeName, typeAdapter, false) + this._likeEscape
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') like lower(' + this._appendValue(value, context, columnType, columnTypeName, typeAdapter, false) + ')' + this._likeEscape
        }
    }
    _notLikeInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._appendValueParenthesis(value, context, columnType, columnTypeName, typeAdapter, false) + ' collate ' + this._collationName(collation) + this._likeEscape
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._appendValueParenthesis(value, context, columnType, columnTypeName, typeAdapter, false) + this._likeEscape
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') not like lower(' + this._appendValue(value, context, columnType, columnTypeName, typeAdapter, false) + ')' + this._likeEscape
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
     * cannot live with that points `concatFunction` at a null-propagating function and
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
    _likePatternStartingWith(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, fold: boolean): string {
        const term = this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false)
        return fold ? 'lower(' + term + " || '%')" : '(' + term + " || '%')"
    }
    _likePatternEndingWith(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, fold: boolean): string {
        const term = this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false)
        return fold ? "lower('%' || " + term + ')' : "('%' || " + term + ')'
    }
    _likePatternContaining(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, fold: boolean): string {
        const term = this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false)
        return fold ? "lower('%' || " + term + " || '%')" : "('%' || " + term + " || '%')"
    }
    _startsWith(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._likePatternStartingWith(context, value, columnType, columnTypeName, typeAdapter, false) + this._likeEscape
    }
    _notStartsWith(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._likePatternStartingWith(context, value, columnType, columnTypeName, typeAdapter, false) + this._likeEscape
    }
    _endsWith(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._likePatternEndingWith(context, value, columnType, columnTypeName, typeAdapter, false) + this._likeEscape
    }
    _notEndsWith(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._likePatternEndingWith(context, value, columnType, columnTypeName, typeAdapter, false) + this._likeEscape
    }
    _startsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._likePatternStartingWith(context, value, columnType, columnTypeName, typeAdapter, false) + ' collate ' + this._collationName(collation) + this._likeEscape
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._likePatternStartingWith(context, value, columnType, columnTypeName, typeAdapter, false) + this._likeEscape
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') like ' + this._likePatternStartingWith(context, value, columnType, columnTypeName, typeAdapter, true) + this._likeEscape
        }
    }
    _notStartsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._likePatternStartingWith(context, value, columnType, columnTypeName, typeAdapter, false) + ' collate ' + this._collationName(collation) + this._likeEscape
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._likePatternStartingWith(context, value, columnType, columnTypeName, typeAdapter, false) + this._likeEscape
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') not like ' + this._likePatternStartingWith(context, value, columnType, columnTypeName, typeAdapter, true) + this._likeEscape
        }
    }
    _endsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._likePatternEndingWith(context, value, columnType, columnTypeName, typeAdapter, false) + ' collate ' + this._collationName(collation) + this._likeEscape
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._likePatternEndingWith(context, value, columnType, columnTypeName, typeAdapter, false) + this._likeEscape
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') like ' + this._likePatternEndingWith(context, value, columnType, columnTypeName, typeAdapter, true) + this._likeEscape
        }
    }
    _notEndsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._likePatternEndingWith(context, value, columnType, columnTypeName, typeAdapter, false) + ' collate ' + this._collationName(collation) + this._likeEscape
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._likePatternEndingWith(context, value, columnType, columnTypeName, typeAdapter, false) + this._likeEscape
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') not like ' + this._likePatternEndingWith(context, value, columnType, columnTypeName, typeAdapter, true) + this._likeEscape
        }
    }
    _contains(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._likePatternContaining(context, value, columnType, columnTypeName, typeAdapter, false) + this._likeEscape
    }
    _notContains(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._likePatternContaining(context, value, columnType, columnTypeName, typeAdapter, false) + this._likeEscape
    }
    _containsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._likePatternContaining(context, value, columnType, columnTypeName, typeAdapter, false) + ' collate ' + this._collationName(collation) + this._likeEscape
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._likePatternContaining(context, value, columnType, columnTypeName, typeAdapter, false) + this._likeEscape
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') like ' + this._likePatternContaining(context, value, columnType, columnTypeName, typeAdapter, true) + this._likeEscape
        }
    }
    _notContainsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._likePatternContaining(context, value, columnType, columnTypeName, typeAdapter, false) + ' collate ' + this._collationName(collation) + this._likeEscape
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._likePatternContaining(context, value, columnType, columnTypeName, typeAdapter, false) + this._likeEscape
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') not like ' + this._likePatternContaining(context, value, columnType, columnTypeName, typeAdapter, true) + this._likeEscape
        }
    }
    // SqlComparator2
    _between(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // Both bounds are compared against the SAME receiver, so they are widened together: one
        // fractional bound decides the data type of the pair.
        const bounds = [value, value2]
        const boundType = this._getWidenedArgumentType(columnType, columnTypeName, bounds)
        const boundTypeName = this._getWidenedArgumentTypeName(columnType, columnTypeName, bounds)
        const boundNeedsTypeCast = this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, bounds)
        return this._appendSqlParenthesis(valueSource, context, false) + ' between ' + this._appendValueParenthesis(value, context, boundType, boundTypeName, typeAdapter, boundNeedsTypeCast) + ' and ' + this._appendValueParenthesis(value2, context, boundType, boundTypeName, typeAdapter, boundNeedsTypeCast)
    }
    _notBetween(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // Both bounds are compared against the SAME receiver, so they are widened together: one
        // fractional bound decides the data type of the pair.
        const bounds = [value, value2]
        const boundType = this._getWidenedArgumentType(columnType, columnTypeName, bounds)
        const boundTypeName = this._getWidenedArgumentTypeName(columnType, columnTypeName, bounds)
        const boundNeedsTypeCast = this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, bounds)
        return this._appendSqlParenthesis(valueSource, context, false) + ' not between ' + this._appendValueParenthesis(value, context, boundType, boundTypeName, typeAdapter, boundNeedsTypeCast) + ' and ' + this._appendValueParenthesis(value2, context, boundType, boundTypeName, typeAdapter, boundNeedsTypeCast)
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
    _const(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        return this._appendValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    _constForCondition(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        return this._appendConditionValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    _exists(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        return 'exists(' + this._appendValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast) + ')'
    }
    _notExists(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        return 'not exists(' + this._appendValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast) + ')'
    }
    // INTERNAL to the builders, deliberately NOT on the `SqlBuilder` interface: it is only ever reached as
    // `this._escapeLikeWildcard(...)` from the `like`/`startsWith`/`contains` emitters, and dialects override it. Its
    // argument order (`value` first) differs from every interface-dispatched op, so exposing it would let a value
    // source be built over it and emit its arguments in the wrong order.
    _escapeLikeWildcard(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (typeof value === 'string') {
            value = value.replace(/\\/g, '\\\\')
            value = value.replace(/%/g, '\\%')
            value = value.replace(/_/g, '\\_')
            return this._appendValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast)
        } else {
            return "replace(replace(replace(" + this._appendValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast) + ", '\\', '\\\\'), '%', '\\%'), '_', '\\_')"
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
     * - `unknown`: the declared type doesn't say. A `customDouble` is declared by the
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
        switch (__getValueSourcePrivate(operand).__valueType) {
            case 'double':
                return 'approximate'
            case 'int':
            case 'bigint':
            case 'customInt':
            case 'customBigint':
            case 'stringDecimal':
            case 'customDecimal':
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
    // `_appendSqlForDatePartArgument` receiver, the `::integer` casts, and `_getMonth`'s
    // `- 1`. Every other dialect overrides all of it. Keep it in step with PostgreSQL:
    // it is not dead code, it is the code PostgreSQL runs.
    _getDate(context: SqlBuildContext, valueSource: ToSql): string {
        return 'extract(day from ' + this._appendSqlForDatePartArgument(valueSource, context) + ')'
    }
    _getTime(context: SqlBuildContext, valueSource: ToSql): string {
        // Mirrors `Date.getTime()`, so the result is in MILLISECONDS. `extract(epoch …)`
        // answers in seconds, including the fractional part.
        return 'round(extract(epoch from ' + this._appendSqlForDatePartArgument(valueSource, context) + ') * 1000)'
    }
    _getFullYear(context: SqlBuildContext, valueSource: ToSql): string {
        return 'extract(year from ' + this._appendSqlForDatePartArgument(valueSource, context) + ')'
    }
    _getMonth(context: SqlBuildContext, valueSource: ToSql): string {
        // Mirrors `Date.getMonth()`, which is 0-based, while `extract(month …)` is 1-based.
        // The `- 1` is why `_operationsThatNeedParenthesis._getMonth` is registered.
        return 'extract(month from ' + this._appendSqlForDatePartArgument(valueSource, context) + ') - 1'
    }
    _getDay(context: SqlBuildContext, valueSource: ToSql): string {
        // `dow` (day of week, 0-based from Sunday) matches `Date.getDay()`. It is a
        // PostgreSQL-only field name — a dialect without it must override this.
        return 'extract(dow from ' + this._appendSqlForDatePartArgument(valueSource, context) + ')'
    }
    _getHours(context: SqlBuildContext, valueSource: ToSql): string {
        return 'extract(hour from ' + this._appendSqlForDatePartArgument(valueSource, context) + ')'
    }
    _getMinutes(context: SqlBuildContext, valueSource: ToSql): string {
        return 'extract(minute from ' + this._appendSqlForDatePartArgument(valueSource, context) + ')'
    }
    _getSeconds(context: SqlBuildContext, valueSource: ToSql): string {
        // `extract(second …)` yields a numeric that INCLUDES the fraction (45.9996), and
        // `numeric::integer` rounds away from zero — so the bare cast reports 46 for
        // :45.9996 and 60 for :59.9996, a value this method's declared type (and the
        // JS `Date.getSeconds()` contract, an integer 0-59) does not allow.
        return 'trunc(extract(second from ' + this._appendSqlForDatePartArgument(valueSource, context) + '))::integer'
    }
    _getMilliseconds(context: SqlBuildContext, valueSource: ToSql): string {
        // Same rounding cast as `_getSeconds`: `extract(millisecond …)` includes the
        // sub-millisecond fraction, so :45.9996 rounds up to 46000, and the `% 1000`
        // then wraps it to 0 instead of 999.
        return 'trunc(extract(millisecond from ' + this._appendSqlForDatePartArgument(valueSource, context) + '))::integer % 1000'
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
        if (!this._isDatabaseOutsideUtc()) {
            return
        }
        const zone = this._connectionConfiguration.databaseTimeZone
        if (!this._supportDatabaseOutsideUtc()) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'databaseTimeZone', value: zone }, 'A databaseTimeZone other than UTC is not supported on this database (' + zone + '): it can\'t complete the zone of a value without zone for every date (see the known limits of the time zones in the documentation)')
        }
        const referenceDate = this._connectionConfiguration.localTimeReferenceDate
        if (referenceDate !== undefined && referenceDate !== 'today' && !/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'localTimeReferenceDate', value: referenceDate }, "localTimeReferenceDate must be a date 'YYYY-MM-DD' or 'today': " + referenceDate)
        }
    }
    _appendSqlForDatePartArgument(valueSource: ToSql, context: SqlBuildContext): string {
        // A const receiver is forced to carry its type cast: an untyped placeholder inside
        // `extract(... from $1)` has no type for the engine to resolve.
        if (isValueSource(valueSource) && __getValueSourcePrivate(valueSource).isConstValue()) {
            return this._appendSql(this._typedOperand(valueSource, []), context, true)
        }
        return this._appendSql(valueSource, context, false)
    }
    _asString(context: SqlBuildContext, valueSource: ToSql): string {
        // Transform an uuid to string
        return this._appendSqlParenthesis(valueSource, context, false)
    }
    _asNullValue(_context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeAdapter && typeAdapter.transformPlaceholder) {
            return typeAdapter.transformPlaceholder('null', columnTypeName, __typeCategoryOf(columnType), null, this._defaultTypeAdapter)
        } else {
            return this._defaultTypeAdapter.transformPlaceholder('null', columnTypeName, __typeCategoryOf(columnType), null)
        }
    }
    // Oracle recursive
    _prior(context: SqlBuildContext, valueSource: ToSql): string {
        return 'prior ' + this._appendSql(valueSource, context, false)
    }
    // SqlFunction1
    _valueWhenNull(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'coalesce(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ')'
    }
    _nullIfValue(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'nullif(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ')'
    }
    _and(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        context.resultingOperation = undefined
        const sql = this._appendConditionSql(valueSource, context, false)
        const op = context.resultingOperation
        context.resultingOperation = undefined
        // With nothing on the left the value stands alone, and in a select it needs its type as any other value
        const sql2 = this._appendConditionValue(value, context, columnType, columnTypeName, typeAdapter, !sql)
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
    _or(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        context.resultingOperation = undefined
        const sql = this._appendConditionSql(valueSource, context, false)
        const op = context.resultingOperation
        context.resultingOperation = undefined
        // With nothing on the left the value stands alone, and in a select it needs its type as any other value
        const sql2 = this._appendConditionValue(value, context, columnType, columnTypeName, typeAdapter, !sql)
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
    _concat(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._concatSql(
            this._appendSqlParenthesisExcluding(valueSource, context, '_concat', false),
            this._appendValueParenthesisExcluding(value, context, columnType, columnTypeName, typeAdapter, '_concat', false)
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
    _concatIgnoringNull(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._isNullValue(value)) {
            if (this._isNullValue(valueSource)) {
                // Nothing left to concatenate: the empty string is what the operation answers.
                return "''"
            }
            return this._appendSqlParenthesisExcluding(valueSource, context, '_concatIgnoringNull', false)
        }
        if (this._isNullValue(valueSource)) {
            return this._appendValueParenthesisExcluding(value, context, columnType, columnTypeName, typeAdapter, '_concatIgnoringNull', false)
        }
        return this._appendConcatIgnoringNull(context, valueSource, value, columnType, columnTypeName, typeAdapter)
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
    _appendConcatIgnoringNull(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        let left = this._appendSqlParenthesisExcluding(valueSource, context, '_concatIgnoringNull', false)
        if (this._isOptionalValue(valueSource)) {
            left = "coalesce(" + left + ", '')"
        }
        let right = this._appendValueParenthesisExcluding(value, context, columnType, columnTypeName, typeAdapter, '_concatIgnoringNull', false)
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
    _substrToEnd(context: SqlBuildContext, valueSource: ToSql, value: any, _columnType: ValueType, _columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'number') {
            if (value < 0) {
                // SQLite counts a negative start from the end and clamps an out-of-range one
                // to the whole string, which is exactly `String.prototype.substr`.
                return 'substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, 'int', 'int', typeAdapter, false) + ')'
            }
            return 'substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value + 1, context, 'int', 'int', typeAdapter, false) + ')'
        } else {
            return 'substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValueParenthesis(value, context, 'int', 'int', typeAdapter, false) + ' + 1)'
        }
    }
    _substringToEnd(context: SqlBuildContext, valueSource: ToSql, value: any, _columnType: ValueType, _columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'number') {
            // `String.prototype.substring` clamps a negative index to 0 — unlike `substr`,
            // it never counts from the end — so the clamp is applied before the `+ 1` and
            // the emitted SQL is the same one a 0 would have produced.
            const start = value < 0 ? 0 : value
            return 'substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(start + 1, context, 'int', 'int', typeAdapter, false) + ')'
        } else {
            return 'substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValueParenthesis(value, context, 'int', 'int', typeAdapter, false) + ' + 1)'
        }
    }
    _getMathArgumentType(columnType: ValueType, _columnTypeName: string, value: any): ValueType {
        // The value of a customDecimal isn't a JavaScript number: a number is the argument of `roundn`
        if (columnType === 'customInt' || columnType === 'customBigint' || columnType === 'customDouble' || (__isDecimalCategory(columnType) && typeof value !== 'number')) {
            return columnType
        }
        if (typeof value === 'number') {
            if (!Number.isInteger(value)) {
                return 'double'
            }
            return 'int'
        }
        if (typeof value === 'bigint') {
            return 'bigint'
        }
        return columnType
    }
    _getMathArgumentTypeName(columnType: ValueType, columnTypeName: string, value: any): string {
        if (columnType === 'customInt' || columnType === 'customBigint' || columnType === 'customDouble' || (__isDecimalCategory(columnType) && typeof value !== 'number')) {
            return columnTypeName
        }
        if (typeof value === 'number') {
            if (!Number.isInteger(value)) {
                return 'double'
            }
            return 'int'
        }
        if (typeof value === 'bigint') {
            return 'bigint'
        }
        return columnTypeName
    }
    _getWidenedArgumentType(columnType: ValueType, _columnTypeName: string, value: any): ValueType {
        // The data type an OPERAND is bound with. It is the receiver's own, except where that type cannot
        // hold the value the caller gave: an `int` receiver and a fractional JS number. The library PICKS
        // this type, so a mismatch here is the library's own bad choice, not an invalid state to report —
        // refusing the value would only preempt the engine, which is the one that understands queries.
        // Widened, `coalesce(<int>, 0.5)` returns the fraction and `<int> < 2.5` answers, both correctly.
        //
        // Positions whose data type is FIXED BY WHAT THE POSITION MEANS do NOT come through here, and must
        // not: a value written into a declared column, a row count (`limit` / `offset`), a character index
        // (`substr` / `substring`). Those would be typed `int` if TypeScript had one, with no `double`
        // overload — nobody CHOOSES their type — so the marshaller's check there is not the library
        // preempting the engine, it is the type check the type system cannot perform.
        if (columnType === 'int' && this._isFractionalNumberOperand(value)) {
            return 'double'
        }
        return columnType
    }
    _getWidenedArgumentTypeName(columnType: ValueType, columnTypeName: string, value: any): string {
        if (columnType === 'int' && this._isFractionalNumberOperand(value)) {
            return 'double'
        }
        return columnTypeName
    }
    _widenedArgumentNeedsTypeCast(columnType: ValueType, columnTypeName: string, value: any): boolean {
        // The operand resolved WIDER than the receiver. The parameter has to carry that type in the SQL, not
        // just in the marshaller — PostgreSQL resolves a bare `$n` from the operator around it (parsing
        // `int4 + $n` pins `$n` to int4) and then refuses the fractional bind before it ever sees the value,
        // so without this the engine never gets to judge the query at all. Only PostgreSQL acts on
        // `forceTypeCast`, so every other dialect emits exactly what it emitted before.
        return this._getWidenedArgumentType(columnType, columnTypeName, value) !== columnType
    }
    /** `in` / `notIn` hand over the whole list and `between` two bounds; one fractional member widens them all. */
    _isFractionalNumberOperand(value: any): boolean {
        if (Array.isArray(value)) {
            return value.some(element => this._isFractionalNumberOperand(element))
        }
        return typeof value === 'number' && !Number.isInteger(value)
    }
    _moduloRequiresFloatHandling(columnType: ValueType, value: any): boolean {
        // `_modulo` only receives the receiver's column type, but the
        // overloaded-number dispatcher promotes the result to `double` whenever
        // either operand is a floating-point value (a `double` / `customDouble`
        // receiver, or an `int` receiver modulo'd by a `double` / `customDouble`
        // operand or a fractional literal). Detect that here so the dialects whose
        // `%` operator rejects floating-point operands (PostgreSQL, SQL Server) can
        // switch to their numeric form regardless of which side is the double.
        // Pure integer / bigint operands keep the plain `%` form (those engines
        // accept it).
        if (columnType === 'double' || columnType === 'customDouble') {
            return true
        }
        if (isValueSource(value)) {
            const valueType = __getValueSourcePrivate(value).__valueType
            return valueType === 'double' || valueType === 'customDouble'
        }
        return typeof value === 'number' && !Number.isInteger(value)
    }
    _power(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'power(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ')'
    }
    _logn(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // The public API `value.logn(n)` means log base n of value, i.e. `log_n(value)`.
        // PostgreSQL, MariaDB, MySQL, SQLite and Oracle all spell this as `LOG(base, value)`
        // — base first. SQL Server's LOG is `LOG(value, base)` and overrides this method.
        return 'log(' + this._appendValue(value, context, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ', ' + this._appendSql(valueSource, context, false) + ')'
    }
    _roundn(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'round(' + this._appendSql(valueSource, context, false) + ', ' + this._appendRoundnScale(value, context, columnType, columnTypeName, typeAdapter) + ')'
    }
    /**
     * The scale of roundn is a whole number of decimals, which TypeScript can't express: a number whose value sent to
     * the database (after the type adapter, which can scale it) is fractional is sent rounded, ties away from zero (the
     * rule of round), as an int, so every database receives the same scale. Anything else is kept, and everything with
     * usePlatformDependentRound
     */
    _roundnScale(value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): { value: any, type: ValueType, typeName: string, typeAdapter: TypeAdapter | undefined } {
        const type = this._getMathArgumentType(columnType, columnTypeName, value)
        const typeName = this._getMathArgumentTypeName(columnType, columnTypeName, value)
        if (typeof value === 'number' && !this._connectionConfiguration.usePlatformDependentRound) {
            const sent = this._transformParamToDB(value, type, typeName, typeAdapter)
            if (typeof sent === 'number' && Number.isFinite(sent) && !Number.isInteger(sent)) {
                return { value: Math.sign(sent) * Math.round(Math.abs(sent)), type: 'int', typeName: 'int', typeAdapter: undefined }
            }
        }
        return { value, type, typeName, typeAdapter }
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
    /** The scale of roundn: a fractional number is rounded, and a value source that isn't an integer where the database truncates it */
    _appendRoundnScale(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const scale = this._roundnScale(value, columnType, columnTypeName, typeAdapter)
        const sql = this._appendValue(scale.value, context, scale.type, scale.typeName, scale.typeAdapter, false)
        if (this._roundnTruncatesTheScale && !this._connectionConfiguration.usePlatformDependentRound && isValueSource(scale.value) && !this._isIntegerOperand(scale.value, scale.type, scale.typeName, scale.typeAdapter)) {
            return this._appendRoundToInteger(sql)
        }
        return sql
    }
    _minimumBetweenTwoValues(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'least(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ')'
    }
    _maximumBetweenTwoValues(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'greatest(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ')'
    }
    /**
     * Shared min/max builder for the dialects whose native `least`/`greatest` (or
     * `iif`) IGNORES a NULL operand — PostgreSQL and SQL Server. `minValue`/`maxValue`
     * compute their result optionality with `mergeOptional` (optional if EITHER operand
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
     *   - `userFunction` (`minValueFunction`/`maxValueFunction`) — a user-provided
     *     null-propagating function emitted as `func(a, b)`, so the operand is not repeated.
     *
     * The operand appears twice in the optional cases (null check + `<inner>`); accepted,
     * because only a value the DATABASE resolves is checked at all — a constant's null state
     * is settled while the query is built — and the user-function opt-in exists for the rare
     * expensive value-source receiver.
     */
    _minAndMaxValueBetweenTwoValuesPoisoningNull(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, userFunction: string | undefined, functionName: string): string {
        const argumentType = this._getMathArgumentType(columnType, columnTypeName, value)
        const argumentTypeName = this._getMathArgumentTypeName(columnType, columnTypeName, value)
        const argumentNeedsTypeCast = this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)
        if (this._connectionConfiguration.ignoreNullInMinAndMaxValue) {
            // Opt-out: keep the engine's native least/greatest, which ignores a NULL operand.
            return this._minAndMaxValueSelection(context, valueSource, value, argumentType, argumentTypeName, typeAdapter, functionName, argumentNeedsTypeCast)
        }
        if (userFunction) {
            // Opt-in: a user-provided null-propagating function; it poisons NULL itself, no CASE.
            return userFunction + '(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, argumentType, argumentTypeName, typeAdapter, argumentNeedsTypeCast) + ')'
        }
        if (this._isNullValue(valueSource) || this._isNullValue(value)) {
            // A NULL operand poisons the result, and this operand is already known to be NULL
            // here, so the result is NULL: asking the database to compute a value it cannot
            // reach is pure noise.
            return this._asNullValue(context, argumentType, argumentTypeName, typeAdapter)
        }
        const receiverOptional = this._canBeNullWhenTheQueryRuns(valueSource)
        const operandOptional = this._canBeNullWhenTheQueryRuns(value)
        if (!receiverOptional && !operandOptional) {
            // Nothing can be null, emit the bare native form.
            return this._minAndMaxValueSelection(context, valueSource, value, argumentType, argumentTypeName, typeAdapter, functionName, argumentNeedsTypeCast)
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
        return 'case when ' + nullCheck + ' then null else ' + this._minAndMaxValueSelection(context, valueSource, value, argumentType, argumentTypeName, typeAdapter, functionName, argumentNeedsTypeCast) + ' end'
    }
    /**
     * The bare two-value min/max selection with NO null handling: `<functionName>(a, b)`,
     * i.e. `least` / `greatest` — the coherent base form, used by PostgreSQL (and reachable
     * by any dialect that keeps `least`/`greatest`). SQL Server overrides this to emulate
     * the pair with `iif` on the versions where `least`/`greatest` do not exist.
     */
    _minAndMaxValueSelection(context: SqlBuildContext, valueSource: ToSql, value: any, argumentType: ValueType, argumentTypeName: string, typeAdapter: TypeAdapter | undefined, functionName: string, argumentNeedsTypeCast: boolean): string {
        return functionName + '(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, argumentType, argumentTypeName, typeAdapter, argumentNeedsTypeCast) + ')'
    }
    _add(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesisExcluding(valueSource, context, '_add', false) + ' + ' + this._appendValueParenthesisExcluding(value, context, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, '_add', this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value))
    }
    _subtract(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesisExcluding(valueSource, context, '_subtract', false) + ' - ' + this._appendValueParenthesis(value, context, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value))
    }
    _multiply(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesisExcluding(valueSource, context, '_multiply', false) + ' * ' + this._appendValueParenthesisExcluding(value, context, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, '_multiply', this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value))
    }
    _divide(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // `divide` always yields a double — it mirrors JavaScript's `/`, which has no
        // integer division. Engines are not so kind: dividing two exact operands either
        // truncates the quotient (MySQL / MariaDB cut it at div_precision_increment
        // decimals) or drops the fraction outright (`1 / 3` is `0` on PostgreSQL and
        // SQL Server). A single floating point operand makes the whole division floating
        // point on every dialect, so the cast is emitted only when neither operand is
        // already known to be one.
        const dividend = this._appendSqlParenthesis(valueSource, context, false)
        const divisor = this._appendValueParenthesis(value, context, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value))
        if (this._numericKindOf(valueSource) === 'approximate' || this._numericKindOf(value) === 'approximate') {
            return dividend + ' / ' + divisor
        }
        return this._appendCastAsDouble(dividend) + ' / ' + divisor
    }
    _modulo(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, context, false) + ' % ' + this._appendValueParenthesis(value, context, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value))
    }
    _atan2(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'atan2(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ')'
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
    _substr(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, _columnType: ValueType, _columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        value2 = this._clampSubstrCount(value2)
        if (typeof value === 'number') {
            if (value < 0) {
                // The 3-argument form does NOT clamp an out-of-range negative start the way
                // the 2-argument one does: `substr('abcdef', -10, 2)` is '' here, where JS
                // clamps the start to 0 and answers 'ab'. So the tail is taken with the
                // 2-argument form — which clamps — and the count applied to that tail. This
                // nests rather than guarding with `max(start, -length(x))` so the receiver is
                // still referenced ONCE: a guard would emit it (and bind it) twice.
                return 'substr(substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, 'int', 'int', typeAdapter, false) + '), 1, ' + this._appendValue(value2, context, 'int', 'int', typeAdapter, false) + ')'
            }
            return 'substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value + 1, context, 'int', 'int', typeAdapter, false) + ', ' + this._appendValue(value2, context, 'int', 'int', typeAdapter, false) + ')'
        } else {
            return 'substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValueParenthesis(value, context, 'int', 'int', typeAdapter, false) + ' + 1, ' + this._appendValue(value2, context, 'int', 'int', typeAdapter, false) + ')'
        }
    }
    _substring(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, _columnType: ValueType, _columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'number' && typeof value2 === 'number') {
            // `String.prototype.substring` clamps both indexes to 0 and SWAPS them when
            // start > end: `'abcdef'.substring(2, 0)` is 'ab', not an error. Emitting the
            // arguments as given produced a negative length, which PostgreSQL rejects
            // outright ("negative substring length not allowed") — a crash on a legal call.
            const [start, end] = this._clampAndOrderSubstringBounds(value, value2)
            return 'substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(start + 1, context, 'int', 'int', typeAdapter, false) + ', ' + this._appendValue(end - start, context, 'int', 'int', typeAdapter, false) + ')'
        }
        if (typeof value === 'number') {
            const start = value < 0 ? 0 : value
            if (start === 0) {
                return 'substr(' + this._appendSql(valueSource, context, false) + ', 1, ' + this._appendValue(value2, context, 'int', 'int', typeAdapter, false) + ')'
            }
            return 'substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(start + 1, context, 'int', 'int', typeAdapter, false) + ', ' + this._appendValue(value2, context, 'int', 'int', typeAdapter, false) + ' - ' + this._appendValue(start, context, 'int', 'int', typeAdapter, false) + ')'
        } else {
            return 'substr(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValueParenthesis(value, context, 'int', 'int', typeAdapter, false) + ' + 1, ' + this._appendValue(value2, context, 'int', 'int', typeAdapter, false) + ' - ' + this._appendValue(value, context, 'int', 'int', typeAdapter, false) + ')'
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
    _replaceAll(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'replace(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, columnType, columnTypeName, typeAdapter, false) + ', ' + this._appendValue(value2, context, columnType, columnTypeName, typeAdapter, false) + ')'
    }
    /**
     * Case-insensitive `replaceAll`. The base form is the SQLite behaviour: emit the
     * configured UDF (`replaceAllInsensitiveFunction`) when the connection names one, and
     * otherwise fall back to plain case-sensitive `replace(...)` — documented, never an
     * error. The engines whose `REPLACE`/`REGEXP_REPLACE` can fold case override this:
     * SQL Server / Oracle (collation-driven), MySQL / MariaDB / PostgreSQL (regex-driven).
     */
    _replaceAllInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const fn = this._connectionConfiguration.replaceAllInsensitiveFunction
        if (fn) {
            return fn + '(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, columnType, columnTypeName, typeAdapter, false) + ', ' + this._appendValue(value2, context, columnType, columnTypeName, typeAdapter, false) + ')'
        }
        return this._replaceAll(context, valueSource, value, value2, columnType, columnTypeName, typeAdapter)
    }
    /**
     * Escape a search term for use as a regular-expression pattern in the regex-driven
     * `replaceAllInsensitive` engines (MySQL / MariaDB / PostgreSQL). Mirrors
     * `_escapeLikeWildcard`: a known string literal is escaped in JS at build time (the
     * regex metacharacter set) and bound as a parameter; a value source is escaped at the
     * SQL level with nested `replace(...)`. The backslash is escaped first so the
     * backslashes added for the other metacharacters are not doubled again.
     */
    _escapeRegexpForReplace(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (typeof value === 'string') {
            return this._appendValue(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), context, columnType, columnTypeName, typeAdapter, forceTypeCast)
        }
        let sql = this._appendValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast)
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
    _escapeRegexpReplacement(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (typeof value === 'string') {
            return this._appendValue(value.replace(/\\/g, '\\\\'), context, columnType, columnTypeName, typeAdapter, forceTypeCast)
        }
        return "replace(" + this._appendValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast) + ", '\\', '\\\\')"
    }
    _typedConst(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // A const that must carry its type (see _typedOperand)
        return this._const(context, value, columnType, columnTypeName, typeAdapter, true)
    }
    _typedConstForCondition(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._constForCondition(context, value, columnType, columnTypeName, typeAdapter, true)
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
    _buildCallProcedure(context: SqlBuildContext, procedureName: string, procedureParams: AnyValueSource[]): string {
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
    _appendFunctionCall(context: SqlBuildContext, functionName: string, functionParams: AnyValueSource[]): string {
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
        const as = __getTableOrViewPrivate(tableOrView).__as
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
        return 'max(' + this._appendSql(value, context, false) + ')'
    }
    _min(context: SqlBuildContext, value: any): string {
        return 'min(' + this._appendSql(value, context, false) + ')'
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
            return 'group_concat(' + this._appendSql(value, context, false) + ', ' + this._appendValue(separator, context, 'string', 'string', undefined, false) + ')'
        }
    }
    _stringConcatDistinct(context: SqlBuildContext, separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'group_concat(distinct ' + this._appendSql(value, context, false) + ')'
        } else if (separator === '') {
            return 'group_concat(distinct ' + this._appendSql(value, context, false) + ", '')"
        } else {
            return 'group_concat(distinct ' + this._appendSql(value, context, false) + ', ' + this._appendValue(separator, context, 'string', 'string', undefined, false) + ')'
        }
    }
    _aggregateValueAsArray(valueSource: IAggregatedArrayValueSource<any, any, any>, context: SqlBuildContext): string {
        const valueSourcePrivate = __getValueSourcePrivate(valueSource)
        const aggregatedArrayColumns = valueSourcePrivate.__aggregatedArrayColumns!
        const aggregatedArrayDistinct = valueSourcePrivate.__aggregatedArrayDistinct!
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
            return 'json_agg(' + distict + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, this._appendSql(this._typedOperand(aggregatedArrayColumns, []), context, false)) + ')'
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "', " + this._appendAggregatedArrayValueProjection(columns[prop]!, this._appendSql(this._typedOperand(columns[prop]!, []), context, false))
            }

            return 'json_agg(' +  distict + 'json_build_object(' + result + '))'
        }
    }
    _appendAggregateArrayWrappedColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, _context: SqlBuildContext, aggregateId: number): string {
        if (isValueSource(aggregatedArrayColumns)) {
            return 'json_agg(' + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, 'a_' + aggregateId + '_.result') + ')'
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "', " + this._appendAggregatedArrayValueProjection(columns[prop]!, 'a_' + aggregateId + '_.' + this._escape(prop, true))
            }

            return 'json_agg(json_build_object(' + result + '))'
        }
    }
}
