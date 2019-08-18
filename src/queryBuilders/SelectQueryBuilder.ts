import { SqlBuilder, JoinData, ToSql, SelectData } from "../sqlBuilders/SqlBuilder"
import { SelectExpression, SelectValues, OrderByMode, /*SelectExpressionSubquery, ExecutableSelectExpressionWithoutWhere, DynamicWhereExecutableSelectExpression, GroupByOrderByExecutableSelectExpression, OffsetExecutableSelectExpression, ExecutableSelect, DynamicWhereExpressionWithoutSelect, SelectExpressionFromNoTable, SelectWhereJoinExpression, DynamicOnExpression, OnExpression, SelectExpressionWithoutJoin, SelectWhereExpression, OrderByExecutableSelectExpression, GroupByOrderByHavingExecutableSelectExpression, DynamicHavingExecutableSelectExpression, GroupByOrderHavingByExpressionWithoutSelect, DynamicHavingExpressionWithoutSelect, ExecutableSelectWithoutGroupBy, OffsetExecutableSelectExpressionWithoutGroupBy, OrderByExecutableSelectExpressionWithoutGroupBy*/ } from "../expressions/select"
import { ITableOrView } from "../utils/ITableOrView"
import { BooleanValueSource, NumberValueSource, IntValueSource, ValueSource, __getValueSourcePrivate } from "../expressions/values"
import { OuterJoinSource } from "../utils/OuterJoinSource"
import { int } from "ts-extended-types"
import ChainedError from "chained-error"
import { AggregateFunctions0ValueSource } from "../internal/ValueSourceImpl"
import { attachSource } from "../utils/attachSource"

/*
 * Code commented because 'Type instantiation is excessively deep and possibly infinite.' in ts 3.5.3
 */

export class SelectQueryBuilder extends SelectExpression<any, any, any> implements ToSql, SelectData/*, SelectExpressionFromNoTable, ExecutableSelectExpressionWithoutWhere<any, any, any, any>, DynamicWhereExecutableSelectExpression<any, any, any, any>, DynamicWhereExpressionWithoutSelect<any, any, any>, GroupByOrderByExecutableSelectExpression<any, any, any, any>, OffsetExecutableSelectExpression<any, any, any, any>, ExecutableSelect<any, any, any>, SelectWhereJoinExpression<any, any, any>, DynamicOnExpression<any, any, any>, OnExpression<any, any, any>, SelectExpressionWithoutJoin<any, any, any>, SelectExpressionSubquery<any, any>, SelectWhereExpression<any, any, any>, OrderByExecutableSelectExpression<any,any,any,any>, GroupByOrderByHavingExecutableSelectExpression<any, any, any, any>, DynamicHavingExecutableSelectExpression<any, any, any, any>, GroupByOrderHavingByExpressionWithoutSelect<any, any, any>, DynamicHavingExpressionWithoutSelect<any, any, any>, ExecutableSelectWithoutGroupBy<any, any, any>, OffsetExecutableSelectExpressionWithoutGroupBy<any, any, any, any>, OrderByExecutableSelectExpressionWithoutGroupBy<any, any, any, any>*/ {
    __sqlBuilder: SqlBuilder

    __distinct: boolean
    __columns: { [property: string]: ValueSource<any, any, any> } = {}
    __tables_or_views: Array<ITableOrView<any>>
    __joins: Array<JoinData> = []
    __where?: BooleanValueSource<any, any, any>
    __having?: BooleanValueSource<any, any, any>
    __groupBy:  Array<ValueSource<any, any, any>> = []
    __orderBy?: { [property: string]: OrderByMode | null | undefined }
    __limit?: int | number | NumberValueSource<any, any, any> | IntValueSource<any, any, any>
    __offset?: int | number | NumberValueSource<any, any, any> | IntValueSource<any, any, any>

    __lastJoin?: JoinData
    __inHaving = false
    __oneColumn = false

    // cache
    __query = ''
    __params: any[] = []

    constructor(sqlBuilder: SqlBuilder, tables: Array<ITableOrView<any>>, distinct: boolean) {
        super()
        this.__sqlBuilder = sqlBuilder
        this.__tables_or_views = tables
        this.__distinct = distinct
    }

    __transformValueFromDB(valueSource: ValueSource<any, any, any>, value: any) {
        const valueSourcePrivate = __getValueSourcePrivate(valueSource)
        const typeAdapter = valueSourcePrivate.__typeAdapter
        if (typeAdapter) {
            return typeAdapter.transformValueFromDB(value, valueSourcePrivate.__columnType, this.__sqlBuilder._defaultTypeAdapter)
        } else {
            return this.__sqlBuilder._defaultTypeAdapter.transformValueFromDB(value, valueSourcePrivate.__columnType)
        }
    }

