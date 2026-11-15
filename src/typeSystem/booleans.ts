import { BaseType, type ILogicalValue, type IValueWithType, type OptionalOf, type SourceOf, type ValueSource } from './base.js'
import { EqualableType } from './equalable.js'
import type { MergeOptional, OptionalType } from './valueSource.js'
import type { NSource } from '../utils/sourceName.js'
import type { HasSource } from '../utils/ITableOrView.js'
import type { optionalType, valueSourceType, valueType } from '../utils/symbols.js'
import { operandTypeName, typeName } from '../utils/symbols.js'

/*
 * The logical data types: the boolean value, and the two conditions (`if`, `alwaysIf`). They share the group
 * `logical`, so `and` and `or` take any of them. A condition is not a value source: it can't be a column or be
 * projected, and it has a value of its own, the neutral (no condition), which a boolean value doesn't have.
 */

/** What a position that takes a boolean value accepts */
export type IBooleanValue = IValueWithType<'type:boolean:logical:'>

/** A boolean value */
export abstract class BooleanType extends EqualableType<boolean> {
    static override readonly __type = 'boolean'
    static override readonly __customType = undefined
    declare [typeName]: 'type:boolean:logical:'
    declare [operandTypeName]: 'type:boolean:logical:'

    abstract negate(): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract and(value: boolean): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract and<VALUE extends ILogicalValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract or(value: boolean): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract or<VALUE extends ILogicalValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract onlyWhen(condition: boolean): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract ignoreWhen(condition: boolean): IfValueSource<SourceOf<this>, OptionalOf<this>>
}

/** What a condition adds to its data type: its source and its optionality */
export interface ConditionOfType</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE extends ConditionType, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends HasSource<SOURCE> {
    [valueType]: boolean
    [optionalType]: OPTIONAL_TYPE
    [valueSourceType]: TYPE
}

/** The root of the conditions */
export abstract class ConditionType extends BaseType<boolean> {
}

/** A condition that is ignored (the neutral) when the value it compares has no value */
export abstract class IfType extends ConditionType {
    declare [typeName]: 'type:if:logical:'
    declare [operandTypeName]: 'type:if:logical:'

    abstract negate(): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract and(value: boolean): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract and<VALUE extends IBooleanValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract and<VALUE extends ILogicalValue>(value: VALUE): IfValueSource<SourceOf<this> | SourceOf<VALUE>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract or(value: boolean): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract or<VALUE extends IBooleanValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract or<VALUE extends ILogicalValue>(value: VALUE): IfValueSource<SourceOf<this> | SourceOf<VALUE>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract onlyWhen(condition: boolean): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract ignoreWhen(condition: boolean): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract trueWhenNoValue(): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract falseWhenNoValue(): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract valueWhenNoValue(value: boolean): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract valueWhenNoValue<VALUE extends IBooleanValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract valueWhenNoValue<VALUE extends ILogicalValue>(value: VALUE): IfValueSource<SourceOf<this> | SourceOf<VALUE>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
}

/** A condition that always applies, and keeps applying when it is combined with others */
export abstract class AlwaysIfType extends ConditionType {
    declare [typeName]: 'type:alwaysIf:logical:'
    declare [operandTypeName]: 'type:alwaysIf:logical:'

    abstract negate(): AlwaysIfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract and(value: boolean): AlwaysIfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract and<VALUE extends ILogicalValue>(value: VALUE): AlwaysIfValueSource<SourceOf<this> | SourceOf<VALUE>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract or(value: boolean): AlwaysIfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract or<VALUE extends ILogicalValue>(value: VALUE): AlwaysIfValueSource<SourceOf<this> | SourceOf<VALUE>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract onlyWhen(condition: boolean): AlwaysIfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract ignoreWhen(condition: boolean): AlwaysIfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract trueWhenNoValue(): AlwaysIfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract falseWhenNoValue(): AlwaysIfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract valueWhenNoValue(value: boolean): AlwaysIfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract valueWhenNoValue<VALUE extends ILogicalValue>(value: VALUE): AlwaysIfValueSource<SourceOf<this> | SourceOf<VALUE>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
}

export type IfValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = IfType & ConditionOfType<SOURCE, IfType, OPTIONAL_TYPE>
export type AlwaysIfValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = AlwaysIfType & ConditionOfType<SOURCE, AlwaysIfType, OPTIONAL_TYPE>

/** A condition, or a boolean value, used as a condition that always applies (the where of a query, the on of a join) */
export function asAlwaysIfValueSource<VALUE extends ILogicalValue>(valueSource: VALUE): AlwaysIfValueSource<SourceOf<VALUE>, OptionalOf<VALUE>> {
    return valueSource as any
}
