import type { TsSqlErrorReason } from "../TsSqlError.js"
import type { DataTypeClass, SqlDataType } from '../TypeAdapter.js'
import type { DataTypeName } from '../typeSystem/dataTypeNames.js'

/**
 * What a connection uses to reach the database: it executes the SQL the connection writes, through a driver, and gives
 * back the result in the shape of each type of query. A connection receives it when it is created; a query runner of
 * the library is made for a driver (`PgPoolQueryRunner` for the pool of `pg`), and a general-purpose one wraps another
 * to log or intercept the queries (`InterceptorQueryRunner`), or takes the place of the database (`MockQueryRunner`).
 */
export interface QueryRunner {
    /** The database the SQL is written for */
    readonly database: DatabaseType
    /**
     * Called by the connection when it receives the query runner, with the database of the connection; a query runner
     * that can't work with that database throws
     */
    useDatabase(database: DatabaseType): void
    /** The driver's object the query runner was created with: a connection, or a pool */
    getNativeRunner(): unknown
    /**
     * The driver's connection the current transaction runs on, or undefined outside a transaction. A pool query runner
     * takes it from the pool with the first statement of the transaction, and has none before: execute gives it always
     */
    getCurrentNativeConnection(): unknown
    /**
     * Calls fn with a connection of the driver on which to run statements: inside a transaction, the one the
     * transaction runs on (taken from the pool, and the transaction begun on it, when it had none yet); outside a
     * transaction, the query runner's connection, or one taken from the pool for fn alone and given back when the
     * promise fn returns ends. mssql only gives a connection of its pool for a transaction: outside one, fn receives the
     * pool
     */
    execute<RESULT>(fn: (connection: unknown) => Promise<RESULT>): Promise<RESULT>
    /**
     * Executes a query and gives its result in the shape its type asks for:
     * - `selectOneRow` and the `...ReturningOneRow`: the row, or undefined without one;
     * - `selectManyRows` and the `...ReturningManyRows`: the rows;
     * - `selectOneColumnOneRow`, the `...ReturningOneColumnOneRow`, `insertReturningLastInsertedId` and
     *   `executeFunction`: the value of the only column of the row, or undefined without a row;
     * - `selectOneColumnManyRows`, the `...ReturningOneColumnManyRows` and `insertReturningMultipleLastInsertedId`: the
     *   value of the only column of each row;
     * - `insert`, `update` and `delete`: the number of rows they changed;
     * - `executeProcedure`, `executeDatabaseSchemaModification` and `executeConnectionConfiguration`: nothing.
     *
     * A query that must give one row and gives more is rejected with `MORE_THAN_ONE_ROW`, and one that must give one
     * column and gives more, with `ONLY_ONE_COLUMN_EXPECTED`. The statements of a transaction have methods of their own.
     */
    executeQuery<TYPE extends ExecutableQueryType>(queryType: TYPE, query: string, params: any[]): Promise<QueryResultOf<TYPE>>
    /** Begins a transaction, with the isolation level and the access mode requested */
    executeBeginTransaction(opts?: BeginTransactionOpts): Promise<void>
    /** Commits the current transaction */
    executeCommit(opts?: CommitOpts): Promise<void>
    /** Rolls the current transaction back */
    executeRollback(opts?: RollbackOpts): Promise<void>
    /**
     * Runs fn in a transaction: begins it, and commits it when the promise fn returns resolves or rolls it back when it
     * rejects. The statements of the transaction go through outermostQueryRunner, the query runner the connection
     * received, so a wrapper sees them; a driver that begins and ends the transaction by itself, in a function it
     * receives, says so with executeInTransactionCallsBeginAndCommit
     */
    executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner, opts?: BeginTransactionOpts): Promise<T>
    /** Whether a transaction is open on the query runner */
    isTransactionActive(): boolean
    /**
     * Adds the value to the params and returns its placeholder, the final one as it is written in the SQL. `type` is
     * the type the value is sent as: its class, or the name of a built-in or registered data type; undefined when it
     * isn't known, and the query runner works it out from the value, as the driver does. The library keeps what it
     * knows of the parameter in the context of the query (`getQueryContext(query, params).getParam(index)`, the index
     * being the length of the params before the value is added) before it calls this method, and gives the type
     * requested for it: the context also has the original type, the SQL data types, whether it is the value of a
     * column, and forceTypeCast, which tells the database must receive the type of the parameter, because the position
     * where it is written in the SQL gives it none: the query runner writes a cast in the placeholder, or sends the
     * parameter with its type when the driver can. A parameter added to SQL written by hand has no context: the query
     * runner gives it one with the type given, as original and requested, so it is sent as a value of that type.
     */
    addParam(params: any[], value: any, type: DataTypeName | DataTypeClass | undefined): string
    /** Adds an out parameter (only on Oracle), of the type given, as addParam */
    addOutParam(params: any[], name: string, type: DataTypeName | DataTypeClass | undefined): string
    /**
     * Resolves a value that may or may not already be a promise into a promise of the query runner's provider: like
     * `Promise.resolve`, it adopts a thenable and wraps a plain value. Keeping every result on the provider of the query
     * runner is what lets a synchronous one (like `SynchronousPromise`) drive the whole chain without deferring.
     */
    createResolvedPromise<RESULT>(result: RESULT | PromiseLike<RESULT>): Promise<RESULT>
    /** A promise of the query runner's provider rejected with the error */
    createRejectedPromise<RESULT = any>(error: any): Promise<RESULT>
    /** Runs fn1 and then fn2, and gives both results: the two queries of a page */
    executeCombined<R1, R2>(fn1: () => Promise<R1>, fn2: () => Promise<R2>): Promise<[R1, R2]>
    /** Whether the query runner takes the place of a database (`MockQueryRunner` and the ones made from it) */
    readonly isMocked: boolean
    /** Whether connection.beginTransaction(), commit() and rollback() can be used, as separate calls */
    readonly lowLevelTransactionManagementSupported: boolean
    /**
     * Whether executeInTransaction goes through executeBeginTransaction, executeCommit and executeRollback of the
     * outermost query runner. When the driver begins and ends the transaction by itself, in a function it receives, a
     * wrapper doesn't see those statements, and it must show them itself.
     */
    readonly executeInTransactionCallsBeginAndCommit: boolean
    /** Whether a transaction can begin inside another one */
    readonly nestedTransactionsSupported: boolean
    /** The reason of an error the driver gave, as the library names it (`UNIQUE_VIOLATION`, `DEADLOCK`, …) */
    getErrorReason(error: unknown): TsSqlErrorReason
    /** Whether an error comes from the database or the driver, and not from the code of the application */
    isSqlError(error: unknown): boolean
}

