import type { ITable, ITableOrView, IView, IWithView, IValues, ResolvedShape, OldValues, ValuesForInsert, ForUseInLeftJoin, HasSource, ITableOrViewAlias } from "./ITableOrView"
import type { AnyValueSource, IValueSource, RemapValueSourceType, RemapValueSourceTypeWithOptionalType, ValueSourceValueType } from "../expressions/values"
import type { source } from "./symbols"
import type { WritableDBColumn, WritableDBColumnWithDefaultValue, WritableDBColumnWithoutDefaultValue, WritableDBPrimaryKeyColumnWithDefaultValue } from "./Column"
import type { NAlias, NAsLeftJoin, NCustomizeAs, NGetDBFrom, NGetNameFrom, NOldValues, NSource, NValuesForInsert } from "./sourceName"

export type ColumnsKeyOf<T> = ({ [K in keyof T]-?: T[K] extends WritableDBColumn ? K : never })[keyof T]
type ValueSourcesKeyOf<T> = ({ [K in keyof T]-?: T[K] extends AnyValueSource ? K : never })[keyof T]
type RemapValueSourceTypeInWithColumnInfo<T extends ITableOrView<any>, SOURCE extends NSource> = { [K in ValueSourcesKeyOf<T>]: RemapValueSourceType<SOURCE, T[K]> }
type RemapValueSourceTypeIn<T extends ITableOrView<any>, SOURCE extends NSource> = { [K in ValueSourcesKeyOf<T>]: RemapValueSourceType<SOURCE, T[K]> }

// old values preserve the column info (only tables have them)
export type AsOldValues<T extends ITableOrView<any>> = RemapValueSourceTypeInWithColumnInfo<T, NOldValues<NGetDBFrom<T[typeof source]>, NGetNameFrom<T[typeof source]>>> & OldValues<NOldValues<NGetDBFrom<T[typeof source]>, NGetNameFrom<T[typeof source]>>>
// values for insert preserve the column info (only tables have them)
export type AsValuesForInsert<T extends ITableOrView<any>> = RemapValueSourceTypeInWithColumnInfo<T, NValuesForInsert<NGetDBFrom<T[typeof source]>, NGetNameFrom<T[typeof source]>>> & ValuesForInsert<NValuesForInsert<NGetDBFrom<T[typeof source]>, NGetNameFrom<T[typeof source]>>>
// alias doesn't preserve the column info (only tables have them)
export type AliasedTableOrView<T extends ITableOrView<any>, ALIAS extends string> = RemapValueSourceTypeIn<T, NAlias<T[typeof source], ALIAS>> & ITableOrViewAlias< NAlias<T[typeof source], ALIAS>>

// left join doesn't preserve the column info
export type AsForUseInLeftJoin<T extends ITableOrView<any>> = RemapValueSourceTypeInForLeftJoin<T, NAsLeftJoin<T[typeof source]>> & ForUseInLeftJoin<NAsLeftJoin<T[typeof source]>>
export type AsAliasedForUseInLeftJoin<T extends ITableOrView<any>, ALIAS extends string> = RemapValueSourceTypeInForLeftJoin<T, NAlias<NAsLeftJoin<T[typeof source]>, ALIAS>> & ForUseInLeftJoin<NAlias<NAsLeftJoin<T[typeof source]>, ALIAS>>
type RemapValueSourceTypeInForLeftJoin<T extends ITableOrView<any>, SOURCE extends NSource> = { [K in ValueSourcesKeyOf<T>]: RemapValueSourceTypeWithOptionalType<SOURCE, T[K], OptionalTypeForLeftJoin<T[K]>> }
type OptionalTypeForLeftJoin<TYPE> = 
    TYPE extends IValueSource<any, any, any, infer OPTIONAL_TYPE> ? (
        'required' extends OPTIONAL_TYPE
        ? 'originallyRequired'
        : OPTIONAL_TYPE
    ) : never

export type FromRef<T extends ITableOrView<any>, REF extends HasSource<any>> = { [K in ValueSourcesKeyOf<T>]: RemapValueSourceType<REF[typeof source], T[K]> } & REF

/*
 * This solution don't expose the inner objects in a with because typescript get frozen (see commented implementation in resultUsitls)
 */
