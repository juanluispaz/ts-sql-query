import type { ITableOrView, OuterJoinSource, TableOrViewAlias, TableOrViewAliasRef } from "./ITableOrView"
import type { ValueSource, RemapValueSourceType, RemapValueSourceTypeAsOptional } from "../expressions/values"
import { tableOrViewRef } from "./symbols"

export type ColumnsOfTableOrView<TABLE_OR_VIEW extends ITableOrView<any>> = ({ [K in keyof TABLE_OR_VIEW]-?: TABLE_OR_VIEW[K] extends ValueSource<any, any> ? K : never })[keyof TABLE_OR_VIEW]

export type AliasedTableOrView<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS> = { [K in ColumnsOfTableOrView<TABLE_OR_VIEW>]: RemapValueSourceType<TableOrViewAliasRef<TABLE_OR_VIEW[typeof tableOrViewRef], ALIAS>, TABLE_OR_VIEW[K]> } & TableOrViewAlias<TABLE_OR_VIEW, ALIAS>

export type OuterTableOrViewInternal<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS> = { [K in ColumnsOfTableOrView<TABLE_OR_VIEW>]: OuterTableOrViewInternal<any, TABLE_OR_VIEW[K]> } & TableOrViewAlias<TABLE_OR_VIEW, ALIAS>
export type OuterJoinSourceOf<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS> = { [K in ColumnsOfTableOrView<TABLE_OR_VIEW>]: RemapValueSourceTypeAsOptional<TableOrViewAliasRef<TABLE_OR_VIEW[typeof tableOrViewRef], ALIAS>, TABLE_OR_VIEW[K]> } & OuterJoinSource<TABLE_OR_VIEW, ALIAS>
export type OuterJoinTableOrView<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS> = { [K in ColumnsOfTableOrView<TABLE_OR_VIEW>]: RemapValueSourceTypeAsOptional<TableOrViewAliasRef<TABLE_OR_VIEW[typeof tableOrViewRef], ALIAS>, TABLE_OR_VIEW[K]> } & TableOrViewAlias<TABLE_OR_VIEW, ALIAS>