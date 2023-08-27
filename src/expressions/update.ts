import type { AnyValueSource, IBooleanValueSource, IExecutableUpdateQuery, IIfValueSource, RemapIValueSourceType, RemapIValueSourceTypeWithOptionalType, ValueSourceOf, ValueSourceValueType, ValueSourceValueTypeForResult } from "./values"
import type { ITable, ITableOrView, ITableOrViewOf, NoTableOrViewRequired, OLD, OuterJoinSource, ResolvedShape } from "../utils/ITableOrView"
import type { AnyDB, MariaDB, MySql, NoopDB, Oracle, PostgreSql, Sqlite, SqlServer, TypeSafeDB } from "../databases"
import type { int } from "ts-extended-types"
import type { database, tableOrView, tableOrViewRef } from "../utils/symbols"
import type { RawFragment } from "../utils/RawFragment"
import type { ColumnsForSetOf, ColumnsForSetOfWithShape, ColumnsOf, OptionalColumnsForSetOf, OuterJoinTableOrView, RequiredColumnsForSetOf, ResolveShape } from "../utils/tableOrViewUtils"
import type { Column, ColumnWithDefaultValue } from "../utils/Column"
import type { Default } from "./Default"
import type { ColumnGuard, GuidedObj, GuidedPropName, RequiredKeysOfPickingColumns, ResultObjectValues, FixOptionalProperties, ValueOf, ResultObjectValuesProjectedAsNullable } from "../utils/resultUtils"

export interface UpdateCustomization<DB extends AnyDB> {
    afterUpdateKeyword?: RawFragment<DB>
    beforeQuery?: RawFragment<DB>
    afterQuery?: RawFragment<DB>
}

export interface UpdateExpressionOf<DB extends AnyDB> {
    [database]: DB
}

export interface UpdateExpressionBase<TABLE extends ITableOrView<any>> extends UpdateExpressionOf<TABLE[typeof database]> {
    [tableOrView]: TABLE
}

export interface ExecutableUpdate<TABLE extends ITableOrView<any>> extends UpdateExpressionBase<TABLE>, IExecutableUpdateQuery<TABLE, number> {
    executeUpdate(this: UpdateExpressionOf<TypeSafeDB>, min?: number, max?: number): Promise<int>
    executeUpdate(min?: number, max?: number): Promise<number>
    query(): string
    params(): any[]
}

export interface CustomizableExecutableUpdate<TABLE extends ITableOrView<any>> extends ExecutableUpdate<TABLE> {
    customizeQuery(customization: UpdateCustomization<TABLE[typeof database]>): ExecutableUpdate<TABLE>
}

