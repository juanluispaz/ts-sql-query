import type { SqlBuilder, DeleteData } from "../sqlBuilders/SqlBuilder"
import type { ITable } from "../utils/ITableOrView"
import type { BooleanValueSource } from "../expressions/values"
import type { DeleteExpression, ExecutableDelete, DynamicExecutableDeleteExpression, DeleteExpressionAllowingNoWhere } from "../expressions/delete"
import type { int } from "ts-extended-types"
import ChainedError from "chained-error"
import { attachSource } from "../utils/attachSource"
import { database, tableOrView } from "../utils/symbols"

export class DeleteQueryBuilder implements DeleteExpression<any>, DeleteExpressionAllowingNoWhere<any>, ExecutableDelete<any>, DynamicExecutableDeleteExpression<any>, DeleteData {
    [database]: any
    [tableOrView]: any
    __sqlBuilder: SqlBuilder

    __table: ITable<any>
    __where?: BooleanValueSource<any, any>
    __allowNoWhere: boolean

    // cache
    __query = ''
    __params: any[] = []

    constructor(sqlBuilder: SqlBuilder, table: ITable<any>, allowNoWhere: boolean) {
        this.__sqlBuilder = sqlBuilder
        this.__table = table
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
    query(): string {
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
        if (!this.__query) {
            this.query()
        }
        return this.__params
    }

    dynamicWhere(): this {
        this.__query = ''
        return this
    }
    where(condition: BooleanValueSource<any, any>): this {
        this.__query = ''
        if (this.__where) {
            throw new Error('Illegal state')
        }
        this.__where = condition
        return this
    }
    and(condition: BooleanValueSource<any, any>): this {
        this.__query = ''
        if (this.__where) {
            this.__where = this.__where.and(condition)
        } else {
            this.__where = condition
        }
        return this
    }
    or(condition: BooleanValueSource<any, any>): this {
        this.__query = ''
        if (this.__where) {
            this.__where = this.__where.or(condition)
        } else {
            this.__where = condition
        }
        return this
    }
}
