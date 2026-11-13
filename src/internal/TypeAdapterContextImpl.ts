import type { CustomType, ProjectionComparison, ProjectionOutput, TypeAdapterPlaceholderContext, TypeAdapterProjectionContext, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext } from '../TypeAdapter.js'
import type { ConnectionConfiguration } from '../queryRunners/QueryRunner.js'
import type { AnyValueSource } from '../expressions/values.js'
import { QueryParamContextImpl } from './QueryContextImpl.js'

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

    valueSentToDB: unknown = undefined
    output: ProjectionOutput = 'resultColumn'
    comparison: ProjectionComparison = 'value'

    constructor(connectionConfiguration: ConnectionConfiguration) {
        this.connectionConfiguration = connectionConfiguration
    }

    /**
     * Points the context at the parameter at that index, of that original type (also the requested one), with what the
     * library decided of forceTypeCast; without a parameter (a value transformed only to look at it, the literal null),
     * at the own state of the context
     */
    prepareParam(param: QueryParamContextImpl | undefined, index: number | undefined, forceTypeCast: boolean, originalType: string, originalCustomType: CustomType | undefined): void {
        const state = param ?? this.own
        this.state = state
        this.param = param
        this.paramIndex = index
        this.pendingProjection = undefined
        this.valueSentToDB = undefined
        state.setOriginalType(originalType, originalCustomType)
        state.forceTypeCast = forceTypeCast
    }
    /** The parameter the context points at is no longer being prepared */
    clearParam(): void {
        this.state = this.own
        this.param = undefined
        this.paramIndex = undefined
        this.valueSentToDB = undefined
    }
    /** Prepares the context for the transformProjection of a value of that original type, for output */
    prepareProjection(originalType: string, originalCustomType: CustomType | undefined, output: ProjectionOutput): void {
        this.clearParam()
        this.pendingProjection = undefined
        this.own.setOriginalType(originalType, originalCustomType)
        this.output = output
        this.comparison = 'value'
    }
    /**
     * Prepares the context for the transformValueFromDB of a value of that original type; its requested type is the one
     * the projection of the value requests for output (resolved when it is read), or the original one without it
     */
    prepareRead(originalType: string, originalCustomType: CustomType | undefined, projector: RequestedTypeOfProjection | undefined, value: AnyValueSource | undefined, output: ProjectionOutput): void {
        this.clearParam()
        this.own.setOriginalType(originalType, originalCustomType)
        this.projector = projector
        this.pendingProjection = projector ? value : undefined
        this.pendingOutput = output
    }

    private resolvePendingProjection(): void {
        const value = this.pendingProjection
        if (value) {
            this.pendingProjection = undefined
            this.projector!._resolveRequestedTypeOfProjection(value, this.pendingOutput, this.state)
        }
    }

    get originalType(): string {
        return this.state.originalType ?? ''
    }
    get originalCustomType(): CustomType | undefined {
        return this.state.originalCustomType
    }
    get requestedType(): string {
        this.resolvePendingProjection()
        return this.state.requestedType ?? ''
    }
    get requestedCustomType(): CustomType | undefined {
        this.resolvePendingProjection()
        return this.state.requestedCustomType
    }
    setRequestedType(type: 'boolean' | 'int' | 'bigint' | 'double' | 'stringDecimal' | 'string' | 'uuid' | 'localDate' | 'localTime' | 'localDateTime'): void
    setRequestedType(customType: CustomType, type: string): void
    setRequestedType(typeOrCustomType: string, type?: string): void {
        this.pendingProjection = undefined
        const state = this.state
        if (type === undefined) {
            state.requestedType = typeOrCustomType
            state.requestedCustomType = undefined
        } else {
            state.requestedType = type
            state.requestedCustomType = typeOrCustomType as CustomType
        }
    }
    resetRequestedType(): void {
        this.pendingProjection = undefined
        const state = this.state
        state.requestedType = state.originalType
        state.requestedCustomType = state.originalCustomType
    }
    /** Copies the requested type of what the context processes into `into` */
    copyRequestedTypeTo(into: QueryParamContextImpl): void {
        this.resolvePendingProjection()
        into.requestedType = this.state.requestedType
        into.requestedCustomType = this.state.requestedCustomType
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
}
