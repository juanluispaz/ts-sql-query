import { ToSql, SqlBuilder, DeleteData, InsertData, UpdateData, SelectData, SqlOperation, WithQueryData, CompoundOperator, JoinData, QueryColumns, FlatQueryColumns, flattenQueryColumns, getQueryColumn, WithData } from "./SqlBuilder"
import { ITableOrView, __ITableOrViewPrivate, __registerRequiredColumn, __registerTableOrView } from "../utils/ITableOrView"
import { AnyValueSource, BooleanValueSource, EqualableValueSource, IAggregatedArrayValueSource, IAnyBooleanValueSource, IExecutableSelectQuery, isValueSource, __AggregatedArrayColumns, __getValueSourceOfObject, __ValueSourcePrivate } from "../expressions/values"
import { Column, isColumn, __ColumnPrivate } from "../utils/Column"
import { CustomBooleanTypeAdapter, DefaultTypeAdapter, TypeAdapter } from "../TypeAdapter"
import type { ConnectionConfiguration } from "../utils/ConnectionConfiguration"
import { SequenceValueSource } from "../internal/ValueSourceImpl"
import { hasToSql, operationOf } from "./SqlBuilder"
import { __getTableOrViewPrivate } from "../utils/ITableOrView"
import { __getColumnOfObject, __getColumnPrivate } from "../utils/Column"
import { QueryRunner } from "../queryRunners/QueryRunner"
import { getWithData } from "./SqlBuilder"
import { __getValueSourcePrivate } from "../expressions/values"
import { RawFragment } from "../utils/RawFragment"

