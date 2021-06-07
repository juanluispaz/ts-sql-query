import type { AnyDB } from "../databases"
import { RawFragment } from "./RawFragment"
import type { database, noTableOrViewRequired, outerJoinAlias, outerJoinDatabase, outerJoinTableOrView, tableOrView, tableOrViewAlias, tableOrViewCustomName, tableOrViewRef, tableOrViewRefType, type } from "./symbols"

export interface TableOrViewRef<DB extends AnyDB> {
    [database]: DB
    [tableOrViewRefType]: 'tableOrViewRef'
}

export interface TableOrViewOf<DB extends AnyDB> {
    [database]: DB
}

export interface ITableOrView<REF extends TableOrViewRef<AnyDB>> extends TableOrViewOf<REF[typeof database]> {
    [tableOrViewRef]: REF
}

export interface ITableOrViewOf<DB extends AnyDB, REF extends TableOrViewRef<DB>> extends ITableOrView<REF> {
    
}

export interface HasAddWiths {
    __addWiths(withs: Array<IWithView<any>>): void
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void
}

export function __addWiths(value: any, withs: Array<IWithView<any>>): void {
    if (value === undefined || value === null) {
        return
    }
    if (typeof value === 'object' && typeof value.__addWiths === 'function') {
        (value as HasAddWiths).__addWiths(withs)
    }
}

export function __registerTableOrView(value: any, requiredTablesOrViews: Set<ITableOrView<any>>): void {
    if (value === undefined || value === null) {
        return
    }
    if (typeof value === 'object' && typeof value.__registerTableOrView === 'function') {
        (value as HasAddWiths).__registerTableOrView(requiredTablesOrViews)
    }
}

export interface __ITableOrViewPrivate extends HasAddWiths {
    __name: string
    __as?: string
    __type: 'table' | 'view' | 'with'
    __template?: RawFragment<any>
    __customizationName?: string
}

export function __getTableOrViewPrivate(table: ITableOrView<any> | OuterJoinSource<any, any>): __ITableOrViewPrivate {
    return table as any
}

export interface ITable<REF extends TableOrViewRef<AnyDB>> extends ITableOrView<REF>{
    [type]: 'table'
}

export interface ITableOf<DB extends AnyDB, REF extends TableOrViewRef<DB>> extends ITable<REF> {
    
}

export interface IView<REF extends TableOrViewRef<AnyDB>> extends ITableOrView<REF>{
    [type]: 'view'
}

export interface IWithView<REF extends TableOrViewRef<AnyDB>> extends ITableOrView<REF>{
    [type]: 'with'
}

export interface NoTableOrViewRequired<DB extends AnyDB> extends TableOrViewRef<DB> {
    [database]: DB
    [noTableOrViewRequired]: 'NoTableOrViewRequired'
}

export interface NoTableOrViewRequiredView<DB extends AnyDB> extends IView<NoTableOrViewRequired<DB>> {
    [noTableOrViewRequired]: 'NoTableOrViewRequiredView'
}

export interface TableOrViewAliasRef<REF extends TableOrViewRef<AnyDB>, ALIAS> extends TableOrViewRef<REF[typeof database]> {
    [tableOrViewAlias]: ALIAS
    [tableOrViewRef]: REF
}

export interface CustomizedTableOrViewRef<REF extends TableOrViewRef<AnyDB>, NAME> extends TableOrViewRef<REF[typeof database]> {
    [tableOrViewCustomName]: NAME
    [tableOrViewRef]: REF
}

export interface TableOrViewAlias<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS> extends ITableOrView<TableOrViewAliasRef<TABLE_OR_VIEW[typeof tableOrViewRef], ALIAS>> {
    [tableOrView]: TABLE_OR_VIEW
    [tableOrViewAlias]: ALIAS
}

export interface OuterJoinSource<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS> {
    [outerJoinDatabase]: TABLE_OR_VIEW[typeof database]
    [outerJoinTableOrView]: TABLE_OR_VIEW
    [outerJoinAlias]: ALIAS
}