import type { InsertShapeContent, MandatoryInsertSetsContent, MandatoryInsertValues, OnConflictUpdateSetsContent, OnConflictUpdateValues } from "../expressions/insert"
import type { UpdateValues, UpdateShape, UpdateSetsContent } from "../expressions/update"
import type { ForUseInLeftJoin, HasSource, ITable, ITableOrView } from "../utils/ITableOrView"
import type { WritableDBColumn, WritableDBColumnWithDefaultValue, WritableDBPrimaryKeyColumn, WritableDBPrimaryKeyColumnWithoutDefaultValue } from "../utils/Column"
import type { AnyValueSource } from "../expressions/values"
import type { FromRef, ResolveShape } from "../utils/tableOrViewUtils"
import type { source } from "../utils/symbols"
import type { NAlias, NAsLeftJoin, NMaybyAliased, NNoTableOrViewRequiredFrom, NSource } from "../utils/sourceName"
import type { DataToProjectOfAny } from "../complexProjections/dataToProject"
import type { ResultObjectValues } from "../complexProjections/resultWithOptionalsAsUndefined"
import type { ResultObjectValuesProjectedAsNullable } from "../complexProjections/resultWithOptionalsAsNull"

type Selectable = DataToProjectOfAny

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

export type SelectedRowProjectedAsNullable<TABLE> = 
    TABLE extends Selectable 
    ? ResultObjectValuesProjectedAsNullable<TABLE> 
    : ResultObjectValuesProjectedAsNullable<{
        [K in ColumnKeys<TABLE>]: TABLE[K];
    }>
export type SelectedValuesProjectedAsNullable<TABLE> = 
    TABLE extends Selectable 
    ? ResultObjectValuesProjectedAsNullable<TABLE> 
    : ResultObjectValuesProjectedAsNullable<{
        [K in ColumnKeys<TABLE>]: TABLE[K];
    }>

export type InsertableRow<TABLE> = TABLE extends ITable<any>
    ? MakeTypeVisible<MandatoryInsertSetsContent<TABLE, AllowsNoTableOrViewRequired<TABLE[typeof source]>, undefined>>
    : MakeTypeVisible<MandatoryInsertSetsContent<TABLE, AllowsNoTableOrViewRequired<InferSourceFrom<TABLE>>, undefined>>
export type InsertableValues<TABLE> = MakeTypeVisible<MandatoryInsertValues<TABLE, undefined>>

export type UpdatableOnInsertConflictRow<TABLE> = TABLE extends ITable<any>
    ? MakeTypeVisible<OnConflictUpdateSetsContent<TABLE, AllowsNoTableOrViewRequired<TABLE[typeof source]>, undefined>>
    : MakeTypeVisible<OnConflictUpdateSetsContent<TABLE, AllowsNoTableOrViewRequired<InferSourceFrom<TABLE>>, undefined>>
export type UpdatableOnInsertConflictValues<TABLE> = MakeTypeVisible<OnConflictUpdateValues<TABLE, undefined>>

export type InsertableRowShapedAs<TABLE extends ITable<any>, SHAPE extends InsertShapeContent<TABLE>> = 
    MakeTypeVisible<MandatoryInsertSetsContent<TABLE, AllowsNoTableOrViewRequired<TABLE[typeof source]>, ResolveShape<TABLE, SHAPE>>>
export type InsertableValuesShapedAs<TABLE extends ITable<any>, SHAPE extends InsertShapeContent<TABLE>> = 
    MakeTypeVisible<MandatoryInsertValues<TABLE, ResolveShape<TABLE, SHAPE>>>

export type UpdatableOnInsertConflictRowShapedAs<TABLE extends ITable<any>, SHAPE extends InsertShapeContent<TABLE>> = 
    MakeTypeVisible<OnConflictUpdateValues<TABLE, ResolveShape<TABLE, SHAPE>>>
export type UpdatableOnInsertConflictValuesShapedAs<TABLE extends ITable<any>, SHAPE extends InsertShapeContent<TABLE>> = 
    MakeTypeVisible<OnConflictUpdateValues<TABLE, ResolveShape<TABLE, SHAPE>>>

