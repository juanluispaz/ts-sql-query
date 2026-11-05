import type { AnyValueSource, IValueSource, RemapIValueSourceType, RemapIValueSourceTypeWithOptionalType, ValueSourceValueType } from '../expressions/values.js'
import type { Default } from '../expressions/Default.js'
import type { HasSource } from '../utils/ITableOrView.js'
import type { WritableDBColumn, WritableDBColumnWithDefaultValue, WritableDBColumnWithoutDefaultValue } from '../utils/Column.js'
import type { NSource } from '../utils/sourceName.js'

/*
 * The columns of a table, view or values grouped in objects. There are no recursive types here: each level has its own
 * type, up to the same depth as the alias and the left join, as in the rest of the complex projections.
 *
 * A table can have anything else, not only columns: a group is a plain object that ends in a column.
 */

export type IsColumnsGroupCandidate<V> =
    0 extends (1 & V) ? false
    : V extends AnyValueSource | HasSource<any> | ReadonlyArray<any> | ((...args: any[]) => any) | Date ? false
    : V extends object ? true
    : false

// Has the object a writable column at any level?
type HasWritableColumn<T> = HasWritableColumnAt1<T>
type HasWritableColumnAt1<T> = { [K in keyof T]-?: T[K] extends WritableDBColumn ? true : IsColumnsGroupCandidate<T[K]> extends true ? HasWritableColumnAt2<T[K]> : never }[keyof T]
type HasWritableColumnAt2<T> = { [K in keyof T]-?: T[K] extends WritableDBColumn ? true : IsColumnsGroupCandidate<T[K]> extends true ? HasWritableColumnAt3<T[K]> : never }[keyof T]
type HasWritableColumnAt3<T> = { [K in keyof T]-?: T[K] extends WritableDBColumn ? true : IsColumnsGroupCandidate<T[K]> extends true ? HasWritableColumnAt4<T[K]> : never }[keyof T]
type HasWritableColumnAt4<T> = { [K in keyof T]-?: T[K] extends WritableDBColumn ? true : IsColumnsGroupCandidate<T[K]> extends true ? never : never }[keyof T]

export type ColumnsGroupKeyOf<T> = { [K in keyof T]-?: K extends string
    ? (IsColumnsGroupCandidate<T[K]> extends true ? ([HasWritableColumn<T[K]>] extends [never] ? never : K) : never)
    : never
}[keyof T]

// The keys of T that receive a value when writing: its columns and its groups of columns
export type ColumnsKeyOf<T> = ({ [K in keyof T]-?: T[K] extends WritableDBColumn ? K : never })[keyof T] | ColumnsGroupKeyOf<T>

// Has the object a column that must receive a value in an insert at any level?
export type HasRequiredColumn<T> = HasRequiredColumnAt1<T>
type HasRequiredColumnAt1<T> = { [K in ColumnsKeyOf<T>]-?: T[K] extends IValueSource<any, any, any, 'required'> & WritableDBColumnWithoutDefaultValue ? true : T[K] extends AnyValueSource ? never : HasRequiredColumnAt2<T[K]> }[ColumnsKeyOf<T>]
type HasRequiredColumnAt2<T> = { [K in ColumnsKeyOf<T>]-?: T[K] extends IValueSource<any, any, any, 'required'> & WritableDBColumnWithoutDefaultValue ? true : T[K] extends AnyValueSource ? never : HasRequiredColumnAt3<T[K]> }[ColumnsKeyOf<T>]
type HasRequiredColumnAt3<T> = { [K in ColumnsKeyOf<T>]-?: T[K] extends IValueSource<any, any, any, 'required'> & WritableDBColumnWithoutDefaultValue ? true : T[K] extends AnyValueSource ? never : HasRequiredColumnAt4<T[K]> }[ColumnsKeyOf<T>]
type HasRequiredColumnAt4<T> = { [K in ColumnsKeyOf<T>]-?: T[K] extends IValueSource<any, any, any, 'required'> & WritableDBColumnWithoutDefaultValue ? true : T[K] extends AnyValueSource ? never : never }[ColumnsKeyOf<T>]

export type RequiredColumnsForSetOf<T> = { [K in ColumnsKeyOf<T>]-?: 
    T[K] extends IValueSource<any, any, any, 'required'> & WritableDBColumnWithoutDefaultValue ? K
    : T[K] extends AnyValueSource ? never
    : [HasRequiredColumn<T[K]>] extends [never] ? never : K
}[ColumnsKeyOf<T>]

