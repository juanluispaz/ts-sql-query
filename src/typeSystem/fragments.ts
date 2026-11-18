import type { AnyType, IValueWithType, SourceOf, ValueSource } from './base.js'
import type { OptionalType, ValueSourceOf } from './valueSource.js'
import type { NSource } from '../utils/sourceName.js'

/**
 * The SQL of a fragment of a data type: the text and the value sources it embeds give a value source of the data type,
 * whose source is the sources of the value sources embedded (and the extra one, an aggregate in an aggregate fragment)
 */
export interface FragmentExpression</*in|out*/ NO_SOURCE extends NSource, /*in|out*/ TYPE extends AnyType, /*in|out*/ OPTIONAL_TYPE extends OptionalType, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    sql(sql: TemplateStringsArray): ValueSource<NO_SOURCE | EXTRA_SOURCE, TYPE, OPTIONAL_TYPE>
    sql<T1 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): ValueSource<T1 | EXTRA_SOURCE, TYPE, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): ValueSource<T1 | T2 | EXTRA_SOURCE, TYPE, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): ValueSource<T1 | T2 | T3 | EXTRA_SOURCE, TYPE, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): ValueSource<T1 | T2 | T3 | T4 | EXTRA_SOURCE, TYPE, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): ValueSource<T1 | T2 | T3 | T4 | T5 | EXTRA_SOURCE, TYPE, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): ValueSource<T1 | T2 | T3 | T4 | T5 | T6 | EXTRA_SOURCE, TYPE, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource, T7 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): ValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7 | EXTRA_SOURCE, TYPE, OPTIONAL_TYPE>
}

/**
 * The SQL of a fragment of a data type written in a method of a class of a data type (`fragmentWithType` of the class):
 * it embeds the value source the method is called on, `this`, and other value sources of any data type, like the
 * operands of a method; its source is the ones of what it embeds, the one of `this` known when the method is called on a
 * column
 */
export interface DataTypeFragmentExpression</*in|out*/ THIS, /*in|out*/ TYPE extends AnyType, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray): ValueSource<never, TYPE, OPTIONAL_TYPE>
    sql<V1 extends THIS | IValueWithType<string>>(sql: TemplateStringsArray, v1: V1): ValueSource<SourceOf<V1>, TYPE, OPTIONAL_TYPE>
    sql<V1 extends THIS | IValueWithType<string>, V2 extends THIS | IValueWithType<string>>(sql: TemplateStringsArray, v1: V1, v2: V2): ValueSource<SourceOf<V1> | SourceOf<V2>, TYPE, OPTIONAL_TYPE>
    sql<V1 extends THIS | IValueWithType<string>, V2 extends THIS | IValueWithType<string>, V3 extends THIS | IValueWithType<string>>(sql: TemplateStringsArray, v1: V1, v2: V2, v3: V3): ValueSource<SourceOf<V1> | SourceOf<V2> | SourceOf<V3>, TYPE, OPTIONAL_TYPE>
    sql<V1 extends THIS | IValueWithType<string>, V2 extends THIS | IValueWithType<string>, V3 extends THIS | IValueWithType<string>, V4 extends THIS | IValueWithType<string>>(sql: TemplateStringsArray, v1: V1, v2: V2, v3: V3, v4: V4): ValueSource<SourceOf<V1> | SourceOf<V2> | SourceOf<V3> | SourceOf<V4>, TYPE, OPTIONAL_TYPE>
    sql<V1 extends THIS | IValueWithType<string>, V2 extends THIS | IValueWithType<string>, V3 extends THIS | IValueWithType<string>, V4 extends THIS | IValueWithType<string>, V5 extends THIS | IValueWithType<string>>(sql: TemplateStringsArray, v1: V1, v2: V2, v3: V3, v4: V4, v5: V5): ValueSource<SourceOf<V1> | SourceOf<V2> | SourceOf<V3> | SourceOf<V4> | SourceOf<V5>, TYPE, OPTIONAL_TYPE>
    sql<V1 extends THIS | IValueWithType<string>, V2 extends THIS | IValueWithType<string>, V3 extends THIS | IValueWithType<string>, V4 extends THIS | IValueWithType<string>, V5 extends THIS | IValueWithType<string>, V6 extends THIS | IValueWithType<string>>(sql: TemplateStringsArray, v1: V1, v2: V2, v3: V3, v4: V4, v5: V5, v6: V6): ValueSource<SourceOf<V1> | SourceOf<V2> | SourceOf<V3> | SourceOf<V4> | SourceOf<V5> | SourceOf<V6>, TYPE, OPTIONAL_TYPE>
    sql<V1 extends THIS | IValueWithType<string>, V2 extends THIS | IValueWithType<string>, V3 extends THIS | IValueWithType<string>, V4 extends THIS | IValueWithType<string>, V5 extends THIS | IValueWithType<string>, V6 extends THIS | IValueWithType<string>, V7 extends THIS | IValueWithType<string>>(sql: TemplateStringsArray, v1: V1, v2: V2, v3: V3, v4: V4, v5: V5, v6: V6, v7: V7): ValueSource<SourceOf<V1> | SourceOf<V2> | SourceOf<V3> | SourceOf<V4> | SourceOf<V5> | SourceOf<V6> | SourceOf<V7>, TYPE, OPTIONAL_TYPE>
}
