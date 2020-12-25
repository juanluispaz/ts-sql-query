import type { TypeAdapter } from "../TypeAdapter"
import type { ValueSource, Argument } from "../expressions/values"
import { FragmentValueSource, ValueSourceImpl, SqlOperationConstValueSource, SqlOperationValueSourceIfValueAlwaysNoop } from "../internal/ValueSourceImpl"
import { SqlBuilder } from "../sqlBuilders/SqlBuilder"

export class FragmentQueryBuilder {
    __type: string
    __adapter: TypeAdapter | undefined
    __isOptional: boolean

    constructor(type: string, optional: boolean, adapter: TypeAdapter | undefined) {
        this.__type = type
        this.__adapter = adapter
        this.__isOptional = optional
    }

    sql(sql: TemplateStringsArray, ...params: ValueSource<any, any>[]): ValueSource<any, any> {
        return new FragmentValueSource(this.__isOptional, sql, params, this.__type, this.__adapter)
    }
}

export class FragmentFunctionBuilder {
    definitions: Argument<any, any, any, any>[]

    constructor(definitions: Argument<any, any, any, any>[]) {
        this.definitions = definitions
    }
    
    as(impl: (...vs: ValueSource<any, any>[]) => ValueSource<any, any>): ((...args: any[]) => ValueSource<any, any>) {
        return (...args: any[]): ValueSource<any, any> => {
            const newArgs: ValueSource<any, any>[] = []
            for (let i = 0, length = args.length; i < length; i++) {
                const arg = args[i]
                if (arg instanceof ValueSourceImpl) {
                    newArgs.push(arg)
                } else {
                    const definition = this.definitions[i]!
                    const optional = definition.required === 'optional'
                    const newArg = new SqlOperationConstValueSource(optional, arg, definition.typeName, definition.adapter)
                    newArgs.push(newArg)
                }
            }
            return impl.apply(undefined, newArgs)
        }
    }
}

export interface SqlBuilderSource {
    __sqlBuilder: SqlBuilder
}

export class FragmentFunctionBuilderIfValue {
    definitions: Argument<any, any, any, any>[]
    sqlBuilderSource: SqlBuilderSource

    constructor(sqlBuilderSource: SqlBuilderSource, definitions: Argument<any, any, any, any>[]) {
        this.sqlBuilderSource = sqlBuilderSource
        this.definitions = definitions
    }
    
    as(impl: (...vs: ValueSource<any, any>[]) => ValueSource<any, any>): ((...args: any[]) => ValueSource<any, any>) {
        return (...args: any[]): ValueSource<any, any> => {
            const newArgs: ValueSource<any, any>[] = []
            for (let i = 0, length = args.length; i < length; i++) {
                const arg = args[i]
                if (arg instanceof ValueSourceImpl) {
                    newArgs.push(arg)
                } else {
                    const definition = this.definitions[i]!
                    const optional = definition.required === 'optional'
                    const valueMode = definition.mode === 'value'
                    if (optional && valueMode) {
                        if (!this.sqlBuilderSource.__sqlBuilder._isValue(arg)) {
                            return new SqlOperationValueSourceIfValueAlwaysNoop()
                        }
                    }
                    const newArg = new SqlOperationConstValueSource(optional, arg, definition.typeName, definition.adapter)
                    newArgs.push(newArg)
                }
            }
            return impl.apply(undefined, newArgs)
        }
    }
}