export type OptionalColumnsForSetOf<T> = { [K in ColumnsKeyOf<T>]-?: 
    T[K] extends WritableDBColumnWithDefaultValue ? K
    : T[K] extends IValueSource<any, any, any, infer OPTIONAL_TYPE> & WritableDBColumn
    ? (
        OPTIONAL_TYPE extends 'required'
        ? never
        : K
    )
    : T[K] extends AnyValueSource ? never
    : [HasRequiredColumn<T[K]>] extends [never] ? K : never
}[ColumnsKeyOf<T>]

// The path of every column of T
export type ColumnPathsOf<T> = ColumnPathsAt1<T>
type ColumnPathsAt1<T> = { [K in ColumnsKeyOf<T> & string]-?: T[K] extends AnyValueSource ? K : `${K}.${ColumnPathsAt2<T[K]>}` }[ColumnsKeyOf<T> & string]
type ColumnPathsAt2<T> = { [K in ColumnsKeyOf<T> & string]-?: T[K] extends AnyValueSource ? K : `${K}.${ColumnPathsAt3<T[K]>}` }[ColumnsKeyOf<T> & string]
type ColumnPathsAt3<T> = { [K in ColumnsKeyOf<T> & string]-?: T[K] extends AnyValueSource ? K : `${K}.${ColumnPathsAt4<T[K]>}` }[ColumnsKeyOf<T> & string]
type ColumnPathsAt4<T> = { [K in ColumnsKeyOf<T> & string]-?: T[K] extends AnyValueSource ? K : `${K}.${ColumnPathsAt5<T[K]>}` }[ColumnsKeyOf<T> & string]
type ColumnPathsAt5<T> = { [K in ColumnsKeyOf<T> & string]-?: T[K] extends AnyValueSource ? K : never }[ColumnsKeyOf<T> & string]

// How a column or a group is named: 'column', 'group', 'group.column'
export type ColumnNamesOf<T> = ColumnNamesAt1<T>
type ColumnNamesAt1<T> = ColumnsKeyOf<T> | { [K in ColumnsGroupKeyOf<T>]-?: K | `${K}.${ColumnNamesAt2<T[K]> & string}` }[ColumnsGroupKeyOf<T>]
type ColumnNamesAt2<T> = ColumnsKeyOf<T> | { [K in ColumnsGroupKeyOf<T>]-?: K | `${K}.${ColumnNamesAt3<T[K]> & string}` }[ColumnsGroupKeyOf<T>]
type ColumnNamesAt3<T> = ColumnsKeyOf<T> | { [K in ColumnsGroupKeyOf<T>]-?: K | `${K}.${ColumnNamesAt4<T[K]> & string}` }[ColumnsGroupKeyOf<T>]
type ColumnNamesAt4<T> = ColumnsKeyOf<T> | { [K in ColumnsGroupKeyOf<T>]-?: K | `${K}.${ColumnNamesAt5<T[K]> & string}` }[ColumnsGroupKeyOf<T>]
type ColumnNamesAt5<T> = ColumnsKeyOf<T> | { [K in ColumnsGroupKeyOf<T>]-?: K }[ColumnsGroupKeyOf<T>]

// The path of the columns of T that must receive a value in an insert
export type RequiredColumnPathsOf<T> = RequiredColumnPathsAt1<T>
type RequiredColumnPathsAt1<T> = { [K in RequiredColumnsForSetOf<T> & string]-?: T[K] extends AnyValueSource ? K : `${K}.${RequiredColumnPathsAt2<T[K]>}` }[RequiredColumnsForSetOf<T> & string]
type RequiredColumnPathsAt2<T> = { [K in RequiredColumnsForSetOf<T> & string]-?: T[K] extends AnyValueSource ? K : `${K}.${RequiredColumnPathsAt3<T[K]>}` }[RequiredColumnsForSetOf<T> & string]
type RequiredColumnPathsAt3<T> = { [K in RequiredColumnsForSetOf<T> & string]-?: T[K] extends AnyValueSource ? K : `${K}.${RequiredColumnPathsAt4<T[K]>}` }[RequiredColumnsForSetOf<T> & string]
type RequiredColumnPathsAt4<T> = { [K in RequiredColumnsForSetOf<T> & string]-?: T[K] extends AnyValueSource ? K : `${K}.${RequiredColumnPathsAt5<T[K]>}` }[RequiredColumnsForSetOf<T> & string]
type RequiredColumnPathsAt5<T> = { [K in RequiredColumnsForSetOf<T> & string]-?: T[K] extends AnyValueSource ? K : never }[RequiredColumnsForSetOf<T> & string]

