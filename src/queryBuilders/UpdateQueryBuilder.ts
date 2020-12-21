import type { SqlBuilder, UpdateData } from "../sqlBuilders/SqlBuilder"
import type { ITable } from "../utils/ITableOrView"
import type { BooleanValueSource } from "../expressions/values"
import type { UpdateExpression, ExecutableUpdate, ExecutableUpdateExpression, DynamicExecutableUpdateExpression, UpdateExpressionAllowingNoWhere, NotExecutableUpdateExpression } from "../expressions/update"
import type { int } from "ts-extended-types"
import ChainedError from "chained-error"
import { attachSource } from "../utils/attachSource"
import { database } from "../utils/symbols"

export class UpdateQueryBuilder implements UpdateExpression<any, any>, UpdateExpressionAllowingNoWhere<any, any>, ExecutableUpdate<any>, ExecutableUpdateExpression<any, any>, NotExecutableUpdateExpression<any, any>, DynamicExecutableUpdateExpression<any, any>, UpdateData {
    [database]: any
    __sqlBuilder: SqlBuilder

    __table: ITable<any>
    __sets: { [property: string] : any} = {}
    __where?: BooleanValueSource<any, any, any>
    __allowNoWhere: boolean

    // cache
    __params: any[] = []
    __query = ''

    constructor(sqlBuilder: SqlBuilder, table: ITable<any>, allowNoWhere: boolean) {
        this.__sqlBuilder = sqlBuilder
        this.__table = table
        this.__allowNoWhere = allowNoWhere
    }

    executeUpdate(min?: number, max?: number): Promise<int> & Promise<number> {
        this.query()
        const source = new Error('Query executed at')
        try {
            let result = this.__sqlBuilder._queryRunner.executeUpdate(this.__query, this.__params).catch((e) => {
                throw attachSource(new ChainedError(e), source)
            }) as Promise<int>
            if (min !== undefined) {
                result = result.then((count) => {
                    if (count < min) {
                        throw attachSource(new Error("The update operation didn't update the minimum of " + min + " row(s)"), source)
                    }
                    if (max !== undefined && count > max) {
                        throw attachSource(new Error("The update operation updated more that the maximum of " + max + " row(s)"), source)
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
            this.__query = this.__sqlBuilder._buildUpdate(this, this.__params)
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

    dynamicSet(): this {
        this.__query = ''
        return this
    }
    set(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        let sets = this.__sets
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            const value = columns[property]
            sets[property] = value
        }
        return this
    }
    setIfValue(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        let sets = this.__sets
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            const value = columns[property]
            if (value === null || value === undefined) {
                continue
            }
            sets[property] = value
        }
        return this
    }
    setIfSet(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        let sets = this.__sets
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (!(property in sets)) {
                continue
            }
            const value = columns[property]
            sets[property] = value
        }
        return this
    }
    setIfSetIfValue(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        let sets = this.__sets
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (!(property in sets)) {
                continue
            }
            const value = columns[property]
            if (value === null || value === undefined) {
                continue
            }
            sets[property] = value
        }
        return this
    }
    setIfNotSet(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        let sets = this.__sets
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (property in sets) {
                continue
            }
            const value = columns[property]
            sets[property] = value
        }
        return this
    }
    setIfNotSetIfValue(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        let sets = this.__sets
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (property in sets) {
                continue
            }
            const value = columns[property]
            if (value === null || value === undefined) {
                continue
            }
            sets[property] = value
        }
        return this
    }
    ignoreIfSet(...columns: any[]): this {
        this.__query = ''
        let sets = this.__sets
        for (let i = 0, length = columns.length; i < length; i++) {
            let column = columns[i]
            delete sets[column]
        }
        return this
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
