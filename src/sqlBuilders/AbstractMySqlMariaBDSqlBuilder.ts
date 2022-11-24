import { ToSql, SelectData, InsertData, UpdateData, DeleteData, getQueryColumn, FlatQueryColumns, flattenQueryColumns } from "./SqlBuilder"
import type { TypeAdapter } from "../TypeAdapter"
import { AnyValueSource, isValueSource, __AggregatedArrayColumns } from "../expressions/values"
import { AbstractSqlBuilder } from "./AbstractSqlBuilder"
import { __getValueSourcePrivate } from "../expressions/values"
import { Column, isColumn, __getColumnOfObject, __getColumnPrivate } from "../utils/Column"
import { ITableOrView } from "../utils/ITableOrView"
import { SqlOperation1ValueSource, SqlOperation1ValueSourceIfValueOrIgnore } from "../internal/ValueSourceImpl"

export class AbstractMySqlMariaDBSqlBuilder extends AbstractSqlBuilder {
    constructor() {
        super()
        this._operationsThatNeedParenthesis._concat = false
        this._operationsThatNeedParenthesis._is = true
        this._operationsThatNeedParenthesis._asDouble = true
        this._operationsThatNeedParenthesis._getDate = true
        this._operationsThatNeedParenthesis._getMonth = true
    }
    _insertSupportWith = false
    _forceAsIdentifier(identifier: string): string {
        return '`' + identifier + '`'
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
            return ' order by ' + orderByColumns
        }

        const columns = query.__columns
        let orderByColumns = ''

