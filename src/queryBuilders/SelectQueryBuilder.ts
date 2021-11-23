import type { SqlBuilder, JoinData, ToSql, SelectData, CompoundOperator, CompoundSelectData, PlainSelectData } from "../sqlBuilders/SqlBuilder"
import type { SelectExpression, SelectColumns, OrderByMode, SelectExpressionSubquery, ExecutableSelectExpressionWithoutWhere, DynamicWhereExecutableSelectExpression, GroupByOrderByExecutableSelectExpression, OffsetExecutableSelectExpression, DynamicWhereExpressionWithoutSelect, SelectExpressionFromNoTable, SelectWhereJoinExpression, DynamicOnExpression, OnExpression, SelectExpressionWithoutJoin, SelectWhereExpression, OrderByExecutableSelectExpression, GroupByOrderByHavingExecutableSelectExpression, DynamicHavingExecutableSelectExpression, GroupByOrderHavingByExpressionWithoutSelect, DynamicHavingExpressionWithoutSelect, ICompoundableSelect, CompoundableCustomizableExecutableSelectExpression, CompoundedExecutableSelectExpression, ExecutableSelect, ComposeExpression, ComposeExpressionDeletingInternalProperty, ComposeExpressionDeletingExternalProperty, WithableExecutableSelect, SelectCustomization, WhereableExecutableSelectExpressionWithGroupBy, DynamicWhereExecutableSelectExpressionWithGroupBy, GroupByOrderByHavingExecutableSelectExpressionWithoutWhere, DynamicHavingExecutableSelectExpressionWithoutWhere, DynamicWhereSelectExpressionWithoutSelect, CompoundableExecutableSelectExpression, CompoundedOrderByExecutableSelectExpression, CompoundedOffsetExecutableSelectExpression, CompoundedCustomizableExecutableSelect, OrderByExecutableSelectExpressionWithoutWhere, OrderedExecutableSelectExpressionWithoutWhere, OffsetExecutableSelectExpressionWithoutWhere, CompoundableCustomizableExpressionWithoutWhere, DynamicWhereOffsetExecutableSelectExpression, DynamicWhereCompoundableCustomizableExecutableSelectExpression, ExecutableSelectWithWhere, ExecutableSelectWithoutWhere, WithableExecutableSelectWithoutWhere, CompoundableExecutableSelectExpressionWithoutWhere, CompoundableCustomizableExecutableSelectExpressionWitoutWhere, SplitedComposedExecutableSelectWithoutWhere, SplitedComposedDynamicWhereExecutableSelectExpression, WhereableCompoundableExecutableSelectExpressionWithoutWhere } from "../expressions/select"
import { HasAddWiths, ITableOrView, IWithView, OuterJoinSource, __getOldValues, __registerRequiredColumn, __registerTableOrView } from "../utils/ITableOrView"
import type { IIfValueSource, IBooleanValueSource, INumberValueSource, IIntValueSource, IExecutableSelectQuery, AnyValueSource, AlwaysIfValueSource } from "../expressions/values"
import type { int } from "ts-extended-types"
import type { WithView } from "../utils/tableOrViewUtils"
import { __addWiths, __getTableOrViewPrivate } from "../utils/ITableOrView"
import { __getValueSourcePrivate } from "../expressions/values"
import ChainedError from "chained-error"
import { AggregateFunctions0ValueSource, InlineSelectValueSource } from "../internal/ValueSourceImpl"
import { attachSource } from "../utils/attachSource"
import { columnsType, database, requiredTableOrView, resultType, compoundable, type, compoundableColumns } from "../utils/symbols"
import { asAlwaysIfValueSource } from "../expressions/values"
import { WithViewImpl } from "../internal/WithViewImpl"
import { createColumnsFrom } from "../internal/ColumnImpl"
import { View } from "../View"
import { ComposeSplitQueryBuilder } from "./ComposeSliptQueryBuilder"
import { Column } from "../utils/Column"

abstract class AbstractSelect extends ComposeSplitQueryBuilder implements ToSql, HasAddWiths, IExecutableSelectQuery<any, any, any, any>, CompoundableCustomizableExecutableSelectExpression<any, any, any, any, any, any>, CompoundedExecutableSelectExpression<any, any, any, any, any, any>, WithableExecutableSelect<any, any, any, any>, ExecutableSelect<any, any, any, any>, ComposeExpression<any, any, any, any, any, any, any>, ComposeExpressionDeletingInternalProperty<any, any, any, any, any, any, any>,  ComposeExpressionDeletingExternalProperty<any, any, any, any, any, any, any>, OrderByExecutableSelectExpression<any,any,any,any, any, any>, OffsetExecutableSelectExpression<any, any, any, any, any, any>, CompoundableCustomizableExecutableSelectExpression<any, any, any, any, any, any>, CompoundableExecutableSelectExpression<any, any, any, any, any, any>, CompoundedOrderByExecutableSelectExpression<any, any, any, any, any, any>, CompoundedOffsetExecutableSelectExpression<any, any, any, any>, CompoundedCustomizableExecutableSelect<any, any, any, any>, OrderByExecutableSelectExpressionWithoutWhere<any, any, any, any, any, any>, ExecutableSelectWithWhere<any, any, any, any>, ExecutableSelectWithoutWhere<any, any, any, any, any>, WithableExecutableSelectWithoutWhere<any, any, any, any, any>, CompoundableExecutableSelectExpressionWithoutWhere<any, any, any, any, any, any>, CompoundableCustomizableExecutableSelectExpressionWitoutWhere<any, any, any, any, any, any> {
    [database]: any
    [requiredTableOrView]: any
    [type]: any
    [compoundable]: any
    [compoundableColumns]: any

