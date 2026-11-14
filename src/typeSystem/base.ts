import type { CustomType } from '../TypeAdapter.js'
import type { NSource } from '../utils/sourceName.js'
import type { HasSource } from '../utils/ITableOrView.js'
import { operandTypeName, optionalType, source, typeName, valueSourceType, valueType } from '../utils/symbols.js'
import type { OptionalType, TypedValueSource } from './valueSource.js'

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
    declare static readonly __type: string
    /** The custom type of a custom data type; undefined for a built-in data type */
    declare static readonly __customType: CustomType | undefined

    declare [valueType]: VALUE_TYPE
    /** The NType of the data type */
    declare [typeName]: string
    /** The NType an operand of the same data type has: the NType itself, or the pattern of its group */
    declare [operandTypeName]: string
}

export type AnyType = BaseType<any>

/** A class of a data type, as the methods that take a data type receive it */
export interface TypeClass</*in|out*/ TYPE extends AnyType> {
    readonly prototype: TYPE
    readonly __type: string
    readonly __customType: CustomType | undefined
}

export type AnyTypeClass = TypeClass<AnyType>

/** What a value source adds to its data type: its source and its optionality */
export interface ValueSourceOfType</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE extends AnyType, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends TypedValueSource<SOURCE, TYPE[typeof valueType], OPTIONAL_TYPE> {
    [valueSourceType]: TYPE
}

/** A value source: its data type, with its source and its optionality */
export type ValueSource<SOURCE extends NSource, TYPE extends AnyType, OPTIONAL_TYPE extends OptionalType> = TYPE & ValueSourceOfType<SOURCE, TYPE, OPTIONAL_TYPE>

/** What a position that takes a value source with the given operand NType accepts */
export interface IValueWithType</*in|out*/ OPERAND_TYPE_NAME extends string> extends TypedValueSource<any, any, any> {
    [typeName]: OPERAND_TYPE_NAME
}

/** What a position that takes a condition or a boolean value accepts (and, or) */
export interface ILogicalValue extends HasSource<any> {
    [typeName]: `type:${string}:logical:`
    [optionalType]: any
}

export type SourceOf<X> = X extends { [source]: infer SOURCE extends NSource } ? SOURCE : never
export type OptionalOf<X> = X extends { [optionalType]: infer OPTIONAL_TYPE extends OptionalType } ? OPTIONAL_TYPE : never
/** The data type of a value source (or the data type itself) */
export type TypeOf<X> = X extends { [valueSourceType]: infer TYPE extends AnyType } ? TYPE : X
export type ValueTypeOf<X> = X extends { [valueType]: infer VALUE_TYPE } ? VALUE_TYPE : never
