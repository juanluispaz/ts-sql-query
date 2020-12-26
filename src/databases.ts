import type { anyDBType, mariaDBType, mySqlType, nextMethodNotSupportedByThisConnection, noopDBType, oracleType, postgreSqlType, sqliteType, sqlServerType, typeSafeDBType, typeUnsafeDBType } from "./utils/symbols";

export interface AnyDB {
    [anyDBType] : 'AnyDB'
}

export interface TypeSafeDB extends AnyDB {
    [typeSafeDBType] : 'TypeSafe'
}
export type TypeWhenSafeDB<DB extends AnyDB, when, els> = DB extends TypeSafeDB ? when : els

export interface TypeUnsafeDB extends AnyDB {
    [typeUnsafeDBType] : 'TypeUnsafe'
}

export interface MariaDB extends AnyDB {
    [mariaDBType]: 'MariaDB'
}

export interface MySql extends AnyDB {
    [mySqlType]: 'MySql'
}

export interface NoopDB extends AnyDB {
    [noopDBType]: 'NoopDB'
}

export interface Oracle extends AnyDB {
    [oracleType]: 'Oracle'
}

export interface PostgreSql extends AnyDB {
    [postgreSqlType]: 'PostgreSql'
}

export interface Sqlite extends AnyDB {
    [sqliteType]: 'Sqlite'
}

export interface SqlServer extends AnyDB {
    [sqlServerType]: 'SqlServer'
}

export interface NotSupportedDB {
    /*
     * If you got here is because the method invoced next to the
     * error message is not supperted by the database used in the
     * connection, you are trying to use a feature recerved for
     * other database
     */
    [nextMethodNotSupportedByThisConnection]: 'NotSupportedDB'
}