// The values of a shape, at any level
export type ShapeValuesOf<SHAPE> = ShapeValuesAt1<SHAPE>
type ShapeValuesAt1<SHAPE> = { [K in keyof SHAPE]-?: SHAPE[K] extends string ? SHAPE[K] : SHAPE[K] extends AnyValueSource ? never : SHAPE[K] extends object ? ShapeValuesAt2<SHAPE[K]> : never }[keyof SHAPE]
type ShapeValuesAt2<SHAPE> = { [K in keyof SHAPE]-?: SHAPE[K] extends string ? SHAPE[K] : SHAPE[K] extends AnyValueSource ? never : SHAPE[K] extends object ? ShapeValuesAt3<SHAPE[K]> : never }[keyof SHAPE]
type ShapeValuesAt3<SHAPE> = { [K in keyof SHAPE]-?: SHAPE[K] extends string ? SHAPE[K] : SHAPE[K] extends AnyValueSource ? never : SHAPE[K] extends object ? ShapeValuesAt4<SHAPE[K]> : never }[keyof SHAPE]
type ShapeValuesAt4<SHAPE> = { [K in keyof SHAPE]-?: SHAPE[K] extends string ? SHAPE[K] : SHAPE[K] extends AnyValueSource ? never : SHAPE[K] extends object ? ShapeValuesAt5<SHAPE[K]> : never }[keyof SHAPE]
type ShapeValuesAt5<SHAPE> = { [K in keyof SHAPE]-?: SHAPE[K] extends string ? SHAPE[K] : SHAPE[K] extends AnyValueSource ? never : never }[keyof SHAPE]

// The column named by a path
type ColumnAtPath1<T, PATH extends string> = PATH extends keyof T ? T[PATH] : PATH extends `${infer GROUP}.${infer REST}` ? (GROUP extends keyof T ? ColumnAtPath2<T[GROUP], REST> : PATH) : PATH
type ColumnAtPath2<T, PATH extends string> = PATH extends keyof T ? T[PATH] : PATH extends `${infer GROUP}.${infer REST}` ? (GROUP extends keyof T ? ColumnAtPath3<T[GROUP], REST> : PATH) : PATH
type ColumnAtPath3<T, PATH extends string> = PATH extends keyof T ? T[PATH] : PATH extends `${infer GROUP}.${infer REST}` ? (GROUP extends keyof T ? ColumnAtPath4<T[GROUP], REST> : PATH) : PATH
type ColumnAtPath4<T, PATH extends string> = PATH extends keyof T ? T[PATH] : PATH extends `${infer GROUP}.${infer REST}` ? (GROUP extends keyof T ? ColumnAtPath5<T[GROUP], REST> : PATH) : PATH
type ColumnAtPath5<T, PATH extends string> = PATH extends keyof T ? T[PATH] : PATH

// The columns of a shape: what it names in the table
export type ResolveShapeContent<T, SHAPE> = ResolveShapeContentAt1<T, SHAPE>
type ResolveShapeContentAt1<T, SHAPE> = { [P in keyof SHAPE]: SHAPE[P] extends keyof T ? T[SHAPE[P]] : SHAPE[P] extends string ? ColumnAtPath1<T, SHAPE[P]> : SHAPE[P] extends AnyValueSource ? SHAPE[P] : SHAPE[P] extends object ? ResolveShapeContentAt2<T, SHAPE[P]> : SHAPE[P] }
type ResolveShapeContentAt2<T, SHAPE> = { [P in keyof SHAPE]: SHAPE[P] extends keyof T ? T[SHAPE[P]] : SHAPE[P] extends string ? ColumnAtPath1<T, SHAPE[P]> : SHAPE[P] extends AnyValueSource ? SHAPE[P] : SHAPE[P] extends object ? ResolveShapeContentAt3<T, SHAPE[P]> : SHAPE[P] }
type ResolveShapeContentAt3<T, SHAPE> = { [P in keyof SHAPE]: SHAPE[P] extends keyof T ? T[SHAPE[P]] : SHAPE[P] extends string ? ColumnAtPath1<T, SHAPE[P]> : SHAPE[P] extends AnyValueSource ? SHAPE[P] : SHAPE[P] extends object ? ResolveShapeContentAt4<T, SHAPE[P]> : SHAPE[P] }
type ResolveShapeContentAt4<T, SHAPE> = { [P in keyof SHAPE]: SHAPE[P] extends keyof T ? T[SHAPE[P]] : SHAPE[P] extends string ? ColumnAtPath1<T, SHAPE[P]> : SHAPE[P] extends AnyValueSource ? SHAPE[P] : SHAPE[P] extends object ? ResolveShapeContentAt5<T, SHAPE[P]> : SHAPE[P] }
type ResolveShapeContentAt5<T, SHAPE> = { [P in keyof SHAPE]: SHAPE[P] extends keyof T ? T[SHAPE[P]] : SHAPE[P] extends string ? ColumnAtPath1<T, SHAPE[P]> : SHAPE[P] extends AnyValueSource ? SHAPE[P] : SHAPE[P] }

