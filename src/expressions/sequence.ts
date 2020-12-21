export interface Sequence<T> {
    nextValue(): T
    currentValue(): T
}