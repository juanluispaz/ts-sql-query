import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import { mySqlMariaDBOperationsThatNeedParenthesis } from '../utils/mySqlMariaDB/mySqlMariaDBOperationsThatNeedParenthesis.js'
import type { ToSql, SqlOperation, SelectData, InsertData, UpdateData, DeleteData, FlatQueryColumns, OrderByEntry, PlainSelectData } from './SqlBuilder.js'
import { getQueryColumn, flattenQueryColumns } from './SqlBuilder.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import type { AnyValueSource, IAnyBooleanValueSource, __AggregatedArrayColumns, ValueType } from '../expressions/values.js'
import { isValueSource } from '../expressions/values.js'
import { AbstractSqlBuilder, type SelectColumnSql } from './AbstractSqlBuilder.js'
import { __getValueSourcePrivate } from '../expressions/values.js'
import type { DBColumn } from '../utils/Column.js'
import { isColumn, __getColumnPrivate } from '../utils/Column.js'
import type { AnyTableOrView } from '../utils/ITableOrView.js'
import { __getTableOrViewPrivate } from '../utils/ITableOrView.js'
import { SqlOperation1ValueSource, SqlOperation1ValueSourceIfValueOrIgnore } from '../internal/ValueSourceImpl.js'
import { TsSqlProcessingError } from '../TsSqlError.js'

