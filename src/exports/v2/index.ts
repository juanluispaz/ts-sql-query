// ts-sql-query: what works the same on every database: the tables, views and values, the connection types, the data
// types, the type adapters, the errors, the dynamic queries, the helper types, and the query runners that need no driver

export {
    type Connection,
} from '../../Connection.js'

export {
    type TransactionIsolationLevel,
} from '../../connections/AbstractConnection.js'

export {
    Table,
} from '../../Table.js'

export {
    View,
} from '../../View.js'

export {
    CustomBooleanTypeAdapter,
    ForceTypeCast,
    type DataTypeClass,
    type DefaultTypeAdapter,
    type ProjectionComparison,
    type ProjectionOutput,
    type TypeAdapter,
    type TypeAdapterContext,
    type TypeAdapterPlaceholderContext,
    type TypeAdapterProjectionContext,
    type TypeAdapterValueFromDBContext,
    type TypeAdapterValueToDBContext,
    type ApproximateNumericSqlDataType,
    type BinaryStringSqlDataType,
    type BitStringSqlDataType,
    type BooleanSqlDataType,
    type CharacterStringSqlDataType,
    type CollectionSqlDataType,
    type DatetimeSqlDataType,
    type DocumentSqlDataType,
    type EnumerationSqlDataType,
    type ExactNumericSqlDataType,
    type HierarchySqlDataType,
    type IntervalSqlDataType,
    type IntervalSqlDataTypeFields,
    type MoneySqlDataType,
    type NetworkAddressSqlDataType,
    type RowLocatorSqlDataType,
    type RowVersionSqlDataType,
    type SpatialSqlDataType,
    type SqlDataType,
    type SqlDataTypeCommon,
    type SqlDataTypeNative,
    type StructuredSqlDataType,
    type SystemSqlDataType,
    type TextSearchSqlDataType,
    type UserDefinedSqlDataType,
    type UuidSqlDataType,
    type VariantSqlDataType,
    type VectorSqlDataType,
    withSqlDataType,
} from '../../TypeAdapter.js'

export {
    registerDataType,
} from '../../typeSystem/dataTypeRegistry.js'

export {
    type DataTypeName,
    type DataTypes,
} from '../../typeSystem/dataTypeNames.js'

export {
    BooleanType,
    type IfValueSource,
} from '../../typeSystem/logical.js'

export {
    type ValueSource,
    type SourceOf,
    type OptionalityOf,
    type DataTypeOf,
    type OperandOf,
} from '../../typeSystem/base.js'

export {
    type CombinedOptionality,
} from '../../typeSystem/valueSource.js'

export {
    EqualableType,
} from '../../typeSystem/equalable.js'

export {
    ComparableType,
} from '../../typeSystem/comparable.js'

export {
    AdditiveType,
    ArithmeticType,
    DivisibleType,
    IntegersType,
    MultipliableType,
    RealsType,
} from '../../typeSystem/numeric.js'

export {
    DoubleType,
    IntType,
} from '../../typeSystem/number.js'
export {
    BigintType,
} from '../../typeSystem/bigint.js'

export {
    DecimalsType,
    DnumDecimalsType,
    DnumDecimalType,
    StringDecimalType,
    type Dnum,
} from '../../typeSystem/decimals.js'

export {
    StringType,
} from '../../typeSystem/strings.js'

export {
    UuidType,
    UuidsType,
} from '../../typeSystem/uuids.js'

export {
    LocalDateTimeType,
    LocalDateTimesType,
    LocalDateType,
    LocalDatesType,
    LocalTimeType,
    LocalTimesType,
} from '../../typeSystem/localDates.js'

export {
    PlainDateTimeType,
    PlainDateTimesType,
    PlainDateType,
    PlainDatesType,
    PlainTimeType,
    PlainTimesType,
} from '../../typeSystem/plainDates.js'

export {
    PlainMonthDayType,
    PlainMonthDaysType,
    PlainYearMonthType,
    PlainYearMonthsType,
} from '../../typeSystem/plainYearMonths.js'

export {
    DurationType,
    DurationsType,
} from '../../typeSystem/durations.js'

export {
    InstantType,
    InstantsType,
} from '../../typeSystem/instants.js'

export {
    ZonedDateTimeType,
    ZonedDateTimesType,
} from '../../typeSystem/zonedDateTimes.js'

export {
    EnumType,
} from '../../typeSystem/enum.js'

export {
    filterOperation,
    exposeFilterOperations,
} from '../../typeSystem/filterOperations.js'

export {
    getQueryContext,
    type QueryContext,
    type QueryParamContext,
} from '../../QueryContext.js'

