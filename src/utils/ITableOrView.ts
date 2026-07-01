import type { RawFragment } from './RawFragment.js'
import type { NDB, NDBWithType, NDbType, NGetDBFrom, NNoTableOrViewRequired, NSource, NWithSameDB } from './sourceName.js'
import type { isTableOrViewObject, isValueSourceObject, source, type } from './symbols.js'

export interface HasSource</*in|out*/ SOURCE extends NSource> {
    [source]: SOURCE
}

export interface OfDB</*in|out*/ DB_TYPE extends NDbType> {
    [source]: NDBWithType<DB_TYPE>
}

export interface OfSameDB</*in|out*/ SOURCE extends HasSource<any>> {
    [source]: NWithSameDB<SOURCE[typeof source]>
}

export interface SameDB</*in|out*/ DB extends NDB> {
    [source]: NWithSameDB<DB>
}

export interface AnyTableOrView {
    [isTableOrViewObject]: true
}

export interface ITableOrView</*in|out*/ SOURCE extends NSource> extends AnyTableOrView, HasSource<SOURCE> {
}

// Duplicated here to avoid circular reference
interface DBColumn {
    [type]: 'column'
    [isValueSourceObject]: true
}

export interface HasIsValue {
    _isValue(value: any): boolean
}

export interface IQueryDataDiscovery {
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void
    __getOldValues(sqlBuilder: HasIsValue): AnyTableOrView | undefined
    __getValuesForInsert(sqlBuilder: HasIsValue): AnyTableOrView | undefined
    __isAllowed(sqlBuilder: HasIsValue): boolean
    __hasAggregation(sqlBuilder: HasIsValue): boolean
}

export function __addWiths(value: any, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
    if (value === undefined || value === null) {
        return
    }
    if (typeof value === 'object' && typeof value.__addWiths === 'function') {
        (value as IQueryDataDiscovery).__addWiths(sqlBuilder, withs)
    }
}

export function __registerTableOrView(value: any, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
    if (value === undefined || value === null) {
        return
    }
    if (typeof value === 'object' && typeof value.__registerTableOrView === 'function') {
        (value as IQueryDataDiscovery).__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    }
}

export function __registerRequiredColumn(value: any, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
    if (value === undefined || value === null) {
        return
    }
    if (typeof value === 'object' && typeof value.__registerRequiredColumn === 'function') {
        (value as IQueryDataDiscovery).__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
}

export function __getOldValues(value: any, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
    if (value === undefined || value === null) {
        return undefined
    }
    if (typeof value === 'object' && typeof value.__getOldValues === 'function') {
        return (value as IQueryDataDiscovery).__getOldValues(sqlBuilder)
    }
    return undefined
}

export function __getValuesForInsert(value: any, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
    if (value === undefined || value === null) {
        return undefined
    }
    if (typeof value === 'object' && typeof value.__getValuesForInsert === 'function') {
        return (value as IQueryDataDiscovery).__getValuesForInsert(sqlBuilder)
    }
    return undefined
}

export function __isAllowed(value: any, sqlBuilder: HasIsValue): boolean {
    if (value === undefined || value === null) {
        return true
    }
    if (typeof value === 'object' && typeof value.__getValuesForInsert === 'function') {
        return (value as IQueryDataDiscovery).__isAllowed(sqlBuilder)
    }
    return true
}

export function __hasAggregation(value: any, sqlBuilder: HasIsValue): boolean {
    if (value === undefined || value === null) {
        return false
    }
    if (typeof value === 'object' && typeof value.__hasAggregation === 'function') {
        return (value as IQueryDataDiscovery).__hasAggregation(sqlBuilder)
    }
    return false
}

export interface __ITableOrViewPrivate extends IQueryDataDiscovery {
    [isTableOrViewObject]: true
    __name: string
    __as?: string | undefined
    __type: 'table' | 'view' | 'with' | 'values'
    __forUseInLeftJoin?: boolean | undefined
    __template?: RawFragment<any> | undefined
    __customizationName?: string | undefined
    // Re-applies the table/view customization (set by createTableOrViewCustomization)
    // to a freshly cloned table/view so the customization template — which embeds
    // the table's name and alias — re-binds to the clone's alias instead of being
    // frozen against the table state at customization time. Called by `as()` /
    // `forUseInLeftJoinAs()` when cloning a customized table/view.
    __customizationApply?: ((target: AnyTableOrView) => void) | undefined
    __oldValues?: boolean | undefined
    __valuesForInsert?: boolean | undefined
    __hasExternalDependencies?: boolean | undefined
}

export function __getTableOrViewPrivate(table: AnyTableOrView | ForUseInLeftJoin<any>): __ITableOrViewPrivate {
    return table as any
}

export interface ITable</*in|out*/ SOURCE extends NSource> extends ITableOrView<SOURCE> {
    [type]: 'table'
}

export interface IView</*in|out*/ SOURCE extends NSource> extends ITableOrView<SOURCE> {
    [type]: 'view'
}

export interface IValues</*in|out*/ SOURCE extends NSource> extends ITableOrView<SOURCE> {
    [type]: 'values'
}

export interface IWithView</*in|out*/ SOURCE extends NSource> extends ITableOrView<SOURCE> {
    [type]: 'with'
}

export interface ITableOrViewAlias</*in|out*/ SOURCE extends NSource> extends ITableOrView<SOURCE> {
    [type]: 'tableOrViewAlias'
}

export interface NoTableOrViewRequired</*in|out*/ DB extends NDB> extends IView<NNoTableOrViewRequired<DB>> {
}

export type NoTableOrViewRequiredOfSameDB<SOURCE extends HasSource<any>> = NoTableOrViewRequired<NGetDBFrom<SOURCE[typeof source]>>

export interface OldValues</*in|out*/ SOURCE extends NSource> extends HasSource<SOURCE> {
    [type]: 'oldValues'
}

export interface ValuesForInsert</*in|out*/ SOURCE extends NSource> extends HasSource<SOURCE> {
    [type]: 'valuesForInsert'
}

export interface AnyForUseInLeftJoin {
    [type]: 'forUseInLeftJoin'
}

export interface ForUseInLeftJoin</*in|out*/ SOURCE extends NSource> extends AnyForUseInLeftJoin, HasSource<SOURCE> {
}

export interface ResolvedShape</*in|out*/ SOURCE extends NSource> extends HasSource<SOURCE> {
    [type]: 'resolvedShape'
}

export interface IRawFragment</*in|out*/ SOURCE extends NSource> extends HasSource<SOURCE> {
    [type]: 'rawFragment'
}