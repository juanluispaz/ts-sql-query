import type { IBooleanValueSource, ColumnsForSetOf, IIfValueSource, InputTypeOfColumn, IValueSource } from "./values"
import type { ITableOrView, NoTableOrViewRequired, OLD } from "../utils/ITableOrView"
import type { AnyDB, NoopDB, Oracle, PostgreSql, Sqlite, SqlServer, TypeSafeDB } from "../databases"
import type { int } from "ts-extended-types"
import type { database, tableOrView, tableOrViewRef, valueType } from "../utils/symbols"
import type { RawFragment } from "../utils/RawFragment"

export interface UpdateCustomization<DB extends AnyDB> {
    afterUpdateKeyword?: RawFragment<DB>
    afterQuery?: RawFragment<DB>
}

export interface UpdateExpressionOf<DB extends AnyDB> {
    [database]: DB
}

export interface UpdateExpressionBase<TABLE extends ITableOrView<any>> extends UpdateExpressionOf<TABLE[typeof database]> {
    [tableOrView]: TABLE
}

export interface ExecutableUpdate<TABLE extends ITableOrView<any>> extends UpdateExpressionBase<TABLE> {
    executeUpdate(this: UpdateExpressionOf<TypeSafeDB>, min?: number, max?: number): Promise<int>
    executeUpdate(min?: number, max?: number): Promise<number>
    query(): string
    params(): any[]
}

export interface CustomizableExecutableUpdate<TABLE extends ITableOrView<any>> extends ExecutableUpdate<TABLE> {
    customizeQuery(customization: UpdateCustomization<TABLE[typeof database]>): ExecutableUpdate<TABLE>
}

