import type { ITableOrView, IWithView, OuterJoinSource, TableOrViewAlias, TableOrViewAliasRef, TableOrViewRef } from "./ITableOrView"
import type { ValueSource, RemapValueSourceType, RemapValueSourceTypeAsOptional } from "../expressions/values"
import type { tableOrViewRef, type, viewName } from "./symbols"
import type { AnyDB } from "../databases"

export type ColumnsOfTableOrView<TABLE_OR_VIEW> = ({ [K in keyof TABLE_OR_VIEW]-?: TABLE_OR_VIEW[K] extends ValueSource<any, any> ? K : never })[keyof TABLE_OR_VIEW]

export type AliasedTableOrView<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS> = { [K in ColumnsOfTableOrView<TABLE_OR_VIEW>]: RemapValueSourceType<TableOrViewAliasRef<TABLE_OR_VIEW[typeof tableOrViewRef], ALIAS>, TABLE_OR_VIEW[K]> } & TableOrViewAlias<TABLE_OR_VIEW, ALIAS>
export type WithViewColumns<TABLE_OR_VIEW extends ITableOrView<any>, COLUMNS> = { [K in ColumnsOfTableOrView<COLUMNS>]: RemapValueSourceType<TABLE_OR_VIEW[typeof tableOrViewRef], COLUMNS[K]> } & TABLE_OR_VIEW

export type OuterTableOrViewInternal<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS> = { [K in ColumnsOfTableOrView<TABLE_OR_VIEW>]: OuterTableOrViewInternal<any, TABLE_OR_VIEW[K]> } & TableOrViewAlias<TABLE_OR_VIEW, ALIAS>
export type OuterJoinSourceOf<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS> = { [K in ColumnsOfTableOrView<TABLE_OR_VIEW>]: RemapValueSourceTypeAsOptional<TableOrViewAliasRef<TABLE_OR_VIEW[typeof tableOrViewRef], ALIAS>, TABLE_OR_VIEW[K]> } & OuterJoinSource<TABLE_OR_VIEW, ALIAS>
export type OuterJoinTableOrView<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS> = { [K in ColumnsOfTableOrView<TABLE_OR_VIEW>]: RemapValueSourceTypeAsOptional<TableOrViewAliasRef<TABLE_OR_VIEW[typeof tableOrViewRef], ALIAS>, TABLE_OR_VIEW[K]> } & TableOrViewAlias<TABLE_OR_VIEW, ALIAS>

export interface WITH_VIEW<DB extends AnyDB, NAME extends string> extends TableOrViewRef<DB> {
    [viewName]: NAME
    [type]: 'with'
}

export type AddWitViewMethods<T extends ITableOrView<any>> = T & {
    as<ALIAS extends string>(as: ALIAS): AliasedTableOrView<T, ALIAS>
    forUseInLeftJoin(): OuterJoinSourceOf<T, ''>
    forUseInLeftJoinAs<ALIAS extends string>(as: ALIAS): OuterJoinSourceOf<T, ALIAS>
}

export type WithView<REF extends WITH_VIEW<AnyDB, any>, COLUMNS> = AddWitViewMethods<WithViewColumns<IWithView<REF>, COLUMNS>>
