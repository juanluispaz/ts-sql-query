import type { DataTypeClass, DefaultTypeAdapter, TypeAdapter, ProjectionComparison, ProjectionOutput, SqlDataType, TypeAdapterPlaceholderContext, TypeAdapterProjectionContext, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext } from '../TypeAdapter.js'
import type { ConnectionConfiguration } from '../queryRunners/QueryRunner.js'
import { QueryParamContextImpl, type QueryContextImpl } from './QueryContextImpl.js'
import type { AnyValueSource } from '../typeSystem/valueSource.js'
import type { BuiltInDataType } from '../typeSystem/builtInDataTypes.js'
import { __dataTypeClassFrom } from '../typeSystem/dataTypeClasses.js'
import { __typeAdapterOf, __unadaptedClassOf } from '../nodes/adaptedTypeClass.js'

/** Who gives the type a `transformProjection` requests for a value (the SQL builder) */
export interface RequestedTypeOfProjection {
    /** Writes in `into` the requested type of the value that leaves the database in `output` */
    _resolveRequestedTypeOfProjection(value: AnyValueSource, output: ProjectionOutput, into: QueryParamContextImpl): void
}

/**
 * The context the type adapters receive: one object for a whole construction of a query (or one of the SQL builder for
 * what is not part of one), which says what is being processed. The SQL builder points it at what it processes before
 * it calls a transform (a parameter, a projection, a value read), so nothing is created per call. The types and
 * forceTypeCast of a parameter live in its context in the query; the ones of a value that is no parameter, in the own
 * state of this object.
 */
export class TypeAdapterContextImpl implements TypeAdapterValueToDBContext, TypeAdapterPlaceholderContext, TypeAdapterProjectionContext, TypeAdapterValueFromDBContext {
    readonly connectionConfiguration: ConnectionConfiguration

    /** The types and forceTypeCast of what is processed when it isn't a parameter */
    private readonly own: QueryParamContextImpl = new QueryParamContextImpl()
    /** Where the types and forceTypeCast of what is processed are: the parameter, or the own state */
    private state: QueryParamContextImpl = this.own
    /** The parameter being prepared, or undefined when a value is transformed only to look at it */
    private param: QueryParamContextImpl | undefined = undefined
    /** Its index in the params */
    private paramIndex: number | undefined = undefined
    /** The value read whose requested type is the one its projection requests, not resolved yet */
    private pendingProjection: AnyValueSource | undefined = undefined
    private pendingOutput: ProjectionOutput = 'resultColumn'
    private projector: RequestedTypeOfProjection | undefined = undefined
    /** The context of the query this object serves the construction of, if it serves one */
    private readonly builtQueryContext: QueryContextImpl | undefined
    /** The context of the query of what is processed, where the metadata of the query goes; none to discard it */
    private queryContext: QueryContextImpl | undefined

    /** The type adapter of the type requested with one (setRequestedType), and whether `next` applied it already */
    private requestedTypeAdapter: TypeAdapter | undefined = undefined
    private requestedTypeAdapterApplied = false
    /** The type adapter of the original type, which is already in the chain */
    private originalTypeAdapter: TypeAdapter | undefined = undefined

    valueSentToDB: unknown = undefined
    output: ProjectionOutput = 'resultColumn'
    comparison: ProjectionComparison = 'value'

    constructor(connectionConfiguration: ConnectionConfiguration, builtQueryContext?: QueryContextImpl | undefined) {
        this.connectionConfiguration = connectionConfiguration
        this.builtQueryContext = builtQueryContext
        this.queryContext = builtQueryContext
    }

    /**
     * Points the context at the parameter at that index, of that original type (also the requested one), with what the
     * library decided of forceTypeCast; without a parameter (a value transformed only to look at it, the literal null),
     * at the own state of the context
     */
    prepareParam(param: QueryParamContextImpl | undefined, index: number | undefined, forceTypeCast: boolean, originalType: DataTypeClass, sqlDataType: SqlDataType | undefined): void {
        const state = param ?? this.own
        this.state = state
        this.param = param
        this.paramIndex = index
        this.pendingProjection = undefined
        this.valueSentToDB = undefined
        this.queryContext = this.builtQueryContext
        state.setOriginalType(__unadaptedClassOf(originalType))
        state.setOriginalSqlDataType(sqlDataType)
        state.forceTypeCast = forceTypeCast
        this.startConversion(originalType)
    }
    /** The parameter the context points at is no longer being prepared */
    clearParam(): void {
        this.state = this.own
        this.param = undefined
        this.paramIndex = undefined
        this.valueSentToDB = undefined
    }
    /**
     * Prepares the context for the transformProjection of a value of that original type, for output, in the query with
     * that context (none when the projection is only looked at)
     */
    prepareProjection(originalType: DataTypeClass, sqlDataType: SqlDataType | undefined, output: ProjectionOutput, queryContext: QueryContextImpl | undefined): void {
        this.clearParam()
        this.pendingProjection = undefined
        this.queryContext = queryContext
        this.own.setOriginalType(__unadaptedClassOf(originalType))
        this.own.setOriginalSqlDataType(sqlDataType)
        this.startConversion(originalType)
        this.output = output
        this.comparison = 'value'
    }
    /**
     * Prepares the context for the transformValueFromDB of a value of that original type; its requested type is the one
     * the projection of the value requests for output (resolved when it is read), or the original one without it
     */
    prepareRead(originalType: DataTypeClass, sqlDataType: SqlDataType | undefined, projector: RequestedTypeOfProjection | undefined, value: AnyValueSource | undefined, output: ProjectionOutput): void {
        this.clearParam()
        this.queryContext = undefined
        this.own.setOriginalType(__unadaptedClassOf(originalType))
        this.own.setOriginalSqlDataType(sqlDataType)
        this.startConversion(originalType)
        this.projector = projector
        this.pendingProjection = projector ? value : undefined
        this.pendingOutput = output
    }