type WithViewColumns<SOURCE extends NSource, COLUMNS> = { [K in ValueSourcesKeyOf<COLUMNS>]: RemapValueSourceTypeWithOptionalType<SOURCE, COLUMNS[K], WithOptionalTypeOf<COLUMNS[K]>>}

type WithOptionalTypeOf<TYPE> = 
    TYPE extends IValueSource<any, any, any, infer OPTIONAL_TYPE> ? (
        'required' extends OPTIONAL_TYPE
        ? 'required'
        : 'optional'
    ) : never

type AddAliasMethods<T extends ITableOrView<any>> = T & {
    as<ALIAS extends string>(as: ALIAS): AliasedTableOrView<T, ALIAS>
    forUseInLeftJoin(): AsForUseInLeftJoin<T>
    forUseInLeftJoinAs<ALIAS extends string>(as: ALIAS): AsAliasedForUseInLeftJoin<T, ALIAS>
}

export type WithView<SOURCE extends NSource, COLUMNS> = AddAliasMethods<WithViewColumns<SOURCE, COLUMNS> & IWithView<SOURCE>>

type CustomizedTableOrViewType<T extends ITableOrView<any>, SOURCE extends NSource> = 
    T extends ITableOrViewAlias<any> ? ITableOrViewAlias<SOURCE>
    : T extends ITable<any> ? ITable<SOURCE>
    : T extends IView<any> ? IView<SOURCE>
    : T extends IWithView<any> ? IWithView<SOURCE>
    : T extends IValues<any> ? IValues<SOURCE>
    : never

type CustomizedTableOrViewNoAliasable<T extends ITableOrView<any>, SOURCE extends string> = { [K in ValueSourcesKeyOf<T>]: RemapValueSourceType<SOURCE, T[K]> } & CustomizedTableOrViewType<T, SOURCE>

export type CustomizedTableOrView<T extends ITableOrView<any>, CUSTOMIZATION_NAME extends string> =
    (T extends {as(as: any): any}
    ? AddAliasMethods<CustomizedTableOrViewNoAliasable<T, NCustomizeAs<T[typeof source], CUSTOMIZATION_NAME>>>
    : CustomizedTableOrViewNoAliasable<T, NCustomizeAs<T[typeof source], CUSTOMIZATION_NAME>>
    ) & { /* added to avoid typescript expansion type, generating better error messages */ }

export type AutogeneratedPrimaryKeyColumnsTypesOf<T> = { [K in ColumnsKeyOf<T>]-?: 
    T[K] extends WritableDBPrimaryKeyColumnWithDefaultValue ? ValueSourceValueType<T[K]> : never
}[ColumnsKeyOf<T>]

export type ColumnsForSetOfWithShape<TABLE, SHAPE> = 
    SHAPE extends ResolvedShape<any>
    ? ColumnsForSetOf<SHAPE>
    : ColumnsForSetOf<TABLE>

export type ColumnsForSetOf<TYPE> = ColumnsKeyOf<TYPE>

export type RequiredColumnsForSetOfWithShape<TABLE, SHAPE> = 
    SHAPE extends ResolvedShape<any>
    ? RequiredColumnsForSetOf<SHAPE>
    : RequiredColumnsForSetOf<TABLE>

export type RequiredColumnsForSetOf<T> = { [K in ColumnsKeyOf<T>]-?: 
    T[K] extends IValueSource<any, any, any, 'required'> & WritableDBColumnWithoutDefaultValue ? K : never
}[ColumnsKeyOf<T>]

export type OptionalColumnsForSetOfWithShape<TABLE, SHAPE> = 
    SHAPE extends ResolvedShape<any>
    ? OptionalColumnsForSetOf<SHAPE>
    : OptionalColumnsForSetOf<TABLE>

export type OptionalColumnsForSetOf<T> = { [K in ColumnsKeyOf<T>]-?: 
    T[K] extends WritableDBColumnWithDefaultValue ? K
    : T[K] extends IValueSource<any, any, any, infer OPTIONAL_TYPE> & WritableDBColumn
    ? (
        OPTIONAL_TYPE extends 'required'
        ? never
        : K
    ) : never 
}[ColumnsKeyOf<T>]

export type ResolveShape<T extends HasSource<any>, SHAPE extends {}> = {
    [P in keyof SHAPE]: SHAPE[P] extends keyof T ? T[SHAPE[P]] : SHAPE[P]
} &  ResolvedShape<T[typeof source]>