export class AbstractSqlBuilder implements SqlBuilder {
    // @ts-ignore
    _defaultTypeAdapter: DefaultTypeAdapter
    // @ts-ignore
    _queryRunner: QueryRunner
    // @ts-ignore
    _connectionConfiguration: ConnectionConfiguration
    _operationsThatNeedParenthesis: { [operation in keyof SqlOperation]?: boolean }
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
            _lessOrEquals: true,
            _greaterOrEquals: true,
            _and: true,
            _or: true,
            _concat: true,
            _add: true,
            _substract: true,
            _multiply: true,
            _divide: true,
            _modulo: true,
            _getMilliseconds: true,
            _fragment: true
        }
    }
    _generateUnique(): number {
        return this._unique++
    }
    _resetUnique(): void {
        this._unique = 1
    }
    _getSafeTableOrView(params: any[]): ITableOrView<any> | undefined {
        return (params as any)._safeTableOrView
    }
    _setSafeTableOrView(params: any[], tableOrView: ITableOrView<any> | undefined): void {
        Object.defineProperty(params, '_safeTableOrView', {
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
    _getForceAliasFor(params: any[]): ITableOrView<any> | undefined {
        return (params as any)._forceAliasFor
    }
    _setForceAliasFor(params: any[], value: ITableOrView<any> | undefined): void {
        Object.defineProperty(params, '_forceAliasFor', {
            value: value,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
    _getFakeNamesOf(params: any[]): Set<ITableOrView<any>> | undefined {
        return (params as any)._fakeNamesOf
    }
    _setFakeNamesOf(params: any[], value: Set<ITableOrView<any>> | undefined): void {
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
    _appendColumnName(column: Column, params: any[]): string {
        const columnPrivate = __getColumnPrivate(column)
        const typeAdapter = columnPrivate.__typeAdapter
        if (columnPrivate.__valueType === 'boolean' && typeAdapter instanceof CustomBooleanTypeAdapter) {
            return '(' + this._appendRawColumnName(column, params) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, params) + ')'
        }
        return this._appendRawColumnName(column, params)
    }
    _appendColumnNameForCondition(column: Column, params: any[]): string {
        const columnPrivate = __getColumnPrivate(column)
        const typeAdapter = columnPrivate.__typeAdapter
        if (columnPrivate.__valueType === 'boolean' && typeAdapter instanceof CustomBooleanTypeAdapter) {
            return this._appendRawColumnName(column, params) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, params)
        }
        return this._appendRawColumnName(column, params)
    }
    _appendRawColumnName(column: Column, params: any[]): string {
        const columnPrivate = __getColumnPrivate(column)
        const tableOrView = columnPrivate.__tableOrView
        const tablePrivate = __getTableOrViewPrivate(tableOrView)

        const forceAliasFor = this._getForceAliasFor(params)
        const forceAliasAs = this._getForceAliasAs(params)
        const fakeNamesOf = this._getFakeNamesOf(params)

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
    _appendLiteralValue(value: number | string, _params: any[]) {
        if (typeof value === 'number') {
            return '' + value
        } else {
            return "'" + value + "'"
        }
    }
    _getTableOrViewVisibleName(table: ITableOrView<any>): string {
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
    _appendTableOrViewName(table: ITableOrView<any>, params: any[]) {
        const t = __getTableOrViewPrivate(table)
        if (t.__template) {
            return this._appendRawFragment(t.__template, params)
        }
        
        const forceAliasFor = this._getForceAliasFor(params)
        const forceAliasAs = this._getForceAliasAs(params)

        let result = this._escape(t.__name, false)
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
        }
        return result
    }
    _appendRawFragment(rawFragment: RawFragment<any>, params: any[]): string {
        return (rawFragment as any as ToSql).__toSql(this, params) // RawFragment has a hidden implemetation of ToSql
    }
    _appendCondition(condition: IAnyBooleanValueSource<any, any>, params: any[]): string {
        if (hasToSql(condition)) {
            return condition.__toSqlForCondition(this, params)
        }
        throw new Error('Conditions must have a __toSqlForCondition method')
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
    _appendSql(value: ToSql | AnyValueSource | IExecutableSelectQuery<any, any, any, any>, params: any[]): string {
        return (value as ToSql).__toSql(this, params) // All ValueSource or Column have a hidden implemetation of ToSql
    }
    _appendSqlParenthesis(value: ToSql | AnyValueSource, params: any[]): string {
        if (this._needParenthesis(value)) {
            return '(' + this._appendSql(value, params) + ')'
        }
        return this._appendSql(value, params)
    }
    _appendSqlParenthesisExcluding(value: ToSql | AnyValueSource, params: any[], excluding: keyof SqlOperation): string {
        if (this._needParenthesisExcluding(value, excluding)) {
            return '(' + this._appendSql(value, params) + ')'
        }
        return this._appendSql(value, params)
    }
    _appendSpreadValue(value: any, params: any[], columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (hasToSql(value)) {
            return '(' + this._appendSql(value, params) + ')'
        }
        if (Array.isArray(value) && value.length > 0) {
            let arrayResult = '(' + this._appendValue(value[0], params, columnType, typeAdapter)

            for (let i = 1, length = value.length; i < length; i++) {
                arrayResult += ', ' + this._appendValue(value[i], params, columnType, typeAdapter)
            }
            return arrayResult + ')'
        }
        const adaptedValue = this._transformParamToDB(value, columnType, typeAdapter)
        return '(' + this._appendParam(adaptedValue, params, columnType) + ')'
    }
    _appendValue(value: any, params: any[], columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (hasToSql(value)) {
            return this._appendSql(value, params)
        }
        const adaptedValue = this._transformParamToDB(value, columnType, typeAdapter)
        return this._appendParam(adaptedValue, params, columnType)
    }
    _appendValueParenthesis(value: any, params: any[], columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._needParenthesis(value)) {
            return '(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
        return this._appendValue(value, params, columnType, typeAdapter)
    }
    _appendValueParenthesisExcluding(value: any, params: any[], columnType: string, typeAdapter: TypeAdapter | undefined, excluding: keyof SqlOperation): string {
        if (this._needParenthesisExcluding(value, excluding)) {
            return '(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
        return this._appendValue(value, params, columnType, typeAdapter)
    }
    _appendConditionSql(value: ToSql | AnyValueSource, params: any[]): string {
        return (value as ToSql).__toSqlForCondition(this, params) // All ValueSource or Column have a hidden implemetation of ToSql
    }
    _appendConditionSqlParenthesisExcluding(value: ToSql | AnyValueSource, params: any[], excluding: keyof SqlOperation): string {
        if (this._needParenthesisExcluding(value, excluding)) {
            return '(' + this._appendConditionSql(value, params) + ')'
        }
        return this._appendConditionSql(value, params)
    }
    _appendConditionValue(value: any, params: any[], columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (hasToSql(value)) {
            return this._appendConditionSql(value, params)
        }
        const adaptedValue = this._transformParamToDB(value, columnType, typeAdapter)
        return this._appendConditionParam(adaptedValue, params, columnType)
    }
    _appendConditionValueParenthesis(value: any, params: any[], columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._needParenthesis(value)) {
            return '(' + this._appendConditionValue(value, params, columnType, typeAdapter) + ')'
        }
        return this._appendConditionValue(value, params, columnType, typeAdapter)
    }
    _appendConditionValueParenthesisExcluding(value: any, params: any[], columnType: string, typeAdapter: TypeAdapter | undefined, excluding: keyof SqlOperation): string {
        if (this._needParenthesisExcluding(value, excluding)) {
            return '(' + this._appendConditionValue(value, params, columnType, typeAdapter) + ')'
        }
        return this._appendConditionValue(value, params, columnType, typeAdapter)
    }
    _transformParamToDB(value: any, columnType: string, typeAdapter: TypeAdapter | undefined): any {
        if (typeAdapter) {
            return typeAdapter.transformValueToDB(value, columnType, this._defaultTypeAdapter)
        } else {
            return this._defaultTypeAdapter.transformValueToDB(value, columnType)
        }
    }
    _appendParam(value: any, params: any[], _columnType: string): string {
        return this._queryRunner.addParam(params, value)
    }
    _appendConditionParam(value: any, params: any[], columnType: string): string {
        return this._appendParam(value, params, columnType)
    }
    _appendColumnAlias(name: string, _params: any[]): string {
        return this._escape(name, true)
    }
    _appendColumnValue(value: AnyValueSource, params: any[], _isOutermostQuery: boolean): string {
        return this._appendSql(value, params)
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
            if (result) {
                result += ', '
            }
            const withView = getWithData(withs[i]!)
            result += withView.__name
            result += this._appendWithColumns(withView, params)
            result += ' as ('
            result += this._buildSelect(withView.__selectData, params)
            result += ')'
            recursive = recursive || !!withView.__recursive
        }
        this._setWithGeneratedFinished(params, true)
        return this._appendWithKeyword(recursive) + ' ' + result + ' '
    }
    _appendWithColumns(_withData: WithData, _params: any[]): string {
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
                throw new Error('Invalid compound operator: ' + compoundOperator)
        }   
    }
    _buildSelectWithColumnsInfoForCompound(query: SelectData, params: any[], columnsForInsert: { [name: string]: Column | undefined }, isOutermostQuery: boolean): string {
        const result = this._buildSelectWithColumnsInfo(query, params, columnsForInsert, isOutermostQuery)
        if (query.__limit !== undefined || query.__offset !== undefined || query.__orderBy !== undefined) {
            return '(' + result + ')'
        }
        return result
    }
    _buildFromJoins(tables: ITableOrView<any>[] | undefined, joins: JoinData[] | undefined, requiredTablesOrViews: Set<ITableOrView<any>> | undefined, params: any[]): string {
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
                    fromJoins += ' letf outer join '
                    break
                default:
                    throw new Error('Invalid join type: ' + join.__joinType)
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
    _buildSelectWithColumnsInfo(query: SelectData, params: any[], columnsForInsert: { [name: string]: Column | undefined }, isOutermostQuery: boolean): string {
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
            
            selectQuery += this._buildWith(query, params)
            selectQuery += this._buildSelectWithColumnsInfoForCompound(query.__firstQuery, params, columnsForInsert, isOutermostQuery)
            selectQuery += this._appendCompoundOperator(query.__compoundOperator, params)
            selectQuery += this._buildSelectWithColumnsInfoForCompound(query.__secondQuery, params, columnsForInsert, isOutermostQuery)

            if (!query.__asInlineAggregatedArrayValue || !this._supportOrderByWhenAggregateArray || this._isAggregateArrayWrapped(params)) {
                selectQuery += this._buildSelectOrderBy(query, params)
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

        const oldFakeNameOf = this._getFakeNamesOf(params)
        if (oldFakeNameOf) {
            const requiredTablesOrViews = query.__requiredTablesOrViews
            if (requiredTablesOrViews) {
                const newFakeNameOf = new Set<ITableOrView<any>>()
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
        const joinsLength = joins.length

        if (tablesLength === 1 && joinsLength <= 0) {
            this._setSafeTableOrView(params, tables[0])
        } else {
            this._setSafeTableOrView(params, undefined)
        }

        let selectQuery = ''
            
        if (needAgggregateArrayWrapper) {
            selectQuery += this._appendAggragateArrayWrapperBegin(query, params, aggregateId)
            this._setAggregateArrayWrapped(params, true)
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
                    throw new Error('Illegal state: result column for a select one column not found')
                }
            } else {
                aggregatedArrayColumns = query.__columns
            }
            selectQuery += this._appendAggragateArrayColumns(aggregatedArrayColumns, params, query)
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

        let requireComma = false
        const groupBy = query.__groupBy
        for (let i = 0, length = groupBy.length; i < length; i++) {
            if (requireComma) {
                selectQuery += ', '
            } else {
                selectQuery += ' group by '
            }
            selectQuery += this._appendSelectColumn(groupBy[i]!, params, undefined, isOutermostQuery)
            requireComma = true
        }

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
            selectQuery += this._buildSelectOrderBy(query, params)
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
    _appendSelectColumn(value: AnyValueSource, params: any[], columnForInsert: Column | undefined, isOutermostQuery: boolean): string {
        if (columnForInsert) {
            const sql = this._appendCustomBooleanRemapForColumnIfRequired(columnForInsert, value, params)
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
            return ''
        }
        const columns = query.__columns
        let orderByColumns = ''
        for (const property in orderBy) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            const column = getQueryColumn(columns, property)
            if (!column) {
                throw new Error('Column ' + property + ' included in the order by not found in the select clause')
            }
            const columnAlias = this._appendColumnAlias(property, params)
            const order = orderBy[property]
            if (!order) {
                orderByColumns += columnAlias
            } else switch (order) {
                case 'asc':
                case 'desc': 
                case 'asc nulls first':
                case 'asc nulls last':
                case 'desc nulls first':
                case 'desc nulls last' :
                    orderByColumns += columnAlias + ' ' + order
                    break
                case 'insensitive':
                case 'asc insensitive':
                case 'desc insensitive':
                case 'asc nulls first insensitive':
                case 'asc nulls last insensitive':
                case 'desc nulls first insensitive':
                case 'desc nulls last insensitive': {
                    let sqlOrder = order.substring(0, order.length - 12)
                    if (sqlOrder) {
                        sqlOrder = ' ' + sqlOrder
                    }
                    const collation = this._connectionConfiguration.insesitiveCollation
                    const columnType = __getValueSourcePrivate(column).__valueType
                    if (columnType != 'string') {
                        // Ignore the insensitive term, it do nothing
                        orderByColumns += columnAlias + ' ' + sqlOrder
                    } else if (collation) {
                        orderByColumns += columnAlias + ' collate ' + collation + sqlOrder
                    } else if (collation === '') {
                        orderByColumns += columnAlias + sqlOrder
                    } else {
                        orderByColumns += 'lower(' + columnAlias + ')' + sqlOrder
                    }
                    break
                }
                default:
                    throw new Error('Invalid order by: ' + property + ' ' + order)
            }
        }

        if (!orderByColumns) {
            return ''
        }
        return ' order by ' + orderByColumns
    }
    _buildSelectLimitOffset(query: SelectData, params: any[]): string {
        let result = ''

        const offset = query.__offset
        if (offset !== null && offset !== undefined) {
            result += ' offset ' + this._appendValue(offset, params, 'int', undefined) + ' rows'
        }
        const limit = query.__limit
        if (limit !== null && limit !== undefined) {
            result += ' fetch next ' + this._appendValue(limit, params, 'int', undefined) + ' rows only'
        }
        return result
    }
    _insertSupportWith = true
    _buildInsertMultiple(query: InsertData, params: any[]): string {
        const multiple = query.__multiple
        if (!multiple) {
            throw new Error('Exepected a multiple insert')
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
        if (this._insertSupportWith) {
            insertQuery += this._buildWith(query, params)
        }
        insertQuery += 'insert '
        if (customization && customization.afterInsertKeyword) {
            insertQuery += this._appendRawFragment(customization.afterInsertKeyword, params) + ' '
        }
        insertQuery += 'into '
        insertQuery += this._appendTableOrViewName(table, params)

        const usedColumns: { [name: string]: boolean | undefined } = {}
        for (let i = 0, length = multiple.length; i < length; i++) {
            const sets = multiple[i]
            const properties = Object.getOwnPropertyNames(sets)
            for (let j = 0, length = properties.length; j < length; j++) {
                const columnName = properties[j]!
                usedColumns[columnName] = true
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

                const value = sets[columnName]
                const columnPrivate = __getColumnPrivate(column)
                const sequenceName = columnPrivate.__sequenceName
                if (!(columnName in sets) && sequenceName) {
                    values += this._nextSequenceValue(params, sequenceName)
                } else {
                    values += this._appendValueForColumn(column, value, params)
                }
            }

            if (multipleValues) {
                multipleValues += ', (' + values + ')'
            } else {
                multipleValues = '(' + values + ')'
            }
        }

        insertQuery += ' values ' + multipleValues
        insertQuery += this._buildInsertReturning(query, params)
        if (customization && customization.afterQuery) {
            insertQuery += ' ' + this._appendRawFragment(customization.afterQuery, params)
        }

        this._setSafeTableOrView(params, oldSafeTableOrView)
        this._setFakeNamesOf(params, oldFakeNameOf)
        this._resetRootQuery(query, params)
        return insertQuery
    }
    _appendCustomBooleanRemapForColumnIfRequired(column: Column, value: any, params: any[]): string | null {
        const columnPrivate = __getColumnPrivate(column)
        const columnTypeAdapter = columnPrivate.__typeAdapter
        const columnType = columnPrivate.__valueType

        if (columnType !== 'boolean') {
            return null // non-boolean
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
                        return 'case when ' + this._appendRawColumnName(value, params) + ' = ' + this._appendLiteralValue(valueTypeAdapter.trueValue, params) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' when ' + this._appendRawColumnName(value, params) + ' = ' + this._appendLiteralValue(valueTypeAdapter.falseValue, params) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' else null end'
                    }
                }
            }

            if (columnPrivate.__optionalType === 'required') {
                // remapped
                return 'case when ' + this._appendConditionValue(value, params, columnType, columnTypeAdapter) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' end'
            } else {
                // remapped
                return 'case when ' + this._appendConditionValue(value, params, columnType, columnTypeAdapter) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' when not ' + this._appendValue(value, params, columnType, columnTypeAdapter) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' else null end'
            }
        }

        // if value is column and its type adapter is CustomBooleanTypeAdapter append value will be required to normalize value
        // if not it is same boolean, nothing to transform here
        return null
    }
    _appendValueForColumn(column: Column, value: any, params: any[]): string {
        const sql = this._appendCustomBooleanRemapForColumnIfRequired(column, value, params)
        if (sql) {
            return sql
        }
        const columnPrivate = __getColumnPrivate(column)
        return this._appendValue(value, params, columnPrivate.__valueType, columnPrivate.__typeAdapter)
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
        if (this._insertSupportWith) {
            insertQuery += this._buildWith(query, params)
        }
        insertQuery += 'insert '
        if (customization && customization.afterInsertKeyword) {
            insertQuery += this._appendRawFragment(customization.afterInsertKeyword, params) + ' '
        }
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
        if (this._insertSupportWith) {
            insertQuery += this._buildWith(query, params)
        }
        insertQuery += 'insert '
        if (customization && customization.afterInsertKeyword) {
            insertQuery += this._appendRawFragment(customization.afterInsertKeyword, params) + ' '
        }
        insertQuery += 'into '
        insertQuery += this._appendTableOrViewName(table, params)

        let columns = ''
        const sequences: string[] = []
        for (var columnName in table) {
            if (columnName in sets) {
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

            columns += this._appendRawColumnName(column, params)
            sequences.push(columnPrivate.__sequenceName)
        }
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
            values += this._appendValueForColumn(column, value, params)
        }

        insertQuery += ' values (' + values + ')'
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
            throw new Error('Exepected an insert from a subquery')
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
        if (this._insertSupportWith) {
            insertQuery += this._buildWith(query, params)
        }
        insertQuery += 'insert '
        if (customization && customization.afterInsertKeyword) {
            insertQuery += this._appendRawFragment(customization.afterInsertKeyword, params) + ' '
        }
        insertQuery += 'into '
        insertQuery += this._appendTableOrViewName(table, params)

        const columnsForInsert: { [name: string]: Column | undefined } = {}

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
            selectColumns[columnName] = new SequenceValueSource('_nextSequenceValue', columnPrivate.__sequenceName, columnPrivate.__valueType, 'required', columnPrivate.__typeAdapter)
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
                throw new Error('Unable to find the column "' + property + ' in the table "' + this._getTableOrViewVisibleName(table) +'". The column is not included in the table definition')
            }
        }

        insertQuery += ' (' + columns + ')'
        insertQuery += this._buildInsertOutput(query, params)
        insertQuery += ' ' + this._buildSelectWithColumnsInfo(from, params, columnsForInsert, false)
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
            return ' returning ' + this._appendSql(idColumn, params)
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

        let updateQuery = this._buildWith(query, params)
        updateQuery += 'update '

        if (customization && customization.afterUpdateKeyword) {
            updateQuery += this._appendRawFragment(customization.afterUpdateKeyword, params) + ' '
        }

        const oldForceAliasFor = this._getForceAliasFor(params)
        const oldForceAliasAs = this._getForceAliasAs(params)
        if (this._updateOldValueInFrom && query.__oldValues) {
            this._setForceAliasFor(params, query.__table)
            this._setForceAliasAs(params, this._updateNewAlias)
        }
        updateQuery += this._appendTableOrViewName(table, params)
        updateQuery += this._buildAfterUpdateTable(query, params)

        let columns = ''
        let updatePrimaryKey = false
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

            const columnPrivate = __getColumnPrivate(column)
            updatePrimaryKey = updatePrimaryKey || columnPrivate.__isPrimaryKey

            if (columns) {
                columns += ', '
            }
            const value = sets[property]
            columns += this._appendColumnNameForUpdate(column, params)
            columns += ' = '
            columns += this._appendValueForColumn(column, value, params)
        }
        updateQuery += ' set ' + columns

        updateQuery += this._buildUpdateOutput(query, params)
        updateQuery += this._buildUpdateFrom(query, updatePrimaryKey, requiredTables, requiredColumns, params)

        if (oldValues && this._updateOldValueInFrom) {
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
                    throw new Error('The column ' + property + ' is missing from the old values table')
                }
                const condition = (column as any as EqualableValueSource<any, any, any, any>).equals(oldCoumn)
                if (where) {
                    where = where.and(condition)
                } else {
                    where = condition
                }
            }
            if (!where) {
                throw new Error('No primary key found')
            }

            const oldForceAliasFor = this._getForceAliasFor(params)
            const oldForceAliasAs = this._getForceAliasAs(params)

            this._setForceAliasFor(params, table)
            this._setForceAliasAs(params, this._updateNewAlias)
            const whereCondition = this._appendCondition(where, params)
            if (whereCondition) {
                updateQuery += ' where ' + whereCondition
            } else if (!query.__allowNoWhere) {
                throw new Error('No where generated for link with the update old values')
            }
            this._setForceAliasFor(params, oldForceAliasFor)
            this._setForceAliasAs(params, oldForceAliasAs)
        } else if (query.__where) {
            const whereCondition = this._appendCondition(query.__where, params)
            if (whereCondition) {
                updateQuery += ' where ' + whereCondition
            } else if (!query.__allowNoWhere) {
                throw new Error('No where defined for the update operation')
            }
        } else if (!query.__allowNoWhere) {
            throw new Error('No where defined for the update operation')
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
    _extractAdditionalRequiredTablesForUpdate(query: UpdateData, _params: any[]): Set<ITableOrView<any>> | undefined {
        if (!this._updateOldValueInFrom || !query.__oldValues) {
            return undefined
        }
        const froms = query.__froms
        const joins = query.__joins
        if ((!froms || froms.length < 0) && (!joins || joins.length < 0)) {
            return undefined
        }

        const result = new Set<ITableOrView<any>>()

        const sets = query.__sets
        for (let property in sets) {
            __registerTableOrView(sets[property], result)
        }

        const columns = query.__columns
        if (columns) {
            for (let property in columns) {
                __registerTableOrView(columns[property], result)
            }
        }

        result.delete(query.__table)
        result.delete(query.__oldValues)
        if (result.size <= 0) {
            return undefined
        }
        return result
    }
    _extractAdditionalRequiredColumnsForUpdate(query: UpdateData, requiredTables: Set<ITableOrView<any>> | undefined, _params: any[]): Set<Column> | undefined {
        if (!requiredTables) {
            return undefined
        }

        const result = new Set<Column>()

        const sets = query.__sets
        for (let property in sets) {
            __registerRequiredColumn(sets[property], result, requiredTables)
        }

        const columns = query.__columns
        if (columns) {
            for (let property in columns) {
                __registerRequiredColumn(columns[property], result, requiredTables)
            }
        }

        if (result.size <= 0) {
            return undefined
        }
        return result
    }
    _updateNewAlias = '_new_'
    _updateOldValueInFrom = true
    _appendColumnNameForUpdate(column: Column, _params: any[]) {
        const columnPrivate = __getColumnPrivate(column)
        return this._escape(columnPrivate.__name, true)
    }
    _appendUpdateOldValueForUpdate(query: UpdateData, updatePrimaryKey: boolean, _requiredTables: Set<ITableOrView<any>> | undefined, _params: any[]) {
        const oldValues = query.__oldValues
        if (!oldValues) {
            return ''
        }
        const oldValuesPrivate = __getTableOrViewPrivate(oldValues)
        if (!oldValuesPrivate.__as) {
            throw new Error('No alias found for the old values to define the locking strategy')
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
    _buildUpdateFrom(query: UpdateData, updatePrimaryKey: boolean, requiredTables: Set<ITableOrView<any>> | undefined, requiredColumns: Set<Column> | undefined, params: any[]): string {
        if (!this._updateOldValueInFrom) {
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
            throw new Error('No alias found for the old values')
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
                from += this._appendSql(column, params)
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
                throw new Error('No where defined for the update operation')
            }
        } else if (!query.__allowNoWhere) {
            throw new Error('No where defined for the update operation')
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

        let deleteQuery = this._buildWith(query, params)
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
                throw new Error('No where defined for the delete operation')
            }
        } else if (!query.__allowNoWhere) {
            throw new Error('No where defined for the delete operation')
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
        return this._appendSqlParenthesis(valueSource, params) + ' is null'
    }
    _isNotNull(params: any[], valueSource: ToSql): string {
        return this._appendSqlParenthesis(valueSource, params) + ' is not null'
    }
    _hasSameBooleanTypeAdapter(valueSource: Column, value: Column): valueSource is Column  {
        if (isColumn(valueSource) && isColumn(value)) {
            const valueSourcePrivate = __getColumnPrivate(valueSource)
            const valuePrivate = __getColumnPrivate(value)
            if (valueSourcePrivate.__valueType === 'boolean' && valuePrivate.__valueType === 'boolean') {
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
    _equals(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, params) + ' = ' + this._appendRawColumnName(value, params)
        }
        return this._appendSqlParenthesis(valueSource, params) + ' = ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _notEquals(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, params) + ' <> ' + this._appendRawColumnName(value, params)
        }
        return this._appendSqlParenthesis(valueSource, params) + ' <> ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _is(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, params) + ' is not distinct from ' + this._appendRawColumnName(value, params)
        }
        return this._appendSqlParenthesis(valueSource, params) + ' is not distinct from ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _isNot(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, params) + ' is distinct from ' + this._appendRawColumnName(value, params)
        }
        return this._appendSqlParenthesis(valueSource, params) + ' is distinct from ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _equalsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' = ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' = ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') = lower(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
    }
    _notEqualsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' <> ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' <> ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') <> lower(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
    }
    _lessThan(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' < ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _greaterThan(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' > ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _lessOrEquals(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' <= ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _greaterOrEquals(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' >= ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _in(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' in ' + this._appendSpreadValue(value, params, columnType, typeAdapter)
    }
    _notIn(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' not in ' + this._appendSpreadValue(value, params, columnType, typeAdapter)
    }
    _like(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' like ' + this._appendValue(value, params, columnType, typeAdapter)
    }
    _notLike(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' not like ' + this._appendValue(value, params, columnType, typeAdapter)
    }
    _likeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' like ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' like ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') like lower(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
    }
    _notLikeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' not like ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' not like ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') not like lower(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
    }
    _startsWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' like (' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
    }
    _notStartsWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' not like (' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
    }
    _endsWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
    }
    _notEndsWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
    }
    _startsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' like (' + this._escapeLikeWildcard(value, params, columnType, typeAdapter) + " || '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' like (' + this._escapeLikeWildcard(value, params, columnType, typeAdapter) + " || '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') like lower(' + this._escapeLikeWildcard(value, params, columnType, typeAdapter) + " || '%')"
        }
    }
    _notStartsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' not like (' + this._escapeLikeWildcard(value, params, columnType, typeAdapter) + " || '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' not like (' + this._escapeLikeWildcard(value, params, columnType, typeAdapter) + " || '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') not like lower(' + this._escapeLikeWildcard(value, params, columnType, typeAdapter) + " || '%')"
        }
    }
    _endsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
        }
    }
    _notEndsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") not like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
        }
    }
    _contains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
    }
    _notContains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
    }
    _containsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
        }
    }
    _notContainsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") not like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
        }
    }
    // SqlComparator2
    _between(params: any[], valueSource: ToSql, value: any, value2: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' between ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' and ' + this._appendValueParenthesis(value2, params, columnType, typeAdapter)
    }
    _notBetween(params: any[], valueSource: ToSql, value: any, value2: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' not between ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' and ' + this._appendValueParenthesis(value2, params, columnType, typeAdapter)
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
    _const(params: any[], value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendValue(value, params, columnType, typeAdapter)
    }
    _constForCondition(params: any[], value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendConditionValue(value, params, columnType, typeAdapter)
    }
    _exists(params: any[], value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'exists(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _notExists(params: any[], value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'not exists(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _escapeLikeWildcard(params: any[], value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'string') {
            value = value.replace(/\\/g, '\\\\')
            value = value.replace(/%/g, '\\%')
            value = value.replace(/_/g, '\\_')
            return this._appendValue(value, params, columnType, typeAdapter)
        } else {
            return "replace(replace(replace(" + this._appendValue(value, params, columnType, typeAdapter) + ", '\\', '\\\\'), '%', '\\%'), '_', '\\_')"
        }
    }
    // SqlFunctions0
    _negate(params: any[], valueSource: ToSql): string {
        const sql = this._appendConditionSql(valueSource, params)
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
        return 'lower(' + this._appendSql(valueSource, params) + ')'
    }
    _toUpperCase(params: any[], valueSource: ToSql): string {
        return 'upper(' + this._appendSql(valueSource, params) + ')'
    }
    _length(params: any[], valueSource: ToSql): string {
        return 'length(' + this._appendSql(valueSource, params) + ')'
    }
    _trim(params: any[], valueSource: ToSql): string {
        return 'trim(' + this._appendSql(valueSource, params) + ')'
    }
    _trimLeft(params: any[], valueSource: ToSql): string {
        return 'ltrim(' + this._appendSql(valueSource, params) + ')'
    }
    _trimRight(params: any[], valueSource: ToSql): string {
        return 'rtrim(' + this._appendSql(valueSource, params) + ')'
    }
    _reverse(params: any[], valueSource: ToSql): string {
        return 'reverse(' + this._appendSql(valueSource, params) + ')'
    }
    _asDouble(params: any[], valueSource: ToSql): string {
        return 'cast(' + this._appendSql(valueSource, params) + 'as double presition)'
    }
    _abs(params: any[], valueSource: ToSql): string {
        return 'abs(' + this._appendSql(valueSource, params) + ')'
    }
    _ceil(params: any[], valueSource: ToSql): string {
        return 'ceil(' + this._appendSql(valueSource, params) + ')'
    }
    _floor(params: any[], valueSource: ToSql): string {
        return 'floor(' + this._appendSql(valueSource, params) + ')'
    }
    _round(params: any[], valueSource: ToSql): string {
        return 'round(' + this._appendSql(valueSource, params) + ')'
    }
    _exp(params: any[], valueSource: ToSql): string {
        return 'exp(' + this._appendSql(valueSource, params) + ')'
    }
    _ln(params: any[], valueSource: ToSql): string {
        return 'ln(' + this._appendSql(valueSource, params) + ')'
    }
    _log10(params: any[], valueSource: ToSql): string {
        return 'log(' + this._appendSql(valueSource, params) + ')'
    }
    _sqrt(params: any[], valueSource: ToSql): string {
        return 'sqtr(' + this._appendSql(valueSource, params) + ')'
    }
    _cbrt(params: any[], valueSource: ToSql): string {
        return 'cbrt(' + this._appendSql(valueSource, params) + ')'
    }
    _sign(params: any[], valueSource: ToSql): string {
        return 'sign(' + this._appendSql(valueSource, params) + ')'
    }
    _acos(params: any[], valueSource: ToSql): string {
        return 'acos(' + this._appendSql(valueSource, params) + ')'
    }
    _asin(params: any[], valueSource: ToSql): string {
        return 'asin(' + this._appendSql(valueSource, params) + ')'
    }
    _atan(params: any[], valueSource: ToSql): string {
        return 'atan(' + this._appendSql(valueSource, params) + ')'
    }
    _cos(params: any[], valueSource: ToSql): string {
        return 'cos(' + this._appendSql(valueSource, params) + ')'
    }
    _cot(params: any[], valueSource: ToSql): string {
        return 'cot(' + this._appendSql(valueSource, params) + ')'
    }
    _sin(params: any[], valueSource: ToSql): string {
        return 'sin(' + this._appendSql(valueSource, params) + ')'
    }
    _tan(params: any[], valueSource: ToSql): string {
        return 'tan(' + this._appendSql(valueSource, params) + ')'
    }
    _getDate(params: any[], valueSource: ToSql): string {
        return 'extract(day from ' + this._appendSql(valueSource, params) + ')'
    }
    _getTime(params: any[], valueSource: ToSql): string {
        return 'round(extract(epoch from ' + this._appendSql(valueSource, params) + ') * 1000)'
    }
    _getFullYear(params: any[], valueSource: ToSql): string {
        return 'extract(year from ' + this._appendSql(valueSource, params) + ')'
    }
    _getMonth(params: any[], valueSource: ToSql): string {
        return 'extract(month from ' + this._appendSql(valueSource, params) + ')'
    }
    _getDay(params: any[], valueSource: ToSql): string {
        return 'extract(dow from ' + this._appendSql(valueSource, params) + ')'
    }
    _getHours(params: any[], valueSource: ToSql): string {
        return 'extract(hour from ' + this._appendSql(valueSource, params) + ')'
    }
    _getMinutes(params: any[], valueSource: ToSql): string {
        return 'extract(minute from ' + this._appendSql(valueSource, params) + ')'
    }
    _getSeconds(params: any[], valueSource: ToSql): string {
        return 'extract(second from ' + this._appendSql(valueSource, params) + ')'
    }
    _getMilliseconds(params: any[], valueSource: ToSql): string {
        return 'extract(millisecond from ' + this._appendSql(valueSource, params) + ') % 1000'
    }
    _asString(params: any[], valueSource: ToSql): string {
        // Transform an uuid to string
        return this._appendSqlParenthesis(valueSource, params) 
    }
    // SqlFunction1
    _valueWhenNull(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'coalesce(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _and(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        this._setResultingOperation(params, undefined)
        const sql = valueSource.__toSqlForCondition(this, params)
        const op = this._getResultingOperation(params)
        this._setResultingOperation(params, undefined)
        const sql2 = this._appendConditionValue(value, params, columnType, typeAdapter)
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
    _or(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        this._setResultingOperation(params, undefined)
        const sql = valueSource.__toSqlForCondition(this, params)
        const op = this._getResultingOperation(params)
        this._setResultingOperation(params, undefined)
        const sql2 = this._appendConditionValue(value, params, columnType, typeAdapter)
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
    _concat(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesisExcluding(valueSource, params, '_concat') + ' || ' + this._appendValueParenthesisExcluding(value, params, columnType, typeAdapter, '_concat')
    }
    _substrToEnd(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'substr(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _substringToEnd(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'substr(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _power(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'power(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _logn(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'log(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _roundn(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'round(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _minValue(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'least(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _maxValue(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'greatest(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _add(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesisExcluding(valueSource, params, '_add') + ' + ' + this._appendValueParenthesisExcluding(value, params, columnType, typeAdapter, '_add')
    }
    _substract(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesisExcluding(valueSource, params, '_substract') + ' - ' + this._appendValueParenthesisExcluding(value, params, columnType, typeAdapter, '_substract')
    }
    _multiply(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesisExcluding(valueSource, params, '_multiply') + ' * ' + this._appendValueParenthesisExcluding(value, params, columnType, typeAdapter, '_multiply')
    }
    _divide(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'cast(' + this._appendSql(valueSource, params) + ' as double presition) / cast(' + this._appendValue(value, params, columnType, typeAdapter) + ' as double presition)'
    }
    _modulo(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' % ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _atan2(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'atan2(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    // SqlFunction2
    _substr(params: any[], valueSource: ToSql, value: any, value2: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'substr(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ', ' + this._appendValue(value2, params, columnType, typeAdapter) + ')'
    }
    _substring(params: any[], valueSource: ToSql, value: any, value2: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'number' && typeof value2 === 'number') {
            const count = value2 - value
            return 'substr(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ', ' + this._appendValue(count, params, columnType, typeAdapter) + ')'
        }
        return 'substr(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ', ' + this._appendValue(value2, params, columnType, typeAdapter) + ' - ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _replaceAll(params: any[], valueSource: ToSql, value: any, value2: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'replace(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ', ' + this._appendValue(value2, params, columnType, typeAdapter) + ')'
    }
    _buildCallProcedure(params: any[], procedureName: string, procedureParams: AnyValueSource[]): string {
        let result = 'call ' + this._escape(procedureName, false) + '('
        if (procedureParams.length > 0) {
            result += this._appendSql(procedureParams[0]!, params)

            for (let i = 1, length = procedureParams.length; i < length; i++) {
                result += ', ' + this._appendSql(procedureParams[i]!, params)
            }
        }

        return result + ')'
    }
    _buildCallFunction(params: any[], functionName: string, functionParams: AnyValueSource[]): string {
        let result = 'select ' + this._escape(functionName, false) + '('
        if (functionParams.length > 0) {
            result += this._appendSql(functionParams[0]!, params)

            for (let i = 1, length = functionParams.length; i < length; i++) {
                result += ', ' + this._appendSql(functionParams[i]!, params)
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
            result += this._appendConditionSql(sqlParams[i]!, params)
        }
        result += sql[sql.length - 1]
        return result
    }
    _rawFragment(params: any[], sql: TemplateStringsArray, sqlParams: Array<AnyValueSource | IExecutableSelectQuery<any, any, any, any>>): string {
        if (sqlParams.length <= 0) {
            return sql[0]!
        }
        let result = ''
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            result += sql[i]
            result += this._appendSql(sqlParams[i]!, params)
        }
        result += sql[sql.length - 1]
        return result
    }
    _rawFragmentTableName(_params: any[], tableOrView: ITableOrView<any>): string {
        const name = __getTableOrViewPrivate(tableOrView).__name
        return this._escape(name, false)
    }
    _rawFragmentTableAlias(params: any[], tableOrView: ITableOrView<any>): string {
        const forceAliasFor = this._getForceAliasFor(params)
        const forceAliasAs = this._getForceAliasAs(params)
        const as = __getTableOrViewPrivate(tableOrView).__as

        if (forceAliasFor === tableOrView && forceAliasAs) {
            return 'as ' + this._escape(forceAliasAs, true)
        } else if (as) {
            return 'as ' + this._escape(as, true)
        }
        return ''
    }
    _countAll(_params: any[]): string {
        return 'count(*)'
    }
    _count(params: any[], value: any): string {
        return 'count(' + this._appendSql(value, params) + ')'
    }
    _countDistinct(params: any[], value: any): string {
        return 'count(distinct ' + this._appendSql(value, params) + ')'
    }
    _max(params: any[], value: any): string {
        return 'max(' + this._appendSql(value, params) + ')'
    }
    _min(params: any[], value: any): string {
        return 'min(' + this._appendSql(value, params) + ')'
    }
    _sum(params: any[], value: any): string {
        return 'sum(' + this._appendSql(value, params) + ')'
    }
    _sumDistinct(params: any[], value: any): string {
        return 'sum(distinct ' + this._appendSql(value, params) + ')'
    }
    _average(params: any[], value: any): string {
        return 'avg(' + this._appendSql(value, params) + ')'
    }
    _averageDistinct(params: any[], value: any): string {
        return 'avg(distinct ' + this._appendSql(value, params) + ')'
    }
    _stringConcat(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'string_concat(' + this._appendSql(value, params) + ')'
        } else if (separator === '') {
            return 'string_concat(' + this._appendSql(value, params) + ", '')"
        } else {
            return 'string_concat(' + this._appendSql(value, params) + ', ' + this._appendValue(separator, params, 'string', undefined) + ')'
        }
    }
    _stringConcatDistinct(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'string_concat(distinct ' + this._appendSql(value, params) + ')'
        } else if (separator === '') {
            return 'string_concat(distinct ' + this._appendSql(value, params) + ", '')"
        } else {
            return 'string_concat(distinct ' + this._appendSql(value, params) + ', ' + this._appendValue(separator, params, 'string', undefined) + ')'
        }
    }
    _aggregateValueAsArray(valueSource: IAggregatedArrayValueSource<any, any, any>, params: any[]): string {
        const valueSourcePrivate = __getValueSourcePrivate(valueSource)
        const aggregatedArrayColumns = valueSourcePrivate.__aggregatedArrayColumns!
        return this._appendAggragateArrayColumns(aggregatedArrayColumns, params, undefined)
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
            if (query.__orderBy) {
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
                throw new Error('Illegal state: result column for a select one column not found')
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
    _appendAggragateArrayColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, params: any[], _query: SelectData | undefined): string {
        if (isValueSource(aggregatedArrayColumns)) {
            return 'json_agg(' + this._appendSql(aggregatedArrayColumns, params) + ')'
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "', " + this._appendSql(columns[prop]!, params)
            }

            return 'json_agg(json_build_object(' + result + '))'
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
