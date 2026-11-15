import type { AnyType, ValueSource } from './base.js'
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
