import type { IBooleanValueSource, IIfValueSource, IValueSource } from "./values"
import type { ITableOrView, NoTableOrViewRequired } from "../utils/ITableOrView"
import type { AnyDB, NoopDB, Oracle, PostgreSql, Sqlite, SqlServer, TypeSafeDB } from "../databases"
import type { int } from "ts-extended-types"
import type { database, tableOrView, tableOrViewRef, valueType } from "../utils/symbols"
import type { RawFragment } from "../utils/RawFragment"

export interface DeleteCustomization<DB extends AnyDB> {
    afterDeleteKeyword?: RawFragment<DB>
    afterQuery?: RawFragment<DB>
}

export interface DeleteExpressionOf<DB extends AnyDB> {
    [database]: DB
}

export interface DeleteExpressionBase<TABLE extends ITableOrView<any>> extends DeleteExpressionOf<TABLE[typeof database]> {
    [tableOrView]: TABLE
}

export interface ExecutableDelete<TABLE extends ITableOrView<any>> extends DeleteExpressionBase<TABLE> {
    executeDelete(this: DeleteExpressionOf<TypeSafeDB>, min?: number, max?: number): Promise<int>
    executeDelete(min?: number, max?: number): Promise<number>
    query(): string
    params(): any[]
}

export interface CustomizableExecutableDelete<TABLE extends ITableOrView<any>> extends ExecutableDelete<TABLE> {
    customizeQuery(customization: DeleteCustomization<TABLE[typeof database]>): ExecutableDelete<TABLE>
}

export interface DynamicExecutableDeleteExpression<TABLE extends ITableOrView<any>> extends ReturnableExecutableDelete<TABLE> {
    and(condition: IIfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
    and(condition: IBooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
    or(condition: IIfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
    or(condition: IBooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
}

export interface DeleteExpression<TABLE extends ITableOrView<any>> extends DeleteExpressionBase<TABLE> {
    dynamicWhere() : DynamicExecutableDeleteExpression<TABLE>
    where(condition: IIfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
    where(condition: IBooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
}

export interface DeleteExpressionAllowingNoWhere<TABLE extends ITableOrView<any>> extends ReturnableExecutableDelete<TABLE> {
    dynamicWhere() : DynamicExecutableDeleteExpression<TABLE>
    where(condition: IIfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
    where(condition: IBooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
}

export interface ReturnableExecutableDelete<TABLE extends ITableOrView<any>> extends CustomizableExecutableDelete<TABLE> {
    returning: ReturningFnType<TABLE>
    returningOneColumn: ReturningOneColumnFnType<TABLE>
}

export interface ExecutableDeleteReturning<TABLE extends ITableOrView<any>, COLUMNS, RESULT> extends DeleteExpressionBase<TABLE> {
    executeDeleteNoneOrOne(): Promise<( COLUMNS extends IValueSource<any, any> ? RESULT : { [P in keyof RESULT]: RESULT[P] }) | null>
    executeDeleteOne(): Promise<( COLUMNS extends IValueSource<any, any> ? RESULT : { [P in keyof RESULT]: RESULT[P] })>
    executeDeleteMany(min?: number, max?: number): Promise<( COLUMNS extends IValueSource<any, any> ? RESULT : { [P in keyof RESULT]: RESULT[P] })[]>

    query(): string
    params(): any[]
}

export interface ComposableExecutableDelete<TABLE extends ITableOrView<any>, COLUMNS, RESULT> extends ExecutableDeleteReturning<TABLE, COLUMNS, RESULT> {
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
    splitRequired<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ComposableExecutableDelete<TABLE, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & { [key in RESULT_PROP]: { [Q in keyof DeleteResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: DeleteResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }}>
    splitOptional<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ComposableExecutableDelete<TABLE, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & { [key in RESULT_PROP]?: { [Q in keyof DeleteResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: DeleteResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }}>
    split<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ComposableExecutableDelete<TABLE, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & ( {} extends DeleteResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }> ? { [key in RESULT_PROP]?: { [Q in keyof DeleteResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: DeleteResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }} : { [key in RESULT_PROP]: { [Q in keyof DeleteResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: DeleteResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }})>
  
    guidedSplitRequired<RESULT_PROP extends string, MAPPED_PROPS extends keyof GuidedObj<RESULT> & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ComposableExecutableDelete<TABLE, COLUMNS, Omit<RESULT, GuidedPropName<ValueOf<MAPPING>>> & { [key in RESULT_PROP]: { [Q in keyof DeleteResult<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>]: DeleteResult<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>[Q] }}>
    guidedSplitOptional<RESULT_PROP extends string, MAPPED_PROPS extends keyof GuidedObj<RESULT> & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ComposableExecutableDelete<TABLE, COLUMNS, Omit<RESULT, GuidedPropName<ValueOf<MAPPING>>> & { [key in RESULT_PROP]?: { [Q in keyof DeleteResult<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>]: DeleteResult<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>[Q] }}>
}

export interface ComposeExpression<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, TABLE extends ITableOrView<any>, COLUMNS, RESULT> {
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ComposableExecutableDelete<TABLE, COLUMNS, RESULT & { [key in RESULT_PROP]?: INTERNAL }>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ComposableExecutableDelete<TABLE, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL } : { [key in RESULT_PROP]?: INTERNAL })>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ComposableExecutableDelete<TABLE, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL[] } : { [key in RESULT_PROP]?: INTERNAL[] })>
}
export interface ComposeExpressionDeletingInternalProperty<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, TABLE extends ITableOrView<any>, COLUMNS, RESULT> {
    // Note: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] } is used to delete the internal prop because Omit<INTERNAL, INTERNAL_PROP> is not expanded in the editor (when see the type)
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ComposableExecutableDelete<TABLE, COLUMNS, RESULT & { [key in RESULT_PROP]?: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }}>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ComposableExecutableDelete<TABLE, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }} : { [key in RESULT_PROP]?: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }} )>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ComposableExecutableDelete<TABLE, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: Array<{ [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }> } : { [key in RESULT_PROP]?: Array<{ [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }> })>
}

export interface ComposeExpressionDeletingExternalProperty<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, TABLE extends ITableOrView<any>, COLUMNS, RESULT> {
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ComposableExecutableDelete<TABLE, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & { [key in RESULT_PROP]?: INTERNAL }>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ComposableExecutableDelete<TABLE, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL } : { [key in RESULT_PROP]?: INTERNAL })>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ComposableExecutableDelete<TABLE, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL[] } : { [key in RESULT_PROP]?: INTERNAL[] })>
}

