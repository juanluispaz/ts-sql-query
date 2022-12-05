import type { MandatoryInsertSets, MandatoryInsertValues } from "../expressions/insert"
import type { UpdateSets, UpdateValues } from "../expressions/update"
import type { ITable } from "../utils/ITableOrView"
import type { ResultObjectValues } from "../utils/resultUtils"
import type { Column, ComputedColumn } from "../utils/Column"
import { AnyValueSource } from "../expressions/values"

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
