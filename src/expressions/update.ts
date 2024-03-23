import type { AnyValueSource, IExecutableUpdateQuery, IAnyBooleanValueSource, RemapIValueSourceType, RemapIValueSourceTypeWithOptionalType, ValueSourceOf, ValueSourceValueType, ValueSourceValueTypeForResult } from "./values"
import type { ForUseInLeftJoin, HasSource, IRawFragment, ITable, ITableOrView, OfDB, OfSameDB, ResolvedShape } from "../utils/ITableOrView"
import type { from, source, using } from "../utils/symbols"
import type { ColumnsForSetOf, ColumnsForSetOfWithShape, ColumnsKeyOf, OptionalColumnsForSetOf, RequiredColumnsForSetOf, ResolveShape } from "../utils/tableOrViewUtils"
import type { WritableDBColumn, WritableDBColumnWithDefaultValue } from "../utils/Column"
import type { Default } from "./Default"
import type { NNoTableOrViewRequiredFrom, NOldValuesFrom, NSource } from "../utils/sourceName"
import type { DataToProject } from "../complexProjections/dataToProject"
import type { ResultObjectValuesProjectedAsNullable } from "../complexProjections/resultWithOptionalsAsNull"
import type { ResultObjectValues } from "../complexProjections/resultWithOptionalsAsUndefined"

export interface UpdateCustomization</*in|out*/ _TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> {
    afterUpdateKeyword?: IRawFragment<USING[typeof source]>
    beforeQuery?: IRawFragment<USING[typeof source]>
    afterQuery?: IRawFragment<USING[typeof source]>
    queryExecutionName?: string
    queryExecutionMetadata?: any
}

export interface UpdateExpressionBase</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> {
    [from]: TABLE
    [using]: USING
}

export interface ExecutableUpdate</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends UpdateExpressionBase<TABLE, USING>, IExecutableUpdateQuery<NNoTableOrViewRequiredFrom<TABLE[typeof source]>, number> {
    executeUpdate(min?: number, max?: number): Promise<number>
    query(): string
    params(): any[]
}

export interface CustomizableExecutableUpdate</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends ExecutableUpdate<TABLE, USING> {
    customizeQuery(customization: UpdateCustomization<TABLE, USING>): ExecutableUpdate<TABLE, USING>
}

