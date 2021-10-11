import type { ToSql, SelectData, InsertData } from "./SqlBuilder"
import type { TypeAdapter } from "../TypeAdapter"
import type { OrderByMode } from "../expressions/select"
import type { IValueSource } from "../expressions/values"
import { AbstractSqlBuilder } from "./AbstractSqlBuilder"
import { __getValueSourcePrivate } from "../expressions/values"
import { Column, isColumn } from "../utils/Column"

export class AbstractMySqlMariaDBSqlBuilder extends AbstractSqlBuilder {
    constructor() {
        super()
        this._operationsThatNeedParenthesis._concat = false
        this._operationsThatNeedParenthesis._is = true
        this._operationsThatNeedParenthesis._asDouble = true
        this._operationsThatNeedParenthesis._getDate = true
        this._operationsThatNeedParenthesis._getMilliseconds = false
    }
    _insertSupportWith = false
    _forceAsIdentifier(identifier: string): string {
        return '`' + identifier + '`'
    }
    _buildSelectOrderBy(query: SelectData, _params: any[]): string {
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
            const column = columns[property]
            if (!column) {
                throw new Error('Column ' + property + ' included in the order by not found in the select clause')
            }
            const order = orderBy[property]
            if (!order) {
                orderByColumns += this._escape(property, true)
            } else switch (order as OrderByMode) {
                case 'asc':
                case 'asc nulls first':
                    orderByColumns += this._escape(property, true) + ' asc'
                    break
                case 'desc':
                case 'desc nulls last':
                    orderByColumns += this._escape(property, true) + ' desc'
                    break
                case 'asc nulls last':
                    orderByColumns += this._escape(property, true) + ' is null, ' + this._escape(property, true) + ' asc'
                    break
                case 'desc nulls first':
                    orderByColumns += this._escape(property, true) + ' is not null, ' + this._escape(property, true) + ' desc'
                    break
                case 'insensitive':
                    orderByColumns += this._escapeInsensitive(property, column)
                    break
                case 'asc insensitive':
                case 'asc nulls first insensitive':
                    orderByColumns += this._escapeInsensitive(property, column) + ' asc'
                    break
                case 'desc insensitive':
                case 'desc nulls last insensitive':
                    orderByColumns += this._escapeInsensitive(property, column) + ' desc'
                    break
                case 'asc nulls last insensitive':
                    orderByColumns += this._escape(property, true) + ' is null, ' + this._escapeInsensitive(property, column) + ' asc'
                    break
                case 'desc nulls first insensitive':
                    orderByColumns += this._escape(property, true) + ' is not null, ' + this._escapeInsensitive(property, column) + ' desc'
                    break
                default:
                    throw new Error('Invalid order by: ' + property + ' ' + order)
            }
        }
        
        if (!orderByColumns) {
            return ''
        }
        return ' order by ' + orderByColumns
    }
    _escapeInsensitive(identifier: string, column: IValueSource<any, any>) {
        const collation = this._connectionConfiguration.insesitiveCollation
        const columnType = __getValueSourcePrivate(column).__valueType
        if (columnType != 'string') {
            // Ignore the insensitive term, it do nothing
            return this._escape(identifier, true)
        } else if (collation) {
            return this._escape(identifier, true) + ' collate ' + collation
        } else if (collation === '') {
            return this._escape(identifier, true)
        } else {
            return 'lower(' + this._escape(identifier, true) + ')'
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
            result += ' offset ' + this._appendValue(offset, params, 'int', undefined)
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
        insertQuery += 'into ' + this._appendTableOrViewName(query.__table, params) + ' () values ()'
        if (customization && customization.afterQuery) {
            insertQuery += ' ' + this._appendRawFragment(customization.afterQuery, params)
        }
        this._resetRootQuery(query, params)
        return insertQuery
    }
    _buildInsertOutput(_query: InsertData, _params: any[]): string {
        return ''
    }
    _buildInsertReturning(_query: InsertData, params: any[]): string {
        this._setContainsInsertReturningClause(params, false)
        return ''
    }
    _appendColumnNameForUpdate(column: Column, params: any[]) {
        return this._appendRawColumnName(column, params)
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
        return this._appendSqlParenthesis(valueSource, params) + ' / ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
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
        return this._appendSqlParenthesis(valueSource, params) + " like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + "), '%')"
    }
    _notContains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " not like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + "), '%')"
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
        return 'concat(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _log10(params: any[], valueSource: ToSql): string {
        return 'log10(' +this._appendSql(valueSource, params) + ')'
    }
    _cbrt(params: any[], valueSource: ToSql): string {
        return 'power(' + this._appendSql(valueSource, params) + ', 3)'
    }
    _logn(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'log(' + this._appendValue(value, params, columnType, typeAdapter) + ', ' + this._appendSql(valueSource, params) + ')'
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
        return 'month(' + this._appendSql(valueSource, params) + ')'
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
            return 'group_concat(' + this._appendSql(value, params) + ", '')"
        } else {
            return 'group_concat(' + this._appendSql(value, params) + ' separator ' + this._appendValue(separator, params, 'string', undefined) + ')'
        }
    }
    _stringConcatDistinct(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'group_concat(distinct ' + this._appendSql(value, params) + ')'
        } else if (separator === '') {
            return 'group_concat(' + this._appendSql(value, params) + ", '')"
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
}
