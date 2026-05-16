import type { ToSql, SelectData, InsertData, DeleteData, UpdateData, FlatQueryColumns, QueryColumns, WithValuesData } from './SqlBuilder.js'
import { hasToSql, flattenQueryColumns } from './SqlBuilder.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import { CustomBooleanTypeAdapter } from '../TypeAdapter.js'
import type { AnyValueSource, IExecutableSelectQuery, __AggregatedArrayColumns, ValueType, NativeValueType } from '../expressions/values.js'
import { isValueSource, __isUuidValueSource, __isBooleanValueSource, __isBooleanValueType } from '../expressions/values.js'
import { AbstractSqlBuilder } from './AbstractSqlBuilder.js'
import type { DBColumn } from '../utils/Column.js'
import { isColumn, __getColumnOfObject, __getColumnPrivate } from '../utils/Column.js'
import { __getValueSourcePrivate } from '../expressions/values.js'
import type { ITable } from '../utils/ITableOrView.js'
import { __getTableOrViewPrivate } from '../utils/ITableOrView.js'
import { TsSqlProcessingError } from '../TsSqlError.js'

export class SqlServerSqlBuilder extends AbstractSqlBuilder {
    sqlServer: true = true
    constructor() {
        super()
        this._operationsThatNeedParenthesis._getMonth = true
        this._operationsThatNeedParenthesis._getDay = true
    }
    override _appendRawColumnName(column: DBColumn, params: any[]): string {
        const columnPrivate = __getColumnPrivate(column)
        const tableOrView = columnPrivate.__tableOrView
        if (__getTableOrViewPrivate(tableOrView).__oldValues) {
            return 'deleted.' + this._escape(columnPrivate.__name, true)
        }
        return super._appendRawColumnName(column, params)
    }
    override _forceAsIdentifier(identifier: string): string {
        return '[' + identifier + ']'
    }
    override _isReservedKeyword(word: string): boolean {
        return word.toUpperCase() in reservedWords
    }
    override _nextSequenceValue(_params: any[], sequenceName: string) {
        return 'next value for ' + this._escape(sequenceName, false)
    }
    override _currentSequenceValue(_params: any[], sequenceName: string): string {
        return "(select current_value from sys.sequences where name = '" + sequenceName + "')"
    }
    override _trueValue = 'convert(bit, 1)'
    override _falseValue = 'convert(bit, 0)'
    override _trueValueForCondition = '(1=1)'
    override _falseValueForCondition = '(0=1)'
    _nullValueForCondition = '(0=null)'
    override _appendSql(value: ToSql | AnyValueSource | IExecutableSelectQuery<any, any, any>, params: any[], forceTypeCast: boolean): string {
        if (isValueSource(value) && !isColumn(value)) {
            const valueSourcePrivate = __getValueSourcePrivate(value)
            if (valueSourcePrivate.__isBooleanForCondition) {
                if (valueSourcePrivate.__optionalType === 'required') {
                    return 'cast(case when ' + super._appendConditionSql(value, params, forceTypeCast) + ' then 1 else 0 end as bit)'
                } else {
                    return 'cast(case when ' + super._appendConditionSql(value, params, forceTypeCast) + ' then 1 when not ' + super._appendConditionSqlParenthesis(value, params, forceTypeCast) + ' then 0 else null end as bit)'
                }
            }
        }
        return super._appendSql(value, params, forceTypeCast)
    }
    override _appendConditionSql(value: ToSql | AnyValueSource, params: any[], forceTypeCast: boolean): string {
        if (isValueSource(value) && !isColumn(value) && hasToSql(value)) {
            const valueSourcePrivate = __getValueSourcePrivate(value)
            if (__isBooleanValueSource(valueSourcePrivate) && !valueSourcePrivate.__isBooleanForCondition) {
                const sql = super._appendConditionSql(value, params, forceTypeCast)
                if (!sql || sql === this._trueValueForCondition || sql === this._falseValueForCondition) {
                    return sql
                } else {
                    return '(' + sql + ' = 1)'
                }
            }
        }
        return super._appendConditionSql(value, params, forceTypeCast)
    }
    _isUuid(value: any): boolean {
        if (isValueSource(value)) {
            const valuePrivate = __getValueSourcePrivate(value)
            if (__isUuidValueSource(valuePrivate) || valuePrivate.__uuidString) {
                return true
            }
        }
        return false
    }
    _appendSqlMaybeUuid(value: ToSql | AnyValueSource | IExecutableSelectQuery<any, any, any>, params: any[]): string {
        if (this._isUuid(value)) {
            return 'convert(nvarchar, ' + this._appendSql(value, params, false) + ')'
        } else {
            return this._appendSql(value, params, false)
        }
    }
    override _appendConditionParam(value: any, params: any[], columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (__isBooleanValueType(columnType)) {
            if (isColumn(value)) {
                const columnPrivate = __getColumnPrivate(value)
                const typeAdapter = columnPrivate.__typeAdapter
                if (typeAdapter instanceof CustomBooleanTypeAdapter) {
                    return '(' + this._appendRawColumnName(value, params) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, params) + ')'
                }
            }
            return '(' + this._appendParam(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast) + ' = 1)'
        }
        return this._appendParam(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    override _appendParam(value: any, params: any[], columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        // keep the data type to use in the query runner
        Object.defineProperty(params, '@' + params.length, {
            value: columnType in nativeTypedValueType ? columnType : columnTypeName,
            writable: true,
            enumerable: false,
            configurable: true
        })
        return super._appendParam(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    override _appendColumnName(column: DBColumn, params: any[]): string {
        const columnPrivate = __getColumnPrivate(column)
        const typeAdapter = columnPrivate.__typeAdapter
        if (__isBooleanValueSource(columnPrivate)) {
            if (typeAdapter instanceof CustomBooleanTypeAdapter) {
                if (columnPrivate.__optionalType === 'required') {
                    return 'cast(case when ' + this._appendRawColumnName(column, params) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, params) + ' then 1 else 0 end as bit)'
                } else {
                    return 'cast(case ' + this._appendRawColumnName(column, params) + ' when ' + this._appendLiteralValue(typeAdapter.trueValue, params) +  ' then 1 when ' + this._appendLiteralValue(typeAdapter.falseValue, params) + ' then 0 else null end as bit)'
                }
            }
        }

        return this._appendRawColumnName(column, params)
    }
    override _appendColumnNameForCondition(column: DBColumn, params: any[]): string {
        const columnPrivate = __getColumnPrivate(column)
        const typeAdapter = columnPrivate.__typeAdapter
        if (__isBooleanValueSource(columnPrivate)) {
            if (typeAdapter instanceof CustomBooleanTypeAdapter) {
                return '(' + this._appendRawColumnName(column, params) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, params) + ')'
            } else {
                return '(' + this._appendRawColumnName(column, params) + ' = 1)'
            }
        }

        return this._appendRawColumnName(column, params)
    }
    override _inlineSelectAsValueForCondition(query: SelectData, params: any[]): string {
        if (query.__oneColumn) {
            const columns = query.__columns
            for (const prop in columns) {
                const column = columns[prop]
                if (isValueSource(column) && __isBooleanValueSource(__getValueSourcePrivate(column))) {
                    return '((' + this._buildInlineSelect(query, params) + ') = 1)'
                } else {
                    return this._buildInlineSelect(query, params)
                }
            }
        }
        return this._buildInlineSelect(query, params)
    }
    override _appendWithKeyword(_recursive: boolean): string {
        // Sql Server doesn't uses the recursive keyword
        return 'with'
    }
    override _buildWithValues(withValues: WithValuesData, params: any[]) {
        let result = withValues.__name
        result += ' as (select * from (values '

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
            valuesSql += '(' + valueSql + ')'
        }
        result += valuesSql
        result += ') as '
        result += withValues.__name

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
        result += ')'

        return result
    }
    override _buildSelectWithColumnsInfoForCompound(query: SelectData, params: any[], columnsForInsert: { [name: string]: DBColumn | undefined }, isOutermostQuery: boolean): string {
        const result = this._buildSelectWithColumnsInfo(query, params, columnsForInsert, isOutermostQuery)
        if (query.__limit !== undefined || query.__offset !== undefined || query.__orderBy || query.__customization?.beforeOrderByItems || query.__customization?.afterOrderByItems) {
            return 'select * from (' + result + ') _t_' + this._generateUnique() + '_'
        }
        return result
    }
    override _buildSelectOrderBy(query: SelectData, params: any[]): string {
        // How to index it: http://www.sqlines.com/oracle/function_based_indexes
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

            if (orderByColumns) {
                return ' order by ' + orderByColumns
            }

            const limit = query.__limit
            const offset = query.__offset
            if ((offset !== null && offset !== undefined) || (limit !== null && limit !== undefined)) {
                // Add fake order by to allow a limit and offset without order by
                const columns: FlatQueryColumns = {}
                flattenQueryColumns(query.__columns, columns, '')

                let index = 0
                for (const property in columns) {
                    index++
                    const column = columns[property]
                    if (isColumn(column)) {
                        if (__getColumnPrivate(column).__isPrimaryKey) {
                            return ' order by ' + index
                        }
                    }
                }
                return ' order by 1'
            } else {
                return ''
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
                case 'asc nulls first':
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, params) + ' asc'
                    break
                case 'desc':
                case 'desc nulls last':
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, params) + ' desc'
                    break
                case 'asc nulls last':
                    orderByColumns += 'iif(' + this._appendOrderByColumnAlias(entry, query, params) + ' is null, 1, 0), ' + this._appendOrderByColumnAlias(entry, query, params) + ' asc'
                    break
                case 'desc nulls first':
                    orderByColumns += 'iif(' + this._appendOrderByColumnAlias(entry, query, params) + ' is not null, 1, 0), ' + this._appendOrderByColumnAlias(entry, query, params) + ' desc'
                    break
                case 'insensitive':
                    orderByColumns += this._appendOrderByColumnAliasInsensitive(entry, query, params)
                    break
                case 'asc insensitive':
                case 'asc nulls first insensitive':
                    orderByColumns += this._appendOrderByColumnAliasInsensitive(entry, query, params) + ' asc'
                    break
                case 'desc insensitive':
                case 'desc nulls last insensitive':
                    orderByColumns += this._appendOrderByColumnAliasInsensitive(entry, query, params) + ' desc'
                    break
                case 'asc nulls last insensitive':
                    orderByColumns += 'iif(' + this._appendOrderByColumnAlias(entry, query, params) + ' is null, 1, 0), ' + this._appendOrderByColumnAliasInsensitive(entry, query, params) + ' asc'
                    break
                case 'desc nulls first insensitive':
                    orderByColumns += 'iif(' + this._appendOrderByColumnAlias(entry, query, params) + ' is not null, 1, 0), ' + this._appendOrderByColumnAliasInsensitive(entry, query, params) + ' desc'
                    break
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
        return ' order by ' + orderByColumns
    }
    override _buildSelectLimitOffset(query: SelectData, params: any[]): string {
        let result = ''

        const limit = query.__limit
        const offset = query.__offset
        if (offset !== null && offset !== undefined) {
            result += ' offset ' + this._appendValue(offset, params, 'int', 'int', undefined, false) + ' rows'
        }

        if (limit !== null && limit !== undefined) {
            if (!result) {
                result += ' offset 0 rows'
            }
            result += ' fetch next ' + this._appendValue(limit, params, 'int', 'int', undefined, false) + ' rows only'
        }

        if (!result && (query.__orderBy || query.__customization?.beforeOrderByItems || query.__customization?.afterOrderByItems) && !this._isCurrentRootQuery(query, params)) {
            // subqueries with order by requires always an offset, this add a noop offset
            result += ' offset 0 rows'
        }
        return result
    }
    override _buildInsertOutput(query: InsertData, params: any[]): string {
        const idColumn = query.__idColumn
        if (idColumn) {
            this._setContainsInsertReturningClause(params, true)
            return ' output inserted.' + this._appendSql(idColumn, params, false)
        }

        const result = this._buildQueryOutput(query.__columns, query.__table, 'inserted', params)
        this._setContainsInsertReturningClause(params, !!result)
        return result
    }
    override _buildInsertReturning(_query: InsertData, _params: any[]): string {
        return ''
    }
    override _useUpdateOldValueInFrom(): boolean {
        return false
    }
    override _buildUpdateOutput(query: UpdateData, params: any[]): string {
        return this._buildQueryOutput(query.__columns, query.__table, 'inserted', params)
    }
    override _buildUpdateReturning(_query: UpdateData, _params: any[]): string {
        return ''
    }
    override _buidDeleteUsing(query: DeleteData, params: any[]): string {
        const result = this._buildFromJoins(query.__using, query.__joins, undefined, params)
        if (result) {
            return ' from ' + result
        }
        return ''
    }
    override _buildDeleteOutput(query: DeleteData, params: any[]): string {
        return this._buildQueryOutput(query.__columns, query.__table, 'deleted', params)
    }
    _buildQueryOutput(queryColumns: QueryColumns | undefined, table: ITable<any>, alias: string, params: any[]): string {
        if (!queryColumns) {
            return ''
        }
        const columns: FlatQueryColumns = {}
        flattenQueryColumns(queryColumns, columns, '')

        const oldForceAliasFor = this._getForceAliasFor(params)
        const oldForceAliasAs = this._getForceAliasAs(params)

        this._setForceAliasFor(params, table)
        this._setForceAliasAs(params, alias)

        let requireComma = false
        let result = ''
        for (const property in columns) {
            if (requireComma) {
                result += ', '
            }
            result += this._appendSql(columns[property]!, params, false)
            if (property) {
                result += ' as ' + this._appendColumnAlias(property, params)
            }
            requireComma = true
        }

        this._setForceAliasFor(params, oldForceAliasFor)
        this._setForceAliasAs(params, oldForceAliasAs)
        if (!result) {
            return ''
        }
        return ' output ' + result
    }
    override _buildDeleteReturning(_query: DeleteData, _params: any[]): string {
        return ''
    }
    _isNullValue(value: any) {
        if (value === null || value === undefined) {
            return true
        }
        if (!isValueSource(value)) {
            return false
        }
        const valueSourcePrivate = __getValueSourcePrivate(value)
        if (valueSourcePrivate.isConstValue()) {
            const valueSourceValue = valueSourcePrivate.getConstValue()
            if (valueSourceValue === null || valueSourceValue === undefined) {
                return true
            }
        }
        return false
    }
    _isOptionalValue(value: any) {
        if (value === null || value === undefined) {
            return true
        }
        if (!isValueSource(value)) {
            return false
        }
        const valueSourcePrivate = __getValueSourcePrivate(value)
        if (valueSourcePrivate.isConstValue()) {
            const valueSourceValue = valueSourcePrivate.getConstValue()
            if (valueSourceValue === null || valueSourceValue === undefined) {
                return true
            }
        }
        return valueSourcePrivate.__optionalType !== 'required'
    }
    override _isNull(params: any[], valueSource: ToSql): string {
        if (isColumn(valueSource)) {
            return this._appendRawColumnName(valueSource, params) + ' is null'
        } else if (isValueSource(valueSource)) {
            const valueSourcePrivate = __getValueSourcePrivate(valueSource)
            if (valueSourcePrivate.__isBooleanForCondition) {
                if (valueSourcePrivate.__optionalType === 'required') {
                    return this._falseValueForCondition
                } else {
                    // This is a boolean value (0 or 1 from a column) that need to be use in a boolean expression
                    return '(case when ' + this._appendConditionSql(valueSource, params, false) + ' then 0 when not ' + this._appendConditionSqlParenthesis(valueSource, params, false) + ' then 0 else 1 end = 1)'
                }
            }
        }
        return this._appendSqlParenthesis(valueSource, params, false) + ' is null'
    }
    _generalIsNull(params: any[], value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (hasToSql(value)) {
            return this._isNull(params, value)
        }
        return this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ' is null'
    }
    override _isNotNull(params: any[], valueSource: ToSql): string {
        if (isColumn(valueSource)) {
            this._appendRawColumnName(valueSource, params) + ' is not null'
        }
        if (isValueSource(valueSource)) {
            const valueSourcePrivate = __getValueSourcePrivate(valueSource)
            if (valueSourcePrivate.__isBooleanForCondition) {
                if (valueSourcePrivate.__optionalType === 'required') {
                    return this._trueValueForCondition
                } else {
                    // This is a boolean value (0 or 1 from a column) that need to be use in a boolean expression
                    return '(case when ' + this._appendConditionSql(valueSource, params, false) + ' then 1 when not ' + this._appendConditionSqlParenthesis(valueSource, params, false) + ' then 1 else 0 end = 1)'
                }
            }
        }
        return this._appendSqlParenthesis(valueSource, params, false) + ' is not null'
    }
    _generalIsNotNull(params: any[], value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (hasToSql(value)) {
            return this._isNotNull(params, value)
        }
        return this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ' is not null'
    }
    override _is(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const valueIsNull = this._isNullValue(value)
        const valueSourceIsNull = this._isNullValue(valueSource)
        const valueIsOptional = this._isOptionalValue(value)
        const valueSourceIsOptional = this._isOptionalValue(valueSource)

        if (valueIsNull) {
            return this._isNull(params, valueSource)
        }
        if (valueSourceIsNull) {
            // We know value is null or undefined, then, whe need to ensure the value source is null as well
            return this._generalIsNull(params, value, columnType, columnTypeName, typeAdapter)
        }

        if (valueSourceIsOptional && valueIsOptional) {
            return 'case when (' + this._equals(params, valueSource, value, columnType, columnTypeName, typeAdapter) + ') or (' + this._isNull(params, valueSource) + ' and ' + this._generalIsNull(params, value, columnType, columnTypeName, typeAdapter) + ') then 1 else 0 end = 1'
        } else if (valueSourceIsOptional || valueIsOptional) {
            return 'case when ' + this._equals(params, valueSource, value, columnType, columnTypeName, typeAdapter) + ' then 1 else 0 end = 1'
        } else {
            return this._equals(params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }

        // Alternative implementation that avoid evaluate multiple times the arguments
        // return 'exists(select ' + this._appendSqlParenthesis(valueSource, params) + ' intersect select ' + this._appendValueParenthesis(value, params, columnTypeName, typeAdapter) + ')'
    }
    override _isNot(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const valueIsNull = this._isNullValue(value)
        const valueSourceIsNull = this._isNullValue(valueSource)
        const valueIsOptional = this._isOptionalValue(value)
        const valueSourceIsOptional = this._isOptionalValue(valueSource)

        if (valueIsNull) {
            return this._isNotNull(params, valueSource)
        }
        if (valueSourceIsNull) {
            // We know value is null or undefined, then, whe need to ensure the value source is null as well
            return this._generalIsNotNull(params, value, columnType, columnTypeName, typeAdapter)
        }

        if (valueSourceIsOptional && valueIsOptional) {
            return 'not (case when (' + this._equals(params, valueSource, value, columnType, columnTypeName, typeAdapter) + ') or (' + this._isNull(params, valueSource) + ' and ' + this._generalIsNull(params, value, columnType, columnTypeName, typeAdapter) + ') then 1 else 0 end = 1)'
        } else if (valueSourceIsOptional || valueIsOptional) {
            return 'not (case when ' + this._equals(params, valueSource, value, columnType, columnTypeName, typeAdapter) + ' then 1 else 0 end = 1)'
        } else {
            return this._notEquals(params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }

        // Alternative implementation that avoid evaluate multiple times the arguments
        // return 'not exists(select ' + this._appendSqlParenthesis(valueSource, params) + ' intersect select ' + this._appendValueParenthesis(value, params, columnTypeName, typeAdapter) + ')'
    }
    override _valueWhenNull(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        let result = 'isnull('
        if (isValueSource(valueSource) && __getValueSourcePrivate(valueSource).__uuidString) {
            result += 'convert(nvarchar, ' + this._appendSql(valueSource, params, false) + ')'
        } else {
            result += this._appendSql(valueSource, params, false)
        }
        result += ', '
        if (isValueSource(value) && __getValueSourcePrivate(value).__uuidString) {
            result += 'convert(nvarchar, ' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
        } else {
            result += this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false)
        }
        result += ')'
        return result
    }
    override _escapeLikeWildcard(params: any[], value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (typeof value === 'string') {
            value = value.replace(/\[/g, '[[]')
            value = value.replace(/%/g, '[%]')
            value = value.replace(/_/g, '[]')
            return this._appendValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast)
        } else {
            return "replace(replace(replace(" + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast) + ", '[', '[[]'), '%', '[%]'), '_', '[]')"
        }
    }
    override _startsWith(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' like (' + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " + '%')"
    }
    override _notStartsWith(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' not like (' +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " + '%')"
    }
    override _endsWith(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + " like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ')'
    }
    override _notEndsWith(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + " not like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ')'
    }
    override _startsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._isUuid(valueSource)) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' like (' +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' like (' +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " + '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + ' like (' +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ') like lower(' +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        }
    }
    override _notStartsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._isUuid(valueSource)) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not like (' +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not like (' +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " + '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not like (' +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ') not like lower(' +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        }
    }
    override _endsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._isUuid(valueSource)) {
            return this._appendSqlParenthesis(valueSource, params, false) + " like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ')'
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + " like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ") like lower('%' + " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ')'
        }
    }
    override _notEndsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._isUuid(valueSource)) {
            return this._appendSqlParenthesis(valueSource, params, false) + " not like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ')'
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " not like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + " not like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ") not like lower('%' + " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ')'
        }
    }
    override _contains(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + " like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " + '%')"
    }
    override _notContains(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + " not like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " + '%')"
    }
    override _containsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._isUuid(valueSource)) {
            return this._appendSqlParenthesis(valueSource, params, false) + " like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " + '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + " like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ") like lower('%' + " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        }
    }
    override _notContainsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._isUuid(valueSource)) {
            return this._appendSqlParenthesis(valueSource, params, false) + " not like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        }
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " not like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " + '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + " not like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ") not like lower('%' + " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        }
    }
    override _trim(params: any[], valueSource: ToSql): string {
        return 'trim(' + this._appendSqlMaybeUuid(valueSource, params) + ')'
    }
    override _trimLeft(params: any[], valueSource: ToSql): string {
        return 'ltrim(' + this._appendSqlMaybeUuid(valueSource, params) + ')'
    }
    override _trimRight(params: any[], valueSource: ToSql): string {
        return 'rtrim(' + this._appendSqlMaybeUuid(valueSource, params) + ')'
    }
    override _currentDate(): string {
        if (this._connectionConfiguration.compatibilityVersion >= 17_000_000) {
            return 'current_date'
        }
        return 'cast(getdate() as date)'
    }
    override _currentTime(): string {
        return 'convert(time, current_timestamp)'
    }
    override _random(): string {
        return 'rand()'
    }
    override _divide(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'cast(' + this._appendSql(valueSource, params, false) + ' as float) / cast(' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false) + ' as float)'
    }
    override _asDouble(params: any[], valueSource: ToSql): string {
        return 'cast(' + this._appendSql(valueSource, params, false) + 'as float)'
    }
    override _concat(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        let result = ''
        if (this._isUuid(valueSource)) {
            result += 'convert(nvarchar, ' + this._appendSql(valueSource, params, false) + ')'
        } else {
            result += this._appendSqlParenthesisExcluding(valueSource, params, '_concat', false)
        }
        result += ' + '
        if (this._isUuid(value)) {
            result += 'convert(nvarchar, ' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
        } else {
            result += this._appendValueParenthesisExcluding(value, params, columnType, columnTypeName, typeAdapter, '_concat', false)
        }
        return result
    }
    override _length(params: any[], valueSource: ToSql): string {
        return 'len(' + this._appendSql(valueSource, params, false) + ')'
    }
    override _ln(params: any[], valueSource: ToSql): string {
        return 'log(' + this._appendSql(valueSource, params, false) + ')'
    }
    override _log10(params: any[], valueSource: ToSql): string {
        return 'log10(' + this._appendSql(valueSource, params, false) + ')'
    }
    override _cbrt(params: any[], valueSource: ToSql): string {
        return 'power(' + this._appendSql(valueSource, params, false) + ', 3)'
    }
    override _atan2(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'atn2(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false) + ')'
    }
    override _minimumBetweenTwoValues(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const argumentType = this._getMathArgumentType(columnType, columnTypeName, value)
        const argumentTypeName = this._getMathArgumentTypeName(columnType, columnTypeName, value)
        if (this._connectionConfiguration.compatibilityVersion >= 16_000_000) {
            return 'least(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, argumentType, argumentTypeName, typeAdapter, false) + ')'
        }
        return 'iif(' + this._appendSql(valueSource, params, false) + ' < ' + this._appendValue(value, params, argumentType, argumentTypeName, typeAdapter, false) + ', ' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, argumentType, argumentTypeName, typeAdapter, false) + ')'
    }
    override _maximumBetweenTwoValues(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const argumentType = this._getMathArgumentType(columnType, columnTypeName, value)
        const argumentTypeName = this._getMathArgumentTypeName(columnType, columnTypeName, value)
        if (this._connectionConfiguration.compatibilityVersion >= 16_000_000) {
            return 'greatest(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, argumentType, argumentTypeName, typeAdapter, false) + ')'
        }
        return 'iif(' + this._appendSql(valueSource, params, false) + ' > ' + this._appendValue(value, params, argumentType, argumentTypeName, typeAdapter, false) + ', ' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, argumentType, argumentTypeName, typeAdapter, false) + ')'
    }
    override _getDate(params: any[], valueSource: ToSql): string {
        return 'datepart(day, ' + this._appendSql(valueSource, params, false) + ')'
    }
    override _getTime(params: any[], valueSource: ToSql): string {
        return "datediff_big(millisecond, '1970-01-01 00:00:00', " + this._appendSql(valueSource, params, false) + ")"
    }
    override _getFullYear(params: any[], valueSource: ToSql): string {
        return 'datepart(year, ' + this._appendSql(valueSource, params, false) + ')'
    }
    override _getMonth(params: any[], valueSource: ToSql): string {
        return 'datepart(month, ' + this._appendSql(valueSource, params, false) + ') - 1'
    }
    override _getDay(params: any[], valueSource: ToSql): string {
        return 'datepart(weekday, ' + this._appendSql(valueSource, params, false) + ') - 1'
    }
    override _getHours(params: any[], valueSource: ToSql): string {
        return 'datepart(hour, ' + this._appendSql(valueSource, params, false) + ')'
    }
    override _getMinutes(params: any[], valueSource: ToSql): string {
        return 'datepart(minute, ' + this._appendSql(valueSource, params, false) + ')'
    }
    override _getSeconds(params: any[], valueSource: ToSql): string {
        return 'datepart(second, ' + this._appendSql(valueSource, params, false) + ')'
    }
    override _getMilliseconds(params: any[], valueSource: ToSql): string {
        return 'datepart(millisecond, ' + this._appendSql(valueSource, params, false) + ')'
    }
    override _buildCallProcedure(params: any[], functionName: string, functionParams: AnyValueSource[]): string {
        let result = 'exec ' + this._escape(functionName, false)
        for (let i = 0, length = functionParams.length; i < length; i++) {
            result += ' ' + this._appendSql(functionParams[i]!, params, false)
        }

        return result
    }
    override _stringConcat(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'string_agg(' + this._appendSqlMaybeUuid(value, params) + ", ',')"
        } else if (separator === '') {
            return 'string_agg(' + this._appendSqlMaybeUuid(value, params) + ", '')"
        } else {
            return 'string_agg(' + this._appendSqlMaybeUuid(value, params) + ', ' + this._appendValue(separator, params, 'string', 'string', undefined, false) + ')'
        }
    }
    override _stringConcatDistinct(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'string_agg(distinct ' + this._appendSqlMaybeUuid(value, params) + ", ',')"
        } else if (separator === '') {
            return 'string_agg(distinct ' + this._appendSqlMaybeUuid(value, params) + ", '')"
        } else {
            return 'string_agg(distinct ' + this._appendSqlMaybeUuid(value, params) + ', ' + this._appendValue(separator, params, 'string', 'string', undefined, false) + ')'
        }
    }
    override _in(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (Array.isArray(value) && value.length <= 0) {
            return this._falseValueForCondition
        }
        return super._in(params, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _notIn(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (Array.isArray(value) && value.length <= 0) {
            return this._trueValueForCondition
        }
        return super._notIn(params, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _substrToEnd(params: any[], valueSource: ToSql, value: any, _columnType: ValueType, _columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._connectionConfiguration.compatibilityVersion >= 17_000_000) {
            if (typeof value === 'number') {
                return 'substring(' + this._appendSqlMaybeUuid(valueSource, params) + ', ' + this._appendValue(value + 1, params, 'int', 'int', typeAdapter, false) + ')'
            } else {
                return 'substring(' + this._appendSqlMaybeUuid(valueSource, params) + ', ' + this._appendValueParenthesis(value, params, 'int', 'int', typeAdapter, false) + ' + 1)'
            }
        }
        if (typeof value === 'number') {
            return 'substring(' + this._appendSqlMaybeUuid(valueSource, params) + ', ' + this._appendValue(value + 1, params, 'int', 'int', typeAdapter, false) + ', len(' + this._appendSql(valueSource, params, false) +  ') - ' + this._appendValue(value, params, 'int', 'int', typeAdapter, false) +  ')'
        } else {
            return 'substring(' + this._appendSqlMaybeUuid(valueSource, params) + ', ' + this._appendValueParenthesis(value, params, 'int', 'int', typeAdapter, false) + ' + 1, len(' + this._appendSql(valueSource, params, false) +  ') - ' + this._appendValue(value, params, 'int', 'int', typeAdapter, false) +  ')'
        }
    }
    override _substringToEnd(params: any[], valueSource: ToSql, value: any, _columnType: ValueType, _columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._connectionConfiguration.compatibilityVersion >= 17_000_000) {
            if (typeof value === 'number') {
                return 'substring(' + this._appendSqlMaybeUuid(valueSource, params) + ', ' + this._appendValue(value + 1, params, 'int', 'int', typeAdapter, false) + ')'
            } else {
                return 'substring(' + this._appendSqlMaybeUuid(valueSource, params) + ', ' + this._appendValueParenthesis(value, params, 'int', 'int', typeAdapter, false) + ' + 1)'
            }
        }
        if (typeof value === 'number') {
            return 'substring(' + this._appendSqlMaybeUuid(valueSource, params) + ', ' + this._appendValue(value + 1, params, 'int', 'int', typeAdapter, false) + ', len(' + this._appendSql(valueSource, params, false) +  ') - ' + this._appendValue(value, params, 'int', 'int', typeAdapter, false) +  ')'
        } else {
            return 'substring(' + this._appendSqlMaybeUuid(valueSource, params) + ', ' + this._appendValueParenthesis(value, params, 'int', 'int', typeAdapter, false) + ' + 1, len(' + this._appendSql(valueSource, params, false) +  ') - ' + this._appendValue(value, params, 'int', 'int', typeAdapter, false) +  ')'
        }
    }
    override _substr(params: any[], valueSource: ToSql, value: any, value2: any, _columnType: ValueType, _columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'number') {
            return 'substring(' + this._appendSqlMaybeUuid(valueSource, params) + ', ' + this._appendValue(value + 1, params, 'int', 'int', typeAdapter, false) + ', ' + this._appendValue(value2, params, 'int', 'int', typeAdapter, false) + ')'
        } else {
            return 'substring(' + this._appendSqlMaybeUuid(valueSource, params) + ', ' + this._appendValueParenthesis(value, params, 'int', 'int', typeAdapter, false) + ' + 1, ' + this._appendValue(value2, params, 'int', 'int', typeAdapter, false) + ')'
        }
    }
    override _substring(params: any[], valueSource: ToSql, value: any, value2: any, _columnType: ValueType, _columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'number' && typeof value2 === 'number') {
            const count = value2 - value
            return 'substring(' + this._appendSqlMaybeUuid(valueSource, params) + ', ' + this._appendValue(value + 1, params, 'int', 'int', typeAdapter, false) + ', ' + this._appendValue(count, params, 'int', 'int', typeAdapter, false) + ')'
        }
        if (typeof value === 'number') {
            return 'substring(' + this._appendSqlMaybeUuid(valueSource, params) + ', ' + this._appendValue(value + 1, params, 'int', 'int', typeAdapter, false) + ', ' + this._appendValue(value2, params, 'int', 'int', typeAdapter, false) + ' - ' + this._appendValue(value, params, 'int', 'int', typeAdapter, false) + ')'
        } else {
            return 'substring(' + this._appendSqlMaybeUuid(valueSource, params) + ', ' + this._appendValueParenthesis(value, params, 'int', 'int', typeAdapter, false) + ' + 1, ' + this._appendValue(value2, params, 'int', 'int', typeAdapter, false) + ' - ' + this._appendValue(value, params, 'int', 'int', typeAdapter, false) + ')'
        }
    }
    _useForJsonInAggreagteArrayWhenPossible = true
    override _buildSelectAsAggregatedArray(query: SelectData, _params: any[]): string {
        if (this._useForJsonInAggreagteArrayWhenPossible && query.__asInlineAggregatedArrayValue && !query.__oneColumn && query.__type === 'plain') {
            return ' for json path'
        }
        return ''
    }
    override _needAgggregateArrayColumnsTransformation(query: SelectData, _params: any[]): boolean {
        if (!query.__asInlineAggregatedArrayValue) {
            return false
        }
        if (!this._useForJsonInAggreagteArrayWhenPossible) {
            return true
        }
        if (query.__oneColumn) {
            return true
        }
        return false
    }
    override _needAgggregateArrayWrapper(query: SelectData, params: any[]): boolean {
        if (this._useForJsonInAggreagteArrayWhenPossible && query.__asInlineAggregatedArrayValue && !query.__oneColumn && query.__type === 'plain') {
            return false
        }
        return super._needAgggregateArrayWrapper(query, params)
    }
    override _appendAggragateArrayWrapperBegin(query: SelectData, params: any[], aggregateId: number): string {
        if (this._useForJsonInAggreagteArrayWhenPossible && query.__type === 'compound' && !query.__oneColumn) {
            const columns = query.__columns
            let requireComma = false
            let result = ''
            for (const property in columns) {
                if (requireComma) {
                    result += ', '
                }
                result += 'a_' + aggregateId + '_.' + this._escape(property, true)
                if (property) {
                    result += ' as ' + this._appendColumnAlias(property, params)
                }
                requireComma = true
            }
            return 'select ' + result + ' from ('
        }
        return super._appendAggragateArrayWrapperBegin(query, params, aggregateId)
    }
    override _appendAggragateArrayWrapperEnd(query: SelectData, params: any[], aggregateId: number): string {
        if (this._useForJsonInAggreagteArrayWhenPossible && query.__type === 'compound' && !query.__oneColumn) {
            let result =  ')'
            if (this._supportTableAliasWithAs) {
                result += ' as '
            } else {
                result += ' '
            }
            result += 'a_' + aggregateId + '_ for json path'
            return result
        }
        return super._appendAggragateArrayWrapperEnd(query, params, aggregateId)
    }
    _useJsonAggregatesWhenPossible(): boolean {
        return this._connectionConfiguration.compatibilityVersion >= 17_000_000
    }
    override _appendAggragateArrayColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayDistinct: boolean, params: any[], _query: SelectData | undefined): string {
        if (this._useJsonAggregatesWhenPossible() && !aggregatedArrayDistinct) {
            if (isValueSource(aggregatedArrayColumns)) {
                return 'json_arrayagg(' + this._appendSql(aggregatedArrayColumns, params, false) + ' null on null)'
            }
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')
            let jsonObject = ''
            for (const prop in columns) {
                if (jsonObject) {
                    jsonObject += ', '
                }
                jsonObject += "'" + prop + "':" + this._appendSql(columns[prop]!, params, false)
            }
            return 'json_arrayagg(json_object(' + jsonObject + '))'
        }
        const distict = aggregatedArrayDistinct ? 'distinct ' : ''
        if (isValueSource(aggregatedArrayColumns)) {
            return "concat('[', string_agg(" + distict + this._appendJsonValueForAggregate(aggregatedArrayColumns, params) + ", ','), ']')"
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += `, ', "`+ prop + `": ', ` + this._appendJsonValueForAggregate(columns[prop]!, params)
                } else {
                    result += `'"`+ prop + `": ', ` + this._appendJsonValueForAggregate(columns[prop]!, params)
                }
            }

            return `concat('[', string_agg(` + distict + `concat('{', ` + result + `, '}'), ','), ']')`
        }
    }
    _appendJsonValueForAggregate(valueSource: AnyValueSource, params: any[]): string {
        const valueSourcePrivate = __getValueSourcePrivate(valueSource)
        const type = valueSourcePrivate.__valueType

        let result: string

        switch(type) {
        case 'boolean':
        case 'int':
        case 'double':
            result = 'convert(nvarchar, ' + this._appendSql(valueSource, params, false) + ')'
            break
        case 'bigint':
        case 'customInt':
        case 'customDouble':
        case 'uuid':
        case 'customUuid':
            result = `'"' + convert(nvarchar, ` + this._appendSql(valueSource, params, false) + `) + '"'`
            break
        case 'string':
        case 'aggregatedArray':
            result = 'convert(nvarchar, ' + this._appendSql(valueSource, params, false) + ')'
            result = 'string_escape(' + result + ", 'json')"
            result = `'"' + ` + result + ` + '"'`
            break
        case 'localDate':
        case 'localTime':
        case 'localDateTime':
        case 'customLocalDate':
        case 'customLocalTime':
        case 'customLocalDateTime':
            result = 'convert(nvarchar, ' + this._appendSql(valueSource, params, false) + ', 127)'
            result = `'"' + ` + result + ` + '"'`
            break
        default:
            result = 'convert(nvarchar, ' + this._appendSql(valueSource, params, false) + ')'
            result = 'string_escape(' + result + ", 'json')"
            result = `'"' + ` + result + ` + '"'`
        }

        if (valueSourcePrivate.__optionalType !== 'required') {
            result = `isnull(` + result + `, 'null')`
        }

        return result
    }
    override _appendAggragateArrayWrappedColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, params: any[], aggregateId: number): string {
        if (this._useJsonAggregatesWhenPossible()) {
            if (isValueSource(aggregatedArrayColumns)) {
                return 'json_arrayagg(a_' + aggregateId + '_.' + this._escape('result', true) + ' null on null)'
            }
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')
            let jsonObject = ''
            for (const prop in columns) {
                if (jsonObject) {
                    jsonObject += ', '
                }
                jsonObject += "'" + prop + "':a_" + aggregateId + '_.' + this._escape(prop, true)
            }
            return 'json_arrayagg(json_object(' + jsonObject + '))'
        }
        if (isValueSource(aggregatedArrayColumns)) {
            return "concat('[', string_agg(" + this._appendJsonValueForWrappedAggregate('result', aggregatedArrayColumns, params, aggregateId) + ", ','), ']')"
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += `, ', "`+ prop + `": ', ` + this._appendJsonValueForWrappedAggregate(prop, columns[prop]!, params, aggregateId)
                } else {
                    result += `'"`+ prop + `": ', ` + this._appendJsonValueForWrappedAggregate(prop, columns[prop]!, params, aggregateId)
                }
            }

            return `concat('[', string_agg(concat('{', ` + result + `, '}'), ','), ']')`
        }
    }
    _appendJsonValueForWrappedAggregate(prop: string, valueSource: AnyValueSource, _params: any[], aggregateId: number): string {
        const valueSourcePrivate = __getValueSourcePrivate(valueSource)
        const type = valueSourcePrivate.__valueType

        let result: string

        switch(type) {
        case 'boolean':
        case 'int':
        case 'double':
            result = 'convert(nvarchar, a_' + aggregateId + '_.' + this._escape(prop, true) + ')'
            break
        case 'bigint':
        case 'customInt':
        case 'customDouble':
        case 'uuid':
        case 'customUuid':
            result = `'"' + convert(nvarchar, a_` + aggregateId + `_.` + this._escape(prop, true) + `) + '"'`
            break
        case 'string':
        case 'aggregatedArray':
            result = 'convert(nvarchar, a_' + aggregateId + '_.' + this._escape(prop, true) + ')'
            result = 'string_escape(' + result + ", 'json')"
            result = `'"' + ` + result + ` + '"'`
            break
        case 'localDate':
        case 'localTime':
        case 'localDateTime':
        case 'customLocalDate':
        case 'customLocalTime':
        case 'customLocalDateTime':
            result = 'convert(nvarchar, a_' + aggregateId + '_.' + this._escape(prop, true) + ', 127)'
            result = `'"' + ` + result + ` + '"'`
            break
        default:
            result = 'convert(nvarchar, a_' + aggregateId + '_.' + this._escape(prop, true) + ')'
            result = 'string_escape(' + result + ", 'json')"
            result = `'"' + ` + result + ` + '"'`
        }

        if (valueSourcePrivate.__optionalType !== 'required') {
            result = `isnull(` + result + `, 'null')`
        }

        return result
    }
    override _fragment(params: any[], sql: TemplateStringsArray, sqlParams: AnyValueSource[]): string {
        if (sqlParams.length <= 0) {
            return sql[0]!
        }
        let result = ''
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            result += sql[i]
            const value = sqlParams[i]!
            if (isValueSource(value) && __getValueSourcePrivate(value).__uuidString) {
                result += 'convert(nvarchar, ' + this._appendConditionSql(sqlParams[i]!, params, false) + ')'
            } else {
                result += this._appendConditionSql(sqlParams[i]!, params, false)
            }
        }
        result += sql[sql.length - 1]
        return result
    }
    override _rawFragment(params: any[], sql: TemplateStringsArray, sqlParams: Array<AnyValueSource | IExecutableSelectQuery<any, any, any>>): string {
        if (sqlParams.length <= 0) {
            return sql[0]!
        }
        let result = ''
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            result += sql[i]
            const value = sqlParams[i]!
            if (isValueSource(value) && __getValueSourcePrivate(value).__uuidString) {
                result += 'convert(nvarchar, ' + this._appendSql(sqlParams[i]!, params, false) + ')'
            } else {
                result += this._appendSql(sqlParams[i]!, params, false)
            }
        }
        result += sql[sql.length - 1]
        return result
    }
}

