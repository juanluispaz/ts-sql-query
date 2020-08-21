import { TypeAdapter } from "../TypeAdapter"
import { FragmentValueSource, ValueSourceImpl, SqlOperationStatic1ValueSource } from "../internal/ValueSourceImpl"
import { ValueSource, Argument } from "../expressions/values"

/*
// Alternative implementation but doen't work in TS 3.5.3 because 'Type instantiation is excessively deep and possibly infinite.' on AbstractConnection

export class FragmentQueryBuilder extends FragmentExpression<any, any> {
    __sql: TemplateStringsArray
    __params: ValueSource<any, any, any>[]

    constructor(sql: TemplateStringsArray, params: ValueSource<any, any, any>[]) {
        super()
        this.__sql = sql
        this.__params = params
    }

    withType(type: 'boolean', required: 'required', adapter?: TypeAdapter): BooleanValueSource<any, any, boolean>
    withType(type: 'boolean', required: 'optional', adapter?: TypeAdapter): BooleanValueSource<any, any, boolean | null | undefined>
    withType(this: AbstractFragmentExpression<TypeSafeDB, any>, type: 'stringInt', required: 'required', adapter?: TypeAdapter): StringIntValueSource<any, any, stringInt>
    withType(this: AbstractFragmentExpression<TypeSafeDB, any>, type: 'stringInt', required: 'optional', adapter?: TypeAdapter): StringIntValueSource<any, any, stringInt | null | undefined>
    withType(this: AbstractFragmentExpression<TypeUnsafeDB, any>, type: 'stringInt', required: 'required', adapter?: TypeAdapter): StringNumberValueSource<any, any, number | string>
    withType(this: AbstractFragmentExpression<TypeUnsafeDB, any>, type: 'stringInt', required: 'optional', adapter?: TypeAdapter): StringNumberValueSource<any, any, number | string | null | undefined>
    withType(this: AbstractFragmentExpression<TypeSafeDB, any>, type: 'int', required: 'required', adapter?: TypeAdapter): IntValueSource<any, any, int>
    withType(this: AbstractFragmentExpression<TypeSafeDB, any>, type: 'int', required: 'optional', adapter?: TypeAdapter): IntValueSource<any, any, int | null | undefined>
    withType(this: AbstractFragmentExpression<TypeUnsafeDB, any>, type: 'int', required: 'required', adapter?: TypeAdapter): NumberValueSource<any, any, number>
    withType(this: AbstractFragmentExpression<TypeUnsafeDB, any>, type: 'int', required: 'optional', adapter?: TypeAdapter): NumberValueSource<any, any, number | null | undefined>
    withType(this: AbstractFragmentExpression<TypeSafeDB, any>, type: 'stringDouble', required: 'required', adapter?: TypeAdapter): StringDoubleValueSource<any, any, stringDouble>
    withType(this: AbstractFragmentExpression<TypeSafeDB, any>, type: 'stringDouble', required: 'optional', adapter?: TypeAdapter): StringDoubleValueSource<any, any, stringDouble | null | undefined>
    withType(this: AbstractFragmentExpression<TypeUnsafeDB, any>, type: 'stringDouble', required: 'required', adapter?: TypeAdapter): StringNumberValueSource<any, any, number | string>
    withType(this: AbstractFragmentExpression<TypeUnsafeDB, any>, type: 'stringDouble', required: 'optional', adapter?: TypeAdapter): StringNumberValueSource<any, any, number | string | null | undefined>
    withType(this: AbstractFragmentExpression<TypeSafeDB, any>, type: 'double', required: 'required', adapter?: TypeAdapter): DoubleValueSource<any, any, double>
    withType(this: AbstractFragmentExpression<TypeSafeDB, any>, type: 'double', required: 'optional', adapter?: TypeAdapter): DoubleValueSource<any, any, double | null | undefined>
    withType(this: AbstractFragmentExpression<TypeUnsafeDB, any>, type: 'double', required: 'required', adapter?: TypeAdapter): NumberValueSource<any, any, number>
    withType(this: AbstractFragmentExpression<TypeUnsafeDB, any>, type: 'double', required: 'optional', adapter?: TypeAdapter): NumberValueSource<any, any, number | null | undefined>
    withType(this: AbstractFragmentExpression<TypeSafeDB, any>, type: 'string', required: 'required', adapter?: TypeAdapter): TypeSafeStringValueSource<any, any, string>
    withType(this: AbstractFragmentExpression<TypeSafeDB, any>, type: 'string', required: 'optional', adapter?: TypeAdapter): TypeSafeStringValueSource<any, any, string | null | undefined>
    withType(this: AbstractFragmentExpression<TypeUnsafeDB, any>, type: 'string', required: 'required', adapter?: TypeAdapter): StringValueSource<any, any, string>
    withType(this: AbstractFragmentExpression<TypeUnsafeDB, any>, type: 'string', required: 'optional', adapter?: TypeAdapter): StringValueSource<any, any, string | null | undefined>
    withType(this: AbstractFragmentExpression<TypeSafeDB, any>, type: 'localDate', required: 'required', adapter?: TypeAdapter): LocalDateValueSource<any, any, LocalDate>
    withType(this: AbstractFragmentExpression<TypeSafeDB, any>, type: 'localDate', required: 'optional', adapter?: TypeAdapter): LocalDateValueSource<any, any, LocalDate | null | undefined>
    withType(this: AbstractFragmentExpression<TypeUnsafeDB, any>, type: 'localDate', required: 'required', adapter?: TypeAdapter):  DateValueSource<any, any, Date>
    withType(this: AbstractFragmentExpression<TypeUnsafeDB, any>, type: 'localDate', required: 'optional', adapter?: TypeAdapter):  DateValueSource<any, any, Date | null | undefined>
    withType(this: AbstractFragmentExpression<TypeSafeDB, any>, type: 'localTime', required: 'required', adapter?: TypeAdapter): LocalTimeValueSource<any, any, LocalTime>
    withType(this: AbstractFragmentExpression<TypeSafeDB, any>, type: 'localTime', required: 'optional', adapter?: TypeAdapter): LocalTimeValueSource<any, any, LocalTime | null | undefined>
    withType(this: AbstractFragmentExpression<TypeUnsafeDB, any>, type: 'localTime', required: 'required', adapter?: TypeAdapter): TimeValueSource<any, any, Date>
    withType(this: AbstractFragmentExpression<TypeUnsafeDB, any>, type: 'localTime', required: 'optional', adapter?: TypeAdapter): TimeValueSource<any, any, Date | null | undefined>
    withType(this: AbstractFragmentExpression<TypeSafeDB, any>, type: 'localDateTime', required: 'required', adapter?: TypeAdapter): LocalDateTimeValueSource<any, any, LocalDateTime>
    withType(this: AbstractFragmentExpression<TypeSafeDB, any>, type: 'localDateTime', required: 'optional', adapter?: TypeAdapter): LocalDateTimeValueSource<any, any, LocalDateTime | null | undefined>
    withType(this: AbstractFragmentExpression<TypeUnsafeDB, any>, type: 'localDateTime', required: 'required', adapter?: TypeAdapter): DateTimeValueSource<any, any, Date>
    withType(this: AbstractFragmentExpression<TypeUnsafeDB, any>, type: 'localDateTime', required: 'optional', adapter?: TypeAdapter): DateTimeValueSource<any, any, Date | null | undefined>
    withType<T>(type: 'enum', typeName: string, required: 'required', adapter?: TypeAdapter): EqualableValueSource<any, any, T>
    withType<T>(type: 'enum', typeName: string, required: 'optional', adapter?: TypeAdapter): EqualableValueSource<any, any, T | null | undefined>
    withType<T>(type: 'custom', typeName: string, required: 'required', adapter?: TypeAdapter): EqualableValueSource<any, any, T>
    withType<T>(type: 'custom', typeName: string, required: 'optional', adapter?: TypeAdapter): EqualableValueSource<any, any, T | null | undefined>
    withType<T>(type: 'customComparable', typeName: string, required: 'required', adapter?: TypeAdapter): ComparableValueSource<any, any, T>
    withType<T>(type: 'customComparable', typeName: string, required: 'optional', adapter?: TypeAdapter): ComparableValueSource<any, any, T | null | undefined>
    withType<_T>(type: string, required: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): ValueSource<any, any, any> {
        if (typeof adapter === 'string') {
            type = required
        } else {
            adapter2 = adapter
        }
        return new FragmentValueSource(this.__sql, this.__params, type, adapter2)
    }
}

*/

