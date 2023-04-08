import { AnyDB } from "../databases"
import type { AnyValueSource, IValueSource, OptionalType, OptionalTypeRequiredOrAny, RemapIValueSourceTypeWithOptionalType, ValueSource, ValueSourceOf, ValueSourceValueTypeForRequiredInOptionalObject, ValueSourceValueTypeForObjectResult, ValueSourceValueTypeForOptionalObjectResultSameOuterJoin } from "../expressions/values"
import { NoTableOrViewRequired, OUTER_JOIN_SOURCE, ITableOrViewRef } from "./ITableOrView"
import { database } from "./symbols"

// Result

export type ResultObjectValues<COLUMNS> = FixOptionalProperties<{
    [P in keyof COLUMNS]: 
        COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
        ? ValueSourceValueTypeForObjectResult<NonNullable<COLUMNS[P]>> 
        : InnerResultObjectValues<NonNullable<COLUMNS[P]>>
}>

// Column name considering picking

export type RequiredColumnNames<T> = T extends AnyValueSource ? 'result' : 'any' extends T ? never : RequiredInnerColumnNames<T, ''> // Discard any cases to avoid "Type instantiation is excessively deep and possibly infinite.ts(2589)"
type RequiredInnerColumnNames<T, PREFIX extends string> = { [K in keyof T]-?: 
    K extends string 
    ?
        T[K] extends AnyValueSource | undefined // Undefined is to deal with picking columns
        ? ({} extends Pick<T, K> ? never : `${PREFIX}${K}`) 
        : RequiredInnerColumnNames<T[K], `${PREFIX}${K}.`>
    : never
}[keyof T]

// Picking

export type RequiredKeysOfPickingColumns<T> = T extends AnyValueSource ? never : { [K in keyof T]-?: {} extends Pick<T, K> ? never : K }[keyof T]

// For compose and split

export type ColumnGuard<T> = T extends null | undefined ? never : [T] extends [never] ? never : T extends AnyValueSource ? never : unknown
export type GuidedObj<T> = T & { [K in keyof T as K extends string | number ? `${K}!` : never]-?: NonNullable<T[K]>} & { [K in keyof T as K extends string | number ? `${K}?` : never]?: T[K]}
export type GuidedPropName<T> = T extends `${infer Q}!` ? Q : T extends `${infer Q}?` ? Q : T
export type ValueOf<T> = T[keyof T]

export type FixOptionalProperties<RESULT> = 
    undefined extends string ? RESULT // tsc is working with strict mode disabled. There is no way to infer the optional properties. Keep as required is a better approximation.
    : { [P in keyof OptionalMap<RESULT>]: true extends OptionalMap<RESULT> ? RESULT[P] : NonNullable<RESULT[P]>}

type OptionalMap<TYPE> = { [P in MandatoryPropertiesOf<TYPE>]-?: true } & { [P in OptionalPropertiesOf<TYPE>]?: false }

export type MandatoryPropertiesOf<TYPE> = ({ [K in keyof TYPE]-?: null | undefined extends TYPE[K] ? never : (null extends TYPE[K] ? never : (undefined extends TYPE[K] ? never : K)) })[keyof TYPE]
export type OptionalPropertiesOf<TYPE> = ({ [K in keyof TYPE]-?: null | undefined extends TYPE[K] ? K : (null extends TYPE[K] ? K : (undefined extends TYPE[K] ? K : never)) })[keyof TYPE]

// For compound

export type ColumnsForCompound<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, COLUMNS> = COLUMNS extends AnyValueSource 
    ? RemapIValueSourceTypeWithOptionalType<TABLE_OR_VIEW, COLUMNS, CompoundColumnOptionalType<COLUMNS>> 
    : InnerColumnsForCompound<TABLE_OR_VIEW, COLUMNS>

type InnerColumnsForCompound<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, COLUMNS> =
    { [K in keyof COLUMNS]: 
        COLUMNS[K] extends AnyValueSource | undefined
        ? RemapIValueSourceTypeWithOptionalType<TABLE_OR_VIEW, COLUMNS[K], CompoundColumnOptionalType<COLUMNS[K]>> 
        : InnerColumnsForCompound<TABLE_OR_VIEW, COLUMNS> 
    }

type CompoundColumnOptionalType<COLUMN> = 
    COLUMN extends IValueSource<any, any, any, infer OPTIONAL_TYPE> 
    ? OptionalTypeRequiredOrAny<OPTIONAL_TYPE>
    : never

// Inner object type processing

