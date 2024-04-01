import type { AnyValueSource, ValueSourceValueTypeForNullableObjectResult, ValueSourceValueTypeForOptionalNullableObjectResultSameOuterJoin, ValueSourceValueTypeForRequiredInNullableOptionalObject } from "../expressions/values"
import type { UsableKeyOf } from '../utils/objectUtils'
import type { AllFromSameLeftJoinWithOriginallyRequired, ContainsRequired, ContainsRequiredInOptionalObject } from "./projectionRules"

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

export type ResultObjectValuesProjectedAsNullable<COLUMNS> = {
    [P in UsableKeyOf<COLUMNS>]: 
        COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
        ? ValueSourceValueTypeForNullableObjectResult<NonNullable<COLUMNS[P]>> 
        : ResultObjectValuesProjectedAsNullable2<NonNullable<COLUMNS[P]>>
}

export type ResultObjectValuesProjectedAsNullableForAggregatedArray<COLUMNS> = 
    ContainsRequiredInOptionalObject<COLUMNS> extends true ? 
        {
            [P in UsableKeyOf<COLUMNS>]: 
                COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
                ? ValueSourceValueTypeForRequiredInNullableOptionalObject<NonNullable<COLUMNS[P]>>
                : ResultObjectValuesProjectedAsNullable2<NonNullable<COLUMNS[P]>>
        } // the result for aggregateAsArray must not be nullable, | null doesn't apply here
    : AllFromSameLeftJoinWithOriginallyRequired<COLUMNS> extends true ?
        {
            [P in UsableKeyOf<COLUMNS>]: 
                COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
                ? ValueSourceValueTypeForOptionalNullableObjectResultSameOuterJoin<NonNullable<COLUMNS[P]>>
                : ResultObjectValuesProjectedAsNullable2<NonNullable<COLUMNS[P]>>
        } // the result for aggregateAsArray must not be nullable, | null doesn't apply here
    : ContainsRequired<COLUMNS> extends true ? 
        {
            [P in UsableKeyOf<COLUMNS>]: 
                COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
                ? ValueSourceValueTypeForNullableObjectResult<NonNullable<COLUMNS[P]>>
                : ResultObjectValuesProjectedAsNullable2<NonNullable<COLUMNS[P]>>
        }
    : {
        [P in UsableKeyOf<COLUMNS>]: 
            COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
            ? ValueSourceValueTypeForNullableObjectResult<NonNullable<COLUMNS[P]>>
            : ResultObjectValuesProjectedAsNullable2<NonNullable<COLUMNS[P]>>
    } // the result for aggregateAsArray must not be nullable, | null doesn't apply here

type ResultObjectValuesProjectedAsNullable2<COLUMNS> = 
    ContainsRequiredInOptionalObject<COLUMNS> extends true ? 
        {
            [P in UsableKeyOf<COLUMNS>]: 
                COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
                ? ValueSourceValueTypeForRequiredInNullableOptionalObject<NonNullable<COLUMNS[P]>>
                : ResultObjectValuesProjectedAsNullable3<NonNullable<COLUMNS[P]>>
        } | null
    : AllFromSameLeftJoinWithOriginallyRequired<COLUMNS> extends true ?
        {
            [P in UsableKeyOf<COLUMNS>]: 
                COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
                ? ValueSourceValueTypeForOptionalNullableObjectResultSameOuterJoin<NonNullable<COLUMNS[P]>>
                : ResultObjectValuesProjectedAsNullable3<NonNullable<COLUMNS[P]>>
        } | null
    : ContainsRequired<COLUMNS> extends true ? 
        {
            [P in UsableKeyOf<COLUMNS>]: 
                COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
                ? ValueSourceValueTypeForNullableObjectResult<NonNullable<COLUMNS[P]>>
                : ResultObjectValuesProjectedAsNullable3<NonNullable<COLUMNS[P]>>
        }
    : {
        [P in UsableKeyOf<COLUMNS>]: 
            COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
            ? ValueSourceValueTypeForNullableObjectResult<NonNullable<COLUMNS[P]>>
            : ResultObjectValuesProjectedAsNullable3<NonNullable<COLUMNS[P]>>
    } | null