    __transformRow(row: any): any {
        const columns = this.__columns
        const result: any = {}
        for (let prop in columns) {
            const valueSource = columns[prop]
            let value = row[prop]
            if (value !== undefined && value !== null) {
                result[prop] = this.__transformValueFromDB(valueSource, value)
            }
        }
        return result
    }

    executeSelectNoneOrOne(): Promise<any> {
        this.query()
        const source = new Error('Query executed at')
        try {
            if (this.__oneColumn) {
                return this.__sqlBuilder._queryRunner.executeSelectOneColumnOneRow(this.__query, this.__params).then((value) => {
                    const valueSource = this.__columns['result']
                    if (value === undefined) {
                        value = null
                    }
                    return this.__transformValueFromDB(valueSource, value)
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            } else {
                return this.__sqlBuilder._queryRunner.executeSelectOneRow(this.__query, this.__params).then((row) => {
                    if (row) {
                        return this.__transformRow(row)
                    } else {
                        return null
                    }
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            }
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    executeSelectOne(): Promise<any> {
        const source = new Error('Query executed at')
        return this.executeSelectNoneOrOne().then((result) => {
            if (result === null || result === undefined) {
                throw attachSource(new Error('No result returned by the database'), source)
            } else {
                return result
            }
        })
    }
    executeSelectMany(): Promise<any> {
        this.query()
        const source = new Error('Query executed at')
        try {
            if (this.__oneColumn) {
                return this.__sqlBuilder._queryRunner.executeSelectOneColumnManyRows(this.__query, this.__params).then((values) => {
                    const valueSource = this.__columns['result']

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
                return this.__sqlBuilder._queryRunner.executeSelectManyRows(this.__query, this.__params).then((rows) => {
                    return rows.map((row) => {
                        return this.__transformRow(row)
                    })
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            }
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    __executeSelectCount(source: Error): Promise<any> {
        try {
            const countAll = new AggregateFunctions0ValueSource('_countAll', 'int', undefined)
            const selectCountData: SelectData = {
                __distinct: false,
                __columns: { '': countAll },
                __tables_or_views: this.__tables_or_views,
                __joins: this.__joins,
                __where: this.__where,
                __groupBy: []
            }
            const params: any[] = []
            const query = this.__sqlBuilder._buildSelect(selectCountData, params)

            return this.__sqlBuilder._queryRunner.executeSelectOneColumnOneRow(query, params).then((value) => {
                if (!value || value < 0) {
                    value = 0
                }
                return this.__transformValueFromDB(countAll, value)
            }).catch((e) => {
                throw attachSource(new ChainedError(e), source)
            })
        } catch (e) {
            throw attachSource(new ChainedError(e), source)
        }
    }
    executeSelectPage(extras?: any) {
        let dataPromise
        if (extras && extras.data) {
            dataPromise = Promise.resolve(extras.data)
        } else {
            dataPromise = this.executeSelectMany()
        }
        const source = new Error('Query executed at')
        return dataPromise.then((data) => {
            if (extras && (extras.count !== undefined && extras.count !== null)) {
                return {...extras, data, count: extras.count}
            } else {
                return this.__executeSelectCount(source).then((count) => {
                    return {...extras, data, count}
                })
            }
        })
    }
    query(): string {
        this.__finishJoinHaving()
        if (this.__query) {
            return this.__query
        }
        try {
            this.__query = this.__sqlBuilder._buildSelect(this, this.__params)
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

    select(columns: SelectValues<any, any, any>): any /*this*/ {
        this.__finishJoinHaving()
        this.__query = ''
        this.__columns = columns
        return this
    }
    selectOneColumn(column: ValueSource<any, any, any>): any /*this*/ {
        this.__finishJoinHaving()
        this.__query = ''
        this.__oneColumn = true
        this.__columns = { 'result': column }
        return this
    }
    from(table: ITableOrView<any>): any /*this*/ {
        this.__finishJoinHaving()
        this.__query = ''
        this.__tables_or_views.push(table)
        return this
    }
    join(table: ITableOrView<any>): any /*this*/ {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'join',
            __table_or_view: table
        }
        return this
    }
    innerJoin(table: ITableOrView<any>): any /*this*/ {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'innerJoin',
            __table_or_view: table
        }
        return this
    }
    leftJoin(source: OuterJoinSource<any, any, any>): any /*this*/ {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'leftJoin',
            __table_or_view: source as any
        }
        return this
    }
    leftOuterJoin(source: OuterJoinSource<any, any, any>): any /*this*/ {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'leftOuterJoin',
            __table_or_view: source as any
        }
        return this
    }
    dynamicOn(): any /*this*/ {
        this.__query = ''
        return this
    }
    on(condition: BooleanValueSource<any, any, any>): any /*this*/ {
        this.__query = ''
        if (!this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin.__on = condition
        this.__joins.push(this.__lastJoin)
        this.__lastJoin = undefined
        return this
    }
    __finishJoinHaving() {
        if (this.__lastJoin) {
            this.__joins.push(this.__lastJoin)
            this.__lastJoin = undefined
        }
        this.__inHaving = false
    }
    dynamicWhere(): any /*this*/ {
        this.__finishJoinHaving()
        this.__query = ''
        return this
    }
    where(condition: BooleanValueSource<any, any, any>): any /*this*/ {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__where) {
            throw new Error('Illegal state')
        }
        this.__where = condition
        return this
    }
    and(condition: BooleanValueSource<any, any, any>): any /*this*/ {
        this.__query = ''
        if (this.__lastJoin) {
            if (this.__lastJoin.__on) {
                this.__lastJoin.__on = this.__lastJoin.__on.and(condition)
            } else {
                this.__lastJoin.__on = condition
            }
            return this
        }
        if (this.__inHaving) {
            if (this.__having) {
                this.__having = this.__having.and(condition)
            } else {
                this.__having = condition
            }
            return this
        }
        this.__finishJoinHaving()
        if (this.__where) {
            this.__where = this.__where.and(condition)
        } else {
            this.__where = condition
        }
        return this
    }
    or(condition: BooleanValueSource<any, any, any>): any /*this*/ {
        this.__query = ''
        if (this.__lastJoin) {
            if (this.__lastJoin.__on) {
                this.__lastJoin.__on = this.__lastJoin.__on.or(condition)
            } else {
                this.__lastJoin.__on = condition
            }
            return this
        }
        if (this.__inHaving) {
            if (this.__having) {
                this.__having = this.__having.or(condition)
            } else {
                this.__having = condition
            }
            return this
        }
        if (this.__where) {
            this.__where = this.__where.or(condition)
        } else {
            this.__where = condition
        }
        return this
    }
    dynamicHaving(): any /*this*/ {
        this.__finishJoinHaving()
        this.__query = ''
        this.__inHaving = true
        return this
    }
    having(condition: BooleanValueSource<any, any, any>): any /*this*/ {
        this.__finishJoinHaving()
        this.__query = ''
        this.__inHaving = true
        if (this.__having) {
            throw new Error('Illegal state')
        }
        this.__having = condition
        return this
    }
    groupBy(...columns: Array<string| number | symbol | ValueSource<any, any, any>>): any /*this*/ {
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
            }
        }
        return this
    }
    orderBy(column: any, mode?: OrderByMode): any /*this*/ {
        this.__finishJoinHaving()
        this.__query = ''
        if (!this.__orderBy) {
            this.__orderBy = {}
        }
        if (column in this.__orderBy) {
            throw new Error('Column ' + column + ' already used in the order by clause')
        }
        this.__orderBy[column] = mode || null
        return this
    }
    orderByFromString(orderBy: string): any /*this*/ {
        this.__finishJoinHaving()
        this.__query = ''
        const columnsInQuery: { [columnNameInLowerCase: string]: string | undefined } = {}
        const columns = this.__columns
        for (const property in columns) {
            columnsInQuery[property.toLowerCase()] = property
        }

        const split = orderBy.trim().toLowerCase().replace(/\s+/g, ' ').split(/\s*,\s*/)
        for (let i = 0, length = split.length; i < length; i++) {
            const clause = split[i]
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
            } else if (!ordering) {
                this.orderBy(realColumnName)
            } else {
                throw new Error('Unknow ordering clause "' + ordering + '" in the order by related to the column "' + column + '"')
            }
        }
        return this
    }
    limit(limit: int | number | NumberValueSource<any, any, any> | IntValueSource<any, any, any>): any /*this*/ {
        this.__finishJoinHaving()
        this.__query = ''
        this.__limit = limit
        return this
    }
    offset(offset: int | number | NumberValueSource<any, any, any> | IntValueSource<any, any, any>): any /*this*/ {
        this.__finishJoinHaving()
        this.__query = ''
        this.__offset = offset
        return this
    }

    __toSql(SqlBuilder: SqlBuilder, params: any[]): string {
        this.__finishJoinHaving()
        return SqlBuilder._buildSelect(this, params)
    }

}