/*
 * Rules (in priority order):
 * 
 * 1.- In the case, there are properties defined as asRequiredInOptionalObject: all other non-required properties will be
 *     marked as optional; the properties defined as asRequiredInOptionalObject will be considered required; the
 *     object will be considered optional.
 *     In the case of any property defined as asRequiredInOptionalObject has no value, the whole object will be ignored,
 *     independently if there are other properties with value.
 * 2.- In the case of all properties are coming from the same outer (left) join and the original table have
 *     required object, those properties will be treated automatically as asRequiredInOptionalObject.
 * 3.- In the case there are required properties or inner objects: all other non-required properties 
 *     or inner objects properties will be marked as optional; the object will be considered required.
 * 4.- In any other case: all properties and inner objects will be marked as optional, the object will 
 *     be considered optional.
 * 
 * Programmed logic (in priority order):
 *
 * 1.- There are requiredInOptionalObject fieds:
 *     - The resulting object is marked as optional
 *     - requiredInOptionalObject fields are marked as required
 *     - required objects remain as required but must not exist if the requiredInOptionalObject fields have no value (ignoring the inner objects)
 *     - inner objects remain as in its definition but must not exist if the requiredInOptionalObject fields have no value (ignoring the inner objects)
 *     - originallyRequired & optional are marked as optional
 * 2.- All fields (minimum one, ignoring inner objects) have the same identical outer (left) join dependency (plus NoTableOrView)
 *     - The fields that were required because the value is required in the original table used for the outer join will be treated as
 *       requiredInOptionalObject in the same way described in the previous point.
 * 3.- There are required fields or inner objects:
 *     - The resulting object is marked as required
 *     - required fields are marked as required
 *     - requiredInOptionalObject & originallyRequired & optional are marked as optional
 *     - inner objects remain as in their definition
 * 4.- There are no required fields or inner objects:
 *     - The resulting object is marked as optional
 *     - requiredInOptionalObject fields ar marked as required
 *     - originallyRequired & optional are marked as optional
 *     - inner objects remain as in its definition
 */
type InnerResultObjectValues<COLUMNS> = 
    ContainsRequiredInOptionalObject<COLUMNS> extends true ? 
        FixOptionalProperties<{
            [P in keyof COLUMNS]: 
                COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
                ? ValueSourceValueTypeForRequiredInOptionalObject<NonNullable<COLUMNS[P]>>
                : InnerResultObjectValues<NonNullable<COLUMNS[P]>>
        }> | undefined
    : AllFromSameLeftJoinWithOriginallyRequired<COLUMNS> extends true ?
        FixOptionalProperties<{
            [P in keyof COLUMNS]: 
                COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
                ? ValueSourceValueTypeForOptionalObjectResultSameOuterJoin<NonNullable<COLUMNS[P]>>
                : InnerResultObjectValues<NonNullable<COLUMNS[P]>>
        }> | undefined
    : ContainsRequired<COLUMNS> extends true ? 
        FixOptionalProperties<{
            [P in keyof COLUMNS]: 
                COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
                ? ValueSourceValueTypeForObjectResult<NonNullable<COLUMNS[P]>>
                : InnerResultObjectValues<NonNullable<COLUMNS[P]>>
        }>
    : FixOptionalProperties<{
        [P in keyof COLUMNS]: 
            COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
            ? ValueSourceValueTypeForObjectResult<NonNullable<COLUMNS[P]>>
            : InnerResultObjectValues<NonNullable<COLUMNS[P]>>
    }> | undefined

export type InnerResultObjectValuesForAggregatedArray<COLUMNS> = NonNullable<InnerResultObjectValues<COLUMNS>>

type ContainsRequiredInOptionalObject<TYPE> = FalseWhenNever<(
    { [K in keyof TYPE]-?: 
        TYPE[K] extends IValueSource<any, any, any, infer OPTIONAL_TYPE>  | undefined // Undefined is to deal with picking columns
        ? IsRequiredInOptionalObject<OPTIONAL_TYPE>
        : never
    })[keyof TYPE]>

type ContainsRequired<TYPE> = FalseWhenNever<(
    { [K in keyof TYPE]-?: 
        TYPE[K] extends IValueSource<any, any, any, infer OPTIONAL_TYPE>  | undefined // Undefined is to deal with picking columns
        ? IsRequired<OPTIONAL_TYPE>
        : InnerObjectIsRequired<TYPE[K]> extends true ? true : never
    })[keyof TYPE]>

type InnerObjectIsRequired<TYPE> =  
    ContainsRequiredInOptionalObject<TYPE> extends true ? false
    : AllFromSameLeftJoinWithOriginallyRequired<TYPE> extends true ? false
    : ContainsRequired<TYPE>
    
type AllFromSameLeftJoinWithOriginallyRequired<TYPE> = FalseWhenNever<(
    { [K in keyof TYPE]-?: 
        TYPE[K] extends ValueSource<infer T, any, any, infer OPTIONAL_TYPE> | undefined // Undefined is to deal with picking columns
        ? OUTER_JOIN_SOURCE<any, any> extends T
            ? (
                InnerTables<TYPE> | NoTableOrViewRequired<T[typeof database]> extends T | NoTableOrViewRequired<T[typeof database]>
                ? IsOriginallyRequired<OPTIONAL_TYPE>
                : false
            ) : T extends NoTableOrViewRequired<T[typeof database]> 
                ? never
                : false
        : never
    })[keyof TYPE]>

