import type { QueryContext, QueryParamContext } from '../QueryContext.js'
import type { QueryExecutionSource } from '../TsSqlError.js'
import type { CustomType } from '../TypeAdapter.js'
import { __typeCategory, type TypeCategory } from '../utils/typeCategory.js'
import type { ConnectionConfiguration, FunctionExecutingQueryInformation, QueryResultColumn } from '../queryRunners/QueryRunner.js'

/** The key of the context of the query on its params */
const queryContextKey: unique symbol = Symbol('queryContext')

/** What the library knows of a parameter; what the library writes for its own query runners has a key of its own */
export class QueryParamContextImpl implements QueryParamContext {
    originalType: string | undefined = undefined
    originalCustomType: CustomType | undefined = undefined
    requestedType: string | undefined = undefined
    requestedCustomType: CustomType | undefined = undefined
    forceTypeCast: boolean | undefined = undefined
    isValueForColumn: boolean = false
    private metadata: Map<symbol, unknown> | undefined = undefined

    /** The type the query runner sends the parameter with: the one requested */
    get sentType(): string | undefined {
        return this.requestedType
    }
    /** The category of the type the query runner sends the parameter with */
    get sentTypeCategory(): TypeCategory {
        return __typeCategory(this.requestedType, this.requestedCustomType)
    }
    /** Sets the original type of the parameter, which is also the one requested until a type adapter requests another */
    setOriginalType(type: string, customType: CustomType | undefined): void {
        this.originalType = type
        this.originalCustomType = customType
        this.requestedType = type
        this.requestedCustomType = customType
    }
    getMetadata(key: symbol): unknown {
        return this.metadata?.get(key)
    }
    setMetadata(key: symbol, value: unknown): void {
        let metadata = this.metadata
        if (!metadata) {
            metadata = new Map()
            this.metadata = metadata
        }
        metadata.set(key, value)
    }
}

/**
 * The context of a query: what its query runner reads (QueryContext), and what the library writes for its own query
 * runners (the fields below it)
 */
export class QueryContextImpl implements QueryContext {
    executionName: string | undefined = undefined
    executionMetadata: unknown = undefined
    executionSource: QueryExecutionSource | undefined = undefined
    isSelectPageCount: boolean = false
    resultColumns: readonly QueryResultColumn[] | undefined = undefined
    connectionConfiguration: ConnectionConfiguration | undefined = undefined
    private readonly params: (QueryParamContextImpl | undefined)[] = []

    /** The query has an insert with a returning clause (the SQL builder writes it, the query runner reads it) */
    containsInsertReturningClause: boolean | undefined = undefined
    /** The query has an insert, update or delete with a returning clause, or false when it has none */
    containsMutationReturningClause: boolean | undefined = undefined
    /** The number of affected rows the query runner gives, whatever the database says */
    forcedAffectedRowCount: number | undefined = undefined

    get executionStack(): string | undefined {
        return this.executionSource?.stack
    }
    get functionExecutingQuery(): FunctionExecutingQueryInformation | undefined {
        return functionExecutingQueryOf(this.executionStack)
    }
    getResultColumn(name: string): QueryResultColumn | undefined {
        return this.resultColumns?.find(column => column.name === name)
    }
    getParam(index: number): QueryParamContextImpl | undefined {
        return this.params[index]
    }
    /**
     * Gives the context of the query built, with these params, to the copy of the params of one execution of the query
     * (paramsForExecution): what the construction of the query wrote, the same; what each execution sets, its own
     */
    copyBuiltTo(context: QueryContextImpl): void {
        context.containsInsertReturningClause = this.containsInsertReturningClause
        context.containsMutationReturningClause = this.containsMutationReturningClause
        context.forcedAffectedRowCount = this.forcedAffectedRowCount
        for (let i = 0, length = this.params.length; i < length; i++) {
            context.params[i] = this.params[i]
        }
    }
    /** The context of the parameter at that index, created when it has none */
    paramAt(index: number): QueryParamContextImpl {
        let result = this.params[index]
        if (!result) {
            result = new QueryParamContextImpl()
            this.params[index] = result
        }
        return result
    }
}

/** The context of a query the library didn't build */
export const emptyQueryContext: QueryContext = Object.freeze(new QueryContextImpl())

/** The context of the query with these params, or undefined when it has none */
export function existingQueryContextOf(params: any[] | null | undefined): QueryContextImpl | undefined {
    return params ? (params as any)[queryContextKey] : undefined
}

/**
 * The context of the query with these params, hung on them, out of a listing, a spread and JSON.stringify, when they
 * have none
 */
export function queryContextOf(params: any[]): QueryContextImpl {
    let result = existingQueryContextOf(params)
    if (!result) {
        result = new QueryContextImpl()
        Object.defineProperty(params, queryContextKey, { value: result, writable: false, enumerable: false, configurable: true })
    }
    return result
}

/** The context of the parameter at that index of these params, created when it has none */
export function queryParamContextOf(params: any[], index: number): QueryParamContextImpl {
    return queryContextOf(params).paramAt(index)
}

/** The function, file, line and position of the first frame of the stack below the library, or undefined */
function functionExecutingQueryOf(stack: string | undefined): FunctionExecutingQueryInformation | undefined {
    if (!stack) {
        return undefined
    }
    const lineRegex = /^.+?\n.+?\n\s+?at(?: async)? (.+?)(?: (?:\((.+?)\)))?$/m
    const lineMatch = stack.match(lineRegex)
    if (!lineMatch) {
        return undefined
    }
    let functionName = lineMatch[1]
    if (!functionName) {
        return undefined
    }
    let file = lineMatch[2]
    if (!file) {
        file = functionName
        functionName = undefined
    }
    if (functionName === '<anonymous>') {
        functionName = undefined
    }
    if (file === '<anonymous>') {
        return undefined
    }
    const fileRegex = /^(.+?)(?:\:(\d+?)(?:\:(\d+?))?)?$/
    const fileMatch = file.match(fileRegex)
    if (!fileMatch) {
        return { functionName }
    }
    return {
        functionName,
        fileName: fileMatch[1],
        lineNumber: fileMatch[2],
        positionNumber: fileMatch[3]
    }
}

/** The context of the parameter at that index of these params, or undefined when it has none */
export function existingParamContextOf(params: any[] | null | undefined, index: number): QueryParamContextImpl | undefined {
    return existingQueryContextOf(params)?.getParam(index)
}

/**
 * A copy of the params of a query for one of its executions, with a context of its own: a query can be executed again
 * before an execution ends, and each one must keep where it was executed
 */
export function paramsForExecution(params: any[]): any[] {
    const result = params.slice()
    const executionContext = queryContextOf(result)
    existingQueryContextOf(params)?.copyBuiltTo(executionContext)
    return result
}
