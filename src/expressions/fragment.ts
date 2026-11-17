import type { optionalType, source } from '../utils/symbols.js'
import type { NSource } from '../utils/sourceName.js'
import type { CombinedOptionalityOfUnion, OptionalType, OptionalTypeOfValue, TypedValueSource, ValueSourceOf } from '../typeSystem/valueSource.js'

import type { ArgBaseTypeForFn, ArgForBuilderIfValue, ArgForFn, MapArgumentToValueSource, TypeOfArgument } from '../typeSystem/arguments.js'
import type { ILogicalValueSource, RemapValueSourceType, RemapValueSourceTypeWithOptionalType } from '../typeSystem/base.js'
import type { IfValueSource } from '../typeSystem/logical.js'


export interface FragmentBuilder0</*in|out*/ NO_SOURCE extends NSource, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    as<RESULT extends ValueSourceOf<NO_SOURCE | EXTRA_SOURCE>>(impl: () => RESULT): () => RESULT
}

export interface FragmentBuilder1</*in|out*/ NO_SOURCE extends NSource, A1, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    as<RESULT extends ValueSourceOf<NO_SOURCE | EXTRA_SOURCE>>(impl: (a1: MapArgumentToValueSource<NO_SOURCE, A1>) => RESULT): FragmentFunction1<NO_SOURCE, A1, RESULT, EXTRA_SOURCE>
}

export interface FragmentBuilder2</*in|out*/ NO_SOURCE extends NSource, A1, A2, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    as<RESULT extends ValueSourceOf<NO_SOURCE | EXTRA_SOURCE>>(impl: (a1: MapArgumentToValueSource<NO_SOURCE, A1>, a2: MapArgumentToValueSource<NO_SOURCE, A2>) => RESULT): FragmentFunction2<NO_SOURCE, A1, A2, RESULT, EXTRA_SOURCE>
}

export interface FragmentBuilder3</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    as<RESULT extends ValueSourceOf<NO_SOURCE | EXTRA_SOURCE>>(impl: (a1: MapArgumentToValueSource<NO_SOURCE, A1>, a2: MapArgumentToValueSource<NO_SOURCE, A2>, a3: MapArgumentToValueSource<NO_SOURCE, A3>) => RESULT): FragmentFunction3<NO_SOURCE, A1, A2, A3, RESULT, EXTRA_SOURCE>
}

export interface FragmentBuilder4</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    as<RESULT extends ValueSourceOf<NO_SOURCE | EXTRA_SOURCE>>(impl: (a1: MapArgumentToValueSource<NO_SOURCE, A1>, a2: MapArgumentToValueSource<NO_SOURCE, A2>, a3: MapArgumentToValueSource<NO_SOURCE, A3>, a4: MapArgumentToValueSource<NO_SOURCE, A4>) => RESULT): FragmentFunction4<NO_SOURCE, A1, A2, A3, A4, RESULT, EXTRA_SOURCE>
}

export interface FragmentBuilder5</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, A5, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    as<RESULT extends ValueSourceOf<NO_SOURCE | EXTRA_SOURCE>>(impl: (a1: MapArgumentToValueSource<NO_SOURCE, A1>, a2: MapArgumentToValueSource<NO_SOURCE, A2>, a3: MapArgumentToValueSource<NO_SOURCE, A3>, a4: MapArgumentToValueSource<NO_SOURCE, A4>, a5: MapArgumentToValueSource<NO_SOURCE, A5>) => RESULT): FragmentFunction5<NO_SOURCE, A1, A2, A3, A4, A5, RESULT, EXTRA_SOURCE>
}

export interface FragmentFunction1</*in|out*/ NO_SOURCE extends NSource, A1, RESULT, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    (a1: TypeOfArgument<A1>): RemapValueSourceType<NO_SOURCE | EXTRA_SOURCE, RESULT>
    <T1 extends NSource>(a1: ArgForFn<T1, A1>): RemapValueSourceType<T1 | EXTRA_SOURCE, RESULT>
}