type InnerTables<TYPE> = ({ [K in keyof TYPE]-?: TYPE[K] extends ValueSourceOf<infer T> | undefined ? T : never})[keyof TYPE] // Undefined is to deal with picking columns

type IsRequiredInOptionalObject<OPTIONAL_TYPE extends OptionalType> =
    'any' extends OPTIONAL_TYPE ? never :
    'requiredInOptionalObject' extends OPTIONAL_TYPE ? true :
    never

type IsOriginallyRequired<OPTIONAL_TYPE extends OptionalType> =
    // Always select the less strict option
    'any' extends OPTIONAL_TYPE ? never :
    'originallyRequired' extends OPTIONAL_TYPE ? true :
    never

type IsRequired<OPTIONAL_TYPE extends OptionalType> =
    // Always select the less strict option
    'any' extends OPTIONAL_TYPE ? never :
    'required' extends OPTIONAL_TYPE ? true :
    never

// Dealing with never https://github.com/microsoft/TypeScript/issues/23182
type FalseWhenNever<T> = [T] extends [never] ? false : T

// Inner obect processing for withs

/**
 * Alternative solution that allows to expose the inner objects in the with, but typescript get frozen
 * This implementation doesn't deal when a inner property is used alone. See the case when in this view the inner property
 * is requiredInOptionalObject but that property is used in a way that flag make no sence any more
 */

// export type WithViewColumns<TABLE_OR_VIEW extends ITableOrView<any>, COLUMNS> = {
//     [P in keyof COLUMNS]: 
//         COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
//         ? RemapValueSourceTypeWithOptionalType<TABLE_OR_VIEW[typeof tableOrViewRef], COLUMNS[P], WithOptionalTypeOf<COLUMNS[P]>>
//         : InnerObjectWithColumns<TABLE_OR_VIEW, NonNullable<COLUMNS[P]>>
// } & TABLE_OR_VIEW

// type WithOptionalTypeOf<TYPE> = 
//     TYPE extends IValueSource<any, any, any, infer OPTIONAL_TYPE> ? (
//         'required' extends OPTIONAL_TYPE
//         ? 'required'
//         : 'optional'
//     ) : never

// type WithRequiredInOptionalObjectTypeOf<TYPE> = 
//     TYPE extends IValueSource<any, any, any, infer OPTIONAL_TYPE> ? (
//         // Always select the less strict option
//         'optional' extends OPTIONAL_TYPE ? 'optional' :
//         'originallyRequired' extends OPTIONAL_TYPE ? 'optional' :
//         'requiredInOptionalObject' extends OPTIONAL_TYPE ? 'requiredInOptionalObject' :
//         'required'
//     ) : never

// type WithOptionalOriginallyRequiredTypeOf<TYPE> = 
//     TYPE extends IValueSource<any, any, any, infer OPTIONAL_TYPE> ? (
//         // Always select the less strict option
//         'optional' extends OPTIONAL_TYPE ? 'optional' :
//         'originallyRequired' extends OPTIONAL_TYPE ? 'requiredInOptionalObject' :
//         'requiredInOptionalObject' extends OPTIONAL_TYPE ? 'requiredInOptionalObject' :
//         'required'
//     ) : never

// type InnerObjectWithColumns<TABLE_OR_VIEW extends ITableOrView<any>, COLUMNS> = 
//     ContainsRequiredInOptionalObject<COLUMNS> extends true ? 
//         ({
//             [P in keyof COLUMNS]: 
//                 COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
//                 ? RemapValueSourceTypeWithOptionalType<TABLE_OR_VIEW[typeof tableOrViewRef], COLUMNS[P], WithRequiredInOptionalObjectTypeOf<COLUMNS[P]>>
//                 : InnerResultObjectValues<NonNullable<COLUMNS[P]>>
//         })
//     : AllFromSameLeftJoinWithOriginallyRequired<COLUMNS> extends true ?
//         ({
//             [P in keyof COLUMNS]: 
//                 COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
//                 ? RemapValueSourceTypeWithOptionalType<TABLE_OR_VIEW[typeof tableOrViewRef], COLUMNS[P], WithOptionalOriginallyRequiredTypeOf<COLUMNS[P]>>
//                 : InnerResultObjectValues<NonNullable<COLUMNS[P]>>
//         })
//     : ContainsRequired<COLUMNS> extends true ? 
//         ({
//             [P in keyof COLUMNS]: 
//                 COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
//                 ? RemapValueSourceTypeWithOptionalType<TABLE_OR_VIEW[typeof tableOrViewRef], COLUMNS[P], WithOptionalTypeOf<COLUMNS[P]>>
//                 : InnerResultObjectValues<NonNullable<COLUMNS[P]>>
//         })
//     : ({
//         [P in keyof COLUMNS]: 
//             COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
//             ? RemapValueSourceTypeWithOptionalType<TABLE_OR_VIEW[typeof tableOrViewRef], COLUMNS[P], WithOptionalTypeOf<COLUMNS[P]>>
//             : InnerResultObjectValues<NonNullable<COLUMNS[P]>>
//     })