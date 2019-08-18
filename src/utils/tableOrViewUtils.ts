import { AnyDB } from "../databases/AnyDB"
import { ITableOrView } from "./ITableOrView"
import { TableOrViewAlias } from "./TableAlias"
import { OuterJoinSource } from "./OuterJoinSource"
import { ValueSource, RemapValueSourceType, RemapValueSourceTypeAsOptional } from "../expressions/values"

export type ColumnsOfTableOrView<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>> = ({ [K in keyof TABLE_OR_VIEW]-?: TABLE_OR_VIEW[K] extends ValueSource<DB, any, any> ? K : never })[keyof TABLE_OR_VIEW]

export type AliasedTableOrViewInternal<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, ALIAS> = { [K in ColumnsOfTableOrView<DB, TABLE_OR_VIEW>]: RemapValueSourceType<DB, any, TABLE_OR_VIEW[K]> } & TableOrViewAlias<DB, TABLE_OR_VIEW, ALIAS>
export type AliasedTableOrView<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, ALIAS> = { [K in ColumnsOfTableOrView<DB, TABLE_OR_VIEW>]: RemapValueSourceType<DB, AliasedTableOrViewInternal<DB, TABLE_OR_VIEW, ALIAS>, TABLE_OR_VIEW[K]> } & TableOrViewAlias<DB, TABLE_OR_VIEW, ALIAS>

export type OuterTableOrViewInternal<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, ALIAS> = { [K in ColumnsOfTableOrView<DB, TABLE_OR_VIEW>]: OuterTableOrViewInternal<DB, any, TABLE_OR_VIEW[K]> } & TableOrViewAlias<DB, TABLE_OR_VIEW, ALIAS>
export type OuterJoinSourceOf<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, ALIAS> = { [K in ColumnsOfTableOrView<DB, TABLE_OR_VIEW>]: RemapValueSourceTypeAsOptional<DB, AliasedTableOrViewInternal<DB, TABLE_OR_VIEW, ALIAS>, TABLE_OR_VIEW[K]> } & OuterJoinSource<DB, TABLE_OR_VIEW, ALIAS>
export type OuterJoinTableOrView<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, ALIAS> = { [K in ColumnsOfTableOrView<DB, TABLE_OR_VIEW>]: RemapValueSourceTypeAsOptional<DB, AliasedTableOrViewInternal<DB, TABLE_OR_VIEW, ALIAS>, TABLE_OR_VIEW[K]> } & TableOrViewAlias<DB, TABLE_OR_VIEW, ALIAS>