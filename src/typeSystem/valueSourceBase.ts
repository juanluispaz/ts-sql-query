import type { CustomType } from '../TypeAdapter.js'
import { BaseType, type AnyType, type ValueSource } from './base.js'
import { __getValueSourcePrivate, isValueSource } from './valueSource.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { logicalTypes, numberTypes } from '../utils/symbols.js'

/**
 * The boolean of a condition the comparisons of a value source give: a static of the class of its data type
 * (`[logicalTypes]`), because the bases that compare can't import the data types that extend them
 */
export function __conditionTypeOf(valueSource: object): DataTypeClass {
    return staticTypeOf(valueSource, logicalTypes, 'condition')
}

/** The double an int gives with a double (`valueWhenNull`): a static of NumberType (`[numberTypes]`) */
export function __doubleTypeOf(valueSource: object): DataTypeClass {
    return staticTypeOf(valueSource, numberTypes, 'double')
}

function staticTypeOf(valueSource: object, symbol: symbol, name: string): DataTypeClass {
    const result: DataTypeClass | undefined = (valueSource.constructor as any)[symbol]?.[name]
    if (!result) {
        throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'unexpected value' }, 'The data type of the value source gives no ' + name)
    }
    return result
}

/** The root of the data types of the value sources (a condition is not one) */
export abstract class ValueSourceBaseType</*in|out*/ VALUE_TYPE> extends BaseType<VALUE_TYPE> {
    /**
     * Whether the value is a value source of this data type or of one that extends it (`NumberType.is` answers yes to
     * an int and to a double). At run time a value source knows only its type and its custom type: a condition is a
     * boolean there, and the two data types of an aggregated array are one
     */
    static is<TYPE extends AnyType>(this: { readonly prototype: TYPE }, value: any): value is ValueSource<any, TYPE, any> {
        if (!isValueSource(value)) {
            return false
        }
        const valueSource = __getValueSourcePrivate(value)
        const typeClass = this as unknown as typeof ValueSourceBaseType
        if (typeClass.type !== undefined) {
            return valueSource.__type === typeClass.type && valueSource.__customType === typeClass.customType
        }
        if (typeClass.customType !== undefined) {
            return valueSource.__customType === typeClass.customType
        }
        return typeClass.__isOfGroup(valueSource.__type, valueSource.__customType)
    }

    /**
     * Whether a type and a custom type are of this class, for a class without a type of its own (the data types it
     * groups): any value source here
     */
    protected static __isOfGroup(_type: string, _customType: CustomType | undefined): boolean {
        return true
    }

    abstract isConstValue(): boolean
    abstract getConstValue(): VALUE_TYPE
    abstract allowWhen(when: boolean, errorMessage: string): this
    abstract allowWhen(when: boolean, error: Error): this
    abstract disallowWhen(when: boolean, errorMessage: string): this
    abstract disallowWhen(when: boolean, error: Error): this
}
