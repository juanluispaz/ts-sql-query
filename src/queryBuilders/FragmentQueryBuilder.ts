import type { TypeAdapter } from '../TypeAdapter.js'
import type { AnyValueSource, OptionalType, ValueType } from '../expressions/values.js'
import { Argument, isValueSource, __getValueSourcePrivate, __mergeOptional } from '../expressions/values.js'
import { FragmentValueSource, SqlOperationConstValueSource, SqlOperationValueSourceIfValueAlwaysNoop } from '../internal/ValueSourceImpl.js'
import type { SqlBuilder } from '../sqlBuilders/SqlBuilder.js'

export class FragmentQueryBuilder {
    __type: ValueType
    __typeName: string
    __adapter: TypeAdapter | undefined
    __optionalType: OptionalType
    __isAggregate: boolean

    constructor(type: ValueType, typeName: string, optionalType: OptionalType, adapter: TypeAdapter | undefined, isAggregate: boolean = false) {
        this.__type = type
        this.__typeName = typeName
        this.__adapter = adapter
        this.__optionalType = optionalType
        this.__isAggregate = isAggregate
    }

    sql(sql: TemplateStringsArray, ...params: AnyValueSource[]): AnyValueSource {
        return new FragmentValueSource(sql, params, this.__type, this.__typeName, this.__optionalType, this.__adapter, this.__isAggregate)
    }
}

export class FragmentFunctionBuilder {
    definitions: Argument<any, any, any, any>[]
    isAggregate: boolean

    constructor(definitions: Argument<any, any, any, any>[], isAggregate: boolean = false) {
        this.definitions = definitions
        this.isAggregate = isAggregate
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
            const result = impl.apply(undefined, newArgs)
            if (this.isAggregate) {
                __getValueSourcePrivate(result).__isAggregate = true
            }
            return result
        }
    }
}

export interface SqlBuilderSource {
    __sqlBuilder: SqlBuilder
}

export class FragmentFunctionBuilderIfValue {
    definitions: Argument<any, any, any, any>[]
    sqlBuilderSource: SqlBuilderSource
    isAggregate: boolean

    constructor(sqlBuilderSource: SqlBuilderSource, definitions: Argument<any, any, any, any>[], isAggregate: boolean = false) {
        this.sqlBuilderSource = sqlBuilderSource
        this.definitions = definitions
        this.isAggregate = isAggregate
    }

    as(impl: (...vs: AnyValueSource[]) => AnyValueSource): ((...args: any[]) => AnyValueSource) {
        return (...args: any[]): AnyValueSource => {
            const newArgs: AnyValueSource[] = []
            let noValue = false
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
                            noValue = true
                        }
                    }
                    const newArg = new SqlOperationConstValueSource(arg, definition.type, definition.typeName, definition.optionalType, definition.adapter)
                    newArgs.push(newArg)
                }
            }
            const result = impl.apply(undefined, newArgs)
            if (noValue) {
                // The fragment is ignored, but the neutral boolean that takes its place keeps the optional type of the
                // boolean expression the fragment builds, the same one returned when the value is provided. The
                // expression is built and discarded here only to get it: it is not stored anywhere else, it lives in
                // the value returned by the implementation function.
                return new SqlOperationValueSourceIfValueAlwaysNoop(__getValueSourcePrivate(result).__optionalType)
            }
            if (this.isAggregate) {
                __getValueSourcePrivate(result).__isAggregate = true
            }
            return result
        }
    }
}

export class FragmentFunctionBuilderMaybeOptional {
    definitions: Argument<any, any, any, any>[]
    sqlBuilderSource: SqlBuilderSource
    isAggregate: boolean

    constructor(sqlBuilderSource: SqlBuilderSource, definitions: Argument<any, any, any, any>[], isAggregate: boolean = false) {
        this.sqlBuilderSource = sqlBuilderSource
        this.definitions = definitions
        this.isAggregate = isAggregate
    }

    as(impl: (...vs: AnyValueSource[]) => AnyValueSource): ((...args: any[]) => AnyValueSource) {
        return (...args: any[]): AnyValueSource => {
            let optionalType: OptionalType = 'required'
            const newArgs: AnyValueSource[] = []
            for (let i = 0, length = args.length; i < length; i++) {
                const arg = args[i]
                let argOptionalType: OptionalType
                if (isValueSource(arg)) {
                    argOptionalType = __getValueSourcePrivate(arg).__optionalType
                    newArgs.push(arg)
                } else {
                    if (this.sqlBuilderSource.__sqlBuilder._isValue(arg)) {
                        argOptionalType = 'required'
                    } else {
                        argOptionalType = 'optional'
                    }
                    const definition = this.definitions[i]!
                    const newArg = new SqlOperationConstValueSource(arg, definition.type, definition.typeName, definition.optionalType, definition.adapter)
                    newArgs.push(newArg)
                }
                optionalType = __mergeOptional(optionalType, argOptionalType)
            }
            const result = impl.apply(undefined, newArgs)
            __getValueSourcePrivate(result).__optionalType = optionalType
            if (this.isAggregate) {
                __getValueSourcePrivate(result).__isAggregate = true
            }
            return result
        }
    }
}