    [resultType]: any
    [columnsType]: any

    __columns: { [property: string]: AnyValueSource } = {}
    __orderBy?: { [property: string]: OrderByMode | null | undefined }
    __limit?: int | number | INumberValueSource<any, any> | IIntValueSource<any, any>
    __offset?: int | number | INumberValueSource<any, any> | IIntValueSource<any, any>
    __withs: Array<IWithView<any>> = []
    __customization?: SelectCustomization<any>

    __oneColumn = false

    // cache
    __query = ''
    __params: any[] = []

    __recursiveInternalView?: WithViewImpl<any, any>
    __recursiveView?: WithViewImpl<any, any>
    __recursiveSelect?: SelectData

    __subSelectUsing?: ITableOrView<any>[]

    constructor(sqlBuilder: SqlBuilder) {
        super(sqlBuilder)
    }

    query(): string {
        this.__finishJoinHaving()
        if (this.__query) {
            return this.__query
        }
        try {
            this.__query = this.__sqlBuilder._buildSelect(this.__asSelectData(), this.__params)
        } catch (e) {
            throw new ChainedError(e)
        }
        return this.__query
    }
    params(): any[] {
        this.__finishJoinHaving()
        if (!this.__query) {
            this.query()
        }
        return this.__params
    }

    executeSelectNoneOrOne(): Promise<any> {
        this.query()
        const source = new Error('Query executed at')
        try {
            this.__sqlBuilder._resetUnique()
            let result
            if (this.__oneColumn) {
                result = this.__sqlBuilder._queryRunner.executeSelectOneColumnOneRow(this.__query, this.__params).then((value) => {
                    const valueSource = this.__columns['result']!
                    if (value === undefined) {
                        return null
                    }
                    return this.__transformValueFromDB(valueSource, value)
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            } else {
                result = this.__sqlBuilder._queryRunner.executeSelectOneRow(this.__query, this.__params).then((row) => {
                    if (row) {
                        return this.__transformRow(row)
                    } else {
                        return null
                    }
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            }
            return this.__applyCompositions(result, source)
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    executeSelectOne(): Promise<any> {
        this.query()
        const source = new Error('Query executed at')
        try {
            this.__sqlBuilder._resetUnique()
            let result
            if (this.__oneColumn) {
                result = this.__sqlBuilder._queryRunner.executeSelectOneColumnOneRow(this.__query, this.__params).then((value) => {
                    const valueSource = this.__columns['result']!
                    if (value === undefined) {
                        throw new Error('No result returned by the database')
                    }
                    return this.__transformValueFromDB(valueSource, value)
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            } else {
                result = this.__sqlBuilder._queryRunner.executeSelectOneRow(this.__query, this.__params).then((row) => {
                    if (row) {
                        return this.__transformRow(row)
                    } else {
                        throw new Error('No result returned by the database')
                    }
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            }
            return this.__applyCompositions(result, source)
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    __executeSelectMany(source: Error): Promise<any> {
        this.query()
        try {
            this.__sqlBuilder._resetUnique()
            let result
            if (this.__oneColumn) {
                result = this.__sqlBuilder._queryRunner.executeSelectOneColumnManyRows(this.__query, this.__params).then((values) => {
                    const valueSource = this.__columns['result']!

                    return values.map((value) => {
                        if (value === undefined) {
                            value = null
                        }
                        return this.__transformValueFromDB(valueSource, value)
                    })
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            } else {
                result = this.__sqlBuilder._queryRunner.executeSelectManyRows(this.__query, this.__params).then((rows) => {
                    return rows.map((row, index) => {
                        return this.__transformRow(row, index)
                    })
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            }
            return this.__applyCompositions(result, source)
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    executeSelectMany(): Promise<any> {
        const source = new Error('Query executed at')
        return this.__executeSelectMany(source)
    }
    abstract __buildSelectCount(countAll: AggregateFunctions0ValueSource, params: any[]): string
    __executeSelectCount(source: Error): Promise<any> {
        try {
            this.__sqlBuilder._resetUnique()
            const countAll = new AggregateFunctions0ValueSource('_countAll', 'int', 'required', undefined)
            const params: any[] = []
            const query = this.__buildSelectCount(countAll, params)
            return this.__sqlBuilder._queryRunner.executeSelectOneColumnOneRow(query, params).then((value) => {
                return this.__transformValueFromDB(countAll, value, undefined, undefined, true)
            }).catch((e) => {
                throw attachSource(new ChainedError(e), source)
            })
        } catch (e) {
            throw attachSource(new ChainedError(e), source)
        }
    }
    executeSelectPage(extras?: any) {
        const source = new Error('Query executed at')

        if (extras && (extras.count !== undefined && extras.count !== null)) {
            if (extras.data) {
                return this.__sqlBuilder._queryRunner.createResolvedPromise({...extras, data: extras.data, count: extras.count})
            }
            return this.__executeSelectMany(source).then((data) => {
                return {...extras, data, count: extras.count}
            })
        }
        if (extras && extras.data) {
            return this.__executeSelectCount(source).then((count) => {
                return {...extras, data: extras.data, count}
            })
        }

        const getDataFn = () => {
            return this.__executeSelectMany(source)
        }

        const getCountFn = () => {
            return this.__executeSelectCount(source)
        }

        return this.__sqlBuilder._queryRunner.executeCombined(getDataFn, getCountFn).then(([data, count]) => {
            return {...extras, data, count}
        })
    }

    abstract __finishJoinHaving(): void
    orderBy(column: any, mode?: OrderByMode): any {
        this.__finishJoinHaving()
        this.__query = ''
        if (!this.__orderBy) {
            this.__orderBy = {}
        }
        if (column in this.__orderBy) {
            throw new Error('Column ' + column + ' already used in the order by clause')
        }
        if (!(column in this.__columns)) {
            // this can happens because we the column is not included in required columns for a select that picks the columns
            // In this case, we just skip it
            return this
        }
        this.__orderBy[column] = mode || null
        return this
    }
    orderByFromString(orderBy: string): any {
        this.__finishJoinHaving()
        this.__query = ''
        const columnsInQuery: { [columnNameInLowerCase: string]: string | undefined } = {}
        const columns = this.__columns
        for (const property in columns) {
            columnsInQuery[property.toLowerCase()] = property
        }

        const split = orderBy.trim().toLowerCase().replace(/\s+/g, ' ').split(/\s*,\s*/)
        for (let i = 0, length = split.length; i < length; i++) {
            const clause = split[i]!
            const separatorIndex = clause.indexOf(' ')
            let column
            let ordering
            if (separatorIndex < 0) {
                column = clause
                ordering = null
            } else {
                column = clause.substring(0, separatorIndex)
                ordering = clause.substring(separatorIndex + 1)
            }
            const realColumnName = columnsInQuery[column]
            if (!realColumnName) {
                throw new Error('The column "' + column + '" is not part of the select clause')
            }
            if (ordering === 'asc') {
                this.orderBy(realColumnName, 'asc')
            } else if (ordering === 'desc') {
                this.orderBy(realColumnName, 'desc')
            } else if (ordering === 'asc nulls first') {
                this.orderBy(realColumnName, 'asc nulls first')
            } else if (ordering === 'desc nulls first') {
                this.orderBy(realColumnName, 'desc nulls first')
            } else if (ordering === 'asc nulls last') {
                this.orderBy(realColumnName, 'asc nulls last')
            } else if (ordering === 'desc nulls last') {
                this.orderBy(realColumnName, 'desc nulls last')
            } else if (ordering === 'insensitive') {
                this.orderBy(realColumnName, 'insensitive')
            } else if (ordering === 'asc insensitive') {
                this.orderBy(realColumnName, 'asc insensitive')
            } else if (ordering === 'desc insensitive') {
                this.orderBy(realColumnName, 'desc insensitive')
            } else if (ordering === 'asc nulls first insensitive') {
                this.orderBy(realColumnName, 'asc nulls first insensitive')
            } else if (ordering === 'desc nulls first insensitive') {
                this.orderBy(realColumnName, 'desc nulls first insensitive')
            } else if (ordering === 'asc nulls last insensitive') {
                this.orderBy(realColumnName, 'asc nulls last insensitive')
            } else if (ordering === 'desc nulls last insensitive') {
                this.orderBy(realColumnName, 'desc nulls last insensitive')
            } else if (!ordering) {
                this.orderBy(realColumnName)
            } else {
                throw new Error('Unknow ordering clause "' + ordering + '" in the order by related to the column "' + column + '"')
            }
        }
        return this
    }
    limit(limit: int | number | INumberValueSource<any, any> | IIntValueSource<any, any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        this.__limit = limit
        __addWiths(limit, this.__withs)
        return this
    }
    offset(offset: int | number | INumberValueSource<any, any> | IIntValueSource<any, any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        this.__offset = offset
        __addWiths(offset, this.__withs)
        return this
    }

    __combineSubSelectUsing(select: ICompoundableSelect<any, any, any, any>, result: CompoundSelectQueryBuilder) {
        const selectPrivate = select as any as AbstractSelect
        if (this.__subSelectUsing) {
            if (selectPrivate.__subSelectUsing) {
                result.__subSelectUsing = this.__subSelectUsing.concat(...selectPrivate.__subSelectUsing)
            } else {
                result.__subSelectUsing = this.__subSelectUsing.concat()
            }
        } else if (selectPrivate.__subSelectUsing) {
            result.__subSelectUsing = selectPrivate.__subSelectUsing.concat()
        }
    }

    union(select: ICompoundableSelect<any, any, any, any>): any {
        const result = new CompoundSelectQueryBuilder(this.__sqlBuilder, this.__asSelectData(), 'union', this.__compoundableAsSelectData(select))
        this.__combineSubSelectUsing(select, result)
        return result
    }
    unionAll(select: ICompoundableSelect<any, any, any, any>): any {
        const result = new CompoundSelectQueryBuilder(this.__sqlBuilder, this.__asSelectData(), 'unionAll', this.__compoundableAsSelectData(select))
        this.__combineSubSelectUsing(select, result)
        return result
    }
    intersect(select: ICompoundableSelect<any, any, any, any>): any {
        const result = new CompoundSelectQueryBuilder(this.__sqlBuilder, this.__asSelectData(), 'intersect', this.__compoundableAsSelectData(select))
        this.__combineSubSelectUsing(select, result)
        return result
    }    
    intersectAll(select: ICompoundableSelect<any, any, any, any>): any {
        const result = new CompoundSelectQueryBuilder(this.__sqlBuilder, this.__asSelectData(), 'intersectAll', this.__compoundableAsSelectData(select))
        this.__combineSubSelectUsing(select, result)
        return result
    }    
    except(select: ICompoundableSelect<any, any, any, any>): any {
        const result = new CompoundSelectQueryBuilder(this.__sqlBuilder, this.__asSelectData(), 'except', this.__compoundableAsSelectData(select))
        this.__combineSubSelectUsing(select, result)
        return result
    }
    exceptAll(select: ICompoundableSelect<any, any, any, any>): any {
        const result = new CompoundSelectQueryBuilder(this.__sqlBuilder, this.__asSelectData(), 'exceptAll', this.__compoundableAsSelectData(select))
        this.__combineSubSelectUsing(select, result)
        return result
    }
    minus(select: ICompoundableSelect<any, any, any, any>): any {
        const result = new CompoundSelectQueryBuilder(this.__sqlBuilder, this.__asSelectData(), 'minus', this.__compoundableAsSelectData(select))
        this.__combineSubSelectUsing(select, result)
        return result
    }
    minusAll(select: ICompoundableSelect<any, any, any, any>): any {
        const result = new CompoundSelectQueryBuilder(this.__sqlBuilder, this.__asSelectData(), 'minusAll', this.__compoundableAsSelectData(select))
        this.__combineSubSelectUsing(select, result)
        return result
    };

    __compoundableAsSelectData(select: ICompoundableSelect<any, any, any, any>): SelectData {
        return select as any
    }

    __addWiths(withs: Array<IWithView<any>>): void {
        this.__finishJoinHaving()
        const withViews = this.__withs
        for (let i = 0, length = withViews.length; i < length; i++) {
            const withView = withViews[i]!
            __getTableOrViewPrivate(withView).__addWiths(withs)
        }
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        const subSelectUsing = this.__subSelectUsing
        if (!subSelectUsing) {
            return
        }
        for (let i = 0, length = subSelectUsing.length; i < length; i++) {
            const tableOrView = subSelectUsing[i]!
            __getTableOrViewPrivate(tableOrView).__registerTableOrView(requiredTablesOrViews)
        }
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        const subSelectUsing = this.__subSelectUsing
        if (!subSelectUsing) {
            return
        }
        const newOnly = new Set<ITableOrView<any>>()
        for (let i = 0, length = subSelectUsing.length; i < length; i++) {
            const tableOrView = subSelectUsing[i]!
            if (onlyForTablesOrViews.has(tableOrView)) {
                newOnly.add(tableOrView)
            }
        }
        if (newOnly.size <= 0) {
            return
        }

        const columns = this.__columns
        for (const property in columns) {
            __registerRequiredColumn(columns[property], requiredColumns, newOnly)
        }
        __registerRequiredColumn(this.__orderBy, requiredColumns, newOnly)
        __registerRequiredColumn(this.__limit, requiredColumns, newOnly)
        __registerRequiredColumn(this.__offset, requiredColumns, newOnly)

        const customization = this.__customization
        if (customization) {
            __registerRequiredColumn(customization.afterSelectKeyword, requiredColumns, newOnly)
            __registerRequiredColumn(customization.beforeColumns, requiredColumns, newOnly)
            __registerRequiredColumn(customization.customWindow, requiredColumns, newOnly)
            __registerRequiredColumn(customization.afterQuery, requiredColumns, newOnly)
        }

        this.__registerRequiredColumnInSelect(requiredColumns, newOnly)
    }
    abstract __registerRequiredColumnInSelect(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void
    __getOldValues(): ITableOrView<any> | undefined {
        const subSelectUsing = this.__subSelectUsing
        if (!subSelectUsing) {
            return undefined
        }
        for (let i = 0, length = subSelectUsing.length; i < length; i++) {
            const tableOrView = subSelectUsing[i]!
            const result = __getTableOrViewPrivate(tableOrView).__getOldValues()
            if (result) {
                return result
            }
        }
        return undefined
    }

    abstract __asSelectData(): SelectData
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        this.__finishJoinHaving()
        return sqlBuilder._buildSelect(this.__asSelectData(), params)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        this.__finishJoinHaving()
        return sqlBuilder._buildSelect(this.__asSelectData(), params)
    }

    forUseInQueryAs(as: string): WithView<any, any> {
        const recursiveView = this.__recursiveView
        if (recursiveView) {
            recursiveView.__name = as
            this.__recursiveInternalView!.__name = as
            this.__recursiveView = undefined
            this.__recursiveInternalView = undefined
            this.__recursiveSelect = undefined
            return recursiveView as any
        }
        return new WithViewImpl<any, any>(as, this.__asSelectData()) as any
    };

    forUseAsInlineQueryValue(): any {
        return new InlineSelectValueSource(this.__asSelectData() as any)
    };

    __buildRecursive(fn: (view: any) => ICompoundableSelect<any, any, any, any>, unionAll: boolean): void {
        const sqlBuilder = this.__sqlBuilder
        const name = 'recursive_select_' + sqlBuilder._generateUnique()
        const recursiveInternalView = new WithViewImpl<any, any>(name, this as any)
        let recursiveInternalSelect 
        if (unionAll) {
            recursiveInternalSelect = this.unionAll(fn(recursiveInternalView))
        } else {
            recursiveInternalSelect = this.union(fn(recursiveInternalView))
        }
        const recursiveView = new WithViewImpl<any, any>(name, recursiveInternalSelect)
        recursiveView.__recursive = true

        const recursiveSelect = new SelectQueryBuilder(this.__sqlBuilder, [recursiveView], false)
        const columns = recursiveSelect.__columns
        const currentColumns = this.__columns
        for (let columnName in currentColumns) {
            columns[columnName] = (recursiveView as any)[columnName]
        }

        this.__recursiveInternalView = recursiveInternalView
        this.__recursiveView = recursiveView
        this.__recursiveSelect = recursiveSelect.__asSelectData() // __asSelectData is important here to detect the required tables
    }
    recursiveUnion(fn: (view: any) => ICompoundableSelect<any, any, any, any>): any {
        this.__buildRecursive(fn, false)
        return this
    }
    recursiveUnionAll(fn: (view: any) => ICompoundableSelect<any, any, any, any>): any {
        this.__buildRecursive(fn, true)
        return this
    }
    __buildRecursiveFn(fn: (view: any) => IBooleanValueSource<any, any>): (view: any) => ICompoundableSelect<any, any, any, any> {
        return (view: any) => {
            const current = this as any as PlainSelectData
            const result = new SelectQueryBuilder(this.__sqlBuilder, current.__tablesOrViews, false)
            result.__columns = { ...current.__columns }
            result.__withs = current.__withs.concat()
            result.__joins = current.__joins.concat()
            result.join(view).on(fn(view))
            return result as any
        }
    }
    recursiveUnionOn(fn: (view: any) => IBooleanValueSource<any, any>): any {
        this.__buildRecursive(this.__buildRecursiveFn(fn), false)
        return this
    }
    recursiveUnionAllOn(fn: (view: any) => IBooleanValueSource<any, any>): any {
        this.__buildRecursive(this.__buildRecursiveFn(fn), true)
        return this
    }

    customizeQuery(customization: SelectCustomization<any>): any {
        this.__customization = customization
        __addWiths(customization.afterSelectKeyword, this.__withs)
        __addWiths(customization.beforeColumns, this.__withs)
        __addWiths(customization.customWindow, this.__withs)
        __addWiths(customization.afterQuery, this.__withs)
        return this
    }
}

export class SelectQueryBuilder extends AbstractSelect implements ToSql, PlainSelectData, SelectExpression<any, any, any>, SelectExpressionFromNoTable<any>, ExecutableSelectExpressionWithoutWhere<any, any, any, any, any, any>, DynamicWhereExecutableSelectExpression<any, any, any, any, any, any>, DynamicWhereExpressionWithoutSelect<any, any, any>, GroupByOrderByExecutableSelectExpression<any, any, any, any, any, any>, SelectWhereJoinExpression<any, any, any>, DynamicOnExpression<any, any, any>, OnExpression<any, any, any>, SelectExpressionWithoutJoin<any, any, any>, SelectExpressionSubquery<any, any>, SelectWhereExpression<any, any, any>, GroupByOrderByHavingExecutableSelectExpression<any, any, any, any, any, any>, DynamicHavingExecutableSelectExpression<any, any, any, any, any, any>, GroupByOrderHavingByExpressionWithoutSelect<any, any, any>, DynamicHavingExpressionWithoutSelect<any, any, any>, WhereableExecutableSelectExpressionWithGroupBy<any, any, any, any, any, any>, DynamicWhereExecutableSelectExpressionWithGroupBy<any, any, any, any, any, any>, GroupByOrderByHavingExecutableSelectExpressionWithoutWhere<any, any, any, any, any, any>, DynamicHavingExecutableSelectExpressionWithoutWhere<any, any, any, any, any, any>, DynamicWhereSelectExpressionWithoutSelect<any, any, any>, OrderedExecutableSelectExpressionWithoutWhere<any, any, any, any, any, any>, OffsetExecutableSelectExpressionWithoutWhere<any, any, any, any, any, any>, CompoundableCustomizableExpressionWithoutWhere<any, any, any, any, any, any>, DynamicWhereOffsetExecutableSelectExpression<any, any, any, any, any, any>, DynamicWhereCompoundableCustomizableExecutableSelectExpression<any, any, any, any, any, any>, SplitedComposedExecutableSelectWithoutWhere<any, any, any, any, any>, SplitedComposedDynamicWhereExecutableSelectExpression<any, any, any, any, any>, WhereableCompoundableExecutableSelectExpressionWithoutWhere<any, any, any, any, any, any>, DynamicWhereCompoundableCustomizableExecutableSelectExpression<any, any, any, any, any, any> {
    __type: 'plain' = 'plain'
    __distinct: boolean
    __tablesOrViews: Array<ITableOrView<any>>
    __joins: Array<JoinData> = []
    __where?: AlwaysIfValueSource<any, any>
    __having?: AlwaysIfValueSource<any, any>
    __groupBy:  Array<AnyValueSource> = []
    __requiredTablesOrViews?: Set<ITableOrView<any>>

    __lastJoin?: JoinData
    __inHaving = false
    __hasOptionalJoin = false

    constructor(sqlBuilder: SqlBuilder, tables: Array<ITableOrView<any>>, distinct: boolean) {
        super(sqlBuilder)
        this.__tablesOrViews = tables
        this.__distinct = distinct
        for (let i = 0, length = tables.length; i < length; i++) {
            const table = tables[i]!
            __getTableOrViewPrivate(table).__addWiths(this.__withs)
        }
    }

    __registerRequiredColumnInSelect(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        const tablesOrViews = this.__tablesOrViews
        for (let i = 0, length = tablesOrViews.length; i < length; i++) {
            __registerRequiredColumn(tablesOrViews[i], requiredColumns, onlyForTablesOrViews)
        }
        const joins = this.__joins
        for (let i = 0, length = joins.length; i < length; i++) {
            const join = joins[i]!
            __registerRequiredColumn(join.__tableOrView, requiredColumns, onlyForTablesOrViews)
            __registerRequiredColumn(join.__on, requiredColumns, onlyForTablesOrViews)
        }
        __registerRequiredColumn(this.__where, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__having, requiredColumns, onlyForTablesOrViews)
        
        const groupBy = this.__groupBy
        for (let i = 0, length = groupBy.length; i < length; i++) {
            __registerRequiredColumn(groupBy[i], requiredColumns, onlyForTablesOrViews)
        }
    }

    __buildSelectCount(countAll: AggregateFunctions0ValueSource, params: any[]): string {
        if (this.groupBy.length > 0) {
            const withView = new WithViewImpl<any, any>('result_for_count', this)
            const withs: Array<IWithView<any>> = []
            withView.__addWiths(withs)
            
            const selectCountData: PlainSelectData = {
                __type: 'plain',
                __distinct: false,
                __columns: { '': countAll },
                __tablesOrViews: [withView],
                __joins: [],
                __where: undefined,
                __groupBy: [],
                __withs: withs
            }
            return this.__sqlBuilder._buildSelect(selectCountData, params)
        }

        const selectCountData: PlainSelectData = {
            __type: 'plain',
            __distinct: false,
            __columns: { '': countAll },
            __tablesOrViews: this.__tablesOrViews,
            __joins: this.__joins,
            __where: this.__where,
            __groupBy: [],
            __withs: this.__withs
        }
        return this.__sqlBuilder._buildSelect(selectCountData, params)
    }

    select(columns: SelectColumns<any, any>): any { // any to avoid deep errors
        this.__finishJoinHaving()
        this.__query = ''
        this.__columns = columns

        const withs = this.__withs
        for (const property in columns) {
            const column = columns[property]!
            __getValueSourcePrivate(column).__addWiths(withs)
        }
        return this
    }
    selectOneColumn(column: AnyValueSource): any {
        this.__finishJoinHaving()
        this.__query = ''
        this.__oneColumn = true
        this.__columns = { 'result': column }
        __getValueSourcePrivate(column).__addWiths(this.__withs)
        return this
    }
    from(table: ITableOrView<any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        this.__tablesOrViews.push(table)
        __getTableOrViewPrivate(table).__addWiths(this.__withs)
        return this
    }
    join(table: ITableOrView<any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'join',
            __tableOrView: table
        }
        __getTableOrViewPrivate(table).__addWiths(this.__withs)
        return this
    }
    innerJoin(table: ITableOrView<any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'innerJoin',
            __tableOrView: table
        }
        __getTableOrViewPrivate(table).__addWiths(this.__withs)
        return this
    }
    leftJoin(source: OuterJoinSource<any, any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'leftJoin',
            __tableOrView: source as any
        }
        __getTableOrViewPrivate(source).__addWiths(this.__withs)
        return this
    }
    leftOuterJoin(source: OuterJoinSource<any, any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'leftOuterJoin',
            __tableOrView: source as any
        }
        __getTableOrViewPrivate(source).__addWiths(this.__withs)
        return this
    }
    optionalJoin(table: ITableOrView<any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'join',
            __tableOrView: table,
            __optional: true
        }
        this.__hasOptionalJoin = true
        __getTableOrViewPrivate(table).__addWiths(this.__withs)
        return this
    }
    optionalInnerJoin(table: ITableOrView<any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'innerJoin',
            __tableOrView: table,
            __optional: true
        }
        this.__hasOptionalJoin = true
        __getTableOrViewPrivate(table).__addWiths(this.__withs)
        return this
    }
    optionalLeftJoin(source: OuterJoinSource<any, any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'leftJoin',
            __tableOrView: source as any,
            __optional: true
        }
        this.__hasOptionalJoin = true
        __getTableOrViewPrivate(source).__addWiths(this.__withs)
        return this
    }
    optionalLeftOuterJoin(source: OuterJoinSource<any, any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'leftOuterJoin',
            __tableOrView: source as any,
            __optional: true
        }
        this.__hasOptionalJoin = true
        __getTableOrViewPrivate(source).__addWiths(this.__withs)
        return this
    }
    dynamicOn(): any {
        this.__query = ''
        return this
    }
    on(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): any {
        this.__query = ''
        if (!this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin.__on = asAlwaysIfValueSource(condition)
        this.__joins.push(this.__lastJoin)
        this.__lastJoin = undefined
        __getValueSourcePrivate(condition).__addWiths(this.__withs)
        return this
    }
    __finishJoinHaving() {
        if (this.__lastJoin) {
            this.__joins.push(this.__lastJoin)
            this.__lastJoin = undefined
        }
        this.__inHaving = false
    }
    dynamicWhere(): any {
        this.__finishJoinHaving()
        this.__query = ''
        return this
    }
    where(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__where) {
            throw new Error('Illegal state')
        }
        this.__where = asAlwaysIfValueSource(condition)
        __getValueSourcePrivate(condition).__addWiths(this.__withs)
        return this
    }
    and(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): any {
        this.__query = ''
        __getValueSourcePrivate(condition).__addWiths(this.__withs)
        if (this.__lastJoin) {
            if (this.__lastJoin.__on) {
                this.__lastJoin.__on = this.__lastJoin.__on.and(asAlwaysIfValueSource(condition))
            } else {
                this.__lastJoin.__on = asAlwaysIfValueSource(condition)
            }
            return this
        }
        if (this.__inHaving) {
            if (this.__having) {
                this.__having = this.__having.and(asAlwaysIfValueSource(condition))
            } else {
                this.__having = asAlwaysIfValueSource(condition)
            }
            return this
        }
        if (this.__where) {
            this.__where = this.__where.and(asAlwaysIfValueSource(condition))
        } else {
            this.__where = asAlwaysIfValueSource(condition)
        }
        return this
    }
    or(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): any {
        this.__query = ''
        __getValueSourcePrivate(condition).__addWiths(this.__withs)
        if (this.__lastJoin) {
            if (this.__lastJoin.__on) {
                this.__lastJoin.__on = this.__lastJoin.__on.or(asAlwaysIfValueSource(condition))
            } else {
                this.__lastJoin.__on = asAlwaysIfValueSource(condition)
            }
            return this
        }
        if (this.__inHaving) {
            if (this.__having) {
                this.__having = this.__having.or(asAlwaysIfValueSource(condition))
            } else {
                this.__having = asAlwaysIfValueSource(condition)
            }
            return this
        }
        if (this.__where) {
            this.__where = this.__where.or(asAlwaysIfValueSource(condition))
        } else {
            this.__where = asAlwaysIfValueSource(condition)
        }
        return this
    }
    dynamicHaving(): any {
        this.__finishJoinHaving()
        this.__query = ''
        this.__inHaving = true
        return this
    }
    having(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        this.__inHaving = true
        if (this.__having) {
            throw new Error('Illegal state')
        }
        this.__having = asAlwaysIfValueSource(condition)
        __getValueSourcePrivate(condition).__addWiths(this.__withs)
        return this
    }
    groupBy(...columns: Array<string| number | symbol | AnyValueSource>): any {
        this.__finishJoinHaving()
        this.__query = ''
        for (let i = 0, length = columns.length; i < length; i++) {
            const column = columns[i]
            if (!column || typeof column !== 'object') {
                const valueSource = this.__columns[column as string]
                if (!valueSource) {
                    throw new Error('The column "' + (column as string) + '" is not part of the select clause')
                }
                this.__groupBy.push(valueSource)
            } else {
                this.__groupBy.push(column)
                __addWiths(column, this.__withs)
            }
        }
        return this
    }
    __asSelectData(): SelectData {
        const recursiveSelect = this.__recursiveSelect
        if (recursiveSelect) {
            return recursiveSelect
        }
        if (this.__hasOptionalJoin && !this.__requiredTablesOrViews) {
            this.__requiredTablesOrViews = this.__generateRequiredTableOrView()
        }
        return this
    }
    __generateRequiredTableOrView(): Set<ITableOrView<any>> {
        const requiredTableOrView = new Set<ITableOrView<any>>()

        const columns = this.__columns
        for (const property in columns) {
            const column = columns[property]!
            __getValueSourcePrivate(column).__registerTableOrView(requiredTableOrView)
        }
        const where = this.__where
        if (where) {
            __getValueSourcePrivate(where).__registerTableOrView(requiredTableOrView)
        }
        const groupBy = this.__groupBy
        for (let i = 0, lenght = groupBy.length; i < lenght; i++) {
            const value = groupBy[i]!
            __getValueSourcePrivate(value).__registerTableOrView(requiredTableOrView)
        }
        const having = this.__having
        if (having) {
            __getValueSourcePrivate(having).__registerTableOrView(requiredTableOrView)
        }

        const joins = this.__joins
        for (let i = 0, lenght = groupBy.length; i < lenght; i++) {
            const join = joins[i]!
            const on = join.__on
            if (!join.__optional && on) {
                __getValueSourcePrivate(on).__registerTableOrView(requiredTableOrView)
            }
        }

        const customization = this.__customization
        if (customization) {
            __registerTableOrView(customization.afterSelectKeyword, requiredTableOrView)
            __registerTableOrView(customization.beforeColumns, requiredTableOrView)
            __registerTableOrView(customization.customWindow, requiredTableOrView)
            __registerTableOrView(customization.afterQuery, requiredTableOrView)
        }

        const registeredCount = requiredTableOrView.size
        let updatedCount = requiredTableOrView.size
        do {
            for (let i = 0, lenght = joins.length; i < lenght; i++) {
                const join = joins[i]!
                const on = join.__on
                if (join.__optional && on && requiredTableOrView.has(join.__tableOrView)) {
                    __getValueSourcePrivate(on).__registerTableOrView(requiredTableOrView)
                }
            }
            updatedCount = requiredTableOrView.size
        } while (registeredCount !== updatedCount)

        return requiredTableOrView
    }
    __getOldValues(): ITableOrView<any> | undefined {
        let result = super.__getOldValues()
        if (result) {
            return result
        }
        const tablesOrViews = this.__tablesOrViews
        for (let i = 0, length = tablesOrViews.length; i < length; i++) {
            const tableOrView = tablesOrViews[i]!
            result = __getTableOrViewPrivate(tableOrView).__getOldValues()
            if (result) {
                return result
            }
        }
        return undefined
    }
}

export class CompoundSelectQueryBuilder extends AbstractSelect implements ToSql, CompoundSelectData {
    __type: 'compound' = 'compound'
    __firstQuery: SelectData
    __compoundOperator: CompoundOperator
    __secondQuery: SelectData

    constructor(sqlBuilder: SqlBuilder, firstQuery: SelectData, compoundOperator: CompoundOperator, secondQuery: SelectData) {
        super(sqlBuilder)
        this.__firstQuery = firstQuery
        this.__compoundOperator = compoundOperator
        this.__secondQuery = secondQuery

        createColumnsFrom(firstQuery.__columns, this.__columns, new View(''))
    }

    __registerRequiredColumnInSelect(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        __registerRequiredColumn(this.__firstQuery, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__secondQuery, requiredColumns, onlyForTablesOrViews)
    }

    __buildSelectCount(countAll: AggregateFunctions0ValueSource, params: any[]): string {
        const withView = new WithViewImpl<any, any>('result_for_count', this)
        const withs: Array<IWithView<any>> = []
        withView.__addWiths(withs)
        
        const selectCountData: PlainSelectData = {
            __type: 'plain',
            __distinct: false,
            __columns: { '': countAll },
            __tablesOrViews: [withView],
            __joins: [],
            __where: undefined,
            __groupBy: [],
            __withs: withs
        }
        return this.__sqlBuilder._buildSelect(selectCountData, params)
    }
    __finishJoinHaving(): void {
        // noop: do nothing here
    }
    __asSelectData(): SelectData {
        const recursiveSelect = this.__recursiveSelect
        if (recursiveSelect) {
            return recursiveSelect
        }
        return this
    }
    __getOldValues(): ITableOrView<any> | undefined {
        return super.__getOldValues() || __getOldValues(this.__firstQuery) || __getOldValues(this.__secondQuery)
    }
}