type ResultObjectValuesProjectedAsNullable3<COLUMNS> = 
    ContainsRequiredInOptionalObject<COLUMNS> extends true ? 
        {
            [P in UsableKeyOf<COLUMNS>]: 
                COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
                ? ValueSourceValueTypeForRequiredInNullableOptionalObject<NonNullable<COLUMNS[P]>>
                : ResultObjectValuesProjectedAsNullable4<NonNullable<COLUMNS[P]>>
        } | null
    : AllFromSameLeftJoinWithOriginallyRequired<COLUMNS> extends true ?
        {
            [P in UsableKeyOf<COLUMNS>]: 
                COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
                ? ValueSourceValueTypeForOptionalNullableObjectResultSameOuterJoin<NonNullable<COLUMNS[P]>>
                : ResultObjectValuesProjectedAsNullable4<NonNullable<COLUMNS[P]>>
        } | null
    : ContainsRequired<COLUMNS> extends true ? 
        {
            [P in UsableKeyOf<COLUMNS>]: 
                COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
                ? ValueSourceValueTypeForNullableObjectResult<NonNullable<COLUMNS[P]>>
                : ResultObjectValuesProjectedAsNullable4<NonNullable<COLUMNS[P]>>
        }
    : {
        [P in UsableKeyOf<COLUMNS>]: 
            COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
            ? ValueSourceValueTypeForNullableObjectResult<NonNullable<COLUMNS[P]>>
            : ResultObjectValuesProjectedAsNullable4<NonNullable<COLUMNS[P]>>
    } | null

type ResultObjectValuesProjectedAsNullable4<COLUMNS> = 
    ContainsRequiredInOptionalObject<COLUMNS> extends true ? 
        {
            [P in UsableKeyOf<COLUMNS>]: 
                COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
                ? ValueSourceValueTypeForRequiredInNullableOptionalObject<NonNullable<COLUMNS[P]>>
                : ResultObjectValuesProjectedAsNullable5<NonNullable<COLUMNS[P]>>
        } | null
    : AllFromSameLeftJoinWithOriginallyRequired<COLUMNS> extends true ?
        {
            [P in UsableKeyOf<COLUMNS>]: 
                COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
                ? ValueSourceValueTypeForOptionalNullableObjectResultSameOuterJoin<NonNullable<COLUMNS[P]>>
                : ResultObjectValuesProjectedAsNullable5<NonNullable<COLUMNS[P]>>
        } | null
    : ContainsRequired<COLUMNS> extends true ? 
        {
            [P in UsableKeyOf<COLUMNS>]: 
                COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
                ? ValueSourceValueTypeForNullableObjectResult<NonNullable<COLUMNS[P]>>
                : ResultObjectValuesProjectedAsNullable5<NonNullable<COLUMNS[P]>>
        }
    : {
        [P in UsableKeyOf<COLUMNS>]: 
            COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
            ? ValueSourceValueTypeForNullableObjectResult<NonNullable<COLUMNS[P]>>
            : ResultObjectValuesProjectedAsNullable5<NonNullable<COLUMNS[P]>>
    } | null

type ResultObjectValuesProjectedAsNullable5<COLUMNS> = 
    ContainsRequiredInOptionalObject<COLUMNS> extends true ? 
        {
            [P in UsableKeyOf<COLUMNS>]: 
                COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
                ? ValueSourceValueTypeForRequiredInNullableOptionalObject<NonNullable<COLUMNS[P]>>
                : never // Stop recursion here
        } | null
    : AllFromSameLeftJoinWithOriginallyRequired<COLUMNS> extends true ?
        {
            [P in UsableKeyOf<COLUMNS>]: 
                COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
                ? ValueSourceValueTypeForOptionalNullableObjectResultSameOuterJoin<NonNullable<COLUMNS[P]>>
                : never // Stop recursion here
        } | null
    : ContainsRequired<COLUMNS> extends true ? 
        {
            [P in UsableKeyOf<COLUMNS>]: 
                COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
                ? ValueSourceValueTypeForNullableObjectResult<NonNullable<COLUMNS[P]>>
                : never // Stop recursion here
        }
    : {
        [P in UsableKeyOf<COLUMNS>]: 
            COLUMNS[P] extends AnyValueSource | undefined // Undefined is to deal with picking columns
            ? ValueSourceValueTypeForNullableObjectResult<NonNullable<COLUMNS[P]>>
            : never // Stop recursion here
    } | null