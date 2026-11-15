import type { AnyType, ConditionOfType, IValueSource, RemapValueSourceType, ValueSource, ValueTypeOf } from './base.js'
import type { IfType, IfValueSource } from './logical.js'
import type { OptionalValueType } from './valueSource.js'
import type { CustomType, TypeAdapter } from '../TypeAdapter.js'
import type { NSource } from '../utils/sourceName.js'
import { valueSourceType } from '../utils/symbols.js'

/*
 * The arguments of a fragment built with arguments (buildFragmentWithArgs, ...): each one says its data type, whether
 * it can be null, and whether it takes only a value or a value source too.
 */

export type ArgumentOptionalType = 'required' | 'optional'
export type ArgumentMode = 'value' | 'combined'

/** An argument of a fragment, of its data type */
export class Argument</*in|out*/ TYPE extends AnyType, /*in|out*/ OPTIONAL_TYPE extends ArgumentOptionalType, /*in|out*/ MODE extends ArgumentMode> {
    readonly type: string
    readonly typeName: string
    readonly customType: CustomType | undefined
    readonly optionalType: OPTIONAL_TYPE
    readonly mode: MODE
    readonly adapter?: TypeAdapter | undefined
    declare [valueSourceType]: TYPE

    constructor (type: string, typeName: string, customType: CustomType | undefined, optionalType: OPTIONAL_TYPE, mode: MODE, adapter?: TypeAdapter) {
        this.type = type
        this.typeName = typeName
        this.customType = customType
        this.optionalType = optionalType
        this.mode = mode
        this.adapter = adapter
    }
}

/** The type of the value an argument takes */
export type TypeOfArgument<ARG> = ARG extends Argument<infer TYPE, infer OPTIONAL_TYPE, any> ? ValueTypeOf<TYPE> | OptionalValueType<OPTIONAL_TYPE> : never

/** The value source an argument is inside the fragment */
export type MapArgumentToValueSource<SOURCE extends NSource, ARG> =
    ARG extends Argument<infer TYPE, infer OPTIONAL_TYPE, any> ? ValueSource<SOURCE, TYPE, OPTIONAL_TYPE> : never

/** What an argument accepts as a value source */
export type MapArgumentToIValueSource<SOURCE extends NSource, ARG> =
    ARG extends Argument<infer TYPE, infer OPTIONAL_TYPE, any> ? IValueSource<SOURCE, TYPE, OPTIONAL_TYPE> : never

/** What an optional argument accepts as a value source: one of any optionality */
export type MapArgumentToIValueSourceAsAnyOptionalType<SOURCE extends NSource, ARG> =
    ARG extends Argument<infer TYPE, any, any> ? IValueSource<SOURCE, TYPE, any> : never

/** What the function of a fragment takes for an argument as a value source; an argument that takes only a value, none */
export type ArgForFn<SOURCE extends NSource, ARG> =
    ARG extends Argument<any, infer OPTIONAL_TYPE, infer MODE> ? (
        MODE extends 'value' ? never : (
            'required' extends OPTIONAL_TYPE
            ? MapArgumentToIValueSource<SOURCE, ARG>
            : MapArgumentToIValueSourceAsAnyOptionalType<SOURCE, ARG>
        )
    ): never

/** What the function of a fragment takes for an argument as a value source, of any source */
export type ArgBaseTypeForFn<ARG> =
    ARG extends Argument<any, infer OPTIONAL_TYPE, infer MODE> ? (
        MODE extends 'value' ? never : (
            'required' extends OPTIONAL_TYPE
            ? MapArgumentToIValueSource<any, ARG>
            : MapArgumentToIValueSourceAsAnyOptionalType<any, ARG>
        )
    ): never

/** An argument that takes only a value is required inside the fragment of an if-value builder: it is there only with a value */
export type RequiredArgumentWhenValueMode<ARG> =
    ARG extends Argument<infer TYPE, any, infer MODE> ? (
        MODE extends 'value' ? Argument<TYPE, 'required', MODE> : ARG
    ): never

/** The value source an argument is inside the fragment of an if-value builder */
export type ArgForBuilderIfValue<SOURCE extends NSource, ARG> =
    MapArgumentToValueSource<SOURCE, RequiredArgumentWhenValueMode<ARG>>

/** A value source, or an if condition, with another source */
export type RemapValueSourceTypeIfValue<SOURCE extends NSource, VALUE_SOURCE> =
    VALUE_SOURCE extends ConditionOfType<any, IfType, infer OPTIONAL_TYPE> ? IfValueSource<SOURCE, OPTIONAL_TYPE> : RemapValueSourceType<SOURCE, VALUE_SOURCE>