/** The databases of the library; 'noopDB' is the one of a connection that writes SQL for no database in particular */
export type DatabaseType = 'mariaDB' | 'mySql' | 'noopDB' | 'oracle' | 'postgreSql' | 'sqlite' | 'sqlServer'

/** The types of query and statement a query runner executes, the shape of their result included (see executeQuery) */
export type QueryType = 'selectOneRow' | 'selectManyRows' | 'selectOneColumnOneRow' | 'selectOneColumnManyRows' |
    'insert' | 'insertReturningLastInsertedId' | 'insertReturningMultipleLastInsertedId' |
    'insertReturningOneRow' | 'insertReturningManyRows' | 'insertReturningOneColumnOneRow' | 'insertReturningOneColumnManyRows' |
    'update' | 'updateReturningOneRow' | 'updateReturningManyRows' | 'updateReturningOneColumnOneRow' | 'updateReturningOneColumnManyRows' |
    'delete' | 'deleteReturningOneRow' | 'deleteReturningManyRows' | 'deleteReturningOneColumnOneRow' | 'deleteReturningOneColumnManyRows' |
    'executeProcedure' | 'executeFunction' | 'beginTransaction' | 'commit' | 'rollback' |
    'executeDatabaseSchemaModification' | 'executeConnectionConfiguration'

/** The types of query executeQuery executes: every one but the statements of a transaction */
export type ExecutableQueryType = Exclude<QueryType, 'beginTransaction' | 'commit' | 'rollback'>

/**
 * What executeQuery gives for each type of query: the rows (`any[]`) or the value of a column of each row, the number
 * of rows changed, nothing, or one row or one value (`any`, undefined without a row)
 */
