import type { AnyDB } from "../databases"
import { RawFragment } from "./RawFragment"
import type { database, noTableOrViewRequired, oldValues, outerJoinAlias, outerJoinDatabase, outerJoinTableOrView, tableOrView, tableOrViewAlias, tableOrViewCustomName, tableOrViewRef, tableOrViewRefType, type } from "./symbols"

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

// Duplicated here to avoid circular reference
interface Column {
    [type]: 'column'
}

export interface HasAddWiths {
    __addWiths(withs: Array<IWithView<any>>): void
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void
    __getOldValues(): ITableOrView<any> | undefined
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

export function __registerRequiredColumn(value: any, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
    if (value === undefined || value === null) {
        return
    }
    if (typeof value === 'object' && typeof value.__registerRequiredColumn === 'function') {
        (value as HasAddWiths).__registerRequiredColumn(requiredColumns, onlyForTablesOrViews)
    }
}

export function __getOldValues(value: any): ITableOrView<any> | undefined {
    if (value === undefined || value === null) {
        return undefined
    }
    if (typeof value === 'object' && typeof value.__getOldValues === 'function') {
        return (value as HasAddWiths).__getOldValues()
    }
    return undefined
}

export interface __ITableOrViewPrivate extends HasAddWiths {
    __name: string
    __as?: string
    __type: 'table' | 'view' | 'with'
    __forUseInLeftJoin?: boolean
    __template?: RawFragment<any>
    __customizationName?: string
    __oldValues?: boolean
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
    [noTableOrViewRequired]: 'NoTableOrViewRequired'
}

export interface NoTableOrViewRequiredView<DB extends AnyDB> extends IView<NoTableOrViewRequired<DB>> {
    [noTableOrViewRequired]: 'NoTableOrViewRequiredView'
}

export interface OLD<REF extends TableOrViewRef<AnyDB>> extends TableOrViewRef<REF[typeof database]> {
    [tableOrViewRef]: REF
    [oldValues]: 'OldValues'
}

export interface OldTableOrView<TABLE_OR_VIEW extends ITableOrView<any>> extends ITableOrView<OLD<TABLE_OR_VIEW[typeof tableOrViewRef]>> {
    [tableOrView]: TABLE_OR_VIEW
    [oldValues]: 'OldValuesTableOrView'
}

export interface TABLE_OR_VIEW_ALIAS<REF extends TableOrViewRef<AnyDB>, ALIAS> extends TableOrViewRef<REF[typeof database]> {
    [tableOrViewAlias]: ALIAS
    [tableOrViewRef]: REF
}

export interface CUSTOMIZED_TABLE_OR_VIEW<REF extends TableOrViewRef<AnyDB>, NAME> extends TableOrViewRef<REF[typeof database]> {
    [tableOrViewCustomName]: NAME
    [tableOrViewRef]: REF
}

export interface TableOrViewAlias<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS> extends ITableOrView<TABLE_OR_VIEW_ALIAS<TABLE_OR_VIEW[typeof tableOrViewRef], ALIAS>> {
    [tableOrView]: TABLE_OR_VIEW
    [tableOrViewAlias]: ALIAS
}

export interface OuterJoinSource<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS> {
    [outerJoinDatabase]: TABLE_OR_VIEW[typeof database]
    [outerJoinTableOrView]: TABLE_OR_VIEW
    [outerJoinAlias]: ALIAS
}

export interface OUTER_JOIN_SOURCE<REF extends TableOrViewRef<AnyDB>, ALIAS> extends TableOrViewRef<REF[typeof database]> {
    [outerJoinDatabase]: REF[typeof database]
    [outerJoinTableOrView]: REF
    [outerJoinAlias]: ALIAS
}

export interface TableOrViewOuterJoin<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS> extends ITableOrView<OUTER_JOIN_SOURCE<TABLE_OR_VIEW[typeof tableOrViewRef], ALIAS>> {
    [tableOrView]: TABLE_OR_VIEW
    [tableOrViewAlias]: ALIAS
    [outerJoinAlias]: ALIAS
}