import type { ColumnNamesOf, ColumnsGroupKeyOf, ColumnsKeyOf, OptionalColumnsForSetOf, RequiredColumnsForSetOf, RequiredColumnPathsOf, ResolveShapeContent, ShapeValuesOf } from '../complexProjections/columnGroups.js'
import type { ITable, ITableOrView, IView, IWithView, IValues, ResolvedShape, OldValues, ValuesForInsert, ForUseInLeftJoin, HasSource, ITableOrViewAlias } from './ITableOrView.js'
import type { AnyValueSource, RemapValueSourceType, ValueSourceValueType } from '../expressions/values.js'
import type { source } from './symbols.js'
import type { WritableDBPrimaryKeyColumnWithDefaultValue } from './Column.js'
import type { NAlias, NAsLeftJoin, NCustomizeAs, NGetDBFrom, NGetNameFrom, NOldValues, NSource, NValuesForInsert } from './sourceName.js'
import type { ColumnsForAlias } from '../complexProjections/tableAlias.js'
import type { ColumnsForLeftJoin } from '../complexProjections/asLeftJoin.js'

export type { ColumnPathsOf, ColumnsGroupKeyOf, ColumnsKeyOf, IsColumnsGroupCandidate, OptionalColumnsForSetOf, RequiredColumnsForSetOf } from '../complexProjections/columnGroups.js'

// The required keys left without value when these names are ignored: its group, when it's a required column in a group
export type RequiredKeysOfNames<T, NAMES> =
    (NAMES extends `${infer GROUP}.${string}` ? (NAMES extends RequiredColumnPathsOf<T> ? GROUP : never) : NAMES) & RequiredColumnsForSetOf<T>


// The required keys of the table with a value in the shape; a group is covered when all its required columns are
export type RequiredKeysCoveredByShape<TABLE, SHAPE> = ShapeValuesOf<SHAPE> | { [K in RequiredColumnsForSetOf<TABLE> & ColumnsGroupKeyOf<TABLE>]-?:
    [Exclude<`${K}.${RequiredColumnPathsOf<TABLE[K]>}`, ShapeValuesOf<SHAPE>>] extends [never] ? K : never
}[RequiredColumnsForSetOf<TABLE> & ColumnsGroupKeyOf<TABLE>]
type ValueSourcesKeyOf<T> = ({ [K in keyof T]-?: T[K] extends AnyValueSource ? K : never })[keyof T]

export type AsOldValues<T extends ITableOrView<any>> = ColumnsForAlias<NOldValues<NGetDBFrom<T[typeof source]>, NGetNameFrom<T[typeof source]>>, T> & OldValues<NOldValues<NGetDBFrom<T[typeof source]>, NGetNameFrom<T[typeof source]>>>
export type AsValuesForInsert<T extends ITableOrView<any>> = ColumnsForAlias<NValuesForInsert<NGetDBFrom<T[typeof source]>, NGetNameFrom<T[typeof source]>>, T> & ValuesForInsert<NValuesForInsert<NGetDBFrom<T[typeof source]>, NGetNameFrom<T[typeof source]>>>
export type AliasedTableOrView<T extends ITableOrView<any>, ALIAS extends string> = ColumnsForAlias<NAlias<T[typeof source], ALIAS>, T> & ITableOrViewAlias< NAlias<T[typeof source], ALIAS>>

export type AsForUseInLeftJoin<T extends ITableOrView<any>> = ColumnsForLeftJoin<NAsLeftJoin<T[typeof source]>, T> & ForUseInLeftJoin<NAsLeftJoin<T[typeof source]>>
export type AsAliasedForUseInLeftJoin<T extends ITableOrView<any>, ALIAS extends string> = ColumnsForLeftJoin<NAlias<NAsLeftJoin<T[typeof source]>, ALIAS>, T> & ForUseInLeftJoin<NAlias<NAsLeftJoin<T[typeof source]>, ALIAS>>

