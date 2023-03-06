import { ToSql, InsertData, CompoundOperator, SelectData, QueryColumns, FlatQueryColumns, flattenQueryColumns, WithSelectData, hasToSql } from "./SqlBuilder"
import { CustomBooleanTypeAdapter, TypeAdapter } from "../TypeAdapter"
import { AnyValueSource, isValueSource, __AggregatedArrayColumns } from "../expressions/values"
import { AbstractSqlBuilder } from "./AbstractSqlBuilder"
import { Column, isColumn, __getColumnOfObject, __getColumnPrivate } from "../utils/Column"
import { __getValueSourcePrivate } from "../expressions/values"

export class OracleSqlBuilder extends AbstractSqlBuilder {
    oracle: true = true
    constructor() {
        super()
        this._operationsThatNeedParenthesis._getTime = true
        this._operationsThatNeedParenthesis._getMonth = true
        this._operationsThatNeedParenthesis._getDay = true
    }

    _insertSupportWith = false
    _getUuidStrategy(): 'string' | 'custom-functions' {
        return this._connectionConfiguration.uuidStrategy as any || 'custom-functions'
    }
    _isReservedKeyword(word: string): boolean {
        return word.toUpperCase() in reservedWords
    }
    _nextSequenceValue(_params: any[], sequenceName: string) {
        return this._escape(sequenceName, false) + '.nextval'
    }
    _currentSequenceValue(_params: any[], sequenceName: string): string {
        return this._escape(sequenceName, false) + '.currval'
    }
    _fromNoTable() {
        return ' from dual'
    }
    _supportTableAliasWithAs = false
    _trueValue = '1'
    _falseValue = '0'
    _trueValueForCondition = '(1=1)'
    _falseValueForCondition = '(0=1)'
    _nullValueForCondition = '(0=null)'
    _appendSql(value: ToSql | AnyValueSource, params: any[]): string {
        if (isValueSource(value) && !isColumn(value)) {
            const valueSourcePrivate = __getValueSourcePrivate(value)
            if (valueSourcePrivate.__isBooleanForCondition) {
                if (valueSourcePrivate.__optionalType === 'required') {
                    return 'case when ' + super._appendConditionSql(value, params) + ' then 1 else 0 end'
                } else {
                    return 'case when ' + super._appendConditionSql(value, params) + ' then 1 when not ' + super._appendConditionSqlParenthesis(value, params) + ' then 0 else null end'
                }
            }
        }
        return super._appendSql(value, params)
    }
    _appendConditionSql(value: ToSql | AnyValueSource, params: any[]): string {
        if (isValueSource(value) && !isColumn(value) && hasToSql(value)) {
            const valueSourcePrivate = __getValueSourcePrivate(value)
            if (!valueSourcePrivate.__isBooleanForCondition) {
                return '(' + value.__toSqlForCondition(this, params) + ' = 1)'
            }
        }
        return super._appendConditionSql(value, params)
    }
    _appendConditionParam(value: any, params: any[], columnType: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (columnType === 'boolean') {
            if (isColumn(value)) {
                const columnPrivate = __getColumnPrivate(value)
                const typeAdapter = columnPrivate.__typeAdapter
                if (typeAdapter instanceof CustomBooleanTypeAdapter) {
                    return '(' + this._appendRawColumnName(value, params) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, params) + ')'
                }
            }
            return '(' + this._appendParam(value, params, columnType, typeAdapter, forceTypeCast) + ' = 1)'
        }
        return this._appendParam(value, params, columnType, typeAdapter, forceTypeCast)
    }
    _appendColumnName(column: Column, params: any[]): string {
        const columnPrivate = __getColumnPrivate(column)
        const typeAdapter = columnPrivate.__typeAdapter
        if (columnPrivate.__valueType === 'boolean') {
            if (typeAdapter instanceof CustomBooleanTypeAdapter) {
                if (columnPrivate.__optionalType === 'required') {
                    return 'case when ' + this._appendRawColumnName(column, params) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, params) + ' then 1 else 0 end'
                } else {
                    return 'case ' + this._appendRawColumnName(column, params) + ' when ' + this._appendLiteralValue(typeAdapter.trueValue, params) +  ' then 1 when ' + this._appendLiteralValue(typeAdapter.falseValue, params) + ' then 0 else null end'
                }
            }
        }

        return this._appendRawColumnName(column, params)
    }
    _appendColumnNameForCondition(column: Column, params: any[]): string {
        const columnPrivate = __getColumnPrivate(column)
        const typeAdapter = columnPrivate.__typeAdapter
        if (columnPrivate.__valueType === 'boolean') {
            if (typeAdapter instanceof CustomBooleanTypeAdapter) {
                return '(' + this._appendRawColumnName(column, params) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, params) + ')'
            } else {
                return '(' + this._appendRawColumnName(column, params) + ' = 1)'
            }
        }

        return this._appendRawColumnName(column, params)
    }
    _inlineSelectAsValueForCondition(query: SelectData, params: any[]): string {
        const result = '((' + this._buildInlineSelect(query, params) + ') = 1)'
        return result
    }
    _appendWithColumns(withData: WithSelectData, params: any[]): string {
        if (withData.__selectData.__type === 'plain') {
            return ''
        }
        
        const columns: FlatQueryColumns = {}
        flattenQueryColumns(withData.__selectData.__columns, columns, '')

        let result = ''
        for (const property in columns) {
            if (result) {
                result += ', '
            }
            result += this._appendColumnAlias(property, params)
        }

        return '(' + result + ')'
    }
    _appendWithKeyword(_recursive: boolean): string {
        // Oracle doesn't uses the recursive keyword
        return 'with'
    }
    _appendColumnAlias(name: string, params: any[]): string {
        if (!this._isWithGeneratedFinished(params)) {
            // Avoid quote identifiers when the with clause is generated
            return this._escape(name, true)
        }
        if (this._isAggregateArrayWrapped(params)) {
            // Avoid quote identifiers when the aggregate array query wrapper is generated
            return this._escape(name, true)
        }
        // Avoid automatically uppercase identifiers by oracle
        return this._forceAsIdentifier(name)
    }
    _appendParam(value: any, params: any[], columnType: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (columnType === 'uuid' && this._getUuidStrategy() === 'custom-functions') {
            return 'uuid_to_raw(' + super._appendParam(value, params, columnType, typeAdapter, forceTypeCast) + ')'
        }
        return super._appendParam(value, params, columnType, typeAdapter, forceTypeCast)
    }
    _appendColumnValue(value: AnyValueSource, params: any[], isOutermostQuery: boolean): string {
        if (isOutermostQuery && this._getUuidStrategy() === 'custom-functions') {
            if (__getValueSourcePrivate(value).__valueType === 'uuid') {
                return 'raw_to_uuid(' + this._appendSql(value, params) + ')'
            }
        }
        return this._appendSql(value, params)
    }
    _asString(params: any[], valueSource: ToSql): string {
        // Transform an uuid to string
        if (this._getUuidStrategy() === 'string') {
            // No conversion required
            return this._appendSql(valueSource, params)
        }
        return 'raw_to_uuid(' + this._appendSql(valueSource, params) + ')'
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
                return ' minus '
            case 'exceptAll':
                return ' minus all '
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
        if (query.__limit !== undefined || query.__offset !== undefined || query.__orderBy || query.__customization?.beforeOrderByItems || query.__customization?.afterOrderByItems) {
            return 'select * from (' + result + ')'
        }
        return result
    }
    _buildSelectOrderBy(query: SelectData, params: any[]): string {
        if (query.__type === 'plain') {
            return super._buildSelectOrderBy(query, params)
        }

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

        const columns: FlatQueryColumns = {}
        flattenQueryColumns(query.__columns, columns, '')
        const columnNames = Object.getOwnPropertyNames(columns)
        let orderByColumns = ''

        const customization = query.__customization
        if (customization && customization.beforeOrderByItems) {
            orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, params)
        }

        for (const property in orderBy) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            const column = columns[property]
            if (!column) {
                throw new Error('Column ' + property + ' included in the order by not found in the select clause')
            }
            const columnAlias = columnNames.indexOf(property) + 1
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
    _buildSelectLimitOffset(query: SelectData, params: any[]): string {
        let result = super._buildSelectLimitOffset(query, params)

        if (!result && this._isAggregateArrayWrapped(params) && (query.__orderBy || query.__customization?.beforeOrderByItems || query.__customization?.afterOrderByItems)) {
            result += ' offset 0 rows' // Workaround to force oracle to order the result (if not the order by is ignored)
        }
        return result
    }
    _buildInsertMultiple(query: InsertData, params: any[]): string {
        const multiple = query.__multiple
        if (!multiple) {
            throw new Error('Exepected a multiple insert')
        }
        if (multiple.length <= 0) {
            return ''
        }

        this._ensureRootQuery(query, params)
        const table = query.__table
        const oldSafeTableOrView = this._getSafeTableOrView(params)
        const oldFakeNameOf = this._getFakeNamesOf(params)
        this._setFakeNamesOf(params, undefined)
        const customization = query.__customization
        this._setSafeTableOrView(params, table)

        const returning = !!query.__idColumn || !!query.__columns

        let insertQuery = ''
        if (this._insertSupportWith) {
            insertQuery += this._buildWith(query, params)
        }
        if (returning) {
            insertQuery += 'begin '
        } else {
            insertQuery = 'insert '
            if (customization && customization.afterInsertKeyword) {
                insertQuery += this._appendRawFragment(customization.afterInsertKeyword, params) + ' '
            }
            insertQuery += 'all'
        }

        for (let i = 0, length = multiple.length; i < length; i++) {
            if (returning) {
                insertQuery += 'insert '
                if (customization && customization.afterInsertKeyword) {
                    insertQuery += this._appendRawFragment(customization.afterInsertKeyword, params) + ' '
                }
            }
            insertQuery += this._buildInsertOnConflictBeforeInto(query, params)
            insertQuery += 'into '
            insertQuery += this._appendTableOrViewName(table, params)

            const sets = multiple[i]!
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
    
                columns += this._appendSql(column, params)
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
            insertQuery += this._buildInsertOnConflictBeforeReturning(query, params)
            insertQuery += this._buildInsertReturning(query, params)
            if (customization && customization.afterQuery) {
                insertQuery += ' ' + this._appendRawFragment(customization.afterQuery, params)
            }
            if (returning) {
                insertQuery += '; '
            }
        }

        this._setSafeTableOrView(params, oldSafeTableOrView)
        this._setFakeNamesOf(params, oldFakeNameOf)
        this._resetRootQuery(query, params)

        if (returning) {
            insertQuery += 'end;'
        } else {
            insertQuery += ' select ' + multiple.length + ' from dual'
        }

        return insertQuery
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
        insertQuery += this._buildInsertOnConflictBeforeInto(query, params)
        insertQuery += 'into '
        insertQuery += this._appendTableOrViewName(table, params)

        let columns = ''
        for (var columnName in table) {
            const column = __getColumnOfObject(table, columnName)
            if (!column) {
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
        for (var columnName in table) {
            const column = __getColumnOfObject(table, columnName)
            if (!column) {
                continue
            }

            if (values) {
                values += ', '
            }

            const columnPrivate = __getColumnPrivate(column)
            if (columnPrivate.__sequenceName) {
                values += this._nextSequenceValue(params, columnPrivate.__sequenceName)
            } else {
                values += 'default'
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
    _buildInsertOutput(_query: InsertData, _params: any[]): string {
        return ''
    }
    _buildInsertReturning(query: InsertData, params: any[]): string {
        const idColumn = query.__idColumn
        if (idColumn) {
            this._setContainsInsertReturningClause(params, true)
            return ' returning ' + this._appendSql(idColumn, params) + ' into ' + this._queryRunner.addOutParam(params, '') // Empty name for the out params, no special name is requiered
        }

        const result = this._buildQueryReturning(query.__columns, params)
        this._setContainsInsertReturningClause(params, !!result)
        return result
    }
    _buildQueryReturning(queryColumns: QueryColumns | undefined, params: any[]): string {
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
            result += this._appendSql(columns[property]!, params)
            requireComma = true
        }
        if (result) {
            result +=  ' into '
        }
        requireComma = false
        for (const property in columns) {
            if (requireComma) {
                result += ', '
            }
            result +=  this._queryRunner.addOutParam(params, property)
            requireComma = true
        }
        if (!result) {
            return ''
        }
        return ' returning ' + result
    }
    _isNull(params: any[], valueSource: ToSql): string {
        if (isColumn(valueSource)) {
            this._appendRawColumnName(valueSource, params) + ' is null'
        }
        if (isValueSource(valueSource)) {
            const valueSourcePrivate = __getValueSourcePrivate(valueSource)
            if (valueSourcePrivate.__isBooleanForCondition) {
                if (valueSourcePrivate.__optionalType === 'required') {
                    return this._falseValueForCondition
                } else {
                    // This is a boolean value (0 or 1 from a column) that need to be use in a boolean expression
                    return '(case when ' + this._appendConditionSql(valueSource, params) + ' then 0 when not ' + this._appendConditionSqlParenthesis(valueSource, params) + ' then 0 else 1 end = 1)'
                }
            }
        }
        return this._appendSqlParenthesis(valueSource, params) + ' is null'
    }
    _isNotNull(params: any[], valueSource: ToSql): string {
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
                    return '(case when ' + this._appendConditionSql(valueSource, params) + ' then 1 when not ' + this._appendConditionSqlParenthesis(valueSource, params) + ' then 1 else 0 end = 1)'
                }
            }
        }
        return this._appendSqlParenthesis(valueSource, params) + ' is not null'
    }
    _is(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return 'decode(' + this._appendRawColumnName(valueSource, params) + ', ' + this._appendRawColumnName(value, params) + ', 1, 0 ) = 1'
        }
        return 'decode(' + this._appendSqlParenthesis(valueSource, params) + ', ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ', 1, 0 ) = 1'
    }
    _isNot(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return 'decode(' + this._appendRawColumnName(valueSource, params) + ', ' + this._appendRawColumnName(value, params) + ', 1, 0 ) = 0'
        }
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
        return this._appendSqlParenthesis(valueSource, params) + ' / ' + this._appendValueParenthesis(value, params, this._getMathArgumentType(columnType, value), typeAdapter)
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
        return "extract(day from(sys_extract_utc(" + this._appendSql(valueSource, params) + ") - to_timestamp('1970-01-01', 'YYYY-MM-DD'))) * 86400000 + to_number(to_char(sys_extract_utc(" + this._appendSql(valueSource, params) + "), 'SSSSSFF3'))"
    }
    _getFullYear(params: any[], valueSource: ToSql): string {
        return 'extract(year from ' + this._appendSql(valueSource, params) + ')'
    }
    _getMonth(params: any[], valueSource: ToSql): string {
        return 'extract(month from ' + this._appendSql(valueSource, params) + ') - 1'
    }
    _getDay(params: any[], valueSource: ToSql): string {
        // https://riptutorial.com/oracle/example/31649/getting-the-day-of-the-week
        return "mod(trunc(" + this._appendSql(valueSource, params) + ") - trunc(" + this._appendSql(valueSource, params) + ", 'IW') + 1, 7)"
    }
    _getHours(params: any[], valueSource: ToSql): string {
        return 'extract(hour from ' + this._appendSql(valueSource, params) + ')'
    }
    _getMinutes(params: any[], valueSource: ToSql): string {
        return 'extract(minute from ' + this._appendSql(valueSource, params) + ')'
    }
    _getSeconds(params: any[], valueSource: ToSql): string {
        return 'trunc(extract(second from ' + this._appendSql(valueSource, params) + '))'
    }
    _getMilliseconds(params: any[], valueSource: ToSql): string {
        return "to_number(to_char(" + this._appendSql(valueSource, params) + ", 'FF3'))"
    }
    _buildCallProcedure(params: any[], procedureName: string, procedureParams: AnyValueSource[]): string {
        let result = 'begin ' + this._escape(procedureName, false) + '('
        if (procedureParams.length > 0) {
            result += this._appendSql(procedureParams[0]!, params)

            for (let i = 1, length = procedureParams.length; i < length; i++) {
                result += ', ' + this._appendSql(procedureParams[i]!, params)
            }
        }

        return result + '); end;'
    }
    _buildCallFunction(params: any[], functionName: string, functionParams: AnyValueSource[]): string {
        let result = 'select ' + this._escape(functionName, false) + '('
        if (functionParams.length > 0) {
            result += this._appendSql(functionParams[0]!, params)

            for (let i = 1, length = functionParams.length; i < length; i++) {
                result += ', ' + this._appendSql(functionParams[i]!, params)
            }
        }

        return result + ') from dual'
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
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' like (' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' collate ' + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' like ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + " escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') like lower(' + this._appendValue(value, params, columnType, typeAdapter) + ") escape '\\'"
        }
    }
    _notLikeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' not like (' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' collate ' + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' not like ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + " escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') not like lower(' + this._appendValue(value, params, columnType, typeAdapter) + ") escape '\\'"
        }
    }
    _startsWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' like (' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _notStartsWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' not like (' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _endsWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") escape '\\'"
    }
    _notEndsWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") escape '\\'"
    }
    _startsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' like ((' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') collate " + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' like (' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') like lower(' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
        }
    }
    _notStartsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' not like ((' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') collate " + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' not like (' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') not like lower(' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
        }
    }
    _endsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " like (('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") collate " + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") escape '\\'"
        }
    }
    _notEndsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " not like (('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") collate " + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") not like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") escape '\\'"
        }
    }
    _contains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _notContains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _containsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " like (('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') collate " + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
        }
    }
    _notContainsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " not like (('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') collate " + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") not like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
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
            if (__getValueSourcePrivate(aggregatedArrayColumns).__valueType === 'uuid' && this._getUuidStrategy() === 'custom-functions') {
                return 'json_arrayagg(raw_to_uuid' + this._appendSql(aggregatedArrayColumns, params) + '))'
            }
            return 'json_arrayagg(' + this._appendSql(aggregatedArrayColumns, params) + ')'
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "' value "
                const column = columns[prop]!
                if (__getValueSourcePrivate(column).__valueType === 'uuid' && this._getUuidStrategy() === 'custom-functions') {
                    result += 'raw_to_uuid(' + this._appendSql(column, params) + ')'
                } else {
                    result += this._appendSql(column, params)
                }
            }

            return 'json_arrayagg(json_object(' + result + '))'
        }
    }
    _appendAggragateArrayWrappedColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, _params: any[], aggregateId: number): string {
        if (isValueSource(aggregatedArrayColumns)) {
            if (__getValueSourcePrivate(aggregatedArrayColumns).__valueType === 'uuid' && this._getUuidStrategy() === 'custom-functions') {
                return 'json_arrayagg(raw_to_uuida_' + aggregateId + '_.result))'
            }
            return 'json_arrayagg(a_' + aggregateId + '_.result)'
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "' value "
                const column = columns[prop]!
                if (__getValueSourcePrivate(column).__valueType === 'uuid' && this._getUuidStrategy() === 'custom-functions') {
                    result += 'raw_to_uuid(a_' + aggregateId + '_.' + this._escape(prop, true) + ')'
                } else {
                    result += 'a_' + aggregateId + '_.' + this._escape(prop, true)
                }
            }

            return 'json_arrayagg(json_object(' + result + '))'
        }
    }
}