export interface ExecutableUpdateExpression</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends ReturnableExecutableUpdate<TABLE, USING> {
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
    where(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicExecutableUpdateExpression<TABLE, USING>
}

export interface ShapedExecutableUpdateExpression</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>, /*in|out*/ SHAPE> extends ReturnableExecutableUpdate<TABLE, USING> {
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
    where(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicExecutableUpdateExpression<TABLE, USING>
}

export interface NotExecutableUpdateExpression</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends UpdateExpressionBase<TABLE, USING> {
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
    where(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicExecutableUpdateExpression<TABLE, USING>
}

export interface ShapedNotExecutableUpdateExpression</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>, /*in|out*/ SHAPE> extends UpdateExpressionBase<TABLE, USING> {
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
    where(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicExecutableUpdateExpression<TABLE, USING>
}

export interface DynamicExecutableUpdateExpression</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends ReturnableExecutableUpdate<TABLE, USING> {
    and(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicExecutableUpdateExpression<TABLE, USING>
    or(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicExecutableUpdateExpression<TABLE, USING>
}

export interface UpdateSetExpression</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends UpdateExpressionBase<TABLE, USING> {
    shapedAs<SHAPE extends UpdateShape<TABLE, USING>>(shape: SHAPE): ShapedUpdateSetExpression<TABLE, USING, ResolveShape<TABLE, SHAPE>>
    dynamicSet(): NotExecutableUpdateExpression<TABLE, USING>
    dynamicSet(columns: UpdateSets<TABLE, USING, undefined>): NotExecutableUpdateExpression<TABLE, USING>
    set(columns: UpdateSets<TABLE, USING, undefined>): NotExecutableUpdateExpression<TABLE, USING>
    setIfValue(columns: OptionalUpdateSets<TABLE, USING, undefined>): NotExecutableUpdateExpression<TABLE, USING>
}

export interface ShapedUpdateSetExpression</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>, /*in|out*/ SHAPE> extends UpdateExpressionBase<TABLE, USING> {
    extendShape<EXTEND_SHAPE extends UpdateShape<TABLE, USING>>(shape: EXTEND_SHAPE): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE & ResolveShape<TABLE, EXTEND_SHAPE>>
    dynamicSet(): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
    dynamicSet(columns: UpdateSets<TABLE, USING, SHAPE>): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
    set(columns: UpdateSets<TABLE, USING, SHAPE>): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
    setIfValue(columns: OptionalUpdateSets<TABLE, USING, SHAPE>): ShapedNotExecutableUpdateExpression<TABLE, USING, SHAPE>
}

export interface UpdateExpression</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends UpdateSetExpression<TABLE, USING> {
    from: FromFnType<TABLE, USING>
    join: OnExpressionFnType<TABLE, USING>
    innerJoin: OnExpressionFnType<TABLE, USING>
    leftJoin: LeftJoinOnExpressionFnType<TABLE, USING>
    leftOuterJoin: LeftJoinOnExpressionFnType<TABLE, USING>
}

export interface UpdateSetExpressionAllowingNoWhere</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends UpdateExpressionBase<TABLE, USING> {
    shapedAs<SHAPE extends UpdateShape<TABLE, USING>>(shape: SHAPE): ShapedUpdateSetExpressionAllowingNoWhere<TABLE, USING, ResolveShape<TABLE, SHAPE>>
    dynamicSet(): ExecutableUpdateExpression<TABLE, USING>
    dynamicSet(columns: UpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    set(columns: UpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
    setIfValue(columns: OptionalUpdateSets<TABLE, USING, undefined>): ExecutableUpdateExpression<TABLE, USING>
}

export interface ShapedUpdateSetExpressionAllowingNoWhere</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>, /*in|out*/ SHAPE> extends UpdateExpressionBase<TABLE, USING> {
    extendShape<EXTEND_SHAPE extends UpdateShape<TABLE, USING>>(shape: EXTEND_SHAPE): ShapedUpdateSetExpressionAllowingNoWhere<TABLE, USING, SHAPE & ResolveShape<TABLE, EXTEND_SHAPE>>
    dynamicSet(): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
    dynamicSet(columns: UpdateSets<TABLE, USING, SHAPE>): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
    set(columns: UpdateSets<TABLE, USING, SHAPE>): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
    setIfValue(columns: OptionalUpdateSets<TABLE, USING, SHAPE>): ShapedExecutableUpdateExpression<TABLE, USING, SHAPE>
}

export interface UpdateExpressionAllowingNoWhere</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends UpdateSetExpressionAllowingNoWhere<TABLE, USING> {
    from: FromFnTypeAllowingNoWhere<TABLE, USING>
    join: OnExpressionFnTypeAllowingNoWhere<TABLE, USING>
    innerJoin: OnExpressionFnTypeAllowingNoWhere<TABLE, USING>
    leftJoin: LeftJoinOnExpressionFnTypeAllowingNoWhere<TABLE, USING>
    leftOuterJoin: LeftJoinOnExpressionFnTypeAllowingNoWhere<TABLE, USING>
}

export type UpdateSets<TABLE extends HasSource<any>, USING extends HasSource<any>, SHAPE> = UpdateSetsContent<TABLE, USING[typeof source], SHAPE>
export type UpdateSetsContent<CONTAINER, ALLOWING extends NSource, SHAPE> = 
    SHAPE extends ResolvedShape<any>
    ? (
        {
            [P in RequiredColumnsForSetOf<SHAPE>]?: InputTypeOfColumnAllowing<SHAPE, P, ALLOWING>
        } & {
            [P in OptionalColumnsForSetOf<SHAPE >]?: InputTypeOfOptionalColumnAllowing<SHAPE, P, ALLOWING>
        }
    ): (
        {
            [P in RequiredColumnsForSetOf<CONTAINER>]?: InputTypeOfColumnAllowing<CONTAINER, P, ALLOWING>
        } & {
            [P in OptionalColumnsForSetOf<CONTAINER>]?: InputTypeOfOptionalColumnAllowing<CONTAINER, P, ALLOWING>
        }
    )

export type UpdateValues<CONTAINER, SHAPE> = 
    SHAPE extends ResolvedShape<any> 
    ? (
        {
            [P in RequiredColumnsForSetOf<SHAPE>]?: ValueSourceValueType<SHAPE[P]>
        } & {
            [P in OptionalColumnsForSetOf<SHAPE>]?: ValueSourceValueType<SHAPE[P]>
        }
    ): (
        {
            [P in RequiredColumnsForSetOf<CONTAINER>]?: ValueSourceValueType<CONTAINER[P]>
        } & {
            [P in OptionalColumnsForSetOf<CONTAINER>]?: ValueSourceValueType<CONTAINER[P]>
        }
    )

export type UpdateShape<TABLE extends HasSource<any>, USING extends HasSource<any>> = 
    TABLE extends OfDB<'noopDB' | 'mariaDB' | 'mySql'>
    ? {
        [key: string]: ValueSourceOf<FilterTables<USING>[typeof source]> & WritableDBColumn | ColumnsForSetOf<TABLE>
    } : {
        [key: string]: ValueSourceOf<TABLE[typeof source]> & WritableDBColumn | ColumnsForSetOf<TABLE>
    }

type FilterTables<USING extends HasSource<any>> = USING extends ITable<any> ? USING : never

export type OptionalUpdateSets<TABLE extends HasSource<any>, USING extends HasSource<any>, SHAPE> = OptionalUpdateSetsContent<TABLE, USING[typeof source], SHAPE>
type OptionalUpdateSetsContent<TABLE extends HasSource<any>, ALLOWING extends NSource, SHAPE> = 
    SHAPE extends ResolvedShape<any>
    ? (
        {
            [P in RequiredColumnsForSetOf<SHAPE>]?: InputTypeOfColumnAllowing<SHAPE, P, ALLOWING> | null | undefined
        } & {
            [P in OptionalColumnsForSetOf<SHAPE>]?: InputTypeOfOptionalColumnAllowing<SHAPE, P, ALLOWING> | null | undefined
        }
    ) : (
        {
            [P in RequiredColumnsForSetOf<TABLE>]?: InputTypeOfColumnAllowing<TABLE, P, ALLOWING> | null | undefined
        } & {
            [P in OptionalColumnsForSetOf<TABLE>]?: InputTypeOfOptionalColumnAllowing<TABLE, P, ALLOWING> | null | undefined
        }
    )

type InputTypeOfColumnAllowing<CONTAINER, K extends ColumnsKeyOf<CONTAINER>, ALLOWING extends NSource> =
    CONTAINER[K] extends AnyValueSource ?
    (CONTAINER[K] extends WritableDBColumnWithDefaultValue ? (
        ValueSourceValueType<CONTAINER[K]> | RemapIValueSourceType<ALLOWING, CONTAINER[K]> | Default
    ) : (
        ValueSourceValueType<CONTAINER[K]> | RemapIValueSourceType<ALLOWING, CONTAINER[K]>
    ))
    : never

type InputTypeOfOptionalColumnAllowing<CONTAINER, K extends ColumnsKeyOf<CONTAINER>, ALLOWING extends NSource> =
    CONTAINER[K] extends AnyValueSource ?
    (CONTAINER[K] extends WritableDBColumnWithDefaultValue ? (
        ValueSourceValueType<CONTAINER[K]> | RemapIValueSourceTypeWithOptionalType<ALLOWING, CONTAINER[K], any> | Default
    ) : (
        ValueSourceValueType<CONTAINER[K]> | RemapIValueSourceTypeWithOptionalType<ALLOWING, CONTAINER[K], any>
    ))
    : never


export interface UpdateSetJoinExpression</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends UpdateSetExpression<TABLE, USING> {
    join<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>): OnExpression<TABLE, USING | T2>
    innerJoin<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>): OnExpression<TABLE, USING | T2>
    leftJoin<T2 extends ForUseInLeftJoin<any>>(source: T2 & OfSameDB<TABLE>): OnExpression<TABLE, USING | T2>
    leftOuterJoin<T2 extends ForUseInLeftJoin<any>>(source: T2 & OfSameDB<TABLE>): OnExpression<TABLE, USING | T2>
}

export interface DynamicOnExpression</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends UpdateSetJoinExpression<TABLE, USING> {
    and(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicOnExpression<TABLE, USING>
    or(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicOnExpression<TABLE, USING>
}

export interface OnExpression</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends UpdateSetJoinExpression<TABLE, USING> {
    dynamicOn(): DynamicOnExpression<TABLE, USING>
    on(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicOnExpression<TABLE, USING>
}

export interface UpdateExpressionWithoutJoin</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends UpdateSetExpression<TABLE, USING> {
    from<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>): UpdateExpressionWithoutJoin<TABLE, USING | T2>
}

export interface UpdateFromExpression</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends UpdateSetJoinExpression<TABLE, USING> {
    from<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>): UpdateExpressionWithoutJoin<TABLE, USING | T2>
}

type FromFnType<TABLE extends HasSource<any>, USING extends HasSource<any>> =
    TABLE extends OfDB<'noopDB' | 'postgreSql' | 'sqlServer' | 'sqlite' | 'mariaDB' | 'mySql'>
    ? <T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>) => UpdateFromExpression<TABLE, USING | T2>
    : never

type OnExpressionFnType<TABLE extends HasSource<any>, USING extends HasSource<any>> =
    TABLE extends OfDB<'noopDB' | 'mariaDB' | 'mySql'>
    ? <T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>) => OnExpression<TABLE, USING | T2>
    : never

type LeftJoinOnExpressionFnType<TABLE extends HasSource<any>, USING extends HasSource<any>> =
    TABLE extends OfDB<'noopDB' | 'mariaDB' | 'mySql'>
    ? <T2 extends ForUseInLeftJoin<any>>(source: T2 & OfSameDB<TABLE>) => OnExpression<TABLE, USING | T2>
    : never





export interface UpdateSetJoinExpressionAllowingNoWhere</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends UpdateSetExpressionAllowingNoWhere<TABLE, USING> {
    join<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>): OnExpressionAllowingNoWhere<TABLE, USING | T2>
    innerJoin<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>): OnExpressionAllowingNoWhere<TABLE, USING | T2>
    leftJoin<T2 extends ForUseInLeftJoin<any>>(source: T2 & OfSameDB<TABLE>): OnExpressionAllowingNoWhere<TABLE, USING | T2>
    leftOuterJoin<T2 extends ForUseInLeftJoin<any>>(source: T2 & OfSameDB<TABLE>): OnExpressionAllowingNoWhere<TABLE, USING | T2>
}

export interface DynamicOnExpressionAllowingNoWhere</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends UpdateSetJoinExpressionAllowingNoWhere<TABLE, USING> {
    and(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
    or(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
}

export interface OnExpressionAllowingNoWhere</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends UpdateSetJoinExpressionAllowingNoWhere<TABLE, USING> {
    dynamicOn(): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
    on(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
}

export interface UpdateExpressionWithoutJoinAllowingNoWhere</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends UpdateSetExpressionAllowingNoWhere<TABLE, USING> {
    from<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>): UpdateExpressionWithoutJoinAllowingNoWhere<TABLE, USING | T2>
}

export interface UpdateFromExpressionAllowingNoWhere</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends UpdateSetJoinExpressionAllowingNoWhere<TABLE, USING> {
    from<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>): UpdateExpressionWithoutJoinAllowingNoWhere<TABLE, USING | T2>
}

type FromFnTypeAllowingNoWhere<TABLE extends HasSource<any>, USING extends HasSource<any>> =
    TABLE extends OfDB<'noopDB' | 'postgreSql' | 'sqlServer' | 'sqlite' | 'mariaDB' | 'mySql'>
    ? <T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>) => UpdateFromExpressionAllowingNoWhere<TABLE, USING | T2>
    : never

type OnExpressionFnTypeAllowingNoWhere<TABLE extends HasSource<any>, USING extends HasSource<any>> =
    TABLE extends OfDB<'noopDB' | 'mariaDB' | 'mySql'>
    ? <T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>) => OnExpressionAllowingNoWhere<TABLE, USING | T2>
    : never

type LeftJoinOnExpressionFnTypeAllowingNoWhere<TABLE extends HasSource<any>, USING extends HasSource<any>> =
    TABLE extends OfDB<'noopDB' | 'mariaDB' | 'mySql'>
    ? <T2 extends ForUseInLeftJoin<any>>(source: T2 & OfSameDB<TABLE>) => OnExpressionAllowingNoWhere<TABLE, USING | T2>
    : never





export interface ReturnableExecutableUpdate</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends CustomizableExecutableUpdate<TABLE, USING> {
    returning: ReturningFnType<TABLE, USING>
    returningOneColumn: ReturningOneColumnFnType<TABLE, USING>
}

export interface ExecutableUpdateReturning</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT> extends UpdateExpressionBase<TABLE, USING>, IExecutableUpdateQuery<NNoTableOrViewRequiredFrom<TABLE[typeof source]>, RESULT> {
    executeUpdateNoneOrOne(): Promise<( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] }) | null>
    executeUpdateOne(): Promise<( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] })>
    executeUpdateMany(min?: number, max?: number): Promise<( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] })[]>

    query(): string
    params(): any[]
}

