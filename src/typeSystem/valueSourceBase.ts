import type { CustomType } from '../TypeAdapter.js'
import { BaseType, type AnyType, type ValueSource } from './base.js'
import { __getValueSourcePrivate, isValueSource } from './valueSource.js'

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