/*
 * Source: Combine reserved words from:
 * - Oracle 10g: https://docs.oracle.com/cd/B19306_01/em.102/b40103/app_oracle_reserved_words.htm
 * - Oracle 19: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Oracle-SQL-Reserved-Words.html#GUID-55C49D1E-BE08-4C50-A9DD-8593EB925612
 */
const reservedWords: { [word: string]: boolean | undefined } = {
    ACCOUNT: true,
    ACTIVATE: true,
    ADMIN: true,
    ADVISE: true,
    AFTER: true,
    ALL_ROWS: true,
    ALLOCATE: true,
    ANALYZE: true,
    ARCHIVE: true,
    ARCHIVELOG: true,
    ARRAY: true,
    AT: true,
    AUTHENTICATED: true,
    AUTHORIZATION: true,
    AUTOEXTEND: true,
    AUTOMATIC: true,
    BACKUP: true,
    BECOME: true,
    BEFORE: true,
    BEGIN: true,
    BFILE: true,
    BITMAP: true,
    BLOB: true,
    BLOCK: true,
    BODY: true,
    CACHE: true,
    CACHE_INSTANCES: true,
    CANCEL: true,
    CASCADE: true,
    CAST: true,
    CFILE: true,
    CHAINED: true,
    CHANGE: true,
    CHAR_CS: true,
    CHARACTER: true,
    CHECKPOINT: true,
    CHOOSE: true,
    CHUNK: true,
    CLEAR: true,
    CLOB: true,
    CLONE: true,
    CLOSE: true,
    CLOSE_CACHED_OPEN_CURSORS: true,
    COALESCE: true,
    COLUMNS: true,
    COMMIT: true,
    COMMITTED: true,
    COMPATIBILITY: true,
    COMPILE: true,
    COMPLETE: true,
    COMPOSITE_LIMIT: true,
    COMPUTE: true,
    CONNECT_TIME: true,
    CONSTRAINT: true,
    CONSTRAINTS: true,
    CONTENTS: true,
    CONTINUE: true,
    CONTROLFILE: true,
    CONVERT: true,
    COST: true,
    CPU_PER_CALL: true,
    CPU_PER_SESSION: true,
    CURRENT_SCHEMA: true,
    CURREN_USER: true,
    CURSOR: true,
    CYCLE: true,
    DANGLING: true,
    DATABASE: true,
    DATAFILE: true,
    DATAFILES: true,
    DATAOBJNO: true,
    DBA: true,
    DBHIGH: true,
    DBLOW: true,
    DBMAC: true,
    DEALLOCATE: true,
    DEBUG: true,
    DEC: true,
    DECLARE: true,
    DEFERRABLE: true,
    DEFERRED: true,
    DEGREE: true,
    DEREF: true,
    DIRECTORY: true,
    DISABLE: true,
    DISCONNECT: true,
    DISMOUNT: true,
    DISTRIBUTED: true,
    DML: true,
    DOUBLE: true,
    DUMP: true,
    EACH: true,
    ENABLE: true,
    END: true,
    ENFORCE: true,
    ENTRY: true,
    ESCAPE: true,
    EXCEPT: true,
    EXCEPTIONS: true,
    EXCHANGE: true,
    EXCLUDING: true,
    EXECUTE: true,
    EXPIRE: true,
    EXPLAIN: true,
    EXTENT: true,
    EXTENTS: true,
    EXTERNALLY: true,
    FAILED_LOGIN_ATTEMPTS: true,
    FALSE: true,
    FAST: true,
    FIRST_ROWS: true,
    FLAGGER: true,
    FLOB: true,
    FLUSH: true,
    FORCE: true,
    FOREIGN: true,
    FREELIST: true,
    FREELISTS: true,
    FULL: true,
    FUNCTION: true,
    GLOBAL: true,
    GLOBALLY: true,
    GLOBAL_NAME: true,
    GROUPS: true,
    HASH: true,
    HASHKEYS: true,
    HEADER: true,
    HEAP: true,
    IDGENERATORS: true,
    IDLE_TIME: true,
    IF: true,
    INCLUDING: true,
    INDEXED: true,
    INDEXES: true,
    INDICATOR: true,
    IND_PARTITION: true,
    INITIALLY: true,
    INITRANS: true,
    INSTANCE: true,
    INSTANCES: true,
    INSTEAD: true,
    INT: true,
    INTERMEDIATE: true,
    ISOLATION: true,
    ISOLATION_LEVEL: true,
    KEEP: true,
    KEY: true,
    KILL: true,
    LABEL: true,
    LAYER: true,
    LESS: true,
    LIBRARY: true,
    LIMIT: true,
    LINK: true,
    LIST: true,
    LOB: true,
    LOCAL: true,
    LOCKED: true,
    LOG: true,
    LOGFILE: true,
    LOGGING: true,
    LOGICAL_READS_PER_CALL: true,
    LOGICAL_READS_PER_SESSION: true,
    MANAGE: true,
    MASTER: true,
    MAX: true,
    MAXARCHLOGS: true,
    MAXDATAFILES: true,
    MAXINSTANCES: true,
    MAXLOGFILES: true,
    MAXLOGHISTORY: true,
    MAXLOGMEMBERS: true,
    MAXSIZE: true,
    MAXTRANS: true,
    MAXVALUE: true,
    MIN: true,
    MEMBER: true,
    MINIMUM: true,
    MINEXTENTS: true,
    MINVALUE: true,
    MLS_LABEL_FORMAT: true,
    MOUNT: true,
    MOVE: true,
    MTS_DISPATCHERS: true,
    MULTISET: true,
    NATIONAL: true,
    NCHAR: true,
    NCHAR_CS: true,
    NCLOB: true,
    NEEDED: true,
    NESTED: true,
    NETWORK: true,
    NEW: true,
    NEXT: true,
    NOARCHIVELOG: true,
    NOCACHE: true,
    NOCYCLE: true,
    NOFORCE: true,
    NOLOGGING: true,
    NOMAXVALUE: true,
    NOMINVALUE: true,
    NONE: true,
    NOORDER: true,
    NOOVERRIDE: true,
    NOPARALLEL: true,
    NOREVERSE: true,
    NORMAL: true,
    NOSORT: true,
    NOTHING: true,
    NUMERIC: true,
    NVARCHAR2: true,
    OBJECT: true,
    OBJNO: true,
    OBJNO_REUSE: true,
    OFF: true,
    OID: true,
    OIDINDEX: true,
    OLD: true,
    ONLY: true,
    OPCODE: true,
    OPEN: true,
    OPTIMAL: true,
    OPTIMIZER_GOAL: true,
    ORGANIZATION: true,
    OSLABEL: true,
    OVERFLOW: true,
    OWN: true,
    PACKAGE: true,
    PARALLEL: true,
    PARTITION: true,
    PASSWORD: true,
    PASSWORD_GRACE_TIME: true,
    PASSWORD_LIFE_TIME: true,
    PASSWORD_LOCK_TIME: true,
    PASSWORD_REUSE_MAX: true,
    PASSWORD_REUSE_TIME: true,
    PASSWORD_VERIFY_FUNCTION: true,
    PCTINCREASE: true,
    PCTTHRESHOLD: true,
    PCTUSED: true,
    PCTVERSION: true,
    PERCENT: true,
    PERMANENT: true,
    PLAN: true,
    PLSQL_DEBUG: true,
    POST_TRANSACTION: true,
    PRECISION: true,
    PRESERVE: true,
    PRIMARY: true,
    PRIVATE: true,
    PRIVATE_SGA: true,
    PRIVILEGE: true,
    PRIVILEGES: true,
    PROCEDURE: true,
    PROFILE: true,
    PURGE: true,
    QUEUE: true,
    QUOTA: true,
    RANGE: true,
    RBA: true,
    READ: true,
    READUP: true,
    REAL: true,
    REBUILD: true,
    RECOVER: true,
    RECOVERABLE: true,
    RECOVERY: true,
    REF: true,
    REFERENCES: true,
    REFERENCING: true,
    REFRESH: true,
    REPLACE: true,
    RESET: true,
    RESETLOGS: true,
    RESIZE: true,
    RESTRICTED: true,
    RETURN: true,
    RETURNING: true,
    REUSE: true,
    REVERSE: true,
    ROLE: true,
    ROLES: true,
    ROLLBACK: true,
    RULE: true,
    SAMPLE: true,
    SAVEPOINT: true,
    SB4: true,
    SCAN_INSTANCES: true,
    SCHEMA: true,
    SCN: true,
    SCOPE: true,
    SD_ALL: true,
    SD_INHIBIT: true,
    SD_SHOW: true,
    SEGMENT: true,
    SEG_BLOCK: true,
    SEG_FILE: true,
    SEQUENCE: true,
    SERIALIZABLE: true,
    SESSION_CACHED_CURSORS: true,
    SESSIONS_PER_USER: true,
    SHARED: true,
    SHARED_POOL: true,
    SHRINK: true,
    SKIP: true,
    SKIP_UNUSABLE_INDEXES: true,
    SNAPSHOT: true,
    SOME: true,
    SORT: true,
    SPECIFICATION: true,
    SPLIT: true,
    SQL_TRACE: true,
    STANDBY: true,
    STATEMENT_ID: true,
    STATISTICS: true,
    STOP: true,
    STORAGE: true,
    STORE: true,
    STRUCTURE: true,
    SWITCH: true,
    SYS_OP_ENFORCE_NOT_NULL$: true,
    SYS_OP_NTCIMG$: true,
    SYSDBA: true,
    SYSOPER: true,
    SYSTEM: true,
    TABLES: true,
    TABLESPACE: true,
    TABLESPACE_NO: true,
    TABNO: true,
    TEMPORARY: true,
    THAN: true,
    THE: true,
    THREAD: true,
    TIMESTAMP: true,
    TIME: true,
    TOPLEVEL: true,
    TRACE: true,
    TRACING: true,
    TRANSACTION: true,
    TRANSITIONAL: true,
    TRIGGERS: true,
    TRUE: true,
    TRUNCATE: true,
    TX: true,
    TYPE: true,
    UB2: true,
    UBA: true,
    UNARCHIVED: true,
    UNDO: true,
    UNLIMITED: true,
    UNLOCK: true,
    UNRECOVERABLE: true,
    UNTIL: true,
    UNUSABLE: true,
    UNUSED: true,
    UPDATABLE: true,
    USAGE: true,
    USE: true,
    USING: true,
    VALIDATION: true,
    VALUE: true,
    VARYING: true,
    WHEN: true,
    WITHOUT: true,
    WORK: true,
    WRITE: true,
    WRITEDOWN: true,
    WRITEUP: true,
    XID: true,
    YEAR: true,
    ZONE: true,
    ACCESS: true,
    ADD: true,
    ALL: true,
    ALTER: true,
    AND: true,
    ANY: true,
    AS: true,
    ASC: true,
    AUDIT: true,
    BETWEEN: true,
    BY: true,
    CHAR: true,
    CHECK: true,
    CLUSTER: true,
    COLUMN: true,
    COLUMN_VALUE: true,
    COMMENT: true,
    COMPRESS: true,
    CONNECT: true,
    CREATE: true,
    CURRENT: true,
    DATE: true,
    DECIMAL: true,
    DEFAULT: true,
    DELETE: true,
    DESC: true,
    DISTINCT: true,
    DROP: true,
    ELSE: true,
    EXCLUSIVE: true,
    EXISTS: true,
    FILE: true,
    FLOAT: true,
    FOR: true,
    FROM: true,
    GRANT: true,
    GROUP: true,
    HAVING: true,
    IDENTIFIED: true,
    IMMEDIATE: true,
    IN: true,
    INCREMENT: true,
    INDEX: true,
    INITIAL: true,
    INSERT: true,
    INTEGER: true,
    INTERSECT: true,
    INTO: true,
    IS: true,
    LEVEL: true,
    LIKE: true,
    LOCK: true,
    LONG: true,
    MAXEXTENTS: true,
    MINUS: true,
    MLSLABEL: true,
    MODE: true,
    MODIFY: true,
    NESTED_TABLE_ID: true,
    NOAUDIT: true,
    NOCOMPRESS: true,
    NOT: true,
    NOWAIT: true,
    NULL: true,
    NUMBER: true,
    OF: true,
    OFFLINE: true,
    ON: true,
    ONLINE: true,
    OPTION: true,
    OR: true,
    ORDER: true,
    PCTFREE: true,
    PRIOR: true,
    PUBLIC: true,
    RAW: true,
    RENAME: true,
    RESOURCE: true,
    REVOKE: true,
    ROW: true,
    ROWID: true,
    ROWNUM: true,
    ROWS: true,
    SELECT: true,
    SESSION: true,
    SET: true,
    SHARE: true,
    SIZE: true,
    SMALLINT: true,
    START: true,
    SUCCESSFUL: true,
    SYNONYM: true,
    SYSDATE: true,
    TABLE: true,
    THEN: true,
    TO: true,
    TRIGGER: true,
    UID: true,
    UNION: true,
    UNIQUE: true,
    UPDATE: true,
    USER: true,
    VALIDATE: true,
    VALUES: true,
    VARCHAR: true,
    VARCHAR2: true,
    VIEW: true,
    WHENEVER: true,
    WHERE: true,
    WITH: true
}