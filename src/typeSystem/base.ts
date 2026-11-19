import type { SqlDataType, DefaultTypeAdapter, TypeAdapterPlaceholderContext, TypeAdapterProjectionContext, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext } from '../TypeAdapter.js'
import type { NSource } from '../utils/sourceName.js'
import type { HasSource } from '../utils/ITableOrView.js'
import { operandTypeName, optionalType, source, typeName, unadaptedClass, valueSourceType, valueType } from '../utils/symbols.js'
import { exposeFilterOperations, filterOperation } from './filterOperations.js'
import type { OptionalType, TypedValueSource } from './valueSource.js'
import { ValueSourceRoot } from '../nodes/valueSourceRoot.js'

/*
 * The data type of a value source is a class: its type (its methods, the type of its value and its name for TypeScript,
 * the NType) and, as statics, the type name and the SQL data type the library knows it by at run time.
 *
 * The NType names the data type for TypeScript only: `type:<type name>:<group>:`, always ending in `:`. The second
 * segment exists only for the data types that work together, their group: `number` for int and double
 * (`type:int:number:`), `logical` for a boolean and the conditions (`type:boolean:logical:`, `type:if:logical:`); any
 * other data type is its type name (`type:string:`, `type:Money:`), which a family builds from its generic.
 *
 * A value source is its data type plus what places it in a query: its source and its optionality.
 */

/**
 * The classes of the data types extend ValueSourceRoot at run time: a value source is an instance of the class of its
 * data type, and ValueSourceRoot gives it what every value source has at run time (its optionality, its node, the
 * delegation to the node, isConstValue, getConstValue, allowWhen, disallowWhen). The cast hides it from TypeScript,
 * so the public types and the .d.ts have only what the classes declare
 */
const ValueSourceRuntime = ValueSourceRoot as unknown as abstract new () => object

/** The root of every data type */
export abstract class BaseType</*in|out*/ VALUE_TYPE> extends ValueSourceRuntime {
    /**
     * The type name of the data type (`'int'`, `'Money'`): a class of the user says it by convention, the one of its
     * NType (`static override readonly type = 'Money'`); without it, the name of the class (`MoneyType`)
     */
    declare static readonly type: string
    static {
        // The name of a class that doesn't say its type: the one of the class of the data type, also for the subclass
        // that carries a type adapter
        Object.defineProperty(this, 'type', {
            get(this: { [unadaptedClass]?: { name: string }, name: string }): string {
                return (this[unadaptedClass] ?? this).name
            },
            configurable: true,
        })
    }
    /**
     * The type in the database of the values of the data type, when the column doesn't say a more precise one: the
     * query runners send and read a value by it. Undefined for a data type whose values only the user knows
     */
    declare static readonly sqlDataType: SqlDataType | undefined

    /*
     * The conversions of the values of the data type, with the names and the parameters of the methods of a type
     * adapter. A value goes to the database through the type adapter of the value, then these, then the connection
     * (`next`); a value read comes back the other way round. By default they convert nothing and pass the value to
     * `next`; a class of a data type overrides the ones it needs (a class of an integer that the database gives as a
     * bigint: `context.setRequestedType('bigint')` in `transformProjection`)
     */

    /** Converts a value read from the database; `next.transformValueFromDB(...)` applies the conversion of the connection */
    static transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        return next.transformValueFromDB(value, context)
    }
    /** Converts a value before it is sent to the database; `next.transformValueToDB(...)` applies the conversion of the connection */
    static transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, context)
    }
    /** The placeholder of the parameter, as the query runner wrote it, with the cast when there is one */
    static transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter): string {
        return next.transformPlaceholder(placeholder, context)
    }
    /** The SQL of a value as it leaves the database, the pair of `transformValueFromDB` (see `TypeAdapter.transformProjection`) */
    static transformProjection(sql: string, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string {
        return next.transformProjection(sql, context)
    }

    /** The operations the data type exposes to a dynamic filter: none at the root */
    static readonly [filterOperation] = exposeFilterOperations(this, undefined, [])
    /** The operations the data type exposes to a dynamic filter, for TypeScript */
    declare [filterOperation]: (typeof BaseType)[typeof filterOperation]

    /** The type of the value of the data type in JavaScript, for TypeScript only */
    declare [valueType]: VALUE_TYPE
    /** The NType of the data type */
    declare [typeName]: string
    /** The NType an operand of the same data type has: the NType itself, or the pattern of its group */
    declare [operandTypeName]: string
}

/** Any data type: what TypeScript sees in a method of a class (this), and what the functions of the nodes take for it */
export type AnyType = BaseType<any>

/** A class of a data type, as the methods that take a data type receive it */
export interface TypeClass</*in|out*/ TYPE extends AnyType> {
    /** The data type the class describes */
    readonly prototype: TYPE
    /**
     * A class of a data type has its type name in its NType; a class without one (a family, a group such as
     * NumberType) has no place where a data type goes
     */
    readonly name: [TypeNameOf<TYPE>] extends [never] ? never : string
    /** The type name of the data type (`'int'`, `'Money'`) */
    readonly type: string
}

/**
 * The type name of a data type, the segment of its NType after `type:` (`'int'` of `type:int:number:`, `'Money'` of
 * `type:Money:`); never for a class without a type name of its own (`type:${string}:`, or a family taken as a value,
 * whose type name is any)
 */
export type TypeNameOf<TYPE> = TYPE extends { [typeName]: `type:${infer NAME}:${string}` } ? (string extends NAME ? never : `${any}` extends NAME ? never : NAME) : never

/** Any class of a data type */
export type AnyTypeClass = TypeClass<AnyType>

/** What a value source adds to its data type: its source and its optionality */
export interface ValueSourceOfType</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE extends AnyType, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends TypedValueSource<SOURCE, TYPE[typeof valueType], OPTIONAL_TYPE> {
    /** The data type of the value source, for TypeScript only */
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

/**
 * A value source that can be an operand of the data type: of the same data type, or of the group it works with (an int
 * and a double); in a class of a data type, `OperandOf<this>`
 */
export type OperandOf<DATA_TYPE extends { [operandTypeName]: string }> = IValueWithType<DATA_TYPE[typeof operandTypeName]>

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

/** What a position that takes an int or a double accepts */
export type INumberValue = IValueWithType<`type:${string}:number:`>

/** What a condition adds to its data type: its source and its optionality */
export interface ConditionOfType</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE extends AnyType, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends HasSource<SOURCE> {
    [valueType]: boolean
    [optionalType]: OPTIONAL_TYPE
    [valueSourceType]: TYPE
}

// Each reader answers any for any (a conditional over any would give the union of its branches): an argument of type any
// keeps giving any, as with an indexed access
/** The source of a value source: the tables and views it reaches, which a query must have, and what marks it (an aggregate) */
export type SourceOf<X> = 0 extends (1 & X) ? any : X extends { [source]: infer SOURCE extends NSource } ? SOURCE : never
/** The optionality of a value source: `'required'`, `'optional'`, ... */
export type OptionalityOf<X> = 0 extends (1 & X) ? any : X extends { [optionalType]: infer OPTIONAL_TYPE extends OptionalType } ? OPTIONAL_TYPE : never
/** The data type of a value source (or the data type itself) */
export type DataTypeOf<X> = 0 extends (1 & X) ? any : X extends { [valueSourceType]: infer TYPE extends AnyType } ? TYPE : X
/** The type of the value of a value source or of a data type */
export type ValueTypeOf<X> = 0 extends (1 & X) ? any : X extends { [valueType]: infer VALUE_TYPE } ? VALUE_TYPE : never
