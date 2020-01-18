import { AbstractSqlBuilder } from "./AbstractSqlBuilder"
import { ToSql, SelectData, InsertData } from "./SqlBuilder"
import { ValueSourceImpl, SqlOperationStatic1ValueSource } from "../internal/ValueSourceImpl"
import { ColumnImpl } from "../internal/ColumnImpl"
import { TypeAdapter } from "../TypeAdapter"
import { __getColumnPrivate } from "../utils/Column"
import { ValueSource } from "../expressions/values"

export class SqlServerSqlBuilder extends AbstractSqlBuilder {
    sqlServer: true = true
    constructor() {
        super()
        this._operationsThatNeedParenthesis._getDate = true
        this._operationsThatNeedParenthesis._getMilliseconds = false
        this._operationsThatNeedParenthesis._currentSequenceValue = true
    }

    _nextSequenceValue(_params: any[], sequenceName: string) {
        return 'next value for ' + sequenceName
    }
    _currentSequenceValue(_params: any[], sequenceName: string): string {
        return "select current_value from sys.sequences where name = '" + sequenceName + ""
    }
    _trueValue = 'convert(bit, 1)'
    _falseValue = 'convert(bit, 0)'
    _appendValueToQueryParams(value: any, params: any[], columnType: string): void {
        // keep the data type to use in the query runner
        Object.defineProperty(this, '@' + params.length, {
            value: columnType,
            writable: true,
            enumerable: false,
            configurable: true
        })
        params.push(value)
    }
    _valuePlaceholder(index: number, _columnType: string): string {
        return '@' + index
    }
    _buildSelectOrderBy(query: SelectData, _params: any[]): string {
        // How to index it: http://www.sqlines.com/oracle/function_based_indexes
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
                switch (order) {
                    case 'asc':
                    case 'asc nulls first':
                        orderByColumns += property + ' asc'
                        break
                    case 'desc':
                    case 'desc nulls last':
                        orderByColumns += property + ' desc'
                        break
                    case 'asc nulls last':
                        orderByColumns += 'iif(' + property + ' is null, 1, 0), ' + property + ' asc'
                        break
                    case 'desc nulls first':
                        orderByColumns += 'iif(' + property + ' is not null, 1, 0), ' + property + ' desc'
                        break
                }
                orderByColumns += property
                orderByColumns += ' ' + order
            } else {
                orderByColumns += property
            }
        }
        if (!orderByColumns) {
            return ''
        }

        return ' order by ' + orderByColumns
    }
    _buildInsertOutput(query: InsertData, _params: any[]): string {
        if (!query.__idColumn) {
            return ''
        }
        return ' output inserted.' + __getColumnPrivate(query.__idColumn).__name
    }
    _buildInsertReturning(_query: InsertData, _params: any[]): string {
        return ''
    }
    _is(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (value === null || value === undefined) {
            return this._appendSqlParenthesis(valueSource, params) + ' is null'
        } else if (!(value instanceof ValueSourceImpl)) {
            return 'isnull(' + this._appendSqlParenthesis(valueSource, params) + ' = ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ', ' + this._falseValue + ')'
        } else if (valueSource instanceof SqlOperationStatic1ValueSource && valueSource.__operation === '_const') {
            if (valueSource.__value === null || valueSource.__value === undefined) {
                return this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' is null'
            } else {
                return 'isnull(' + this._appendSqlParenthesis(valueSource, params) + ' = ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ', ' + this._falseValue + ')'
            }
        } else {
            if (valueSource instanceof ColumnImpl || (valueSource instanceof SqlOperationStatic1ValueSource && valueSource.__operation === '_const')) {
                if (value instanceof ColumnImpl || (value instanceof SqlOperationStatic1ValueSource && value.__operation === '_const') || !(value instanceof ValueSourceImpl)) {
                    return 'isnull(' + this._appendSqlParenthesis(valueSource, params) + ' = ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ', ' + this._falseValue + ') or (' + this._appendSqlParenthesis(valueSource, params) + ' is null and ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' is null)'
                }
            }
            return 'exists(select ' + this._appendSqlParenthesis(valueSource, params) + ' intersect select ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ')'
        }
    }
    _isNot(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (value === null || value === undefined) {
            return this._appendSqlParenthesis(valueSource, params) + ' is not null'
        } else if (!(value instanceof ValueSourceImpl)) {
            return 'isnull(' + this._appendSqlParenthesis(valueSource, params) + ' <> ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ', ' + this._falseValue + ')'
        } else if (valueSource instanceof SqlOperationStatic1ValueSource && valueSource.__operation === '_const') {
            if (valueSource.__value === null || valueSource.__value === undefined) {
                return this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' is not null'
            } else {
                return 'isnull(' + this._appendSqlParenthesis(valueSource, params) + ' <> ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ', ' + this._falseValue + ')'
            }
        } else {
            if (valueSource instanceof ColumnImpl || (valueSource instanceof SqlOperationStatic1ValueSource && valueSource.__operation === '_const')) {
                if (value instanceof ColumnImpl || (value instanceof SqlOperationStatic1ValueSource && value.__operation === '_const') || !(value instanceof ValueSourceImpl)) {
                    return 'not (isnull(' + this._appendSqlParenthesis(valueSource, params) + ' = ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ', ' + this._falseValue + ') or (' + this._appendSqlParenthesis(valueSource, params) + ' is null and ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' is null))'
                }
            }
            return 'not exists(select ' + this._appendSqlParenthesis(valueSource, params) + ' intersect select ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ')'
        }
    }
    _valueWhenNull(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'isnull(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _escapeLikeWildcard(params: any[], value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'string') {
            value = value.replace(/\[/g, '[[]')
            value = value.replace(/%/g, '[%]')
            value = value.replace(/_/g, '[]')
            return this._appendValue(value, params, columnType, typeAdapter)
        } else {
            return "replace(replace(replace(" + this._appendValue(value, params, columnType, typeAdapter) + ", '[', '[[]'), '%', '[%]'), '_', '[]')"
        }
    }
    _startWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' like (' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%')"
    }
    _notStartWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' not like (' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%')"
    }
    _endWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
    }
    _notEndWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
    }
    _startWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ') like lower(' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%')"
    }
    _notStartWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ') not like lower(' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%')"
    }
    _endWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
    }
    _notEndWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ") not like lower('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
    }
    _contains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%')"
    }
    _notContains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " not like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%')"
    }
    _containsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%')"
    }
    _notContainsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%')"
    }
    _currentDate(): string {
        return 'getdate()'
    }
    _currentTime(): string {
        return 'convert(time, current_timestamp)'
    }
    _random(): string {
        return 'rand()'
    }
    _divide(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'cast(' + this._appendSql(valueSource, params) + ' as float) / cast(' + this._appendValue(value, params, columnType, typeAdapter) + ' as float)'
    }
    _asDouble(params: any[], valueSource: ToSql): string {
        return 'cast(' + this._appendSql(valueSource, params) + 'as float)'
    }
    _concat(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesisExcluding(valueSource, params, '_concat') + ' + ' + this._appendValueParenthesisExcluding(value, params, columnType, typeAdapter, '_concat')
    }
    _length(params: any[], valueSource: ToSql): string {
        return 'len(' + valueSource.__toSql(this, params) + ')'
    }
    _ln(params: any[], valueSource: ToSql): string {
        return 'log(' + valueSource.__toSql(this, params) + ')'
    }
    _log10(params: any[], valueSource: ToSql): string {
        return 'log10(' + valueSource.__toSql(this, params) + ')'
    }
    _cbrt(params: any[], valueSource: ToSql): string {
        return 'power(' + valueSource.__toSql(this, params) + ', 3)'
    }
    _atan2(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'atn2(' + valueSource.__toSql(this, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _minValue(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'iif(' + this._appendSql(valueSource, params) + ' < ' + this._appendValue(value, params, columnType, typeAdapter) + ', ' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        // Alternative implementation that avoid evaluate multiple times the arguments
        // if (valueSource instanceof ColumnImpl || (valueSource instanceof SqlOperationStatic1ValueSource && valueSource.__operation === '_const')) {
        //     if (value instanceof ColumnImpl || (value instanceof SqlOperationStatic1ValueSource && value.__operation === '_const') || !(value instanceof ValueSourceImpl)) {
        //         return 'iif(' + this._appendSql(valueSource, params) + ' < ' + this._appendValue(value, params, columnType, typeAdapter) + ', ' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        //     }
        // }
        // return '(select min(__minValue__) from (values (' + this._appendSql(valueSource, params) + '), (' + this._appendSql(valueSource, params) + ')) as __minValueTable__(__minValue__))'
    }
    _maxValue(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'iif(' + this._appendSql(valueSource, params) + ' > ' + this._appendValue(value, params, columnType, typeAdapter) + ', ' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        // Alternative implementation that avoid evaluate multiple times the arguments
        // if (valueSource instanceof ColumnImpl || (valueSource instanceof SqlOperationStatic1ValueSource && valueSource.__operation === '_const')) {
        //     if (value instanceof ColumnImpl || (value instanceof SqlOperationStatic1ValueSource && value.__operation === '_const') || !(value instanceof ValueSourceImpl)) {
        //         return 'iif(' + this._appendSql(valueSource, params) + ' > ' + this._appendValue(value, params, columnType, typeAdapter) + ', ' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        //     }
        // }
        // return '(select max(__maxValue__) from (values (' + this._appendSql(valueSource, params) + '), (' + this._appendSql(valueSource, params) + ')) as __maxValueTable__(__maxValue__))'
    }
    _getDate(params: any[], valueSource: ToSql): string {
        return 'datepart(day, ' + this._appendSql(valueSource, params) + ')'
    }
    _getTime(params: any[], valueSource: ToSql): string {
        return "datediff_big(millisecond, '1970-01-01 00:00:00', " + this._appendSql(valueSource, params) + ")"
    }
    _getFullYear(params: any[], valueSource: ToSql): string {
        return 'datepart(year, ' + this._appendSql(valueSource, params) + ')'
    }
    _getMonth(params: any[], valueSource: ToSql): string {
        return 'datepart(month, ' + this._appendSql(valueSource, params) + ')'
    }
    _getDay(params: any[], valueSource: ToSql): string {
        return 'datepart(weekday, ' + this._appendSql(valueSource, params) + ') - 1'
    }
    _getHours(params: any[], valueSource: ToSql): string {
        return 'datepart(hour, ' + this._appendSql(valueSource, params) + ')'
    }
    _getMinutes(params: any[], valueSource: ToSql): string {
        return 'datepart(minute, ' + this._appendSql(valueSource, params) + ')'
    }
    _getSeconds(params: any[], valueSource: ToSql): string {
        return 'datepart(second, ' + this._appendSql(valueSource, params) + ')'
    }
    _getMilliseconds(params: any[], valueSource: ToSql): string {
        return 'datepart(millisecond, ' + this._appendSql(valueSource, params) + ')'
    }
    _buildCallFunction(params: any[], functionName: string, functionParams: ValueSource<any, any, any>[]): string {
        let result = 'exec ' + functionName
        for (let i = 0, length = functionParams.length; i < length; i++) {
            result += ' ' + this._appendSql(functionParams[i], params)
        }

        return result
    }
    _stringConcat(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'string_agg(' + this._appendSql(value, params) + ", ',')"
        } else if (separator === '') {
            return 'string_agg(' + this._appendSql(value, params) + ", '')"
        } else {
            return 'string_agg(' + this._appendSql(value, params) + ', ' + this._appendValue(separator, params, 'string', undefined) + ')'
        }
    }
    _stringConcatDistinct(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'string_agg(distinct ' + this._appendSql(value, params) + ", ',')"
        } else if (separator === '') {
            return 'string_agg(distinct ' + this._appendSql(value, params) + ", '')"
        } else {
            return 'string_agg(distinct ' + this._appendSql(value, params) + ', ' + this._appendValue(separator, params, 'string', undefined) + ')'
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
