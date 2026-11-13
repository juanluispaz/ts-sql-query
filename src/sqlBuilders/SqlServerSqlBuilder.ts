import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import { sqlServerOperationsThatNeedParenthesis } from '../utils/sqlServer/sqlServerOperationsThatNeedParenthesis.js'
import type { ToSql, SelectData, InsertData, DeleteData, UpdateData, FlatQueryColumns, QueryColumns, WithValuesData, OrderByEntry } from './SqlBuilder.js'
import { hasToSql, flattenQueryColumns, getQueryColumn } from './SqlBuilder.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import { CustomBooleanTypeAdapter } from '../TypeAdapter.js'
import type { AnyValueSource, IExecutableSelectQuery, __AggregatedArrayColumns, ValueType } from '../expressions/values.js'
import { isValueSource, __isUuidValueSource, __isBooleanValueSource, __isBooleanValueType, __isLocalDateTimeValueSource } from '../expressions/values.js'
import { AbstractSqlBuilder, type SelectColumnSql } from './AbstractSqlBuilder.js'
import type { DBColumn } from '../utils/Column.js'
import { __columnPathsOf } from '../utils/columnPaths.js'
import { isColumn, __getColumnOfObject, __getColumnPrivate } from '../utils/Column.js'
import { __getValueSourcePrivate } from '../expressions/values.js'
import type { ITable } from '../utils/ITableOrView.js'
import { __getTableOrViewPrivate } from '../utils/ITableOrView.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { isSqlServerReservedWord } from '../utils/sqlServer/sqlServerReservedWords.js'

export class SqlServerSqlBuilder extends AbstractSqlBuilder {
    sqlServer: true = true
    override _operationsThatNeedParenthesis = sqlServerOperationsThatNeedParenthesis
    override _appendGroupBySelectColumn(_entry: AnyValueSource, selectColumn: SelectColumnSql, _context: SqlBuildContext, _isOutermostQuery: boolean): string {
        // No alias nor position in a group by: the same SQL, with the same named parameters
        return selectColumn.sql
    }
    override _appendRawColumnName(column: DBColumn, context: SqlBuildContext): string {
        const columnPrivate = __getColumnPrivate(column)
        const tableOrView = columnPrivate.__tableOrView
        if (__getTableOrViewPrivate(tableOrView).__oldValues) {
            return 'deleted.' + this._escape(columnPrivate.__name, true)
        }
        return super._appendRawColumnName(column, context)
    }
    override _forceAsIdentifier(identifier: string): string {
        return '[' + identifier + ']'
    }
    override _isReservedKeyword(word: string): boolean {
        return isSqlServerReservedWord(word)
    }
    override _nextSequenceValue(_context: SqlBuildContext, sequenceName: string, _columnType: ValueType) {
        return 'next value for ' + this._escape(sequenceName, false)
    }
    override _currentSequenceValue(_context: SqlBuildContext, sequenceName: string, columnType: ValueType): string {
        // SQL Server has no `currval`; the current value is read from the catalog, where it is
        // typed `sql_variant`. SQL Server refuses to convert that implicitly, so anything doing
        // arithmetic over it (or handing it to a numeric function) is rejected with "Implicit
        // conversion from data type sql_variant to int is not allowed" — the cast is what makes
        // the value composable, and it asks for the data type the sequence was declared with.
        return 'cast((select current_value from sys.sequences where name = \'' + sequenceName + '\') as ' + this._sqlServerSequenceValueType(columnType) + ')'
    }
    private _sqlServerSequenceValueType(columnType: ValueType): string {
        switch (columnType) {
            case 'int':
                return 'int'
            case 'double':
                return 'float'
            default:
                // A SQL Server sequence is always integer-typed, so every remaining declaration
                // reads one: `bigint` is the only width that cannot overflow the value, and it is
                // what a custom data type gets too, since its own width is the user's to know.
                return 'bigint'
        }
    }
    override _trueValue = 'convert(bit, 1)'
    override _falseValue = 'convert(bit, 0)'
    override _trueValueForCondition = '(1=1)'
    override _falseValueForCondition = '(0=1)'
    _nullValueForCondition = '(0=null)'
    override _appendSql(value: ToSql | AnyValueSource | IExecutableSelectQuery<any, any, any>, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (isValueSource(value) && !isColumn(value)) {
            const valueSourcePrivate = __getValueSourcePrivate(value)
            if (valueSourcePrivate.__isBooleanForCondition) {
                if (valueSourcePrivate.__optionalType === 'required') {
                    return 'cast(case when ' + super._appendConditionSql(value, context, forceTypeCast) + ' then 1 else 0 end as bit)'
                } else {
                    return 'cast(case when ' + super._appendConditionSql(value, context, forceTypeCast) + ' then 1 when not ' + super._appendConditionSqlParenthesis(value, context, forceTypeCast) + ' then 0 else null end as bit)'
                }
            }
        }
        return super._appendSql(value, context, forceTypeCast)
    }
    override _appendSelectColumnReferenceForCondition(column: AnyValueSource, context: SqlBuildContext): string {
        // The select list writes a boolean as a value (1 / 0), and the having must refer to that same expression
        // (the grouped one): it is compared with 1 to make it a condition, like _appendConditionSql does with a
        // boolean value. Only a reference to a column gets here: _appendConditionSql handles the other ones
        return '(' + this._appendSelectColumnReference(column, context) + ' = 1)'
    }
    override _appendConditionSql(value: ToSql | AnyValueSource, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (isValueSource(value) && !isColumn(value) && hasToSql(value)) {
            const valueSourcePrivate = __getValueSourcePrivate(value)
            if (__isBooleanValueSource(valueSourcePrivate) && !valueSourcePrivate.__isBooleanForCondition) {
                // A boolean value used as a condition is a `bit`; coerce it to a
                // predicate by appending `= 1` exactly once here. Source the bit
                // VALUE form (`_appendSql`), not the condition form: a const or
                // param boolean already renders its condition form as `(@0 = 1)`,
                // so reusing it would double-wrap to `((@0 = 1) = 1)`, which SQL
                // Server rejects. A literal `true`/`false` keeps the canonical
                // `(1=1)`/`(0=1)`.
                const sql = this._appendSql(value, context, forceTypeCast)
                if (!sql) {
                    return sql
                } else if (sql === this._trueValue) {
                    return this._trueValueForCondition
                } else if (sql === this._falseValue) {
                    return this._falseValueForCondition
                } else {
                    return '(' + sql + ' = 1)'
                }
            }
        }
        return super._appendConditionSql(value, context, forceTypeCast)
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
    override _convertUuidTextInCompound(): boolean {
        return true
    }
    override _appendUuidTextAsText(sql: string): string {
        return this._uuidAsText(sql)
    }
    /**
     * The text of a uniqueidentifier that leaves the database as text (projected, concatenated, cut...). SQL Server
     * writes it in upper case: it is lowered, as the other databases give it, unless `useUpperCaseUuid`. Where the text
     * is only compared (equality, like, length) the case doesn't matter and it is converted as it is.
     */
    _uuidAsText(sql: string): string {
        if (this._connectionConfiguration.useUpperCaseUuid) {
            return 'convert(nvarchar(36), ' + sql + ')'
        }
        return 'lower(convert(nvarchar(36), ' + sql + '))'
    }
    override _lowerCaseUuidTextReceived(): boolean {
        return !this._connectionConfiguration.useUpperCaseUuid
    }
    _appendSqlMaybeUuidText(value: ToSql | AnyValueSource | IExecutableSelectQuery<any, any, any>, context: SqlBuildContext): string {
        if (this._isUuid(value)) {
            return this._uuidAsText(this._appendSql(value, context, false))
        }
        return this._appendSql(value, context, false)
    }
    _appendSqlMaybeUuidTextParenthesis(value: ToSql | AnyValueSource, context: SqlBuildContext): string {
        if (this._isUuid(value)) {
            return this._uuidAsText(this._appendSql(value, context, false))
        }
        return this._appendSqlParenthesis(value, context, false)
    }
    _appendValueMaybeUuidTextParenthesis(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._isUuid(value)) {
            return this._uuidAsText(this._appendValue(value, context, columnType, columnTypeName, typeAdapter, false))
        }
        return this._appendValueParenthesis(value, context, columnType, columnTypeName, typeAdapter, false)
    }
    _appendSqlMaybeUuid(value: ToSql | AnyValueSource | IExecutableSelectQuery<any, any, any>, context: SqlBuildContext): string {
        if (this._isUuid(value)) {
            return 'convert(nvarchar(36), ' + this._appendSql(value, context, false) + ')'
        } else {
            return this._appendSql(value, context, false)
        }
    }
    _appendSqlMaybeUuidParenthesis(value: ToSql | AnyValueSource, context: SqlBuildContext): string {
        // Parenthesis-aware variant of `_appendSqlMaybeUuid` for the operands a forced
        // `collate` is applied to (the `replaceAll` / `replaceAllInsensitive` match operands).
        // SQL Server rejects `collate` on a `uniqueidentifier` ("Expression type
        // uniqueidentifier is invalid for COLLATE clause"), so a uuid receiver must be
        // converted to nvarchar(36) FIRST, like the rest of the string API. The `convert(...)`
        // call is self-delimiting, so it needs no extra parenthesis before the trailing collate.
        if (this._isUuid(value)) {
            return 'convert(nvarchar(36), ' + this._appendSql(value, context, false) + ')'
        }
        return this._appendSqlParenthesis(value, context, false)
    }
    _appendValueMaybeUuidParenthesis(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // Same as `_appendSqlMaybeUuidParenthesis`, but for a value operand that may be a raw
        // literal (routed through `_appendValue`) rather than a `ToSql`.
        if (this._isUuid(value)) {
            return 'convert(nvarchar(36), ' + this._appendValue(value, context, columnType, columnTypeName, typeAdapter, false) + ')'
        }
        return this._appendValueParenthesis(value, context, columnType, columnTypeName, typeAdapter, false)
    }
    override _appendConditionParam(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (__isBooleanValueType(columnType)) {
            if (isColumn(value)) {
                const columnPrivate = __getColumnPrivate(value)
                const typeAdapter = columnPrivate.__typeAdapter
                if (typeAdapter instanceof CustomBooleanTypeAdapter) {
                    return '(' + this._appendRawColumnName(value, context) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, context) + ')'
                }
            }
            return '(' + this._appendParam(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast) + ' = 1)'
        }
        return this._appendParam(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    override _appendColumnName(column: DBColumn, context: SqlBuildContext): string {
        const columnPrivate = __getColumnPrivate(column)
        const typeAdapter = columnPrivate.__typeAdapter
        if (__isBooleanValueSource(columnPrivate)) {
            if (typeAdapter instanceof CustomBooleanTypeAdapter) {
                if (columnPrivate.__optionalType === 'required') {
                    return 'cast(case when ' + this._appendRawColumnName(column, context) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, context) + ' then 1 else 0 end as bit)'
                } else {
                    return 'cast(case ' + this._appendRawColumnName(column, context) + ' when ' + this._appendLiteralValue(typeAdapter.trueValue, context) +  ' then 1 when ' + this._appendLiteralValue(typeAdapter.falseValue, context) + ' then 0 else null end as bit)'
                }
            }
        }

        return this._appendRawColumnName(column, context)
    }
    override _appendColumnNameForCondition(column: DBColumn, context: SqlBuildContext): string {
        const columnPrivate = __getColumnPrivate(column)
        const typeAdapter = columnPrivate.__typeAdapter
        if (__isBooleanValueSource(columnPrivate)) {
            if (typeAdapter instanceof CustomBooleanTypeAdapter) {
                return '(' + this._appendRawColumnName(column, context) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, context) + ')'
            } else {
                return '(' + this._appendRawColumnName(column, context) + ' = 1)'
            }
        }