// What a column receives when it's written
export type InputOfColumn<COLUMN, ALLOWING extends NSource> =
    COLUMN extends WritableDBColumnWithDefaultValue
    ? ValueSourceValueType<COLUMN> | RemapIValueSourceType<ALLOWING, COLUMN> | Default
    : ValueSourceValueType<COLUMN> | RemapIValueSourceType<ALLOWING, COLUMN>

export type InputOfOptionalColumn<COLUMN, ALLOWING extends NSource> =
    COLUMN extends WritableDBColumnWithDefaultValue
    ? ValueSourceValueType<COLUMN> | RemapIValueSourceTypeWithOptionalType<ALLOWING, COLUMN, any> | Default
    : ValueSourceValueType<COLUMN> | RemapIValueSourceTypeWithOptionalType<ALLOWING, COLUMN, any>

// In a group, what is required in the optional object is required when the group is provided, as it is when it's read
type RequiredInGroupOf<GROUP> = { [K in OptionalColumnsForSetOf<GROUP>]-?:
    GROUP[K] extends IValueSource<any, any, any, 'requiredInOptionalObject'> & WritableDBColumnWithoutDefaultValue ? K : never
}[OptionalColumnsForSetOf<GROUP>]

// A group in an insert: what is required in it must be there
export type InsertInputOfGroup<GROUP, ALLOWING extends NSource> = InsertInputOfGroupAt1<GROUP, ALLOWING>
type InsertInputOfGroupAt1<GROUP, ALLOWING extends NSource> = {
    [P in RequiredColumnsForSetOf<GROUP> | RequiredInGroupOf<GROUP>]: GROUP[P] extends AnyValueSource ? PartialInputOfColumn<GROUP[P], ALLOWING> : InsertInputOfGroupAt2<GROUP[P], ALLOWING>
} & {
    [P in Exclude<OptionalColumnsForSetOf<GROUP>, RequiredInGroupOf<GROUP>>]?: GROUP[P] extends AnyValueSource ? InputOfOptionalColumn<GROUP[P], ALLOWING> : InsertInputOfGroupAt2<GROUP[P], ALLOWING> | null | undefined
}
type InsertInputOfGroupAt2<GROUP, ALLOWING extends NSource> = {
    [P in RequiredColumnsForSetOf<GROUP> | RequiredInGroupOf<GROUP>]: GROUP[P] extends AnyValueSource ? PartialInputOfColumn<GROUP[P], ALLOWING> : InsertInputOfGroupAt3<GROUP[P], ALLOWING>
} & {
    [P in Exclude<OptionalColumnsForSetOf<GROUP>, RequiredInGroupOf<GROUP>>]?: GROUP[P] extends AnyValueSource ? InputOfOptionalColumn<GROUP[P], ALLOWING> : InsertInputOfGroupAt3<GROUP[P], ALLOWING> | null | undefined
}
type InsertInputOfGroupAt3<GROUP, ALLOWING extends NSource> = {
    [P in RequiredColumnsForSetOf<GROUP> | RequiredInGroupOf<GROUP>]: GROUP[P] extends AnyValueSource ? PartialInputOfColumn<GROUP[P], ALLOWING> : InsertInputOfGroupAt4<GROUP[P], ALLOWING>
} & {
    [P in Exclude<OptionalColumnsForSetOf<GROUP>, RequiredInGroupOf<GROUP>>]?: GROUP[P] extends AnyValueSource ? InputOfOptionalColumn<GROUP[P], ALLOWING> : InsertInputOfGroupAt4<GROUP[P], ALLOWING> | null | undefined
}
type InsertInputOfGroupAt4<GROUP, ALLOWING extends NSource> = {
    [P in RequiredColumnsForSetOf<GROUP> | RequiredInGroupOf<GROUP>]: GROUP[P] extends AnyValueSource ? PartialInputOfColumn<GROUP[P], ALLOWING> : never
} & {
    [P in Exclude<OptionalColumnsForSetOf<GROUP>, RequiredInGroupOf<GROUP>>]?: GROUP[P] extends AnyValueSource ? InputOfOptionalColumn<GROUP[P], ALLOWING> : never | null | undefined
}

