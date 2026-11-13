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

export {
    /** @deprecated Use getQueryContext(query, params).functionExecutingQuery, from 'ts-sql-query' */
    getFunctionExecutingQuery,
    /** @deprecated Use getQueryContext(query, params).executionMetadata, from 'ts-sql-query' */
    getQueryExecutionMetadata,
    /** @deprecated Use getQueryContext(query, params).executionName, from 'ts-sql-query' */
    getQueryExecutionName,
    /** @deprecated Use getQueryContext(query, params).executionStack, from 'ts-sql-query' */
    getQueryExecutionStack,
    /** @deprecated Use getQueryContext(query, params).isSelectPageCount, from 'ts-sql-query' */
    isSelectPageCountQuery,
} from '../../../queryRunners/QueryRunner.js'
