/*
 * A value source, a table, a view, values or a `with` doesn't change once created: its fields are readonly. Only its
 * creation, and whoever finishes it (the marks of a column, the copy of a table with its alias, the name a recursive
 * select gives to its view), writes them, through this view.
 */

/** An object while it is created: its fields can be written */
export type InCreation<T> = { -readonly [K in keyof T]: T[K] }

/** The object as it is while it is created: only where its creation is finished */
export function __inCreation<T extends object>(value: T): InCreation<T> {
    return value
}
