import type { IValueSource, OptionalType, ValueSourceOf } from "../expressions/values"
import type { RequiredKeys } from "../utils/objectUtils"
import type { NAnyLeftJoin, NNoTableOrViewRequiredFrom } from "../utils/sourceName"

/*
 * NOTE:
 * - First level object cannot be marked as optional, then, any rule that mark the container as optional
 *   will remain as optional. Except for aggregateAsArray (in DBConnection) where all rules apply even
 *   in the first level, but on that level the result (returned by the first level) cannot be null or undefined.
 * - Optional properties (no mandatory properties in a select picking) never apply as candidate to detect 
 *   the rules 1, 2 or 3.
 * 
 * Rules (in priority order):
 * 
 * 1.- In the case, there are properties defined as asRequiredInOptionalObject: all other non-required properties will be
 *     marked as optional; the properties defined as asRequiredInOptionalObject will be considered required; the
 *     object will be considered optional.
 *     In the case of any property defined as asRequiredInOptionalObject has no value, the whole object will be ignored,
 *     independently if there are other properties with value.
 * 2.- In the case of all properties are coming from the same outer (left) join and the original table have
 *     required object, those properties will be treated automatically as asRequiredInOptionalObject.
 *     Inner objects are ignored in this rule.
 * 3.- In the case there are required properties or required inner objects: all other non-required properties 
 *     or non-required inner objects properties will be marked as optional; the object will be considered required.
 * 4.- In any other case: all properties and inner objects will be marked as optional, the object will 
 *     be considered optional.
 * 
 * Programmed logic (in priority order):
 *
 * 1.- There are requiredInOptionalObject fieds:
 *     + Detected with: ContainsRequiredInOptionalObject type
 *     - The resulting object is marked as optional
 *     - requiredInOptionalObject fields are marked as required
 *     - required objects remain as required but must not exist if the requiredInOptionalObject fields have no value (ignoring the inner objects)
 *     - inner objects remain as in its definition but must not exist if the requiredInOptionalObject fields have no value (ignoring the inner objects)
 *     - originallyRequired & optional are marked as optional
 * 2.- All fields (minimum one, ignoring inner objects) have the same identical outer (left) join dependency (plus NoTableOrView)
 *     + Detected with: AllFromSameLeftJoinWithOriginallyRequired type
 *     - The fields that were required because the value is required in the original table used for the outer join will be treated as
 *       requiredInOptionalObject in the same way described in the previous point.
 * 3.- There are required fields or required inner objects:
 *     + Detect with: ContainsRequired type. 
 *     > This type is recursive because it must discard rule 2 and 3 recursively (if appy those rules then the object is optional no matter if it contains required properties)
 *     - The resulting object is marked as required
 *     - required fields are marked as required
 *     - requiredInOptionalObject & originallyRequired & optional are marked as optional
 *     - inner objects remain as in their definition
 * 4.- There are no required fields or inner objects:
 *     + When the previous cases where not detected 
 *     - The resulting object is marked as optional
 *     - requiredInOptionalObject fields ar marked as required
 *     - originallyRequired & optional are marked as optional
 *     - inner objects remain as in its definition
 */

/*
 * Probably -? and | undefined is not required anymore (except in InnerTables), leaving as fallback
 */

export type ContainsRequiredInOptionalObject<TYPE> = FalseWhenNever<
    { [K in RequiredKeys<TYPE>]-?: 
        TYPE[K] extends IValueSource<any, any, any, infer OPTIONAL_TYPE> | undefined
        ? IsRequiredInOptionalObject<OPTIONAL_TYPE>
        : never
    }[RequiredKeys<TYPE>]>

export type AllFromSameLeftJoinWithOriginallyRequired<TYPE> = FalseWhenNever<
    { [K in RequiredKeys<TYPE>]-?: 
        TYPE[K] extends IValueSource<infer SOURCE, any, any, infer OPTIONAL_TYPE> | undefined
        ? SOURCE extends NAnyLeftJoin
            ? (
                InnerTables<TYPE> | NNoTableOrViewRequiredFrom<SOURCE> extends SOURCE | NNoTableOrViewRequiredFrom<SOURCE>
                ? IsOriginallyRequired<OPTIONAL_TYPE>
                : false
            ) : SOURCE extends NNoTableOrViewRequiredFrom<SOURCE>
                ? never
                : false
        : never
    }[RequiredKeys<TYPE>]>

export type ContainsRequired<TYPE> = FalseWhenNever<
    { [K in RequiredKeys<TYPE>]-?: 
        TYPE[K] extends IValueSource<any, any, any, infer OPTIONAL_TYPE> | undefined
        ? IsRequired<OPTIONAL_TYPE>
        // Innet object, rule 1 and 2 must be discarded before check if it contains required properties
        : ContainsRequiredInOptionalObject<TYPE> extends true ? false
        : AllFromSameLeftJoinWithOriginallyRequired<TYPE> extends true ? false
        : ContainsRequired2<TYPE>
    }[RequiredKeys<TYPE>]>

type ContainsRequired2<TYPE> = FalseWhenNever<
    { [K in RequiredKeys<TYPE>]-?: 
        TYPE[K] extends IValueSource<any, any, any, infer OPTIONAL_TYPE> | undefined
        ? IsRequired<OPTIONAL_TYPE>
        // Innet object, rule 1 and 2 must be discarded before check if it contains required properties
        : ContainsRequiredInOptionalObject<TYPE> extends true ? false
        : AllFromSameLeftJoinWithOriginallyRequired<TYPE> extends true ? false
        : ContainsRequired3<TYPE>
    }[RequiredKeys<TYPE>]>

type ContainsRequired3<TYPE> = FalseWhenNever<
    { [K in RequiredKeys<TYPE>]-?: 
        TYPE[K] extends IValueSource<any, any, any, infer OPTIONAL_TYPE> | undefined
        ? IsRequired<OPTIONAL_TYPE>
        // Innet object, rule 1 and 2 must be discarded before check if it contains required properties
        : ContainsRequiredInOptionalObject<TYPE> extends true ? false
        : AllFromSameLeftJoinWithOriginallyRequired<TYPE> extends true ? false
        : ContainsRequired4<TYPE>
    }[RequiredKeys<TYPE>]>

type ContainsRequired4<TYPE> = FalseWhenNever<
    { [K in RequiredKeys<TYPE>]-?: 
        TYPE[K] extends IValueSource<any, any, any, infer OPTIONAL_TYPE> | undefined
        ? IsRequired<OPTIONAL_TYPE>
        // Innet object, rule 1 and 2 must be discarded before check if it contains required properties
        : ContainsRequiredInOptionalObject<TYPE> extends true ? false
        : AllFromSameLeftJoinWithOriginallyRequired<TYPE> extends true ? false
        : ContainsRequired5<TYPE>
    }[RequiredKeys<TYPE>]>
    
type ContainsRequired5<TYPE> = FalseWhenNever<
    { [K in RequiredKeys<TYPE>]-?: 
        TYPE[K] extends IValueSource<any, any, any, infer OPTIONAL_TYPE> | undefined
        ? IsRequired<OPTIONAL_TYPE>
        // Innet object, rule 1 and 2 must be discarded before check if it contains required properties
        // but the nesting limit was reach, assuming it is required
        : true
    }[RequiredKeys<TYPE>]>

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

type InnerTables<TYPE> = ({ [K in RequiredKeys<TYPE>]-?: TYPE[K] extends ValueSourceOf<infer SOURCE> | undefined ? SOURCE : never})[RequiredKeys<TYPE>]

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