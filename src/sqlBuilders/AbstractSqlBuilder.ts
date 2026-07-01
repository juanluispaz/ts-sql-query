import type { ToSql, SqlBuilder, DeleteData, InsertData, UpdateData, SelectData, PlainSelectData, SqlOperation, WithQueryData, CompoundOperator, JoinData, QueryColumns, FlatQueryColumns, WithSelectData, WithValuesData, OrderByEntry } from './SqlBuilder.js'
import { flattenQueryColumns, getQueryColumn } from './SqlBuilder.js'
import type { AnyTableOrView, __ITableOrViewPrivate } from '../utils/ITableOrView.js'
import { __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import type { AnyValueSource, BooleanValueSource, EqualableValueSource, IAggregatedArrayValueSource, IAnyBooleanValueSource, IExecutableDeleteQuery, IExecutableInsertQuery, IExecutableSelectQuery, IExecutableUpdateQuery, __AggregatedArrayColumns, __ValueSourcePrivate, ValueType } from '../expressions/values.js'
import { isValueSource, __getValueSourceOfObject, __isStringValueSource, __isBooleanValueSource } from '../expressions/values.js'
import { isDefault } from '../expressions/Default.js'
import type { __ColumnPrivate, DBColumn } from '../utils/Column.js'
import { isColumn } from '../utils/Column.js'
import type { DefaultTypeAdapter, TypeAdapter } from '../TypeAdapter.js'
import { CustomBooleanTypeAdapter } from '../TypeAdapter.js'
import type { ConnectionConfiguration } from '../utils/ConnectionConfiguration.js'
import { SequenceValueSource } from '../internal/ValueSourceImpl.js'
import { hasToSql, operationOf } from './SqlBuilder.js'
import { __getTableOrViewPrivate } from '../utils/ITableOrView.js'
import { __getColumnOfObject, __getColumnPrivate } from '../utils/Column.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { getWithData } from './SqlBuilder.js'
import { __getValueSourcePrivate } from '../expressions/values.js'
import type { RawFragment } from '../utils/RawFragment.js'
import { TsSqlProcessingError } from '../TsSqlError.js'

export class AbstractSqlBuilder implements SqlBuilder {
    // @ts-ignore
    _defaultTypeAdapter: DefaultTypeAdapter
    // @ts-ignore
    _queryRunner: QueryRunner
    // @ts-ignore
    _connectionConfiguration: ConnectionConfiguration
    _operationsThatNeedParenthesis: { [operation in keyof SqlOperation]?: boolean | undefined }
    _unique = 1
    constructor() {
        this._operationsThatNeedParenthesis = {
            _equals: true,
            _notEquals: true,
            _is: true,
            _isNot: true,
            _equalsInsensitive: true,
            _notEqualsInsensitive: true,
            _lessThan: true,
            _greaterThan: true,
            _lessOrEqual: true,
            _greaterOrEqual: true,
            _and: true,
            _or: true,
            _concat: true,
            _add: true,
            _subtract: true,
            _multiply: true,
            _divide: true,
            _modulo: true,
            _fragment: true
        }
    }
    _generateUnique(): number {
        return this._unique++
    }
    _resetUnique(): void {
        this._unique = 1
    }
    _getSafeTableOrView(params: any[]): AnyTableOrView | undefined {
        return (params as any)._safeTableOrView
    }
    _setSafeTableOrView(params: any[], tableOrView: AnyTableOrView | undefined): void {
        Object.defineProperty(params, '_safeTableOrView', {
            value: tableOrView,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
    /**
     * The safe table/view the surrounding SELECT clause rendered its columns
     * against. The ORDER BY build resets `_safeTableOrView` to `undefined` so
     * value-source terms are emitted qualified, but a term that resolves an
     * output alias to its source column must render exactly as that column
     * appears in the SELECT clause (bare on a single-table select), so that
     * `lower(...)` / `collate` references a real column and stays readable.
     * `_appendOrderByColumnExpression` applies this slot when resolving an
     * alias; the build sites set it to the select-clause safe table.
     */
    _getOrderBySafeTableOrView(params: any[]): AnyTableOrView | undefined {
        return (params as any)._orderBySafeTableOrView
    }
    _setOrderBySafeTableOrView(params: any[], tableOrView: AnyTableOrView | undefined): void {
        Object.defineProperty(params, '_orderBySafeTableOrView', {
            value: tableOrView,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
    _getForceAliasAs(params: any[]): string | undefined {
        return (params as any)._forceAliasAs
    }
    _setForceAliasAs(params: any[], value: string | undefined): void {
        Object.defineProperty(params, '_forceAliasAs', {
            value: value,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
    _getForceAliasFor(params: any[]): AnyTableOrView | undefined {
        return (params as any)._forceAliasFor
    }
    _setForceAliasFor(params: any[], value: AnyTableOrView | undefined): void {
        Object.defineProperty(params, '_forceAliasFor', {
            value: value,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
    _getFakeNamesOf(params: any[]): Set<AnyTableOrView> | undefined {
        return (params as any)._fakeNamesOf
    }
    _setFakeNamesOf(params: any[], value: Set<AnyTableOrView> | undefined): void {
        Object.defineProperty(params, '_fakeNamesOf', {
            value: value,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
    _generateExternalWith(params: any[]): boolean {
        return !!(params as any)._generateExternalWith
    }
    _setGenerateExternalWith(params: any[], value: boolean): void {
        Object.defineProperty(params, '_generateExternalWith', {
            value: value,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
    _isWithGenerated(params: any[]): boolean {
        return !!(params as any)._withGenerated
    }
    _setWithGenerated(params: any[], value: boolean): void {
        Object.defineProperty(params, '_withGenerated', {
            value: value,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
    _isWithGeneratedFinished(params: any[]): boolean {
        return !!(params as any)._withGeneratedFinished
    }
    _setWithGeneratedFinished(params: any[], value: boolean): void {
        Object.defineProperty(params, '_withGeneratedFinished', {
            value: value,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
    _isAggregateArrayWrapped(params: any[]): boolean {
        return !!(params as any)._isAggregateArrayWrapped
    }
    _setAggregateArrayWrapped(params: any[], value: boolean): void {
        Object.defineProperty(params, '_isAggregateArrayWrapped', {
            value: value,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
    _getResultingOperation(params: any[]): '_and' | '_or' | undefined {
        return (params as any)._resultingOperation
    }
    _setResultingOperation(params: any[], value: '_and' | '_or' | undefined): void {
        Object.defineProperty(params, '_resultingOperation', {
            value: value,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
    // Read in the query runner
    _getContainsInsertReturningClause(params: any[]): boolean | undefined {
        return (params as any)._containsInsertReturningClause
    }
    _setContainsInsertReturningClause(params: any[], value: boolean | undefined): void {
        Object.defineProperty(params, '_containsInsertReturningClause', {
            value: value,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
    // Read in the query runner (see AbstractQueryRunner.getForcedAffectedRowCount).
    // Set when the affected-row count is known while building the query but the
    // driver can't report it at execution time (Oracle's multi-row INSERT, which
    // is emitted as an anonymous PL/SQL block — Oracle drivers don't populate
    // rowsAffected for PL/SQL blocks). The query runner returns this value as the
    // affected-row count instead of the driver's (absent) one.
    _setForcedAffectedRowCount(params: any[], value: number | undefined): void {
        Object.defineProperty(params, '_forcedAffectedRowCount', {
            value: value,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
    _ensureRootQuery(query: SelectData | InsertData | UpdateData | DeleteData, params: any[]) {
        const rootQuery = (params as any)._rootQuery
        if (!rootQuery) {
            Object.defineProperty(params, '_rootQuery', {
                value: query,
                writable: true,
                enumerable: false,
                configurable: true
            })
        }
    }
    _isCurrentRootQuery(query: SelectData | InsertData | UpdateData | DeleteData, params: any[]) {
        const rootQuery = (params as any)._rootQuery
        return rootQuery === query
    }
    _resetRootQuery(query: SelectData | InsertData | UpdateData | DeleteData, params: any[]) {
        const rootQuery = (params as any)._rootQuery
        if (rootQuery === query) {
            Object.defineProperty(params, '_rootQuery', {
                value: undefined,
                writable: true,
                enumerable: false,
                configurable: true
            })
        }
    }
    _getRootQuery(params: any[]): object | undefined {
        return (params as any)._containsInsertReturningClause
    }
    _setRootQuery(params: any[], value: object | undefined): void {
        Object.defineProperty(params, '_rootQuery', {
            value: value,
            writable: true,
            enumerable: false,
            configurable: true
        })
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
    _escape(identifier: string, strict: boolean): string {
        return this._connectionConfiguration.escape(identifier, strict)
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
    _appendColumnName(column: DBColumn, params: any[]): string {
        const columnPrivate = __getColumnPrivate(column)
        const typeAdapter = columnPrivate.__typeAdapter
        if (__isBooleanValueSource(columnPrivate) && typeAdapter instanceof CustomBooleanTypeAdapter) {
            return '(' + this._appendRawColumnName(column, params) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, params) + ')'
        }
        return this._appendRawColumnName(column, params)
    }
    _appendColumnNameForCondition(column: DBColumn, params: any[]): string {
        const columnPrivate = __getColumnPrivate(column)
        const typeAdapter = columnPrivate.__typeAdapter
        if (__isBooleanValueSource(columnPrivate) && typeAdapter instanceof CustomBooleanTypeAdapter) {
            return this._appendRawColumnName(column, params) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, params)
        }
        return this._appendRawColumnName(column, params)
    }
    _appendRawColumnName(column: DBColumn, params: any[]): string {
        const columnPrivate = __getColumnPrivate(column)
        const tableOrView = columnPrivate.__tableOrView
        const tablePrivate = __getTableOrViewPrivate(tableOrView)

        const forceAliasFor = this._getForceAliasFor(params)
        const forceAliasAs = this._getForceAliasAs(params)
        const fakeNamesOf = this._getFakeNamesOf(params)

        if (tablePrivate.__valuesForInsert) {
            return this._appendRawColumnNameForValuesForInsert(column, params)
        }

        if (forceAliasFor === tableOrView && forceAliasAs) {
            return this._escape(forceAliasAs, true) + '.' + this._escape(columnPrivate.__name, true)
        }

        if (fakeNamesOf && fakeNamesOf.has(tableOrView)) {
            if (tablePrivate.__as) {
                return this._escape('_old_', true) + '.' + this._escape(tablePrivate.__as + '__' + columnPrivate.__name, true)
            } else {
                return this._escape('_old_', true) + '.' + this._escape(tablePrivate.__name + '__' + columnPrivate.__name, true)
            }
        }

        if (tablePrivate.__as) {
            return this._escape(tablePrivate.__as, true) + '.' + this._escape(columnPrivate.__name, true)
        } else if (this._getSafeTableOrView(params) === tableOrView) {
                return this._escape(columnPrivate.__name, true)
        } else {
            return this._escape(tablePrivate.__name, false) + '.' + this._escape(columnPrivate.__name, true)
        }
    }
    _appendRawColumnNameForValuesForInsert(column: DBColumn, _params: any[]): string {
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
    _appendLiteralValue(value: number | string, _params: any[]) {
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
    _appendUnsafeLiteralValue(value: string, _params: any[]) {
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
    _appendTableOrViewName(table: AnyTableOrView, params: any[]): string {
        const t = __getTableOrViewPrivate(table)
        if (t.__template) {
            return this._appendRawFragment(t.__template, params)
        }

        const forceAliasFor = this._getForceAliasFor(params)
        const forceAliasAs = this._getForceAliasAs(params)

        let result = this._appendTableOrViewNameForFrom(table, params)
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
            const alias = this._appendTableOrViewNoAliasForFrom(table, params)
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
    _appendTableOrViewNameForFrom(table: AnyTableOrView, _params: any[]): string {
        const t = __getTableOrViewPrivate(table)
        return this._escape(t.__name, false)
    }
    _appendTableOrViewNoAliasForFrom(_table: AnyTableOrView, _params: any[]): string {
        return ''
    }
    _appendRawFragment(rawFragment: RawFragment<any>, params: any[]): string {
        return this._appendSql(rawFragment as any as ToSql, params, false) // RawFragment has a hidden implemetation of ToSql
    }
    _appendCondition(condition: IAnyBooleanValueSource<any, any>, params: any[]): string {
        if (hasToSql(condition)) {
            return this._appendConditionSql(condition, params, false)
        }
        throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'invalid value source' }, 'Conditions must have a __toSqlForCondition method')
    }
    _appendConditionParenthesis(condition: IAnyBooleanValueSource<any, any>, params: any[]): string {
        if (this._needParenthesis(condition)) {
            return '(' + this._appendCondition(condition, params) + ')'
        }
        return this._appendCondition(condition, params)
    }
    _appendConditionParenthesisExcuding(condition: IAnyBooleanValueSource<any, any>, params: any[], excluding: keyof SqlOperation): string {
        if (this._needParenthesisExcluding(condition, excluding)) {
            return '(' + this._appendCondition(condition, params) + ')'
        }
        return this._appendCondition(condition, params)
    }
    _appendSql(value: ToSql | AnyValueSource | IExecutableSelectQuery<any, any, any> | IExecutableInsertQuery<any, any> | IExecutableUpdateQuery<any, any> | IExecutableDeleteQuery<any, any>, params: any[], forceTypeCast: boolean): string {
        return (value as ToSql).__toSql(this, params, forceTypeCast) // All ValueSource or Column have a hidden implemetation of ToSql
    }
    _appendSqlParenthesis(value: ToSql | AnyValueSource, params: any[], forceTypeCast: boolean): string {
        if (this._needParenthesis(value)) {
            return '(' + this._appendSql(value, params, forceTypeCast) + ')'
        }
        return this._appendSql(value, params, forceTypeCast)
    }
    _appendSqlParenthesisExcluding(value: ToSql | AnyValueSource, params: any[], excluding: keyof SqlOperation, forceTypeCast: boolean): string {
        if (this._needParenthesisExcluding(value, excluding)) {
            return '(' + this._appendSql(value, params, forceTypeCast) + ')'
        }
        return this._appendSql(value, params, forceTypeCast)
    }
    _appendSpreadValue(value: any, params: any[], columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (hasToSql(value)) {
            return '(' + this._appendSql(value, params, forceTypeCast) + ')'
        }
        if (Array.isArray(value)) {
            if (value.length <= 0) {
                return '()'
            }

            let arrayResult = '(' + this._appendValue(value[0], params, columnType, columnTypeName, typeAdapter, forceTypeCast)

            for (let i = 1, length = value.length; i < length; i++) {
                arrayResult += ', ' + this._appendValue(value[i], params, columnType, columnTypeName, typeAdapter, forceTypeCast)
            }
            return arrayResult + ')'
        }
        const adaptedValue = this._transformParamToDB(value, columnType, columnTypeName, typeAdapter)
        return '(' + this._appendParam(adaptedValue, params, columnType, columnTypeName, typeAdapter, forceTypeCast) + ')'
    }
    _appendValue(value: any, params: any[], columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (hasToSql(value)) {
            return this._appendSql(value, params, forceTypeCast)
        }
        const adaptedValue = this._transformParamToDB(value, columnType, columnTypeName, typeAdapter)
        return this._appendParam(adaptedValue, params, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    _appendValueParenthesis(value: any, params: any[], columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (this._needParenthesis(value)) {
            return '(' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast) + ')'
        }
        return this._appendValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    _appendValueParenthesisExcluding(value: any, params: any[], columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, excluding: keyof SqlOperation, forceTypeCast: boolean): string {
        if (this._needParenthesisExcluding(value, excluding)) {
            return '(' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast) + ')'
        }
        return this._appendValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    _appendConditionSql(value: ToSql | AnyValueSource, params: any[], forceTypeCast: boolean): string {
        return (value as ToSql).__toSqlForCondition(this, params, forceTypeCast) // All ValueSource or Column have a hidden implemetation of ToSql
    }
    _appendConditionSqlParenthesisExcluding(value: ToSql | AnyValueSource, params: any[], excluding: keyof SqlOperation, forceTypeCast: boolean): string {
        if (this._needParenthesisExcluding(value, excluding)) {
            return '(' + this._appendConditionSql(value, params, forceTypeCast) + ')'
        }
        return this._appendConditionSql(value, params, forceTypeCast)
    }
    _appendConditionSqlParenthesis(value: ToSql | AnyValueSource, params: any[], forceTypeCast: boolean): string {
        if (this._needParenthesis(value)) {
            return '(' + this._appendConditionSql(value, params, forceTypeCast) + ')'
        }
        return this._appendConditionSql(value, params, forceTypeCast)
    }
    _appendConditionValue(value: any, params: any[], columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (hasToSql(value)) {
            return this._appendConditionSql(value, params, forceTypeCast)
        }
        const adaptedValue = this._transformParamToDB(value, columnType, columnTypeName, typeAdapter)
        return this._appendConditionParam(adaptedValue, params, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    _appendConditionValueParenthesis(value: any, params: any[], columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (this._needParenthesis(value)) {
            return '(' + this._appendConditionValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast) + ')'
        }
        return this._appendConditionValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    _appendConditionValueParenthesisExcluding(value: any, params: any[], columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, excluding: keyof SqlOperation, forceTypeCast: boolean): string {
        if (this._needParenthesisExcluding(value, excluding)) {
            return '(' + this._appendConditionValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast) + ')'
        }
        return this._appendConditionValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    _transformParamToDB(value: any, _columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): any {
        if (typeAdapter) {
            return typeAdapter.transformValueToDB(value, columnTypeName, this._defaultTypeAdapter)
        } else {
            return this._defaultTypeAdapter.transformValueToDB(value, columnTypeName)
        }
    }
    _appendParam(value: any, params: any[], _columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        const placeholder = this._queryRunner.addParam(params, value)
        if (typeAdapter && typeAdapter.transformPlaceholder) {
            return typeAdapter.transformPlaceholder(placeholder, columnTypeName, forceTypeCast, value, this._defaultTypeAdapter)
        } else {
            return this._defaultTypeAdapter.transformPlaceholder(placeholder, columnTypeName, forceTypeCast, value)
        }
    }
    _appendConditionParam(value: any, params: any[], columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        return this._appendParam(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    _appendColumnAlias(name: string, _params: any[]): string {
        return this._escape(name, true)
    }
    _appendColumnValue(value: AnyValueSource, params: any[], _isOutermostQuery: boolean): string {
        return this._appendSql(value, params, false)
    }
    _buildWith(withData: WithQueryData, params: any[]): string {
        let withs = withData.__withs
        if (this._isWithGenerated(params)) {
            if (this._generateExternalWith(params)) {
                withs = withData.__withs.filter(value => {
                    return __getTableOrViewPrivate(value).__hasExternalDependencies
                })
                this._setGenerateExternalWith(params, false)
            } else {
                return ''
            }
        } else {
            withs = withData.__withs
            this._setWithGenerated(params, true)
        }

        if (withs.length <= 0) {
            this._setWithGeneratedFinished(params, true)
            return ''
        }
        let result = ''
        let recursive = false
        for (let i = 0, length = withs.length; i < length; i++) {
            const withView = getWithData(withs[i]!)
            if (withView.__type === 'values') {
                const values = this._buildWithValues(withView, params)
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
            result += withView.__name
            result += this._appendWithColumns(withView, params)
            result += ' as '
            if (customization && customization.beforeWithQuery) {
                result += this._appendRawFragment(customization.beforeWithQuery, params) + ' '
            }
            result += '('
            result += this._buildSelect(withView.__selectData, params)
            result += ')'
            if (customization && customization.afterWithQuery) {
                result += ' ' + this._appendRawFragment(customization.afterWithQuery, params)
            }
            recursive = recursive || !!withView.__recursive
        }
        this._setWithGeneratedFinished(params, true)
        return this._appendWithKeyword(recursive) + ' ' + result + ' '
    }
    _buildWithValues(withValues: WithValuesData, params: any[]) {
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
                valueSql += this._appendValueForColumn(column, value[columnName], params, false)
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
    _appendWithColumns(_withData: WithSelectData, _params: any[]): string {
        return ''
    }
    _appendWithKeyword(recursive: boolean): string {
        if (recursive) {
            return 'with recursive'
        }
        return 'with'
    }
    _inlineSelectAsValue(query: SelectData, params: any[]): string {
        const result = '(' + this._buildInlineSelect(query, params) + ')'
        return result
    }
    _inlineSelectAsValueForCondition(query: SelectData, params: any[]): string {
        const result = '(' + this._buildInlineSelect(query, params) + ')'
        return result
    }
    _buildInlineSelect(query: SelectData, params: any[]): string {
        const oldWithGeneratedFinished = this._isWithGeneratedFinished(params)
        const oldGenerateExternalWith = this._generateExternalWith(params)
        this._setGenerateExternalWith(params, true)
        this._setWithGeneratedFinished(params, false)
        const result = this._buildSelectWithColumnsInfo(query, params, {}, false)
        this._setWithGeneratedFinished(params, oldWithGeneratedFinished)
        this._setGenerateExternalWith(params, oldGenerateExternalWith)
        return result
    }
    _buildSelect(query: SelectData, params: any[]): string {
        this._ensureRootQuery(query, params)
        const isOutermostQuery = this._isCurrentRootQuery(query, params)
        const result = this._buildSelectWithColumnsInfo(query, params, {}, isOutermostQuery)
        this._resetRootQuery(query, params)
        return result
    }
    _appendCompoundOperator(compoundOperator: CompoundOperator, _params: any[]): string {
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
    _buildSelectWithColumnsInfoForCompound(query: SelectData, params: any[], columnsForInsert: { [name: string]: DBColumn | undefined }, isOutermostQuery: boolean): string {
        const result = this._buildSelectWithColumnsInfo(query, params, columnsForInsert, isOutermostQuery)
        if (query.__limit !== undefined || query.__offset !== undefined || query.__orderBy || query.__customization?.beforeOrderByItems || query.__customization?.afterOrderByItems) {
            return '(' + result + ')'
        }
        return result
    }
    _buildFromJoins(tables: AnyTableOrView[] | undefined, joins: JoinData[] | undefined, requiredTablesOrViews: Set<AnyTableOrView> | undefined, params: any[]): string {
        let fromJoins = ''

        if (tables && tables.length > 0) {
            let requireComma = false
            for (let i = 0, length = tables.length; i < length; i++) {
                if (requireComma) {
                    fromJoins += ', '
                }
                fromJoins += this._appendTableOrViewName(tables[i]!, params)
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
            fromJoins += this._appendTableOrViewName(join.__tableOrView, params)
            if (join.__on) {
                const onCondition = this._appendCondition(join.__on, params)
                if (onCondition) {
                    fromJoins += ' on ' + onCondition
                }
            }
        }

        return fromJoins
    }
    _buildSelectGroupBy(query: PlainSelectData, params: any[], isOutermostQuery: boolean): string {
        const groupBy = query.__groupBy
        if (groupBy.length <= 0) {
            return ''
        }
        let result = ' group by '
        for (let i = 0, length = groupBy.length; i < length; i++) {
            if (i > 0) {
                result += ', '
            }
            result += this._appendSelectColumn(groupBy[i]!, params, undefined, isOutermostQuery)
        }
        return result
    }
    _buildSelectWithColumnsInfo(query: SelectData, params: any[], columnsForInsert: { [name: string]: DBColumn | undefined }, isOutermostQuery: boolean): string {
        const oldSafeTableOrView = this._getSafeTableOrView(params)
        const oldWithGenerated = this._isWithGenerated(params)
        const oldWithGeneratedFinished = this._isWithGeneratedFinished(params)
        const oldAggregateArrayWrapped = this._isAggregateArrayWrapped(params)

        const customization = query.__customization
        const needAgggregateArrayWrapper = this._needAgggregateArrayWrapper(query, params)
        const aggregateId = needAgggregateArrayWrapper ? this._generateUnique() : 0

        if (query.__type === 'compound') {
            this._setSafeTableOrView(params, undefined)

            let selectQuery = ''

            if (needAgggregateArrayWrapper) {
                selectQuery += this._appendAggragateArrayWrapperBegin(query, params, aggregateId)
                this._setAggregateArrayWrapped(params, true)
            }

            if (customization && customization.beforeQuery) {
                selectQuery += this._appendRawFragment(customization.beforeQuery, params) + ' '
            }

            selectQuery += this._buildWith(query, params)

            const emitOrderBy = !query.__asInlineAggregatedArrayValue || !this._supportOrderByWhenAggregateArray || this._isAggregateArrayWrapped(params)
            // A case-insensitive ordering, or an ordering by a value-source
            // expression, can't live in the compound ORDER BY itself on the
            // strict engines; wrap the whole compound in a plain
            // `select * from (...)` and order there. The inner compound is
            // emitted verbatim so its set semantics and collations survive.
            const wrapCompoundOrderBy = emitOrderBy && this._needsCompoundOrderByWrap(query)

            let compoundCore = ''
            compoundCore += this._buildSelectWithColumnsInfoForCompound(query.__firstQuery, params, columnsForInsert, isOutermostQuery)
            compoundCore += this._appendCompoundOperator(query.__compoundOperator, params)
            compoundCore += this._buildSelectWithColumnsInfoForCompound(query.__secondQuery, params, columnsForInsert, isOutermostQuery)

            if (wrapCompoundOrderBy) {
                selectQuery += 'select * from (' + compoundCore + ')'
                selectQuery += this._supportTableAliasWithAs ? ' as o_' + this._generateUnique() + '_' : ' o_' + this._generateUnique() + '_'
                const oldSafeTableOrViewInOrderBy = this._getSafeTableOrView(params)
                this._setSafeTableOrView(params, undefined)
                selectQuery += this._buildSelectOrderByForWrapper(query, params)
                this._setSafeTableOrView(params, oldSafeTableOrViewInOrderBy)
            } else {
                selectQuery += compoundCore
                if (emitOrderBy) {
                    const oldSafeTableOrViewInOrderBy = this._getSafeTableOrView(params)
                    this._setSafeTableOrView(params, undefined)
                    selectQuery += this._buildSelectOrderBy(query, params)
                    this._setSafeTableOrView(params, oldSafeTableOrViewInOrderBy)
                }
            }
            if (!query.__asInlineAggregatedArrayValue || !this._supportLimitWhenAggregateArray || this._isAggregateArrayWrapped(params)) {
                selectQuery += this._buildSelectLimitOffset(query, params)
            }

            selectQuery += this._buildSelectAsAggregatedArray(query, params)

            if (customization && customization.afterQuery) {
                selectQuery += ' ' + this._appendRawFragment(customization.afterQuery, params)
            }

            if (needAgggregateArrayWrapper) {
                selectQuery += this._appendAggragateArrayWrapperEnd(query, params, aggregateId)
            }

            this._setSafeTableOrView(params, oldSafeTableOrView)
            this._setWithGenerated(params, oldWithGenerated)
            this._setWithGeneratedFinished(params, oldWithGeneratedFinished)
            this._setAggregateArrayWrapped(params, oldAggregateArrayWrapped)
            return selectQuery
        }

        const requiredTablesOrViews = query.__requiredTablesOrViews
        const oldFakeNameOf = this._getFakeNamesOf(params)
        if (oldFakeNameOf) {
            if (requiredTablesOrViews) {
                const newFakeNameOf = new Set<AnyTableOrView>()
                requiredTablesOrViews.forEach(v => {
                    if (oldFakeNameOf.has(v)) {
                        newFakeNameOf.add(v)
                    }
                })
                if (newFakeNameOf.size > 0) {
                    this._setFakeNamesOf(params, newFakeNameOf)
                } else {
                    this._setFakeNamesOf(params, undefined)
                }
            } else {
                this._setFakeNamesOf(params, undefined)
            }
        }

        const tables = query.__tablesOrViews
        const tablesLength = tables.length
        const joins = query.__joins

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
            this._setSafeTableOrView(params, tables[0])
        } else {
            this._setSafeTableOrView(params, undefined)
        }

        let selectQuery = ''

        if (needAgggregateArrayWrapper) {
            selectQuery += this._appendAggragateArrayWrapperBegin(query, params, aggregateId)
            this._setAggregateArrayWrapped(params, true)
        }

        if (customization && customization.beforeQuery) {
            selectQuery += this._appendRawFragment(customization.beforeQuery, params) + ' '
        }

        selectQuery += this._buildWith(query, params)
        selectQuery += 'select '

        if (customization && customization.afterSelectKeyword) {
            selectQuery += this._appendRawFragment(customization.afterSelectKeyword, params) + ' '
        }

        if (query.__distinct) {
            selectQuery += 'distinct '
        }

        if (customization && customization.beforeColumns) {
            selectQuery += this._appendRawFragment(customization.beforeColumns, params) + ' '
        }

        const columns: FlatQueryColumns = {}
        flattenQueryColumns(query.__columns, columns, '')

        if (needAgggregateArrayWrapper || !this._needAgggregateArrayColumnsTransformation(query, params)) {
            let requireComma = false
            for (const property in columns) {
                if (requireComma) {
                    selectQuery += ', '
                }
                const columnForInsert = columnsForInsert[property]
                selectQuery += this._appendSelectColumn(columns[property]!, params, columnForInsert, isOutermostQuery)
                if (property) {
                    selectQuery += ' as ' + this._appendColumnAlias(property, params)
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
            selectQuery += this._appendAggragateArrayColumns(aggregatedArrayColumns, false, params, query)
        }

        if (tablesLength <= 0) {
            selectQuery += this._fromNoTable()
        } else {
            selectQuery += ' from '
            selectQuery += this._buildFromJoins(tables, joins, query.__requiredTablesOrViews, params)
        }

        const where = query.__where
        if (where) {
            const whereCondition = this._appendCondition(where, params)
            if (whereCondition) {
                selectQuery += ' where ' + whereCondition
            }
        }

        // Oracle recursive
        const startWith = query.__startWith
        if (startWith) {
            const startWithCondition = this._appendCondition(startWith, params)
            if (startWithCondition) {
                selectQuery += ' start with ' + startWithCondition
            }
        }

        // Oracle recursive
        const connectdBy = query.__connectBy
        if (connectdBy) {
            const connectByCondition = this._appendCondition(connectdBy, params)
            if (connectByCondition) {
                if (query.__connectByNoCycle) {
                    selectQuery += ' connect by nocycle ' + connectByCondition
                } else {
                    selectQuery += ' connect by ' + connectByCondition
                }
            }
        }

        selectQuery += this._buildSelectGroupBy(query, params, isOutermostQuery)

        const having = query.__having
        if (having) {
            const havingCondition = this._appendCondition(having, params)
            if (havingCondition) {
                selectQuery += ' having ' + havingCondition
            }
        }

        if (customization && customization.customWindow) {
            selectQuery += ' window '
            selectQuery += this._appendRawFragment(customization.customWindow, params)
        }

        if (!query.__asInlineAggregatedArrayValue || !this._supportOrderByWhenAggregateArray || this._isAggregateArrayWrapped(params)) {
            const oldSafeTableOrViewInOrderBy = this._getSafeTableOrView(params)
            const oldOrderBySafeTableOrView = this._getOrderBySafeTableOrView(params)
            this._setSafeTableOrView(params, undefined)
            this._setOrderBySafeTableOrView(params, oldSafeTableOrViewInOrderBy)
            selectQuery += this._buildSelectOrderBy(query, params)
            this._setOrderBySafeTableOrView(params, oldOrderBySafeTableOrView)
            this._setSafeTableOrView(params, oldSafeTableOrViewInOrderBy)
        }
        if (!query.__asInlineAggregatedArrayValue || !this._supportLimitWhenAggregateArray || this._isAggregateArrayWrapped(params)) {
            selectQuery += this._buildSelectLimitOffset(query, params)
        }

        selectQuery += this._buildSelectAsAggregatedArray(query, params)

        if (customization && customization.afterQuery) {
            selectQuery += ' ' + this._appendRawFragment(customization.afterQuery, params)
        }

        if (needAgggregateArrayWrapper) {
            selectQuery += this._appendAggragateArrayWrapperEnd(query, params, aggregateId)
        }

        this._setSafeTableOrView(params, oldSafeTableOrView)
        this._setFakeNamesOf(params, oldFakeNameOf)
        this._setWithGenerated(params, oldWithGenerated)
        this._setWithGeneratedFinished(params, oldWithGeneratedFinished)
        this._setAggregateArrayWrapped(params, oldAggregateArrayWrapped)
        return selectQuery
    }
    _appendSelectColumn(value: AnyValueSource, params: any[], columnForInsert: DBColumn | undefined, isOutermostQuery: boolean): string {
        if (columnForInsert) {
            const sql = this._appendCustomBooleanRemapForColumnIfRequired(columnForInsert, value, params, false)
            if (sql) {
                return sql
            }
        }
        return this._appendColumnValue(value, params, isOutermostQuery)
    }
    _fromNoTable() {
        return ''
    }
    _buildSelectOrderBy(query: SelectData, params: any[]): string {
        const orderBy = query.__orderBy
        if (!orderBy) {
            let orderByColumns = ''

            const customization = query.__customization
            if (customization && customization.beforeOrderByItems) {
                orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, params)
            }

            if (customization && customization.afterOrderByItems) {
                if (orderByColumns) {
                    orderByColumns += ', '
                }
                orderByColumns += this._appendRawFragment(customization.afterOrderByItems, params)
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
            orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, params)
        }

        for (const entry of orderBy) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            const order = entry.order
            if (!order) {
                orderByColumns += this._appendOrderByColumnAlias(entry, query, params)
            } else switch (order) {
                case 'asc':
                case 'desc':
                case 'asc nulls first':
                case 'asc nulls last':
                case 'desc nulls first':
                case 'desc nulls last' :
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, params) + ' ' + order
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
                    orderByColumns += this._appendOrderByColumnAliasInsensitive(entry, query, params) + sqlOrder
                    break
                }
                default:
                    throw new TsSqlProcessingError({ reason: 'INVALID_ORDER_BY_ORDERING', column: this._appendOrderByColumnAlias(entry, query, params), ordering: order }, 'Invalid order by: ' + order)
            }
        }

        if (customization && customization.afterOrderByItems) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            orderByColumns += this._appendRawFragment(customization.afterOrderByItems, params)
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
    _appendOrderByColumnAlias(entry: OrderByEntry, query: SelectData, params: any[]): string {
        const expression = entry.expression
        const columns = query.__columns
        if (typeof expression === 'string') {
            const column = getQueryColumn(columns, expression)
            if (!column) {
                throw new TsSqlProcessingError({ reason: 'ORDER_BY_COLUMN_NOT_IN_SELECT', column: expression }, 'Column ' + expression + ' included in the order by not found in the select clause')
            }
            return this._appendColumnAlias(expression, params)
        } else if (isValueSource(expression)) {
            const result = this._appendSql(expression, params, false)
            return result
        } else {
            const result = this._appendRawFragment(expression, params)
            return result
        }
    }
    _appendOrderByColumnAliasInsensitive(entry: OrderByEntry, query: SelectData, params: any[]): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        const stringColumn = this._isStringOrderByColumn(entry, query)
        if (!stringColumn || collation === '') {
            // Non-string column, or the engine handles case-insensitivity by
            // its default collation: the insensitive term renders nothing
            // extra, so a bare alias reference is enough.
            return this._appendOrderByColumnAlias(entry, query, params)
        }
        // The insensitive term wraps the column in an expression (`lower(...)`
        // or `<col> collate <name>`). A *string* entry is an output alias;
        // PostgreSQL / SQL Server don't resolve an alias inside an ORDER BY
        // expression, so emit its underlying source column (as in the SELECT
        // clause). A value-source / raw entry already renders the expression
        // itself (never an alias), and the lenient dialects + compound queries
        // accept the alias, so those keep the original rendering.
        const resolveSource = typeof entry.expression === 'string'
            && query.__type !== 'compound'
            && !this._supportOrderByColumnAliasInExpression()
        const wrapped = resolveSource
            ? this._appendOrderByColumnSourceAsInSelect(entry, query, params)
            : this._appendOrderByColumnAlias(entry, query, params)
        if (collation) {
            return wrapped + ' collate ' + collation
        }
        return 'lower(' + wrapped + ')'
    }
    /**
     * Render the order-by entry's underlying source expression as it appears in
     * the SELECT clause (a bare column name on a single-table select, qualified
     * across a join), independent of the qualified-everything mode the ORDER BY
     * build uses for value-source terms. Used only by the insensitive wrapper so
     * `lower(<src>)` / `<src> collate <name>` reads like the projected column;
     * the plain `_appendOrderByColumnExpression` (used e.g. by `is null` checks)
     * keeps the surrounding qualification. See `_getOrderBySafeTableOrView`.
     */
    _appendOrderByColumnSourceAsInSelect(entry: OrderByEntry, query: SelectData, params: any[]): string {
        const oldSafeTableOrView = this._getSafeTableOrView(params)
        this._setSafeTableOrView(params, this._getOrderBySafeTableOrView(params))
        const result = this._appendOrderByColumnExpression(entry, query, params)
        this._setSafeTableOrView(params, oldSafeTableOrView)
        return result
    }
    _appendOrderByColumnExpression(entry: OrderByEntry, query: SelectData, params: any[]): string {
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
            return this._appendSql(column, params, false)
        } else if (isValueSource(expression)) {
            return this._appendSql(expression, params, false)
        } else {
            return this._appendRawFragment(expression, params)
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
     * wrapped in an expression. Verified against the real engines: MySQL,
     * MariaDB, Oracle and SQLite resolve it; PostgreSQL and SQL Server do not
     * (they resolve any name inside an expression against the input columns and
     * fail with "column does not exist" / error 207). When `false`, an
     * insensitive ordering must reference the alias' underlying source
     * expression instead — see `_appendOrderByColumnAliasInsensitive`.
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
        for (const entry of orderBy) {
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
     * so they render it without the wrapper. Ordinal raw fragments (`order by 1`)
     * are not value sources and stay inline untouched.
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
        for (const entry of orderBy) {
            if (isValueSource(entry.expression)) {
                return true
            }
        }
        return false
    }
    /**
     * Whether the compound query's ORDER BY needs the `select * from (<compound>)`
     * wrapper for any reason — a case-insensitive term that renders as an
     * expression, or an ordering by a value-source expression. Either kind is
     * illegal inside a compound ORDER BY on the strict engines and becomes legal
     * on the plain wrapper.
     */
    _needsCompoundOrderByWrap(query: SelectData): boolean {
        return this._needsCompoundInsensitiveOrderByWrap(query) || this._needsCompoundExpressionOrderByWrap(query)
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
    _buildSelectOrderByForWrapper(query: SelectData, params: any[]): string {
        return this._buildSelectOrderBy(query, params)
    }
    _buildSelectLimitOffset(query: SelectData, params: any[]): string {
        let result = ''

        const offset = query.__offset
        if (offset !== null && offset !== undefined) {
            result += ' offset ' + this._appendValue(offset, params, 'int', 'int', undefined, false) + ' rows'
        }
        const limit = query.__limit
        if (limit !== null && limit !== undefined) {
            result += ' fetch next ' + this._appendValue(limit, params, 'int', 'int', undefined, false) + ' rows only'
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
    _buildInsertMultiple(query: InsertData, params: any[]): string {
        const multiple = query.__multiple
        if (!multiple) {
            throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'expecting insert of multiple values' }, 'Exepected a multiple insert')
        }
        if (multiple.length <= 0) {
            return ''
        }

        this._ensureRootQuery(query, params)
        const oldSafeTableOrView = this._getSafeTableOrView(params)
        const oldFakeNameOf = this._getFakeNamesOf(params)
        this._setFakeNamesOf(params, undefined)

        const table = query.__table
        const customization = query.__customization
        this._setSafeTableOrView(params, table)

        let insertQuery = ''
        if (customization && customization.beforeQuery) {
            insertQuery += this._appendRawFragment(customization.beforeQuery, params) + ' '
        }
        if (this._useInsertSupportWith()) {
            insertQuery += this._buildWith(query, params)
        }
        insertQuery += 'insert '
        if (customization && customization.afterInsertKeyword) {
            insertQuery += this._appendRawFragment(customization.afterInsertKeyword, params) + ' '
        }
        insertQuery += this._buildInsertOnConflictBeforeInto(query, params)
        insertQuery += 'into '
        insertQuery += this._appendTableOrViewName(table, params)

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
        const nextSequenceValues: string[] = []
        for (var columnName in table) {
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

            columns += this._appendRawColumnName(column, params)
            nextSequenceValues.push(columnPrivate.__sequenceName)
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
            columns += this._appendRawColumnName(column, params)
        }

        insertQuery += ' (' + columns + ')'
        insertQuery += this._buildInsertOutput(query, params)

        let multipleValues = ''
        for (let i = 0, length = multiple.length; i < length; i++) {
            let values = ''
            for (let j = 0, length = nextSequenceValues.length; j < length; j++) {
                if (values) {
                    values += ', '
                }
                const sequenceName = nextSequenceValues[j]!
                values += this._nextSequenceValue(params, sequenceName)
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
                    values += this._nextSequenceValue(params, sequenceName)
                } else {
                    values += this._appendValueForColumn(column, value, params, false)
                }
            }

            if (multipleValues) {
                multipleValues += ', (' + values + ')'
            } else {
                multipleValues = '(' + values + ')'
            }
        }

        insertQuery += ' values ' + multipleValues
        insertQuery += this._buildInsertOnConflictBeforeReturning(query, params)
        insertQuery += this._buildInsertReturning(query, params)
        if (customization && customization.afterQuery) {
            insertQuery += ' ' + this._appendRawFragment(customization.afterQuery, params)
        }

        this._setSafeTableOrView(params, oldSafeTableOrView)
        this._setFakeNamesOf(params, oldFakeNameOf)
        this._resetRootQuery(query, params)
        return insertQuery
    }
    _appendCustomBooleanRemapForColumnIfRequired(column: DBColumn, value: any, params: any[], forceTypeCast: boolean): string | null {
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
                        return 'case ' + this._appendValue(value, params, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' when ' + this._trueValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' when ' + this._falseValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' else null end'
                    }
                }
            } else if (isValueSource(value)) {
                // There are some boolean expressions involved
                if (columnPrivate.__optionalType === 'required') {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, params, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' end'
                } else {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, params, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' when not ' + this._appendConditionValueParenthesis(value, params, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' else null end'
                }
            } else {
                if (columnPrivate.__optionalType === 'required') {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, params, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' end'
                } else {
                    // remapped
                    return 'case ' + this._appendValue(value, params, columnType, columnTypeName, columnTypeAdapter, forceTypeCast) + ' when ' + this._trueValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' when ' + this._falseValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' else null end'
                }
            }
        }

        // if value is column and its type adapter is CustomBooleanTypeAdapter append value will be required to normalize value
        // if not it is same boolean, nothing to transform here
        return null
    }
    _appendValueForColumn(column: DBColumn, value: any, params: any[], forceTypeCast: boolean): string {
        const sql = this._appendCustomBooleanRemapForColumnIfRequired(column, value, params, forceTypeCast)
        if (sql) {
            return sql
        }
        const columnPrivate = __getColumnPrivate(column)
        return this._appendValue(value, params, columnPrivate.__valueType, columnPrivate.__valueTypeName, columnPrivate.__typeAdapter, forceTypeCast)
    }
    _buildInsertDefaultValues(query: InsertData, params: any[]): string {
        this._ensureRootQuery(query, params)
        const oldSafeTableOrView = this._getSafeTableOrView(params)
        const oldFakeNameOf = this._getFakeNamesOf(params)
        this._setFakeNamesOf(params, undefined)

        const table = query.__table
        const customization = query.__customization

        this._setSafeTableOrView(params, table)

        let insertQuery = ''
        if (customization && customization.beforeQuery) {
            insertQuery += this._appendRawFragment(customization.beforeQuery, params) + ' '
        }
        if (this._useInsertSupportWith()) {
            insertQuery += this._buildWith(query, params)
        }
        insertQuery += 'insert '
        if (customization && customization.afterInsertKeyword) {
            insertQuery += this._appendRawFragment(customization.afterInsertKeyword, params) + ' '
        }
        insertQuery += this._buildInsertOnConflictBeforeInto(query, params)
        insertQuery += 'into '
        insertQuery += this._appendTableOrViewName(table, params)

        let columns = ''
        const sequences: string[] = []
        for (var columnName in table) {
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

            columns += this._appendRawColumnName(column, params)
            sequences.push(columnPrivate.__sequenceName)
        }

        if (columns) {
            insertQuery += ' (' + columns + ')'
        }
        insertQuery += this._buildInsertOutput(query, params)

        let values = ''
        for (let i = 0, length = sequences.length; i < length; i++) {
            const sequenceName = sequences[i]!
            if (values) {
                values += ', '
            }

            values += this._nextSequenceValue(params, sequenceName)
        }

        if (values) {
            insertQuery += ' values (' + values + ')'
        } else {
            insertQuery += ' default values'
        }
        insertQuery += this._buildInsertOnConflictBeforeReturning(query, params)
        insertQuery += this._buildInsertReturning(query, params)
        if (customization && customization.afterQuery) {
            insertQuery += ' ' + this._appendRawFragment(customization.afterQuery, params)
        }

        this._setSafeTableOrView(params, oldSafeTableOrView)
        this._setFakeNamesOf(params, oldFakeNameOf)
        this._resetRootQuery(query, params)
        return insertQuery
    }
    _buildInsert(query: InsertData, params: any[]): string {
        this._ensureRootQuery(query, params)
        const oldSafeTableOrView = this._getSafeTableOrView(params)
        const oldFakeNameOf = this._getFakeNamesOf(params)
        this._setFakeNamesOf(params, undefined)

        const table = query.__table
        const sets = query.__sets
        const customization = query.__customization

        this._setSafeTableOrView(params, table)

        let insertQuery = ''
        if (customization && customization.beforeQuery) {
            insertQuery += this._appendRawFragment(customization.beforeQuery, params) + ' '
        }
        if (this._useInsertSupportWith()) {
            insertQuery += this._buildWith(query, params)
        }
        insertQuery += 'insert '
        if (customization && customization.afterInsertKeyword) {
            insertQuery += this._appendRawFragment(customization.afterInsertKeyword, params) + ' '
        }
        insertQuery += this._buildInsertOnConflictBeforeInto(query, params)
        insertQuery += 'into '
        insertQuery += this._appendTableOrViewName(table, params)

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
        const sequences: string[] = []
        for (var columnName in table) {
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

            columns += this._appendRawColumnName(column, params)
            sequences.push(columnPrivate.__sequenceName)
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
                columns += this._appendRawColumnName(column, params)
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
                columns += this._appendRawColumnName(column, params)
            }
        }

        insertQuery += ' (' + columns + ')'
        insertQuery += this._buildInsertOutput(query, params)

        let values = ''
        for (let i = 0, length = sequences.length; i < length; i++) {
            const sequenceName = sequences[i]!
            if (values) {
                values += ', '
            }

            values += this._nextSequenceValue(params, sequenceName)
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
                values += this._appendValueForColumn(column, value, params, false)
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
                values += this._appendValueForColumn(column, value, params, false)
            }
        }

        insertQuery += ' values (' + values + ')'
        insertQuery += this._buildInsertOnConflictBeforeReturning(query, params)
        insertQuery += this._buildInsertReturning(query, params)
        if (customization && customization.afterQuery) {
            insertQuery += ' ' + this._appendRawFragment(customization.afterQuery, params)
        }

        this._setSafeTableOrView(params, oldSafeTableOrView)
        this._setFakeNamesOf(params, oldFakeNameOf)
        this._resetRootQuery(query, params)
        return insertQuery
    }
    _buildInsertFromSelect(query: InsertData, params: any[]): string {
        const from = query.__from
        if (!from) {
            throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'expecting insert from select' }, 'Exepected an insert from a subquery')
        }

        this._ensureRootQuery(query, params)
        const oldSafeTableOrView = this._getSafeTableOrView(params)
        const oldFakeNameOf = this._getFakeNamesOf(params)
        this._setFakeNamesOf(params, undefined)

        const table = query.__table
        const selectColumns = from.__columns
        const customization = query.__customization

        this._setSafeTableOrView(params, table)

        let insertQuery = ''
        if (customization && customization.beforeQuery) {
            insertQuery += this._appendRawFragment(customization.beforeQuery, params) + ' '
        }
        if (this._useInsertSupportWith()) {
            insertQuery += this._buildWith(query, params)
        }
        insertQuery += 'insert '
        if (customization && customization.afterInsertKeyword) {
            insertQuery += this._appendRawFragment(customization.afterInsertKeyword, params) + ' '
        }
        insertQuery += this._buildInsertOnConflictBeforeInto(query, params)
        insertQuery += 'into '
        insertQuery += this._appendTableOrViewName(table, params)

        const columnsForInsert: { [name: string]: DBColumn | undefined } = {}

        let columns = ''
        const addedColumns: string[] = []
        for (var columnName in table) {
            if (columnName in selectColumns) {
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
            selectColumns[columnName] = new SequenceValueSource('_nextSequenceValue', columnPrivate.__sequenceName, columnPrivate.__valueType, columnPrivate.__valueTypeName, 'required', columnPrivate.__typeAdapter)
        }
        const properties = Object.getOwnPropertyNames(selectColumns)
        for (let i = 0, length = properties.length; i < length; i++) {
            if (columns) {
                columns += ', '
            }

            const property = properties[i]!
            const column = __getColumnOfObject(table, property)
            if (column) {
                columns += this._appendRawColumnName(column, params)
                columnsForInsert[property] = column
            } else {
                throw new TsSqlProcessingError({ reason: 'COLUMN_FOR_INSERT_COMING_FROM_SUBQUERY_NOT_IN_TABLE', column: property }, 'Unable to find the column "' + property + ' in the table "' + this._getTableOrViewVisibleName(table) +'". The column is not included in the table definition')
            }
        }

        insertQuery += ' (' + columns + ')'
        insertQuery += this._buildInsertOutput(query, params)
        insertQuery += ' ' + this._buildSelectWithColumnsInfo(from, params, columnsForInsert, false)
        insertQuery += this._buildInsertOnConflictBeforeReturning(query, params)
        insertQuery += this._buildInsertReturning(query, params)
        if (customization && customization.afterQuery) {
            insertQuery += ' ' + this._appendRawFragment(customization.afterQuery, params)
        }

        for (let i = 0, length = addedColumns.length; i < length; i++) {
            const columnName = addedColumns[i]!
            delete selectColumns[columnName]
        }

        this._setSafeTableOrView(params, oldSafeTableOrView)
        this._setFakeNamesOf(params, oldFakeNameOf)
        this._resetRootQuery(query, params)
        return insertQuery
    }
    _buildInsertOutput(_query: InsertData, _params: any[]): string {
        return ''
    }
    _buildInsertReturning(query: InsertData, params: any[]): string {
        const idColumn = query.__idColumn
        if (idColumn) {
            this._setContainsInsertReturningClause(params, true)
            return ' returning ' + this._appendSql(idColumn, params, false)
        }


        const isOutermostQuery = this._isCurrentRootQuery(query, params)
        const result = this._buildQueryReturning(query.__columns, params, isOutermostQuery)
        this._setContainsInsertReturningClause(params, !!result)
        return result
    }
    _buildQueryReturning(queryColumns: QueryColumns | undefined, params: any[], isOutermostQuery: boolean): string {
        if (!queryColumns) {
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
            result += this._appendColumnValue(columns[property]!, params, isOutermostQuery)
            if (property) {
                result += ' as ' + this._appendColumnAlias(property, params)
            }
            requireComma = true
        }
        if (!result) {
            return ''
        }
        return ' returning ' + result
    }
    _buildInsertOnConflictBeforeInto(_query: InsertData, _params: any[]): string {
        return ''
    }
    /*
     * Builds the `<col> = <value>, ...` assignment list shared by the
     * `do update set` (PostgreSQL/SQLite) and `on duplicate key update`
     * (MariaDB/MySQL) clauses. Resolves shape-renamed keys back to their real
     * column when an on-conflict shape is present, so every dialect honours it.
     */
    _buildInsertOnConflictUpdateSetColumns(query: InsertData, params: any[]): string {
        let columns = ''
        const table = query.__table
        const shape = query.__onConflictUpdateShape
        const sets = query.__onConflictUpdateSets
        if (sets) {
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
                    const value = sets[property]
                    columns += this._appendColumnNameForUpdate(column, params)
                    columns += ' = '
                    columns += this._appendValueForColumn(column, value, params, false)
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
                    const value = sets[property]
                    columns += this._appendColumnNameForUpdate(column, params)
                    columns += ' = '
                    columns += this._appendValueForColumn(column, value, params, false)
                }
            }
        }
        return columns
    }
    _buildInsertOnConflictBeforeReturning(query: InsertData, params: any[]): string {
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
                result += this._appendSql(column, params, false)
            }
            result += ')'
            const where = query.__onConflictOnColumnsWhere
            if (where) {
                result += ' where '
                result += this._appendCondition(where, params)
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
            result += this._appendRawFragment(constraint, params)
        }

        if (query.__onConflictDoNothing) {
            result += ' do nothing'
        }

        const oldSafeTableOrView = this._getSafeTableOrView(params)
        this._setSafeTableOrView(params, undefined)
        const columns = this._buildInsertOnConflictUpdateSetColumns(query, params)
        if (query.__onConflictUpdateSets) {
            if (!columns) {
                return ''
            }

            result += ' do update set ' + columns
            const where = query.__onConflictUpdateWhere
            if (where) {
                result += ' where '
                result += this._appendCondition(where, params)
            }
        }

        this._setSafeTableOrView(params, oldSafeTableOrView)
        return result
    }
    _nextSequenceValue( _params: any[], sequenceName: string) {
        return "nextval('" + sequenceName + "')"
    }
    _currentSequenceValue(_params: any[], sequenceName: string): string {
        return "currval('" + sequenceName + "')"
    }
    _buildUpdate(query: UpdateData, params: any[]): string {
        this._ensureRootQuery(query, params)
        const oldSafeTableOrView = this._getSafeTableOrView(params)
        const oldFakeNameOf = this._getFakeNamesOf(params)

        const table = query.__table
        const sets = query.__sets
        const customization = query.__customization

        if (query.__froms || query.__joins) {
            this._setSafeTableOrView(params, undefined)
        } else {
            this._setSafeTableOrView(params, table)
        }

        const oldValues = query.__oldValues
        const requiredTables = this._extractAdditionalRequiredTablesForUpdate(query, params)
        const requiredColumns = this._extractAdditionalRequiredColumnsForUpdate(query, requiredTables, params)
        this._setFakeNamesOf(params, requiredTables)

        let updateQuery = ''

        if (customization && customization.beforeQuery) {
            updateQuery += this._appendRawFragment(customization.beforeQuery, params) + ' '
        }
        updateQuery += this._buildWith(query, params)
        updateQuery += 'update '

        if (customization && customization.afterUpdateKeyword) {
            updateQuery += this._appendRawFragment(customization.afterUpdateKeyword, params) + ' '
        }

        const oldForceAliasFor = this._getForceAliasFor(params)
        const oldForceAliasAs = this._getForceAliasAs(params)
        if (this._useUpdateOldValueInFrom() && query.__oldValues) {
            this._setForceAliasFor(params, query.__table)
            this._setForceAliasAs(params, this._updateNewAlias)
        }
        updateQuery += this._appendTableOrViewName(table, params)
        updateQuery += this._buildAfterUpdateTable(query, params)

        const shape = query.__shape
        let columns = ''
        let updatePrimaryKey = false
        if (shape) { // Follow shape order
            const properties = Object.getOwnPropertyNames(shape)
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

                columns += this._appendColumnNameForUpdate(column, params)
                columns += ' = '
                columns += this._appendValueForColumn(column, value, params, false)
            }
        } else { // No shape, follow set order
            const properties = Object.getOwnPropertyNames(sets)
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
    
                columns += this._appendColumnNameForUpdate(column, params)
                columns += ' = '
                columns += this._appendValueForColumn(column, value, params, false)
            }
        }
        updateQuery += ' set ' + columns

        updateQuery += this._buildUpdateOutput(query, params)
        updateQuery += this._buildUpdateFrom(query, updatePrimaryKey, requiredTables, requiredColumns, params)

        if (oldValues && this._useUpdateOldValueInFrom()) {
            let where: BooleanValueSource<any, any> | undefined
            for (let property in table) {
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

            const oldForceAliasFor = this._getForceAliasFor(params)
            const oldForceAliasAs = this._getForceAliasAs(params)

            this._setForceAliasFor(params, table)
            this._setForceAliasAs(params, this._updateNewAlias)
            const whereCondition = this._appendCondition(where, params)
            if (whereCondition) {
                updateQuery += ' where ' + whereCondition
            } else if (!query.__allowNoWhere) {
                throw new TsSqlProcessingError({ reason: 'MISSING_WHERE' }, 'No where generated for link with the update old values')
            }
            this._setForceAliasFor(params, oldForceAliasFor)
            this._setForceAliasAs(params, oldForceAliasAs)
        } else if (query.__where) {
            const whereCondition = this._appendCondition(query.__where, params)
            if (whereCondition) {
                updateQuery += ' where ' + whereCondition
            } else if (!query.__allowNoWhere) {
                throw new TsSqlProcessingError({ reason: 'MISSING_WHERE' }, 'No where defined for the update operation')
            }
        } else if (!query.__allowNoWhere) {
            throw new TsSqlProcessingError({ reason: 'MISSING_WHERE' }, 'No where defined for the update operation')
        }

        updateQuery += this._buildUpdateReturning(query, params)

        if (customization && customization.afterQuery) {
            updateQuery += ' ' + this._appendRawFragment(customization.afterQuery, params)
        }

        this._setForceAliasFor(params, oldForceAliasFor)
        this._setForceAliasAs(params, oldForceAliasAs)
        this._setSafeTableOrView(params, oldSafeTableOrView)
        this._setFakeNamesOf(params, oldFakeNameOf)
        this._resetRootQuery(query, params)
        return updateQuery
    }
    _extractAdditionalRequiredTablesForUpdate(query: UpdateData, _params: any[]): Set<AnyTableOrView> | undefined {
        if (!this._useUpdateOldValueInFrom() || !query.__oldValues) {
            return undefined
        }
        const froms = query.__froms
        const joins = query.__joins
        if ((!froms || froms.length < 0) && (!joins || joins.length < 0)) {
            return undefined
        }

        const result = new Set<AnyTableOrView>()

        const sets = query.__sets
        for (let property in sets) {
            __registerTableOrView(sets[property], this, result)
        }

        const columns = query.__columns
        if (columns) {
            for (let property in columns) {
                __registerTableOrView(columns[property], this, result)
            }
        }

        result.delete(query.__table)
        result.delete(query.__oldValues)
        if (result.size <= 0) {
            return undefined
        }
        return result
    }
    _extractAdditionalRequiredColumnsForUpdate(query: UpdateData, requiredTables: Set<AnyTableOrView> | undefined, _params: any[]): Set<DBColumn> | undefined {
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
            for (let property in columns) {
                __registerRequiredColumn(columns[property], this, result, requiredTables)
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
    _appendColumnNameForUpdate(column: DBColumn, _params: any[]) {
        const columnPrivate = __getColumnPrivate(column)
        return this._escape(columnPrivate.__name, true)
    }
    _appendUpdateOldValueForUpdate(query: UpdateData, updatePrimaryKey: boolean, _requiredTables: Set<AnyTableOrView> | undefined, _params: any[]) {
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
    _buildAfterUpdateTable(_query: UpdateData, _params: any[]): string {
        return ''
    }
    _buildUpdateFrom(query: UpdateData, updatePrimaryKey: boolean, requiredTables: Set<AnyTableOrView> | undefined, requiredColumns: Set<DBColumn> | undefined, params: any[]): string {
        if (!this._useUpdateOldValueInFrom()) {
            const from = this._buildFromJoins(query.__froms, query.__joins, undefined, params)
            if (from) {
                return ' from ' + from
            }
            return ''
        }
        const oldValues = query.__oldValues
        if (!oldValues) {
            const from = this._buildFromJoins(query.__froms, query.__joins, undefined, params)
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

        const oldForceAliasFor = this._getForceAliasFor(params)
        const oldForceAliasAs = this._getForceAliasAs(params)
        const oldFakeNameOf = this._getFakeNamesOf(params)
        this._setFakeNamesOf(params, undefined)

        this._setForceAliasFor(params, query.__table)
        this._setForceAliasAs(params, oldValuesPrivate.__as)

        from += '(select ' + this._escape(oldValuesPrivate.__as, true) + '.*'

        if (requiredColumns) {
            const additionalColumns = Array.from(requiredColumns).sort((c1, c2) => {
                const c1Private = __getColumnPrivate(c1)
                const c2Private = __getColumnPrivate(c2)
                const t1 = c1Private.__tableOrView
                const t2 = c2Private.__tableOrView
                const t1Private = __getTableOrViewPrivate(t1)
                const t1Name = t1Private.__as || t1Private.__name
                const t2Private = __getTableOrViewPrivate(t2)
                const t2Name = t2Private.__as || t2Private.__name

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
                from += this._appendSql(column, params, false)
                from += ' as '

                const columnPrivate = __getColumnPrivate(column)
                const tablePrivate = __getTableOrViewPrivate(columnPrivate.__tableOrView)
                if (tablePrivate.__as) {
                    from += this._escape(tablePrivate.__as + '__' + columnPrivate.__name, true)
                } else {
                    from += this._escape(tablePrivate.__name + '__' + columnPrivate.__name, true)
                }
            }
        }

        from += ' from '
        from += this._appendTableOrViewName(oldValues, params)

        const innerFrom = this._buildFromJoins(query.__froms, query.__joins, undefined, params)
        if (innerFrom) {
            from = from + ', ' + innerFrom
        }

        if (query.__where) {
            const whereCondition = this._appendCondition(query.__where, params)
            if (whereCondition) {
                from += ' where ' + whereCondition
            } else if (!query.__allowNoWhere) {
                throw new TsSqlProcessingError({ reason: 'MISSING_WHERE' }, 'No where defined for the update operation')
            }
        } else if (!query.__allowNoWhere) {
            throw new TsSqlProcessingError({ reason: 'MISSING_WHERE' }, 'No where defined for the update operation')
        }

        from += this._appendUpdateOldValueForUpdate(query, updatePrimaryKey, requiredTables, params)
        from += ')'

        if (this._supportTableAliasWithAs) {
            from += ' as '
        } else {
            from += ' '
        }

        from += this._escape(oldValuesPrivate.__as, true)

        this._setForceAliasFor(params, oldForceAliasFor)
        this._setForceAliasAs(params, oldForceAliasAs)
        this._setFakeNamesOf(params, oldFakeNameOf)
        return from
    }
    _buildUpdateOutput(_query: UpdateData, _params: any[]): string {
        return ''
    }
    _buildUpdateReturning(query: UpdateData, params: any[]): string {
        const isOutermostQuery = this._isCurrentRootQuery(query, params)
        return this._buildQueryReturning(query.__columns, params, isOutermostQuery)
    }
    _buildDelete(query: DeleteData, params: any[]): string {
        this._ensureRootQuery(query, params)
        const oldFakeNameOf = this._getFakeNamesOf(params)
        this._setFakeNamesOf(params, undefined)
        const oldSafeTableOrView = this._getSafeTableOrView(params)

        const table = query.__table
        const customization = query.__customization

        if (query.__using || query.__joins) {
            this._setSafeTableOrView(params, undefined)
        } else {
            this._setSafeTableOrView(params, table)
        }

        let deleteQuery = ''
        if (customization && customization.beforeQuery) {
            deleteQuery += this._appendRawFragment(customization.beforeQuery, params) + ' '
        }

        deleteQuery += this._buildWith(query, params)
        deleteQuery += 'delete '

        if (customization && customization.afterDeleteKeyword) {
            deleteQuery += this._appendRawFragment(customization.afterDeleteKeyword, params) + ' '
        }

        deleteQuery += 'from '
        deleteQuery += this._appendTableOrViewName(table, params)

        deleteQuery += this._buildDeleteOutput(query, params)
        deleteQuery += this._buidDeleteUsing(query, params)

        if (query.__where) {
            const whereCondition = this._appendCondition(query.__where, params)
            if (whereCondition) {
                deleteQuery += ' where ' + whereCondition
            } else if (!query.__allowNoWhere) {
                throw new TsSqlProcessingError({ reason: 'MISSING_WHERE' }, 'No where defined for the delete operation')
            }
        } else if (!query.__allowNoWhere) {
            throw new TsSqlProcessingError({ reason: 'MISSING_WHERE' }, 'No where defined for the delete operation')
        }

        deleteQuery += this._buildDeleteReturning(query, params)

        if (customization && customization.afterQuery) {
            deleteQuery += ' ' + this._appendRawFragment(customization.afterQuery, params)
        }

        this._setSafeTableOrView(params, oldSafeTableOrView)
        this._setFakeNamesOf(params, oldFakeNameOf)
        this._resetRootQuery(query, params)
        return deleteQuery
    }
    _buidDeleteUsing(query: DeleteData, params: any[]): string {
        const result = this._buildFromJoins(query.__using, query.__joins, undefined, params)
        if (result) {
            return ' using ' + result
        }
        return ''
    }
    _buildDeleteOutput(_query: DeleteData, _params: any[]): string {
        return ''
    }
    _buildDeleteReturning(query: DeleteData, params: any[]): string {
        const isOutermostQuery = this._isCurrentRootQuery(query, params)
        return this._buildQueryReturning(query.__columns, params, isOutermostQuery)
    }

    /*
     * Comparators
     */
    // SqlComparator0
    _isNull(params: any[], valueSource: ToSql): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' is null'
    }
    _isNotNull(params: any[], valueSource: ToSql): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' is not null'
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
    _equals(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, params) + ' = ' + this._appendRawColumnName(value, params)
        }
        return this._appendSqlParenthesis(valueSource, params, false) + ' = ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
    }
    _notEquals(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, params) + ' <> ' + this._appendRawColumnName(value, params)
        }
        return this._appendSqlParenthesis(valueSource, params, false) + ' <> ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
    }
    _is(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, params) + ' is not distinct from ' + this._appendRawColumnName(value, params)
        }
        return this._appendSqlParenthesis(valueSource, params, false) + ' is not distinct from ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
    }
    _isNot(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, params) + ' is distinct from ' + this._appendRawColumnName(value, params)
        }
        return this._appendSqlParenthesis(valueSource, params, false) + ' is distinct from ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
    }
    _equalsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' = ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ' collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + ' = ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ') = lower(' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
        }
    }
    _notEqualsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' <> ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ' collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + ' <> ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ') <> lower(' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
        }
    }
    _lessThan(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' < ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
    }
    _greaterThan(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' > ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
    }
    _lessOrEqual(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' <= ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
    }
    _greaterOrEqual(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' >= ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
    }
    _in(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' in ' + this._appendSpreadValue(value, params, columnType, columnTypeName, typeAdapter, false)
    }
    _notIn(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' not in ' + this._appendSpreadValue(value, params, columnType, columnTypeName, typeAdapter, false)
    }
    _like(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' like ' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false)
    }
    _notLike(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' not like ' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false)
    }
    _likeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' like ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ' collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + ' like ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ') like lower(' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
        }
    }
    _notLikeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not like ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ' collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not like ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ') not like lower(' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
        }
    }
    _startsWith(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' like (' + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%')"
    }
    _notStartsWith(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' not like (' + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%')"
    }
    _endsWith(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ')'
    }
    _notEndsWith(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ')'
    }
    _startsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' like (' + this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + " || '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + ' like (' + this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + " || '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ') like lower(' + this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + " || '%')"
        }
    }
    _notStartsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not like (' + this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + " || '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not like (' + this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + " || '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ') not like lower(' + this._escapeLikeWildcard(value, params, columnType, columnTypeName, typeAdapter, false) + " || '%')"
        }
    }
    _endsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ')'
        }
    }
    _notEndsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ") not like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ')'
        }
    }
    _contains(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%')"
    }
    _notContains(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%')"
    }
    _containsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%')"
        }
    }
    _notContainsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ") not like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%')"
        }
    }
    // SqlComparator2
    _between(params: any[], valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' between ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ' and ' + this._appendValueParenthesis(value2, params, columnType, columnTypeName, typeAdapter, false)
    }
    _notBetween(params: any[], valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' not between ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ' and ' + this._appendValueParenthesis(value2, params, columnType, columnTypeName, typeAdapter, false)
    }
    // SqlOperationStatic0
    _pi(_params: any): string {
        return 'pi()'
    }
    _random(_params: any): string {
        return 'random()'
    }
    _currentDate(_params: any): string {
        return 'current_date'
    }
    _currentTime(_params: any): string {
        return 'current_time'
    }
    _currentTimestamp(_params: any): string {
        return 'current_timestamp'
    }
    _default(_params: any): string {
        return 'default'
    }
    _trueValue = 'true'
    _true(_params: any): string {
        return this._trueValue
    }
    _trueValueForCondition = 'true'
    _trueForCondition(_params: any): string {
        return this._trueValueForCondition
    }
    _falseValue = 'false'
    _false(_params: any): string {
        return this._falseValue
    }
    _falseValueForCondition = 'false'
    _falseForCondition(_params: any): string {
        return this._falseValueForCondition
    }
    // SqlOperationStatic01
    _const(params: any[], value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        return this._appendValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    _constForCondition(params: any[], value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        return this._appendConditionValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    _exists(params: any[], value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        return 'exists(' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast) + ')'
    }
    _notExists(params: any[], value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        return 'not exists(' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast) + ')'
    }
    _escapeLikeWildcard(params: any[], value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (typeof value === 'string') {
            value = value.replace(/\\/g, '\\\\')
            value = value.replace(/%/g, '\\%')
            value = value.replace(/_/g, '\\_')
            return this._appendValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast)
        } else {
            return "replace(replace(replace(" + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast) + ", '\\', '\\\\'), '%', '\\%'), '_', '\\_')"
        }
    }
    // SqlFunction0
    _negate(params: any[], valueSource: ToSql): string {
        const sql = this._appendConditionSql(valueSource, params, false)
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
    _toLowerCase(params: any[], valueSource: ToSql): string {
        return 'lower(' + this._appendSql(valueSource, params, false) + ')'
    }
    _toUpperCase(params: any[], valueSource: ToSql): string {
        return 'upper(' + this._appendSql(valueSource, params, false) + ')'
    }
    _length(params: any[], valueSource: ToSql): string {
        return 'length(' + this._appendSql(valueSource, params, false) + ')'
    }
    _trim(params: any[], valueSource: ToSql): string {
        return 'trim(' + this._appendSql(valueSource, params, false) + ')'
    }
    _trimLeft(params: any[], valueSource: ToSql): string {
        return 'ltrim(' + this._appendSql(valueSource, params, false) + ')'
    }
    _trimRight(params: any[], valueSource: ToSql): string {
        return 'rtrim(' + this._appendSql(valueSource, params, false) + ')'
    }
    _reverse(params: any[], valueSource: ToSql): string {
        return 'reverse(' + this._appendSql(valueSource, params, false) + ')'
    }
    _asDouble(params: any[], valueSource: ToSql): string {
        return 'cast(' + this._appendSql(valueSource, params, false) + 'as double presition)'
    }
    _abs(params: any[], valueSource: ToSql): string {
        return 'abs(' + this._appendSql(valueSource, params, false) + ')'
    }
    _ceil(params: any[], valueSource: ToSql): string {
        return 'ceil(' + this._appendSql(valueSource, params, false) + ')'
    }
    _floor(params: any[], valueSource: ToSql): string {
        return 'floor(' + this._appendSql(valueSource, params, false) + ')'
    }
    _round(params: any[], valueSource: ToSql): string {
        return 'round(' + this._appendSql(valueSource, params, false) + ')'
    }
    _exp(params: any[], valueSource: ToSql): string {
        return 'exp(' + this._appendSql(valueSource, params, false) + ')'
    }
    _ln(params: any[], valueSource: ToSql): string {
        return 'ln(' + this._appendSql(valueSource, params, false) + ')'
    }
    _log10(params: any[], valueSource: ToSql): string {
        return 'log(' + this._appendSql(valueSource, params, false) + ')'
    }
    _sqrt(params: any[], valueSource: ToSql): string {
        return 'sqrt(' + this._appendSql(valueSource, params, false) + ')'
    }
    _cbrt(params: any[], valueSource: ToSql): string {
        // No portable native CBRT exists across engines, and `power(x, 1.0 / 3.0)` returns NaN
        // (or an error) for negative x on every engine except PostgreSQL. Emulate the cube
        // root as `sign(x) * power(abs(x), 1.0 / 3.0)` so it works for the full real domain.
        return 'sign(' + this._appendSql(valueSource, params, false) + ') * power(abs(' + this._appendSql(valueSource, params, false) + '), 1.0 / 3.0)'
    }
    _sign(params: any[], valueSource: ToSql): string {
        return 'sign(' + this._appendSql(valueSource, params, false) + ')'
    }
    _acos(params: any[], valueSource: ToSql): string {
        return 'acos(' + this._appendSql(valueSource, params, false) + ')'
    }
    _asin(params: any[], valueSource: ToSql): string {
        return 'asin(' + this._appendSql(valueSource, params, false) + ')'
    }
    _atan(params: any[], valueSource: ToSql): string {
        return 'atan(' + this._appendSql(valueSource, params, false) + ')'
    }
    _cos(params: any[], valueSource: ToSql): string {
        return 'cos(' + this._appendSql(valueSource, params, false) + ')'
    }
    _cot(params: any[], valueSource: ToSql): string {
        return 'cot(' + this._appendSql(valueSource, params, false) + ')'
    }
    _sin(params: any[], valueSource: ToSql): string {
        return 'sin(' + this._appendSql(valueSource, params, false) + ')'
    }
    _tan(params: any[], valueSource: ToSql): string {
        return 'tan(' + this._appendSql(valueSource, params, false) + ')'
    }
    _getDate(params: any[], valueSource: ToSql): string {
        return 'extract(day from ' + this._appendSql(valueSource, params, false) + ')'
    }
    _getTime(params: any[], valueSource: ToSql): string {
        return 'extract(epoch from ' + this._appendSql(valueSource, params, false) + ')'
    }
    _getFullYear(params: any[], valueSource: ToSql): string {
        return 'extract(year from ' + this._appendSql(valueSource, params, false) + ')'
    }
    _getMonth(params: any[], valueSource: ToSql): string {
        return 'extract(month from ' + this._appendSql(valueSource, params, false) + ')'
    }
    _getDay(params: any[], valueSource: ToSql): string {
        return 'extract(dow from ' + this._appendSql(valueSource, params, false) + ')'
    }
    _getHours(params: any[], valueSource: ToSql): string {
        return 'extract(hour from ' + this._appendSql(valueSource, params, false) + ')'
    }
    _getMinutes(params: any[], valueSource: ToSql): string {
        return 'extract(minute from ' + this._appendSql(valueSource, params, false) + ')'
    }
    _getSeconds(params: any[], valueSource: ToSql): string {
        return 'extract(second from ' + this._appendSql(valueSource, params, false) + ')'
    }
    _getMilliseconds(params: any[], valueSource: ToSql): string {
        return 'extract(millisecond from ' + this._appendSql(valueSource, params, false) + ')'
    }
    _asString(params: any[], valueSource: ToSql): string {
        // Transform an uuid to string
        return this._appendSqlParenthesis(valueSource, params, false)
    }
    _asNullValue(_params: any[], _columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeAdapter && typeAdapter.transformPlaceholder) {
            return typeAdapter.transformPlaceholder('null', columnTypeName, false, null, this._defaultTypeAdapter)
        } else {
            return this._defaultTypeAdapter.transformPlaceholder('null', columnTypeName, false, null)
        }
    }
    // Oracle recursive
    _prior(params: any[], valueSource: ToSql): string {
        return 'prior ' + this._appendSql(valueSource, params, false)
    }
    // SqlFunction1
    _valueWhenNull(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'coalesce(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
    }
    _nullIfValue(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'nullif(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
    }
    _and(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        this._setResultingOperation(params, undefined)
        const sql = this._appendConditionSql(valueSource, params, false)
        const op = this._getResultingOperation(params)
        this._setResultingOperation(params, undefined)
        const sql2 = this._appendConditionValue(value, params, columnType, columnTypeName, typeAdapter, false)
        const op2 = this._getResultingOperation(params)
        this._setResultingOperation(params, undefined)
        if (!sql || sql === this._trueValueForCondition) {
            // sql === this._trueValueForCondition reduce unnecesary ands allowing dynamic queries
            this._setResultingOperation(params, op2)
            return sql2
        } else if (!sql2 || sql2 === this._trueValueForCondition) {
            // sql2 === this._trueValueForCondition reduce unnecesary ands allowing dynamic queries
            this._setResultingOperation(params, op)
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
            this._setResultingOperation(params, '_and')
            return result
        }
    }
    _or(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        this._setResultingOperation(params, undefined)
        const sql = this._appendConditionSql(valueSource, params, false)
        const op = this._getResultingOperation(params)
        this._setResultingOperation(params, undefined)
        const sql2 = this._appendConditionValue(value, params, columnType, columnTypeName, typeAdapter, false)
        const op2 = this._getResultingOperation(params)
        this._setResultingOperation(params, undefined)
        if (!sql || sql === this._falseValueForCondition) {
            // !sql || sql === this._falseValueForCondition reduce unnecesary ors allowing dynamic queries
            this._setResultingOperation(params, op2)
            return sql2
        } else if (!sql2 || sql2 === this._falseValueForCondition) {
            // !sql2 || sql2 === this._falseValueForCondition reduce unnecesary ors allowing dynamic queries
            this._setResultingOperation(params, op)
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
            this._setResultingOperation(params, '_or')
            return result
        }
    }
    _concat(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesisExcluding(valueSource, params, '_concat', false) + ' || ' + this._appendValueParenthesisExcluding(value, params, columnType, columnTypeName, typeAdapter, '_concat', false)
    }
    _substrToEnd(params: any[], valueSource: ToSql, value: any, _columnType: ValueType, _columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'number') {
            return 'substr(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value + 1, params, 'int', 'int', typeAdapter, false) + ')'
        } else {
            return 'substr(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValueParenthesis(value, params, 'int', 'int', typeAdapter, false) + ' + 1)'
        }
    }
    _substringToEnd(params: any[], valueSource: ToSql, value: any, _columnType: ValueType, _columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'number') {
            return 'substr(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value + 1, params, 'int', 'int', typeAdapter, false) + ')'
        } else {
            return 'substr(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValueParenthesis(value, params, 'int', 'int', typeAdapter, false) + ' + 1)'
        }
    }
    _getMathArgumentType(columnType: ValueType, _columnTypeName: string, value: any): ValueType {
        if (columnType === 'customInt' || columnType === 'customDouble') {
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
        if (columnType === 'customInt' || columnType === 'customDouble') {
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
    _power(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'power(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false) + ')'
    }
    _logn(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // The public API `value.logn(n)` means log base n of value, i.e. `log_n(value)`.
        // PostgreSQL, MariaDB, MySQL, SQLite and Oracle all spell this as `LOG(base, value)`
        // — base first. SQL Server's LOG is `LOG(value, base)` and overrides this method.
        return 'log(' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false) + ', ' + this._appendSql(valueSource, params, false) + ')'
    }
    _roundn(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'round(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false) + ')'
    }
    _minimumBetweenTwoValues(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'least(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false) + ')'
    }
    _maximumBetweenTwoValues(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'greatest(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false) + ')'
    }
    _add(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesisExcluding(valueSource, params, '_add', false) + ' + ' + this._appendValueParenthesisExcluding(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, '_add', false)
    }
    _subtract(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesisExcluding(valueSource, params, '_subtract', false) + ' - ' + this._appendValueParenthesis(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false)
    }
    _multiply(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesisExcluding(valueSource, params, '_multiply', false) + ' * ' + this._appendValueParenthesisExcluding(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, '_multiply', false)
    }
    _divide(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'cast(' + this._appendSql(valueSource, params, false) + ' as double presition) / cast(' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false) + ' as double presition)'
    }
    _modulo(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' % ' + this._appendValueParenthesis(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false)
    }
    _atan2(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'atan2(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false) + ')'
    }
    // SqlFunction2
    _substr(params: any[], valueSource: ToSql, value: any, value2: any, _columnType: ValueType, _columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'number') {
            return 'substr(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value + 1, params, 'int', 'int', typeAdapter, false) + ', ' + this._appendValue(value2, params, 'int', 'int', typeAdapter, false) + ')'
        } else {
            return 'substr(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValueParenthesis(value, params, 'int', 'int', typeAdapter, false) + ' + 1, ' + this._appendValue(value2, params, 'int', 'int', typeAdapter, false) + ')'
        }
    }
    _substring(params: any[], valueSource: ToSql, value: any, value2: any, _columnType: ValueType, _columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'number' && typeof value2 === 'number') {
            const count = value2 - value
            return 'substr(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value + 1, params, 'int', 'int', typeAdapter, false) + ', ' + this._appendValue(count, params, 'int', 'int', typeAdapter, false) + ')'
        }
        if (typeof value === 'number') {
            return 'substr(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value + 1, params, 'int', 'int', typeAdapter, false) + ', ' + this._appendValue(value2, params, 'int', 'int', typeAdapter, false) + ' - ' + this._appendValue(value, params, 'int', 'int', typeAdapter, false) + ')'
        } else {
            return 'substr(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValueParenthesis(value, params, 'int', 'int', typeAdapter, false) + ' + 1, ' + this._appendValue(value2, params, 'int', 'int', typeAdapter, false) + ' - ' + this._appendValue(value, params, 'int', 'int', typeAdapter, false) + ')'
        }
    }
    _replaceAll(params: any[], valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'replace(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + ', ' + this._appendValue(value2, params, columnType, columnTypeName, typeAdapter, false) + ')'
    }
    _buildCallProcedure(params: any[], procedureName: string, procedureParams: AnyValueSource[]): string {
        let result = 'call ' + this._escape(procedureName, false) + '('
        if (procedureParams.length > 0) {
            result += this._appendSql(procedureParams[0]!, params, false)

            for (let i = 1, length = procedureParams.length; i < length; i++) {
                result += ', ' + this._appendSql(procedureParams[i]!, params, false)
            }
        }

        return result + ')'
    }
    _buildCallFunction(params: any[], functionName: string, functionParams: AnyValueSource[]): string {
        let result = 'select ' + this._escape(functionName, false) + '('
        if (functionParams.length > 0) {
            result += this._appendSql(functionParams[0]!, params, false)

            for (let i = 1, length = functionParams.length; i < length; i++) {
                result += ', ' + this._appendSql(functionParams[i]!, params, false)
            }
        }

        return result + ')'
    }
    _fragment(params: any[], sql: TemplateStringsArray, sqlParams: AnyValueSource[]): string {
        if (sqlParams.length <= 0) {
            return sql[0]!
        }
        let result = ''
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            result += sql[i]
            result += this._appendConditionSql(sqlParams[i]!, params, false)
        }
        result += sql[sql.length - 1]
        return result
    }
    _rawFragment(params: any[], sql: TemplateStringsArray, sqlParams: Array<AnyValueSource | IExecutableSelectQuery<any, any, any> | IExecutableInsertQuery<any, any> | IExecutableUpdateQuery<any, any> | IExecutableDeleteQuery<any, any>>): string {
        if (sqlParams.length <= 0) {
            return sql[0]!
        }
        let result = ''
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            result += sql[i]
            result += this._appendSql(sqlParams[i]!, params, false)
        }
        result += sql[sql.length - 1]
        return result
    }
    _rawFragmentTableName(params: any[], tableOrView: AnyTableOrView): string {
        return this._appendTableOrViewNameForFrom(tableOrView, params)
    }
    _rawFragmentTableAlias(params: any[], tableOrView: AnyTableOrView): string {
        const forceAliasFor = this._getForceAliasFor(params)
        const forceAliasAs = this._getForceAliasAs(params)
        const as = __getTableOrViewPrivate(tableOrView).__as
        const prefix = this._supportTableAliasWithAs ? 'as ' : ''

        if (forceAliasFor === tableOrView && forceAliasAs) {
            return prefix + this._escape(forceAliasAs, true)
        } else if (as) {
            return prefix + this._escape(as, true)
        }
        return ''
    }
    _countAll(_params: any[]): string {
        return 'count(*)'
    }
    _count(params: any[], value: any): string {
        return 'count(' + this._appendSql(value, params, false) + ')'
    }
    _countDistinct(params: any[], value: any): string {
        return 'count(distinct ' + this._appendSql(value, params, false) + ')'
    }
    _max(params: any[], value: any): string {
        return 'max(' + this._appendSql(value, params, false) + ')'
    }
    _min(params: any[], value: any): string {
        return 'min(' + this._appendSql(value, params, false) + ')'
    }
    _sum(params: any[], value: any): string {
        return 'sum(' + this._appendSql(value, params, false) + ')'
    }
    _sumDistinct(params: any[], value: any): string {
        return 'sum(distinct ' + this._appendSql(value, params, false) + ')'
    }
    _average(params: any[], value: any): string {
        return 'avg(' + this._appendSql(value, params, false) + ')'
    }
    _averageDistinct(params: any[], value: any): string {
        return 'avg(distinct ' + this._appendSql(value, params, false) + ')'
    }
    _stringConcat(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'string_concat(' + this._appendSql(value, params, false) + ')'
        } else if (separator === '') {
            return 'string_concat(' + this._appendSql(value, params, false) + ", '')"
        } else {
            return 'string_concat(' + this._appendSql(value, params, false) + ', ' + this._appendValue(separator, params, 'string', 'string', undefined, false) + ')'
        }
    }
    _stringConcatDistinct(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'string_concat(distinct ' + this._appendSql(value, params, false) + ')'
        } else if (separator === '') {
            return 'string_concat(distinct ' + this._appendSql(value, params, false) + ", '')"
        } else {
            return 'string_concat(distinct ' + this._appendSql(value, params, false) + ', ' + this._appendValue(separator, params, 'string', 'string', undefined, false) + ')'
        }
    }
    _aggregateValueAsArray(valueSource: IAggregatedArrayValueSource<any, any, any>, params: any[]): string {
        const valueSourcePrivate = __getValueSourcePrivate(valueSource)
        const aggregatedArrayColumns = valueSourcePrivate.__aggregatedArrayColumns!
        const aggregatedArrayDistinct = valueSourcePrivate.__aggregatedArrayDistinct!
        return this._appendAggragateArrayColumns(aggregatedArrayColumns, aggregatedArrayDistinct, params, undefined)
    }
    _needAgggregateArrayColumnsTransformation(query: SelectData, _params: any[]): boolean {
        return !!query.__asInlineAggregatedArrayValue
    }
    _supportOrderByWhenAggregateArray = false
    _supportLimitWhenAggregateArray = false
    _needAgggregateArrayWrapper(query: SelectData, _params: any[]): boolean {
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
    _buildSelectAsAggregatedArray(_query: SelectData, _params: any[]): string {
        return ''
    }
    _appendAggragateArrayWrapperBegin(query: SelectData, params: any[], aggregateId: number): string {
        let aggregatedArrayColumns
        if (query.__oneColumn) {
            aggregatedArrayColumns = query.__columns['result']
            if (!aggregatedArrayColumns) {
                throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'invalid result column' }, 'Result column for a select one column not found')
            }
        } else {
            aggregatedArrayColumns = query.__columns
        }
        return 'select ' +  this._appendAggragateArrayWrappedColumns(aggregatedArrayColumns, params, aggregateId) + ' from ('
    }
    _appendAggragateArrayWrapperEnd(_query: SelectData, _params: any[], aggregateId: number): string {
        let result =  ')'
        if (this._supportTableAliasWithAs) {
            result += ' as '
        } else {
            result += ' '
        }
        result += 'a_' + aggregateId + '_'
        return result
    }
    _appendAggragateArrayColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayDistinct: boolean, params: any[], _query: SelectData | undefined): string {
        const distict = aggregatedArrayDistinct ? 'distinct ' : ''
        if (isValueSource(aggregatedArrayColumns)) {
            return 'json_agg(' + distict + this._appendSql(aggregatedArrayColumns, params, false) + ')'
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "', " + this._appendSql(columns[prop]!, params, false)
            }

            return 'json_agg(' +  distict + 'json_build_object(' + result + '))'
        }
    }
    _appendAggragateArrayWrappedColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, _params: any[], aggregateId: number): string {
        if (isValueSource(aggregatedArrayColumns)) {
            return 'json_agg(a_' + aggregateId + '_.result)'
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "', a_" + aggregateId + "_." + this._escape(prop, true)
            }

            return 'json_agg(json_build_object(' + result + '))'
        }
    }
}