// `fromRef` infers the source as its own string type-param `S` at the call site
// (value-level inference resolves it through the ref's constraint), instead of
// reading `REF[source]` — a lazy indexed access on a generic ref that downstream
// db extraction (`NGetDBFrom` over a generic type variable) can't resolve. That
// indexed access is what made the documented "table/view as a parameter" helper
// fail to typecheck; see docs/advanced/tables-views-as-parameter.md.
export type FromRefBySource<T extends ITableOrView<any>, S extends NSource> = { [K in ValueSourcesKeyOf<T>]: RemapValueSourceType<S, T[K]> } & ColumnsForAlias<S, Pick<T, ColumnsGroupKeyOf<T>>> & ITableOrView<S>
export type FromRefBySourceLeftJoin<T extends ITableOrView<any>, S extends NSource> = ColumnsForLeftJoin<S, Pick<T, ValueSourcesKeyOf<T> | ColumnsGroupKeyOf<T>>> & ForUseInLeftJoin<S>

type AddAliasMethods<T extends ITableOrView<any>> = T & {
    as<ALIAS extends string>(as: ALIAS): AliasedTableOrView<T, ALIAS>
    forUseInLeftJoin(): AsForUseInLeftJoin<T>
    forUseInLeftJoinAs<ALIAS extends string>(as: ALIAS): AsAliasedForUseInLeftJoin<T, ALIAS>
}

// COLUMNS already remapped using ColumnsForWithView before call WithView in order to make the type readable
export type WithView<SOURCE extends NSource, COLUMNS> = AddAliasMethods<COLUMNS & IWithView<SOURCE>>

type CustomizedTableOrViewType<T extends ITableOrView<any>, SOURCE extends NSource> = 
    T extends ITableOrViewAlias<any> ? ITableOrViewAlias<SOURCE>
    : T extends ITable<any> ? ITable<SOURCE>
    : T extends IView<any> ? IView<SOURCE>
    : T extends IWithView<any> ? IWithView<SOURCE>
    : T extends IValues<any> ? IValues<SOURCE>
    : never

type CustomizedTableOrViewNoAliasable<T extends ITableOrView<any>, SOURCE extends string> = ColumnsForAlias<SOURCE, T> & CustomizedTableOrViewType<T, SOURCE>

export type CustomizedTableOrView<T extends ITableOrView<any>, CUSTOMIZATION_NAME extends string> =
    (T extends {as(as: any): any}
    ? AddAliasMethods<CustomizedTableOrViewNoAliasable<T, NCustomizeAs<T[typeof source], CUSTOMIZATION_NAME>>>
    : CustomizedTableOrViewNoAliasable<T, NCustomizeAs<T[typeof source], CUSTOMIZATION_NAME>>
    ) & { /* added to avoid typescript expansion type, generating better error messages */ }

export type AutogeneratedPrimaryKeyColumnsTypesOf<T> = AutogeneratedPrimaryKeyOf<T> | { [K in ColumnsGroupKeyOf<T>]-?: AutogeneratedPrimaryKeyOf<T[K]> | { [K2 in ColumnsGroupKeyOf<T[K]>]-?: AutogeneratedPrimaryKeyOf<T[K][K2]> }[ColumnsGroupKeyOf<T[K]>] }[ColumnsGroupKeyOf<T>]
type AutogeneratedPrimaryKeyOf<T> = { [K in ColumnsKeyOf<T>]-?: T[K] extends WritableDBPrimaryKeyColumnWithDefaultValue ? ValueSourceValueType<T[K]> : never }[ColumnsKeyOf<T>]

export type ColumnsForSetOfWithShape<TABLE, SHAPE> = 
    SHAPE extends ResolvedShape<any>
    ? ColumnsForSetOf<SHAPE>
    : ColumnsForSetOf<TABLE>

export type ColumnsForSetOf<TYPE> = ColumnNamesOf<TYPE>

export type RequiredColumnsForSetOfWithShape<TABLE, SHAPE> = 
    SHAPE extends ResolvedShape<any>
    ? RequiredColumnsForSetOf<SHAPE>
    : RequiredColumnsForSetOf<TABLE>


export type OptionalColumnsForSetOfWithShape<TABLE, SHAPE> = 
    SHAPE extends ResolvedShape<any>
    ? OptionalColumnsForSetOf<SHAPE>
    : OptionalColumnsForSetOf<TABLE>


export type ResolveShape<T extends HasSource<any>, SHAPE extends {}> = ResolveShapeContent<T, SHAPE> & ResolvedShape<T[typeof source]>