export type QueryResultOf<TYPE extends ExecutableQueryType> =
    TYPE extends 'selectManyRows' | 'insertReturningManyRows' | 'updateReturningManyRows' | 'deleteReturningManyRows'
        | 'selectOneColumnManyRows' | 'insertReturningMultipleLastInsertedId' | 'insertReturningOneColumnManyRows'
        | 'updateReturningOneColumnManyRows' | 'deleteReturningOneColumnManyRows' ? any[]
    : TYPE extends 'insert' | 'update' | 'delete' ? number
    : TYPE extends 'executeProcedure' | 'executeDatabaseSchemaModification' | 'executeConnectionConfiguration' ? void
    : any

/** The constructor of the promises a query runner gives, like `Promise` or `SynchronousPromise` */
export type PromiseProvider = PromiseConstructorLike & {
    resolve: typeof Promise.resolve,
    reject: typeof Promise.reject,
    /* Not all providers have compatible interface, by example:
        * synchronous-promise doesn't provide an definition so detailed like the ones included in the standar library
        */
    // all: typeof Promise.all, 
    // all(values: any[]): Promise<any[]>, 
    /* Not all providers support it, by example: 
        * synchronous-promise doesn't provide an implementation of it
        */
    // race: typeof Promise.race, 
    /* So new, introduced in ES2020. Not all providers have compatible interface, by example:
        * synchronous-promise doesn't provide an definition compatible with the ones included in the standar library
        */
    // allSettled: typeof Promise.allSettled
}

// `[undefined, accessMode]` when only an access mode was requested
/** The options of the begin of a transaction: its isolation level and its access mode */
export type BeginTransactionOpts = [transactionLevel?: 'read uncommitted' | 'read committed' | 'repeatable read' | 'snapshot' | 'serializable' | undefined, accessMode?: 'read write' | 'read only' | undefined]
/** The options of a commit: none */
export type CommitOpts = []
/** The options of a rollback: none */
export type RollbackOpts = []

/**
 * The configuration of the connection that executes a query: the connection itself, as its SQL builder reads it, so
 * each value is the one the connection has when it is read, field initialisers of a subclass included. A setting that
 * a database doesn't have is undefined on its connection.
 */