        const customization = query.__customization
        if (customization && customization.beforeOrderByItems) {
            orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, params)
        }

        for (const property in orderBy) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            const column = getQueryColumn(columns, property)
            if (!column) {
                throw new Error('Column ' + property + ' included in the order by not found in the select clause')
            }
            const order = orderBy[property]
            if (!order) {
                orderByColumns += this._appendColumnAlias(property, params)
            } else switch (order) {
                case 'asc':
                case 'asc nulls first':
                    orderByColumns += this._appendColumnAlias(property, params) + ' asc'
                    break
                case 'desc':
                case 'desc nulls last':
                    orderByColumns += this._appendColumnAlias(property, params) + ' desc'
                    break
                case 'asc nulls last':
                    orderByColumns += this._appendColumnAlias(property, params) + ' is null, ' + this._appendColumnAlias(property, params) + ' asc'
                    break
                case 'desc nulls first':
                    orderByColumns += this._appendColumnAlias(property, params) + ' is not null, ' + this._appendColumnAlias(property, params) + ' desc'
                    break
                case 'insensitive':
                    orderByColumns += this.__appendColumnAliasInsensitive(property, column, params)
                    break
                case 'asc insensitive':
                case 'asc nulls first insensitive':
                    orderByColumns += this.__appendColumnAliasInsensitive(property, column, params) + ' asc'
                    break
                case 'desc insensitive':
                case 'desc nulls last insensitive':
                    orderByColumns += this.__appendColumnAliasInsensitive(property, column, params) + ' desc'
                    break
                case 'asc nulls last insensitive':
                    orderByColumns += this._appendColumnAlias(property, params) + ' is null, ' + this.__appendColumnAliasInsensitive(property, column, params) + ' asc'
                    break
                case 'desc nulls first insensitive':
                    orderByColumns += this._appendColumnAlias(property, params) + ' is not null, ' + this.__appendColumnAliasInsensitive(property, column, params) + ' desc'
                    break
                default:
                    throw new Error('Invalid order by: ' + property + ' ' + order)
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
    _buildAggregateArrayOrderBy(query: SelectData, params: any[], addSpace: boolean): string {
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
            return ' order by ' + orderByColumns
        }

        const columns = query.__columns
        let orderByColumns = ''

        const customization = query.__customization
        if (customization && customization.beforeOrderByItems) {
            orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, params)
        }

        for (const property in orderBy) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            const column = getQueryColumn(columns, property)
            if (!column) {
                throw new Error('Column ' + property + ' included in the order by not found in the select clause')
            }
            const order = orderBy[property]
            if (!order) {
                orderByColumns += this._appendSql(column, params)
            } else switch (order) {
                case 'asc':
                case 'asc nulls first':
                    orderByColumns += this._appendSql(column, params) + ' asc'
                    break
                case 'desc':
                case 'desc nulls last':
                    orderByColumns += this._appendSql(column, params) + ' desc'
                    break
                case 'asc nulls last':
                    orderByColumns += this._appendSql(column, params) + ' is null, ' + this._appendSql(column, params) + ' asc'
                    break
                case 'desc nulls first':
                    orderByColumns += this._appendSql(column, params) + ' is not null, ' + this._appendSql(column, params) + ' desc'
                    break
                case 'insensitive':
                    orderByColumns += this.__appendColumnInsensitive(column, params)
                    break
                case 'asc insensitive':
                case 'asc nulls first insensitive':
                    orderByColumns += this.__appendColumnInsensitive(column, params) + ' asc'
                    break
                case 'desc insensitive':
                case 'desc nulls last insensitive':
                    orderByColumns += this.__appendColumnInsensitive(column, params) + ' desc'
                    break
                case 'asc nulls last insensitive':
                    orderByColumns += this._appendSql(column, params) + ' is null, ' + this.__appendColumnInsensitive(column, params) + ' asc'
                    break
                case 'desc nulls first insensitive':
                    orderByColumns += this._appendSql(column, params) + ' is not null, ' + this.__appendColumnInsensitive(column, params) + ' desc'
                    break
                default:
                    throw new Error('Invalid order by: ' + property + ' ' + order)
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
        if (addSpace) {
            return ' order by ' + orderByColumns
        } else {
            return 'order by ' + orderByColumns
        }
    }
    __appendColumnAliasInsensitive(identifier: string, column: AnyValueSource, params: any[]) {
        const collation = this._connectionConfiguration.insesitiveCollation
        const columnType = __getValueSourcePrivate(column).__valueType
        if (columnType != 'string') {
            // Ignore the insensitive term, it do nothing
            return this._appendColumnAlias(identifier, params)
        } else if (collation) {
            return this._appendColumnAlias(identifier, params) + ' collate ' + collation
        } else if (collation === '') {
            return this._appendColumnAlias(identifier, params)
        } else {
            return 'lower(' + this._appendColumnAlias(identifier, params) + ')'
        }
    }
    __appendColumnInsensitive(column: AnyValueSource, params: any[]) {
        const collation = this._connectionConfiguration.insesitiveCollation
        const columnType = __getValueSourcePrivate(column).__valueType
        if (columnType != 'string') {
            // Ignore the insensitive term, it do nothing
            return this._appendSql(column, params)
        } else if (collation) {
            return this._appendSqlParenthesis(column, params) + ' collate ' + collation
        } else if (collation === '') {
            return this._appendSql(column, params)
        } else {
            return 'lower(' + this._appendSql(column, params) + ')'
        }
    } 
    _buildSelectLimitOffset(query: SelectData, params: any[]): string {
        let result = ''

        const limit = query.__limit
        if (limit !== null && limit !== undefined) {
            result += ' limit ' + this._appendValue(limit, params, 'int', undefined)
        }

        const offset = query.__offset
        if (offset !== null && offset !== undefined) {
            if (!result) {
                // MySql/MariaDB doesn't support an offset without a limit, let put the the max value of an int
                result += ' limit 2147483647'
            }
            result += ' offset ' + this._appendValue(offset, params, 'int', undefined)
        }

        if (!result && this._isAggregateArrayWrapped(params) && (query.__orderBy || query.__customization?.beforeOrderByItems || query.__customization?.afterOrderByItems)) {
            result += ' limit 2147483647' // Workaround to force mysql/maraiadb to order the result (if not the order by is ignored), the number is the max value of an int
        }
        return result
    }
    _buildInsertDefaultValues(query: InsertData, params: any[]): string {
        this._ensureRootQuery(query, params)
        const customization = query.__customization
        let insertQuery = 'insert '
        if (customization && customization.afterInsertKeyword) {
            insertQuery += this._appendRawFragment(customization.afterInsertKeyword, params) + ' '
        }
        insertQuery += this._buildInsertOnConflictBeforeInto(query, params)
        insertQuery += 'into ' + this._appendTableOrViewName(query.__table, params) + ' () values ()'
        insertQuery += this._buildInsertOnConflictBeforeReturning(query, params)
        insertQuery += this._buildInsertReturning(query, params)
        if (customization && customization.afterQuery) {
            insertQuery += ' ' + this._appendRawFragment(customization.afterQuery, params)
        }
        this._resetRootQuery(query, params)
        return insertQuery
    }
    _buildInsertOutput(_query: InsertData, _params: any[]): string {
        return ''
    }
    _buildInsertOnConflictBeforeInto(query: InsertData, _params: any[]): string {
        if (query.__onConflictDoNothing) {
            return 'ignore '
        }

        return ''
    }
    _buildInsertOnConflictBeforeReturning(query: InsertData, params: any[]): string {
        let columns = ''
        const table = query.__table
        const sets = query.__onConflictUpdateSets
        if (sets) {
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
                columns += this._appendValueForColumn(column, value, params)
            }
        }
        if (columns) {
            return ' on duplicate key update ' + columns
        } else {
            return ''
        }
    }
    _appendRawColumnNameForValuesForInsert(column: Column, _params: any[]): string {
        const columnPrivate = __getColumnPrivate(column)
        return 'values(' + this._escape(columnPrivate.__name, true) + ')'
    }
    _appendColumnNameForUpdate(column: Column, params: any[]) {
        return this._appendRawColumnName(column, params)
    }
    _buildAfterUpdateTable(query: UpdateData, params: any[]): string {
        const result = this._buildFromJoins(query.__froms, query.__joins, undefined, params)
        if (result) {
            return ', ' + result
        }
        return ''
    }
    _buildUpdateFrom(_query: UpdateData, _updatePrimaryKey: boolean, _requiredTables: Set<ITableOrView<any>> | undefined, _requiredColumns: Set<Column> | undefined, _params: any[]): string {
        return ''
    }
    _buidDeleteUsing(query: DeleteData, params: any[]): string {
        const result = this._buildFromJoins(query.__using, query.__joins, undefined, params)
        if (result) {
            if (query.__using && query.__using.length > 0) {
                return ' using ' + this._appendTableOrViewName(query.__table, params) + ', ' + result
            }
            return ' using ' + this._appendTableOrViewName(query.__table, params) + result
        }
        return ''
    }
    _is(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, params) + ' <=>' + this._appendRawColumnName(value, params)
        }
        return this._appendSqlParenthesis(valueSource, params) + ' <=> ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _isNot(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return 'not (' + this._appendRawColumnName(valueSource, params) + ' <=> ' + this._appendRawColumnName(value, params) + ')'
        }
        return 'not (' + this._appendSqlParenthesis(valueSource, params) + ' <=> ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ')'
    }
    _divide(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' / ' + this._appendValueParenthesis(value, params, this._getMathArgumentType(columnType, value), typeAdapter)
    }
    _asDouble(params: any[], valueSource: ToSql): string {
        return this._appendSqlParenthesis(valueSource, params) + ' * 1.0'
    }
    _valueWhenNull(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'ifnull(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _escapeLikeWildcard(params: any[], value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'string') {
            value = value.replace(/\\/g, '\\\\\\\\')
            value = value.replace(/%/g, '\\%')
            value = value.replace(/_/g, '\\_')
            return this._appendValue(value, params, columnType, typeAdapter)
        } else {
            return "replace(replace(replace(" + this._appendValue(value, params, columnType, typeAdapter) + ", '\\\\', '\\\\\\\\\\\\\\\\'), '%', '\\\\%'), '_', '\\\\_')"
        }
    }
    _startsWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' like concat(' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ", '%')"
    }
    _notStartsWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' not like concat(' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ", '%')"
    }
    _endsWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
    }
    _notEndsWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
    }
    _startsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' like concat(' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ", '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' like concat(' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ", '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') like concat(lower(' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + "), '%')"
        }
    }
    _notStartsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' not like concat(' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ", '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' not like concat(' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ", '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') not like concat(lower(' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + "), '%')"
        }
    }
    _endsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") like concat('%', lower(" +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + '))'
        }
    }
    _notEndsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " not like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " not like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") not like concat('%', lower(" +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + '))'
        }
    }
    _contains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ", '%')"
    }
    _notContains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " not like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ", '%')"
    }
    _containsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ", '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ", '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") like concat('%', lower(" +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + "), '%')"
        }
    }
    _notContainsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " not like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ", '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " not like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ", '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") not like concat('%', lower(" +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + "), '%')"
        }
    }
    _concat(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        let result = 'concat(' 
        if (isValueSource(valueSource)) {
            result += this._appendMaybeInnerConcat(valueSource, params)
        } else {
            result += this._appendSql(valueSource, params) 
        }
        result += ', ' 
        if (isValueSource(value)) {
            result += this._appendMaybeInnerConcat(value, params)
        } else {
            result += this._appendValue(value, params, columnType, typeAdapter) 
        }
        result += ')'
        return result
    }
    _appendMaybeInnerConcat(valueSource: AnyValueSource, params: any[]): string {
        if (valueSource instanceof SqlOperation1ValueSource && valueSource.__operation === '_concat') {
            let result = this._appendMaybeInnerConcat(valueSource.__valueSource, params)
            const value = valueSource.__value
            result += ', '
            if (isValueSource(value)) {
                result += this._appendMaybeInnerConcat(value, params)
            } else {
                result += this._appendValue(value, params, valueSource.__valueType, valueSource.__typeAdapter) 
            }
            return result
        }
        if (valueSource instanceof SqlOperation1ValueSourceIfValueOrIgnore && valueSource.__operation === '_concat') {
            let result = this._appendMaybeInnerConcat(valueSource.__valueSource, params)
            const value = valueSource.__value
            if (this._isValue(value)) {
                result += ', '
                if (isValueSource(value)) {
                    result += this._appendMaybeInnerConcat(value, params)
                } else {
                    result += this._appendValue(value, params, valueSource.__valueType, valueSource.__typeAdapter) 
                }
            }
            return result
        }
        return this._appendSql(valueSource, params)
    }
    _log10(params: any[], valueSource: ToSql): string {
        return 'log10(' +this._appendSql(valueSource, params) + ')'
    }
    _cbrt(params: any[], valueSource: ToSql): string {
        return 'power(' + this._appendSql(valueSource, params) + ', 3)'
    }
    _logn(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'log(' + this._appendValue(value, params, this._getMathArgumentType(columnType, value), typeAdapter) + ', ' + this._appendSql(valueSource, params) + ')'
    }
    _getDate(params: any[], valueSource: ToSql): string {
        return 'dayofmonth(' + this._appendSql(valueSource, params) + ')'
    }
    _getTime(params: any[], valueSource: ToSql): string {
        return 'round(unix_timestamp(' + this._appendSql(valueSource, params) + ') * 1000)'
    }
    _getFullYear(params: any[], valueSource: ToSql): string {
        return 'year(' + this._appendSql(valueSource, params) + ')'
    }
    _getMonth(params: any[], valueSource: ToSql): string {
        return 'month(' + this._appendSql(valueSource, params) + ') - 1'
    }
    _getDay(params: any[], valueSource: ToSql): string {
        return 'dayofweek(' + this._appendSql(valueSource, params) + ') - 1'
    }
    _getHours(params: any[], valueSource: ToSql): string {
        return 'hour(' + this._appendSql(valueSource, params) + ')'
    }
    _getMinutes(params: any[], valueSource: ToSql): string {
        return 'minute(' + this._appendSql(valueSource, params) + ')'
    }
    _getSeconds(params: any[], valueSource: ToSql): string {
        return 'second(' + this._appendSql(valueSource, params) + ')'
    }
    _getMilliseconds(params: any[], valueSource: ToSql): string {
        return 'round(microsecond(' + this._appendSql(valueSource, params) + ') / 1000)'
    }
    _stringConcat(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'group_concat(' + this._appendSql(value, params) + ')'
        } else if (separator === '') {
            return 'group_concat(' + this._appendSql(value, params) + " separator '')"
        } else {
            return 'group_concat(' + this._appendSql(value, params) + ' separator ' + this._appendValue(separator, params, 'string', undefined) + ')'
        }
    }
    _stringConcatDistinct(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'group_concat(distinct ' + this._appendSql(value, params) + ')'
        } else if (separator === '') {
            return 'group_concat(' + this._appendSql(value, params) + " separator '')"
        } else {
            return 'group_concat(distinct ' + this._appendSql(value, params) + ' separator ' + this._appendValue(separator, params, 'string', undefined) + ')'
        }
    }
    _in(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (Array.isArray(value) && value.length <= 0) {
            return this._falseValueForCondition
        }
        return super._in(params, valueSource, value, columnType, typeAdapter)
    }
    _notIn(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (Array.isArray(value) && value.length <= 0) {
            return this._trueValueForCondition
        }
        return super._notIn(params, valueSource, value, columnType, typeAdapter)
    }
    _appendAggragateArrayColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, params: any[], _query: SelectData | undefined): string {
        if (isValueSource(aggregatedArrayColumns)) {
            return 'json_arrayagg(' + this._appendSql(aggregatedArrayColumns, params) + ')'
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

            return 'json_arrayagg(json_object(' + result + '))'
        }
    }
    _appendAggragateArrayWrappedColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, _params: any[], aggregateId: number): string {
        if (isValueSource(aggregatedArrayColumns)) {
            return 'json_arrayagg(a_' + aggregateId + '_.result)'
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

            return 'json_arrayagg(json_object(' + result + '))'
        }
    }
}
