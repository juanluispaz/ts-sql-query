import type { SqlBuilder, DeleteData, JoinData, QueryColumns } from "../sqlBuilders/SqlBuilder"
import { ITable, ITableOrView, IWithView, OuterJoinSource, __addWiths, __getTableOrViewPrivate } from "../utils/ITableOrView"
import { IBooleanValueSource, IIfValueSource, AnyValueSource, AlwaysIfValueSource, isValueSource } from "../expressions/values"
import type { DeleteExpression, ExecutableDelete, DynamicExecutableDeleteExpression, DeleteExpressionAllowingNoWhere, DeleteCustomization, CustomizableExecutableDelete, ComposableExecutableDelete, ComposeExpression, ComposeExpressionDeletingInternalProperty, ComposeExpressionDeletingExternalProperty, ComposableCustomizableExecutableDelete, ReturnableExecutableDelete, ExecutableDeleteReturning, DeleteColumns, DeleteWhereExpression, DeleteWhereExpressionAllowingNoWhere, DeleteWhereJoinExpression, DynamicOnExpression, OnExpression, DeleteExpressionWithoutJoin, DeleteUsingExpression, DeleteWhereJoinExpressionAllowingNoWhere, DynamicOnExpressionAllowingNoWhere, OnExpressionAllowingNoWhere, DeleteExpressionWithoutJoinAllowingNoWhere, DeleteUsingExpressionAllowingNoWhere } from "../expressions/delete"
import type { int } from "ts-extended-types"
import ChainedError from "chained-error"
import { attachSource } from "../utils/attachSource"
import { database, tableOrView } from "../utils/symbols"
import { asAlwaysIfValueSource } from "../expressions/values"
import { __getValueSourcePrivate } from "../expressions/values"
import { ComposeSplitQueryBuilder } from "./ComposeSliptQueryBuilder"

export class DeleteQueryBuilder extends ComposeSplitQueryBuilder implements DeleteExpression<any, any>, DeleteExpressionAllowingNoWhere<any, any>, CustomizableExecutableDelete<any>, ExecutableDelete<any>, DynamicExecutableDeleteExpression<any, any>, DeleteData, ComposableExecutableDelete<any, any, any>, ComposeExpression<any, any, any, any, any, any>, ComposeExpressionDeletingInternalProperty<any, any, any, any, any, any>, ComposeExpressionDeletingExternalProperty<any, any, any, any, any, any>, ComposableCustomizableExecutableDelete<any, any, any>, ReturnableExecutableDelete<any, any>, ExecutableDeleteReturning<any, any, any>, DeleteWhereExpression<any, any>, DeleteWhereExpressionAllowingNoWhere<any, any>, DeleteWhereJoinExpression<any, any>, DynamicOnExpression<any, any>, OnExpression<any, any>, DeleteExpressionWithoutJoin<any, any>, DeleteUsingExpression<any, any>, DeleteWhereJoinExpressionAllowingNoWhere<any, any>, DynamicOnExpressionAllowingNoWhere<any, any>, OnExpressionAllowingNoWhere<any, any>, DeleteExpressionWithoutJoinAllowingNoWhere<any, any>, DeleteUsingExpressionAllowingNoWhere<any, any> {
    [database]: any
    [tableOrView]: any

    __table: ITable<any>
    __where?: AlwaysIfValueSource<any, any>
    __allowNoWhere: boolean
    __withs: Array<IWithView<any>> = []
    __customization?: DeleteCustomization<any>
    __columns?: QueryColumns
    __using?: Array<ITableOrView<any>>
    __joins?: Array<JoinData>

    __oneColumn?: boolean
    __lastJoin?: JoinData

    // cache
    __query = ''
    __params: any[] = []

    constructor(sqlBuilder: SqlBuilder, table: ITable<any>, allowNoWhere: boolean) {
        super(sqlBuilder)
        this.__table = table
        __getTableOrViewPrivate(table).__addWiths(this.__withs)
        this.__allowNoWhere = allowNoWhere
    }

