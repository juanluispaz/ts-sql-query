import type { MandatoryInsertSets, MandatoryInsertValues } from "../expressions/insert"
import type { UpdateSets, UpdateValues } from "../expressions/update"
import type { ITable, ITableOrView, OuterJoinSource, TABLE_OR_VIEW_ALIAS } from "../utils/ITableOrView"
import type { ResultObjectValues } from "../utils/resultUtils"
import type { Column, ComputedColumn } from "../utils/Column"
import type { AnyValueSource } from "../expressions/values"
import type { OuterJoinSourceOf, TableOrViewWithRef } from "../utils/tableOrViewUtils"
import type { outerJoinAlias, tableOrViewRef } from "../utils/symbols"

export type SelectedRow<TABLE> = ResultObjectValues<{
    [K in ColumnKeys<TABLE> & keyof TABLE]: TABLE[K];
}>
export type SelectedValues<TABLE> = ResultObjectValues<{
    [K in ColumnKeys<TABLE>]: TABLE[K];
}>

export type InsertableRow<TABLE> = TABLE extends ITable<any>
    ? MakeTypeVisible<MandatoryInsertSets<TABLE>>
    : MakeTypeVisible<MandatoryInsertSets<TABLE & ITable<any>>>
export type InsertableValues<TABLE> = TABLE extends ITable<any>
    ? MakeTypeVisible<MandatoryInsertValues<TABLE>>
    : MakeTypeVisible<MandatoryInsertValues<TABLE & ITable<any>>>

export type UpdatableRow<TABLE> = TABLE extends ITable<any>
    ? MakeTypeVisible<UpdateSets<TABLE, TABLE>>
    : MakeTypeVisible<UpdateSets<TABLE & ITable<any>, TABLE & ITable<any>>>
export type UpdatableValues<TABLE> = TABLE extends ITable<any>
    ? MakeTypeVisible<UpdateValues<TABLE>>
    : MakeTypeVisible<UpdateValues<TABLE & ITable<any>>>

type MakeTypeVisible<T> = {
    // This type forces TS to compute the T object as a single interface instead things like A & B
    [P in keyof T]: T[P]
}

export type ColumnKeys<O> = { [K in keyof O]-?: O[K] extends AnyValueSource ? K : never }[keyof O]

export type WritableColumnKeys<O> = { [K in keyof O]-?: O[K] extends Column ? (O[K] extends ComputedColumn ? never : K) : never }[keyof O]

export type TableOrViewOf<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS extends string = ''> = 
    ALIAS extends false /*ALIAS is any*/ 
    ? ITableOrView<TABLE_OR_VIEW[typeof tableOrViewRef] | TABLE_OR_VIEW_ALIAS<TABLE_OR_VIEW[typeof tableOrViewRef], ALIAS>>
    : ALIAS extends '' 
    ? ITableOrView<TABLE_OR_VIEW[typeof tableOrViewRef]> 
    : ITableOrView<TABLE_OR_VIEW_ALIAS<TABLE_OR_VIEW[typeof tableOrViewRef], ALIAS>>

export type TableOrViewLeftJoinOf<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS extends string = ''> = OuterJoinSource<TABLE_OR_VIEW, ALIAS>

export function fromRef<TABLE_OR_VIEW extends ITableOrView<any>, REF extends TableOrViewOf<TABLE_OR_VIEW[typeof tableOrViewRef], any>>(tableOrView: TABLE_OR_VIEW, ref: REF): TableOrViewWithRef<TABLE_OR_VIEW, REF[typeof tableOrViewRef]>
export function fromRef<TABLE_OR_VIEW extends ITableOrView<any>, REF extends TableOrViewLeftJoinOf<TABLE_OR_VIEW, any>>(tableOrView: TABLE_OR_VIEW, ref: REF): OuterJoinSourceOf<TABLE_OR_VIEW, REF[typeof outerJoinAlias]>
export function fromRef<TABLE_OR_VIEW extends ITableOrView<any>, REF extends TableOrViewOf<TABLE_OR_VIEW[typeof tableOrViewRef], any>>(tableOrView: new (...params: any[]) => TABLE_OR_VIEW, ref: REF): TableOrViewWithRef<TABLE_OR_VIEW, REF[typeof tableOrViewRef]>
export function fromRef<TABLE_OR_VIEW extends ITableOrView<any>, REF extends TableOrViewLeftJoinOf<TABLE_OR_VIEW, any>>(tableOrView: new (...params: any[]) => TABLE_OR_VIEW, ref: REF): OuterJoinSourceOf<TABLE_OR_VIEW, REF[typeof outerJoinAlias]>
export function fromRef(_tableOrView: any, ref: any): any {
    return ref as any
}