export interface ExecutableUpdateExpression<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends ReturnableExecutableUpdate<TABLE, USING> {
    set(columns: UpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    setIfValue(columns: OptionalUpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    setIfSet(columns: UpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    setIfSetIfValue(columns: OptionalUpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    setIfNotSet(columns: UpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    setIfNotSetIfValue(columns: OptionalUpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    ignoreIfSet(...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    keepOnly(...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>

    setIfHasValue(columns: UpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    setIfHasValueIfValue(columns: OptionalUpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    setIfHasNoValue(columns: UpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    setIfHasNoValueIfValue(columns: OptionalUpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    ignoreIfHasValue(...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    ignoreIfHasNoValue(...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    ignoreAnySetWithNoValue(): ExecutableUpdateExpression<TABLE, USING>

    disallowIfSet(errorMessage: string, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    disallowIfSet(error: Error, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    disallowIfNotSet(errorMessage: string, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    disallowIfNotSet(error: Error, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    disallowIfValue(errorMessage: string, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    disallowIfValue(error: Error, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    disallowIfNoValue(errorMessage: string, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    disallowIfNoValue(error: Error, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    disallowAnyOtherSet(errorMessage: string, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    disallowAnyOtherSet(error: Error, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>

    setWhen(when: boolean, columns: UpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    setIfValueWhen(when: boolean, columns: OptionalUpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    setIfSetWhen(when: boolean, columns: UpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    setIfSetIfValueWhen(when: boolean, columns: OptionalUpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    setIfNotSetWhen(when: boolean, columns: UpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    setIfNotSetIfValueWhen(when: boolean, columns: OptionalUpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    ignoreIfSetWhen(when: boolean, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    keepOnlyWhen(when: boolean, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>

    setIfHasValueWhen(when: boolean, columns: UpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    setIfHasValueIfValueWhen(when: boolean, columns: OptionalUpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    setIfHasNoValueWhen(when: boolean, columns: UpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    setIfHasNoValueIfValueWhen(when: boolean, columns: OptionalUpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    ignoreIfHasValueWhen(when: boolean, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    ignoreIfHasNoValueWhen(when: boolean, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    ignoreAnySetWithNoValueWhen(when: boolean): ExecutableUpdateExpression<TABLE, USING>

    disallowIfSetWhen(when: boolean, errorMessage: string, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    disallowIfSetWhen(when: boolean, error: Error, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    disallowIfNotSetWhen(when: boolean, errorMessage: string, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    disallowIfNotSetWhen(when: boolean, error: Error, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    disallowIfValueWhen(when: boolean, errorMessage: string, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    disallowIfValueWhen(when: boolean, error: Error, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    disallowIfNoValueWhen(when: boolean, errorMessage: string, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    disallowIfNoValueWhen(when: boolean, error: Error, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    disallowAnyOtherSetWhen(when: boolean, errorMessage: string, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>
    disallowAnyOtherSetWhen(when: boolean, error: Error, ...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE, USING>

    dynamicWhere() : DynamicExecutableUpdateExpression<TABLE, USING>
    where(condition: IIfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicExecutableUpdateExpression<TABLE, USING>
    where(condition: IBooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicExecutableUpdateExpression<TABLE, USING>
}

export interface ShapedExecutableUpdateExpression<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>, SHAPE> extends ReturnableExecutableUpdate<TABLE, USING> {
    extendShape<EXTEND_SHAPE extends UpdateShape<TABLE, USING>>(shape: EXTEND_SHAPE): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE & ResolveShape<TABLE, EXTEND_SHAPE>>
    set(columns: UpdateSets<TABLE, USING, SHAPE>): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
    setIfValue(columns: OptionalUpdateSets<TABLE, USING, SHAPE>): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
    setIfSet(columns: UpdateSets<TABLE, USING, SHAPE>): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
    setIfSetIfValue(columns: OptionalUpdateSets<TABLE, USING, SHAPE>): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
    setIfNotSet(columns: UpdateSets<TABLE, USING, SHAPE>): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
    setIfNotSetIfValue(columns: OptionalUpdateSets<TABLE, USING, SHAPE>): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
    ignoreIfSet(...columns: ColumnsForSetOfWithShape<TABLE, SHAPE>[]): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
    keepOnly(...columns: ColumnsForSetOfWithShape<TABLE, SHAPE>[]): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>

    setIfHasValue(columns: UpdateSets<TABLE, USING, SHAPE>): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
    setIfHasValueIfValue(columns: OptionalUpdateSets<TABLE, USING, SHAPE>): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
    setIfHasNoValue(columns: UpdateSets<TABLE, USING, SHAPE>): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
    setIfHasNoValueIfValue(columns: OptionalUpdateSets<TABLE, USING, SHAPE>): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
    ignoreIfHasValue(...columns: ColumnsForSetOfWithShape<TABLE, SHAPE>[]): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
    ignoreIfHasNoValue(...columns: ColumnsForSetOfWithShape<TABLE, SHAPE>[]): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
    ignoreAnySetWithNoValue(): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>

    dynamicWhere() : DynamicExecutableUpdateExpression<TABLE, USING>
    where(condition: IIfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicExecutableUpdateExpression<TABLE, USING>
    where(condition: IBooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicExecutableUpdateExpression<TABLE, USING>
}

export interface NotExecutableUpdateExpression<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends UpdateExpressionBase<TABLE> {
    set(columns: UpdateSets<TABLE, USING, undefined>): NotExecutableUpdateExpression<TABLE, USING>
    setIfValue(columns: OptionalUpdateSets<TABLE, USING, undefined>): NotExecutableUpdateExpression<TABLE, USING>
    setIfSet(columns: UpdateSets<TABLE, USING, undefined>): NotExecutableUpdateExpression<TABLE, USING>
    setIfSetIfValue(columns: OptionalUpdateSets<TABLE, USING, undefined>): NotExecutableUpdateExpression<TABLE, USING>
    setIfNotSet(columns: UpdateSets<TABLE, USING, undefined>): NotExecutableUpdateExpression<TABLE, USING>
    setIfNotSetIfValue(columns: OptionalUpdateSets<TABLE, USING, undefined>): NotExecutableUpdateExpression<TABLE, USING>
    ignoreIfSet(...columns: ColumnsForSetOf<TABLE>[]): NotExecutableUpdateExpression<TABLE, USING>
    keepOnly(...columns: ColumnsForSetOf<TABLE>[]): NotExecutableUpdateExpression<TABLE, USING>

    setIfHasValue(columns: UpdateSets<TABLE, USING, undefined>): NotExecutableUpdateExpression<TABLE, USING>
    setIfHasValueIfValue(columns: OptionalUpdateSets<TABLE, USING, undefined>): NotExecutableUpdateExpression<TABLE, USING>
    setIfHasNoValue(columns: UpdateSets<TABLE, USING, undefined>): NotExecutableUpdateExpression<TABLE, USING>
    setIfHasNoValueIfValue(columns: OptionalUpdateSets<TABLE, USING, undefined>): NotExecutableUpdateExpression<TABLE, USING>
    ignoreIfHasValue(...columns: ColumnsForSetOf<TABLE>[]): NotExecutableUpdateExpression<TABLE, USING>
    ignoreIfHasNoValue(...columns: ColumnsForSetOf<TABLE>[]): NotExecutableUpdateExpression<TABLE, USING>
    ignoreAnySetWithNoValue(): NotExecutableUpdateExpression<TABLE, USING>

    dynamicWhere() : DynamicExecutableUpdateExpression<TABLE, USING>
    where(condition: IIfValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicExecutableUpdateExpression<TABLE, USING>
    where(condition: IBooleanValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicExecutableUpdateExpression<TABLE, USING>
}

export interface ShapedNotExecutableUpdateExpression<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>, SHAPE> extends UpdateExpressionBase<TABLE> {
    extendShape<EXTEND_SHAPE extends UpdateShape<TABLE, USING>>(shape: EXTEND_SHAPE): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE & ResolveShape<TABLE, EXTEND_SHAPE>>
    set(columns: UpdateSets<TABLE, USING, SHAPE>): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
    setIfValue(columns: OptionalUpdateSets<TABLE, USING, SHAPE>): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
    setIfSet(columns: UpdateSets<TABLE, USING, SHAPE>): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
    setIfSetIfValue(columns: OptionalUpdateSets<TABLE, USING, SHAPE>): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
    setIfNotSet(columns: UpdateSets<TABLE, USING, SHAPE>): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
    setIfNotSetIfValue(columns: OptionalUpdateSets<TABLE, USING, SHAPE>): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
    ignoreIfSet(...columns: ColumnsForSetOfWithShape<TABLE, SHAPE>[]): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
    keepOnly(...columns: ColumnsForSetOfWithShape<TABLE, SHAPE>[]): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>

    setIfHasValue(columns: UpdateSets<TABLE, USING, SHAPE>): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
    setIfHasValueIfValue(columns: OptionalUpdateSets<TABLE, USING, SHAPE>): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
    setIfHasNoValue(columns: UpdateSets<TABLE, USING, SHAPE>): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
    setIfHasNoValueIfValue(columns: OptionalUpdateSets<TABLE, USING, SHAPE>): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
    ignoreIfHasValue(...columns: ColumnsForSetOfWithShape<TABLE, SHAPE>[]): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
    ignoreIfHasNoValue(...columns: ColumnsForSetOfWithShape<TABLE, SHAPE>[]): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
    ignoreAnySetWithNoValue(): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>

    dynamicWhere() : DynamicExecutableUpdateExpression<TABLE, USING>
    where(condition: IIfValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicExecutableUpdateExpression<TABLE, USING>
    where(condition: IBooleanValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicExecutableUpdateExpression<TABLE, USING>
}

export interface DynamicExecutableUpdateExpression<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends ReturnableExecutableUpdate<TABLE, USING> {
    and(condition: IIfValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicExecutableUpdateExpression<TABLE, USING>
    and(condition: IBooleanValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicExecutableUpdateExpression<TABLE, USING>
    or(condition: IIfValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicExecutableUpdateExpression<TABLE, USING>
    or(condition: IBooleanValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicExecutableUpdateExpression<TABLE, USING>
}

export interface UpdateSetExpression<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends UpdateExpressionBase<TABLE> {
    shapedAs<SHAPE extends UpdateShape<TABLE, USING>>(shape: SHAPE): ShapedUpdateSetExpression<TABLE, USING, ResolveShape<TABLE, SHAPE>>
    dynamicSet(): NotExecutableUpdateExpression<TABLE, USING>
    dynamicSet(columns: UpdateSets<TABLE, USING, undefined>): NotExecutableUpdateExpression<TABLE, USING>
    set(columns: UpdateSets<TABLE, USING, undefined>): NotExecutableUpdateExpression<TABLE, USING>
    setIfValue(columns: OptionalUpdateSets<TABLE, USING, undefined>): NotExecutableUpdateExpression<TABLE, USING>
}

export interface ShapedUpdateSetExpression<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>, SHAPE> extends UpdateExpressionBase<TABLE> {
    extendShape<EXTEND_SHAPE extends UpdateShape<TABLE, USING>>(shape: EXTEND_SHAPE): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE & ResolveShape<TABLE, EXTEND_SHAPE>>
    dynamicSet(): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
    dynamicSet(columns: UpdateSets<TABLE, USING, SHAPE>): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
    set(columns: UpdateSets<TABLE, USING, SHAPE>): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
    setIfValue(columns: OptionalUpdateSets<TABLE, USING, SHAPE>): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
}

export interface UpdateExpression<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends UpdateSetExpression<TABLE, USING> {
    from: FromFnType<TABLE, USING>
    join: OnExpressionFnType<TABLE, USING>
    innerJoin: OnExpressionFnType<TABLE, USING>
    leftJoin: OuterJoinOnExpressionFnType<TABLE, USING>
    leftOuterJoin: OuterJoinOnExpressionFnType<TABLE, USING>
}

export interface UpdateSetExpressionAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends UpdateExpressionBase<TABLE> {
    shapedAs<SHAPE extends UpdateShape<TABLE, USING>>(shape: SHAPE): ShapedUpdateSetExpressionAllowingNoWhere<TABLE, USING, ResolveShape<TABLE, SHAPE>>
    dynamicSet(): ExecutableUpdateExpression<TABLE, USING>
    dynamicSet(columns: UpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    set(columns: UpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    setIfValue(columns: OptionalUpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
}

export interface ShapedUpdateSetExpressionAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>, SHAPE> extends UpdateExpressionBase<TABLE> {
    extendShape<EXTEND_SHAPE extends UpdateShape<TABLE, USING>>(shape: EXTEND_SHAPE): ShapedUpdateSetExpressionAllowingNoWhere<TABLE, USING, SHAPE & ResolveShape<TABLE, EXTEND_SHAPE>>
    dynamicSet(): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
    dynamicSet(columns: UpdateSets<TABLE, USING, SHAPE>): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
    set(columns: UpdateSets<TABLE, USING, SHAPE>): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
    setIfValue(columns: OptionalUpdateSets<TABLE, USING, SHAPE>): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
}

export interface UpdateExpressionAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends UpdateSetExpressionAllowingNoWhere<TABLE, USING> {
    from: FromFnTypeAllowingNoWhere<TABLE, USING>
    join: OnExpressionFnTypeAllowingNoWhere<TABLE, USING>
    innerJoin: OnExpressionFnTypeAllowingNoWhere<TABLE, USING>
    leftJoin: OuterJoinOnExpressionFnTypeAllowingNoWhere<TABLE, USING>
    leftOuterJoin: OuterJoinOnExpressionFnTypeAllowingNoWhere<TABLE, USING>
}

export type UpdateSets<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>, SHAPE> = 
    SHAPE extends ResolvedShape<TABLE>
    ? (
        {
            [P in RequiredColumnsForSetOf<SHAPE>]?: InputTypeOfColumnAllowing<SHAPE, P, USING>
        } & {
            [P in OptionalColumnsForSetOf<SHAPE >]?: InputTypeOfOptionalColumnAllowing<SHAPE, P, USING>
        }
    ): (
        {
            [P in RequiredColumnsForSetOf<TABLE>]?: InputTypeOfColumnAllowing<TABLE, P, USING>
        } & {
            [P in OptionalColumnsForSetOf<TABLE>]?: InputTypeOfOptionalColumnAllowing<TABLE, P, USING>
        }
    )

export type UpdateValues<TABLE extends ITableOrView<any>, SHAPE> = 
    SHAPE extends ResolvedShape<TABLE> 
    ? (
        {
            [P in RequiredColumnsForSetOf<SHAPE>]?: ValueSourceValueType<SHAPE[P]>
        } & {
            [P in OptionalColumnsForSetOf<SHAPE>]?: ValueSourceValueType<SHAPE[P]>
        }
    ): (
        {
            [P in RequiredColumnsForSetOf<TABLE>]?: ValueSourceValueType<TABLE[P]>
        } & {
            [P in OptionalColumnsForSetOf<TABLE>]?: ValueSourceValueType<TABLE[P]>
        }
    )

export type UpdateShape<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> = 
    TABLE[typeof database] extends (NoopDB | MariaDB | MySql)
    ? {
        [key: string]: ValueSourceOf<FilterTables<USING>[typeof tableOrViewRef]> & Column | ColumnsForSetOf<TABLE>
    } : {
        [key: string]: ValueSourceOf<TABLE[typeof tableOrViewRef]> & Column | ColumnsForSetOf<TABLE>
    }

type FilterTables<USING extends ITableOrView<any>> = USING extends ITable<any> ? USING : never

export type OptionalUpdateSets<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>, SHAPE> = 
    SHAPE extends ResolvedShape<TABLE>
    ? (
        {
            [P in RequiredColumnsForSetOf<SHAPE>]?: InputTypeOfColumnAllowing<SHAPE, P, USING> | null | undefined
        } & {
            [P in OptionalColumnsForSetOf<SHAPE>]?: InputTypeOfOptionalColumnAllowing<SHAPE, P, USING> | null | undefined
        }
    ) : (
        {
            [P in RequiredColumnsForSetOf<TABLE>]?: InputTypeOfColumnAllowing<TABLE, P, USING> | null | undefined
        } & {
            [P in OptionalColumnsForSetOf<TABLE>]?: InputTypeOfOptionalColumnAllowing<TABLE, P, USING> | null | undefined
        }
    )

type InputTypeOfColumnAllowing<TABLE extends ITableOrView<any>, K extends ColumnsOf<TABLE>, ALLOWING extends ITableOrView<any>> =
    TABLE[K] extends ValueSourceOf<TABLE[typeof tableOrViewRef]> ?
    (TABLE[K] extends ColumnWithDefaultValue ? (
        ValueSourceValueType<TABLE[K]> | RemapIValueSourceType<ALLOWING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, TABLE[K]> | Default
    ) : (
        ValueSourceValueType<TABLE[K]> | RemapIValueSourceType<ALLOWING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, TABLE[K]>
    ))
    : never

type InputTypeOfOptionalColumnAllowing<TABLE extends ITableOrView<any>, K extends ColumnsOf<TABLE>, ALLOWING extends ITableOrView<any>> =
    TABLE[K] extends ValueSourceOf<TABLE[typeof tableOrViewRef]> ?
    (TABLE[K] extends ColumnWithDefaultValue ? (
        ValueSourceValueType<TABLE[K]> | RemapIValueSourceTypeWithOptionalType<ALLOWING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, TABLE[K], any> | Default
    ) : (
        ValueSourceValueType<TABLE[K]> | RemapIValueSourceTypeWithOptionalType<ALLOWING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, TABLE[K], any>
    ))
    : never


export interface UpdateSetJoinExpression<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends UpdateSetExpression<TABLE, USING> {
    join<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2): OnExpression<TABLE, USING | TABLE_OR_VIEW2>
    innerJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2): OnExpression<TABLE, USING | TABLE_OR_VIEW2>
    leftJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>): OnExpression<TABLE, USING | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>>
    leftOuterJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>): OnExpression<TABLE, USING | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>>
}

export interface DynamicOnExpression<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends UpdateSetJoinExpression<TABLE, USING> {
    and(condition: IIfValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpression<TABLE, USING>
    and(condition: IBooleanValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpression<TABLE, USING>
    or(condition: IIfValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpression<TABLE, USING>
    or(condition: IBooleanValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpression<TABLE, USING>
}

export interface OnExpression<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends UpdateSetJoinExpression<TABLE, USING> {
    dynamicOn(): DynamicOnExpression<TABLE, USING>
    on(condition: IIfValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpression<TABLE, USING>
    on(condition: IBooleanValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpression<TABLE, USING>
}

export interface UpdateExpressionWithoutJoin<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends UpdateSetExpression<TABLE, USING> {
    from<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2): UpdateExpressionWithoutJoin<TABLE, USING | TABLE_OR_VIEW2>
}

export interface UpdateFromExpression<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends UpdateSetJoinExpression<TABLE, USING> {
    from<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2): UpdateExpressionWithoutJoin<TABLE, USING | TABLE_OR_VIEW2>
}

type FromFnType<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> =
    TABLE[typeof database] extends (NoopDB | PostgreSql | SqlServer | Sqlite | MariaDB | MySql)
    ? <TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2) => UpdateFromExpression<TABLE, USING | TABLE_OR_VIEW2>
    : never

type OnExpressionFnType<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> =
    TABLE[typeof database] extends (NoopDB | MariaDB | MySql)
    ? <TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2) => OnExpression<TABLE, USING | TABLE_OR_VIEW2>
    : never

type OuterJoinOnExpressionFnType<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> =
    TABLE[typeof database] extends (NoopDB | MariaDB | MySql)
    ? <TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>) => OnExpression<TABLE, USING | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>>
    : never





export interface UpdateSetJoinExpressionAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends UpdateSetExpressionAllowingNoWhere<TABLE, USING> {
    join<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2): OnExpressionAllowingNoWhere<TABLE, USING | TABLE_OR_VIEW2>
    innerJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2): OnExpressionAllowingNoWhere<TABLE, USING | TABLE_OR_VIEW2>
    leftJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>): OnExpressionAllowingNoWhere<TABLE, USING | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>>
    leftOuterJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>): OnExpressionAllowingNoWhere<TABLE, USING | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>>
}

export interface DynamicOnExpressionAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends UpdateSetJoinExpressionAllowingNoWhere<TABLE, USING> {
    and(condition: IIfValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
    and(condition: IBooleanValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
    or(condition: IIfValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
    or(condition: IBooleanValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
}

export interface OnExpressionAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends UpdateSetJoinExpressionAllowingNoWhere<TABLE, USING> {
    dynamicOn(): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
    on(condition: IIfValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
    on(condition: IBooleanValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
}

export interface UpdateExpressionWithoutJoinAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends UpdateSetExpressionAllowingNoWhere<TABLE, USING> {
    from<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2): UpdateExpressionWithoutJoinAllowingNoWhere<TABLE, USING | TABLE_OR_VIEW2>
}

export interface UpdateFromExpressionAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends UpdateSetJoinExpressionAllowingNoWhere<TABLE, USING> {
    from<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2): UpdateExpressionWithoutJoinAllowingNoWhere<TABLE, USING | TABLE_OR_VIEW2>
}

type FromFnTypeAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> =
    TABLE[typeof database] extends (NoopDB | PostgreSql | SqlServer | Sqlite | MariaDB | MySql)
    ? <TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2) => UpdateFromExpressionAllowingNoWhere<TABLE, USING | TABLE_OR_VIEW2>
    : never

type OnExpressionFnTypeAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> =
    TABLE[typeof database] extends (NoopDB | MariaDB | MySql)
    ? <TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2) => OnExpressionAllowingNoWhere<TABLE, USING | TABLE_OR_VIEW2>
    : never

type OuterJoinOnExpressionFnTypeAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> =
    TABLE[typeof database] extends (NoopDB | MariaDB | MySql)
    ? <TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>) => OnExpressionAllowingNoWhere<TABLE, USING | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>>
    : never





export interface ReturnableExecutableUpdate<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends CustomizableExecutableUpdate<TABLE> {
    returning: ReturningFnType<TABLE, USING>
    returningOneColumn: ReturningOneColumnFnType<TABLE, USING>
}

export interface ExecutableUpdateReturning<TABLE extends ITableOrView<any>, COLUMNS, RESULT> extends UpdateExpressionBase<TABLE>, IExecutableUpdateQuery<TABLE, RESULT> {
    executeUpdateNoneOrOne(): Promise<( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] }) | null>
    executeUpdateOne(): Promise<( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] })>
    executeUpdateMany(min?: number, max?: number): Promise<( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] })[]>

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
    splitRequired<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ComposableExecutableUpdate<TABLE, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & { [key in RESULT_PROP]: { [Q in keyof FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }}>
    splitOptional<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ComposableExecutableUpdate<TABLE, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & { [key in RESULT_PROP]?: { [Q in keyof FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }}>
    split<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ComposableExecutableUpdate<TABLE, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & ( {} extends FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }> ? { [key in RESULT_PROP]?: { [Q in keyof FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }} : { [key in RESULT_PROP]: { [Q in keyof FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }})>

    guidedSplitRequired<RESULT_PROP extends string, MAPPED_PROPS extends keyof GuidedObj<RESULT> & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ComposableExecutableUpdate<TABLE, COLUMNS, Omit<RESULT, GuidedPropName<ValueOf<MAPPING>>> & { [key in RESULT_PROP]: { [Q in keyof FixOptionalProperties<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>]: FixOptionalProperties<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>[Q] }}>
    guidedSplitOptional<RESULT_PROP extends string, MAPPED_PROPS extends keyof GuidedObj<RESULT> & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ComposableExecutableUpdate<TABLE, COLUMNS, Omit<RESULT, GuidedPropName<ValueOf<MAPPING>>> & { [key in RESULT_PROP]?: { [Q in keyof FixOptionalProperties<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>]: FixOptionalProperties<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>[Q] }}>
}

export interface ComposeExpression<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, TABLE extends ITableOrView<any>, COLUMNS, RESULT> {
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, RESULT & { [key in RESULT_PROP]?: INTERNAL }>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeysOfPickingColumns<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL } : { [key in RESULT_PROP]?: INTERNAL })>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeysOfPickingColumns<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL[] } : { [key in RESULT_PROP]?: INTERNAL[] })>
    withOptionalMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, RESULT & { [key in RESULT_PROP]?: INTERNAL[] }>
}
export interface ComposeExpressionDeletingInternalProperty<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, TABLE extends ITableOrView<any>, COLUMNS, RESULT> {
    // Note: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] } is used to delete the internal prop because Omit<INTERNAL, INTERNAL_PROP> is not expanded in the editor (when see the type)
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, RESULT & { [key in RESULT_PROP]?: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }}>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeysOfPickingColumns<COLUMNS> ? { [key in RESULT_PROP]: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }} : { [key in RESULT_PROP]?: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }} )>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeysOfPickingColumns<COLUMNS> ? { [key in RESULT_PROP]: Array<{ [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }> } : { [key in RESULT_PROP]?: Array<{ [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }> })>
    withOptionalMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, RESULT & { [key in RESULT_PROP]?: Array<{ [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }> }>
}

export interface ComposeExpressionDeletingExternalProperty<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, TABLE extends ITableOrView<any>, COLUMNS, RESULT> {
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & { [key in RESULT_PROP]?: INTERNAL }>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & ( EXTERNAL_PROP extends RequiredKeysOfPickingColumns<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL } : { [key in RESULT_PROP]?: INTERNAL })>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & ( EXTERNAL_PROP extends RequiredKeysOfPickingColumns<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL[] } : { [key in RESULT_PROP]?: INTERNAL[] })>
    withOptionalMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ComposableExecutableUpdate<TABLE, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & { [key in RESULT_PROP]?: INTERNAL[] }>
}

export interface ComposableCustomizableExecutableUpdate<TABLE extends ITableOrView<any>, COLUMNS, RESULT> extends ComposableExecutableUpdate<TABLE, COLUMNS, RESULT> {
    customizeQuery(customization: UpdateCustomization<TABLE[typeof database]>): ComposableExecutableUpdate<TABLE, COLUMNS, RESULT>
}

export interface ComposableCustomizableExecutableUpdateProjectableAsNullable<TABLE extends ITableOrView<any>, COLUMNS> extends ComposableCustomizableExecutableUpdate<TABLE, COLUMNS, ResultObjectValues<COLUMNS>> {
    projectingOptionalValuesAsNullable(): ComposableCustomizableExecutableUpdate<TABLE, COLUMNS, ResultObjectValuesProjectedAsNullable<COLUMNS>>
}

type ReturningFnType<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> =
    TABLE[typeof database] extends (NoopDB | PostgreSql | SqlServer | Oracle)
    ? <COLUMNS extends UpdateColumns<TABLE, USING>>(columns: COLUMNS) => ComposableCustomizableExecutableUpdateProjectableAsNullable<TABLE, COLUMNS>
    : (TABLE[typeof database] extends Sqlite
    ? <COLUMNS extends UpdateColumns<TABLE, TABLE>>(columns: COLUMNS) => ComposableCustomizableExecutableUpdateProjectableAsNullable<TABLE, COLUMNS>
    : never)

type ReturningOneColumnFnType<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> =
    TABLE[typeof database] extends (NoopDB | PostgreSql | SqlServer | Oracle)
    ? <COLUMN extends ValueSourceOf<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]> | OLD<TABLE[typeof tableOrViewRef]>>>(column: COLUMN) => ComposableCustomizableExecutableUpdate<TABLE, COLUMN, ValueSourceValueTypeForResult<COLUMN>>
    : (TABLE[typeof database] extends Sqlite
    ? <COLUMN extends ValueSourceOf<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]> | OLD<TABLE[typeof tableOrViewRef]>>>(column: COLUMN) => ComposableCustomizableExecutableUpdate<TABLE, COLUMN, ValueSourceValueTypeForResult<COLUMN>>
    : never)

export type UpdateColumns<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> = {
    [P: string]: ValueSourceOf<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]> | OLD<TABLE[typeof tableOrViewRef]>> | UpdateColumns<TABLE, USING>
    [P: number | symbol]: never
}