export {
    Values,
    type OpaqueValues,
} from '../../Values.js'

export {
    TsSqlError,
    TsSqlQueryExecutionError,
    TsSqlProcessingError,
    QueryExecutionSource,
    type TsSqlDatabaseErrorCode,
    type TsSqlDatabaseErrorNumber,
    type TsSqlInternalErrorReason,
    type TsSqlErrorReason,
} from '../../TsSqlError.js'

export {
    dynamicPick,
    dynamicPickPaths,
    expandTypeFromDynamicPickPaths,
    expandTypeProjectedAsNullableFromDynamicPickPaths,
    type Pickable,
    type DynamicPick,
    type DynamicPickPaths,
    type PickValuesPath,
    type PickValuesPathWithAllProperties,
    type PickValuesPathProjectedAsNullable,
    type PickValuesPathWithAllPropertiesProjectedAsNullable,
} from '../../dynamic/pick.js'

export {
    type DynamicCondition,
    type FilterOf,
} from '../../expressions/dynamicConditionUsingFilters.js'

export {
    type DynamicConditionForModel,
    type DynamicDefinitionForModel,
} from '../../dynamic/condition.js'

export {
    type OrderByForModel,
} from '../../dynamic/orderBy.js'

export {
    type OrderByMode,
} from '../../expressions/select.js'

export {
    fromRef,
    type SelectedRow,
    type SelectedValues,
    type SelectedRowProjectedAsNullable,
    type SelectedValuesProjectedAsNullable,
    type InsertableRow,
    type InsertableValues,
    type UpdatableOnInsertConflictRow,
    type UpdatableOnInsertConflictValues,
    type InsertableRowShapedAs,
    type InsertableValuesShapedAs,
    type UpdatableOnInsertConflictRowShapedAs,
    type UpdatableOnInsertConflictValuesShapedAs,
    type UpdatableRow,
    type UpdatableValues,
    type UpdatableRowShapedAs,
    type UpdatableValuesShapedAs,
    type WritableShapeFor,
    type ColumnKeys,
    type WritableColumnKeys,
    type IdColumnKeys,
    type AutogeneratedIdColumnKeys,
    type ProvidedIdColumnKeys,
    type ColumnGroupKeys,
    type ExcludedColumns,
    type WithoutExcludedPaths,
    type ColumnsAtPaths,
    type ShapeAtPaths,
    type TableOrViewOf,
    type TableOrViewLeftJoinOf,
} from '../../extras/types.js'

export {
    extractColumnsFrom,
    extractWritableColumnsFrom,
    extractIdColumnsFrom,
    extractAutogeneratedIdColumnsFrom,
    extractProvidedIdColumnsFrom,
    extractColumnNamesFrom,
    extractWritableColumnNamesFrom,
    extractIdColumnNamesFrom,
    extractAutogeneratedIdColumnNamesFrom,
    extractProvidedIdColumnNamesFrom,
    extractWritableShapeFrom,
} from '../../extras/utils.js'

export {
    sync,
} from '../../extras/sync.js'

export {
    deepPick,
    deepOmit,
    type DeepPick,
    type DeepOmit,
    type DeepPickPaths,
} from '../../extras/deepUtilities.js'

export {
    type QueryRunner,
    type DatabaseType,
    type QueryType,
    type ExecutableQueryType,
    type QueryResultOf,
    type PromiseProvider,
    type BeginTransactionOpts,
    type CommitOpts,
    type RollbackOpts,
    type ConnectionConfiguration,
    type QueryResultColumn,
    type FunctionExecutingQueryInformation,
} from '../../queryRunners/QueryRunner.js'

export {
    type MockQueryExecutor,
    type QueryRunnerName,
    type MockQueryRunnerConfig,
    noopQueryExecutor,
    MockQueryRunner,
} from '../../queryRunners/MockQueryRunner.js'

export {
    type NoopQueryRunnerConfig,
    NoopQueryRunner,
} from '../../queryRunners/NoopQueryRunner.js'

export {
    NoExecutionQueryRunner,
} from '../../queryRunners/NoExecutionQueryRunner.js'

export {
    type TimeGranularity,
    type ConsoleLogQueryRunnerOpts,
    ConsoleLogQueryRunner,
} from '../../queryRunners/ConsoleLogQueryRunner.js'

export {
    InterceptorQueryRunner,
} from '../../queryRunners/InterceptorQueryRunner.js'

export {
    type QueryLogger,
    LoggingQueryRunner,
} from '../../queryRunners/LoggingQueryRunner.js'