export class FragmentQueryBuilder {
    __type: string
    __adapter: TypeAdapter | undefined

    constructor(type: string, adapter: TypeAdapter | undefined) {
        this.__type = type
        this.__adapter = adapter
    }

    sql(sql: TemplateStringsArray, ...params: ValueSource<any, any, any>[]): ValueSource<any, any, any> {
        return new FragmentValueSource(sql, params, this.__type, this.__adapter)
    }
}

export class FragmentFunctionBuilder {
    definitions: Argument<any, any, any>[]

    constructor(definitions: Argument<any, any, any>[]) {
        this.definitions = definitions
    }
    
    as(impl: (...vs: ValueSource<any, any, any>[]) => ValueSource<any, any, any>): ((...args: any[]) => ValueSource<any, any, any>) {
        return (...args: any[]): ValueSource<any, any, any> => {
            const newArgs: ValueSource<any, any, any>[] = []
            for (let i = 0, length = args.length; i < length; i++) {
                const arg = args[i]
                if (arg instanceof ValueSourceImpl) {
                    newArgs.push(arg)
                } else {
                    const definition = this.definitions[i]
                    const newArg = new SqlOperationStatic1ValueSource('_const', arg, definition.typeName, definition.adapter)
                    newArgs.push(newArg)
                }
            }
            return impl.apply(undefined, newArgs)
        }
    }
}