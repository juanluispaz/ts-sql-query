import type { CUSTOMIZED_TABLE_OR_VIEW, ITable, ITableOrView, IView, IWithView, OuterJoinSource, TableOrViewAlias, TABLE_OR_VIEW_ALIAS, TableOrViewRef } from "./ITableOrView"
import type { ValueSource, RemapValueSourceType, RemapValueSourceTypeAsOptional } from "../expressions/values"
import type { tableOrViewRef, type, viewName } from "./symbols"
import type { AnyDB } from "../databases"

export type ColumnsOfTableOrView<TABLE_OR_VIEW> = ({ [K in keyof TABLE_OR_VIEW]-?: TABLE_OR_VIEW[K] extends ValueSource<any, any> ? K : never })[keyof TABLE_OR_VIEW]

export type AliasedTableOrView<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS> = { [K in ColumnsOfTableOrView<TABLE_OR_VIEW>]: RemapValueSourceType<TABLE_OR_VIEW_ALIAS<TABLE_OR_VIEW[typeof tableOrViewRef], ALIAS>, TABLE_OR_VIEW[K]> } & TableOrViewAlias<TABLE_OR_VIEW, ALIAS>
export type WithViewColumns<TABLE_OR_VIEW extends ITableOrView<any>, COLUMNS> = { [K in ColumnsOfTableOrView<COLUMNS>]: RemapValueSourceType<TABLE_OR_VIEW[typeof tableOrViewRef], COLUMNS[K]> } & TABLE_OR_VIEW

export type OuterTableOrViewInternal<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS> = { [K in ColumnsOfTableOrView<TABLE_OR_VIEW>]: OuterTableOrViewInternal<any, TABLE_OR_VIEW[K]> } & TableOrViewAlias<TABLE_OR_VIEW, ALIAS>
export type OuterJoinSourceOf<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS> = { [K in ColumnsOfTableOrView<TABLE_OR_VIEW>]: RemapValueSourceTypeAsOptional<TABLE_OR_VIEW_ALIAS<TABLE_OR_VIEW[typeof tableOrViewRef], ALIAS>, TABLE_OR_VIEW[K]> } & OuterJoinSource<TABLE_OR_VIEW, ALIAS>
export type OuterJoinTableOrView<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS> = { [K in ColumnsOfTableOrView<TABLE_OR_VIEW>]: RemapValueSourceTypeAsOptional<TABLE_OR_VIEW_ALIAS<TABLE_OR_VIEW[typeof tableOrViewRef], ALIAS>, TABLE_OR_VIEW[K]> } & TableOrViewAlias<TABLE_OR_VIEW, ALIAS>

export interface WITH_VIEW<DB extends AnyDB, NAME extends string> extends TableOrViewRef<DB> {
    [viewName]: NAME
    [type]: 'with'
}

export type AddAliasMethods<T extends ITableOrView<any>> = T & {
    as<ALIAS extends string>(as: ALIAS): AliasedTableOrView<T, ALIAS>
    forUseInLeftJoin(): OuterJoinSourceOf<T, ''>
    forUseInLeftJoinAs<ALIAS extends string>(as: ALIAS): OuterJoinSourceOf<T, ALIAS>
}

export type WithView<REF extends WITH_VIEW<AnyDB, any>, COLUMNS> = AddAliasMethods<WithViewColumns<IWithView<REF>, COLUMNS>>

export type CustomizedTableOrViewType<TABLE_OR_VIEW extends ITableOrView<any>, REF extends TableOrViewRef<AnyDB>> = 
    TABLE_OR_VIEW extends TableOrViewAlias<infer T, infer ALIAS> ? (
        T extends ITable<any> ? TableOrViewAlias<ITable<REF>, ALIAS>
        : T extends IView<any> ? TableOrViewAlias<IView<REF>, ALIAS>
        : T extends IWithView<any> ? TableOrViewAlias<IWithView<REF>, ALIAS>
        : never
    )
    : TABLE_OR_VIEW extends ITable<any> ? ITable<REF>
    : TABLE_OR_VIEW extends IView<any> ? IView<REF>
    : TABLE_OR_VIEW extends IWithView<any> ? IWithView<REF>
    : never

export type CustomizedTableOrViewRefFor<TABLE_OR_VIEW extends ITableOrView<any>, NAME> =
    TABLE_OR_VIEW[typeof tableOrViewRef] extends TABLE_OR_VIEW_ALIAS<infer R, infer ALIAS> ? TABLE_OR_VIEW_ALIAS<CUSTOMIZED_TABLE_OR_VIEW<R, NAME>, ALIAS>
    : CUSTOMIZED_TABLE_OR_VIEW<TABLE_OR_VIEW[typeof tableOrViewRef], NAME>

export type CustomizedTableOrViewRefForWitNoAlias<TABLE_OR_VIEW extends ITableOrView<any>, NAME> =
    TABLE_OR_VIEW[typeof tableOrViewRef] extends TABLE_OR_VIEW_ALIAS<infer R, any> ? CUSTOMIZED_TABLE_OR_VIEW<R, NAME>
    : CUSTOMIZED_TABLE_OR_VIEW<TABLE_OR_VIEW[typeof tableOrViewRef], NAME>

export type CustomizedTableOrViewNoAliasable<TABLE_OR_VIEW extends ITableOrView<any>, NAME> = { [K in ColumnsOfTableOrView<TABLE_OR_VIEW>]: RemapValueSourceType<CustomizedTableOrViewRefFor<TABLE_OR_VIEW, NAME>, TABLE_OR_VIEW[K]> } & CustomizedTableOrViewType<TABLE_OR_VIEW, CustomizedTableOrViewRefForWitNoAlias<TABLE_OR_VIEW, NAME>>

export type CustomizedTableOrView<T extends ITableOrView<any>, NAME extends string> =
    (T extends {as(as: any): any}
    ? AddAliasMethods<CustomizedTableOrViewNoAliasable<T, NAME>>
    : CustomizedTableOrViewNoAliasable<T, NAME>
    ) & { /* added to avoid typescript expansion type, generating better error messages */ }