export interface FragmentFunction2</*in|out*/ NO_SOURCE extends NSource, A1, A2, RESULT, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>): RemapValueSourceType<NO_SOURCE | EXTRA_SOURCE, RESULT>
    <T1 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>): RemapValueSourceType<T1 | EXTRA_SOURCE, RESULT>

    <T2 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>): RemapValueSourceType<T2 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T2 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>): RemapValueSourceType<T1 | T2 | EXTRA_SOURCE, RESULT>
}

export interface FragmentFunction3</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, RESULT, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<NO_SOURCE | EXTRA_SOURCE, RESULT>
    <T1 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T1 | EXTRA_SOURCE, RESULT>
    <T2 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T2 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T2 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T1 | T2 | EXTRA_SOURCE, RESULT>

    <T3 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>): RemapValueSourceType<T3 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>): RemapValueSourceType<T1 | T3 | EXTRA_SOURCE, RESULT>
    <T2 extends NSource, T3 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>): RemapValueSourceType<T2 | T3 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>): RemapValueSourceType<T1 | T2 | T3 | EXTRA_SOURCE, RESULT>
}

export interface FragmentFunction4</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, RESULT, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<NO_SOURCE | EXTRA_SOURCE, RESULT>
    <T1 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1 | EXTRA_SOURCE, RESULT>
    <T2 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T2 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T2 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1 | T2 | EXTRA_SOURCE, RESULT>
    <T3 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T3 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1 | T3 | EXTRA_SOURCE, RESULT>
    <T2 extends NSource, T3 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T2 | T3 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1 | T2 | T3 | EXTRA_SOURCE, RESULT>

    <T4 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T4 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T1 | T4 | EXTRA_SOURCE, RESULT>
    <T2 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T2 | T4 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T2 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T1 | T2 | T4 | EXTRA_SOURCE, RESULT>
    <T3 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T3 | T4 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T3 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T1 | T3 | T4 | EXTRA_SOURCE, RESULT>
    <T2 extends NSource, T3 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T2 | T3 | T4 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T1 | T2 | T3 | T4 | EXTRA_SOURCE, RESULT>
}

export interface FragmentFunction5</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, A5, RESULT, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<NO_SOURCE | EXTRA_SOURCE, RESULT>
    <T1 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | EXTRA_SOURCE, RESULT>
    <T2 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T2 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2 | EXTRA_SOURCE, RESULT>
    <T3 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T3 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T3 | EXTRA_SOURCE, RESULT>
    <T2 extends NSource, T3 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2 | T3 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2 | T3 | EXTRA_SOURCE, RESULT>
    <T4 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T4 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T4 | EXTRA_SOURCE, RESULT>
    <T2 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2 | T4 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T2 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2 | T4 | EXTRA_SOURCE, RESULT>
    <T3 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T3 | T4 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T3 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T3 | T4 | EXTRA_SOURCE, RESULT>
    <T2 extends NSource, T3 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2 | T3 | T4 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2 | T3 | T4 | EXTRA_SOURCE, RESULT>

    <T5 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T5 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T5 | EXTRA_SOURCE, RESULT>
    <T2 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T2 | T5 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T2 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T5 | EXTRA_SOURCE, RESULT>
    <T3 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T3 | T5 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T3 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T3 | T5 | EXTRA_SOURCE, RESULT>
    <T2 extends NSource, T3 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T2 | T3 | T5 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T3 | T5 | EXTRA_SOURCE, RESULT>
    <T4 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T4 | T5 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T4 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T4 | T5 | EXTRA_SOURCE, RESULT>
    <T2 extends NSource, T4 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T2 | T4 | T5 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T2 extends NSource, T4 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T4 | T5 | EXTRA_SOURCE, RESULT>
    <T3 extends NSource, T4 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T3 | T4 | T5 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T3 | T4 | T5 | EXTRA_SOURCE, RESULT>
    <T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T2 | T3 | T4 | T5 | EXTRA_SOURCE, RESULT>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T3 | T4 | T5 | EXTRA_SOURCE, RESULT>
}

export interface FragmentBuilder0IfValue</*in|out*/ NO_SOURCE extends NSource, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    as<RESULT extends ILogicalValueSource<NO_SOURCE | EXTRA_SOURCE, any>>(impl: () => RESULT): () => IfValueSource<NO_SOURCE | EXTRA_SOURCE, RESULT[typeof optionalType]>
}

