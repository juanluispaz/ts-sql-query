import type { AnyDB } from "../databases"
import type { database, noTableOrViewRequired, outerJoinAlias, outerJoinDatabase, outerJoinTableOrView, tableOrView, tableOrViewAlias, type } from "./symbols"

export interface ITableOrView<DB extends AnyDB> {
    [database]: DB
}

export interface __ITableOrViewPrivate {
    __name: string
    __as?: string
    __type: 'table' | 'view'
}

export function __getTableOrViewPrivate(table: ITableOrView<any>): __ITableOrViewPrivate {
    return table as any
}

export interface ITable<DB extends AnyDB> extends ITableOrView<DB>{
    [type]: 'table'
}

export interface IView<DB extends AnyDB> extends ITableOrView<DB>{
    [type]: 'view'
}

export interface NoTableOrViewRequired extends ITableOrView<any> {
    [database]: any
    [noTableOrViewRequired]: 'NoTableRequired'
}

export interface TableOrViewAlias<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, ALIAS> extends ITableOrView<DB> {
    [tableOrView]: TABLE_OR_VIEW
    [tableOrViewAlias]: ALIAS
}

export interface OuterJoinSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, ALIAS> {
    [outerJoinDatabase]: DB
    [outerJoinTableOrView]: TABLE_OR_VIEW
    [outerJoinAlias]: ALIAS
}