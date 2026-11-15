import type { CustomType } from '../TypeAdapter.js'
import { __isAggregatedArray, __isBoolean } from './dataTypes.js'
import type { IValueWithType, OptionalOf, SourceOf, TypeClass, ValueSource } from './base.js'
import { EqualableType } from './equalable.js'
import type { BooleanType, IfValueSource } from './booleans.js'
import type { MergeOptional } from './valueSource.js'
import { comparableValueSource, operandTypeName, typeName } from '../utils/symbols.js'
import type { NSource } from '../utils/sourceName.js'
import type { TypedValueSource } from './valueSource.js'

/** What a position that takes a value source of any data type with an order accepts (max, min) */
export interface IAnyComparableValueSource</*in|out*/ SOURCE extends NSource> extends TypedValueSource<SOURCE, any, any> {
    [comparableValueSource]: 'ComparableValueSource'
}

/** A data type whose values have an order */
export abstract class ComparableType</*in|out*/ VALUE_TYPE> extends EqualableType<VALUE_TYPE> {
    /** Whether a type and a custom type are of a comparable data type: every one but a boolean, an enum, a custom and an aggregated array */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return !__isBoolean(type, customType) && !__isAggregatedArray(type, customType) && customType !== 'enum' && customType !== 'custom'
    }

    declare [comparableValueSource]: 'ComparableValueSource'
    abstract lessThanIfValue(value: VALUE_TYPE | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract lessThan(value: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract lessThan<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract greaterThanIfValue(value: VALUE_TYPE | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract greaterThan(value: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract greaterThan<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract lessOrEqualIfValue(value: VALUE_TYPE | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract lessOrEqual(value: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract lessOrEqual<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract greaterOrEqualIfValue(value: VALUE_TYPE | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract greaterOrEqual(value: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract greaterOrEqual<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract between(value: VALUE_TYPE, value2: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract between<VALUE2 extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE_TYPE, value2: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE2>>>
    abstract between<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE, value2: VALUE_TYPE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract between<VALUE extends IValueWithType<this[typeof operandTypeName]>, VALUE2 extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE, value2: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE> | SourceOf<VALUE2>, BooleanType, MergeOptional<MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>, OptionalOf<VALUE2>>>
    abstract notBetween(value: VALUE_TYPE, value2: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract notBetween<VALUE2 extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE_TYPE, value2: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE2>>>
    abstract notBetween<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE, value2: VALUE_TYPE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract notBetween<VALUE extends IValueWithType<this[typeof operandTypeName]>, VALUE2 extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE, value2: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE> | SourceOf<VALUE2>, BooleanType, MergeOptional<MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>, OptionalOf<VALUE2>>>
}

/** A value of a type of the user that has an order, of its type name */
export abstract class CustomComparableType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE> {
    static override readonly customType = 'customComparable'
    declare [typeName]: `type:${TYPE_NAME}:customComparable:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customComparable:`

    /** The data type of a value of a type of the user that has an order, with its type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): TypeClass<CustomComparableType<VALUE_TYPE, TYPE_NAME>> {
        abstract class CustomComparable extends CustomComparableType<VALUE_TYPE, TYPE_NAME> {
            static override readonly type = typeName
        }
        return CustomComparable
    }
}
