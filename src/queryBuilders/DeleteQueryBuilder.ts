import { SqlBuilder, DeleteData } from "../sqlBuilders/SqlBuilder"
import { ITable } from "../utils/ITableOrView"
import { BooleanValueSource } from "../expressions/values"
import { DeleteExpression, ExecutableDelete, DynamicExecutableDeleteExpression, DeleteExpressionAllowingNoWhere } from "../expressions/delete"
import { int } from "ts-extended-types"
import ChainedError from "chained-error"
import { attachSource } from "../utils/attachSource"

export class DeleteQueryBuilder extends DeleteExpression<any, any> implements DeleteExpressionAllowingNoWhere<any, any>, ExecutableDelete<any>, DynamicExecutableDeleteExpression<any, any>, DeleteData {
    __sqlBuilder: SqlBuilder

    __table: ITable<any>
    __where?: BooleanValueSource<any, any, any>
    __allowNoWhere: boolean

    // cache
    __query = ''
    __params: any[] = []

    constructor(sqlBuilder: SqlBuilder, table: ITable<any>, allowNoWhere: boolean) {
        super()
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
    where(condition: BooleanValueSource<any, any, any>): this {
        this.__query = ''
        if (this.__where) {
            throw new Error('Illegal state')
        }
        this.__where = condition
        return this
    }
    and(condition: BooleanValueSource<any, any, any>): this {
        this.__query = ''
        if (this.__where) {
            this.__where = this.__where.and(condition)
        } else {
            this.__where = condition
        }
        return this
    }
    or(condition: BooleanValueSource<any, any, any>): this {
        this.__query = ''
        if (this.__where) {
            this.__where = this.__where.or(condition)
        } else {
            this.__where = condition
        }
        return this
    }
}
