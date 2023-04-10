import type { InsertShape, MandatoryInsertSets, MandatoryInsertValues, OnConflictUpdateSets, OnConflictUpdateValues } from "../expressions/insert"
import type { UpdateSets, UpdateValues, UpdateShape } from "../expressions/update"
import type { ITable, ITableOrView, OuterJoinSource, TABLE_OR_VIEW_ALIAS } from "../utils/ITableOrView"
import type { ResultObjectValues } from "../utils/resultUtils"
import type { Column, ComputedColumn, PrimaryKeyAutogeneratedColumn, PrimaryKeyColumn } from "../utils/Column"
import type { AnyValueSource } from "../expressions/values"
import type { OuterJoinSourceOf, ResolveShape, TableOrViewWithRef } from "../utils/tableOrViewUtils"
import type { outerJoinAlias, tableOrViewRef } from "../utils/symbols"

type Selectable = {
    [key in string]?: AnyValueSource | Selectable
}

export type SelectedRow<TABLE> = 
    TABLE extends Selectable 
    ? ResultObjectValues<TABLE> 
    : ResultObjectValues<{
        [K in ColumnKeys<TABLE>]: TABLE[K];
    }>
export type SelectedValues<TABLE> = 
    TABLE extends Selectable 
    ? ResultObjectValues<TABLE> 
    : ResultObjectValues<{
        [K in ColumnKeys<TABLE>]: TABLE[K];
    }>

export type InsertableRow<TABLE> = TABLE extends ITable<any>
    ? MakeTypeVisible<MandatoryInsertSets<TABLE, undefined>>
    : MakeTypeVisible<MandatoryInsertSets<TABLE & ITable<any>, undefined>>
export type InsertableValues<TABLE> = TABLE extends ITable<any>
    ? MakeTypeVisible<MandatoryInsertValues<TABLE, undefined>>
    : MakeTypeVisible<MandatoryInsertValues<TABLE & ITable<any>, undefined>>

export type UpdatableOnInsertConflictRow<TABLE> = TABLE extends ITable<any>
    ? MakeTypeVisible<OnConflictUpdateSets<TABLE, undefined>>
    : MakeTypeVisible<OnConflictUpdateSets<TABLE & ITable<any>, undefined>>
export type UpdatableOnInsertConflictValues<TABLE> = TABLE extends ITable<any>
    ? MakeTypeVisible<OnConflictUpdateValues<TABLE, undefined>>
    : MakeTypeVisible<OnConflictUpdateValues<TABLE & ITable<any>, undefined>>

export type InsertableRowShapedAs<TABLE extends ITable<any>, SHAPE extends InsertShape<TABLE>> = 
    MakeTypeVisible<MandatoryInsertSets<ITable<any>, ResolveShape<TABLE, SHAPE>>>
export type InsertableValuesShapedAs<TABLE extends ITable<any>, SHAPE extends InsertShape<TABLE>> = 
    MakeTypeVisible<MandatoryInsertSets<TABLE, ResolveShape<TABLE, SHAPE>>>

export type UpdatableOnInsertConflictRowShapedAs<TABLE extends ITable<any>, SHAPE extends InsertShape<TABLE>> = 
    MakeTypeVisible<OnConflictUpdateValues<ITable<any>, ResolveShape<TABLE, SHAPE>>>
export type UpdatableOnInsertConflictValuesShapedAs<TABLE extends ITable<any>, SHAPE extends InsertShape<TABLE>> = 
    MakeTypeVisible<OnConflictUpdateValues<TABLE, ResolveShape<TABLE, SHAPE>>>

export type UpdatableRow<TABLE> = TABLE extends ITable<any>
    ? MakeTypeVisible<UpdateSets<TABLE, TABLE, undefined>>
    : MakeTypeVisible<UpdateSets<TABLE & ITable<any>, TABLE & ITable<any>, undefined>>
export type UpdatableValues<TABLE> = TABLE extends ITable<any>
    ? MakeTypeVisible<UpdateValues<TABLE, undefined>>
    : MakeTypeVisible<UpdateValues<TABLE & ITable<any>, undefined>>

export type UpdatableRowShapedAs<TABLE extends ITable<any>, SHAPE extends UpdateShape<TABLE, any>> = 
    MakeTypeVisible<UpdateSets<ITable<any>, ITable<any>, ResolveShape<TABLE, SHAPE>>>
export type UpdatableValuesShapedAs<TABLE extends ITable<any>, SHAPE extends UpdateShape<TABLE, any>> = 
    MakeTypeVisible<UpdateValues<TABLE, ResolveShape<TABLE, SHAPE>>>