export interface ConnectionConfiguration {
    /** Whether an empty string is a value (`allowEmptyString`); when false, the library treats it as no value */
    readonly allowEmptyString: boolean
    /**
     * The identifier written in the SQL: quoted when it is a reserved word or has a space, or, when `strict`, when it
     * isn't made only of letters, digits and underscores. With `allowReservedKeyword` a reserved word is kept as it is
     * (the name of a function or a procedure)
     */
    escape(identifier: string, strict: boolean, allowReservedKeyword?: boolean): string
    /** The SQL data type of a type of the database of the connection, as its catalogue writes it (`sqlDataTypeFrom` of the connection) */
    sqlDataTypeFrom(nativeName: string): SqlDataType
    /**
     * The type of the database of the connection for a SQL data type, for its version and strategies; undefined when it
     * can't hold it (`nativeSqlDataTypeOf` of the connection, built once for each SQL data type)
     */
    nativeSqlDataTypeOf(sqlDataType: SqlDataType): string | undefined
    /** The collation the insensitive operations use (`insensitiveCollation`) */
    readonly insensitiveCollation?: string
    /** SQLite: the format a value of the type `'date'`, `'time'` or `'dateTime'` is stored with */
    getDateTimeFormat?(type: string): string
    /** The minimum version of the database the SQL must support (`compatibilityVersion`) */
    readonly compatibilityVersion: number
    /** MariaDB, MySQL, Oracle and SQLite: how a uuid is stored (`uuidStrategy`) */
    readonly uuidStrategy?: string
    /**
     * Round with the function of the database as it is (`usePlatformDependentRound`): MariaDB, MySQL and PostgreSQL its
     * ties, and every database the scale of roundn
     */
    readonly usePlatformDependentRound?: boolean
    /** SQL Server: a uuid and its text are given in upper case, as the database gives them (`useUpperCaseUuid`) */
    readonly useUpperCaseUuid?: boolean
    /**
     * MariaDB: the session computes the assignments of an update with the row before it (`SIMULTANEOUS_ASSIGNMENT` in
     * its `sql_mode`), declared with `useSimultaneousAssignment`
     */
    readonly useSimultaneousAssignment?: boolean
    /** Oracle, PostgreSQL, SQL Server and SQLite: the functions of the library are in the database (`libraryFunctions`): `'installed'` or `'not installed'` */
    readonly libraryFunctions?: string
    /** PostgreSQL: write the insensitive comparisons with `like` instead of `ilike` (`useLikeInsteadOfIlike`) */
    readonly useLikeInsteadOfIlike?: boolean
    /** SQLite: how an exact decimal is computed and compared (`decimalStrategy`) */
    readonly decimalStrategy?: string
    /** SQLite: the date and time functions of the database work in the time zone of the application */
    readonly sqliteRunsInApplicationTimeZone?: boolean
    /** The zone of the database, an IANA name (`databaseTimeZone`); `'UTC'` by default */
    readonly databaseTimeZone?: string
    /** The day of the date a month of a year is stored in (`dayOfStoredYearMonths`, 1 by default) */
    readonly dayOfStoredYearMonths?: number
    /** The year of the date a day of a month is stored in (`yearOfStoredMonthDays`, 1972 by default) */
    readonly yearOfStoredMonthDays?: number
    /** Oracle: the date of a column of a date that stores only a time of the day (`dateOfStoredTimes`, `'1972-01-01'` by default) */
    readonly dateOfStoredTimes?: string
    /**
     * With a databaseTimeZone other than UTC, the date a time of the day is converted between the zone of the database
     * and UTC with (`dateToConvertTimesBetweenZones`, `'1972-01-01'` by default, a date or `'today'`)
     */
    readonly dateToConvertTimesBetweenZones?: string
    /** SQLite: an integer read where a date or time with another format was expected is a Julian day */
    readonly treatUnexpectedIntegerDateTimeAsJulian?: boolean
    /** SQLite: a text without time zone read where a date or time with another format was expected is in UTC */
    readonly treatUnexpectedStringDateTimeAsUTC?: boolean
    /** SQLite: a Unix time read where a date or time with another format was expected is in milliseconds */
    readonly unexpectedUnixDateTimeAreMilliseconds?: boolean
    /** SQL Server: the length of a text excludes its trailing blanks (`excludeTrailingBlanksInLength`) */
    readonly excludeTrailingBlanksInLength?: boolean
    /** PostgreSQL and SQL Server: the smaller and greater of two values ignore a null (`ignoreNullInMinAndMaxValue`) */
    readonly ignoreNullInMinAndMaxValue?: boolean
    /** Oracle: how a boolean is stored, `'number'` (`NUMBER(1)`, 1 / 0) or `'boolean'` (`BOOLEAN`, Oracle 23ai) (`booleanStorage`) */
    readonly booleanStorage?: string
    /** Oracle: a concatenation reads a null as the empty string (`ignoreNullInConcat`) */
    readonly ignoreNullInConcat?: boolean
    /** Oracle and SQL Server: the collation of `replace` (`replaceCollation`) */
    readonly replaceCollation?: string | undefined
    /** Oracle: the collation of the insensitive `replace` (`replaceInsensitiveCollation`) */
    readonly replaceInsensitiveCollation?: string | undefined
}

/**
 * A column of the result of the query, as the query builder will read it: the key of the column in a row the database
 * returns, the property path in the result object, and its two types: the original one, declared in the library, and
 * the one requested for the value the database returns (by default the original one; a type adapter can request another
 * in its `transformProjection`, like the text of a date).
 */
export interface QueryResultColumn {
    /** The key of the column in a row returned by the database; '' when the SQL gives the column no alias */
    readonly name: string
    /** The property path in the result object (`customer.name`), `result` for a single value, '' without one */
    readonly path: string
    /** The original type, its class (`IntType`, the class of a type of the user, the one of an aggregated array) */
    readonly originalType: DataTypeClass
    /** The type of the value the database returns for the column, its class */
    readonly requestedType: DataTypeClass
    /** The type of the column in the database, the one its type adapter says (`withSqlDataType`), or undefined */
    readonly originalSqlDataType?: SqlDataType | undefined
    /** The type in the database of the value the database returns for the column: the original one, unless its transformProjection requested another */
    readonly requestedSqlDataType?: SqlDataType | undefined
}

/** Where the query was executed from, as the stack of the call says */
export interface FunctionExecutingQueryInformation {
    /** The name of the function that executed the query */
    functionName?: string | undefined,
    /** The file of that function */
    fileName?: string | undefined,
    /** The line in that file */
    lineNumber?: string | undefined,
    /** The column in that line */
    positionNumber?: string | undefined
}