export interface ExecutableUpdateExpression<TABLE extends ITableOrView<any>> extends ReturnableExecutableUpdate<TABLE> {
    set(columns: UpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfValue(columns: OptionalUpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfSet(columns: UpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfSetIfValue(columns: OptionalUpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfNotSet(columns: UpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfNotSetIfValue(columns: OptionalUpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    ignoreIfSet(...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE>

    setIfHasValue(columns: UpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfHasValueIfValue(columns: OptionalUpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfHasNoValue(columns: UpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfHasNoValueIfValue(columns: OptionalUpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    ignoreIfHasValue(...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE>
    ignoreIfHasNoValue(...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE>
    ignoreAnySetWithNoValue(): ExecutableUpdateExpression<TABLE>

    dynamicWhere() : DynamicExecutableUpdateExpression<TABLE>
    where(condition: IIfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableUpdateExpression<TABLE>
    where(condition: IBooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableUpdateExpression<TABLE>
}

export interface NotExecutableUpdateExpression<TABLE extends ITableOrView<any>> extends UpdateExpressionBase<TABLE> {
    set(columns: UpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfValue(columns: OptionalUpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfSet(columns: UpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfSetIfValue(columns: OptionalUpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfNotSet(columns: UpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfNotSetIfValue(columns: OptionalUpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    ignoreIfSet(...columns: ColumnsForSetOf<TABLE>[]): NotExecutableUpdateExpression<TABLE>

    setIfHasValue(columns: UpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfHasValueIfValue(columns: OptionalUpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfHasNoValue(columns: UpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfHasNoValueIfValue(columns: OptionalUpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    ignoreIfHasValue(...columns: ColumnsForSetOf<TABLE>[]): NotExecutableUpdateExpression<TABLE>
    ignoreIfHasNoValue(...columns: ColumnsForSetOf<TABLE>[]): NotExecutableUpdateExpression<TABLE>
    ignoreAnySetWithNoValue(): NotExecutableUpdateExpression<TABLE>

    dynamicWhere() : DynamicExecutableUpdateExpression<TABLE>
    where(condition: IIfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableUpdateExpression<TABLE>
    where(condition: IBooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableUpdateExpression<TABLE>
}

export interface DynamicExecutableUpdateExpression<TABLE extends ITableOrView<any>> extends ReturnableExecutableUpdate<TABLE> {
    and(condition: IIfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableUpdateExpression<TABLE>
    and(condition: IBooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableUpdateExpression<TABLE>
    or(condition: IIfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableUpdateExpression<TABLE>
    or(condition: IBooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableUpdateExpression<TABLE>
}

export interface UpdateExpression<TABLE extends ITableOrView<any>> extends UpdateExpressionBase<TABLE> {
    dynamicSet(): NotExecutableUpdateExpression<TABLE>
    set(columns: UpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfValue(columns: OptionalUpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
}

export interface UpdateExpressionAllowingNoWhere<TABLE extends ITableOrView<any>> extends UpdateExpressionBase<TABLE> {
    dynamicSet(): ExecutableUpdateExpression<TABLE>
    set(columns: UpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfValue(columns: OptionalUpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
}

export type UpdateSets<TABLE extends ITableOrView<any>> = {
    [P in ColumnsForSetOf<TABLE>]?: InputTypeOfColumn<TABLE, P>
}

export type OptionalUpdateSets<TABLE extends ITableOrView<any>> = {
    [P in ColumnsForSetOf<TABLE>]?: InputTypeOfColumn<TABLE, P> | null | undefined
}

export interface ReturnableExecutableUpdate<TABLE extends ITableOrView<any>> extends CustomizableExecutableUpdate<TABLE> {
    returning: ReturningFnType<TABLE>
    returningOneColumn: ReturningOneColumnFnType<TABLE>
}

export interface ExecutableUpdateReturning<TABLE extends ITableOrView<any>, COLUMNS, RESULT> extends UpdateExpressionBase<TABLE> {
    executeUpdateNoneOrOne(): Promise<( COLUMNS extends IValueSource<any, any> ? RESULT : { [P in keyof RESULT]: RESULT[P] }) | null>
    executeUpdateOne(): Promise<( COLUMNS extends IValueSource<any, any> ? RESULT : { [P in keyof RESULT]: RESULT[P] })>
    executeUpdateMany(min?: number, max?: number): Promise<( COLUMNS extends IValueSource<any, any> ? RESULT : { [P in keyof RESULT]: RESULT[P] })[]>

    query(): string
    params(): any[]
}

export interface ComposableExecutableUpdate<TABLE extends ITableOrView<any>, COLUMNS, RESULT> extends ExecutableUpdateReturning<TABLE, COLUMNS, RESULT> {
    compose<EXTERNAL_PROP extends keyof RESULT & ColumnGuard<COLUMNS>, INTERNAL_PROP extends string, RESULT_PROP extends string>(config: {
        externalProperty: EXTERNAL_PROP,
        internalProperty: INTERNAL_PROP,
        propertyName: RESULT_PROP
    }): ComposeExpression<EXTERNAL_PROP, INTERNAL_PROP, RESULT_PROP, TABLE, COLUMNS, RESULT>
    composeDeletingInternalProperty<EXTERNAL_PROP extends keyof RESULT & ColumnGuard<COLUMNS>, INTERNAL_PROP extends string, RESULT_PROP extends string>(config: {
        externalProperty: EXTERNAL_PROP,
        internalProperty: INTERNAL_PROP,
        propertyName: RESULT_PROP
    }): ComposeExpressionDeletingInternalProperty<EXTERNAL_PROP, INTERNAL_PROP, RESULT_PROP, TABLE, COLUMNS, RESULT>
    composeDeletingExternalProperty<EXTERNAL_PROP extends keyof RESULT & ColumnGuard<COLUMNS>, INTERNAL_PROP extends string, RESULT_PROP extends string>(config: {
        externalProperty: EXTERNAL_PROP,
        internalProperty: INTERNAL_PROP,
        propertyName: RESULT_PROP
    }): ComposeExpressionDeletingExternalProperty<EXTERNAL_PROP, INTERNAL_PROP, RESULT_PROP, TABLE, COLUMNS, RESULT>

    // Note: { [Q in keyof SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] } is used to define the internal object because { [P in keyof MAPPING]: RESULT[MAPPING[P]] } doesn't respect the optional typing of the props
    splitRequired<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ComposableExecutableUpdate<TABLE, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & { [key in RESULT_PROP]: { [Q in keyof UpdateResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: UpdateResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }}>
    splitOptional<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ComposableExecutableUpdate<TABLE, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & { [key in RESULT_PROP]?: { [Q in keyof UpdateResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: UpdateResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }}>
    split<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ComposableExecutableUpdate<TABLE, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & ( {} extends UpdateResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }> ? { [key in RESULT_PROP]?: { [Q in keyof UpdateResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: UpdateResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }} : { [key in RESULT_PROP]: { [Q in keyof UpdateResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: UpdateResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }})>
  
    guidedSplitRequired<RESULT_PROP extends string, MAPPED_PROPS extends keyof GuidedObj<RESULT> & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ComposableExecutableUpdate<TABLE, COLUMNS, Omit<RESULT, GuidedPropName<ValueOf<MAPPING>>> & { [key in RESULT_PROP]: { [Q in keyof UpdateResult<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>]: UpdateResult<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>[Q] }}>
    guidedSplitOptional<RESULT_PROP extends string, MAPPED_PROPS extends keyof GuidedObj<RESULT> & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ComposableExecutableUpdate<TABLE, COLUMNS, Omit<RESULT, GuidedPropName<ValueOf<MAPPING>>> & { [key in RESULT_PROP]?: { [Q in keyof UpdateResult<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>]: UpdateResult<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>[Q] }}>
}

export interface ComposeExpression<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, TABLE extends ITableOrView<any>, COLUMNS, RESULT> {
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, RESULT & { [key in RESULT_PROP]?: INTERNAL }>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL } : { [key in RESULT_PROP]?: INTERNAL })>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL[] } : { [key in RESULT_PROP]?: INTERNAL[] })>
}
export interface ComposeExpressionDeletingInternalProperty<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, TABLE extends ITableOrView<any>, COLUMNS, RESULT> {
    // Note: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] } is used to delete the internal prop because Omit<INTERNAL, INTERNAL_PROP> is not expanded in the editor (when see the type)
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, RESULT & { [key in RESULT_PROP]?: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }}>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }} : { [key in RESULT_PROP]?: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }} )>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: Array<{ [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }> } : { [key in RESULT_PROP]?: Array<{ [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }> })>
}

export interface ComposeExpressionDeletingExternalProperty<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, TABLE extends ITableOrView<any>, COLUMNS, RESULT> {
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & { [key in RESULT_PROP]?: INTERNAL }>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL } : { [key in RESULT_PROP]?: INTERNAL })>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL[] } : { [key in RESULT_PROP]?: INTERNAL[] })>
}

export interface ComposableCustomizableExecutableUpdate<TABLE extends ITableOrView<any>, COLUMNS, RESULT> extends ComposableExecutableUpdate<TABLE, COLUMNS, RESULT> {
    customizeQuery(customization: UpdateCustomization<TABLE[typeof database]>): ComposableExecutableUpdate<TABLE, COLUMNS, RESULT>
}

type ReturningFnType<TABLE extends ITableOrView<any>> =
    TABLE[typeof database] extends (NoopDB | PostgreSql | SqlServer | Sqlite | Oracle) 
    ? <COLUMNS extends UpdateColumns<TABLE>>(columns: COLUMNS) => ComposableCustomizableExecutableUpdate<TABLE, COLUMNS, UpdateResult<ResultValues<COLUMNS>>>
    : never

type ReturningOneColumnFnType<TABLE extends ITableOrView<any>> =
    TABLE[typeof database] extends (NoopDB | PostgreSql | SqlServer | Sqlite | Oracle) 
    ? <COLUMN extends IValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]> | OLD<TABLE[typeof tableOrViewRef]>, any>>(column: COLUMN) => ComposableCustomizableExecutableUpdate<TABLE, COLUMN, FixUpdateOneResult<COLUMN[typeof valueType]>>
    : never

export type UpdateColumns<TABLE extends ITableOrView<any>> = {
    [P: string]: IValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]> | OLD<TABLE[typeof tableOrViewRef]>, any>
}

type ColumnGuard<T> = T extends null | undefined ? never : T extends never ? never : T extends IValueSource<any, any> ? never : unknown
type GuidedObj<T> = T & { [K in keyof T as K extends string | number ? `${K}!` : never]-?: NonNullable<T[K]>} & { [K in keyof T as K extends string | number ? `${K}?` : never]?: T[K]}
type GuidedPropName<T> = T extends `${infer Q}!` ? Q : T extends `${infer Q}?` ? Q : T
type ValueOf<T> = T[keyof T]
type RequiredKeys<T> = T extends IValueSource<any, any> ? never : { [K in keyof T]-?: {} extends Pick<T, K> ? never : K }[keyof T]

type UpdateResult<RESULT> = 
    undefined extends string ? RESULT // tsc is working with strict mode disabled. There is no way to infer the optional properties. Keep as required is a better approximation.
    : { [P in MandatoryPropertiesOf<RESULT>]: RESULT[P] } & { [P in OptionalPropertiesOf<RESULT>]?: NonNullable<RESULT[P]> }
type MandatoryPropertiesOf<TYPE> = ({ [K in keyof TYPE]-?: null | undefined extends TYPE[K] ? never : (null extends TYPE[K] ? never : (undefined extends TYPE[K] ? never : K)) })[keyof TYPE]
type OptionalPropertiesOf<TYPE> = ({ [K in keyof TYPE]-?: null | undefined extends TYPE[K] ? K : (null extends TYPE[K] ? K : (undefined extends TYPE[K] ? K : never)) })[keyof TYPE]
type FixUpdateOneResult<T> = T extends undefined ? null : T

type ResultValues<COLUMNS> = {
    [P in keyof COLUMNS]: ValueSourceResult<COLUMNS[P]>
}
type ValueSourceResult<T> = T extends IValueSource<any, infer R> ? R : never