export interface CustomizableExecutableUpdateReturning</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT> extends ExecutableUpdateReturning<TABLE, USING, COLUMNS, RESULT> {
    customizeQuery(customization: UpdateCustomization<TABLE, USING>): ExecutableUpdateReturning<TABLE, USING, COLUMNS, RESULT>
}

export interface CustomizableExecutableUpdateProjectableAsNullable</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>, /*in|out*/ COLUMNS> extends CustomizableExecutableUpdateReturning<TABLE, USING, COLUMNS, ResultObjectValues<COLUMNS>> {
    projectingOptionalValuesAsNullable(): CustomizableExecutableUpdateReturning<TABLE, USING, COLUMNS, ResultObjectValuesProjectedAsNullable<COLUMNS>>
}

type ReturningFnType<TABLE extends HasSource<any>, USING extends HasSource<any>> =
    TABLE extends OfDB<'noopDB' | 'postgreSql' | 'sqlServer' | 'oracle'>
    ? <COLUMNS extends UpdateColumns<USING[typeof source] | NOldValuesFrom<TABLE[typeof source]>>>(columns: COLUMNS) => CustomizableExecutableUpdateProjectableAsNullable<TABLE, USING, COLUMNS>
    : TABLE extends OfDB<'sqlite'>
    ? <COLUMNS extends UpdateColumns<TABLE[typeof source] | NNoTableOrViewRequiredFrom<TABLE[typeof source]>>>(columns: COLUMNS) => CustomizableExecutableUpdateProjectableAsNullable<TABLE, USING, COLUMNS>
    : never

type ReturningOneColumnFnType<TABLE extends HasSource<any>, USING extends HasSource<any>> =
    TABLE extends OfDB<'noopDB' | 'postgreSql' | 'sqlServer' | 'oracle'>
    ? <COLUMN extends ValueSourceOf<USING[typeof source] | NOldValuesFrom<TABLE[typeof source]>>>(column: COLUMN) => CustomizableExecutableUpdateReturning<TABLE, USING, COLUMN, ValueSourceValueTypeForResult<COLUMN>>
    : TABLE  extends OfDB<'sqlite'>
    ? <COLUMN extends ValueSourceOf<TABLE[typeof source] | NNoTableOrViewRequiredFrom<TABLE[typeof source]>> | NOldValuesFrom<TABLE[typeof source]>>(column: COLUMN) => CustomizableExecutableUpdateReturning<TABLE, USING, COLUMN, ValueSourceValueTypeForResult<COLUMN>>
    : never

export type UpdateColumns</*in|out*/ SOURCE extends NSource> = DataToProject<SOURCE>