// A group in an update or in the sets with if value: nothing is required in it. NO_VALUE is what its columns also accept
export type PartialInputOfGroup<GROUP, ALLOWING extends NSource, NO_VALUE> = PartialInputOfGroupAt1<GROUP, ALLOWING, NO_VALUE>
// The input of one member of a group: a required column doesn't accept null, as in the rest of the sets
type PartialInputOfColumn<COLUMN, ALLOWING extends NSource> =
    COLUMN extends IValueSource<any, any, any, 'required'> & WritableDBColumnWithoutDefaultValue
    ? InputOfColumn<COLUMN, ALLOWING>
    : InputOfOptionalColumn<COLUMN, ALLOWING>
type NoValueOfGroup<GROUP> = [HasRequiredColumn<GROUP>] extends [never] ? null | undefined : never

type PartialInputOfGroupAt1<GROUP, ALLOWING extends NSource, NO_VALUE> = {
    [P in ColumnsKeyOf<GROUP>]?: (GROUP[P] extends AnyValueSource ? PartialInputOfColumn<GROUP[P], ALLOWING> : PartialInputOfGroupAt2<GROUP[P], ALLOWING, NO_VALUE> | NoValueOfGroup<GROUP[P]>) | NO_VALUE
}
type PartialInputOfGroupAt2<GROUP, ALLOWING extends NSource, NO_VALUE> = {
    [P in ColumnsKeyOf<GROUP>]?: (GROUP[P] extends AnyValueSource ? PartialInputOfColumn<GROUP[P], ALLOWING> : PartialInputOfGroupAt3<GROUP[P], ALLOWING, NO_VALUE> | NoValueOfGroup<GROUP[P]>) | NO_VALUE
}
type PartialInputOfGroupAt3<GROUP, ALLOWING extends NSource, NO_VALUE> = {
    [P in ColumnsKeyOf<GROUP>]?: (GROUP[P] extends AnyValueSource ? PartialInputOfColumn<GROUP[P], ALLOWING> : PartialInputOfGroupAt4<GROUP[P], ALLOWING, NO_VALUE> | NoValueOfGroup<GROUP[P]>) | NO_VALUE
}
type PartialInputOfGroupAt4<GROUP, ALLOWING extends NSource, NO_VALUE> = {
    [P in ColumnsKeyOf<GROUP>]?: (GROUP[P] extends AnyValueSource ? PartialInputOfColumn<GROUP[P], ALLOWING> : never) | NO_VALUE
}

// The plain values of a group
export type InsertValuesOfGroup<GROUP> = InsertValuesOfGroupAt1<GROUP>
type InsertValuesOfGroupAt1<GROUP> = {
    [P in RequiredColumnsForSetOf<GROUP>]: GROUP[P] extends AnyValueSource ? ValueSourceValueType<GROUP[P]> : InsertValuesOfGroupAt2<GROUP[P]>
} & {
    [P in OptionalColumnsForSetOf<GROUP>]?: GROUP[P] extends AnyValueSource ? ValueSourceValueType<GROUP[P]> : InsertValuesOfGroupAt2<GROUP[P]>
}
type InsertValuesOfGroupAt2<GROUP> = {
    [P in RequiredColumnsForSetOf<GROUP>]: GROUP[P] extends AnyValueSource ? ValueSourceValueType<GROUP[P]> : InsertValuesOfGroupAt3<GROUP[P]>
} & {
    [P in OptionalColumnsForSetOf<GROUP>]?: GROUP[P] extends AnyValueSource ? ValueSourceValueType<GROUP[P]> : InsertValuesOfGroupAt3<GROUP[P]>
}
type InsertValuesOfGroupAt3<GROUP> = {
    [P in RequiredColumnsForSetOf<GROUP>]: GROUP[P] extends AnyValueSource ? ValueSourceValueType<GROUP[P]> : InsertValuesOfGroupAt4<GROUP[P]>
} & {
    [P in OptionalColumnsForSetOf<GROUP>]?: GROUP[P] extends AnyValueSource ? ValueSourceValueType<GROUP[P]> : InsertValuesOfGroupAt4<GROUP[P]>
}
type InsertValuesOfGroupAt4<GROUP> = {
    [P in RequiredColumnsForSetOf<GROUP>]: GROUP[P] extends AnyValueSource ? ValueSourceValueType<GROUP[P]> : never
} & {
    [P in OptionalColumnsForSetOf<GROUP>]?: GROUP[P] extends AnyValueSource ? ValueSourceValueType<GROUP[P]> : never
}