    private startConversion(originalType: DataTypeClass): void {
        this.originalTypeAdapter = __typeAdapterOf(originalType)
        this.requestedTypeAdapter = undefined
        this.requestedTypeAdapterApplied = false
    }
    /** The type adapter of the requested type that `next` applies: once, and never the one already in the chain */
    takeRequestedTypeAdapter(): TypeAdapter | undefined {
        const typeAdapter = this.requestedTypeAdapter
        if (!typeAdapter || this.requestedTypeAdapterApplied || typeAdapter === this.originalTypeAdapter) {
            return undefined
        }
        this.requestedTypeAdapterApplied = true
        return typeAdapter
    }
    /** The placeholder of the parameter goes through the type adapter of the type requested for its value again */
    startPlaceholder(): void {
        this.requestedTypeAdapterApplied = false
    }

    private resolvePendingProjection(): void {
        const value = this.pendingProjection
        if (value) {
            this.pendingProjection = undefined
            this.projector!._resolveRequestedTypeOfProjection(value, this.pendingOutput, this.state)
        }
    }

    get originalType(): DataTypeClass {
        return this.state.originalType!
    }
    get requestedType(): DataTypeClass {
        this.resolvePendingProjection()
        return this.state.requestedType!
    }
    setRequestedType(type: BuiltInDataType | DataTypeClass, typeAdapter?: TypeAdapter): void {
        this.pendingProjection = undefined
        this.state.requestedType = __unadaptedClassOf(__dataTypeClassFrom(type))
        this.requestedTypeAdapter = typeAdapter
    }
    resetRequestedType(): void {
        this.pendingProjection = undefined
        const state = this.state
        state.requestedType = state.originalType
        this.requestedTypeAdapter = undefined
    }
    get originalSqlDataType(): SqlDataType | undefined {
        return this.state.originalSqlDataType
    }
    get requestedSqlDataType(): SqlDataType | undefined {
        this.resolvePendingProjection()
        return this.state.requestedSqlDataType
    }
    setRequestedSqlDataType(sqlDataType: SqlDataType | undefined): void {
        this.resolvePendingProjection()
        this.state.requestedSqlDataType = sqlDataType
    }
    resetRequestedSqlDataType(): void {
        this.resolvePendingProjection()
        this.state.requestedSqlDataType = this.state.originalSqlDataType
    }
    /** Copies the requested type and the SQL data type of what the context processes into `into` */
    copyRequestedTypeTo(into: QueryParamContextImpl): void {
        this.resolvePendingProjection()
        into.requestedType = this.state.requestedType
        into.requestedSqlDataType = this.state.requestedSqlDataType
    }

    get index(): number | undefined {
        return this.paramIndex
    }
    get forceTypeCast(): boolean {
        return !!this.state.forceTypeCast
    }
    set forceTypeCast(value: boolean) {
        this.state.forceTypeCast = value
    }
    setMetadata(key: symbol, value: unknown): void {
        this.param?.setMetadata(key, value)
    }
    getMetadata(key: symbol): unknown {
        return this.param?.getMetadata(key)
    }
    setQueryMetadata(key: symbol, value: unknown): void {
        this.queryContext?.setMetadata(key, value)
    }
    getQueryMetadata(key: symbol): unknown {
        return this.queryContext?.getMetadata(key)
    }
}

/**
 * The `next` a type adapter receives: the type adapter of the type requested with one, if the chain hasn't applied it
 * yet, and then the connection. One for each connection; it keeps nothing of a conversion (the context does)
 */
export class NextTypeAdapter implements DefaultTypeAdapter {
    private readonly connection: DefaultTypeAdapter

    constructor(connection: DefaultTypeAdapter) {
        this.connection = connection
    }

    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext): unknown {
        const typeAdapter = requestedTypeAdapterOf(context)
        if (typeAdapter) {
            return typeAdapter.transformValueFromDB(value, context, this)
        }
        return this.connection.transformValueFromDB(value, context)
    }
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext): unknown {
        const typeAdapter = requestedTypeAdapterOf(context)
        if (typeAdapter) {
            return typeAdapter.transformValueToDB(value, context, this)
        }
        return this.connection.transformValueToDB(value, context)
    }
    transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext): string {
        const typeAdapter = requestedTypeAdapterOf(context)
        if (typeAdapter?.transformPlaceholder) {
            return typeAdapter.transformPlaceholder(placeholder, context, this)
        }
        return this.connection.transformPlaceholder(placeholder, context)
    }
    transformProjection(sql: string, context: TypeAdapterProjectionContext): string {
        const typeAdapter = requestedTypeAdapterOf(context)
        if (typeAdapter?.transformProjection) {
            return typeAdapter.transformProjection(sql, context, this)
        }
        return this.connection.transformProjection(sql, context)
    }
}

function requestedTypeAdapterOf(context: unknown): TypeAdapter | undefined {
    return context instanceof TypeAdapterContextImpl ? context.takeRequestedTypeAdapter() : undefined
}