const nativeTypedValueType: {[type in NativeValueType]: boolean | undefined} = {
    boolean: true,
    int: true,
    bigint: true,
    double: true,
    string: true,
    uuid: true,
    localDate: true,
    localTime: true,
    localDateTime: true,
    customInt: true,
    customDouble: true,
    customUuid: true,
    customLocalDate: true,
    customLocalTime: true,
    customLocalDateTime: true
}

// Source: https://docs.microsoft.com/en-us/sql/t-sql/language-elements/reserved-keywords-transact-sql?view=sql-server-ver15 (version: SqlServer 2019, all possible keywords combined)
const reservedWords: { [word: string]: boolean | undefined } = {
    ABSOLUTE: true,
    ACTION: true,
    ADA: true,
    ADD: true,
    ADMIN: true,
    AFTER: true,
    AGGREGATE: true,
    ALIAS: true,
    ALL: true,
    ALLOCATE: true,
    ALTER: true,
    AND: true,
    ANY: true,
    ARE: true,
    ARRAY: true,
    AS: true,
    ASC: true,
    ASENSITIVE: true,
    ASSERTION: true,
    ASYMMETRIC: true,
    AT: true,
    ATOMIC: true,
    AUTHORIZATION: true,
    AVG: true,
    BACKUP: true,
    BEFORE: true,
    BEGIN: true,
    BETWEEN: true,
    BINARY: true,
    BIT: true,
    BIT_LENGTH: true,
    BLOB: true,
    BOOLEAN: true,
    BOTH: true,
    BREADTH: true,
    BREAK: true,
    BROWSE: true,
    BULK: true,
    BY: true,
    CALL: true,
    CALLED: true,
    CARDINALITY: true,
    CASCADE: true,
    CASCADED: true,
    CASE: true,
    CAST: true,
    CATALOG: true,
    CHAR: true,
    CHAR_LENGTH: true,
    CHARACTER: true,
    CHARACTER_LENGTH: true,
    CHECK: true,
    CHECKPOINT: true,
    CLASS: true,
    CLOB: true,
    CLOSE: true,
    CLUSTERED: true,
    COALESCE: true,
    COLLATE: true,
    COLLATION: true,
    COLLECT: true,
    COLUMN: true,
    COMMIT: true,
    COMPLETION: true,
    COMPUTE: true,
    CONDITION: true,
    CONNECT: true,
    CONNECTION: true,
    CONSTRAINT: true,
    CONSTRAINTS: true,
    CONSTRUCTOR: true,
    CONTAINS: true,
    CONTAINSTABLE: true,
    CONTINUE: true,
    CONVERT: true,
    CORR: true,
    CORRESPONDING: true,
    COUNT: true,
    COVAR_POP: true,
    COVAR_SAMP: true,
    CREATE: true,
    CROSS: true,
    CUBE: true,
    CUME_DIST: true,
    CURRENT: true,
    CURRENT_CATALOG: true,
    CURRENT_DATE: true,
    CURRENT_DEFAULT_TRANSFORM_GROUP: true,
    CURRENT_PATH: true,
    CURRENT_ROLE: true,
    CURRENT_SCHEMA: true,
    CURRENT_TIME: true,
    CURRENT_TIMESTAMP: true,
    CURRENT_TRANSFORM_GROUP_FOR_TYPE: true,
    CURRENT_USER: true,
    CURSOR: true,
    CYCLE: true,
    DATA: true,
    DATABASE: true,
    DATE: true,
    DAY: true,
    DBCC: true,
    DEALLOCATE: true,
    DEC: true,
    DECIMAL: true,
    DECLARE: true,
    DEFAULT: true,
    DEFERRABLE: true,
    DEFERRED: true,
    DELETE: true,
    DENY: true,
    DEPTH: true,
    DEREF: true,
    DESC: true,
    DESCRIBE: true,
    DESCRIPTOR: true,
    DESTROY: true,
    DESTRUCTOR: true,
    DETERMINISTIC: true,
    DIAGNOSTICS: true,
    DICTIONARY: true,
    DISCONNECT: true,
    DISK: true,
    DISTINCT: true,
    DISTRIBUTED: true,
    DOMAIN: true,
    DOUBLE: true,
    DROP: true,
    DUMP: true,
    DYNAMIC: true,
    EACH: true,
    ELEMENT: true,
    ELSE: true,
    'END-EXEC': true,
    END: true,
    EQUALS: true,
    ERRLVL: true,
    ESCAPE: true,
    EVERY: true,
    EXCEPT: true,
    EXCEPTION: true,
    EXEC: true,
    EXECUTE: true,
    EXISTS: true,
    EXIT: true,
    EXTERNAL: true,
    EXTRACT: true,
    FALSE: true,
    FETCH: true,
    FILE: true,
    FILLFACTOR: true,
    FILTER: true,
    FIRST: true,
    FLOAT: true,
    FOR: true,
    FOREIGN: true,
    FORTRAN: true,
    FOUND: true,
    FREE: true,
    FREETEXT: true,
    FREETEXTTABLE: true,
    FROM: true,
    FULL: true,
    FULLTEXTTABLE: true,
    FUNCTION: true,
    FUSION: true,
    GENERAL: true,
    GET: true,
    GLOBAL: true,
    GO: true,
    GOTO: true,
    GRANT: true,
    GROUP: true,
    GROUPING: true,
    HAVING: true,
    HOLD: true,
    HOLDLOCK: true,
    HOST: true,
    HOUR: true,
    IDENTITY: true,
    IDENTITY_INSERT: true,
    IDENTITYCOL: true,
    IF: true,
    IGNORE: true,
    IMMEDIATE: true,
    IN: true,
    INCLUDE: true,
    INDEX: true,
    INDICATOR: true,
    INITIALIZE: true,
    INITIALLY: true,
    INNER: true,
    INOUT: true,
    INPUT: true,
    INSENSITIVE: true,
    INSERT: true,
    INT: true,
    INTEGER: true,
    INTERSECT: true,
    INTERSECTION: true,
    INTERVAL: true,
    INTO: true,
    IS: true,
    ISOLATION: true,
    ITERATE: true,
    JOIN: true,
    KEY: true,
    KILL: true,
    LABEL: true,
    LANGUAGE: true,
    LARGE: true,
    LAST: true,
    LATERAL: true,
    LEADING: true,
    LEFT: true,
    LESS: true,
    LEVEL: true,
    LIKE: true,
    LIKE_REGEX: true,
    LIMIT: true,
    LINENO: true,
    LN: true,
    LOAD: true,
    LOCAL: true,
    LOCALTIME: true,
    LOCALTIMESTAMP: true,
    LOCATOR: true,
    LOWER: true,
    MAP: true,
    MATCH: true,
    MAX: true,
    MEMBER: true,
    MERGE: true,
    METHOD: true,
    MIN: true,
    MINUTE: true,
    MOD: true,
    MODIFIES: true,
    MODIFY: true,
    MODULE: true,
    MONTH: true,
    MULTISET: true,
    NAMES: true,
    NATIONAL: true,
    NATURAL: true,
    NCHAR: true,
    NCLOB: true,
    NEW: true,
    NEXT: true,
    NO: true,
    NOCHECK: true,
    NONCLUSTERED: true,
    NONE: true,
    NORMALIZE: true,
    NOT: true,
    NULL: true,
    NULLIF: true,
    NUMERIC: true,
    OBJECT: true,
    OCCURRENCES_REGEX: true,
    OCTET_LENGTH: true,
    OF: true,
    OFF: true,
    OFFSETS: true,
    OLD: true,
    ON: true,
    ONLY: true,
    OPEN: true,
    OPENDATASOURCE: true,
    OPENQUERY: true,
    OPENROWSET: true,
    OPENXML: true,
    OPERATION: true,
    OPTION: true,
    OR: true,
    ORDER: true,
    ORDINALITY: true,
    OUT: true,
    OUTER: true,
    OUTPUT: true,
    OVER: true,
    OVERLAPS: true,
    OVERLAY: true,
    PAD: true,
    PARAMETER: true,
    PARAMETERS: true,
    PARTIAL: true,
    PARTITION: true,
    PASCAL: true,
    PATH: true,
    PERCENT: true,
    PERCENT_RANK: true,
    PERCENTILE_CONT: true,
    PERCENTILE_DISC: true,
    PIVOT: true,
    PLAN: true,
    POSITION: true,
    POSITION_REGEX: true,
    POSTFIX: true,
    PRECISION: true,
    PREFIX: true,
    PREORDER: true,
    PREPARE: true,
    PRESERVE: true,
    PRIMARY: true,
    PRINT: true,
    PRIOR: true,
    PRIVILEGES: true,
    PROC: true,
    PROCEDURE: true,
    PUBLIC: true,
    RAISERROR: true,
    RANGE: true,
    READ: true,
    READS: true,
    READTEXT: true,
    REAL: true,
    RECONFIGURE: true,
    RECURSIVE: true,
    REF: true,
    REFERENCES: true,
    REFERENCING: true,
    REGR_AVGX: true,
    REGR_AVGY: true,
    REGR_COUNT: true,
    REGR_INTERCEPT: true,
    REGR_R2: true,
    REGR_SLOPE: true,
    REGR_SXX: true,
    REGR_SXY: true,
    REGR_SYY: true,
    RELATIVE: true,
    RELEASE: true,
    REPLICATION: true,
    RESTORE: true,
    RESTRICT: true,
    RESULT: true,
    RETURN: true,
    RETURNS: true,
    REVERT: true,
    REVOKE: true,
    RIGHT: true,
    ROLE: true,
    ROLLBACK: true,
    ROLLUP: true,
    ROUTINE: true,
    ROW: true,
    ROWCOUNT: true,
    ROWGUIDCOL: true,
    ROWS: true,
    RULE: true,
    SAVE: true,
    SAVEPOINT: true,
    SCHEMA: true,
    SCOPE: true,
    SCROLL: true,
    SEARCH: true,
    SECOND: true,
    SECTION: true,
    SECURITYAUDIT: true,
    SELECT: true,
    SEMANTICKEYPHRASETABLE: true,
    SEMANTICSIMILARITYDETAILSTABLE: true,
    SEMANTICSIMILARITYTABLE: true,
    SENSITIVE: true,
    SEQUENCE: true,
    SESSION: true,
    SESSION_USER: true,
    SET: true,
    SETS: true,
    SETUSER: true,
    SHUTDOWN: true,
    SIMILAR: true,
    SIZE: true,
    SMALLINT: true,
    SOME: true,
    SPACE: true,
    SPECIFIC: true,
    SPECIFICTYPE: true,
    SQL: true,
    SQLCA: true,
    SQLCODE: true,
    SQLERROR: true,
    SQLEXCEPTION: true,
    SQLSTATE: true,
    SQLWARNING: true,
    START: true,
    STATE: true,
    STATEMENT: true,
    STATIC: true,
    STATISTICS: true,
    STDDEV_POP: true,
    STDDEV_SAMP: true,
    STRUCTURE: true,
    SUBMULTISET: true,
    SUBSTRING: true,
    SUBSTRING_REGEX: true,
    SUM: true,
    SYMMETRIC: true,
    SYSTEM: true,
    SYSTEM_USER: true,
    TABLE: true,
    TABLESAMPLE: true,
    TEMPORARY: true,
    TERMINATE: true,
    TEXTSIZE: true,
    THAN: true,
    THEN: true,
    TIME: true,
    TIMESTAMP: true,
    TIMEZONE_HOUR: true,
    TIMEZONE_MINUTE: true,
    TO: true,
    TOP: true,
    TRAILING: true,
    TRAN: true,
    TRANSACTION: true,
    TRANSLATE: true,
    TRANSLATE_REGEX: true,
    TRANSLATION: true,
    TREAT: true,
    TRIGGER: true,
    TRIM: true,
    TRUE: true,
    TRUNCATE: true,
    TRY_CONVERT: true,
    TSEQUAL: true,
    UESCAPE: true,
    UNDER: true,
    UNION: true,
    UNIQUE: true,
    UNKNOWN: true,
    UNNEST: true,
    UNPIVOT: true,
    UPDATE: true,
    UPDATETEXT: true,
    UPPER: true,
    USAGE: true,
    USE: true,
    USER: true,
    USING: true,
    VALUE: true,
    VALUES: true,
    VAR_POP: true,
    VAR_SAMP: true,
    VARCHAR: true,
    VARIABLE: true,
    VARYING: true,
    VIEW: true,
    WAITFOR: true,
    WHEN: true,
    WHENEVER: true,
    WHERE: true,
    WHILE: true,
    WIDTH_BUCKET: true,
    WINDOW: true,
    WITH: true,
    'WITHIN GROUP': true,
    WITHIN: true,
    WITHOUT: true,
    WORK: true,
    WRITE: true,
    WRITETEXT: true,
    XMLAGG: true,
    XMLATTRIBUTES: true,
    XMLBINARY: true,
    XMLCAST: true,
    XMLCOMMENT: true,
    XMLCONCAT: true,
    XMLDOCUMENT: true,
    XMLELEMENT: true,
    XMLEXISTS: true,
    XMLFOREST: true,
    XMLITERATE: true,
    XMLNAMESPACES: true,
    XMLPARSE: true,
    XMLPI: true,
    XMLQUERY: true,
    XMLSERIALIZE: true,
    XMLTABLE: true,
    XMLTEXT: true,
    XMLVALIDATE: true,
    YEAR: true,
    ZONE: true,
}