export interface FragmentBuilder1IfValue</*in|out*/ NO_SOURCE extends NSource, A1, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    as<RESULT extends ILogicalValueSource<NO_SOURCE | EXTRA_SOURCE, any>>(impl: (a1: ArgForBuilderIfValue<NO_SOURCE, A1>) => RESULT): FragmentFunctionIfValue1<NO_SOURCE, A1, RESULT[typeof optionalType], EXTRA_SOURCE>
}

export interface FragmentBuilder2IfValue</*in|out*/ NO_SOURCE extends NSource, A1, A2, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    as<RESULT extends ILogicalValueSource<NO_SOURCE | EXTRA_SOURCE, any>>(impl: (a1: ArgForBuilderIfValue<NO_SOURCE, A1>, a2: ArgForBuilderIfValue<NO_SOURCE, A2>) => RESULT): FragmentFunctionIfValue2<NO_SOURCE, A1, A2, RESULT[typeof optionalType], EXTRA_SOURCE>
}

export interface FragmentBuilder3IfValue</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    as<RESULT extends ILogicalValueSource<NO_SOURCE | EXTRA_SOURCE, any>>(impl: (a1: ArgForBuilderIfValue<NO_SOURCE, A1>, a2: ArgForBuilderIfValue<NO_SOURCE, A2>, a3: ArgForBuilderIfValue<NO_SOURCE, A3>) => RESULT): FragmentFunctionIfValue3<NO_SOURCE, A1, A2, A3, RESULT[typeof optionalType], EXTRA_SOURCE>
}

export interface FragmentBuilder4IfValue</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    as<RESULT extends ILogicalValueSource<NO_SOURCE | EXTRA_SOURCE, any>>(impl: (a1: ArgForBuilderIfValue<NO_SOURCE, A1>, a2: ArgForBuilderIfValue<NO_SOURCE, A2>, a3: ArgForBuilderIfValue<NO_SOURCE, A3>, a4: ArgForBuilderIfValue<NO_SOURCE, A4>) => RESULT): FragmentFunctionIfValue4<NO_SOURCE, A1, A2, A3, A4, RESULT[typeof optionalType], EXTRA_SOURCE>
}

export interface FragmentBuilder5IfValue</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, A5, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    as<RESULT extends ILogicalValueSource<NO_SOURCE | EXTRA_SOURCE, any>>(impl: (a1: ArgForBuilderIfValue<NO_SOURCE, A1>, a2: ArgForBuilderIfValue<NO_SOURCE, A2>, a3: ArgForBuilderIfValue<NO_SOURCE, A3>, a4: ArgForBuilderIfValue<NO_SOURCE, A4>, a5: ArgForBuilderIfValue<NO_SOURCE, A5>) => RESULT): FragmentFunctionIfValue5<NO_SOURCE, A1, A2, A3, A4, A5, RESULT[typeof optionalType], EXTRA_SOURCE>
}

