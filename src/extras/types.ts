import type { IsColumnsGroupCandidate } from '../utils/tableOrViewUtils.js'
import type { InsertShapeContent, MandatoryInsertSetsContent, MandatoryInsertValues, OnConflictUpdateSetsContent, OnConflictUpdateValues } from '../expressions/insert.js'
import type { UpdateValues, UpdateShape, UpdateSetsContent } from '../expressions/update.js'
import type { ForUseInLeftJoin, HasSource, ITable, ITableOrView } from '../utils/ITableOrView.js'
import type { WritableDBColumn, WritableDBPrimaryKeyColumn, WritableDBPrimaryKeyColumnWithDefaultValue, WritableDBPrimaryKeyColumnWithoutDefaultValue } from '../utils/Column.js'
import type { AnyValueSource } from '../expressions/values.js'
import type { FromRefBySource, FromRefBySourceLeftJoin, ResolveShape } from '../utils/tableOrViewUtils.js'
import type { source } from '../utils/symbols.js'
import type { NAlias, NAsLeftJoin, NMaybyAliased, NNoTableOrViewRequiredFrom, NSource, NValuesForInsertFrom } from '../utils/sourceName.js'
import type { DataToProjectOfAny } from '../complexProjections/dataToProject.js'
import type { ResultObjectValues } from '../complexProjections/resultWithOptionalsAsUndefined.js'
import type { ResultObjectValuesProjectedAsNullable } from '../complexProjections/resultWithOptionalsAsNull.js'

type Selectable = DataToProjectOfAny

export type SelectedRow<TABLE> = 
    TABLE extends ITableOrView<any> // It can have anything else: only its columns are selected
    ? ResultObjectValues<ColumnsAtPaths<TABLE, ColumnKeys<TABLE>>>
    : TABLE extends Selectable
    ? ResultObjectValues<TABLE>
    : ResultObjectValues<ColumnsAtPaths<TABLE, ColumnKeys<TABLE>>>
export type SelectedValues<TABLE> = 
    TABLE extends ITableOrView<any> // It can have anything else: only its columns are selected
    ? ResultObjectValues<ColumnsAtPaths<TABLE, ColumnKeys<TABLE>>>
    : TABLE extends Selectable
    ? ResultObjectValues<TABLE>
    : ResultObjectValues<ColumnsAtPaths<TABLE, ColumnKeys<TABLE>>>

export type SelectedRowProjectedAsNullable<TABLE> = 
    TABLE extends ITableOrView<any> // It can have anything else: only its columns are selected
    ? ResultObjectValuesProjectedAsNullable<ColumnsAtPaths<TABLE, ColumnKeys<TABLE>>>
    : TABLE extends Selectable
    ? ResultObjectValuesProjectedAsNullable<TABLE>
    : ResultObjectValuesProjectedAsNullable<ColumnsAtPaths<TABLE, ColumnKeys<TABLE>>>
export type SelectedValuesProjectedAsNullable<TABLE> = 
    TABLE extends ITableOrView<any> // It can have anything else: only its columns are selected
    ? ResultObjectValuesProjectedAsNullable<ColumnsAtPaths<TABLE, ColumnKeys<TABLE>>>
    : TABLE extends Selectable
    ? ResultObjectValuesProjectedAsNullable<TABLE>
    : ResultObjectValuesProjectedAsNullable<ColumnsAtPaths<TABLE, ColumnKeys<TABLE>>>

export type InsertableRow<TABLE> = TABLE extends ITable<any>
    ? MakeTypeVisible<MandatoryInsertSetsContent<TABLE, NNoTableOrViewRequiredFrom<TABLE[typeof source]>, undefined>>
    : MakeTypeVisible<MandatoryInsertSetsContent<TABLE, NNoTableOrViewRequiredFrom<InferSourceFrom<TABLE>>, undefined>>
export type InsertableValues<TABLE> = MakeTypeVisible<MandatoryInsertValues<TABLE, undefined>>

export type UpdatableOnInsertConflictRow<TABLE> = TABLE extends ITable<any>
    ? MakeTypeVisible<OnConflictUpdateSetsContent<TABLE, AllowsNoTableOrViewRequired<TABLE[typeof source]> | NValuesForInsertFrom<TABLE[typeof source]>, undefined>>
    : MakeTypeVisible<OnConflictUpdateSetsContent<TABLE, AllowsNoTableOrViewRequired<InferSourceFrom<TABLE>>, undefined>>
