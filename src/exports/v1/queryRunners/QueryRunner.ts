// ts-sql-query/queryRunners/QueryRunner: the path of version 1, kept so that code written for it keeps compiling. Each name says where
// it is imported from in version 2

export {
    /** @deprecated Import it from 'ts-sql-query' */
    type DatabaseType,
    /** @deprecated Import it from 'ts-sql-query' */
    type FunctionExecutingQueryInformation,
    /** @deprecated Import it from 'ts-sql-query' */
    type PromiseProvider,
    /** @deprecated Import it from 'ts-sql-query' */
    type QueryRunner,
    /** @deprecated Import it from 'ts-sql-query' */
    type QueryType,
} from '../../v2/index.js'

// The readers of version 1, replaced in version 2 by the context of the query (getQueryContext): they read it

import { getQueryContext, type FunctionExecutingQueryInformation } from '../../v2/index.js'

/** @deprecated Use getQueryContext(query, params).executionName, from 'ts-sql-query' */
export function getQueryExecutionName(query: string, params: any[]): string | undefined {
    return getQueryContext(query, params).executionName
}
/** @deprecated Use getQueryContext(query, params).executionMetadata, from 'ts-sql-query' */
export function getQueryExecutionMetadata(query: string, params: any[]): unknown {
    return getQueryContext(query, params).executionMetadata
}
/** @deprecated Use getQueryContext(query, params).executionStack, from 'ts-sql-query' */
export function getQueryExecutionStack(query: string, params: any[]): string | undefined {
    return getQueryContext(query, params).executionStack
}
/** @deprecated Use getQueryContext(query, params).functionExecutingQuery, from 'ts-sql-query' */
export function getFunctionExecutingQuery(query: string, params: any[]): FunctionExecutingQueryInformation | undefined {
    return getQueryContext(query, params).functionExecutingQuery
}
/** @deprecated Use getQueryContext(query, params).isSelectPageCount, from 'ts-sql-query' */
export function isSelectPageCountQuery(query: string, params: any[]): boolean {
    return getQueryContext(query, params).isSelectPageCount
}