export type UpdateValuesOfGroup<GROUP> = UpdateValuesOfGroupAt1<GROUP>
type UpdateValuesOfGroupAt1<GROUP> = {
    [P in ColumnsKeyOf<GROUP>]?: GROUP[P] extends AnyValueSource ? ValueSourceValueType<GROUP[P]> : UpdateValuesOfGroupAt2<GROUP[P]>
}
type UpdateValuesOfGroupAt2<GROUP> = {
    [P in ColumnsKeyOf<GROUP>]?: GROUP[P] extends AnyValueSource ? ValueSourceValueType<GROUP[P]> : UpdateValuesOfGroupAt3<GROUP[P]>
}
type UpdateValuesOfGroupAt3<GROUP> = {
    [P in ColumnsKeyOf<GROUP>]?: GROUP[P] extends AnyValueSource ? ValueSourceValueType<GROUP[P]> : UpdateValuesOfGroupAt4<GROUP[P]>
}
type UpdateValuesOfGroupAt4<GROUP> = {
    [P in ColumnsKeyOf<GROUP>]?: GROUP[P] extends AnyValueSource ? ValueSourceValueType<GROUP[P]> : never
}

// The columns of a select that is inserted
export type SelectForInsertOfGroup<GROUP> = SelectForInsertOfGroupAt1<GROUP>
type SelectForInsertOfGroupAt1<GROUP> = {
    [P in RequiredColumnsForSetOf<GROUP>]: GROUP[P] extends AnyValueSource ? RemapIValueSourceType<any, GROUP[P]> : SelectForInsertOfGroupAt2<GROUP[P]>
} & {
    [P in OptionalColumnsForSetOf<GROUP>]?: GROUP[P] extends AnyValueSource ? RemapIValueSourceTypeWithOptionalType<any, GROUP[P], any> : SelectForInsertOfGroupAt2<GROUP[P]>
}
type SelectForInsertOfGroupAt2<GROUP> = {
    [P in RequiredColumnsForSetOf<GROUP>]: GROUP[P] extends AnyValueSource ? RemapIValueSourceType<any, GROUP[P]> : SelectForInsertOfGroupAt3<GROUP[P]>
} & {
    [P in OptionalColumnsForSetOf<GROUP>]?: GROUP[P] extends AnyValueSource ? RemapIValueSourceTypeWithOptionalType<any, GROUP[P], any> : SelectForInsertOfGroupAt3<GROUP[P]>
}
type SelectForInsertOfGroupAt3<GROUP> = {
    [P in RequiredColumnsForSetOf<GROUP>]: GROUP[P] extends AnyValueSource ? RemapIValueSourceType<any, GROUP[P]> : SelectForInsertOfGroupAt4<GROUP[P]>
} & {
    [P in OptionalColumnsForSetOf<GROUP>]?: GROUP[P] extends AnyValueSource ? RemapIValueSourceTypeWithOptionalType<any, GROUP[P], any> : SelectForInsertOfGroupAt4<GROUP[P]>
}
type SelectForInsertOfGroupAt4<GROUP> = {
    [P in RequiredColumnsForSetOf<GROUP>]: GROUP[P] extends AnyValueSource ? RemapIValueSourceType<any, GROUP[P]> : never
} & {
    [P in OptionalColumnsForSetOf<GROUP>]?: GROUP[P] extends AnyValueSource ? RemapIValueSourceTypeWithOptionalType<any, GROUP[P], any> : never
}

// The shape to accept, with its groups
export type ShapeOfColumns<VALUE> = { [key: string]: VALUE | ShapeOfColumns2<VALUE> }
type ShapeOfColumns2<VALUE> = { [key: string]: VALUE | ShapeOfColumns3<VALUE> }
type ShapeOfColumns3<VALUE> = { [key: string]: VALUE | ShapeOfColumns4<VALUE> }
type ShapeOfColumns4<VALUE> = { [key: string]: VALUE | ShapeOfColumns5<VALUE> }
type ShapeOfColumns5<VALUE> = { [key: string]: VALUE }
