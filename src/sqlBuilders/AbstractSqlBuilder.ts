import { ToSql, SqlBuilder, hasToSql, DeleteData, InsertData, UpdateData, SelectData, SqlOperation, operationOf } from "./SqlBuilder"
import { __getTableOrViewPrivate, ITableOrView } from "../utils/ITableOrView"
import { BooleanValueSource, ValueSource } from "../expressions/values"
import { __getColumnOfTable, __getColumnPrivate } from "../utils/Column"
import { DefaultTypeAdapter, TypeAdapter } from "../TypeAdapter"
import { QueryRunner } from "../queryRunners/QueryRunner"

export class AbstractSqlBuilder implements SqlBuilder {
    // @ts-ignore
    _defaultTypeAdapter: DefaultTypeAdapter
    // @ts-ignore
    _queryRunner: QueryRunner
    _operationsThatNeedParenthesis: { [operation in keyof SqlOperation]?: boolean }
    constructor() {
        this._operationsThatNeedParenthesis = {
            _equals: true,
            _notEquals: true,
            _is: true,
            _isNot: true,
            _equalsInsensitive: true,
            _notEqualsInsensitive: true,
            _smaller: true,
            _larger: true,
            _smallAs: true,
            _largeAs: true,
            _and: true,
            _or: true,
            _concat: true,
            _add: true,
            _substract: true,
            _multiply: true,
            _divide: true,
            _mod: true,
            _getMilliseconds: true,
            _fragment: true
        }
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
    _getTableOrViewName(table: ITableOrView<any>): string {
        const t = __getTableOrViewPrivate(table)
        let result = this._escape(t.__name)
        if (t.__as) {
            result += ' as ' + this._escape(t.__as)
        }
        return result
    }
    _appendCondition(condition: BooleanValueSource<any, any, any>, params: any[]): string {
        if (hasToSql(condition)) {
            return condition.__toSql(this, params)
        }
        throw new Error('Conditions must have a __toSql method')
    }
    _appendConditionParenthesis(condition: BooleanValueSource<any, any, any>, params: any[]): string {
        if (this._needParenthesis(condition)) {
            return '(' + this._appendCondition(condition, params) + ')'
        }
        return this._appendCondition(condition, params)
    }
    _appendConditionParenthesisExcuding(condition: BooleanValueSource<any, any, any>, params: any[], excluding: keyof SqlOperation): string {
        if (this._needParenthesisExcluding(condition, excluding)) {
            return '(' + this._appendCondition(condition, params) + ')'
        }
        return this._appendCondition(condition, params)
    }
    _appendSql(value: ToSql | ValueSource<any, any, any>, params: any[]): string {
        return (value as ToSql).__toSql(this, params) // All ValueSource have a hidden implemetation of ToSql
    }
    _appendSqlParenthesis(value: ToSql | ValueSource<any, any, any>, params: any[]): string {
        if (this._needParenthesis(value)) {
            return '(' + this._appendSql(value, params) + ')'
        }
        return this._appendSql(value, params)
    }
    _appendSqlParenthesisExcluding(value: ToSql | ValueSource<any, any, any>, params: any[], excluding: keyof SqlOperation): string {
        if (this._needParenthesisExcluding(value, excluding)) {
            return '(' + this._appendSql(value, params) + ')'
        }
        return this._appendSql(value, params)
    }
    _appendValue(value: any, params: any[], columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (hasToSql(value)) {
            return this._appendSql(value, params)
        }
        if (Array.isArray(value) && value.length > 0) {
            let arrayResult = '(' + this._appendValue(value[0], params, columnType, typeAdapter)

            for (let i = 1, length = value.length; i < length; i++) {
                arrayResult += ', ' + this._appendValue(value[i], params, columnType, typeAdapter)
            }
            return arrayResult + ')'
        }
        const result = this._valuePlaceholder(params.length, columnType)
        const adaptedValue = this._transformParamToDB(value, columnType, typeAdapter)
        this._appendValueToQueryParams(adaptedValue, params, columnType)
        return result
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
    _transformParamToDB(value: any, columnType: string, typeAdapter: TypeAdapter | undefined): any {
        if (typeAdapter) {
            return typeAdapter.transformValueToDB(value, columnType, this._defaultTypeAdapter)
        } else {
            return this._defaultTypeAdapter.transformValueToDB(value, columnType)
        }
    }
    _appendValueToQueryParams(value: any, params: any[], _columnType: string): void {
        params.push(value)
    }
    _valuePlaceholder(index: number, _columnType: string): string {
        return '$' + index
    }
    _buildSelect(query: SelectData, params: any[]): string {
        let selectQuery = 'select '
        if (query.__distinct) {
            selectQuery += 'distinct '
        }

        const columns = query.__columns
        let requireComma = false
        for (const property in columns) {
            if (requireComma) {
                selectQuery += ', '
            }
            selectQuery += this._appendSql(columns[property], params)
            if (property) {
                selectQuery += ' as ' + this._escape(property)
            }
            requireComma = true
        }

        const tables = query.__tables_or_views
        const tablesLength = tables.length
        if (tablesLength <= 0) {
            selectQuery += this._fromNoTable()
        } else {
            selectQuery += ' from '
            requireComma = false
            for (let i = 0; i < tablesLength; i++) {
                if (requireComma) {
                    selectQuery += ', '
                }
                selectQuery += this._getTableOrViewName(tables[i])
                requireComma = true
            }
        }

        const joins = query.__joins
        const joinsLength = joins.length
        if (joinsLength > 0) {
            for (let i = 0; i < joinsLength; i++) {
                const join = joins[i]
                switch (join.__joinType) {
                    case 'join':
                        selectQuery += ' join '
                        break
                    case 'innerJoin':
                        selectQuery += ' inner join '
                        break
                    case 'leftJoin':
                        selectQuery += ' left join '
                        break
                    case 'leftOuterJoin':
                        selectQuery += ' letf outer join '
                }
                selectQuery += this._getTableOrViewName(join.__table_or_view)
                if (join.__on) {
                    const onCondition = this._appendCondition(join.__on, params)
                    if (onCondition) {
                        selectQuery += ' on ' + onCondition
                    }
                }
            }
        }

        const where = query.__where
        if (where) {
            const whereCondition = this._appendCondition(where, params)
            if (whereCondition) {
                selectQuery += ' where ' + whereCondition
            }
        }

        requireComma = false
        const groupBy = query.__groupBy
        for (let i = 0, length = groupBy.length; i < length; i++) {
            if (requireComma) {
                selectQuery += ', '
            } else {
                selectQuery += ' group by '
            }
            selectQuery += this._appendSql(groupBy[i], params)
            requireComma = true
        }

        const having = query.__having
        if (having) {
            const havingCondition = this._appendCondition(having, params)
            if (havingCondition) {
                selectQuery += ' having ' + havingCondition
            }
        }

        selectQuery += this._buildSelectOrderBy(query, params)
        selectQuery += this._buildSelectLimitOffset(query, params)

        return selectQuery
    }
    _fromNoTable() {
        return ''
    }
    _escape(name: string): string {
        return '"' + name.replace('"', '""') + '"';
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
            orderByColumns += this._escape(property)
            const order = orderBy[property]
            if (order) {
                orderByColumns += ' ' + order
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
    _buildInsertDefaultValues(query: InsertData, params: any[]): string {
        const table = query.__table
        let columns = ''
        let values = ''

        for (var columnName in table) {
            const column = __getColumnOfTable(table, columnName)
            if (!column) {
                continue
            }
            const columnPrivate = __getColumnPrivate(column)
            if (!columnPrivate.__sequenceName) {
                continue
            }

            if (columns) {
                columns += ', '
                values += ', '
            }

            columns += this._escape(columnPrivate.__name)
            values += this._nextSequenceValue(params, columnPrivate.__sequenceName)
        }

        if (columns) {
            return 'insert into ' + this._getTableOrViewName(table) + ' (' + columns + ')' + this._buildInsertOutput(query, params) + ' values (' + values + ')' + this._buildInsertReturning(query, params)
        } else {
            return 'insert into ' + this._getTableOrViewName(query.__table) + this._buildInsertOutput(query, params) + ' default values' + this._buildInsertReturning(query, params)
        }
    }
    _buildInsert(query: InsertData, params: any[]): string {
        const table = query.__table
        const sets = query.__sets

        let columns = ''
        let values = ''

        for (var columnName in table) {
            if (columnName in sets) {
                continue
            }
            const column = __getColumnOfTable(table, columnName)
            if (!column) {
                continue
            }
            const columnPrivate = __getColumnPrivate(column)
            if (!columnPrivate.__sequenceName) {
                continue
            }

            if (columns) {
                columns += ', '
                values += ', '
            }

            columns += this._escape(columnPrivate.__name)
            values += this._nextSequenceValue(params, columnPrivate.__sequenceName)
        }

        const properties = Object.getOwnPropertyNames(sets)
        for (let i = 0, length = properties.length; i < length; i++) {
            if (columns) {
                columns += ', '
                values += ', '
            }

            const property = properties[i]
            const value = sets[property]
            const column = __getColumnOfTable(table, property)
            if (column) {
                columns += this._appendSql(column, params)
                const columnPrivate = __getColumnPrivate(column)
                values += this._appendValue(value, params, columnPrivate.__columnType, columnPrivate.__typeAdapter)
            } else {
                throw new Error('Unable to find the column "' + property + ' in the table "' + this._getTableOrViewName(table) + '". The column is not included in the table definition')
            }
        }

        return 'insert into ' + this._getTableOrViewName(table) + ' (' + columns + ')' + this._buildInsertOutput(query, params) + ' values (' + values + ')' + this._buildInsertReturning(query, params)
    }
    _buildInsertOutput(_query: InsertData, _params: any[]): string {
        return ''
    }
    _buildInsertReturning(query: InsertData, _params: any[]): string {
        if (!query.__idColumn) {
            return ''
        }
        return ' returning ' + this._escape(__getColumnPrivate(query.__idColumn).__name)
    }
    _nextSequenceValue(_params: any[], sequenceName: string) {
        return "nextval('" + sequenceName + "')"
    }
    _currentSequenceValue(_params: any[], sequenceName: string): string {
        return "currval('" + sequenceName + "')"
    }
    _buildUpdate(query: UpdateData, params: any[]): string {
        const table = query.__table
        const sets = query.__sets

        let columns = ''
        const properties = Object.getOwnPropertyNames(sets)
        for (let i = 0, length = properties.length; i < length; i++) {
            if (columns) {
                columns += ', '
            }

            const property = properties[i]
            const value = sets[property]
            const column = __getColumnOfTable(table, property)
            if (column) {
                const columnPrivate = __getColumnPrivate(column)
                columns += this._escape(columnPrivate.__name)
                columns += ' = '
                columns += this._appendValue(value, params, columnPrivate.__columnType, columnPrivate.__typeAdapter)
            } else {
                throw new Error('Unable to find the column "' + property + ' in the table "' + this._getTableOrViewName(table) + '". The column is not included in the table definition')
            }
        }

        let updateQuery = 'update ' + this._getTableOrViewName(table) + ' set ' + columns
        if (query.__where) {
            const whereCondition = this._appendCondition(query.__where, params)
            if (whereCondition) {
                updateQuery += ' where ' + whereCondition
            } else if (!query.__allowNoWhere) {
                throw new Error('No where defined for the update operation')
            }
        } else if (!query.__allowNoWhere) {
            throw new Error('No where defined for the update operation')
        }
        return updateQuery
    }
    _buildDelete(query: DeleteData, params: any[]): string {
        let deleteQuery = 'delete from ' + this._getTableOrViewName(query.__table)
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
        return deleteQuery
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
    // SqlComparator1
    _equals(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' = ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _notEquals(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' <> ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _is(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' is not distinct from ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _isNot(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' is distinct from ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _equalsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ') = lower(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _notEqualsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ') <> lower(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _smaller(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' < ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _larger(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' > ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _smallAs(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' <= ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _largeAs(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' >= ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _in(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (Array.isArray(value)) {
            return this._appendSqlParenthesis(valueSource, params) + ' in ' + this._appendValue(value, params, columnType, typeAdapter)
        } else {
            return this._appendSqlParenthesis(valueSource, params) + ' in (' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
    }
    _notIn(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (Array.isArray(value)) {
            return this._appendSqlParenthesis(valueSource, params) + ' not in ' + this._appendValue(value, params, columnType, typeAdapter)
        } else {
            return this._appendSqlParenthesis(valueSource, params) + ' not in (' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
    }
    _like(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' like ' + this._appendValue(value, params, columnType, typeAdapter)
    }
    _notLike(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' not like ' + this._appendValue(value, params, columnType, typeAdapter)
    }
    _likeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ') like lower(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _notLikeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ') not like lower(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _startWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' like (' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
    }
    _notStartWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' not like (' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
    }
    _endWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
    }
    _notEndWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
    }
    _startWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ') like lower(' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
    }
    _notStartWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ') not like lower(' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
    }
    _endWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
    }
    _notEndWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ") not like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
    }
    _contains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
    }
    _notContains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
    }
    _containsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
    }
    _notContainsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
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
    _falseValue = 'false'
    _false(_params: any): string {
        return this._falseValue
    }
    // SqlOperationStatic01
    _const(params: any[], value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendValue(value, params, columnType, typeAdapter)
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
        return 'not ' + this._appendSqlParenthesis(valueSource, params)
    }
    _lower(params: any[], valueSource: ToSql): string {
        return 'lower(' + this._appendSql(valueSource, params) + ')'
    }
    _upper(params: any[], valueSource: ToSql): string {
        return 'upper(' + this._appendSql(valueSource, params) + ')'
    }
    _length(params: any[], valueSource: ToSql): string {
        return 'length(' + this._appendSql(valueSource, params) + ')'
    }
    _trim(params: any[], valueSource: ToSql): string {
        return 'trim(' + this._appendSql(valueSource, params) + ')'
    }
    _ltrim(params: any[], valueSource: ToSql): string {
        return 'ltrim(' + this._appendSql(valueSource, params) + ')'
    }
    _rtrim(params: any[], valueSource: ToSql): string {
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
    // SqlFunction1
    _valueWhenNull(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'coalesce(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _and(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const sql = valueSource.__toSql(this, params)
        const sql2 = this._appendValue(value, params, columnType, typeAdapter)
        if (!sql || sql === this._trueValue) {
            // sql === this._trueValue reduce unnecesary ands allowing dynamic queries
            return sql2
        } else if (!sql2 || sql2 === this._trueValue) {
            // sql2 === this._trueValue reduce unnecesary ands allowing dynamic queries
            return sql
        } else {
            let result
            if (operationOf(valueSource) === '_or') {
                result = '(' + sql + ')'
            } else {
                result = sql
            }
            result += ' and '
            if (operationOf(value) === '_or') {
                result += '(' + sql2 + ')'
            } else {
                result += sql2
            }
            return result
        }
    }
    _or(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const sql = valueSource.__toSql(this, params)
        const sql2 = this._appendValue(value, params, columnType, typeAdapter)
        if (!sql || sql === this._falseValue) {
            // !sql || sql === this._falseValue reduce unnecesary ors allowing dynamic queries
            return sql2
        } else if (!sql2 || sql2 === this._falseValue) {
            // !sql2 || sql2 === this._falseValue reduce unnecesary ors allowing dynamic queries
            return sql
        } else {
            let result
            if (operationOf(valueSource) === '_and') {
                result = '(' + sql + ')'
            } else {
                result = sql
            }
            result += ' or '
            if (operationOf(value) === '_and') {
                result += '(' + sql2 + ')'
            } else {
                result += sql2
            }
            return result
        }
    }
    _concat(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesisExcluding(valueSource, params, '_concat') + ' || ' + this._appendValueParenthesisExcluding(value, params, columnType, typeAdapter, '_concat')
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
    _mod(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' % ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _atan2(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'atan2(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    // SqlFunction2
    _substring(params: any[], valueSource: ToSql, value: any, value2: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'substr(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ', ' + this._appendValue(value2, params, columnType, typeAdapter) + ')'
    }
    _replace(params: any[], valueSource: ToSql, value: any, value2: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'replace(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ', ' + this._appendValue(value2, params, columnType, typeAdapter) + ')'
    }
    _buildCallProcedure(params: any[], procedureName: string, procedureParams: ValueSource<any, any, any>[]): string {
        let result = 'call ' + this._escape(procedureName) + '('
        if (procedureParams.length > 0) {
            result += this._appendSql(procedureParams[0], params)

            for (let i = 1, length = procedureParams.length; i < length; i++) {
                result += ', ' + this._appendSql(procedureParams[i], params)
            }
        }

        return result + ')'
    }
    _buildCallFunction(params: any[], functionName: string, functionParams: ValueSource<any, any, any>[]): string {
        let result = 'select ' + this._escape(functionName) + '('
        if (functionParams.length > 0) {
            result += this._appendSql(functionParams[0], params)

            for (let i = 1, length = functionParams.length; i < length; i++) {
                result += ', ' + this._appendSql(functionParams[i], params)
            }
        }

        return result + ')'
    }
    _fragment(params: any[], sql: TemplateStringsArray, sqlParams: ValueSource<any, any, any>[]): string {
        if (sqlParams.length <= 0) {
            return sql[0]
        }
        let result = ''
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            result += sql[i]
            result += this._appendSql(sqlParams[i], params)
        }
        result += sql[sql.length - 1]
        return result
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
}