export type WritableShapeFor<TABLE> = { [P in WritableColumnKeys<TABLE>]: P }

type MakeTypeVisible<T> = {
    // This type forces TS to compute the T object as a single interface instead things like A & B
    [P in keyof T]: T[P]
}

export type ColumnKeys<O> = { [K in keyof O]-?: K extends string ? (O[K] extends AnyValueSource ? K : never) : never }[keyof O] // Discard non string keys, if not TS got wrong output when extractColumnsFrom is used with the result of fromRef 
export type WritableColumnKeys<O> = { [K in keyof O]-?: K extends string ? (O[K] extends Column ? (O[K] extends ComputedColumn ? never : K) : never) : never }[keyof O] // Discard non string keys, if not TS got wrong output when extractColumnsFrom is used with the result of fromRef 
export type IdColumnKeys<O> = { [K in keyof O]-?: K extends string ? (O[K] extends PrimaryKeyColumn ? K : never) : never }[keyof O] // Discard non string keys, if not TS got wrong output when extractColumnsFrom is used with the result of fromRef 
export type AutogeneratedIdColumnKeys<O> = { [K in keyof O]-?: K extends string ? (O[K] extends PrimaryKeyAutogeneratedColumn ? K : never) : never }[keyof O] // Discard non string keys, if not TS got wrong output when extractColumnsFrom is used with the result of fromRef 
export type ProvidedIdColumnKeys<O> = { [K in keyof O]-?: K extends string ? (O[K] extends PrimaryKeyColumn ? (O[K] extends PrimaryKeyAutogeneratedColumn ? never : K) : never) : never }[keyof O] // Discard non string keys, if not TS got wrong output when extractColumnsFrom is used with the result of fromRef 

export type TableOrViewOf<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS extends string = ''> = 
    ALIAS extends false /*ALIAS is any*/ 
    ? ITableOrView<TABLE_OR_VIEW[typeof tableOrViewRef] | TABLE_OR_VIEW_ALIAS<TABLE_OR_VIEW[typeof tableOrViewRef], ALIAS>>
    : ALIAS extends '' 
    ? ITableOrView<TABLE_OR_VIEW[typeof tableOrViewRef]> 
    : ITableOrView<TABLE_OR_VIEW_ALIAS<TABLE_OR_VIEW[typeof tableOrViewRef], ALIAS>>

export type TableOrViewLeftJoinOf<TABLE_OR_VIEW extends ITableOrView<any>, ALIAS extends string = ''> = OuterJoinSource<TABLE_OR_VIEW, ALIAS>

export function fromRef<TABLE_OR_VIEW extends ITableOrView<any>, REF extends ITableOrView<TABLE_OR_VIEW[typeof tableOrViewRef]>>(tableOrView: TABLE_OR_VIEW | (new (...params: any[]) => TABLE_OR_VIEW), ref: REF): TableOrViewWithRef<TABLE_OR_VIEW, REF[typeof tableOrViewRef]>
export function fromRef<TABLE_OR_VIEW extends ITableOrView<any>, REF extends ITableOrView<TABLE_OR_VIEW_ALIAS<TABLE_OR_VIEW[typeof tableOrViewRef], any>>>(tableOrView: TABLE_OR_VIEW | (new (...params: any[]) => TABLE_OR_VIEW), ref: REF): TableOrViewWithRef<TABLE_OR_VIEW, REF[typeof tableOrViewRef]>
export function fromRef<TABLE_OR_VIEW extends ITableOrView<any>, REF extends ITableOrView<TABLE_OR_VIEW[typeof tableOrViewRef] | TABLE_OR_VIEW_ALIAS<TABLE_OR_VIEW[typeof tableOrViewRef], any>>>(tableOrView: TABLE_OR_VIEW | (new (...params: any[]) => TABLE_OR_VIEW), ref: REF): TableOrViewWithRef<TABLE_OR_VIEW, REF[typeof tableOrViewRef]>
export function fromRef<TABLE_OR_VIEW extends ITableOrView<any>, REF extends OuterJoinSource<TABLE_OR_VIEW, any>>(tableOrView: TABLE_OR_VIEW | (new (...params: any[]) => TABLE_OR_VIEW), ref: REF): OuterJoinSourceOf<TABLE_OR_VIEW, REF[typeof outerJoinAlias]>
export function fromRef(_tableOrView: any, ref: any): any {
    return ref as any
}