export type UpdatableOnInsertConflictValues<TABLE> = MakeTypeVisible<OnConflictUpdateValues<TABLE, undefined>>

export type InsertableRowShapedAs<TABLE extends ITable<any>, SHAPE extends InsertShapeContent<TABLE>> = 
    MakeTypeVisible<MandatoryInsertSetsContent<TABLE, NNoTableOrViewRequiredFrom<TABLE[typeof source]>, ResolveShape<TABLE, SHAPE>>>
export type InsertableValuesShapedAs<TABLE extends ITable<any>, SHAPE extends InsertShapeContent<TABLE>> = 
    MakeTypeVisible<MandatoryInsertValues<TABLE, ResolveShape<TABLE, SHAPE>>>

export type UpdatableOnInsertConflictRowShapedAs<TABLE extends ITable<any>, SHAPE extends InsertShapeContent<TABLE>> =
    MakeTypeVisible<OnConflictUpdateSetsContent<TABLE, AllowsNoTableOrViewRequired<TABLE[typeof source]> | NValuesForInsertFrom<TABLE[typeof source]>, ResolveShape<TABLE, SHAPE>>>
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

export type WritableShapeFor<TABLE> = ShapeAtPaths<TABLE, WritableColumnKeys<TABLE>>

type MakeTypeVisible<T> = {
    // This type forces TS to compute the T object as a single interface instead things like A & B
    [P in keyof T]: T[P]
}

// The name of a column in a group is its path: 'group.column'. An object can have anything else, not only columns, and
// only an object that ends in a column is a group. There are no recursive types: each level has its own type, up to the
// same depth as the alias and the left join.