export interface ComposableCustomizableExecutableDelete<TABLE extends ITableOrView<any>, COLUMNS, RESULT> extends ComposableExecutableDelete<TABLE, COLUMNS, RESULT> {
    customizeQuery(customization: DeleteCustomization<TABLE[typeof database]>): ComposableExecutableDelete<TABLE, COLUMNS, RESULT>
}

type ReturningFnType<TABLE extends ITableOrView<any>> =
    TABLE[typeof database] extends (NoopDB | PostgreSql | SqlServer | Sqlite | Oracle) 
    ? <COLUMNS extends DeleteColumns<TABLE>>(columns: COLUMNS) => ComposableCustomizableExecutableDelete<TABLE, COLUMNS, DeleteResult<ResultValues<COLUMNS>>>
    : never

type ReturningOneColumnFnType<TABLE extends ITableOrView<any>> =
    TABLE[typeof database] extends (NoopDB | PostgreSql | SqlServer | Sqlite | Oracle) 
    ? <COLUMN extends IValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>>(column: COLUMN) => ComposableCustomizableExecutableDelete<TABLE, COLUMN, FixDeleteOneResult<COLUMN[typeof valueType]>>
    : never

export type DeleteColumns<TABLE extends ITableOrView<any>> = {
    [P: string]: IValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>
}

type ColumnGuard<T> = T extends null | undefined ? never : T extends never ? never : T extends IValueSource<any, any> ? never : unknown
type GuidedObj<T> = T & { [K in keyof T as K extends string | number ? `${K}!` : never]-?: NonNullable<T[K]>} & { [K in keyof T as K extends string | number ? `${K}?` : never]?: T[K]}
type GuidedPropName<T> = T extends `${infer Q}!` ? Q : T extends `${infer Q}?` ? Q : T
type ValueOf<T> = T[keyof T]
type RequiredKeys<T> = T extends IValueSource<any, any> ? never : { [K in keyof T]-?: {} extends Pick<T, K> ? never : K }[keyof T]

type DeleteResult<RESULT> = 
    undefined extends string ? RESULT // tsc is working with strict mode disabled. There is no way to infer the optional properties. Keep as required is a better approximation.
    : { [P in MandatoryPropertiesOf<RESULT>]: RESULT[P] } & { [P in OptionalPropertiesOf<RESULT>]?: NonNullable<RESULT[P]> }
type MandatoryPropertiesOf<TYPE> = ({ [K in keyof TYPE]-?: null | undefined extends TYPE[K] ? never : (null extends TYPE[K] ? never : (undefined extends TYPE[K] ? never : K)) })[keyof TYPE]
type OptionalPropertiesOf<TYPE> = ({ [K in keyof TYPE]-?: null | undefined extends TYPE[K] ? K : (null extends TYPE[K] ? K : (undefined extends TYPE[K] ? K : never)) })[keyof TYPE]
type FixDeleteOneResult<T> = T extends undefined ? null : T

type ResultValues<COLUMNS> = {
    [P in keyof COLUMNS]: ValueSourceResult<COLUMNS[P]>
}
type ValueSourceResult<T> = T extends IValueSource<any, infer R> ? R : never