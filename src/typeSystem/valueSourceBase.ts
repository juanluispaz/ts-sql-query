import { BaseType, type AnyType, type ValueSource } from './base.js'

/** The root of the data types of the value sources (a condition is not one) */
export abstract class ValueSourceBaseType</*in|out*/ VALUE_TYPE> extends BaseType<VALUE_TYPE> {
    /**
     * Whether the value is a value source of this data type or of one that extends it (`NumberType.is` answers yes to
     * an int and to a double): an instance of the class. A condition is a boolean at run time, and the two data types
     * of an aggregated array are one class extending the other
     */
    static is<TYPE extends AnyType>(this: { readonly prototype: TYPE }, value: any): value is ValueSource<any, TYPE, any> {
        return value instanceof (this as unknown as abstract new (...args: any) => unknown)
    }

    abstract isConstValue(): boolean
    abstract getConstValue(): VALUE_TYPE
    abstract allowWhen(when: boolean, errorMessage: string): this
    abstract allowWhen(when: boolean, error: Error): this
    abstract disallowWhen(when: boolean, errorMessage: string): this
    abstract disallowWhen(when: boolean, error: Error): this
}
