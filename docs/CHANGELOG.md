# Change Log

## v1.57.0 (5 Jan 2024)

**Changes**:

- Allow to defer the execution of a logic till just before the transaction's commit.
- Add support to execute the queries using an [@sqlite.org/sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm) [Object Oriented API 1](https://sqlite.org/wasm/doc/trunk/api-oo1.md) in Web Assembly.

## v1.56.0 (28 Aug 2023)

**Bug fixes**:

- Fix `inIfValue` and `notInIfValue` forcing include the optional join when it is not required.
- Fix subquery used as boolean value in a sql fragment when it is not on SqlServer or Oracle databases.

## v1.55.0 (27 Aug 2023)

**Changes**:

- Add support to projecting optional values in an object as nullable in the output of select, insert, update, delete and aggregate array. This make the optional property required as nullable in the projected value.

**Documentation changes**:

- Reorganize documentation to put select related documentation next to each other.
- Updating mkdocs, code highlight.
- Including Google search functionality complementary to the build-in search.
- Change log excluded from the search output.
- Improve build-in search.
- Move "Composing recursive query as an array of objects in two requests" documentation to the "Composing and splitting results (legacy)" page.

**Bug fixes**:

- Fix the error indicating there is no transaction active when `executeConnectionConfiguration` is executed before any other query immediately after opening a transaction.

## v1.54.0 (27 Jun 2023)

**Changes**:

- Deprecate AnyDB, LoopBack and tedious-connection-pool query runners due their respective projects are dead.
- Implement `executeConnectionConfiguration` in the query runner, allowing you to execute raw queries that modify the connection configuration.
- MariaDB and MySql don't support nested transactions, but instead of throwing an error, it silently finishes the previous one; when this circumstance is detected, an error with be thrown to avoid dangerous situations.
- Add support to `beforeQuery` custom SQL fragment when queries are customized.

**Documentation changes**:

- Update tedious query runner documentation to don't use tedious-connection-pool and add a note requesting information to the users to explain how to use it with a proper pool.
- Mark compose and split functionality as legacy with the intention to be deprecated in the future. Documentation of this functionality moved to a single place.

## v1.53.0 (11 Apr 2023)

**Changes**:

- Allow extend the rules in a dynamic condition to provide own rules not included by ts-sql-query
- Ensure tall types returned by `dynamicCondition` are readable

**Bug fixes**:

- Fix missing rules for comparison in the type created using `DynamicCondition` when the database types are used
- Fix invalid cast using `fromRef` not reported by the typescript (now you will get a compilation error)
- Fix `dynamicPickPaths` not picking the inner properties
- Fix left join property marked as optional when it is used in a complex projection and with dynamic picking columns

## v1.52.0 (10 Apr 2023)

**Changes**:

- Add support `dynamicPickPaths` to work with a list of fields to pick, and implement `expandTypeFromDynamicPickPaths` utility function to rectify the query output when the list of fields to pick is a generic type (Previously experimental)
- Implement insert/update shape that allows controlling the structure of the object to use to set the value (Previously experimental in update)
- Add support to update multiple tables in a single update in MariaDB and MySql (Previously experimental)
- Add support to Oracle recursive queries using `connect by` syntax
- Extend utility types and functions to filter by the id columns
- Add `PickValuesPath` utility function that allows getting the result of a select query given the fields to pick picked paths
- Extend the `DynamicCondition`, allowing to use fields of the dynamic condition as an argument
- Add `PickValuesPathWitAllProperties` utility type that allows getting the type of each element returned by a select picking columns
- Extend `SelectedValues` and `SelectedRow`, allowing to use of complex projections
- Implement `selectCountAll()` as a shortcut to `selectOneColumn(connection.countAll())` that doesn't return an optional value when the query is used as an inline value (removing in this way the current limitation)
- Add support to order by a column not returned by the select (removing in this way the current limitation)
- Allow `ignoreIfSet` over a required property in an insert
- Add `keepOnly` method that allows filtering the columns to be set in an insert or update
- Allow the dynamic set to receive as an argument the initial values to set
- Add support to dynamic set on an insert with multiple rows (removing in this way the current limitation)
- Add support to throw an error if some columns are set or have value in an insert or update. New methods in insert and update: `disallowIfSet`, `disallowIfNotSet`, `disallowIfValue`, `disallowIfNotValue`, `disallowAnyOtherSet`
- Add support to manipulate the data to insert or update conditionally
- Allow the insert do `dynamicSet` or `dynamicValues` using an object where a required property is optional

**Documentation changes**:

- Document how to define select picking functions in base on the business types or in base on the database types
- Add documentation regarding data manipulation in insert/update. Before, it was not clear this functionality existed because it was only mentioned in the supported operations

**Bug fixes**:

- Fix `expandTypeFromDynamicPickPaths` (Previously experimental) to work with all kinds of output produced when a query is executed
- Make dynamic pick columns work with complex projections in case a property with a group with several columns is not picked

## v1.51.0 (23 Mar 2023)

**Bug fixes**:

- Fix infinite loop by discovering the optional joins used in the query
- Fix infinite recursive function call in `ChainedQueryRunner` for the `execute` method

**Internal changes**:

- Add support to run all the tests natively in Apple M1 except for loopback and oracle
- Add support to run oracle tests in an x86 emulated docker and using node running under rosetta

## v1.50.0 (6 Mar 2023)

**Bug fixes**:

- Fix `valueWhenNull` in SqlServer
- Major rework on custom booleans to fix several bugs

## v1.49.0 (19 Feb 2023)

**Changes**:

- Add utility types `UpdatableOnInsertConflictRow` and `UpdatableOnInsertConflictValues` to represent updatable values in case of conflict on insert

**Experimental changes**:

- Implement `dynamicPickPaths` to work with a list of fields to pick, and implement `expandTypeFromDynamicPickPaths` utility function to rectify the query output when the list of fields to pick is a generic type
- Implement update's `shapeAs` that allow controlling the structure of the object to use to set the value
- Implement update multiple tables in a single update in MariaDB and MySql

**Bug fixes**:

- Fix boolean value binding for Oracle
- Fix worng count in a select page query when the distinct modifier is used

## v1.48.0 (16 Jan 2023)

**Bug fixes**:

- Fix typo in generated sql when the `sqrt` function is used
- Fix internal error when an empty array is provided in a `in` or `notIn` methods in Sqlite, MariaDB and MySql

**Documentation changes**:

- Fix typo (confict → conflict)
- Mention term "upsert" for easier discoverability

## v1.47.0 (15 Dec 2022)

**Bug fixes**:

- Fix wrong count on `executeSelectPage` when a `groupBy` is used

## v1.46.0 (15 Dec 2022)

**Changes**:

- Add `onlyWhenOrNull` and `ignoreWhenAsNull` methods that allows to create an expression that only applies if a certain condition is met; otherwise, the value will be null

**Bug fixes**:

- Fix error in type definition introduced in ts-sql-query 1.42.0 that make optional properties appears as required in the query result due an over relaxed validation

## v1.45.0 (14 Dec 2022)

**Changes**:

- Allow to use `dynamicPick` over tables and views past as parameter to a function
- Improve `dynamicPick` to work with columns coming from other `dynamicPick` and to work with complex projections
- Improve `extractColumnsFrom` and `extractWritableColumnsFrom` to receive a second optional argument with the properties to exclude
- Add utilities functions `extractColumnNamesFrom` and `extractWritableColumnNamesFrom` that allows to get the column names from a table or view

**Documentation changes**:

- Add to the FAQs ts-sql-codegen that allows to generate the tables/views models from the database

**Internal changes**:

- Improve Github CI to remove some deprecated warning and include Node 18.x in the tests

## v1.44.0 (13 Dec 2022)

**Changes**:

- Add `beforeWithQuery` and `afterWithQuery` select query customizations
- Add utility types to allow pass tables and views as parameter

**Documentation changes**:

- Add FAQs & limitations section to the documentation 
- Document select queries that references outer tables

## v1.43.0 (6 Dec 2022)

**Changes**:

- Add support to [porsager/postgres](https://github.com/porsager/postgres) (aka postgres.js)

## v1.42.0 (5 Dec 2022)

**Changes**:

- Relax utility types to allow use in partial objects. This allows using `Omit` or `Pick` in combination with the utility types. Example: `type PickValues<COLUMNS, KEYS extends keyof COLUMNS> = SelectedValues<Pick<COLUMNS, KEYS>>;`

## v1.41.0 (27 Nov 2022)

**Changes**:

- Implement `nullIfValue` function that returns null when the provided value is the same otherwise return the initial value
- Add support to values construction that allows to create a "view" for use in the query with a list of constant provided values
- Add support to param placeholder customisation, allowing to include type cast in the generated sql query for the param

**Documentation changes**:

- Fix DBConnection typo in examples and documentation

**Bug fixes**:

- Fix internal error when optional joins are used in a select page query
- Fix internal error when `join(...).on(...).and/or` pattern is used
- Fix wrong month number sent to the database when a text representation of the date is used in Sqlite
- Fix `getMonth` method returning wrong value (The returning value must follow JS's Date definition) in PostgreSQL, Sqlite, MariaDB, MySQL, Oracle and SqlServer
- Fix `getSeconds`, `getMilliseconds` over a date/time in Oracle
- Fix `getDay`, `getSeconds`, `getMilliseconds` and `getTime` over a date/time in Oracle

## v1.40.0 (30 Oct 2022)

**Bug fixes**:

- Fix missing parenthesis in a subtraction of a subtraction

## v1.39.0 (21 Oct 2022)

**Changes**:

- Add support to the `returning` clause in MariaDB in `insert` and `delete` (`update` not supported yet by MariaDB)
- Add support to Prisma 4

## v1.38.0 (29 Sep 2022)

**Bug fixes**:

- Fix select page count when a group by is used

## v1.37.0 (23 Sep 2022)

**Changes**:

- Implement `allowWhen` and `disallowWhen` that throws an error if the expression is used in the final query

**Documentation changes**:

- Fix copy&paste on update documentation refering delete

**Bug fixes**:

- Fix `minValue` and `maxValue` returning wrong value
- Fix missing `with` query when a query in a `with` clause depends on another `with` query

## v1.36.0 (31 Aug 2022)

**Bug fixes**:

- Fix invalid uuid type in a reusable fragment

## v1.35.0 (29 Aug 2022)

**Bug fixes**:

- Fix wrong return type of `min` and `max` functions in the connection

## v1.34.0 (17 Aug 2022)

**Changes**:

- Add `valueWhenNoValue` function that allows to return a value when null or undefined were provided to the *IfValue function

## v1.33.0 (16 Aug 2022)

**Bug fixes**:

- Fix "Invalid double value received from the db" when the database send a number as string with trailing 0

## v1.32.0 (15 Aug 2022)

**Changes**:

- Implement `onlyWhen` and `ignoreWhen` function that allows ignoring a boolean expression under a condition
- Add support to virtual columns on tables and views
- Implement the types `InsertableValues`, `UpdatableValues` and `SelectedValues` that allows to get the types for an insert, update and select with the proper types defined in the table without the other sql objects

## v1.31.0 (8 Aug 2022)

**Bug fixes**:

- Fix misspelling in `left outer join`

## v1.30.0 (21 Jul 2022)

**Bug fixes**:

- Fix optional join not omitted when an `IfValue` is used and there is no value

## v1.29.0 (28 Jun 2022)

**Changes**:

- Export helper types in extras to retrieve row types when insert, update and select
- Include timestamps in `LoggingQueryRunner` callbacks
- Make the `ConsoleLogQueryRunner` more configurable so that it can output results, timestamps and durations as well

**Bug fixes**:

- Fix insert default values on TypeScript 3.5 or higher
- Unable to compile ts-sql-query with TypeScript 4.7

## v1.28.0 (23 May 2022)

**Changes**:

- Add compatibility mode to MySql to avoid use the with clause not supported by MySql 5
- Add support to reference current value and value to insert in an insert on conflict do update

## v1.27.0 (11 Apr 2022)

**Documentation changes**:

- Add the insert on conflict methods to the supported operation documentation page

**Bug fixes**:

- Fix TS4029 error when you need to emit the type definition (for use in a library) of the files that contains the database, tables and views
- Avoid database connection leaks due a forbidden concurrent usage of a pooled query runner

## v1.26.0 (20 Mar 2022)

**Changes**:

- Add support to "insert on conflict do nothing" and "insert on conflict do update" on PostgreSql, Sqlite, MariaDB and MySql
- Add support to specify raw sql fragment in the order by; allowing complex order by in the select query
- Allow insert, update and delete in raw sql fragments

**Documentation changes**:

- Add a demo video to the documentation

**Bug fixes**:

- Fix infinite instantiation in newer versions of TypeScript

## v1.25.0 (9 Jan 2022)

**Changes**:

- Implements `forUseAsInlineAggregatedArrayValue` function, that allows to transform a query in create an array value of a single column (if it is single-column query), or an object where the rows are represented as an object
- Implements `aggregateAsArray` aggregation function, that allows to create an value that contains, per each row, an array of a single column, or an array with several columns represented as an object
- Add support to the `uuid` type
- Add support to `orderByFromStringIfValue`, `limitIfValue` and `offsetIfValue`
- Add support to subqueries that contains with clause with external/contextual dependencies
- Add support to compose over optional properties
- Add support to `withOptionalMany` composing rule that allows to use undefined instead of an empty array when no value
- Detect invalid queries in SqlServer, Oracle and MariaDB when an outer reference is used to create a query that is not supported by the database because no outer references are allowed in inner with, or, in MariaDB, no outer references are allowed in inner from
- Combine multiple concat expressions in a single concat function call in MySql and MariaDB

**Documentation changes**:

- Add a note in the `mergeType` function documentation warning about the reader evaluate the preferred alternatives first

**Bug fixes**:

- Fix invalid query when a table alias is specified in Oracle
- Fix invalid recursive query in Sql Server
- Fix invalid recursive query in Oracle
- Fix invalid query when `contains` method of a string value source is called in MySql/MariaDB
- Fix `substrToEnd`, `substringToEnd`, `substr` and `substring`: now the index is according to JavaScript definition (the count start in 0) and the parameters have the correct type
- Fix invalid type when a mathematical function is used and the provided value is not the same type that the column

## v1.24.0 (21 Dec 2021)

**Changes**:

- Manage complex projections in compound operations (union, intercept, etc.)
- Ensure the dynamic conditions cannot create conditions when null/undefined values are provided to functions that doesn't expect it
- Detect when null/undefined values are provided to an operation with a value coming from a left join where a not null/undefined value must be provided
- Deprecate all value source methods overload that can produce unexpected falsy/null values because the provided value in JavaScript is null or undefined. Now all value source methods doesn't admit null or undefined values (except the `*IfValue`, `is`, `isNot` methods). In the odd case you need to use a nullable value from JavaScript, and you want to maintain the falsy/null output use an optional constant with the JavaScript value
- Add the methods `trueWhenNoValue` and `falseWhenNoValue` to allows specify a boolean value when the `*IfValue` function produces no value. This can help to manage optional values coming from JavaScript in complex logic without need to use the deprecated methods that can produce unexpected falsy/null values
- Allows to negate the result of a `*IfValue` function
- Improve boolean expression reduction when the negate method is used
- Detect invalid columns to be returned in a select (non-string key)

**Preview of upcoming changes**:

- Implements `aggregateAsArray` aggregation function, that allows to create an value that contains, per each row, an array of a single column, or an array with several columns represented as an object
- Add support to subqueries that contains with clause with external/contextual dependencies

**Documentation changes**:

- Clean up `sync` helper function to handle synchronous promises in BetterSqlite3 with a stricter typing and better readability

**Bug fixes**:

- Ensure any boolean operation apply over a boolean created using `dynamicBooleanExpressionUsing` is asignable to the initial type
- Fix invalid result type of calling `asOptional` or `asRequiredInOptionalObject` when the type is different to `int`
- Fix BetterSqlite3 implementation that returns a real promise instead of a synchronous promise when there is no columns to set

## v1.23.0 (8 Dec 2021)

**Changes**:

- Add support to complex projections, that allows to create inner objects in the result of a query
- Detect invalid query when a table in the from of an update appears in the returning clause in sqlite. Now it verify the restriction 7 of the returning clause in Sqlite
- Add support for Prisma 3
- Add support for the interactive transactions in Prisma

**Documentation changes**:

- Add test strategy information

**Bug fixes**:

- Fix MariaDB/MySql `stringConcat` when an empty separator is used

## v1.22.0 (24 Oct 2021)

**Changes**:

- Deprecate `replace` method in favour of `replaceAll` in the string value source to align with JavaScript
- Add the `substr` and `substrToEnd` to the string value source to align with JavaScript and respect the real available implementation in the databases
- Add support to create complex dynamic boolean expression using the `dynamicBooleanExpresionUsing` method in the connection object. It allows to create programmatically dynamically complex boolean expressions instead of declarative dynamically conditions using the `IfValue` functions. It is recommend to use the `IfValue` functions when it is possible
- Add `mergeType` utility function to deal with advanced dynamic queries when a variable ended with type a union of several types of value source. This function allows to resolve the union type in a single value source type

**Documentation changes**:

- Combine all topics related to dynamic queries in a single page to avoid confusion
- Improve documentation style

**Bug fixes**:

- Fix broken `substring` implementation in the string value source

## v1.21.0 (22 Oct 2021)

**Changes**:

- Added a new general query runner: InterceptorQueryRunner

**Bug fixes**:

- Fix error lost that was throw by a logger in a LogginQueryRunner

## v1.20.0 (14 Oct 2021)

**Changes**:

- Add support to scalar queries, that is an inline select query as value for another query
- Add support to insert returning on databases that support it (PostgreSql, SqlServer, Oracle, modern Sqlite)
- Add support to update returning on databases that support it (PostgreSql, SqlServer, Oracle, modern Sqlite)
- Add support to update returning old values on databases that support it (SqlServer)
- Add support to update returning old values on databases where it can be emulated in a single query (PostgreSql)
- Add support to delete returning on databases that support it (PostgreSql, SqlServer, Oracle, modern Sqlite)
- Add support to use more tables or views in an update (from clause) 
- Add support to use more tables or views in a delete (using clause)
- Add support to use more tables or views in an update returning old values on databases that support it (SqlServer)
- Add support to use more tables or views in an update returning old values on databases where it can be emulated in a single query (PostgreSql)
- Improve error detection to identify misuse of values that have different columns types with same TypeScript type (like date and time)
- Improve min and max limit verification on insert

**Bug fixes**:

- Fix `selectOneColum` result type on complex objects (like Date)

## v1.19.0 (7 Oct 2021)

**Changes**:

- Add support to numeric date/time in Sqlite that is expressed as bigint in JavaScript by the database connector (By example, using `defaultSafeIntegers` option in BetterSqlite3)

**Bug fixes**:

- Fix typo in Sqlite `treatUnexpectedStringDateTimeAsUTC` connection option (wrongly named: `treatUxepectedStringDateTimeAsUTC`)
- Fix typo in Sqlite `unexpectedUnixDateTimeAreMilliseconds` connection option (wrongly named: `uxepectedUnixDateTimeAreMilliseconds`)

## v1.18.0 (6 Oct 2021)

**Changes**:

- Manage the errors coming from the deferred execution logic till the end of a transaction, after commit or rollback. Now all deferred logic will be executed even if one of them throw an error. All errors thrown by the deferred logic will be collected and combined in one single error that will be thrown after the commit or rollback is executed

**Bug fixes**:

- Fix invalid high level transaction management when the commit fails. The transaction was not rolled back when the commit fails
- Fix connection released too early due when the commit fails in a pooled query runner
- Don't fire the deferred functions when rollback when the commit fails; when this happens the transaction is still ongoing

## v1.17.0 (5 Oct 2021)

**Changes**:

- Implements `Unix time milliseconds as integer` date/time strategy for sqlite that allows to store dates & times in UNIX time as milliseconds
- MockQueryRunner create the output param for oracle in the same way this database expect it
- Add support to deferring execution logic using async functions till the end of a transaction, after commit or rollback

**New examples**:

- Add a running mocked version of the examples in the documentation per each supported database

**Internal changes**:

- Add code coverage report

**Bug fixes**:

- Fix deferring logic execution till the end of transaction in case of multiple nested transaction with multiple deferred logic but not in the middle of the nesting transaction

## v1.16.0 (4 Oct 2021)

**Changes**:

- Add support to deferring execution logic till the end of a transaction, after commit or rollback

**Internal changes**:

- Introduce ts-node to run the examples

**Bug fixes**:

- Fix sqlite compatibility mode by default (regression introduced in the previous release)
- Fix oracle example due oracle instant client not loading and throwing error when the oracle driver is initialized

## v1.15.0 (3 Oct 2021)

**Changes**:

- Allows to use in split/compose previously created property using split/compose
- Add support to Date and Time management in sqlite using different strategies to represent the value (sqlite doesn't have dedicate types to represent dates and time). The implemented strategies are aligned with the date time support in sqlite allowing to store the information as text (in the local timezone or UTC), as integer (in unix time seconds) or as a real value (in Julian days)
- Align method names with convention, where ts-sql-query tries to use well known method names, giving preferences to already existing names in JavaScript, o well known function names in SQL, avoiding abbreviations. Methods with new names (Previous names are still available as deprecated methods):

    | Previous name              | New name           |
    | -------------------------- | ------------------ |
    | `smaller`                  | `lessThan`         |
    | `smallAs`                  | `lessOrEquals`     |
    | `larger`                   | `greaterThan`      |
    | `largeAs`                  | `greaterOrEquals`  |
    | `mod`                      | `modulo`           |
    | `lower`                    | `toLowerCase`      |
    | `upper`                    | `toUpperCase`      |
    | `ltrim`                    | `trimLeft`         |
    | `rtrim`                    | `trimRight`        |

- Change some internal type names to improve the readability of the type name in the IDE and in error messages
- Implement the compatibility mode on sqlite (enabled by default). When is disabled allows to take advantages of the newer syntax in sqlite. Right now only prisma and better sqlite includes an sqlite compatible
- Now is possible create an insert from a select o with multiples values that returns the last inserted id if a compatible sqlite with the returning clause is used
- Now is possible create an insert from a select that returns the last inserted id if a compatible sqlite with the returning clause is used
- Ensure the MockQueryRunner returns a number when the mock function return no value when an insert, update or delete is executed
- Detect invalid results from the mock function returned to the MockQueryRunner
- Add support to mock the call to the method `isTransactionActive`

**Documentation changes**:

- Add example of MockQueryRunner usage to the documentation
- Document how to run the examples

**Internal changes**:

- Changes to make happy TypeScript 4.4 and avoid error messages
- Set up GitHub CI

**Bug fixes**:

- Fix type returned by a table or view customization when the original table or view has alias

## v1.14.0 (23 Aug 2021)

**Changes**:

- Add utility functions that allow to create a prefix map for a guided split taking as reference another object with columns, marking as required the same keys that have a required column in the reference object

**Bug fixes**:

- Fix invisible characters included in the prefixed property names in the prefix utility functions

## v1.13.0 (22 Aug 2021)

**Changes**:

- Add more options to organize the select clauses, making in this way easier to create functions that return queries partially constructed. The where clause can be postponed until the end of the query, before the query execution
- Add support to queries that use orderBy, limit, offset inside of a compound operator (like union, intersect). With this change now it is possible to use a limit in the inner query, not only in the outer one with the compound operator
- Implement insert default values query customization on MySql/MariaDB
- Increase the flexibility of a select from no table, allowing all the clauses supported by a select (outside the from definition)
- Add utility function that allows extracting all columns from an object (like table or view) that enables to write a select all columns
- Add utility functions that allow to deal with situations when a prefixed copy of a list of columns is required to use multiple columns with the same name in a select; complementary functions to help split back in a select the prefixed columns are also included

**Bug fixes**:

- Fix invalid order by of a compound query in Oracle. When a compound operator (union, intersect, ...) is used, Oracle requires to use the positional notation instead of the name of the columns
- Fix invalid subquery in SqlServer that contains an order by. In SqlServer subqueries with an order by must always include an offset

## v1.12.0 (19 Aug 2021)

**Changes**:

- Add support to undefined elements in the and/or array of a dynamic condition

**Bug fixes**:

- Fix undefined not treated as absence of value in `IfValue` conditions

## v1.11.0 (16 Aug 2021)

**Documentation changes**:

- Fix missing parent definition in the "Splitting the result of a left join query" example of the documentation

**Bug fixes**:

- Fix error when composition or splitting are use in a select with `executeSelectNoneOrOne` and the result is null

## v1.10.0 (30 Jul 2021)

**Changes**:

- Implement guided splitting to help handle the splitting situation originated by a left join when the optionality of the moved properties are not correct due to known null rules that are not able to be extracted by ts-sql-query from the query

**Documentation changes**:

- Documented error for method `executeSelectNoneOrOne`

**Bug fixes**:

- Fix constraint violation when a left join return null on a column that originally was marked as required

## v1.9.0 (28 Jul 2021)

**Changes**:

- Add utilities methods to insert and update operations that helps to deal with columns that were prepared to set with no value (null, undefined, empty string, empty array): `setIfHasValue`, `setIfHasValueIfValue`, `setIfHasNoValue`, `setIfHasNoValueIfValue`, `ignoreIfHasValue`, `ignoreIfHasNoValue`, `ignoreAnySetWithNoValue`

**Bug fixes**:

- Fix wrong result of `isTransactionActive` in connections that potentially can nest transaction levels

## v1.8.0 (26 Jul 2021)

**Documentation changes**:

- Make more clear and visible the warning about sharing the connection between HTTP requests.

**Bug fixes**:

- Fix invalid query when an insert or update contains additional properties not precent in the table (that must be ignored)

## v1.7.0 (23 Jul 2021)

**Changes**:

- Implement `isTransactionActive` method at the connection object that allows to know if there is an active open transaction in ts-sql-query
- Allows to use objects with the values in an insert or update that contains additional properties not precent in the table that will be ignored. This change makes the behaviour coherent with TypeScript compiler.

**Bug fixes**:

- Fix transaction management when a ts-sql-connection connection from a pool is reused, started a transaction, but no query is executed.
- Fix select result on non-strict mode, making the best approximation to have an usable result (but loosing the optional property information)

## v1.6.0 (12 Jun 2021)

**Changes**:

- Allows to use complex names in different places like the column alias (name of the property in the result object of a select)
- Allow a dynamic select picking the columns
- Handle splitting with select picking columns
- The `split` method automatically determines if the created property is required or optional
- Added `splitRequired` splitting method
- Add support to optional joins in a select picking columns
- Add support to table "from" customization, allowing to include raw sql to use features not supported yet by ts-sql-query
- Add support to select query customizations
- Add support to update query customizations
- Add support to delete query customizations
- Add support to insert query customizations

**Documentation changes**:

- Document about how to deal with splitting result and dynamic queries
- Add column types section in the documentation

**Bug fixes**:

- Ensure insert multiple can generate the with clause
- Add support to with clause on insert queries on databases that doesn't support a global with on insert (oracle, mysql, mariadb)
- Fix invalid insert default values query on oracle

## v1.5.0 (3 Jun 2021)

**Changes**:

- Add support to custom array types
- Add support to globally encrypted id
- Big refactor to simplify the query runners implementation
- Dropped support to very old better-sqlite3 versions (6 or before)
- Allow to use returning clause on sqlite and mariadb in a sql text query executed directly with the query runner

**Documentation changes**:

- Implements new documentation website using mkdocs and readthedocs.io, available at: [https://ts-sql-query.readthedocs.io/](https://ts-sql-query.readthedocs.io/)
- Add transaction documentation
- Document security constraint regarding update and delete with no where
- Add select with left join example to the documentation

**Distribution changes**:

- Source maps are not included any more

**Bug fixes**:

- Fix insert from select returning last inserted id
- Fix invalid in queries when the in function didn't receives an array of values

## v1.4.0 (23 May 2021)

**Changes**:

- Add support to create dynamic conditions where the criteria is defined at runtime. This allows to have a select with a where provided by an external system.
- Implements compound operator (`union`, `intersect`, `except`) on select expressions.
- Allows `executeSelectPage` on select with `group by`
- Allows insert from select returning last inserted id in PostgreSql and Sql Server
- Extends the possibility of a select query to change the shape of the projected object allowing move some property to an internal object (split) or combine the result with a second query string the value as a property of the first one (compose)
- Add support to recursive select queries

**Bug fixes**:

- Fix `startsWith` and `endsWith` misspelling

## v1.3.0 (9 May 2021)

**Changes**:

- Add the transaction method to the connection to make easier deal with transactions at high level
- Add Prisma support

**New examples**:

- Add MariaDB example using prisma for the connection
- Add MySql example using prisma for the connection
- Add PostgreSql example using prisma for the connection
- Add Sqlite example using prisma for the connection
- Add SqlServer example using prisma for the connection

## v1.2.0 (3 May 2021)

**Changes**:

- Implements LoggingQueryRunner

**Documentation changes**:

- README improvements
- Include optionalConst connection method in the documentation

## v1.1.0 (9 Mar 2021) 

**Changes:**

- Implements SQL with clause that allows using a select as a view in another select query.
- Rework insensitive comparison to allow use collations instead of the lower function; allowing in that way make comparison case insensitive and accent insensitive.
- Implements insensitive order by extension.
- Rework boolean management to support databases that don't have boolean data type (Sql Server and Oracle).
- Add support to custom boolean columns.
- Add support to execute better-sqlite3 queries synchronously.
- Add support to computed columns on tables.
- Add ID encrypter utility.

**Documentation changes:**

- Add documentation about how encrypt the IDs. 
- Add warning to the readme about sharing the connection between HTTP requests.
- Add warning about non-public files.
- Add waring about table and views constructor arguments

**New examples:**

- Add Sqlite example using better-sqlite3 for the connection and synchronous queries.
- Add PostgreSql example using pg for the connection and encrypted primary/foreign keys.

**Bug fixes:**

- Fix mismatching column name when an uppercase character is used as column's alias on PostgreSQL. PostgreSQL lowercase the column's alias when it is not escaped; in consequence, an error was thrown because the column was not found.
- Fix some 'not' ignored during text comparison: notContainsInsensitive (on MySQL, MariaDB, Oracle, PostgreSQL, Sqlite, SqlServer), notEndWith (on Oracle, Sqlite, SqlServer)
- Fix some posible invalid order by in MySql, MariaDB, SqlServer and Sqlite.
- Fix invalid queries involving boolean operations in Sql Server and Oracle.
- Fix missing bigint cast for a value coming from the database when it is a number.

## v1.0.0 (30 Jan 2021)

First stable release!

See [1.0.0-beta.1 release notes](#v1.0.0-beta.1)

**Bug fixes:**

- `setIfValue`, `setIfSetIfValue`, `setIfNotSetIfValue` when insert or update now have the same behaviour that any `*IfValue` function, respecting the configuration about treating an empty string as null value

## v1.0.0-beta.1 (29 Dec 2020)

**Changes:**

- Implements reusable fragments as functions using the `buildFragmentWithArgs` function with the `arg` and `valueArg` functions (all defined in the connection)
- Implements reusable fragments as functions that allow creating `*IfValue` functions using the `buildFragmentWithArgsIfValue` function with the `arg` and `valueArg` functions (all defined in the connection)
- Add support to the newest Better Sqlite 3 returning bingint
- Update all dependencies, and apply all required changes
- Implements the method `execute` in the query runners to allows have direct access to the database using the raw objects used to establish the connection
- Refactor how const values are handled. Now value source included two new methods:
    - `isConstValue(): boolean` that allows verify if it contains a const value
    - `getConstValue(): TYPE` that allows getting the value of a const value source (throw an error if it is not a const value source)
- Update the readme to include explanations about dynamic queries
- Add support to `bigint` column type
- Add examples section to the readme

**Braking changes:**

- Don't inline true or false values when they are defined with the const function. If you want a true or false value inlined use the `true()` and `false()` methods defined in the connection
- Rename `QueryRunner.getNativeConnection` as `getNativeRunner` to avoid confusion because this method doesn't return the connection in all the implementation (could be the pool)
- Big refactor to reduce the pressure on TypeScript type validations. **Breaking changes**:
    - Connections classes now only receive one generic argument with a unique name.
        - **Before**: `DBConnection extends PostgreSqlConnection<DBConnection, 'DBConnection'> { }`
        - **After**: `DBConnection extends PostgreSqlConnection<'DBConnection'> { }`
    - Tables and views now receive a second generic argument with a unique name.
        - **Before**: `class TCompany extends Table<DBConnection> { ... }`
        - **After**: `class TCompany extends Table<DBConnection, 'TCompany'> { ... }`
        - **Before**: `class VCustomerAndCompany extends View<DBConnection> { ... }`
        - **After**: `class VCustomerAndCompany extends View<DBConnection, 'VCustomerAndCompany'> { ... }`
- The value argument and the return type in the type adapters (including the default implementation in the connection) have now type `unknown`
- Trak if a value source is optional and validates if the result of executing a query return a value when it is expected. **Braking changes**:
    - A const with an optional value must be created using the new `optionalConst` function in the connection, previously was used the `const` function in the connection
    - The`is` function that allows comparing two values now returns a not optional boolean, previously it returned an optional value
- Dropped the method `NumberValueSource.asStringNumber`, use instead the new methods:
    - `NumberValueSource.asInt(): number`
    - `NumberValueSource.asDouble(): number`
    - `NumberValueSource.asStringInt(): number|string`
    - `NumberValueSource.asStringDouble(): number|string`
    - `StringNumberValueSource.asStringInt(): number|string`
    - `StringNumberValueSource.asStringDouble(): number|string`

**Internal changes:**

- Big refactor without change the public interface:
    - Use symbols for type marks instead of protected  fields
    - Use interfaces instead of abstract classes (allowed by the previous change)
    - Use import type when it is possible
    - Join all databases files in one file
    - Drop alternative implementations code not in use

**Bug fixes:**

- Fix invalid query when no value is provided to the function `concatIfValue`
- Fix invalid usage of `*IfValue` functions result, now typescript report an error when it happens
- Handle when the update has nothing to set, in that case, no update will be performed, and it returns 0 rows updated

## v0.17.0 (20 Apr 2020)

**Changes**:

- Implements LoopBack support for sqlite3, postgresql, mysql/mariadb, sql server and oracle
- Attach error information to beginTransaction, commit and rollback methods
- Add an option to run all examples
- Use the param placeholder defined in the query runner instead of redefined it in the sql builders
- Always use positional parameters in sqlite
- Refactor how is ensured that you are using a compatible query runner in a connection

## v0.16.0 (27 Mar 2020)

**Changes**:

- Implements insert from a select
- Implements custom comparable types
- Custom column type now includes in and not in operations

## v0.15.0 (6 Feb 2020)

**Changes**:

- Implements executeDatabaseSchemaModification in the query runner for all supported databases
- Make params optional in the query runners
- Add fake order by to allow have limit without order by in Sql Server like in other databases
- Change the way how a function is executed in Oracle. Now a select is executed
- Add warning of AnyDB for Sqlite is not working properly due a bug of any-db-sqlite3
- Add warning of AnyDB for Sql Server is not working properly due a bug of any-db-mssql
- Add warning: tedious-connection-pool is not working due a bug of tedious-connection-pool
- Update readme

**New examples**:

- Add PostgreSql example using pg for the connection
- Add SqlServer example using tedious for the connection
- Add SqlServer example using mssql with tedious for the connection
- Add PostgreSql example using AnyDB with pg for the connection
- Add SqlServer example using AnyDB (any-db-mssql) with tedious for the connection
- Add Oracle example using oracledb for the connection
- Add MySql example using mysql for the connection
- Add MySql example using mysql2 for the connection
- Add MariaDB example using mariadb for the connection
- Add MySql example using AnyDB with mysql for the connection
- Add Sqlite example using sqlite for the connection
- Add Sqlite example using sqlite3 for the connection
- Add Sqlite example using AnyDB with sqlite3 for the connection
- Add Sqlite example using better-sqlite3 for the connection

**Bug fixes**:

- Add missing executeInsertReturningMultipleLastInsertedId implementation
- Fix missing result when a executeSelectOneRow is executed with PgQueryRunner
- Fix select current value of a sequence in Sql Server
- Fix limit in Sql Server when offset is not provided
- Fix procedure and function call in Sql Server
- Fix missing result when an executeSelectOneRow is executed with AnyDBQueryRunner
- Fix executeInsertReturningLastInsertedId and executeInsertReturningMultipleLastInsertedId implementations for AnyDB
- Fix column alias in Oracle, the alias must be quoted in order to preserve the case. Unquoted alias are returned as uppercase.
- Fix missing result when a executeSelectOneRow is executed in Oracle
- Fix wrong result order when a insert multiple returning last inserted id is executed in Oracle
- Fix unhandled safe integer object used by better-sqlite3 when an executeFunction or executeSelectOneColumnOneRow query is executed


## v0.14.0 (31 Jan 2020)

**Changes**:

- Implements insert multiple values and allows to return the last inserted id for each one (this last one only for PostgreSql, SqlServer and Oracle)
- Add table of content to the readme

**Bug fixes**:

- Fix get output values in oracle
- Fix source stack (where the query was executed) added twice to the error stack
- Fix readme

## v0.13.0 (19 Jan 2020)

**Changes**:

- Add the possibility to disable the treatment of an empty string as null
- Escape reserved words when it is used as identifier
- When a select query references to two o more tables or view, the table or view name is used as the prefix of the column when no alias is provided. It avoid the query ambiguity when two columns from different sources have the same name (used in the query or not)

**Bug fixes**:

- Fix double cast when the value is coming from the database
- Allow NaN, Infinity and -Infinity in stringDouble when it is represented as string
- Fix localTime type name
- Fix localDate type name
- Fix int cast when the value is coming from the database
- Fix invalid sql in SqlServer
- Fix type information used by the query runners in sql server

## v0.12.0 (4 Oct 2019)

**Changes:**

- Allows to execute a selectOne over an optional column
- Don't allow to call "returningLastInsertedId" when an insert query is constructed for a table without autogenerated primary key

**Bug fixes:**

- Fix MySqlPoolQueryRunner name
- Make PoolQueryRunner not abstract
- Fix invalid result on MySql when a query that must returns one row is executed

## v0.11.0 (3 Oct 2019)

**Changes:**

- Implements more query runners that handles the connection pool directly
- Implements insert default values with a primary key generated by a sequence

**Bug fixes:**

- Fix wrong inference type caused because typescript drops the type of private fields
- Fix "Type instantiation is excessively deep and possibly infinite.ts(2589)" when the connection is TypeSafe

## v0.10.0 (19 Aug 2019)

Initial public release after a long time of internal development