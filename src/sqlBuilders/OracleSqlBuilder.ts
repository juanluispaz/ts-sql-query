import { AbstractSqlBuilder } from "./AbstractSqlBuilder"
import { ToSql, InsertData } from "./SqlBuilder"
import { TypeAdapter } from "../TypeAdapter"
import { __getColumnPrivate } from "../utils/Column"
import { ValueSource } from "../expressions/values"

export class OracleSqlBuilder extends AbstractSqlBuilder {
    oracle: true = true
    constructor() {
        super()
        this._operationsThatNeedParenthesis._getDate = true
        this._operationsThatNeedParenthesis._getMilliseconds = false
    }

    _nextSequenceValue(_params: any[], sequenceName: string) {
        return sequenceName + '.nextval'
    }
    _currentSequenceValue(_params: any[], sequenceName: string): string {
        return sequenceName + '.currval'
    }
    _fromNoTable() {
        return ' from dual'
    }
    _trueValue = 'cast(1 as boolean)'
    _falseValue = 'cast(0 as boolean)'
    _valuePlaceholder(index: number, _columnType: string): string {
        return ':' + index
    }
    _buildInsertOutput(_query: InsertData, _params: any[]): string {
        return ''
    }
    _buildInsertReturning(query: InsertData, params: any[]): string {
        if (!query.__idColumn) {
            return ''
        }
        const result = ' returning ' + __getColumnPrivate(query.__idColumn).__name + ' into :' + params.length
        params.push({dir: 3003 /*oracledb.BIND_OUT*/}) // See https://github.com/oracle/node-oracledb/blob/master/lib/oracledb.js
        return result

    }
    _is(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'decode(' + this._appendSqlParenthesis(valueSource, params) + ', ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ', 1, 0 ) = 1'
    }
    _isNot(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'decode(' + this._appendSqlParenthesis(valueSource, params) + ', ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ', 1, 0 ) = 0'
    }
    _random(_params: any): string {
        return '(select dbms_random.value from dual)'
    }
    _currentDate(_params: any): string {
        return 'trunc(current_timestamp)'
    }
    _valueWhenNull(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'nvl(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _divide(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' / ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _asDouble(params: any[], valueSource: ToSql): string {
        return 'cast(' + this._appendSql(valueSource, params) + ' as float)'
    }
    _log10(params: any[], valueSource: ToSql): string {
        return 'log(' + this._appendSql(valueSource, params) + ', 10)'
    }
    _cbrt(params: any[], valueSource: ToSql): string {
        return 'power(' + this._appendSql(valueSource, params) + ', 3)'
    }
    _getDate(params: any[], valueSource: ToSql): string {
        return 'extract(day from ' + this._appendSql(valueSource, params) + ')'
    }
    _getTime(params: any[], valueSource: ToSql): string {
        return "round((" + this._appendSql(valueSource, params) + " - to_date('01-01-1970','DD-MM-YYYY')) * 86400000)"
    }
    _getFullYear(params: any[], valueSource: ToSql): string {
        return 'extract(year from ' + this._appendSql(valueSource, params) + ')'
    }
    _getMonth(params: any[], valueSource: ToSql): string {
        return 'extract(month from ' + this._appendSql(valueSource, params) + ')'
    }
    _getDay(params: any[], valueSource: ToSql): string {
        return 'extract(day_of_week from ' + this._appendSql(valueSource, params) + ') - 1'
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
        return 'extract(millisecond from ' + this._appendSql(valueSource, params) + ')'
    }
    _buildCallProcedure(params: any[], procedureName: string, procedureParams: ValueSource<any, any, any>[]): string {
        let result = 'begin ' + procedureName + '('
        if (procedureParams.length > 0) {
            result += this._appendSql(procedureParams[0], params)

            for (let i = 1, length = procedureParams.length; i < length; i++) {
                result += ', ' + this._appendSql(procedureParams[i], params)
            }
        }

        return result + '); end;'
    }
    _buildCallFunction(params: any[], functionName: string, functionParams: ValueSource<any, any, any>[]): string {
        let result = 'begin :' + params.length + ' := ' + functionName + '('
        params.push({dir: 3003 /*oracledb.BIND_OUT*/}) // See https://github.com/oracle/node-oracledb/blob/master/lib/oracledb.js
        if (params.length > 0) {
            result += this._appendSql(functionParams[0], params)

            for (let i = 1, length = functionParams.length; i < length; i++) {
                result += ', ' + this._appendSql(functionParams[i], params)
            }
        }

        return result + '); end;'
    }
    _stringConcat(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'listagg(' + this._appendSql(value, params) + ", ',') within group (order by" + this._appendSql(value, params) + ')'
        } else if (separator === '') {
            return 'listagg(' + this._appendSql(value, params) + ') within group (order by' +  this._appendSql(value, params) + ')'
        } else {
            return 'listagg(' + this._appendSql(value, params) + ', ' + this._appendValue(separator, params, 'string', undefined) + ') within group (order by' +  this._appendSql(value, params) + ')'
        }
    }
    _stringConcatDistinct(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'listagg(distinct ' + this._appendSql(value, params) + ", ',') within group (order by" +  this._appendSql(value, params) + ')'
        } else if (separator === '') {
            return 'listagg(distinct ' + this._appendSql(value, params) + ') within group (order by' +  this._appendSql(value, params) + ')'
        } else {
            return 'listagg(distinct ' + this._appendSql(value, params) + ', ' + this._appendValue(separator, params, 'string', undefined) + ') within group (order by' +  this._appendSql(value, params) + ')'
        }
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
    _like(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' like ' + this._appendValue(value, params, columnType, typeAdapter) + " escape '\\'"
    }
    _notLike(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' not like ' + this._appendValue(value, params, columnType, typeAdapter) + " escape '\\'"
    }
    _likeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ') like lower(' + this._appendValue(value, params, columnType, typeAdapter) + ") escape '\\'"
    }
    _notLikeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ') not like lower(' + this._appendValue(value, params, columnType, typeAdapter) + ") escape '\\'"
    }
    _startWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' like (' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _notStartWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' not like (' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _endWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") escape '\\'"
    }
    _notEndWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") escape '\\'"
    }
    _startWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ') like lower(' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _notStartWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ') not like lower(' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _endWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") escape '\\'"
    }
    _notEndWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ") not like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") escape '\\'"
    }
    _contains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _notContains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _containsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _notContainsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
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
