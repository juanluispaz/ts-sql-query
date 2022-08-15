import type { MandatoryInsertSets, MandatoryInsertValues } from "../expressions/insert"
import type { UpdateSets, UpdateValues } from "../expressions/update"
import type { ITable, ITableOrView } from "../utils/ITableOrView"
import type { ResultObjectValues } from "../utils/resultUtils"
import type { Column, ComputedColumn } from "../utils/Column"
import { AnyValueSource } from "../expressions/values"

export type SelectedRow<TABLE extends ITableOrView<any>> = ResultObjectValues<{
    [K in ColumnKeys<TABLE>]: TABLE[K];
}>
export type SelectedValues<TABLE extends ITableOrView<any>> = ResultObjectValues<{
    [K in ColumnKeys<TABLE>]: TABLE[K];
}>

export type InsertableRow<TABLE extends ITable<any>> = MakeTypeVisible<MandatoryInsertSets<TABLE>>
export type InsertableValues<TABLE extends ITable<any>> = MakeTypeVisible<MandatoryInsertValues<TABLE>>

export type UpdatableRow<TABLE extends ITable<any>> = MakeTypeVisible<UpdateSets<TABLE, TABLE>>
export type UpdatableValues<TABLE extends ITable<any>> = MakeTypeVisible<UpdateValues<TABLE>>

type MakeTypeVisible<T> = {
    // This type forces TS to compute the T object as a single interface instead things like A & B
    [P in keyof T]: T[P]
}

export type ColumnKeys<O extends object> = { [K in keyof O]-?: O[K] extends AnyValueSource ? K : never }[keyof O]

export type WritableColumnKeys<O extends object> = { [K in keyof O]-?: O[K] extends Column ? (O[K] extends ComputedColumn ? never : K) : never }[keyof O]
