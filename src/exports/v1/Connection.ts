// ts-sql-query/Connection: the path of version 1, kept so that code written for it keeps compiling. Each name says where
// it is imported from in version 2

export {
    /** @deprecated Import it from 'ts-sql-query' */
    type Connection,
    /** @deprecated Use Connection, imported from 'ts-sql-query' */
    type Connection as TyeSafeConnection,
    /** @deprecated Use Connection, imported from 'ts-sql-query' */
    type Connection as TyeUnsafeConnection,
} from '../v2/index.js'
