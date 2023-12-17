import type { TypeAdapter } from "../TypeAdapter"
import { Argument, AnyValueSource, OptionalType, isValueSource, ValueKind } from "../expressions/values"
import { FragmentValueSource, SqlOperationConstValueSource, SqlOperationValueSourceIfValueAlwaysNoop } from "../internal/ValueSourceImpl"
import { SqlBuilder } from "../sqlBuilders/SqlBuilder"

export class FragmentQueryBuilder {
    __valueKind: ValueKind
    __type: string
    __adapter: TypeAdapter | undefined
    __optionalType: OptionalType

    constructor(valueKind: ValueKind, type: string, optionalType: OptionalType, adapter: TypeAdapter | undefined) {
        this.__valueKind = valueKind
        this.__type = type
        this.__adapter = adapter
        this.__optionalType = optionalType
    }

    sql(sql: TemplateStringsArray, ...params: AnyValueSource[]): AnyValueSource {
        return new FragmentValueSource(sql, params, this.__valueKind, this.__type, this.__optionalType, this.__adapter)
    }
}

export class FragmentFunctionBuilder {
    definitions: Argument<any, any, any, any>[]

    constructor(definitions: Argument<any, any, any, any>[]) {
        this.definitions = definitions
    }
    
    as(impl: (...vs: AnyValueSource[]) => AnyValueSource): ((...args: any[]) => AnyValueSource) {
        return (...args: any[]): AnyValueSource => {
            const newArgs: AnyValueSource[] = []
            for (let i = 0, length = args.length; i < length; i++) {
                const arg = args[i]
                if (isValueSource(arg)) {
                    newArgs.push(arg)
                } else {
                    const definition = this.definitions[i]!
                    const newArg = new SqlOperationConstValueSource(arg, definition.type, definition.typeName, definition.optionalType, definition.adapter)
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
    
    as(impl: (...vs: AnyValueSource[]) => AnyValueSource): ((...args: any[]) => AnyValueSource) {
        return (...args: any[]): AnyValueSource => {
            const newArgs: AnyValueSource[] = []
            for (let i = 0, length = args.length; i < length; i++) {
                const arg = args[i]
                if (isValueSource(arg)) {
                    newArgs.push(arg)
                } else {
                    const definition = this.definitions[i]!
                    const optional = definition.optionalType !== 'required'
                    const valueMode = definition.mode === 'value'
                    if (optional && valueMode) {
                        if (!this.sqlBuilderSource.__sqlBuilder._isValue(arg)) {
                            return new SqlOperationValueSourceIfValueAlwaysNoop()
                        }
                    }
                    const newArg = new SqlOperationConstValueSource(arg, definition.type, definition.typeName, definition.optionalType, definition.adapter)
                    newArgs.push(newArg)
                }
            }
            return impl.apply(undefined, newArgs)
        }
    }
}