export abstract class Sequence<T> {
    abstract nextValue(): T
    abstract currentValue(): T
}