import type { ProjectionComparison, TypeAdapterPlaceholderContext, TypeAdapterProjectionContext, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext, TypeCategory } from '../TypeAdapter.js'
import type { ConnectionConfiguration } from '../queryRunners/QueryRunner.js'
import type { QueryParamContextImpl } from './QueryContextImpl.js'

/**
 * The context the type adapters receive: one object for a whole construction of a query (or one of the SQL builder for
 * what is not part of one), which says what is being processed. The SQL builder points it at the parameter it is
 * preparing before it calls `transformValueToDB` and `transformPlaceholder`, and clears what a `transformProjection`
 * says before calling it, so nothing is created per call.
 */
export class TypeAdapterContextImpl implements TypeAdapterValueToDBContext, TypeAdapterPlaceholderContext, TypeAdapterProjectionContext, TypeAdapterValueFromDBContext {
    readonly connectionConfiguration: ConnectionConfiguration

    /** The parameter being prepared, or undefined when a value is transformed only to look at it */
    private param: QueryParamContextImpl | undefined = undefined
    /** Its index in the params */
    private paramIndex: number | undefined = undefined
    /** Whether the database receives the type of the value being prepared, when it isn't a parameter */
    private valueForceTypeCast: boolean = false

    comparison: ProjectionComparison = 'value'
    projectedType: string | undefined = undefined
    projectedTypeCategory: TypeCategory | undefined = undefined

    constructor(connectionConfiguration: ConnectionConfiguration) {
        this.connectionConfiguration = connectionConfiguration
    }

    /**
     * Points the context at the parameter at that index, with what the library decided of its type; without a
     * parameter, a value transformed only to look at it, or the literal null of a placeholder
     */
    prepareParam(param: QueryParamContextImpl | undefined, index: number | undefined, forceTypeCast: boolean): void {
        this.param = param
        this.paramIndex = index
        if (param) {
            param.forceTypeCast = forceTypeCast
        } else {
            this.valueForceTypeCast = forceTypeCast
        }
    }
    /** Clears what a transformProjection says, before calling it */
    prepareProjection(): void {
        this.comparison = 'value'
        this.projectedType = undefined
        this.projectedTypeCategory = undefined
    }

    get index(): number | undefined {
        return this.paramIndex
    }
    get forceTypeCast(): boolean {
        const param = this.param
        return param ? !!param.forceTypeCast : this.valueForceTypeCast
    }
    set forceTypeCast(value: boolean) {
        const param = this.param
        if (param) {
            param.forceTypeCast = value
        } else {
            this.valueForceTypeCast = value
        }
    }
    setMetadata(key: symbol, value: unknown): void {
        this.param?.setMetadata(key, value)
    }
    getMetadata(key: symbol): unknown {
        return this.param?.getMetadata(key)
    }
    setProjectedType(type: string, typeCategory: TypeCategory): void {
        this.projectedType = type
        this.projectedTypeCategory = typeCategory
    }
}