        return this._appendRawColumnName(column, context)
    }
    // No `_inlineSelectAsValueForCondition` override: a boolean one-column
    // inline select is a `bit`, and the `... = 1` bit-to-condition coercion is
    // added exactly once by `_appendConditionSql` (the path every boolean value
    // used as a condition flows through). Coercing here too produced
    // `((<select>) = 1) = 1`, which SQL Server rejects (`Incorrect syntax near
    // '='`, error 102), so we inherit the abstract emitter's parenthesised
    // `(<select>)` and let `_appendConditionSql` apply the single coercion.
    override _appendWithKeyword(_recursive: boolean): string {
        // Sql Server doesn't uses the recursive keyword
        return 'with'
    }
    override _buildWithValues(withValues: WithValuesData, context: SqlBuildContext) {
        let result = this._escape(withValues.__name, false)
        result += ' as (select * from (values '

        const values = withValues.__values
        let valuesSql = ''
        for (let i = 0, length = values.length; i < length; i++) {
            if (valuesSql) {
                valuesSql += ', '
            }
            const value = values[i]!
            let valueSql = ''
            for (const columnName of __columnPathsOf(withValues.__getTableOrView())) {
                const column = __getColumnOfObject(withValues.__getTableOrView(), columnName)
                if (!column) {
                    continue
                }
                if (valueSql) {
                    valueSql += ', '
                }
                valueSql += this._appendSetValue(columnName, i, column, value[columnName], context)
            }
            valuesSql += '(' + valueSql + ')'
        }
        result += valuesSql
        result += ') as '
        result += this._escape(withValues.__name, false)

        let columns = ''
        for (const columnName of __columnPathsOf(withValues.__getTableOrView())) {
            const column = __getColumnOfObject(withValues.__getTableOrView(), columnName)
            if (!column) {
                continue
            }
            if (columns) {
                columns += ', '
            }
            const columnPrivate = __getColumnPrivate(column)
            columns += this._appendColumnAlias(columnPrivate.__name, context)
        }
        result += '(' + columns + ')'
        result += ')'

        return result
    }
    override _buildSelectWithColumnsInfoForCompound(query: SelectData, context: SqlBuildContext, columnsForInsert: { [name: string]: DBColumn | undefined }, isOutermostQuery: boolean, needsGrouping: boolean): string {
        const result = this._buildSelectWithColumnsInfo(query, context, columnsForInsert, isOutermostQuery)
        if (needsGrouping || query.__limit !== undefined || query.__offset !== undefined || query.__orderBy || query.__customization?.beforeOrderByItems || query.__customization?.afterOrderByItems) {
            return 'select * from (' + result + ') _t_' + context.generateUnique() + '_'
        }
        return result
    }
    override _buildSelectOrderBy(query: SelectData, context: SqlBuildContext): string {
        // How to index it: http://www.sqlines.com/oracle/function_based_indexes
        const orderBy = query.__orderBy
        if (!orderBy) {
            let orderByColumns = ''

            const customization = query.__customization
            if (customization && customization.beforeOrderByItems) {
                orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, context)
            }

            if (customization && customization.afterOrderByItems) {
                if (orderByColumns) {
                    orderByColumns += ', '
                }
                orderByColumns += this._appendRawFragment(customization.afterOrderByItems, context)
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
            orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, context)
        }

        for (let i = 0, length = orderBy.length; i < length; i++) {
            const entry = orderBy[i]!
            if (orderByColumns) {
                orderByColumns += ', '
            }
            const order = entry.order
            if (!order) {
                orderByColumns += this._appendOrderByColumnAlias(entry, query, context)
            } else switch (order) {
                case 'asc':
                case 'asc nulls first':
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, context) + ' asc'
                    break
                case 'desc':
                case 'desc nulls last':
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, context) + ' desc'
                    break
                case 'asc nulls last':
                    orderByColumns += 'iif(' + this._appendOrderByNullCheckOperand(entry, query, context) + ' is null, 1, 0), ' + this._appendOrderByColumnAlias(entry, query, context) + ' asc'
                    break
                case 'desc nulls first':
                    orderByColumns += 'iif(' + this._appendOrderByNullCheckOperand(entry, query, context) + ' is not null, 1, 0), ' + this._appendOrderByColumnAlias(entry, query, context) + ' desc'
                    break
                case 'insensitive':
                    orderByColumns += this._appendOrderByColumnAliasInsensitive(entry, query, context)
                    break
                case 'asc insensitive':
                case 'asc nulls first insensitive':
                    orderByColumns += this._appendOrderByColumnAliasInsensitive(entry, query, context) + ' asc'
                    break
                case 'desc insensitive':
                case 'desc nulls last insensitive':
                    orderByColumns += this._appendOrderByColumnAliasInsensitive(entry, query, context) + ' desc'
                    break
                case 'asc nulls last insensitive':
                    orderByColumns += 'iif(' + this._appendOrderByNullCheckOperand(entry, query, context) + ' is null, 1, 0), ' + this._appendOrderByColumnAliasInsensitive(entry, query, context) + ' asc'
                    break
                case 'desc nulls first insensitive':
                    orderByColumns += 'iif(' + this._appendOrderByNullCheckOperand(entry, query, context) + ' is not null, 1, 0), ' + this._appendOrderByColumnAliasInsensitive(entry, query, context) + ' desc'
                    break
                default:
                    throw new TsSqlProcessingError({ reason: 'INVALID_ORDER_BY_ORDERING', column: this._appendOrderByColumnAlias(entry, query, context), ordering: order }, 'Invalid order by: ' + order)
            }
        }

        if (customization && customization.afterOrderByItems) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            orderByColumns += this._appendRawFragment(customization.afterOrderByItems, context)
        }

        if (!orderByColumns) {
            return ''
        }
        return ' order by ' + orderByColumns
    }
    override _buildSelectLimitOffset(query: SelectData, context: SqlBuildContext): string {
        let result = ''

        const limit = query.__limit
        const offset = query.__offset
        if (offset !== null && offset !== undefined) {
            result += ' offset ' + this._appendValue(offset, context, 'int', 'int', undefined, false) + ' rows'
        }

        if (limit !== null && limit !== undefined) {
            if (!result) {
                result += ' offset 0 rows'
            }
            result += ' fetch next ' + this._appendValue(limit, context, 'int', 'int', undefined, false) + ' rows only'
        }

        if (!result && (query.__orderBy || query.__customization?.beforeOrderByItems || query.__customization?.afterOrderByItems) && !this._isCurrentRootQuery(query, context)) {
            // subqueries with order by requires always an offset, this add a noop offset
            result += ' offset 0 rows'
        }
        return result
    }
    override _appendOrderByColumnExpression(entry: OrderByEntry, query: SelectData, context: SqlBuildContext): string {
        // T-SQL does not resolve SELECT aliases inside scalar functions in
        // ORDER BY (only as bare references). When the entry is an alias
        // name, emit the underlying column expression instead.
        const expression = entry.expression
        if (typeof expression === 'string') {
            const column = getQueryColumn(query.__columns, expression)
            if (!column) {
                return this._appendOrderByColumnAlias(entry, query, context)
            }
            return this._appendSql(column, context, false)
        }
        return this._appendOrderByColumnAlias(entry, query, context)
    }
    override _supportOrderByColumnAliasInExpression(): boolean {
        // T-SQL resolves a name inside an ORDER BY expression against the input
        // columns, not the SELECT output aliases, so `lower(<alias>)` fails with
        // error 207 "Invalid column name". Verified against the real engine.
        return false
    }
    /**
     * The operand for the `iif(<operand> is null, …)` NULLs-emulation term. On a
     * plain select it is the alias' underlying source column (a scalar function
     * in ORDER BY can't reference a SELECT output alias — see
     * `_appendOrderByColumnExpression`). On a compound the ORDER BY is emitted on
     * the wrapping `select * from (<compound>)` (see
     * `_needsCompoundNullsEmulationOrderByWrap`), whose input columns ARE the
     * output aliases and where the source column is out of scope, so the bare
     * alias is both legal and the only thing that resolves.
     */
    private _appendOrderByNullCheckOperand(entry: OrderByEntry, query: SelectData, context: SqlBuildContext): string {
        if (query.__type === 'compound') {
            return this._appendOrderByColumnAlias(entry, query, context)
        }
        const selectColumn = this._getOrderBySelectColumnWithParams(entry, query, context)
        if (selectColumn) {
            return this._appendOrderBySelectColumnWithParams(selectColumn, entry, query, context)
        }
        return this._appendOrderByColumnExpression(entry, query, context)
    }
    override _needsCompoundNullsEmulationOrderByWrap(query: SelectData): boolean {
        // The `asc nulls last` / `desc nulls first` modes (and their insensitive
        // variants) render as an `iif(<col> is null, …)` term, which is illegal
        // inside a compound ORDER BY — SQL Server rejects it with Msg 104. Report
        // that the compound must be wrapped as `select * from (<compound>)` so the
        // `iif(...)` becomes a legal ORDER BY term on the plain wrapper. The other
        // NULLs modes render as a plain `asc` / `desc` and need no wrapper.
        if (query.__type !== 'compound') {
            return false
        }
        const orderBy = query.__orderBy
        if (!orderBy) {
            return false
        }
        for (let i = 0, length = orderBy.length; i < length; i++) {
            const entry = orderBy[i]!
            const order = entry.order
            if (order === 'asc nulls last' || order === 'desc nulls first'
                || order === 'asc nulls last insensitive' || order === 'desc nulls first insensitive') {
                return true
            }
        }
        return false
    }
    override _buildInsertOutput(query: InsertData, context: SqlBuildContext): string {
        const idColumn = query.__idColumn
        if (idColumn) {
            this._setContainsInsertReturningClause(context, true)
            return ' output inserted.' + this._appendSql(idColumn, context, false)
        }

        const result = this._buildQueryOutput(query.__columns, query.__table, 'inserted', context)
        this._setContainsInsertReturningClause(context, !!result)
        return result
    }
    override _buildInsertReturning(_query: InsertData, _context: SqlBuildContext): string {
        return ''
    }
    override _useUpdateOldValueInFrom(): boolean {
        return false
    }
    override _buildUpdateOutput(query: UpdateData, context: SqlBuildContext): string {
        return this._buildQueryOutput(query.__columns, query.__table, 'inserted', context)
    }
    override _buildUpdateReturning(_query: UpdateData, _context: SqlBuildContext): string {
        return ''
    }
    override _buidDeleteUsing(query: DeleteData, context: SqlBuildContext): string {
        const result = this._buildFromJoins(query.__using, query.__joins, undefined, context)
        if (result) {
            return ' from ' + result
        }
        return ''
    }
    override _buildDeleteOutput(query: DeleteData, context: SqlBuildContext): string {
        return this._buildQueryOutput(query.__columns, query.__table, 'deleted', context)
    }
    _buildQueryOutput(queryColumns: QueryColumns | undefined, table: ITable<any>, alias: string, context: SqlBuildContext): string {
        if (!queryColumns) {
            return ''
        }
        const columns: FlatQueryColumns = {}
        flattenQueryColumns(queryColumns, columns, '')

        const oldForceAliasFor = context.forceAliasFor
        const oldForceAliasAs = context.forceAliasAs

        context.forceAliasFor = table
        context.forceAliasAs = alias

        let requireComma = false
        let result = ''
        for (const property in columns) {
            if (requireComma) {
                result += ', '
            }
            result += this._appendResultColumnProjection(columns[property]!, this._appendSql(columns[property]!, context, false), context)
            if (property) {
                result += ' as ' + this._appendColumnAlias(property, context)
            }
            requireComma = true
        }

        context.forceAliasFor = oldForceAliasFor
        context.forceAliasAs = oldForceAliasAs
        if (!result) {
            return ''
        }
        return ' output ' + result
    }
    override _buildDeleteReturning(_query: DeleteData, _context: SqlBuildContext): string {
        return ''
    }
    override _isNull(context: SqlBuildContext, valueSource: ToSql): string {
        if (isColumn(valueSource)) {
            // The null state lives in the stored column, not in the 0/1 expression a
            // CustomBooleanTypeAdapter column remaps to (which is never null for a
            // required adapter), so the null check must read the raw column name.
            return this._appendRawColumnName(valueSource, context) + ' is null'
        } else if (isValueSource(valueSource)) {
            const valueSourcePrivate = __getValueSourcePrivate(valueSource)
            if (valueSourcePrivate.__isBooleanForCondition) {
                if (valueSourcePrivate.__optionalType === 'required') {
                    return this._falseValueForCondition
                } else {
                    // This is a boolean value (0 or 1 from a column) that need to be use in a boolean expression
                    return '(case when ' + this._appendConditionSql(valueSource, context, false) + ' then 0 when not ' + this._appendConditionSqlParenthesis(valueSource, context, false) + ' then 0 else 1 end = 1)'
                }
            }
        }
        return super._isNull(context, valueSource)
    }
    _generalIsNull(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (hasToSql(value)) {
            return this._isNull(context, value)
        }
        return this._appendValueParenthesis(value, context, columnType, columnTypeName, typeAdapter, false) + ' is null'
    }
    override _isNotNull(context: SqlBuildContext, valueSource: ToSql): string {
        if (isColumn(valueSource)) {
            return this._appendRawColumnName(valueSource, context) + ' is not null'
        } else if (isValueSource(valueSource)) {
            const valueSourcePrivate = __getValueSourcePrivate(valueSource)
            if (valueSourcePrivate.__isBooleanForCondition) {
                if (valueSourcePrivate.__optionalType === 'required') {
                    return this._trueValueForCondition
                } else {
                    // This is a boolean value (0 or 1 from a column) that need to be use in a boolean expression
                    return '(case when ' + this._appendConditionSql(valueSource, context, false) + ' then 1 when not ' + this._appendConditionSqlParenthesis(valueSource, context, false) + ' then 1 else 0 end = 1)'
                }
            }
        }
        return super._isNotNull(context, valueSource)
    }
    _generalIsNotNull(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (hasToSql(value)) {
            return this._isNotNull(context, value)
        }
        return this._appendValueParenthesis(value, context, columnType, columnTypeName, typeAdapter, false) + ' is not null'
    }
    override _is(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const valueIsNull = this._isNullValue(value)
        const valueSourceIsNull = this._isNullValue(valueSource)
        const valueIsOptional = this._isOptionalValue(value)
        const valueSourceIsOptional = this._isOptionalValue(valueSource)

        if (valueIsNull) {
            return this._isNull(context, valueSource)
        }
        if (valueSourceIsNull) {
            // We know value is null or undefined, then, whe need to ensure the value source is null as well
            return this._generalIsNull(context, value, columnType, columnTypeName, typeAdapter)
        }

        if (valueSourceIsOptional && valueIsOptional) {
            return 'case when (' + this._equals(context, valueSource, value, columnType, columnTypeName, typeAdapter) + ') or (' + this._isNull(context, valueSource) + ' and ' + this._generalIsNull(context, value, columnType, columnTypeName, typeAdapter) + ') then 1 else 0 end = 1'
        } else if (valueSourceIsOptional || valueIsOptional) {
            return 'case when ' + this._equals(context, valueSource, value, columnType, columnTypeName, typeAdapter) + ' then 1 else 0 end = 1'
        } else {
            return this._equals(context, valueSource, value, columnType, columnTypeName, typeAdapter)
        }

        // Alternative implementation that avoid evaluate multiple times the arguments
        // return 'exists(select ' + this._appendSqlParenthesis(valueSource, params) + ' intersect select ' + this._appendValueParenthesis(value, params, columnTypeName, typeAdapter) + ')'
    }
    override _isNot(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const valueIsNull = this._isNullValue(value)
        const valueSourceIsNull = this._isNullValue(valueSource)
        const valueIsOptional = this._isOptionalValue(value)
        const valueSourceIsOptional = this._isOptionalValue(valueSource)

        if (valueIsNull) {
            return this._isNotNull(context, valueSource)
        }
        if (valueSourceIsNull) {
            // We know value is null or undefined, then, whe need to ensure the value source is null as well
            return this._generalIsNotNull(context, value, columnType, columnTypeName, typeAdapter)
        }

        if (valueSourceIsOptional && valueIsOptional) {
            return 'not (case when (' + this._equals(context, valueSource, value, columnType, columnTypeName, typeAdapter) + ') or (' + this._isNull(context, valueSource) + ' and ' + this._generalIsNull(context, value, columnType, columnTypeName, typeAdapter) + ') then 1 else 0 end = 1)'
        } else if (valueSourceIsOptional || valueIsOptional) {
            return 'not (case when ' + this._equals(context, valueSource, value, columnType, columnTypeName, typeAdapter) + ' then 1 else 0 end = 1)'
        } else {
            return this._notEquals(context, valueSource, value, columnType, columnTypeName, typeAdapter)
        }

        // Alternative implementation that avoid evaluate multiple times the arguments
        // return 'not exists(select ' + this._appendSqlParenthesis(valueSource, params) + ' intersect select ' + this._appendValueParenthesis(value, params, columnTypeName, typeAdapter) + ')'
    }
    override _valueWhenNull(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // Emit `coalesce`, not T-SQL's `isnull`. `isnull(a, b)` types its result as its
        // FIRST argument and coerces the fallback to it (the same first-arg-type rule as
        // POWER — see _power / _cbrtRadicand), so a wider/longer fallback is silently
        // truncated: `isnull(varchar(3) null, 'abcdef')` = 'abc', `isnull(tinyint, 100000)`
        // narrows the numeric fallback. `coalesce` types the result as the WIDEST operand,
        // matching every other dialect and the library's declared type. `coalesce` expands
        // to a CASE that double-evaluates its first argument; accepted, because that
        // argument is the receiver — almost always a column, so repeating it is free.
        let result = 'coalesce('
        if (isValueSource(valueSource) && __getValueSourcePrivate(valueSource).__uuidString) {
            result += this._uuidAsText(this._appendSql(valueSource, context, false))
        } else {
            result += this._appendSql(valueSource, context, false)
        }
        result += ', '
        if (isValueSource(value) && __getValueSourcePrivate(value).__uuidString) {
            result += this._uuidAsText(this._appendValue(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)))
        } else {
            result += this._appendValue(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value))
        }
        result += ')'
        return result
    }
    override _escapeLikeWildcard(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (typeof value === 'string') {
            value = value.replace(/\[/g, '[[]')
            value = value.replace(/%/g, '[%]')
            value = value.replace(/_/g, '[_]')
            return this._appendValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast)
        } else {
            return "replace(replace(replace(" + this._appendValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast) + ", '[', '[[]'), '%', '[%]'), '_', '[_]')"
        }
    }
    override _replaceAll(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // SQL Server's `REPLACE` honours the column/database collation, so on the default
        // case-insensitive collation `replaceAll('abc', 'X')` on `'ABCabc'` matches both cases
        // and corrupts the value. Force `replaceCollation` (the binary/code-point collation the
        // `SqlServerConnection` defaults to) on the match operands and reset the result to
        // `DATABASE_DEFAULT` so the forced collation does not leak downstream. An empty (or unset)
        // `replaceCollation` opts out to the native `replace`.
        const collation = this._connectionConfiguration.replaceCollation
        if (!collation) {
            return super._replaceAll(context, valueSource, value, value2, columnType, columnTypeName, typeAdapter)
        }
        return 'replace(' + this._appendSqlMaybeUuidTextParenthesis(valueSource, context) + ' collate ' + collation + ', ' + this._appendValueMaybeUuidTextParenthesis(value, context, columnType, columnTypeName, typeAdapter) + ' collate ' + collation + ', ' + this._appendValue(value2, context, columnType, columnTypeName, typeAdapter, false) + ') collate DATABASE_DEFAULT'
    }
    override _replaceAllInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // SQL Server's `REPLACE` folds case under a case-insensitive collation. With
        // `insensitiveCollation` set, force it (accent support via a `..._CI_AI` name) and reset
        // to `DATABASE_DEFAULT`. Unset (or ''), emit the bare `replace(...)` and lean on the DB
        // default collation, which is case-insensitive on a standard SQL Server.
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return 'replace(' + this._appendSqlMaybeUuidTextParenthesis(valueSource, context) + ' collate ' + collation + ', ' + this._appendValueMaybeUuidTextParenthesis(value, context, columnType, columnTypeName, typeAdapter) + ' collate ' + collation + ', ' + this._appendValue(value2, context, columnType, columnTypeName, typeAdapter, false) + ') collate DATABASE_DEFAULT'
        }
        return 'replace(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, columnType, columnTypeName, typeAdapter, false) + ', ' + this._appendValue(value2, context, columnType, columnTypeName, typeAdapter, false) + ')'
    }
    // T-SQL concatenates with `+`, not `||`. That is the only thing the affix patterns
    // needed from this dialect, so the predicates themselves ride the base's shapes; only
    // the insensitive ones stay overridden below, for their uuid receiver arm.
    override _likePatternStartingWith(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, fold: boolean): string {
        const term = this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false)
        return fold ? 'lower(' + term + " + '%')" : '(' + term + " + '%')"
    }
    override _likePatternEndingWith(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, fold: boolean): string {
        const term = this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false)
        return fold ? "lower('%' + " + term + ')' : "('%' + " + term + ')'
    }
    override _likePatternContaining(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, fold: boolean): string {
        const term = this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false)
        return fold ? "lower('%' + " + term + " + '%')" : "('%' + " + term + " + '%')"
    }
    // The uuid receiver arm of the six affix-insensitive predicates below: a `uniqueidentifier`
    // renders UPPERCASE and SQL Server rejects `collate` on a bare `uniqueidentifier`, so when
    // `insensitiveCollation` is set the receiver is converted to nvarchar(36) FIRST (via
    // `_appendSqlMaybeUuidParenthesis`) and the forced `collate` applied to the result — mirroring
    // the four direct insensitive comparisons further down. Before this the uuid arm early-returned
    // a bare `like` REGARDLESS of `insensitiveCollation`, so on a case-sensitive database — or when
    // the user set `insensitiveCollation` to force folding — the config was silently dropped and the
    // match stayed case-sensitive. The bare ('') and unset (default) cases keep today's plain `like`
    // (correct on the default CI database, where `uniqueidentifier like <nvarchar>` implicitly
    // converts and folds).
    override _startsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (this._isUuid(valueSource)) {
            if (collation) {
                return this._appendSqlMaybeUuidParenthesis(valueSource, context) + ' like (' +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + " + '%') collate " + collation
            }
            return this._appendSqlParenthesis(valueSource, context, false) + ' like (' +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        }
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like (' +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + " + '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like (' +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') like lower(' +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        }
    }
    override _notStartsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (this._isUuid(valueSource)) {
            if (collation) {
                return this._appendSqlMaybeUuidParenthesis(valueSource, context) + ' not like (' +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + " + '%') collate " + collation
            }
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like (' +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        }
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like (' +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + " + '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like (' +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') not like lower(' +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        }
    }
    override _endsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (this._isUuid(valueSource)) {
            if (collation) {
                return this._appendSqlMaybeUuidParenthesis(valueSource, context) + " like ('%' + " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ') collate ' + collation
            }
            return this._appendSqlParenthesis(valueSource, context, false) + " like ('%' + " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ')'
        }
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + " like ('%' + " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + " like ('%' + " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ") like lower('%' + " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ')'
        }
    }
    override _notEndsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (this._isUuid(valueSource)) {
            if (collation) {
                return this._appendSqlMaybeUuidParenthesis(valueSource, context) + " not like ('%' + " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ') collate ' + collation
            }
            return this._appendSqlParenthesis(valueSource, context, false) + " not like ('%' + " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ')'
        }
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + " not like ('%' + " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + " not like ('%' + " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ") not like lower('%' + " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ')'
        }
    }
    override _containsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (this._isUuid(valueSource)) {
            if (collation) {
                return this._appendSqlMaybeUuidParenthesis(valueSource, context) + " like ('%' + " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + " + '%') collate " + collation
            }
            return this._appendSqlParenthesis(valueSource, context, false) + " like ('%' + " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        }
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + " like ('%' + " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + " + '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + " like ('%' + " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ") like lower('%' + " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        }
    }
    override _notContainsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (this._isUuid(valueSource)) {
            if (collation) {
                return this._appendSqlMaybeUuidParenthesis(valueSource, context) + " not like ('%' + " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + " + '%') collate " + collation
            }
            return this._appendSqlParenthesis(valueSource, context, false) + " not like ('%' + " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        }
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + " not like ('%' + " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + " + '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + " not like ('%' + " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ") not like lower('%' + " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + " + '%')"
        }
    }
    // A forced `collate` on a bare `uniqueidentifier` is rejected ("Expression type
    // uniqueidentifier is invalid for COLLATE clause"), so every SQL Server path that applies
    // one to a possibly-uuid operand must convert it to nvarchar(36) FIRST — the same treatment
    // `_replaceAll`/`_replaceAllInsensitive` already give their match operands. The four
    // non-affix insensitive comparisons below apply the `collate` to their RIGHT (value)
    // operand (`<left> = <value> collate <name>`, `<left> like <value> collate <name>`), so a
    // uuid VALUE (`uuid.asString()`) is routed through `_appendValueMaybeUuidParenthesis`. The
    // left operand carries no `collate` (an implicit uniqueidentifier conversion handles the
    // comparison), and the no-collation arms emit a bare comparison or `lower(...)` — both of
    // which SQL Server accepts on a uniqueidentifier — so those are left to the base.
    override _equalsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' = ' + this._appendValueMaybeUuidParenthesis(value, context, columnType, columnTypeName, typeAdapter) + ' collate ' + collation
        }
        return super._equalsInsensitive(context, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _notEqualsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' <> ' + this._appendValueMaybeUuidParenthesis(value, context, columnType, columnTypeName, typeAdapter) + ' collate ' + collation
        }
        return super._notEqualsInsensitive(context, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _likeInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like ' + this._appendValueMaybeUuidParenthesis(value, context, columnType, columnTypeName, typeAdapter) + ' collate ' + collation + this._likeEscape
        }
        return super._likeInsensitive(context, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _notLikeInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like ' + this._appendValueMaybeUuidParenthesis(value, context, columnType, columnTypeName, typeAdapter) + ' collate ' + collation + this._likeEscape
        }
        return super._notLikeInsensitive(context, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    // `<expr> collate <name>`: the base has no SQL Server override, so a uuid receiver
    // (`uuid.asString().collate(...)`) would emit `<uniqueidentifier> collate <name>` and be
    // rejected. Convert it first via `_appendSqlMaybeUuidParenthesis`, which reproduces the
    // base's `_appendSqlParenthesis` for a non-uuid receiver (so only the uuid case changes).
    override _collate(context: SqlBuildContext, valueSource: ToSql, collation: string): string {
        return this._appendSqlMaybeUuidTextParenthesis(valueSource, context) + ' collate ' + collation
    }
    // The forced `collate` an insensitive `orderBy` applies to a projected `uuid.asString()`
    // alias hits the same rejection; convert the (already-rendered) receiver when the ordered
    // column is a uuid.
    override _appendInsensitiveOrderByCollateReceiver(wrapped: string, entry: OrderByEntry, query: SelectData): string {
        if (this._isUuidOrderByColumn(entry, query)) {
            return 'convert(nvarchar(36), ' + wrapped + ')'
        }
        return wrapped
    }
    _isUuidOrderByColumn(entry: OrderByEntry, query: SelectData): boolean {
        const expression = entry.expression
        if (typeof expression === 'string') {
            const column = getQueryColumn(query.__columns, expression)
            if (!column) {
                return false
            }
            return this._isUuid(column)
        } else if (isValueSource(expression)) {
            return this._isUuid(expression)
        } else {
            return false
        }
    }
    override _trim(context: SqlBuildContext, valueSource: ToSql): string {
        return 'trim(' + this._appendSqlMaybeUuidText(valueSource, context) + ')'
    }
    override _trimLeft(context: SqlBuildContext, valueSource: ToSql): string {
        return 'ltrim(' + this._appendSqlMaybeUuidText(valueSource, context) + ')'
    }
    override _trimRight(context: SqlBuildContext, valueSource: ToSql): string {
        return 'rtrim(' + this._appendSqlMaybeUuidText(valueSource, context) + ')'
    }
    override _toLowerCase(context: SqlBuildContext, valueSource: ToSql): string {
        // A `uuid.asString()` receiver is still a `uniqueidentifier` column, which T-SQL
        // refuses to feed to a string function ("The data types uniqueidentifier and
        // varchar are incompatible in the add operator" once it flows into an operator);
        // convert it to nvarchar first, exactly as `trim`/`substring`/`stringConcat` do.
        return 'lower(' + this._appendSqlMaybeUuid(valueSource, context) + ')'
    }
    override _toUpperCase(context: SqlBuildContext, valueSource: ToSql): string {
        return 'upper(' + this._appendSqlMaybeUuid(valueSource, context) + ')'
    }
    override _reverse(context: SqlBuildContext, valueSource: ToSql): string {
        return 'reverse(' + this._appendSqlMaybeUuidText(valueSource, context) + ')'
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
    override _appendCastAsDouble(sql: string): string {
        return 'cast(' + sql + ' as float)'
    }
    override _appendCastAsInteger(sql: string): string {
        return 'cast(' + sql + ' as bigint)'
    }
    override _modulo(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._moduloRequiresFloatHandling(columnType, value)) {
            // T-SQL's `%` operator rejects float operands ("The data types float
            // and int are incompatible in the modulo operator"); SQL Server has
            // no `mod(...)` function either. Cast both operands to numeric — the
            // only type family `%` accepts for fractional values — so the
            // operator resolves regardless of which side is the double. The
            // integer / bigint receivers and operands keep the plain `%` form below.
            return 'cast(' + this._appendSql(valueSource, context, false) + ' as numeric(38, 16)) % cast(' + this._appendValue(value, context, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ' as numeric(38, 16))'
        }
        return super._modulo(context, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _concat(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        let result = ''
        if (this._isUuid(valueSource)) {
            result += this._uuidAsText(this._appendSql(valueSource, context, false))
        } else {
            result += this._appendSqlParenthesisExcluding(valueSource, context, '_concat', false)
        }
        result += ' + '
        if (this._isUuid(value)) {
            result += this._uuidAsText(this._appendValue(value, context, columnType, columnTypeName, typeAdapter, false))
        } else {
            result += this._appendValueParenthesisExcluding(value, context, columnType, columnTypeName, typeAdapter, '_concat', false)
        }
        return result
    }
    /**
     * T-SQL's `concat(...)` is this operation: it reads a NULL argument as the empty string and
     * converts a `uniqueidentifier` implicitly, so no operand needs neutralising. It is binary
     * because the build-time NULL check above already removed the operands that contribute
     * nothing, and `concat` here "requires 2 to 254 arguments".
     */
    override _appendConcatIgnoringNull(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'concat(' + this._appendSqlParenthesisExcluding(valueSource, context, '_concatIgnoringNull', false) + ', ' + this._appendValueParenthesisExcluding(value, context, columnType, columnTypeName, typeAdapter, '_concatIgnoringNull', false) + ')'
    }
    override _length(context: SqlBuildContext, valueSource: ToSql): string {
        if (this._connectionConfiguration.excludeTrailingBlanksInLength) {
            // Opt-in (`excludeTrailingBlanksInLength`): emit T-SQL's native `len(x)`, which
            // EXCLUDES trailing blanks (`len('Draft  ')` = 5) — diverging from JS
            // `String.length`. This also removes the max-length edge of the sentinel form
            // below (a value exactly at its column's declared maximum). A genuine trade,
            // not a strict improvement; see the flag's JSDoc on SqlServerConnection.
            return 'len(' + this._appendSqlMaybeUuid(valueSource, context) + ')'
        }
        // T-SQL's `len()` EXCLUDES trailing blanks — `len('Draft  ')` is 5, not 7 — while
        // `.length()` mirrors JS's `String.length`, which counts them. Appending a non-blank
        // character makes the trailing blanks interior, and the `- 1` takes it back off.
        // `datalength()` is not an option: it answers bytes, so it doubles under `nvarchar`.
        // NULL propagates through the concat, so a NULL receiver still answers NULL.
        // Edge (documented in LIMITATIONS.md, opt-out above): for a value exactly at its
        // column's declared maximum, T-SQL string `+` on two non-`max` char types caps the
        // concat at the maximum and drops the sentinel, so this returns maximum − 1.
        return "len(" + this._appendSqlMaybeUuid(valueSource, context) + " + '.') - 1"
    }
    override _ceil(context: SqlBuildContext, valueSource: ToSql): string {
        // T-SQL spells the ceiling function `CEILING`, not `CEIL`.
        return 'ceiling(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _round(context: SqlBuildContext, valueSource: ToSql): string {
        // T-SQL's ROUND requires the length (decimals) argument; the
        // single-arg form `round(x)` is rejected.
        return 'round(' + this._appendSql(valueSource, context, false) + ', 0)'
    }
    override _cbrtRadicand(context: SqlBuildContext, valueSource: ToSql): string {
        // T-SQL's POWER returns the data type of the first argument, so
        // `power(int, float)` truncates to int. Cast the radicand to float
        // so the cube-root emulation returns a fractional result.
        return this._appendCastAsDouble('abs(' + this._appendSql(valueSource, context, false) + ')')
    }
    override _power(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // `power()` declares its result `double`, but T-SQL's POWER returns the data type
        // of its FIRST argument (the same first-arg-type rule as ISNULL — see _valueWhenNull),
        // so `power(<int>, 0.5)` computes and truncates in int (`power(2, 0.5)` = 1, not
        // 1.4142…) and even an integer exponent overflows the int type where every other
        // engine widens (`power(50000, 2)` -> arithmetic overflow). Cast an integer base to
        // float so the fractional/large result is honoured — the same fix _cbrtRadicand
        // applies. A base that is already floating (`double`/`customDouble`, e.g. a
        // `.asDouble()` receiver whose SQL is itself `cast(... as float)`) keeps the
        // fraction natively and is left uncast to avoid a redundant double cast.
        let base = this._appendSql(valueSource, context, false)
        if (columnType !== 'double' && columnType !== 'customDouble') {
            base = this._appendCastAsDouble(base)
        }
        return 'power(' + base + ', ' + this._appendValue(value, context, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ')'
    }
    override _ln(context: SqlBuildContext, valueSource: ToSql): string {
        return 'log(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _log10(context: SqlBuildContext, valueSource: ToSql): string {
        return 'log10(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _logn(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // SQL Server's LOG is `LOG(value, base)` — value first — unlike every other backend.
        return 'log(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ')'
    }
    override _atan2(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'atn2(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ')'
    }
    override _minimumBetweenTwoValues(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // maxValue(x) — the SMALLER of the two. Native `least` / `greatest` and the `iif`
        // emulation (the `_minAndMaxValueSelection` override below) both IGNORE a NULL
        // operand, contradicting the optional type the library declares; the poison CASE
        // built by the base wraps the version-appropriate inner so a NULL operand poisons
        // the result (it also fixes the `<2022` iif's operand-order asymmetry).
        // `maxValueFunction` is the user opt-in.
        return this._minAndMaxValueBetweenTwoValuesPoisoningNull(context, valueSource, value, columnType, columnTypeName, typeAdapter, this._connectionConfiguration.maxValueFunction, 'least')
    }
    override _maximumBetweenTwoValues(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // minValue(x) — the LARGER of the two. Native `greatest` / the `iif` emulation IGNORE
        // a NULL operand; the base's poison CASE wraps the version-appropriate inner so a NULL
        // operand poisons the result. `minValueFunction` is the user opt-in.
        return this._minAndMaxValueBetweenTwoValuesPoisoningNull(context, valueSource, value, columnType, columnTypeName, typeAdapter, this._connectionConfiguration.minValueFunction, 'greatest')
    }
    override _minAndMaxValueSelection(context: SqlBuildContext, valueSource: ToSql, value: any, argumentType: ValueType, argumentTypeName: string, typeAdapter: TypeAdapter | undefined, functionName: string, argumentNeedsTypeCast: boolean): string {
        if (this._connectionConfiguration.compatibilityVersion >= 16_000_000) {
            // SQL Server 2022+ has native LEAST / GREATEST — the coherent base form.
            return super._minAndMaxValueSelection(context, valueSource, value, argumentType, argumentTypeName, typeAdapter, functionName, argumentNeedsTypeCast)
        }
        // Below SQL Server 2022 `least` / `greatest` do not exist, so emulate them with
        // `iif`. The comparison follows the function: `least` keeps the smaller (`<`),
        // `greatest` the larger (`>`).
        const operator = functionName === 'least' ? '<' : '>'
        return 'iif(' + this._appendSql(valueSource, context, false) + ' ' + operator + ' ' + this._appendValue(value, context, argumentType, argumentTypeName, typeAdapter, false) + ', ' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, argumentType, argumentTypeName, typeAdapter, false) + ')'
    }
    override _getDate(context: SqlBuildContext, valueSource: ToSql): string {
        return 'datepart(day, ' + this._appendDateTimeInUtc(context, valueSource) + ')'
    }
    override _getTime(context: SqlBuildContext, valueSource: ToSql): string {
        return "datediff_big(millisecond, '1970-01-01 00:00:00', " + this._appendSql(valueSource, context, false) + ")"
    }
    override _getFullYear(context: SqlBuildContext, valueSource: ToSql): string {
        return 'datepart(year, ' + this._appendDateTimeInUtc(context, valueSource) + ')'
    }
    override _getMonth(context: SqlBuildContext, valueSource: ToSql): string {
        return 'datepart(month, ' + this._appendDateTimeInUtc(context, valueSource) + ') - 1'
    }
    override _getDay(context: SqlBuildContext, valueSource: ToSql): string {
        // `getDay()` mirrors JavaScript's `Date.getDay()`, where 0 is always Sunday. T-SQL
        // is the only supported dialect whose day-of-week is session-dependent:
        // `DATEPART(weekday, …)` counts from whatever `SET DATEFIRST` says the week starts
        // on, and `SET LANGUAGE` changes DATEFIRST implicitly (7 for us_english, 1 for most
        // European languages). A bare `- 1` is only correct under DATEFIRST 7, and silently
        // shifts every day otherwise. Rebasing on `@@DATEFIRST` pins Sunday to 0 whatever
        // the session says.
        return '(datepart(weekday, ' + this._appendDateTimeInUtc(context, valueSource) + ') + @@datefirst - 1) % 7'
    }
    override _getHours(context: SqlBuildContext, valueSource: ToSql): string {
        return 'datepart(hour, ' + this._appendDateTimeInUtc(context, valueSource) + ')'
    }
    override _getMinutes(context: SqlBuildContext, valueSource: ToSql): string {
        return 'datepart(minute, ' + this._appendDateTimeInUtc(context, valueSource) + ')'
    }
    /**
     * The value of a getter of a part that an offset changes. A localDateTime may be held in a datetimeoffset, whose
     * datepart gives the parts of the offset it was stored with: switchoffset to +00:00 gives the parts of its instant,
     * as the getUTC… methods of the Date read. A datetime2, datetime or smalldatetime is converted with +00:00, no zone
     * of a session (SQL Server has none) takes part, and the digits stay. A localDate or a localTime has no offset, and
     * the seconds and milliseconds don't depend on one (offsets are whole minutes): they are written as they are
     */
    _appendDateTimeInUtc(context: SqlBuildContext, valueSource: ToSql): string {
        if (isValueSource(valueSource) && __isLocalDateTimeValueSource(__getValueSourcePrivate(valueSource))) {
            return 'switchoffset(' + this._appendSql(valueSource, context, false) + ", '+00:00')"
        }
        return this._appendSql(valueSource, context, false)
    }
    override _getSeconds(context: SqlBuildContext, valueSource: ToSql): string {
        return 'datepart(second, ' + this._appendSql(valueSource, context, false) + ')'
    }
    override _getMilliseconds(context: SqlBuildContext, valueSource: ToSql): string {
        return 'datepart(millisecond, ' + this._appendSql(valueSource, context, false) + ')'
    }
    override _buildCallProcedure(context: SqlBuildContext, functionName: string, functionParams: AnyValueSource[]): string {
        let result = 'exec ' + this._escape(functionName, false, true)
        for (let i = 0, length = functionParams.length; i < length; i++) {
            result += (i === 0 ? ' ' : ', ') + this._appendSql(functionParams[i]!, context, false)
        }

        return result
    }
    override _stringConcat(context: SqlBuildContext, separator: string | undefined, value: any): string {
        // SQL Server's STRING_AGG rejects NVARCHAR(MAX) for the separator
        // argument, and the mssql driver sends string parameters as
        // NVARCHAR(MAX) by default. Inlining the separator as a SQL literal
        // sidesteps the issue: SQL Server sees a bounded-length string and
        // accepts it. The separator comes from a runtime API argument, so
        // `_appendUnsafeLiteralValue` is used to escape embedded `'`.
        if (separator === undefined || separator === null) {
            return 'string_agg(' + this._appendSqlMaybeUuidText(value, context) + ", ',')"
        } else if (separator === '') {
            return 'string_agg(' + this._appendSqlMaybeUuidText(value, context) + ", '')"
        } else {
            return 'string_agg(' + this._appendSqlMaybeUuidText(value, context) + ', ' + this._appendUnsafeLiteralValue(separator, context) + ')'
        }
    }
    override _stringConcatDistinct(context: SqlBuildContext, separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'string_agg(distinct ' + this._appendSqlMaybeUuidText(value, context) + ", ',')"
        } else if (separator === '') {
            return 'string_agg(distinct ' + this._appendSqlMaybeUuidText(value, context) + ", '')"
        } else {
            return 'string_agg(distinct ' + this._appendSqlMaybeUuidText(value, context) + ', ' + this._appendUnsafeLiteralValue(separator, context) + ')'
        }
    }
    override _substrToEnd(context: SqlBuildContext, valueSource: ToSql, value: any, _columnType: ValueType, _columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'number' && value < 0) {
            // `substring()` has no negative-start semantics at all on this dialect — it just
            // reads a negative start as 1. `right()` is exactly `String.prototype.substr`'s
            // negative start, out-of-range clamp included, and it needs no version gate.
            return 'right(' + this._appendSqlMaybeUuidText(valueSource, context) + ', ' + this._appendValue(-value, context, 'int', 'int', typeAdapter, false) + ')'
        }
        if (this._connectionConfiguration.compatibilityVersion >= 17_000_000) {
            if (typeof value === 'number') {
                return 'substring(' + this._appendSqlMaybeUuidText(valueSource, context) + ', ' + this._appendValue(value + 1, context, 'int', 'int', typeAdapter, false) + ')'
            } else {
                return 'substring(' + this._appendSqlMaybeUuidText(valueSource, context) + ', ' + this._appendValueParenthesis(value, context, 'int', 'int', typeAdapter, false) + ' + 1)'
            }
        }
        // Pre-2025 `substring()` has no 2-argument form, so "to the end" is spelled with a
        // max-int length. `len(x) - value` would be wrong twice over: `len()` drops trailing
        // blanks (amputating them from the result), and it goes negative once the start index
        // runs past the end, which SQL Server rejects outright instead of answering ''.
        // Both arms must agree with the >= 17_000_000 arm above on the VALUE, not just be
        // valid SQL.
        if (typeof value === 'number') {
            return 'substring(' + this._appendSqlMaybeUuidText(valueSource, context) + ', ' + this._appendValue(value + 1, context, 'int', 'int', typeAdapter, false) + ', 2147483647)'
        } else {
            return 'substring(' + this._appendSqlMaybeUuidText(valueSource, context) + ', ' + this._appendValueParenthesis(value, context, 'int', 'int', typeAdapter, false) + ' + 1, 2147483647)'
        }
    }
    override _substringToEnd(context: SqlBuildContext, valueSource: ToSql, value: any, _columnType: ValueType, _columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // `String.prototype.substring` clamps a negative index to 0 rather than counting from
        // the end, so the clamp lands before the `+ 1` and the SQL is a plain start-of-string.
        if (typeof value === 'number' && value < 0) {
            value = 0
        }
        if (this._connectionConfiguration.compatibilityVersion >= 17_000_000) {
            if (typeof value === 'number') {
                return 'substring(' + this._appendSqlMaybeUuidText(valueSource, context) + ', ' + this._appendValue(value + 1, context, 'int', 'int', typeAdapter, false) + ')'
            } else {
                return 'substring(' + this._appendSqlMaybeUuidText(valueSource, context) + ', ' + this._appendValueParenthesis(value, context, 'int', 'int', typeAdapter, false) + ' + 1)'
            }
        }
        // Pre-2025 `substring()` has no 2-argument form, so "to the end" is spelled with a
        // max-int length. `len(x) - value` would be wrong twice over: `len()` drops trailing
        // blanks (amputating them from the result), and it goes negative once the start index
        // runs past the end, which SQL Server rejects outright instead of answering ''.
        // Both arms must agree with the >= 17_000_000 arm above on the VALUE, not just be
        // valid SQL.
        if (typeof value === 'number') {
            return 'substring(' + this._appendSqlMaybeUuidText(valueSource, context) + ', ' + this._appendValue(value + 1, context, 'int', 'int', typeAdapter, false) + ', 2147483647)'
        } else {
            return 'substring(' + this._appendSqlMaybeUuidText(valueSource, context) + ', ' + this._appendValueParenthesis(value, context, 'int', 'int', typeAdapter, false) + ' + 1, 2147483647)'
        }
    }
    override _substr(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, _columnType: ValueType, _columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        value2 = this._clampSubstrCount(value2)
        if (typeof value === 'number' && value < 0) {
            return 'left(right(' + this._appendSqlMaybeUuidText(valueSource, context) + ', ' + this._appendValue(-value, context, 'int', 'int', typeAdapter, false) + '), ' + this._appendValue(value2, context, 'int', 'int', typeAdapter, false) + ')'
        }
        if (typeof value === 'number') {
            return 'substring(' + this._appendSqlMaybeUuidText(valueSource, context) + ', ' + this._appendValue(value + 1, context, 'int', 'int', typeAdapter, false) + ', ' + this._appendValue(value2, context, 'int', 'int', typeAdapter, false) + ')'
        } else {
            return 'substring(' + this._appendSqlMaybeUuidText(valueSource, context) + ', ' + this._appendValueParenthesis(value, context, 'int', 'int', typeAdapter, false) + ' + 1, ' + this._appendValue(value2, context, 'int', 'int', typeAdapter, false) + ')'
        }
    }
    override _substring(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, _columnType: ValueType, _columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'number' && typeof value2 === 'number') {
            // `String.prototype.substring` clamps both indexes to 0 and SWAPS them when
            // start > end, so `substring(2, 0)` is a legal call meaning `substring(0, 2)`.
            const [start, end] = this._clampAndOrderSubstringBounds(value, value2)
            return 'substring(' + this._appendSqlMaybeUuidText(valueSource, context) + ', ' + this._appendValue(start + 1, context, 'int', 'int', typeAdapter, false) + ', ' + this._appendValue(end - start, context, 'int', 'int', typeAdapter, false) + ')'
        }
        if (typeof value === 'number') {
            const start = value < 0 ? 0 : value
            if (start === 0) {
                return 'substring(' + this._appendSqlMaybeUuidText(valueSource, context) + ', 1, ' + this._appendValue(value2, context, 'int', 'int', typeAdapter, false) + ')'
            }
            return 'substring(' + this._appendSqlMaybeUuidText(valueSource, context) + ', ' + this._appendValue(start + 1, context, 'int', 'int', typeAdapter, false) + ', ' + this._appendValue(value2, context, 'int', 'int', typeAdapter, false) + ' - ' + this._appendValue(start, context, 'int', 'int', typeAdapter, false) + ')'
        } else {
            return 'substring(' + this._appendSqlMaybeUuidText(valueSource, context) + ', ' + this._appendValueParenthesis(value, context, 'int', 'int', typeAdapter, false) + ' + 1, ' + this._appendValue(value2, context, 'int', 'int', typeAdapter, false) + ' - ' + this._appendValue(value, context, 'int', 'int', typeAdapter, false) + ')'
        }
    }
    _useForJsonInAggreagteArrayWhenPossible = true
    // SQL Server truncates a fractional scale of round, and its round always takes the scale
    override _roundnTruncatesTheScale = true
    override _appendRoundToInteger(sql: string): string {
        return 'round(' + sql + ', 0)'
    }
    /**
     * The inline aggregated array of a select of objects is the select itself with `for json path`, whose columns are
     * the leaves, converted in place (`_isSelectOfAggregatedArrayValues`). A converted leaf can't be one of its columns
     * when the select would compare or order the converted value instead of the value: a leaf whose conversion doesn't
     * compare like the value (`_needsTheValueOfAggregatedArrayValueToCompare`), or one whose conversion doesn't order
     * like the value (`_needsTheValueOfAggregatedArrayValueToOrder`) named by the order by. The leaves are then written
     * by the library, over the select wrapped when it needs it
     */
    _isForJsonPathAggregatedArray(query: SelectData): boolean {
        return this._useForJsonInAggreagteArrayWhenPossible && !!query.__asInlineAggregatedArrayValue && !query.__oneColumn && query.__type === 'plain' && !this._hasAggregatedArrayValueNeedingTheValue(query)
    }
    _hasAggregatedArrayValueNeedingTheValue(query: SelectData): boolean {
        const columns: FlatQueryColumns = {}
        flattenQueryColumns(query.__columns, columns, '')
        for (const property in columns) {
            if (this._needsTheValueOfAggregatedArrayValueToCompare(columns[property]!)) {
                return true
            }
        }
        const orderBy = query.__orderBy
        if (orderBy) {
            for (const entry of orderBy) {
                const column = typeof entry.expression === 'string' ? columns[entry.expression] : undefined
                if (column && this._needsTheValueOfAggregatedArrayValueToOrder(column)) {
                    return true
                }
            }
        }
        return false
    }
    override _isSelectOfAggregatedArrayValues(query: SelectData): boolean {
        return this._isForJsonPathAggregatedArray(query)
    }
    override _buildSelectAsAggregatedArray(query: SelectData, _context: SqlBuildContext): string {
        if (this._isForJsonPathAggregatedArray(query)) {
            return ' for json path'
        }
        return ''
    }
    override _needAggregateArrayColumnsTransformation(query: SelectData, _context: SqlBuildContext): boolean {
        if (!query.__asInlineAggregatedArrayValue) {
            return false
        }
        return !this._isForJsonPathAggregatedArray(query)
    }
    override _needAggregateArrayWrapper(query: SelectData, context: SqlBuildContext): boolean {
        if (this._isForJsonPathAggregatedArray(query)) {
            return false
        }
        return super._needAggregateArrayWrapper(query, context)
    }
    override _appendAggregateArrayWrapperBegin(query: SelectData, context: SqlBuildContext, aggregateId: number): string {
        if (this._useForJsonInAggreagteArrayWhenPossible && query.__type === 'compound' && !query.__oneColumn) {
            const columns = query.__columns
            let requireComma = false
            let result = ''
            for (const property in columns) {
                if (requireComma) {
                    result += ', '
                }
                // Over the compound, whose arms compare the values: a converted leaf is a text, a string for FOR JSON
                const column = columns[property]!
                const leaf = 'a_' + aggregateId + '_.' + this._escape(property, true)
                result += isValueSource(column) ? this._appendAggregatedArrayValueProjection(column, leaf, context) : leaf
                if (property) {
                    result += ' as ' + this._appendColumnAlias(property, context)
                }
                requireComma = true
            }
            return 'select ' + result + ' from ('
        }
        return super._appendAggregateArrayWrapperBegin(query, context, aggregateId)
    }
    override _appendAggregateArrayWrapperEnd(query: SelectData, context: SqlBuildContext, aggregateId: number): string {
        if (this._useForJsonInAggreagteArrayWhenPossible && query.__type === 'compound' && !query.__oneColumn) {
            let result =  ')'
            if (this._supportTableAliasWithAs) {
                result += ' as '
            } else {
                result += ' '
            }
            result += 'a_' + aggregateId + '_'
            if (query.__orderBy && query.__orderBy.length > 0) {
                // The order by of the compound, inside the derived table, chooses the rows of its offset and fetch, but
                // doesn't order the select that reads it: the JSON is written in the order of this select
                const oldSafeTableOrView = context.safeTableOrView
                const oldOrderByOnWrapper = context.orderByOnWrapper
                this._setSafeTableOrView(context, undefined)
                context.orderByOnWrapper = true
                result += this._buildSelectOrderByForWrapper(query, context)
                context.orderByOnWrapper = oldOrderByOnWrapper
                this._setSafeTableOrView(context, oldSafeTableOrView)
            }
            result += ' for json path'
            return result
        }
        return super._appendAggregateArrayWrapperEnd(query, context, aggregateId)
    }
    _useJsonAggregatesWhenPossible(): boolean {
        return this._connectionConfiguration.compatibilityVersion >= 17_000_000
    }
    override _appendAggregateArrayColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayDistinct: boolean, context: SqlBuildContext, _query: SelectData | undefined): string {
        if (this._useJsonAggregatesWhenPossible() && !aggregatedArrayDistinct) {
            if (isValueSource(aggregatedArrayColumns)) {
                return 'json_arrayagg(' + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, this._appendSql(aggregatedArrayColumns, context, false), context) + ' null on null)'
            }
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')
            let jsonObject = ''
            for (const prop in columns) {
                if (jsonObject) {
                    jsonObject += ', '
                }
                jsonObject += "'" + prop + "':" + this._appendAggregatedArrayValueProjection(columns[prop]!, this._appendSql(columns[prop]!, context, false), context)
            }
            return 'json_arrayagg(json_object(' + jsonObject + '))'
        }
        // T-SQL's STRING_AGG and JSON_ARRAYAGG do not accept the DISTINCT
        // quantifier in any version, so the SQL emitted below for the
        // distinct branch (`string_agg(distinct ...)` / `json_arrayagg(distinct ...)`)
        // is rejected by the engine at execution time. We deliberately
        // keep emitting it and let the database surface the error rather
        // than failing in the builder: the library does not perform
        // dialect-specific syntactic validation. Consumers needing
        // distinct aggregation on SQL Server should pre-deduplicate via
        // a subquery (`subSelectUsing(...).distinct().select(...).forUseAsInlineAggregatedArrayValue()`).
        const distict = aggregatedArrayDistinct ? 'distinct ' : ''
        if (isValueSource(aggregatedArrayColumns)) {
            return "concat('[', string_agg(" + distict + this._appendJsonValueForAggregate(aggregatedArrayColumns, context) + ", ','), ']')"
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += `, ', "`+ prop + `": ', ` + this._appendJsonValueForAggregate(columns[prop]!, context)
                } else {
                    result += `'"`+ prop + `": ', ` + this._appendJsonValueForAggregate(columns[prop]!, context)
                }
            }

            return `concat('[', string_agg(` + distict + `concat('{', ` + result + `, '}'), ','), ']')`
        }
    }
    _appendJsonValueForAggregate(valueSource: AnyValueSource, context: SqlBuildContext): string {
        return this._appendJsonValue(valueSource, this._appendSql(valueSource, context, false), context)
    }
    /** A leaf of the JSON written by the library, as JSON text: `sql` is the value */
    _appendJsonValue(valueSource: AnyValueSource, sql: string, context: SqlBuildContext): string {
        const valueSourcePrivate = __getValueSourcePrivate(valueSource)
        const type = valueSourcePrivate.__valueType

        let result: string

        if (this._isConvertedAggregatedArrayValue(valueSource)) {
            // The text of the type adapter (or of the connection), as a JSON string
            result = 'convert(nvarchar(max), ' + this._appendAggregatedArrayValueProjection(valueSource, sql, context) + ')'
            result = 'string_escape(' + result + ", 'json')"
            result = `'"' + ` + result + ` + '"'`
        } else switch(type) {
        // A number leaf is converted with room for any decimal(38): 38 digits, the sign, the point and a leading
        // zero. The length-less convert defaults to nvarchar(30), and a custom number type mapped to a wide decimal
        // column overflows it
        case 'boolean':
        case 'int':
            result = 'convert(nvarchar(41), ' + sql + ')'
            break
        case 'double':
            // FINDING B: this manual `string_agg` JSON builder (SQL Server compat < 17M) is the
            // one path where the DB itself truncates a `float` before the JSON is even formed —
            // a styleless convert keeps only ≤6 significant figures. Style 3 is the only convert
            // style that round-trips a float exactly. It emits scientific notation, a valid
            // (unquoted) JSON number, so the lossless number parser preserves the digits.
            result = 'convert(nvarchar(41), ' + sql + ', 3)'
            break
        case 'bigint':
        case 'customInt':
        case 'customBigint':
        case 'stringDecimal':
        case 'customDecimal':
            result = `'"' + convert(nvarchar(41), ` + sql + `) + '"'`
            break
        case 'customDouble':
            // A quoted float leaf: the same lossless style-3 form as `double` (finding B).
            result = `'"' + convert(nvarchar(41), ` + sql + `, 3) + '"'`
            break
        case 'uuid':
        case 'customUuid':
            // A uniqueidentifier's text form is 36 chars; the length-less
            // convert defaults to nvarchar(30) and overflows. nvarchar(36)
            // matches the upper-cased representation native FOR JSON emits.
            result = `'"' + convert(nvarchar(36), ` + sql + `) + '"'`
            break
        case 'string':
        case 'aggregatedArray':
            // Strings are unbounded; the length-less convert defaults to
            // nvarchar(30) and truncates. nvarchar(max) preserves the value.
            result = 'convert(nvarchar(max), ' + sql + ')'
            result = 'string_escape(' + result + ", 'json')"
            result = `'"' + ` + result + ` + '"'`
            break
        case 'localDate':
        case 'localTime':
        case 'localDateTime':
        case 'customLocalDate':
        case 'customLocalTime':
        case 'customLocalDateTime':
            result = 'convert(nvarchar, ' + sql + ', 127)'
            result = `'"' + ` + result + ` + '"'`
            break
        default:
            result = 'convert(nvarchar(max), ' + sql + ')'
            result = 'string_escape(' + result + ", 'json')"
            result = `'"' + ` + result + ` + '"'`
        }

        if (valueSourcePrivate.__optionalType !== 'required') {
            result = `isnull(` + result + `, 'null')`
        }

        return result
    }
    override _appendAggregateArrayWrappedColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, context: SqlBuildContext, aggregateId: number): string {
        if (this._useJsonAggregatesWhenPossible()) {
            if (isValueSource(aggregatedArrayColumns)) {
                return 'json_arrayagg(' + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, 'a_' + aggregateId + '_.' + this._escape('result', true), context) + ' null on null)'
            }
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')
            let jsonObject = ''
            for (const prop in columns) {
                if (jsonObject) {
                    jsonObject += ', '
                }
                jsonObject += "'" + prop + "':" + this._appendAggregatedArrayValueProjection(columns[prop]!, 'a_' + aggregateId + '_.' + this._escape(prop, true), context)
            }
            return 'json_arrayagg(json_object(' + jsonObject + '))'
        }
        if (isValueSource(aggregatedArrayColumns)) {
            return "concat('[', string_agg(" + this._appendJsonValueForWrappedAggregate('result', aggregatedArrayColumns, context, aggregateId) + ", ','), ']')"
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += `, ', "`+ prop + `": ', ` + this._appendJsonValueForWrappedAggregate(prop, columns[prop]!, context, aggregateId)
                } else {
                    result += `'"`+ prop + `": ', ` + this._appendJsonValueForWrappedAggregate(prop, columns[prop]!, context, aggregateId)
                }
            }

            return `concat('[', string_agg(concat('{', ` + result + `, '}'), ','), ']')`
        }
    }
    _appendJsonValueForWrappedAggregate(prop: string, valueSource: AnyValueSource, context: SqlBuildContext, aggregateId: number): string {
        return this._appendJsonValue(valueSource, 'a_' + aggregateId + '_.' + this._escape(prop, true), context)
    }
    override _appendFragmentParam(value: AnyValueSource, context: SqlBuildContext): string {
        if (__getValueSourcePrivate(value).__uuidString) {
            // The SQL around it is the user's: the text of the uuid is written as it leaves the database
            return this._uuidAsText(this._appendConditionSql(value, context, false))
        }
        return this._appendConditionSql(value, context, false)
    }
    override _appendRawFragmentParam(value: AnyValueSource | IExecutableSelectQuery<any, any, any>, context: SqlBuildContext): string {
        if (isValueSource(value) && __getValueSourcePrivate(value).__uuidString) {
            return this._uuidAsText(this._appendSql(value, context, false))
        }
        return this._appendSql(value, context, false)
    }
}
