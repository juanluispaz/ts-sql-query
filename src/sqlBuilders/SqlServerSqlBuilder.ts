import type { ToSql, SelectData, InsertData } from "./SqlBuilder"
import type { TypeAdapter } from "../TypeAdapter"
import { isValueSource, ValueSource } from "../expressions/values"
import type { OrderByMode } from "../expressions/select"
import { AbstractSqlBuilder } from "./AbstractSqlBuilder"
import { isColumn, __getColumnPrivate } from "../utils/Column"

export class SqlServerSqlBuilder extends AbstractSqlBuilder {
    sqlServer: true = true
    constructor() {
        super()
        this._operationsThatNeedParenthesis._getDate = true
        this._operationsThatNeedParenthesis._getMilliseconds = false
    }

    _forceAsIdentifier(identifier: string): string {
        return '[' + identifier + ']'
    }
    _isReservedKeyword(word: string): boolean {
        return word.toUpperCase() in reservedWords
    }
    _nextSequenceValue(_params: any[], sequenceName: string) {
        return 'next value for ' + this._escape(sequenceName)
    }
    _currentSequenceValue(_params: any[], sequenceName: string): string {
        return "(select current_value from sys.sequences where name = '" + sequenceName + "')"
    }
    _trueValue = 'convert(bit, 1)'
    _falseValue = 'convert(bit, 0)'
    _appendParam(value: any, params: any[], columnType: string): string {
        // keep the data type to use in the query runner
        Object.defineProperty(params, '@' + params.length, {
            value: columnType,
            writable: true,
            enumerable: false,
            configurable: true
        })
        return this._queryRunner.addParam(params, value)
    }
    _buildSelectOrderBy(query: SelectData, _params: any[]): string {
        // How to index it: http://www.sqlines.com/oracle/function_based_indexes
        const orderBy = query.__orderBy
        if (!orderBy) {
            const limit = query.__limit
            const offset = query.__offset
            if ((offset !== null && offset !== undefined) || (limit !== null && limit !== undefined)) {
                // Add fake order by to allow a limit and offset without order by
                const columns = query.__columns
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
                        orderByColumns += 'iif(' + this._escape(property) + ' is null, 1, 0), ' + this._escape(property) + ' asc'
                        break
                    case 'desc nulls first':
                        orderByColumns += 'iif(' + this._escape(property) + ' is not null, 1, 0), ' + this._escape(property) + ' desc'
                        break
                }
                orderByColumns += this._escape(property)
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
    _buildSelectLimitOffset(query: SelectData, params: any[]): string {
        let result = ''

        const limit = query.__limit
        const offset = query.__offset
        if (offset !== null && offset !== undefined) {
            result += ' offset ' + this._appendValue(offset, params, 'int', undefined) + ' rows'
        } 
        
        if (limit !== null && limit !== undefined) {
            if (!result) {
                result += ' offset 0 rows'
            }
            result += ' fetch next ' + this._appendValue(limit, params, 'int', undefined) + ' rows only'
        }
        return result
    }
    _buildInsertOutput(query: InsertData, params: any[]): string {
        const idColumn = query.__idColumn
        if (!idColumn) {
            return ''
        }
        return ' output inserted.' + this._appendSql(idColumn, params)
    }
    _buildInsertReturning(_query: InsertData, _params: any[]): string {
        return ''
    }
    _is(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (!isValueSource(valueSource)) {
            // this is very strange, we expect value source to be a ValueSource object, then, we can use the most general solution
            return 'exists(select ' + this._appendSqlParenthesis(valueSource, params) + ' intersect select ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ')'
        }

        if (value === null || value === undefined) {
            // We know value is null or undefined, then, whe need tu ensure the value source is null as well
            return this._appendSqlParenthesis(valueSource, params) + ' is null'
        }
        if (!isValueSource(value)) {
            // We know value is not null or undefined, then, we can use the sql that compare both values knowing one is not null
            return 'isnull(' + this._appendSqlParenthesis(valueSource, params) + ' = ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ', ' + this._falseValue + ')'
        }
        
        if (valueSource.isConstValue()) {
            const valueSourceValue = valueSource.getConstValue()
            if (valueSourceValue === null || valueSourceValue === undefined) {
                // We know value source is null or undefined, then, whe need tu ensure the value source is null as well
                return this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' is null'
            } else {
                // We know value source is not null or undefined, then, we can use the sql that compare both values knowing one is not null
                return 'isnull(' + this._appendSqlParenthesis(valueSource, params) + ' = ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ', ' + this._falseValue + ')'
            }
        }

