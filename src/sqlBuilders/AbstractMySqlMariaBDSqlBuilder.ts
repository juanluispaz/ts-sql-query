import type { ToSql, SelectData, InsertData } from "./SqlBuilder"
import type { TypeAdapter } from "../TypeAdapter"
import type { OrderByMode } from "../expressions/select"
import { AbstractSqlBuilder } from "./AbstractSqlBuilder"

export class AbstractMySqlMariaDBSqlBuilder extends AbstractSqlBuilder {
    constructor() {
        super()
        this._operationsThatNeedParenthesis._concat = false
        this._operationsThatNeedParenthesis._is = true
        this._operationsThatNeedParenthesis._asDouble = true
        this._operationsThatNeedParenthesis._getDate = true
        this._operationsThatNeedParenthesis._getMilliseconds = false
    }
    _forceAsIdentifier(identifier: string): string {
        return '`' + identifier + '`'
    }
    _buildSelectOrderBy(query: SelectData, _params: any[]): string {
        const orderBy = query.__orderBy
        if (!orderBy) {
            return ''
        }
        let orderByColumns = ''
        for (const property in orderBy) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            const order = orderBy[property]
            if (order) {
                switch (order as OrderByMode) {
                    case 'asc':
                    case 'asc nulls first':
                        orderByColumns += this._escape(property) + ' asc'
                        break
                    case 'desc':
                    case 'desc nulls last':
                        orderByColumns += this._escape(property) + ' desc'
                        break
                    case 'asc nulls last':
                        orderByColumns += this._escape(property) + ' is null, ' + this._escape(property) + ' asc'
                        break
                    case 'desc nulls first':
                        orderByColumns += this._escape(property) + ' is not null, ' + this._escape(property) + ' desc'
                        break
                }
                orderByColumns += this._escape(property) + ' ' + order
            } else {
                orderByColumns += this._escape(property)
            }
        }
        if (!orderByColumns) {
            return ''
        }

        return ' order by ' + orderByColumns
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
    _buildInsertDefaultValues(query: InsertData, _params: any[]): string {
        return 'insert into ' + this._getTableOrViewNameInSql(query.__table) + ' () values ()'
    }
    _buildInsertOutput(_query: InsertData, _params: any[]): string {
        return ''
    }
    _buildInsertReturning(_query: InsertData, _params: any[]): string {
        return ''
    }
    _is(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' <=> ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _isNot(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
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
    _startWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' like concat(' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ", '%')"
    }
    _notStartWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' not like concat(' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ", '%')"
    }
    _endWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
    }
    _notEndWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
    }
    _startWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' like concat(' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ", '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' like concat(' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ", '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') like concat(lower(' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + "), '%')"
        }
    }
    _notStartWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' not like concat(' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ", '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' not like concat(' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ", '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') not like concat(lower(' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + "), '%')"
        }
    }
    _endWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") like concat('%', lower(" +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + '))'
        }
    }
    _notEndWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
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
        if (Array.isArray(value)) {
            if (value.length <= 0) {
                return this._falseValue
            } else {
                return this._appendSqlParenthesis(valueSource, params) + ' in ' + this._appendValue(value, params, columnType, typeAdapter)
            }
        } else {
            return this._appendSqlParenthesis(valueSource, params) + ' in (' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
    }
    _notIn(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (Array.isArray(value)) {
            if (value.length <= 0) {
                return this._trueValue
            } else {
                return this._appendSqlParenthesis(valueSource, params) + ' not in ' + this._appendValue(value, params, columnType, typeAdapter)
            }
        } else {
            return this._appendSqlParenthesis(valueSource, params) + ' not in (' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
    }
}