export class AbstractMySqlMariaDBSqlBuilder extends AbstractSqlBuilder {
    override _buildSelectWithColumnsInfoForCompound(query: SelectData, context: SqlBuildContext, columnsForInsert: { [name: string]: DBColumn | undefined }, isOutermostQuery: boolean, needsGrouping: boolean): string {
        if (needsGrouping) {
            // MySQL 5.7 and MariaDB 10.3 don't accept a compound in parentheses as an operand of another one
            return 'select * from (' + this._buildSelectWithColumnsInfo(query, context, columnsForInsert, isOutermostQuery) + ') as _t_' + context.generateUnique() + '_'
        }
        return super._buildSelectWithColumnsInfoForCompound(query, context, columnsForInsert, isOutermostQuery, needsGrouping)
    }
    override _operationsThatNeedParenthesis = mySqlMariaDBOperationsThatNeedParenthesis
    /**
     * Compatibility version from which the engine accepts DOUBLE as a cast target
     * (MySQL 8.0.17, MariaDB 10.4.0). Below it, `_appendCastAsDouble` falls back to a
     * multiplication by an approximate literal.
     */
    _castAsDoubleMinCompatibilityVersion: number = Number.POSITIVE_INFINITY
    override _buildSelectGroupBy(query: PlainSelectData, context: SqlBuildContext, isOutermostQuery: boolean, selectColumnsSql?: Map<AnyValueSource, SelectColumnSql> | undefined): string {
        if (selectColumnsSql) {
            // In a having, MySQL and MariaDB resolve a name to a column of the group by written as a bare column
            // before the alias of the select: when they are different values, the alias would silently filter by
            // that column. The column of the select is marked to be written as its expression instead
            const groupBy = query.__groupBy
            for (let i = 0, length = groupBy.length; i < length; i++) {
                const entry = groupBy[i]!
                if (!isColumn(entry)) {
                    continue
                }
                const entryPrivate = __getColumnPrivate(entry)
                const entryName = entryPrivate.__name.toLowerCase()
                selectColumnsSql.forEach((selectColumn, column) => {
                    if (selectColumn.name.toLowerCase() !== entryName) {
                        return
                    }
                    if (isColumn(column)) {
                        const columnPrivate = __getColumnPrivate(column)
                        if (columnPrivate.__name === entryPrivate.__name && columnPrivate.__tableOrView === entryPrivate.__tableOrView) {
                            // The column of the select is that same column
                            return
                        }
                    }
                    selectColumn.shadowedByGroupByColumn = true
                })
            }
        }
        return super._buildSelectGroupBy(query, context, isOutermostQuery, selectColumnsSql)
    }
    override _appendHavingCondition(having: IAnyBooleanValueSource<any, any>, context: SqlBuildContext): string {
        // In a having, MySQL and MariaDB resolve a bare name to an alias of the select before a column of the table
        // that isn't grouped: the columns of the tables are written with the table name, so they never take an alias
        const oldSafeTableOrView = context.safeTableOrView
        this._setSafeTableOrView(context, undefined)
        const result = super._appendHavingCondition(having, context)
        this._setSafeTableOrView(context, oldSafeTableOrView)
        return result
    }
    override _appendSelectColumnReference(column: AnyValueSource, context: SqlBuildContext): string {
        const selectColumn = context.selectColumnsSql?.get(column)
        if (!selectColumn) {
            // Written as the expression: the parenthesis _needParenthesis leaves out for the alias
            return this._appendSqlParenthesis(column, context, false)
        }
        if (selectColumn.shadowedByGroupByColumn) {
            // Its alias names a different column of the group by: written as the expression, which these databases
            // resolve against the columns of the group by
            return this._appendSqlParenthesis(column, context, false)
        }
        return this._appendSelectColumnReferenceSql(selectColumn, context)
    }
    override _needParenthesis(value: any): boolean {
        if (value && value.__selectColumnReference) {
            // A column of the select referred to in a having is written as its alias
            return false
        }
        return super._needParenthesis(value)
    }
    override _needParenthesisExcluding(value: any, excluding: keyof SqlOperation): boolean {
        if (value && value.__selectColumnReference) {
            // A column of the select referred to in a having is written as its alias
            return false
        }
        return super._needParenthesisExcluding(value, excluding)
    }
    override _appendSelectColumnReferenceSql(selectColumn: SelectColumnSql, context: SqlBuildContext): string {
        // In a having, a column outside an aggregate can only be referred to by its alias (written again, the
        // expression refers to columns that aren't grouped as they are: unknown column)
        return this._appendColumnAlias(selectColumn.name, context)
    }
    override _forceAsIdentifier(identifier: string): string {
        return '`' + identifier + '`'
    }
    // MySQL / MariaDB accept both `lower(col)` and `col collate <name>` as
    // ORDER BY terms of a compound query, so the insensitive ordering is
    // emitted inline and never needs the `select * from (...)` wrapper.
    override _supportFunctionInCompoundOrderBy(): boolean {
        return true
    }
    override _supportCollateInCompoundOrderBy(): boolean {
        return true
    }
    override _supportOrderByColumnAliasInExpression(): boolean {
        // Inside an expression of the order by, MySQL and MariaDB take a column of the from with the same name before
        // the alias
        return false
    }
    override _appendOrderBySelectColumnWithParams(_selectColumn: SelectColumnSql, entry: OrderByEntry, query: SelectData, context: SqlBuildContext): string {
        // A parameter can't be repeated (each `?` is a new one): the expression is written again, with new parameters
        return this._appendOrderByColumnSourceAsInSelect(entry, query, context)
    }
    /**
     * Whether the ordering of the entry wraps the column in an expression: the null check that emulates `nulls first`
     * / `nulls last`, or the insensitive `lower(...)` / `collate`
     */
    _isOrderByColumnInExpression(entry: OrderByEntry, query: SelectData): boolean {
        switch (entry.order) {
            case 'asc nulls last':
            case 'desc nulls first':
            case 'asc nulls last insensitive':
            case 'desc nulls first insensitive':
                return true
            case 'insensitive':
            case 'asc insensitive':
            case 'desc insensitive':
            case 'asc nulls first insensitive':
            case 'desc nulls last insensitive':
                return this._connectionConfiguration.insensitiveCollation !== '' && this._isStringOrderByColumn(entry, query)
            default:
                return false
        }
    }
    override _buildSelectOrderBy(query: SelectData, context: SqlBuildContext): string {
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

            if (!orderByColumns) {
                return ''
            }
            return ' order by ' + orderByColumns
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
                    orderByColumns += this._appendOrderByColumnForExpression(entry, query, context) + ' is null, ' + this._appendOrderByColumnAlias(entry, query, context) + ' asc'
                    break
                case 'desc nulls first':
                    orderByColumns += this._appendOrderByColumnForExpression(entry, query, context) + ' is not null, ' + this._appendOrderByColumnAlias(entry, query, context) + ' desc'
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
                    // Only the sort term is folded: the `is null` operand is a boolean
                    // nulls-ordering emulation, so lowercasing it would be pointless work.
                    orderByColumns += this._appendOrderByColumnForExpression(entry, query, context) + ' is null, ' + this._appendOrderByColumnAliasInsensitive(entry, query, context) + ' asc'
                    break
                case 'desc nulls first insensitive':
                    orderByColumns += this._appendOrderByColumnForExpression(entry, query, context) + ' is not null, ' + this._appendOrderByColumnAliasInsensitive(entry, query, context) + ' desc'
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
    _buildAggregateArrayOrderBy(query: SelectData, context: SqlBuildContext, addSpace: boolean): string {
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

            if (!orderByColumns) {
                return ''
            }
            return ' order by ' + orderByColumns
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
                orderByColumns += this._appendOrderByColumnExpression(entry, query, context)
            } else switch (order) {
                case 'asc':
                case 'asc nulls first':
                    orderByColumns += this._appendOrderByColumnExpression(entry, query, context) + ' asc'
                    break
                case 'desc':
                case 'desc nulls last':
                    orderByColumns += this._appendOrderByColumnExpression(entry, query, context) + ' desc'
                    break
                case 'asc nulls last':
                    orderByColumns += this._appendOrderByColumnExpression(entry, query, context) + ' is null, ' + this._appendOrderByColumnExpression(entry, query, context) + ' asc'
                    break
                case 'desc nulls first':
                    orderByColumns += this._appendOrderByColumnExpression(entry, query, context) + ' is not null, ' + this._appendOrderByColumnExpression(entry, query, context) + ' desc'
                    break
                case 'insensitive':
                    orderByColumns += this._appendOrderByColumnExpressionInsensitive(entry, query, context)
                    break
                case 'asc insensitive':
                case 'asc nulls first insensitive':
                    orderByColumns += this._appendOrderByColumnExpressionInsensitive(entry, query, context) + ' asc'
                    break
                case 'desc insensitive':
                case 'desc nulls last insensitive':
                    orderByColumns += this._appendOrderByColumnExpressionInsensitive(entry, query, context) + ' desc'
                    break
                case 'asc nulls last insensitive':
                    orderByColumns += this._appendOrderByColumnExpression(entry, query, context) + ' is null, ' + this._appendOrderByColumnExpressionInsensitive(entry, query, context) + ' asc'
                    break
                case 'desc nulls first insensitive':
                    orderByColumns += this._appendOrderByColumnExpression(entry, query, context) + ' is not null, ' + this._appendOrderByColumnExpressionInsensitive(entry, query, context) + ' desc'
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
        if (addSpace) {
            return ' order by ' + orderByColumns
        } else {
            return 'order by ' + orderByColumns
        }
    }
    _appendOrderByColumnExpressionInsensitive(entry: OrderByEntry, query: SelectData, context: SqlBuildContext): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        const expression = entry.expression
        const stringColumn = this._isStringOrderByColumn(entry, query)
        if (stringColumn && collation) {
            if (typeof expression === 'string') {
                const column = getQueryColumn(query.__columns, expression)
                if (!column) {
                    throw new TsSqlProcessingError({ reason: 'ORDER_BY_COLUMN_NOT_IN_SELECT', column: expression }, 'Column ' + expression + ' included in the order by not found in the select clause')
                }
                return this._appendSqlParenthesis(column, context, false) + ' collate ' + collation
            } else if (isValueSource(expression)) {
                return this._appendSqlParenthesis(expression, context, false) + ' collate ' + collation
            }
        }
        return this._appendOrderByColumnExpression(entry, query, context)
    }
    override _buildSelectLimitOffset(query: SelectData, context: SqlBuildContext): string {
        let result = ''

        const limit = query.__limit
        if (limit !== null && limit !== undefined) {
            result += ' limit ' + this._appendValue(limit, context, 'int', 'int', undefined, false)
        }

        const offset = query.__offset
        if (offset !== null && offset !== undefined) {
            if (!result) {
                // MySQL/MariaDB don't accept an offset without a limit, so put the max value of an int
                result += ' limit 2147483647'
            }
            result += ' offset ' + this._appendValue(offset, context, 'int', 'int', undefined, false)
        }

        if (!result && context.aggregateArrayWrapped && (query.__orderBy || query.__customization?.beforeOrderByItems || query.__customization?.afterOrderByItems)) {
            // Without a limit MySQL/MariaDB ignore the order by of a derived table, so the aggregated
            // array comes out unordered (still the case on MySQL 26.10 and MariaDB 13.0); the number is
            // the max value of an int.
            result += ' limit 2147483647'
        }
        return result
    }
    override _buildInsertDefaultValues(query: InsertData, context: SqlBuildContext): string {
        this._ensureRootQuery(query, context)
        const customization = query.__customization
        let insertQuery = ''
        if (customization && customization.beforeQuery) {
            insertQuery += this._appendRawFragment(customization.beforeQuery, context) + ' '
        }
        insertQuery += 'insert '
        if (customization && customization.afterInsertKeyword) {
            insertQuery += this._appendRawFragment(customization.afterInsertKeyword, context) + ' '
        }
        insertQuery += this._buildInsertOnConflictBeforeInto(query, context)
        insertQuery += 'into ' + this._appendTableOrViewName(query.__table, context) + ' () values ()'
        insertQuery += this._buildInsertOnConflictBeforeReturning(query, context)
        insertQuery += this._buildInsertReturning(query, context)
        if (customization && customization.afterQuery) {
            insertQuery += ' ' + this._appendRawFragment(customization.afterQuery, context)
        }
        this._resetRootQuery(query, context)
        return insertQuery
    }
    override _buildInsertOutput(_query: InsertData, _context: SqlBuildContext): string {
        return ''
    }
    override _buildInsertOnConflictBeforeInto(query: InsertData, _context: SqlBuildContext): string {
        // `insert ignore` covers both an explicit `onConflictDoNothing()` and an
        // on-conflict `do update` whose assignment list resolved to no columns:
        // MariaDB/MySQL have no empty `on duplicate key update`, and `insert
        // ignore` is the same conflict-skipping no-op. The matching
        // `on duplicate key update` clause is then omitted (see
        // `_buildInsertOnConflictBeforeReturning` below, which returns '' when
        // the assignment list is empty).
        if (query.__onConflictDoNothing || this._isInsertOnConflictUpdateSetEmpty(query)) {
            return 'ignore '
        }

        return ''
    }
    override _buildInsertOnConflictBeforeReturning(query: InsertData, context: SqlBuildContext): string {
        // MariaDB/MySQL emit the same shape-aware assignment list as the base
        // `do update set`, just under a different keyword and with no conflict
        // target or `where` clause.
        const columns = this._buildInsertOnConflictUpdateSetColumns(query, context)
        if (columns) {
            return ' on duplicate key update ' + columns
        } else {
            return ''
        }
    }
    override _appendRawColumnNameForValuesForInsert(column: DBColumn, _context: SqlBuildContext): string {
        const columnPrivate = __getColumnPrivate(column)
        return 'values(' + this._escape(columnPrivate.__name, true) + ')'
    }
    override _appendColumnNameForUpdate(column: DBColumn, context: SqlBuildContext) {
        return this._appendRawColumnName(column, context)
    }
    override _buildAfterUpdateTable(query: UpdateData, context: SqlBuildContext): string {
        const result = this._buildFromJoins(query.__froms, query.__joins, undefined, context)
        if (!result) {
            return ''
        }
        if (query.__froms && query.__froms.length > 0) {
            return ', ' + result
        }
        return result
    }
    // MySQL/MariaDB use comma-separated joins after the target table (emitted via
    // `_buildAfterUpdateTable`), not the standard `FROM <joins>` clause; neither
    // engine supports the PostgreSQL-style `FROM (subquery)` trick used by the
    // abstract builder to capture old values. Return `false` so the abstract
    // skips the `_new_` aliasing of the target table (which only makes sense when
    // paired with that subquery) and the unused `requiredTables`/`requiredColumns`
    // computation. MariaDB 13.0.1+ uses the native `OLD_VALUE(col)` function for
    // old-value references instead, handled in `MariaDBSqlBuilder`.
    override _useUpdateOldValueInFrom(): boolean {
        return false
    }
    override _buildUpdateFrom(_query: UpdateData, _updatePrimaryKey: boolean, _requiredTables: Set<AnyTableOrView> | undefined, _requiredColumns: Set<DBColumn> | undefined, _context: SqlBuildContext): string {
        return ''
    }
    override _buidDeleteUsing(query: DeleteData, context: SqlBuildContext): string {
        const result = this._buildFromJoins(query.__using, query.__joins, undefined, context)
        if (result) {
            if (query.__using && query.__using.length > 0) {
                return ' using ' + this._appendTableOrViewName(query.__table, context) + ', ' + result
            }
            return ' using ' + this._appendTableOrViewName(query.__table, context) + result
        }
        return ''
    }
    override _is(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, context) + ' <=>' + this._appendRawColumnName(value, context)
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' <=> ' + this._appendValueParenthesis(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value))
    }
    override _isNot(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return 'not (' + this._appendRawColumnName(valueSource, context) + ' <=> ' + this._appendRawColumnName(value, context) + ')'
        }
        return 'not (' + this._appendSqlParenthesis(valueSource, context, false) + ' <=> ' + this._appendValueParenthesis(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ')'
    }
    override _appendCastAsDouble(sql: string): string {
        if (this._connectionConfiguration.compatibilityVersion >= this._castAsDoubleMinCompatibilityVersion) {
            return 'cast(' + sql + ' as double)'
        }
        // Older engines have no DOUBLE cast target. Multiplying by an approximate literal
        // promotes the value to DOUBLE: the exponent marker is what makes the literal
        // approximate — written `* 1.0` it is an exact literal (DECIMAL) and the value
        // stays DECIMAL, truncated to div_precision_increment decimals on any later division.
        return '(' + sql + ' * 1.0e0)'
    }
    override _appendCastAsInteger(sql: string): string {
        // MySQL / MariaDB reject `cast(x as bigint)`; SIGNED is how they spell a
        // 64 bits signed integer in a cast.
        return 'cast(' + sql + ' as signed)'
    }
    /**
     * MySQL / MariaDB round exact-value numbers (DECIMAL) breaking ties away from zero —
     * the rule every dialect the library supports follows — but round approximate-value
     * numbers (DOUBLE) by deferring to the C library, which rounds half to even on the
     * usual platforms: `round(0.5e0)` is `0` and `round(2.5e0)` is `2`. Any operand
     * reaching here through `_divide` or `_asDouble` is a DOUBLE, so the operand is cast
     * back to an exact type to keep the tie-breaking rule portable and independent of what
     * came before it in the chain.
     */
    _appendRoundOperandAsExact(context: SqlBuildContext, valueSource: ToSql): string {
        const sql = this._appendSql(valueSource, context, false)
        if (this._connectionConfiguration.usePlatformDependentRound) {
            return sql
        }
        if (this._numericKindOf(valueSource) === 'exact') {
            // An exact operand already rounds away from zero, and an integer one has no tie
            // to break at all: casting it would only add noise to the query.
            return sql
        }
        return 'cast(' + sql + ' as decimal(65, 30))'
    }
    override _round(context: SqlBuildContext, valueSource: ToSql): string {
        return 'round(' + this._appendRoundOperandAsExact(context, valueSource) + ')'
    }
    override _roundn(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'round(' + this._appendRoundOperandAsExact(context, valueSource) + ', ' + this._appendValue(value, context, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false) + ')'
    }
    override _valueWhenNull(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'ifnull(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ')'
    }
    override _escapeLikeWildcard(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (typeof value === 'string') {
            value = value.replace(/\\/g, '\\\\')
            value = value.replace(/%/g, '\\%')
            value = value.replace(/_/g, '\\_')
            return this._appendValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast)
        } else {
            return "replace(replace(replace(" + this._appendValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast) + ", '\\\\', '\\\\\\\\'), '%', '\\\\%'), '_', '\\\\_')"
        }
    }
    override _escapeRegexpForReplace(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (typeof value === 'string') {
            return this._appendValue(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), context, columnType, columnTypeName, typeAdapter, forceTypeCast)
        }
        // MySQL/MariaDB treat backslash as an escape inside string literals, so a single
        // backslash is written `'\\'` (two in the SQL text) — the same doubling
        // `_escapeLikeWildcard` does above. Escape the term's backslashes first, then prefix
        // every other regex metacharacter with one.
        let sql = this._appendValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast)
        sql = "replace(" + sql + ", '\\\\', '\\\\\\\\')"
        const metachars = '.*+?^${}()|[]'
        for (let i = 0, length = metachars.length; i < length; i++) {
            const ch = metachars[i]!
            sql = "replace(" + sql + ", '" + ch + "', '\\\\" + ch + "')"
        }
        return sql
    }
    override _escapeRegexpReplacement(value: any, context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        // MariaDB (like PostgreSQL) treats only the backslash as a replacement metacharacter.
        // The JS-literal escape matches the base (the escaped term is bound as a param, so it
        // has no string-literal quirk); only the value-source path needs MySQL/MariaDB's
        // backslash doubling inside a string literal (see `_escapeRegexpForReplace`).
        if (typeof value === 'string') {
            return this._appendValue(value.replace(/\\/g, '\\\\'), context, columnType, columnTypeName, typeAdapter, forceTypeCast)
        }
        return "replace(" + this._appendValue(value, context, columnType, columnTypeName, typeAdapter, forceTypeCast) + ", '\\\\', '\\\\\\\\')"
    }
    override _replaceAllInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        // MySQL/MariaDB `REPLACE` ignores collation, so fold case with `REGEXP_REPLACE`, whose
        // operands' collation governs the match (case + accent). The default collation is already
        // case-insensitive; when `insensitiveCollation` names one, force it on the source and the
        // (regex-escaped) search term. `REGEXP_REPLACE` needs MySQL 8.0+ / MariaDB 10.0.5+.
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return 'regexp_replace(' + this._appendSqlParenthesis(valueSource, context, false) + ' collate ' + collation + ', ' + this._escapeRegexpForReplace(value, context, columnType, columnTypeName, typeAdapter, false) + ' collate ' + collation + ', ' + this._escapeRegexpReplacement(value2, context, columnType, columnTypeName, typeAdapter, false) + ')'
        }
        return 'regexp_replace(' + this._appendSql(valueSource, context, false) + ', ' + this._escapeRegexpForReplace(value, context, columnType, columnTypeName, typeAdapter, false) + ', ' + this._escapeRegexpReplacement(value2, context, columnType, columnTypeName, typeAdapter, false) + ')'
    }
    // This dialect family has no `||` operator by default (`PIPES_AS_CONCAT` is not
    // assumed): concatenation is the n-ary `concat(...)` function. It stands alone, so the
    // pattern needs no wrapping parenthesis, and the insensitive arm folds the term inside
    // the call rather than folding the whole pattern.
    override _likePatternStartingWith(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, fold: boolean): string {
        const term = this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false)
        return fold ? 'concat(lower(' + term + "), '%')" : 'concat(' + term + ", '%')"
    }
    override _likePatternEndingWith(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, fold: boolean): string {
        const term = this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false)
        return fold ? "concat('%', lower(" + term + '))' : "concat('%', " + term + ')'
    }
    override _likePatternContaining(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, fold: boolean): string {
        const term = this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false)
        return fold ? "concat('%', lower(" + term + "), '%')" : "concat('%', " + term + ", '%')"
    }
    override _startsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like concat(' +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ", '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like concat(' +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ", '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') like concat(lower(' +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + "), '%')"
        }
    }
    override _notStartsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like concat(' +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ", '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like concat(' +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ", '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') not like concat(lower(' +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + "), '%')"
        }
    }
    override _endsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + " like concat('%', " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + " like concat('%', " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ") like concat('%', lower(" +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + '))'
        }
    }
    override _notEndsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + " not like concat('%', " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + " not like concat('%', " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ") not like concat('%', lower(" +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + '))'
        }
    }
    override _containsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + " like concat('%', " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ", '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + " like concat('%', " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ", '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ") like concat('%', lower(" +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + "), '%')"
        }
    }
    override _notContainsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + " not like concat('%', " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ", '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + " not like concat('%', " +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + ", '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ") not like concat('%', lower(" +  this._escapeLikeWildcard(value, context, columnType, columnTypeName, typeAdapter, false) + "), '%')"
        }
    }
    // `substr()` with a negative start does not count from the end on this dialect, and where
    // it does the out-of-range case still diverges from JS. `right()` / `left()` are exactly
    // `String.prototype.substr`'s negative-start semantics, clamp included. Only the negative
    // arms are overridden; the rest of the family is the base's.
    override _substrToEnd(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'number' && value < 0) {
            return 'right(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(-value, context, 'int', 'int', typeAdapter, false) + ')'
        }
        return super._substrToEnd(context, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _substr(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        value2 = this._clampSubstrCount(value2)
        if (typeof value === 'number' && value < 0) {
            return 'left(right(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(-value, context, 'int', 'int', typeAdapter, false) + '), ' + this._appendValue(value2, context, 'int', 'int', typeAdapter, false) + ')'
        }
        return super._substr(context, valueSource, value, value2, columnType, columnTypeName, typeAdapter)
    }
    override _length(context: SqlBuildContext, valueSource: ToSql): string {
        // On this dialect family `length()` counts BYTES, not characters: it answers 5 for
        // 'café' and 6 for '日本' under utf8mb4. `char_length()` is the character-counting
        // one, and `.length()` mirrors JS's `String.length`, so characters is the contract.
        // Do not "simplify" this override away — the base's `length()` is the byte one here.
        return 'char_length(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _concat(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        let result = 'concat('
        if (isValueSource(valueSource)) {
            result += this._appendMaybeInnerConcat(valueSource, context)
        } else {
            result += this._appendSql(valueSource, context, false)
        }
        result += ', '
        if (isValueSource(value)) {
            result += this._appendMaybeInnerConcat(value, context)
        } else {
            result += this._appendValue(value, context, columnType, columnTypeName, typeAdapter, false)
        }
        result += ')'
        return result
    }
    _appendMaybeInnerConcat(valueSource: AnyValueSource, context: SqlBuildContext): string {
        if (valueSource instanceof SqlOperation1ValueSource && valueSource.__operation === '_concat') {
            let result = this._appendMaybeInnerConcat(valueSource.__valueSource, context)
            const value = valueSource.__value
            result += ', '
            if (isValueSource(value)) {
                result += this._appendMaybeInnerConcat(value, context)
            } else {
                result += this._appendValue(value, context, valueSource.__valueType, valueSource.__valueTypeName, valueSource.__typeAdapter, false)
            }
            return result
        }
        if (valueSource instanceof SqlOperation1ValueSourceIfValueOrIgnore && valueSource.__operation === '_concat') {
            let result = this._appendMaybeInnerConcat(valueSource.__valueSource, context)
            const value = valueSource.__value
            if (this._isValue(value)) {
                result += ', '
                if (isValueSource(value)) {
                    result += this._appendMaybeInnerConcat(value, context)
                } else {
                    result += this._appendValue(value, context, valueSource.__valueType, valueSource.__valueTypeName, valueSource.__typeAdapter, false)
                }
            }
            return result
        }
        return this._appendSql(valueSource, context, false)
    }
    /**
     * `concat(...)` PROPAGATES NULL on this dialect family (`concat('a', null)` is NULL — the
     * opposite of PostgreSQL's), so it is what `_concat` emits and cannot serve here.
     * `concat_ws(<separator>, ...)` is the one that SKIPS a NULL argument, and with an empty
     * separator it needs nothing else: no operand is neutralised, and nesting one call inside
     * another is indistinguishable from one flat call precisely because the separator is empty.
     */
    override _appendConcatIgnoringNull(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return "concat_ws('', " + this._appendSqlParenthesisExcluding(valueSource, context, '_concatIgnoringNull', false) + ', ' + this._appendValueParenthesisExcluding(value, context, columnType, columnTypeName, typeAdapter, '_concatIgnoringNull', false) + ')'
    }
    override _log10(context: SqlBuildContext, valueSource: ToSql): string {
        return 'log10(' +this._appendSql(valueSource, context, false) + ')'
    }
    override _getDate(context: SqlBuildContext, valueSource: ToSql): string {
        return 'dayofmonth(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _getTime(context: SqlBuildContext, valueSource: ToSql): string {
        // `unix_timestamp()` is documented over 1970-01-01 onwards only: outside that range
        // it answers 0 on MySQL and NULL on MariaDB — silently, with no error — so a
        // pre-epoch or year-3002 instant came back wrong. `timestampdiff` has no such range.
        //
        // It is also independent of the session time zone, where `unix_timestamp()` resolved
        // its argument against it: the digits are counted as UTC, as the library reads a value
        // without zone, so `getTime()` agrees with the Date read in any zone of the process. A
        // TIMESTAMP column still depends on the session zone, which converts it on delivery
        // (see docs/configuration/time-zones.md).
        return "round(timestampdiff(microsecond, '1970-01-01 00:00:00', " + this._appendSql(valueSource, context, false) + ') / 1000)'
    }
    override _getFullYear(context: SqlBuildContext, valueSource: ToSql): string {
        return 'year(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _getMonth(context: SqlBuildContext, valueSource: ToSql): string {
        return 'month(' + this._appendSql(valueSource, context, false) + ') - 1'
    }
    override _getDay(context: SqlBuildContext, valueSource: ToSql): string {
        return 'dayofweek(' + this._appendSql(valueSource, context, false) + ') - 1'
    }
    override _getHours(context: SqlBuildContext, valueSource: ToSql): string {
        return 'hour(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _getMinutes(context: SqlBuildContext, valueSource: ToSql): string {
        return 'minute(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _getSeconds(context: SqlBuildContext, valueSource: ToSql): string {
        return 'second(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _getMilliseconds(context: SqlBuildContext, valueSource: ToSql): string {
        // `microsecond()` is an int, so `/ 1000` is an exact division and `round` breaks
        // its tie away from zero: 999600 µs reported 1000 ms, a value this method's
        // declared type (and the JavaScript accessor it mirrors) cannot hold, and 123500 µs
        // reported 124. The sub-millisecond part is truncated, not rounded, everywhere else.
        return 'floor(microsecond(' + this._appendSql(valueSource, context, false) + ') / 1000)'
    }
    /**
     * MySQL / MariaDB read a backslash inside a string literal as an escape character
     * (unless `NO_BACKSLASH_ESCAPES` is set), so besides doubling `'` the backslash is
     * doubled too; otherwise a value ending in `\` would escape the closing quote. With
     * `NO_BACKSLASH_ESCAPES` a backslash in the value comes out doubled, never unescaped.
     */
    override _appendUnsafeLiteralValue(value: string, _context: SqlBuildContext): string {
        return "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "''") + "'"
    }
    // GROUP_CONCAT only accepts a literal as SEPARATOR: a placeholder there is refused by a
    // server-side prepared statement (it only worked when the driver interpolated the
    // values on the client). The separator comes from a runtime API argument, so it is
    // inlined through `_appendUnsafeLiteralValue`.
    override _stringConcat(context: SqlBuildContext, separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'group_concat(' + this._appendSql(value, context, false) + ')'
        } else if (separator === '') {
            return 'group_concat(' + this._appendSql(value, context, false) + " separator '')"
        } else {
            return 'group_concat(' + this._appendSql(value, context, false) + ' separator ' + this._appendUnsafeLiteralValue(separator, context) + ')'
        }
    }
    override _stringConcatDistinct(context: SqlBuildContext, separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'group_concat(distinct ' + this._appendSql(value, context, false) + ')'
        } else if (separator === '') {
            return 'group_concat(distinct ' + this._appendSql(value, context, false) + " separator '')"
        } else {
            return 'group_concat(distinct ' + this._appendSql(value, context, false) + ' separator ' + this._appendUnsafeLiteralValue(separator, context) + ')'
        }
    }
    override _random(_context: SqlBuildContext): string {
        return 'rand()'
    }
    override _finalizeAggregatedArrayResult(sql: string): string {
        // mysql2 / mariadb decode a JSON column into a JS value, rounding every integer past
        // 2^53, before the library sees it. Casting the aggregate to `char` makes the driver
        // hand back the raw JSON string, which `parseJsonPreservingNumbers` decodes losslessly.
        return 'cast(' + sql + ' as char)'
    }
    override _appendAggragateArrayColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayDistinct: boolean, context: SqlBuildContext, _query: SelectData | undefined): string {
        const distict = aggregatedArrayDistinct ? 'distinct ' : ''
        if (isValueSource(aggregatedArrayColumns)) {
            return 'json_arrayagg(' + distict + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, this._appendSql(aggregatedArrayColumns, context, false)) + ')'
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "', " + this._appendAggregatedArrayValueProjection(columns[prop]!, this._appendSql(columns[prop]!, context, false))
            }

            return 'json_arrayagg(' +  distict + 'json_object(' + result + '))'
        }
    }
    override _appendAggragateArrayWrappedColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, _context: SqlBuildContext, aggregateId: number): string {
        if (isValueSource(aggregatedArrayColumns)) {
            return 'json_arrayagg(' + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, 'a_' + aggregateId + '_.result') + ')'
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "', " + this._appendAggregatedArrayValueProjection(columns[prop]!, 'a_' + aggregateId + '_.' + this._escape(prop, true))
            }

            return 'json_arrayagg(json_object(' + result + '))'
        }
    }
}
