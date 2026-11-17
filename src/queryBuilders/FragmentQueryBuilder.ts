import type { TypeAdapter } from '../TypeAdapter.js'
import { __createConst, __createFragment, __createIfValueAlwaysNoop, __asNodeValueSource, __copyOfValueSource, isValueSource } from '../typeSystem/valueSourceFactory.js'
import type { SqlBuilder } from '../sqlBuilders/SqlBuilder.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import type { AnyValueSource, OptionalType } from '../typeSystem/valueSource.js'
import { __mergeOptional } from '../typeSystem/valueSource.js'
import { Argument } from '../typeSystem/arguments.js'
import { __adaptedTypeClassOf } from '../nodes/adaptedTypeClass.js'

export class FragmentQueryBuilder {
    __typeClass: DataTypeClass
    __adapter: TypeAdapter | undefined
    __optionalType: OptionalType
    __isAggregate: boolean

    constructor(typeClass: DataTypeClass, optionalType: OptionalType, adapter: TypeAdapter | undefined, isAggregate: boolean = false) {
        this.__typeClass = typeClass
        this.__adapter = adapter
        this.__optionalType = optionalType
        this.__isAggregate = isAggregate
    }

    sql(sql: TemplateStringsArray, ...params: AnyValueSource[]): AnyValueSource {
        return __createFragment(sql, params, this.__typeClass, this.__optionalType, this.__adapter, this.__isAggregate)
    }
}

export class FragmentFunctionBuilder {
    definitions: Argument<any, any, any>[]
    isAggregate: boolean

    constructor(definitions: Argument<any, any, any>[], isAggregate: boolean = false) {
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
                    const newArg = __createConst(arg, __adaptedTypeClassOf(definition.typeClass, definition.adapter), definition.optionalType)
                    newArgs.push(newArg)
                }
            }
            const result = impl.apply(undefined, newArgs)
            return this.isAggregate ? asAggregate(result) : result
        }
    }
}

export interface SqlBuilderSource {
    __sqlBuilder: SqlBuilder
}

export class FragmentFunctionBuilderIfValue {
    definitions: Argument<any, any, any>[]
    sqlBuilderSource: SqlBuilderSource
    isAggregate: boolean

    constructor(sqlBuilderSource: SqlBuilderSource, definitions: Argument<any, any, any>[], isAggregate: boolean = false) {
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
                    const newArg = __createConst(arg, __adaptedTypeClassOf(definition.typeClass, definition.adapter), definition.optionalType)
                    newArgs.push(newArg)
                }
            }
            const result = impl.apply(undefined, newArgs)
            if (noValue) {
                // The fragment is ignored, but the neutral boolean that takes its place keeps the optional type of the
                // boolean expression the fragment builds, the same one returned when the value is provided. The
                // expression is built and discarded here only to get it: it is not stored anywhere else, it lives in
                // the value returned by the implementation function.
                return __createIfValueAlwaysNoop(__asNodeValueSource(result).__optionalType)
            }
            return this.isAggregate ? asAggregate(result) : result
        }
    }
}

export class FragmentFunctionBuilderMaybeOptional {
    definitions: Argument<any, any, any>[]
    sqlBuilderSource: SqlBuilderSource
    isAggregate: boolean

    constructor(sqlBuilderSource: SqlBuilderSource, definitions: Argument<any, any, any>[], isAggregate: boolean = false) {
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
                    argOptionalType = __asNodeValueSource(arg).__optionalType
                    newArgs.push(arg)
                } else {
                    if (this.sqlBuilderSource.__sqlBuilder._isValue(arg)) {
                        argOptionalType = 'required'
                    } else {
                        argOptionalType = 'optional'
                    }
                    const definition = this.definitions[i]!
                    const newArg = __createConst(arg, __adaptedTypeClassOf(definition.typeClass, definition.adapter), definition.optionalType)
                    newArgs.push(newArg)
                }
                optionalType = __mergeOptional(optionalType, argOptionalType)
            }
            const result = impl.apply(undefined, newArgs)
            const resultWithOptionalType = withOptionalType(result, optionalType)
            return this.isAggregate ? asAggregate(resultWithOptionalType) : resultWithOptionalType
        }
    }
}

/*
 * The function of a fragment builds its value source, which can be one that already exists (one of its arguments): a
 * value source is not written once created, so what the builder says of the result goes on a copy of it
 */

/** The value source with the optionality its arguments give */
function withOptionalType(valueSource: AnyValueSource, optionalType: OptionalType): AnyValueSource {
    const nodeValueSource = __asNodeValueSource(valueSource)
    if (nodeValueSource.__optionalType === optionalType) {
        return valueSource
    }
    const copy = __copyOfValueSource(nodeValueSource)
    copy.__optionalType = optionalType
    return copy
}

/** The value source declared an aggregate (a function of aggregate fragments) */
function asAggregate(valueSource: AnyValueSource): AnyValueSource {
    const nodeValueSource = __asNodeValueSource(valueSource)
    if (nodeValueSource.__isAggregate) {
        return valueSource
    }
    const copy = __copyOfValueSource(nodeValueSource)
    copy.__isAggregate = true
    return copy
}