export interface FragmentFunctionIfValue1</*in|out*/ NO_SOURCE extends NSource, A1, /*in|out*/ OPTIONAL_TYPE extends OptionalType, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    (a1: TypeOfArgument<A1>): IfValueSource<NO_SOURCE | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource>(a1: ArgForFn<T1, A1>): IfValueSource<T1 | EXTRA_SOURCE, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue2</*in|out*/ NO_SOURCE extends NSource, A1, A2, /*in|out*/ OPTIONAL_TYPE extends OptionalType, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>): IfValueSource<NO_SOURCE | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>): IfValueSource<T1 | EXTRA_SOURCE, OPTIONAL_TYPE>

    <T2 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>): IfValueSource<T2 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>): IfValueSource<T1 | T2 | EXTRA_SOURCE, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue3</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, /*in|out*/ OPTIONAL_TYPE extends OptionalType, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): IfValueSource<NO_SOURCE | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): IfValueSource<T1 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T2 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>): IfValueSource<T2 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>): IfValueSource<T1 | T2 | EXTRA_SOURCE, OPTIONAL_TYPE>

    <T3 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>): IfValueSource<T3 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>): IfValueSource<T1 | T3 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T2 extends NSource, T3 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>): IfValueSource<T2 | T3 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>): IfValueSource<T1 | T2 | T3 | EXTRA_SOURCE, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue4</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, /*in|out*/ OPTIONAL_TYPE extends OptionalType, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<NO_SOURCE | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T2 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T2 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T2 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T3 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T3 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T3 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T2 extends NSource, T3 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T2 | T3 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T2 | T3 | EXTRA_SOURCE, OPTIONAL_TYPE>

    <T4 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): IfValueSource<T4 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): IfValueSource<T1 | T4 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T2 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): IfValueSource<T2 | T4 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): IfValueSource<T1 | T2 | T4 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T3 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): IfValueSource<T3 | T4 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T3 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): IfValueSource<T1 | T3 | T4 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T2 extends NSource, T3 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): IfValueSource<T2 | T3 | T4 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): IfValueSource<T1 | T2 | T3 | T4 | EXTRA_SOURCE, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue5</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, A5, /*in|out*/ OPTIONAL_TYPE extends OptionalType, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<NO_SOURCE | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T2 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T3 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T3 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T3 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T2 extends NSource, T3 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T3 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T3 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T4 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T4 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T4 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T2 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T4 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T4 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T3 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T3 | T4 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T3 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T3 | T4 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T2 extends NSource, T3 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T3 | T4 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T3 | T4 | EXTRA_SOURCE, OPTIONAL_TYPE>

    <T5 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T5 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T5 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T2 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T2 | T5 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T2 | T5 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T3 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T3 | T5 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T3 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T3 | T5 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T2 extends NSource, T3 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T2 | T3 | T5 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T2 | T3 | T5 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T4 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T4 | T5 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T4 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T4 | T5 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T2 extends NSource, T4 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T2 | T4 | T5 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T4 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T2 | T4 | T5 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T3 extends NSource, T4 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T3 | T4 | T5 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T3 | T4 | T5 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T2 | T3 | T4 | T5 | EXTRA_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T2 | T3 | T4 | T5 | EXTRA_SOURCE, OPTIONAL_TYPE>
}

export interface FragmentBuilderMaybeOptional0</*in|out*/ NO_SOURCE extends NSource, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    as<RESULT extends ValueSourceOf<NO_SOURCE | EXTRA_SOURCE>>(impl: () => RESULT): () => RESULT
}

export interface FragmentBuilderMaybeOptional1</*in|out*/ NO_SOURCE extends NSource, A1, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    as<RESULT extends TypedValueSource<NO_SOURCE | EXTRA_SOURCE, any, 'optional'>>(impl: (a1: MapArgumentToValueSource<NO_SOURCE, A1>) => RESULT): FragmentFunctionMaybeOptional1<NO_SOURCE, A1, RESULT, EXTRA_SOURCE>
}

export interface FragmentBuilderMaybeOptional2</*in|out*/ NO_SOURCE extends NSource, A1, A2, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    as<RESULT extends TypedValueSource<NO_SOURCE | EXTRA_SOURCE, any, 'optional'>>(impl: (a1: MapArgumentToValueSource<NO_SOURCE, A1>, a2: MapArgumentToValueSource<NO_SOURCE, A2>) => RESULT): FragmentFunctionMaybeOptional2<NO_SOURCE, A1, A2, RESULT, EXTRA_SOURCE>
}

export interface FragmentBuilderMaybeOptional3</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    as<RESULT extends TypedValueSource<NO_SOURCE | EXTRA_SOURCE, any, 'optional'>>(impl: (a1: MapArgumentToValueSource<NO_SOURCE, A1>, a2: MapArgumentToValueSource<NO_SOURCE, A2>, a3: MapArgumentToValueSource<NO_SOURCE, A3>) => RESULT): FragmentFunctionMaybeOptional3<NO_SOURCE, A1, A2, A3, RESULT, EXTRA_SOURCE>
}

export interface FragmentBuilderMaybeOptional4</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    as<RESULT extends TypedValueSource<NO_SOURCE | EXTRA_SOURCE, any, 'optional'>>(impl: (a1: MapArgumentToValueSource<NO_SOURCE, A1>, a2: MapArgumentToValueSource<NO_SOURCE, A2>, a3: MapArgumentToValueSource<NO_SOURCE, A3>, a4: MapArgumentToValueSource<NO_SOURCE, A4>) => RESULT): FragmentFunctionMaybeOptional4<NO_SOURCE, A1, A2, A3, A4, RESULT, EXTRA_SOURCE>
}

