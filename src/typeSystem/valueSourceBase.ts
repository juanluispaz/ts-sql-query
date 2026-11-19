import { BaseType, type AnyType, type ValueSource, type ValueSourceOfType } from './base.js'
import type { AnyValueSource } from './valueSource.js'

/**
 * A value source as `is` of a data type narrows it, keeping what is known of it (its source and its optionality): each
 * value source of a union of the data type, or of one that extends it, as it is; of a data type it extends (a
 * NumberType asked whether it is an IntType), the value source of the data type asked with its source and optionality;
 * of another data type, none. A value source of an unknown data type, only the data type asked
 */
export type NarrowedToType<VALUE, TYPE extends AnyType> =
    0 extends (1 & VALUE) ? ValueSource<any, TYPE, any> :
    VALUE extends ValueSourceOfType<infer SOURCE, infer VALUE_TYPE, infer OPTIONAL_TYPE>
        ? (VALUE_TYPE extends TYPE ? VALUE : TYPE extends VALUE_TYPE ? ValueSource<SOURCE, TYPE, OPTIONAL_TYPE> : never)
        : VALUE & TYPE

/** The root of the data types of the value sources (a condition is not one) */
export abstract class ValueSourceBaseType</*in|out*/ VALUE_TYPE> extends BaseType<VALUE_TYPE> {
    /**
     * Whether the value is a value source of this data type or of one that extends it (`NumberType.is` answers yes to
     * an int and to a double): an instance of the class. A condition is a boolean at run time, and the two data types
     * of an aggregated array are one class extending the other
     */
    static is<TYPE extends AnyType, VALUE extends AnyValueSource>(this: { readonly prototype: TYPE }, value: VALUE): value is Extract<NarrowedToType<VALUE, TYPE>, VALUE>
    static is(value: unknown): boolean {
        return value instanceof (this as unknown as abstract new (...args: any) => unknown)
    }

    /**
     * Whether this value source is a constant: a value of JavaScript given as it is to the query
     * (as `const` and `optionalConst` of the connection make), not a column or an expression
     */
    abstract isConstValue(): boolean
    /**
     * The value of JavaScript of a constant (`isConstValue` is true); for any other value source
     * it throws an error
     */
    abstract getConstValue(): VALUE_TYPE
    /**
     * This same value when `when` is true. When it is false, a query that uses this value is not
     * sent: the execute method rejects with the error (a text becomes an error of the library),
     * and `query()` and `params()` throw it
     */
    abstract allowWhen(when: boolean, errorMessage: string): this
    /**
     * This same value when `when` is true. When it is false, a query that uses this value is not
     * sent: the execute method rejects with the error (a text becomes an error of the library),
     * and `query()` and `params()` throw it
     */
    abstract allowWhen(when: boolean, error: Error): this
    /**
     * This same value when `when` is false. When it is true, a query that uses this value is not
     * sent: the execute method rejects with the error (a text becomes an error of the library),
     * and `query()` and `params()` throw it
     */
    abstract disallowWhen(when: boolean, errorMessage: string): this
    /**
     * This same value when `when` is false. When it is true, a query that uses this value is not
     * sent: the execute method rejects with the error (a text becomes an error of the library),
     * and `query()` and `params()` throw it
     */
    abstract disallowWhen(when: boolean, error: Error): this
}