export type ColumnKeys<O> = ColumnKeys1<O>
type ColumnKeys1<O> = { [K in keyof O]-?: K extends string ? (NonNullable<O[K]> extends AnyValueSource ? K : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? `${K}.${ColumnKeys2<NonNullable<O[K]>>}` : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never
type ColumnKeys2<O> = { [K in keyof O]-?: K extends string ? (NonNullable<O[K]> extends AnyValueSource ? K : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? `${K}.${ColumnKeys3<NonNullable<O[K]>>}` : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never
type ColumnKeys3<O> = { [K in keyof O]-?: K extends string ? (NonNullable<O[K]> extends AnyValueSource ? K : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? `${K}.${ColumnKeys4<NonNullable<O[K]>>}` : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never
type ColumnKeys4<O> = { [K in keyof O]-?: K extends string ? (NonNullable<O[K]> extends AnyValueSource ? K : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? `${K}.${ColumnKeys5<NonNullable<O[K]>>}` : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never
type ColumnKeys5<O> = { [K in keyof O]-?: K extends string ? (NonNullable<O[K]> extends AnyValueSource ? K : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never

export type WritableColumnKeys<O> = WritableColumnKeys1<O>
type WritableColumnKeys1<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBColumn ? K : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? `${K}.${WritableColumnKeys2<NonNullable<O[K]>>}` : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never
type WritableColumnKeys2<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBColumn ? K : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? `${K}.${WritableColumnKeys3<NonNullable<O[K]>>}` : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never
type WritableColumnKeys3<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBColumn ? K : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? `${K}.${WritableColumnKeys4<NonNullable<O[K]>>}` : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never
type WritableColumnKeys4<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBColumn ? K : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? `${K}.${WritableColumnKeys5<NonNullable<O[K]>>}` : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never
type WritableColumnKeys5<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBColumn ? K : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never

export type IdColumnKeys<O> = IdColumnKeys1<O>
type IdColumnKeys1<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBPrimaryKeyColumn ? K : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? `${K}.${IdColumnKeys2<NonNullable<O[K]>>}` : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never
type IdColumnKeys2<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBPrimaryKeyColumn ? K : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? `${K}.${IdColumnKeys3<NonNullable<O[K]>>}` : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never
type IdColumnKeys3<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBPrimaryKeyColumn ? K : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? `${K}.${IdColumnKeys4<NonNullable<O[K]>>}` : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never
type IdColumnKeys4<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBPrimaryKeyColumn ? K : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? `${K}.${IdColumnKeys5<NonNullable<O[K]>>}` : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never
type IdColumnKeys5<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBPrimaryKeyColumn ? K : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never

export type AutogeneratedIdColumnKeys<O> = AutogeneratedIdColumnKeys1<O>
type AutogeneratedIdColumnKeys1<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBPrimaryKeyColumnWithDefaultValue ? K : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? `${K}.${AutogeneratedIdColumnKeys2<NonNullable<O[K]>>}` : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never
type AutogeneratedIdColumnKeys2<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBPrimaryKeyColumnWithDefaultValue ? K : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? `${K}.${AutogeneratedIdColumnKeys3<NonNullable<O[K]>>}` : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never
type AutogeneratedIdColumnKeys3<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBPrimaryKeyColumnWithDefaultValue ? K : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? `${K}.${AutogeneratedIdColumnKeys4<NonNullable<O[K]>>}` : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never
type AutogeneratedIdColumnKeys4<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBPrimaryKeyColumnWithDefaultValue ? K : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? `${K}.${AutogeneratedIdColumnKeys5<NonNullable<O[K]>>}` : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never
type AutogeneratedIdColumnKeys5<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBPrimaryKeyColumnWithDefaultValue ? K : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never

export type ProvidedIdColumnKeys<O> = ProvidedIdColumnKeys1<O>
type ProvidedIdColumnKeys1<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBPrimaryKeyColumnWithoutDefaultValue ? K : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? `${K}.${ProvidedIdColumnKeys2<NonNullable<O[K]>>}` : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never
type ProvidedIdColumnKeys2<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBPrimaryKeyColumnWithoutDefaultValue ? K : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? `${K}.${ProvidedIdColumnKeys3<NonNullable<O[K]>>}` : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never
type ProvidedIdColumnKeys3<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBPrimaryKeyColumnWithoutDefaultValue ? K : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? `${K}.${ProvidedIdColumnKeys4<NonNullable<O[K]>>}` : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never
type ProvidedIdColumnKeys4<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBPrimaryKeyColumnWithoutDefaultValue ? K : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? `${K}.${ProvidedIdColumnKeys5<NonNullable<O[K]>>}` : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never
type ProvidedIdColumnKeys5<O> = { [K in keyof O]-?: K extends string ? (O[K] extends WritableDBPrimaryKeyColumnWithoutDefaultValue ? K : never) : never }[keyof O] // Discard non string keys, if not they are mapped to never

// The name of a group, to leave out all of its columns
export type ColumnGroupKeys<O> = ColumnGroupKeys1<O>
type ColumnGroupKeys1<O> = { [K in keyof O]-?: K extends string ? (NonNullable<O[K]> extends AnyValueSource ? never : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? ([ColumnKeys2<NonNullable<O[K]>>] extends [never] ? never : K | `${K}.${ColumnGroupKeys2<NonNullable<O[K]>>}`) : never) : never }[keyof O]
type ColumnGroupKeys2<O> = { [K in keyof O]-?: K extends string ? (NonNullable<O[K]> extends AnyValueSource ? never : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? ([ColumnKeys3<NonNullable<O[K]>>] extends [never] ? never : K | `${K}.${ColumnGroupKeys3<NonNullable<O[K]>>}`) : never) : never }[keyof O]
type ColumnGroupKeys3<O> = { [K in keyof O]-?: K extends string ? (NonNullable<O[K]> extends AnyValueSource ? never : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? ([ColumnKeys4<NonNullable<O[K]>>] extends [never] ? never : K | `${K}.${ColumnGroupKeys4<NonNullable<O[K]>>}`) : never) : never }[keyof O]
type ColumnGroupKeys4<O> = { [K in keyof O]-?: K extends string ? (NonNullable<O[K]> extends AnyValueSource ? never : IsColumnsGroupCandidate<NonNullable<O[K]>> extends true ? ([ColumnKeys5<NonNullable<O[K]>>] extends [never] ? never : K) : never) : never }[keyof O]

export type ExcludedColumns<O> = ColumnKeys<O> | ColumnGroupKeys<O>
export type WithoutExcludedPaths<PATHS, EXCLUDE extends string> = PATHS extends EXCLUDE | `${EXCLUDE}.${string}` ? never : PATHS

type FirstOfPath<PATHS> = PATHS extends `${infer FIRST}.${string}` ? FIRST : PATHS
type RestOfPath<PATHS, FIRST extends string> = PATHS extends `${FIRST}.${infer REST}` ? REST : never

// The object with only the columns named by the paths, with their groups
export type ColumnsAtPaths<O, PATHS> = ColumnsAtPaths1<O, PATHS>
type ColumnsAtPaths1<O, PATHS> = { [K in FirstOfPath<PATHS> & keyof O]: K extends PATHS ? O[K] : ColumnsAtPaths2<NonNullable<O[K]>, RestOfPath<PATHS, K & string>> }
type ColumnsAtPaths2<O, PATHS> = { [K in FirstOfPath<PATHS> & keyof O]: K extends PATHS ? O[K] : ColumnsAtPaths3<NonNullable<O[K]>, RestOfPath<PATHS, K & string>> }
type ColumnsAtPaths3<O, PATHS> = { [K in FirstOfPath<PATHS> & keyof O]: K extends PATHS ? O[K] : ColumnsAtPaths4<NonNullable<O[K]>, RestOfPath<PATHS, K & string>> }
type ColumnsAtPaths4<O, PATHS> = { [K in FirstOfPath<PATHS> & keyof O]: K extends PATHS ? O[K] : ColumnsAtPaths5<NonNullable<O[K]>, RestOfPath<PATHS, K & string>> }
type ColumnsAtPaths5<O, PATHS> = { [K in FirstOfPath<PATHS> & keyof O]: K extends PATHS ? O[K] : never }

// The same object, where each column has its name in the table, as a shape expects
export type ShapeAtPaths<O, PATHS> = ShapeAtPaths1<O, PATHS, ''>
type ShapeAtPaths1<O, PATHS, PREFIX extends string> = { [K in FirstOfPath<PATHS> & keyof O]: K extends PATHS ? `${PREFIX}${K & string}` : ShapeAtPaths2<NonNullable<O[K]>, RestOfPath<PATHS, K & string>, `${PREFIX}${K & string}.`> }
type ShapeAtPaths2<O, PATHS, PREFIX extends string> = { [K in FirstOfPath<PATHS> & keyof O]: K extends PATHS ? `${PREFIX}${K & string}` : ShapeAtPaths3<NonNullable<O[K]>, RestOfPath<PATHS, K & string>, `${PREFIX}${K & string}.`> }
type ShapeAtPaths3<O, PATHS, PREFIX extends string> = { [K in FirstOfPath<PATHS> & keyof O]: K extends PATHS ? `${PREFIX}${K & string}` : ShapeAtPaths4<NonNullable<O[K]>, RestOfPath<PATHS, K & string>, `${PREFIX}${K & string}.`> }
type ShapeAtPaths4<O, PATHS, PREFIX extends string> = { [K in FirstOfPath<PATHS> & keyof O]: K extends PATHS ? `${PREFIX}${K & string}` : ShapeAtPaths5<NonNullable<O[K]>, RestOfPath<PATHS, K & string>, `${PREFIX}${K & string}.`> }
type ShapeAtPaths5<O, PATHS, PREFIX extends string> = { [K in FirstOfPath<PATHS> & keyof O]: K extends PATHS ? `${PREFIX}${K & string}` : never }

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

export function fromRef<T extends ITableOrView<any>, S extends NMaybyAliased<T[typeof source]>>(_tableOrView: T | (new (...params: any[]) => T), ref: ITableOrView<S>): FromRefBySource<T, S>
export function fromRef<T extends ITableOrView<any>, S extends NMaybyAliased<NAsLeftJoin<T[typeof source]>>>(_tableOrView: T | (new (...params: any[]) => T), ref: ForUseInLeftJoin<S>): FromRefBySourceLeftJoin<T, S>
export function fromRef(_tableOrView: any, ref: any): any {
    return ref as any
}

type InferSourceFrom<T> = ({ [K in keyof T]-?: T[K] extends AnyValueSource & HasSource<infer SOURCE> ? SOURCE : never })[keyof T]
type AllowsNoTableOrViewRequired<SOURCE extends NSource> = SOURCE | NNoTableOrViewRequiredFrom<SOURCE>