export type UpdatableRow<TABLE> = TABLE extends ITable<any>
    ? MakeTypeVisible<UpdateSetsContent<TABLE, AllowsNoTableOrViewRequired<TABLE[typeof source]>, undefined>>
    : MakeTypeVisible<UpdateSetsContent<TABLE, AllowsNoTableOrViewRequired<InferSourceFrom<TABLE>>, undefined>>
export type UpdatableValues<TABLE> = MakeTypeVisible<UpdateValues<TABLE, undefined>>

export type UpdatableRowShapedAs<TABLE extends ITable<any>, SHAPE extends UpdateShape<TABLE, any>> = 
    MakeTypeVisible<UpdateSetsContent<TABLE, AllowsNoTableOrViewRequired<TABLE[typeof source]>, ResolveShape<TABLE, SHAPE>>>
export type UpdatableValuesShapedAs<TABLE extends ITable<any>, SHAPE extends UpdateShape<TABLE, any>> = 
    MakeTypeVisible<UpdateValues<TABLE, ResolveShape<TABLE, SHAPE>>>

export type WritableShapeFor<TABLE> = { [P in WritableColumnKeys<TABLE>]: P }

type MakeTypeVisible<T> = {
    // This type forces TS to compute the T object as a single interface instead things like A & B
    [P in keyof T]: T[P]
}

export type ColumnKeys<O> = { [K in keyof O]-?: K extends string ? (O[K] extends AnyValueSource ? K : never) : never }[keyof O] // Discard non string keys, if not TS got wrong output when extractColumnsFrom is used with the result of fromRef 
export type WritableColumnKeys<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBColumn ? K : never) : never }[keyof O] // Discard non string keys, if not TS got wrong output when extractColumnsFrom is used with the result of fromRef 
export type IdColumnKeys<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBPrimaryKeyColumn ? K : never) : never }[keyof O] // Discard non string keys, if not TS got wrong output when extractColumnsFrom is used with the result of fromRef 
export type AutogeneratedIdColumnKeys<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBColumnWithDefaultValue ? K : never) : never }[keyof O] // Discard non string keys, if not TS got wrong output when extractColumnsFrom is used with the result of fromRef 
export type ProvidedIdColumnKeys<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBPrimaryKeyColumnWithoutDefaultValue ? K : never) : never }[keyof O] // Discard non string keys, if not TS got wrong output when extractColumnsFrom is used with the result of fromRef 

export type TableOrViewOf<T extends ITableOrView<any>, ALIAS extends string = ''> = 
    ALIAS extends false /*ALIAS is any*/ 
    ? ITableOrView<NMaybyAliased<T[typeof source]>>
    : ALIAS extends '' 
    ? ITableOrView<NMaybyAliased<T[typeof source]>> 
    : ITableOrView<NAlias<T[typeof source], ALIAS>>

export type TableOrViewLeftJoinOf<T extends ITableOrView<any>, ALIAS extends string = ''> =  
    ALIAS extends false /*ALIAS is any*/ 
    ? ForUseInLeftJoin<NMaybyAliased<NAsLeftJoin<T[typeof source]>>>
    : ALIAS extends '' 
    ? ForUseInLeftJoin<NMaybyAliased<NAsLeftJoin<T[typeof source]>>>
    : ForUseInLeftJoin<NAlias<NAsLeftJoin<T[typeof source]>, ALIAS>>

export function fromRef<T extends ITableOrView<any>, REF extends ITableOrView<any> | ForUseInLeftJoin<any>>(_tableOrView: T | (new (...params: any[]) => T), ref: REF): FromRef<T, REF> {
    return ref as any
}

type InferSourceFrom<T> = ({ [K in keyof T]-?: T[K] extends AnyValueSource & HasSource<infer SOURCE> ? SOURCE : never })[keyof T]
type AllowsNoTableOrViewRequired<SOURCE extends NSource> = SOURCE | NNoTableOrViewRequiredFrom<SOURCE>