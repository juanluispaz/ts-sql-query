import type { CustomType } from '../TypeAdapter.js'
import type { NSource } from '../utils/sourceName.js'
import type { HasSource } from '../utils/ITableOrView.js'
import { operandTypeName, optionalType, source, typeName, valueSourceType, valueType } from '../utils/symbols.js'
import type { OptionalType, TypedValueSource } from './valueSource.js'
import { __getValueSourcePrivate, isValueSource } from './valueSource.js'

/*
 * The data type of a value source is a class: its type (its methods, the type of its value and its name for TypeScript,
 * the NType) and, as statics, the type and the custom type the library knows it by at run time.
 *
 * The NType names the data type for TypeScript only: `type:<type>:<custom type or group>:`, always ending in `:`. A
 * built-in data type leaves the second segment empty (`type:string:`), a custom data type has there its custom type
 * (`type:MyId:customInt:`), and the data types that work together have there their group: `number` for int and double
 * (`type:int:number:`), `logical` for a boolean and the conditions (`type:boolean:logical:`, `type:if:logical:`).
 *
 * A value source is its data type plus what places it in a query: its source and its optionality.
 */

/** The root of every data type */
export abstract class BaseType</*in|out*/ VALUE_TYPE> {
    /** The type the library knows the data type by at run time (the type name of a custom data type) */
    declare static readonly type: string | undefined
    /** The custom type of a custom data type; undefined for a built-in data type */
    declare static readonly customType: CustomType | undefined

    declare [valueType]: VALUE_TYPE
    /** The NType of the data type */
    declare [typeName]: string
    /** The NType an operand of the same data type has: the NType itself, or the pattern of its group */
    declare [operandTypeName]: string
}

export type AnyType = BaseType<any>

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

/** A class of a data type, as the methods that take a data type receive it */
export interface TypeClass</*in|out*/ TYPE extends AnyType> {
    readonly prototype: TYPE
    readonly type: string
    readonly customType: CustomType | undefined
}

/** The class of a custom data type an `of` makes, with its type guard */
export interface CustomTypeClass</*in|out*/ TYPE extends AnyType> extends TypeClass<TYPE> {
    is(value: any): value is ValueSource<any, TYPE, any>
}

export type AnyTypeClass = TypeClass<AnyType>

/** What a value source adds to its data type: its source and its optionality */
export interface ValueSourceOfType</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE extends AnyType, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends TypedValueSource<SOURCE, TYPE[typeof valueType], OPTIONAL_TYPE> {
    [valueSourceType]: TYPE
}

/** A value source: its data type, with its source and its optionality */
export type ValueSource<SOURCE extends NSource, TYPE extends AnyType, OPTIONAL_TYPE extends OptionalType> = TYPE & ValueSourceOfType<SOURCE, TYPE, OPTIONAL_TYPE>

/**
 * What a position that takes a value source of an operand NType accepts: its source, its optionality and that NType, no
 * methods. Generic in the NType and not in the data type, so two data types of the same operand NType (int and double)
 * are the same input for TypeScript
 */
export interface IValueSourceOfOperand</*in|out*/ SOURCE extends NSource, /*in|out*/ OPERAND_TYPE_NAME extends string, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends TypedValueSource<SOURCE, any, OPTIONAL_TYPE> {
    [typeName]: OPERAND_TYPE_NAME
}

/** What a position that takes a value source of the data type accepts (an int position takes a double) */
export type IValueSource<SOURCE extends NSource, TYPE extends AnyType, OPTIONAL_TYPE extends OptionalType> = IValueSourceOfOperand<SOURCE, TYPE[typeof operandTypeName], OPTIONAL_TYPE>

/** The value source of the same data type and optionality with another source (a column of an alias, of a with, ...) */
export type RemapValueSourceType<SOURCE extends NSource, VALUE_SOURCE> =
    VALUE_SOURCE extends ValueSourceOfType<any, infer TYPE, infer OPTIONAL_TYPE> ? ValueSource<SOURCE, TYPE, OPTIONAL_TYPE> : never

/** The value source of the same data type with another source and another optionality */
export type RemapValueSourceTypeWithOptionalType<SOURCE extends NSource, VALUE_SOURCE, OPTIONAL_TYPE extends OptionalType> =
    VALUE_SOURCE extends ValueSourceOfType<any, infer TYPE, any> ? ValueSource<SOURCE, TYPE, OPTIONAL_TYPE> : never

/** What a position that takes a value source of the same data type and optionality with another source accepts */
export type RemapIValueSourceType<SOURCE extends NSource, VALUE_SOURCE> =
    VALUE_SOURCE extends ValueSourceOfType<any, infer TYPE, infer OPTIONAL_TYPE> ? IValueSource<SOURCE, TYPE, OPTIONAL_TYPE> : never

/** What a position that takes a value source of the same data type with another source and optionality accepts */
export type RemapIValueSourceTypeWithOptionalType<SOURCE extends NSource, VALUE_SOURCE, OPTIONAL_TYPE extends OptionalType> =
    VALUE_SOURCE extends ValueSourceOfType<any, infer TYPE, any> ? IValueSource<SOURCE, TYPE, OPTIONAL_TYPE> : never

/** What a position that takes a value source with the given operand NType accepts */
export interface IValueWithType</*in|out*/ OPERAND_TYPE_NAME extends string> extends TypedValueSource<any, any, any> {
    [typeName]: OPERAND_TYPE_NAME
}

/** What a position that takes a condition or a boolean value, of the source and optionality given, accepts */
export interface ILogicalValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends HasSource<SOURCE> {
    [typeName]: `type:${string}:logical:`
    [optionalType]: OPTIONAL_TYPE
}

/** What a position that takes a condition or a boolean value accepts (and, or) */
export interface ILogicalValue extends ILogicalValueSource<any, any> {
}

/** What a position that takes a condition, of the source and optionality given, accepts */
export interface IConditionValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends ILogicalValueSource<SOURCE, OPTIONAL_TYPE> {
    [typeName]: 'type:if:logical:' | 'type:alwaysIf:logical:'
}

// Each reader answers any for any (a conditional over any would give the union of its branches): an argument of type any
// keeps giving any, as with an indexed access
export type SourceOf<X> = 0 extends (1 & X) ? any : X extends { [source]: infer SOURCE extends NSource } ? SOURCE : never
export type OptionalOf<X> = 0 extends (1 & X) ? any : X extends { [optionalType]: infer OPTIONAL_TYPE extends OptionalType } ? OPTIONAL_TYPE : never
/** The data type of a value source (or the data type itself) */
export type TypeOf<X> = 0 extends (1 & X) ? any : X extends { [valueSourceType]: infer TYPE extends AnyType } ? TYPE : X
export type ValueTypeOf<X> = 0 extends (1 & X) ? any : X extends { [valueType]: infer VALUE_TYPE } ? VALUE_TYPE : never
