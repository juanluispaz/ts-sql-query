import type { TypeAdapter } from "../TypeAdapter"
import type { ValueSource, Argument } from "../expressions/values"
import { FragmentValueSource, ValueSourceImpl, SqlOperationStatic1ValueSource } from "../internal/ValueSourceImpl"

export class FragmentQueryBuilder {
    __type: string
    __adapter: TypeAdapter | undefined

    constructor(type: string, adapter: TypeAdapter | undefined) {
        this.__type = type
        this.__adapter = adapter
    }

    sql(sql: TemplateStringsArray, ...params: ValueSource<any, any>[]): ValueSource<any, any> {
        return new FragmentValueSource(sql, params, this.__type, this.__adapter)
    }
}

export class FragmentFunctionBuilder {
    definitions: Argument<any, any, any>[]

    constructor(definitions: Argument<any, any, any>[]) {
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
                    const newArg = new SqlOperationStatic1ValueSource('_const', arg, definition.typeName, definition.adapter)
                    newArgs.push(newArg)
                }
            }
            return impl.apply(undefined, newArgs)
        }
    }
}