        if (isColumn(valueSource) || valueSource.isConstValue()) {
            if (isColumn(value) || value.isConstValue()) {
                // Both values are repeteables, then, we can use the sql that compare both values without knowing if one is not null, but it requires to repeat the solution
                return 'isnull(' + this._appendSqlParenthesis(valueSource, params) + ' = ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ', ' + this._falseValue + ') or (' + this._appendSqlParenthesis(valueSource, params) + ' is null and ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' is null)'
            }
        }
        // The arguments are not repeteables, then, we can use the most general solution
        return 'exists(select ' + this._appendSqlParenthesis(valueSource, params) + ' intersect select ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ')'
    }
    _isNot(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (!isValueSource(valueSource)) {
            // this is very strange, we expect value source to be a ValueSource object, then, we can use the most general solution
            return 'not exists(select ' + this._appendSqlParenthesis(valueSource, params) + ' intersect select ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ')'
        }

        if (value === null || value === undefined) {
            // We know value is null or undefined, then, whe need tu ensure the value source is not null
            return this._appendSqlParenthesis(valueSource, params) + ' is not null'
        }
        if (!isValueSource(value)) {
            // We know value is not null or undefined, then, we can use the sql that compare both values knowing one is not null
            return 'isnull(' + this._appendSqlParenthesis(valueSource, params) + ' <> ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ', ' + this._falseValue + ')'
        }
        
        if (valueSource.isConstValue()) {
            const valueSourceValue = valueSource.getConstValue()
            if (valueSourceValue === null || valueSourceValue === undefined) {
                // We know value source is null or undefined, then, whe need tu ensure the value source is null as well
                return this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' is not null'
            } else {
                // We know value source is not null or undefined, then, we can use the sql that compare both values knowing one is not null
                return 'isnull(' + this._appendSqlParenthesis(valueSource, params) + ' <> ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ', ' + this._falseValue + ')'
            }
        }

        if (isColumn(valueSource) || valueSource.isConstValue()) {
            if (isColumn(value) || value.isConstValue()) {
                // Both values are repeteables, then, we can use the sql that compare both values without knowing if one is not null, but it requires to repeat the solution
                return 'not (isnull(' + this._appendSqlParenthesis(valueSource, params) + ' = ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ', ' + this._falseValue + ') or (' + this._appendSqlParenthesis(valueSource, params) + ' is null and ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' is null))'
            }
        }
        // The arguments are not repeteables, then, we can use the most general solution
        return 'not exists(select ' + this._appendSqlParenthesis(valueSource, params) + ' intersect select ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ')'
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
        return this._appendSqlParenthesis(valueSource, params) + " not like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
    }
    _startWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' like (' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' like (' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') like lower(' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%')"
        }
    }
    _notStartWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' not like (' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' not like (' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') not like lower(' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%')"
        }
    }
    _endWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
        }
    }
    _notEndWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " not like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " not like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") not like lower('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
        }
    }
    _contains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%')"
    }
    _notContains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " not like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%')"
    }
    _containsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%')"
        }
    }
    _notContainsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " not like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " not like ('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") not like lower('%' + " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " + '%')"
        }
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
        // if (isColumn(valueSource) || !isValueSource(valueSource) || valueSource.isConstValue()) {
        //     if (isColumn(value) || !isValueSource(value) || value.isConstValue()) {
        //         // Both values are repeteables, then, we can use the sql that compare both values repeting them
        //         return 'iif(' + this._appendSql(valueSource, params) + ' < ' + this._appendValue(value, params, columnType, typeAdapter) + ', ' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        //     }
        // }
        // return '(select min(__minValue__) from (values (' + this._appendSql(valueSource, params) + '), (' + this._appendSql(valueSource, params) + ')) as __minValueTable__(__minValue__))'
    }
    _maxValue(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'iif(' + this._appendSql(valueSource, params) + ' > ' + this._appendValue(value, params, columnType, typeAdapter) + ', ' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        // Alternative implementation that avoid evaluate multiple times the arguments
        // if (isColumn(valueSource) || !isValueSource(valueSource) || valueSource.getConstValue()) {
        //     if (isColumn(value) || !isValueSource(value) || value.isConstValue()) {
        //         // Both values are repeteables, then, we can use the sql that compare both values repeting them
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
    _buildCallProcedure(params: any[], functionName: string, functionParams: ValueSource<any, any>[]): string {
        let result = 'exec ' + this._escape(functionName)
        for (let i = 0, length = functionParams.length; i < length; i++) {
            result += ' ' + this._appendSql(functionParams[i]!, params)
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