    executeDelete(min?: number, max?: number): Promise<int> & Promise<number> {
        this.query()
        const source = new Error('Query executed at')
        try {
            let result = this.__sqlBuilder._queryRunner.executeDelete(this.__query, this.__params).catch((e) => {
                throw attachSource(new ChainedError(e), source)
            }) as Promise<int>
            if (min !== undefined) {
                result = result.then((count) => {
                    if (count < min) {
                        throw attachSource(new Error("The delete operation didn't delete the minimum of " + min + " row(s)"), source)
                    }
                    if (max !== undefined && count > max) {
                        throw attachSource(new Error("The delete operation deleted more that the maximum of " + max + " row(s)"), source)
                    }
                    return count
                })
            }
            return result
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    executeDeleteNoneOrOne(): Promise<any> {
        this.query()
        const source = new Error('Query executed at')
        try {
            this.__sqlBuilder._resetUnique()
            let result
            if (this.__oneColumn) {
                result = this.__sqlBuilder._queryRunner.executeDeleteReturningOneColumnOneRow(this.__query, this.__params).then((value) => {
                    const valueSource = this.__columns!['result']!
                    if (!isValueSource(valueSource)) {
                        throw new Error('The result column must be a ValueSource')
                    }
                    if (value === undefined) {
                        return null
                    }
                    return this.__transformValueFromDB(valueSource, value)
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            } else {
                result = this.__sqlBuilder._queryRunner.executeDeleteReturningOneRow(this.__query, this.__params).then((row) => {
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
    executeDeleteOne(): Promise<any> {
        this.query()
        const source = new Error('Query executed at')
        try {
            this.__sqlBuilder._resetUnique()
            let result
            if (this.__oneColumn) {
                result = this.__sqlBuilder._queryRunner.executeDeleteReturningOneColumnOneRow(this.__query, this.__params).then((value) => {
                    const valueSource = this.__columns!['result']!
                    if (!isValueSource(valueSource)) {
                        throw new Error('The result column must be a ValueSource')
                    }
                    if (value === undefined) {
                        throw new Error('No result returned by the database')
                    }
                    return this.__transformValueFromDB(valueSource, value)
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            } else {
                result = this.__sqlBuilder._queryRunner.executeDeleteReturningOneRow(this.__query, this.__params).then((row) => {
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
    executeDeleteMany(min?: number, max?: number): Promise<any> {
        const source = new Error('Query executed at')
        this.query()
        try {
            this.__sqlBuilder._resetUnique()
            let result
            if (this.__oneColumn) {
                result = this.__sqlBuilder._queryRunner.executeDeleteReturningOneColumnManyRows(this.__query, this.__params).then((values) => {
                    const valueSource = this.__columns!['result']!
                    if (!isValueSource(valueSource)) {
                        throw new Error('The result column must be a ValueSource')
                    }

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
                result = this.__sqlBuilder._queryRunner.executeDeleteReturningManyRows(this.__query, this.__params).then((rows) => {
                    return rows.map((row, index) => {
                        return this.__transformRow(row, index)
                    })
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            }
            if (min !== undefined) {
                result = result.then((rows) => {
                    const count = rows.length
                    if (count < min) {
                        throw attachSource(new Error("The delete operation didn't delete the minimum of " + min + " row(s)"), source)
                    }
                    if (max !== undefined && count > max) {
                        throw attachSource(new Error("The delete operation deleted more that the maximum of " + max + " row(s)"), source)
                    }
                    return rows
                })
            }
            return this.__applyCompositions(result, source)
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    query(): string {
        this.__finishJoin()
        if (this.__query) {
            return this.__query
        }
        try {
            this.__query = this.__sqlBuilder._buildDelete(this, this.__params)
        } catch (e) {
            throw new ChainedError(e)
        }
        return this.__query
    }
    params(): any[] {
        this.__finishJoin()
        if (!this.__query) {
            this.query()
        }
        return this.__params
    }

    dynamicWhere(): this {
        this.__finishJoin()
        this.__query = ''
        return this
    }
    where(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): this {
        this.__finishJoin()
        this.__query = ''
        if (this.__where) {
            throw new Error('Illegal state')
        }
        this.__where = asAlwaysIfValueSource(condition)
        __getValueSourcePrivate(condition).__addWiths(this.__withs)
        return this
    }
    and(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): this {
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
        if (this.__where) {
            this.__where = this.__where.and(asAlwaysIfValueSource(condition))
        } else {
            this.__where = asAlwaysIfValueSource(condition)
        }
        return this
    }
    or(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): this {
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
        if (this.__where) {
            this.__where = this.__where.or(asAlwaysIfValueSource(condition))
        } else {
            this.__where = asAlwaysIfValueSource(condition)
        }
        return this
    }



    using(table: ITableOrView<any>): any {
        this.__finishJoin()
        this.__query = ''
        if (!this.__using) {
            this.__using = []
        }
        this.__using.push(table)
        __getTableOrViewPrivate(table).__addWiths(this.__withs)
        return this
    }
    join(table: ITableOrView<any>): any {
        this.__finishJoin()
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
        this.__finishJoin()
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
        this.__finishJoin()
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
        this.__finishJoin()
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
        if (!this.__joins) {
            this.__joins = []
        }
        this.__joins.push(this.__lastJoin)
        this.__lastJoin = undefined
        __getValueSourcePrivate(condition).__addWiths(this.__withs)
        return this
    }
    __finishJoin() {
        if (this.__lastJoin) {
            if (!this.__joins) {
                this.__joins = []
            }
            this.__joins.push(this.__lastJoin)
            this.__lastJoin = undefined
        }
    }


    
    customizeQuery(customization: DeleteCustomization<any>): this {
        this.__finishJoin()
        this.__customization = customization
        __addWiths(customization.afterDeleteKeyword, this.__withs)
        __addWiths(customization.afterQuery, this.__withs)
        return this
    }

    returning(columns: DeleteColumns<any, any>): this {
        this.__finishJoin()
        this.__query = ''
        this.__columns = columns
        this.__registerTableOrViewWithOfColumns(columns, this.__withs)
        return this
    }
    
    returningOneColumn(column: AnyValueSource): this {
        this.__finishJoin()
        this.__query = ''
        this.__oneColumn = true
        this.__columns = { 'result': column }
        __getValueSourcePrivate(column).__addWiths(this.__withs)
        return this
    }
}