export interface FragmentBuilderMaybeOptional5</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, A5, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    as<RESULT extends TypedValueSource<NO_SOURCE | EXTRA_SOURCE, any, 'optional'>>(impl: (a1: MapArgumentToValueSource<NO_SOURCE, A1>, a2: MapArgumentToValueSource<NO_SOURCE, A2>, a3: MapArgumentToValueSource<NO_SOURCE, A3>, a4: MapArgumentToValueSource<NO_SOURCE, A4>, a5: MapArgumentToValueSource<NO_SOURCE, A5>) => RESULT): FragmentFunctionMaybeOptional5<NO_SOURCE, A1, A2, A3, A4, A5, RESULT, EXTRA_SOURCE>
}

export interface FragmentFunctionMaybeOptional1</*in|out*/ NO_SOURCE extends NSource, A1, RESULT, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    <T1 extends TypeOfArgument<A1>>(a1: T1): RemapValueSourceTypeWithOptionalType<NO_SOURCE | EXTRA_SOURCE, RESULT, OptionalTypeOfValue<T1>>
    <T1 extends ArgBaseTypeForFn<A1>>(a1: T1): RemapValueSourceTypeWithOptionalType<T1[typeof source] | EXTRA_SOURCE, RESULT, T1[typeof optionalType]>
}

export interface FragmentFunctionMaybeOptional2</*in|out*/ NO_SOURCE extends NSource, A1, A2, RESULT, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>>(a1: T1, a2: T2): RemapValueSourceTypeWithOptionalType<NO_SOURCE | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>>(a1: T1, a2: T2): RemapValueSourceTypeWithOptionalType<T1[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2>>>

    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>>(a1: T1, a2: T2): RemapValueSourceTypeWithOptionalType<T2[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>>(a1: T1, a2: T2): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | T2[typeof optionalType]>>
}

export interface FragmentFunctionMaybeOptional3</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, RESULT, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<NO_SOURCE | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T1[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T2[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3>>>

    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T3[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T3[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | T3[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T3[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T3[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType]>>
}

export interface FragmentFunctionMaybeOptional4</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, RESULT, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<NO_SOURCE | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T2[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4>>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T3[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType] | OptionalTypeOfValue<T4>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T3[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | T3[typeof optionalType] | OptionalTypeOfValue<T4>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T3[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType] | OptionalTypeOfValue<T4>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T3[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType] | OptionalTypeOfValue<T4>>>

    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T4[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | T4[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T4[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | T4[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T4[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3> | T4[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T4[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3> | T4[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T3[typeof source] | T4[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType] | T4[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T3[typeof source] | T4[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | T3[typeof optionalType] | T4[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T3[typeof source] | T4[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType] | T4[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T3[typeof source] | T4[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType] | T4[typeof optionalType]>>
}

export interface FragmentFunctionMaybeOptional5</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, A5, RESULT, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<NO_SOURCE | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T3[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType] | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T3[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | T3[typeof optionalType] | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T3[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType] | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T3[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType] | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T4[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T4[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T4[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3> | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T4[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3> | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T3[typeof source] | T4[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType] | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T3[typeof source] | T4[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | T3[typeof optionalType] | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T3[typeof source] | T4[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType] | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T3[typeof source] | T4[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType] | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>

    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T5[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T5[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T5[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T5[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T3[typeof source] | T5[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType] | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T3[typeof source] | T5[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | T3[typeof optionalType] | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T3[typeof source] | T5[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType] | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T3[typeof source] | T5[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType] | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T4[typeof source] | T5[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T4[typeof source] | T5[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T4[typeof source] | T5[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3> | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T4[typeof source] | T5[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3> | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T3[typeof source] | T4[typeof source] | T5[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType] | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T3[typeof source] | T4[typeof source] | T5[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | T3[typeof optionalType] | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T3[typeof source] | T4[typeof source] | T5[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType] | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T3[typeof source] | T4[typeof source] | T5[typeof source] | EXTRA_SOURCE, RESULT, CombinedOptionalityOfUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType] | T4[typeof optionalType] | T5[typeof optionalType]>>
}