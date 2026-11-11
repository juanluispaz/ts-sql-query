// ts-sql-query/queryRunners/MockQueryRunner: the path of version 1, kept so that code written for it keeps compiling. Each name says where
// it is imported from in version 2

export {
    /** @deprecated Import it from 'ts-sql-query' */
    type MockQueryExecutor,
    /** @deprecated Import it from 'ts-sql-query' */
    MockQueryRunner,
    /** @deprecated Import it from 'ts-sql-query' */
    type MockQueryRunnerConfig,
    /** @deprecated Import it from 'ts-sql-query' */
    type QueryType,
    /** @deprecated Use MockQueryExecutor, imported from 'ts-sql-query' */
    type MockQueryExecutor as QueryExecutor,
} from '../../v2/index.js'
