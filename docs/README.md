# ts-sql-query documentation

In this folder, you will find all the documentation of ts-sql-query. 

This documentation is built using [mkdocs](https://www.mkdocs.org) 1.1.2. To see a local version, you must have installed mkdocs and execute the command:

```sh
$ npm run docs
```

You can read the latest version of the documentation at: https://ts-sql-query.readthedocs.io/ 

# Content

- [ts-sql-query](index.md#ts-sql-query)
  - [What is ts-sql-query?](index.md#what-is-ts-sql-query)
  - [Why?](index.md#why)
  - [Install](index.md#install)
  - [Examples](index.md#examples)
  - [License](index.md#license)
- [Basic query structure](queries/basic-query-structure.md#basic-query-structure)
  - [Select one row](queries/basic-query-structure.md#select-one-row)
  - [Other options](queries/basic-query-structure.md#other-options)
- [Dynamic queries](queries/dynamic-queries.md#dynamic-queries)
- [Select](queries/select.md#select)
  - [Select with joins and order by](queries/select.md#select-with-joins-and-order-by)
  - [Select with subquery and dynamic order by](queries/select.md#select-with-subquery-and-dynamic-order-by)
  - [Select with aggregate functions and group by](queries/select.md#select-with-aggregate-functions-and-group-by)
  - [Select with left join](queries/select.md#select-with-left-join)
  - [Select with a compound operator (union, intersect, except)](queries/select.md#select-with-a-compound-operator-union-intersect-except)
  - [Using a select as a view in another select query (SQL with clause)](queries/select.md#using-a-select-as-a-view-in-another-select-query-sql-with-clause)
- [Select page](queries/select-page.md#select-page)
- [Recursive select](queries/recursive-select.md#recursive-select)
  - [Recursive select looking for parents](queries/recursive-select.md#recursive-select-looking-for-parents)
  - [Recursive select looking for children](queries/recursive-select.md#recursive-select-looking-for-children)
- [Select using a dynamic filter](queries/select-using-a-dynamic-filter.md#select-using-a-dynamic-filter)
- [Select picking columns](queries/select-picking-columns.md#select-picking-columns)
  - [Dynamically picking columns](queries/select-picking-columns.md#dynamically-picking-columns)
  - [Optional joins](queries/select-picking-columns.md#optional-joins)
- [SQL fragments](queries/sql-fragments.md#sql-fragments)
  - [Select with custom SQL fragment](queries/sql-fragments.md#select-with-custom-sql-fragment)
  - [Select with custom reusable SQL fragment](queries/sql-fragments.md#select-with-custom-reusable-sql-fragment)
  - [Select with custom reusable SQL fragment if value](queries/sql-fragments.md#select-with-custom-reusable-sql-fragment-if-value)
  - [Raw SQL](queries/sql-fragments.md#raw-sql)
  - [Table or view customization](queries/sql-fragments.md#table-or-view-customization)
  - [Customizing a select](queries/sql-fragments.md#customizing-a-select)
  - [Customizing an insert](queries/sql-fragments.md#customizing-an-insert)
  - [Customizing an update](queries/sql-fragments.md#customizing-an-update)
  - [Customizing a delete](queries/sql-fragments.md#customizing-a-delete)
- [Insert](queries/insert.md#insert)
  - [Insert one row](queries/insert.md#insert-one-row)
  - [Insert multiple values](queries/insert.md#insert-multiple-values)
  - [Insert from select](queries/insert.md#insert-from-select)
- [Update](queries/update.md#update)
- [Delete](queries/delete.md#delete)
- [Transaction](queries/transaction.md#transaction)
  - [Hight-level transaction management](queries/transaction.md#hight-level-transaction-management)
  - [Low-level transaction management](queries/transaction.md#low-level-transaction-management)
- [Connection, tables & views](connection-tables-views.md#connection-tables--views)
  - [Defining the connection object](connection-tables-views.md#defining-the-connection-object)
  - [Allowing empty string](connection-tables-views.md#allowing-empty-string)
  - [Insensitive strategies](connection-tables-views.md#insensitive-strategies)
  - [Instantiating the connection with the database connection](connection-tables-views.md#instantiating-the-connection-with-the-database-connection)
  - [Instantiating the connection with a mock database connection](connection-tables-views.md#instantiating-the-connection-with-a-mock-database-connection)
  - [Mapping the tables](connection-tables-views.md#mapping-the-tables)
  - [Mapping the views](connection-tables-views.md#mapping-the-views)
  - [Creating methods that allows to call a procedure](connection-tables-views.md#creating-methods-that-allows-to-call-a-procedure)
  - [Creating methods that allows to call a function](connection-tables-views.md#creating-methods-that-allows-to-call-a-function)
- [Column types](column-types.md#column-types)
  - [Typing](column-types.md#typing)
  - [Type adapters](column-types.md#type-adapters)
  - [Globally type adapter](column-types.md#globally-type-adapter)
- [Composing and splitting results](composing-and-splitting-results.md#composing-and-splitting-results)
  - [Composing results](composing-and-splitting-results.md#composing-results)
  - [Composing many items in the result](composing-and-splitting-results.md#composing-many-items-in-the-result)
  - [Composing one item in the result](composing-and-splitting-results.md#composing-one-item-in-the-result)
  - [Splitting results](composing-and-splitting-results.md#splitting-results)
  - [Splitting the result of one query](composing-and-splitting-results.md#splitting-the-result-of-one-query)
  - [Splitting results and dynamic queries](composing-and-splitting-results.md#splitting-results-and-dynamic-queries)
- [Supported operations](supported-operations.md#supported-operations)
  - [Operations definitions](supported-operations.md#operations-definitions)
  - [Connection definition](supported-operations.md#connection-definition)
  - [Table definition](supported-operations.md#table-definition)
  - [View definition](supported-operations.md#view-definition)
  - [Insert definition](supported-operations.md#insert-definition)
  - [Update definition](supported-operations.md#update-definition)
  - [Delete definition](supported-operations.md#delete-definition)
  - [Select definition](supported-operations.md#select-definition)
  - [Type adpaters](supported-operations.md#type-adpaters)
  - [Dynamic conditions](supported-operations.md#dynamic-conditions)
- [Supported databases](supported-databases.md#supported-databases)
  - [MariaDB](supported-databases.md#mariadb)
  - [MySql](supported-databases.md#mysql)
  - [Oracle](supported-databases.md#oracle)
  - [PostgreSql](supported-databases.md#postgresql)
  - [Sqlite](supported-databases.md#sqlite)
  - [SqlServer](supported-databases.md#sqlserver)
- [Supported databases with extended types](supported-databases-with-extended-types.md#supported-databases-with-extended-types)
  - [MariaDB](supported-databases-with-extended-types.md#mariadb)
  - [MySql](supported-databases-with-extended-types.md#mysql)
  - [Oracle](supported-databases-with-extended-types.md#oracle)
  - [PostgreSql](supported-databases-with-extended-types.md#postgresql)
  - [Sqlite](supported-databases-with-extended-types.md#sqlite)
  - [SqlServer](supported-databases-with-extended-types.md#sqlserver)
- [Recommended query runners](query-runners/recommended-query-runners.md#recommended-query-runners)
  - [better-sqlite3](query-runners/recommended-query-runners.md#better-sqlite3)
  - [mariadb](query-runners/recommended-query-runners.md#mariadb)
    - [mariadb (with a connection pool)](query-runners/recommended-query-runners.md#mariadb-with-a-connection-pool)
    - [mariadb (with a connection)](query-runners/recommended-query-runners.md#mariadb-with-a-connection)
  - [mssql](query-runners/recommended-query-runners.md#mssql)
    - [mssql (with a connection pool promise)](query-runners/recommended-query-runners.md#mssql-with-a-connection-pool-promise)
    - [mssql (with a connection pool)](query-runners/recommended-query-runners.md#mssql-with-a-connection-pool)
  - [mysql2](query-runners/recommended-query-runners.md#mysql2)
    - [mysql2 (with a connection pool)](query-runners/recommended-query-runners.md#mysql2-with-a-connection-pool)
    - [mysql2 (with a connection)](query-runners/recommended-query-runners.md#mysql2-with-a-connection)
  - [oracledb](query-runners/recommended-query-runners.md#oracledb)
    - [oracledb (with a connection pool promise)](query-runners/recommended-query-runners.md#oracledb-with-a-connection-pool-promise)
    - [oracledb (with a connection pool)](query-runners/recommended-query-runners.md#oracledb-with-a-connection-pool)
    - [oracledb (with a connection)](query-runners/recommended-query-runners.md#oracledb-with-a-connection)
  - [pg](query-runners/recommended-query-runners.md#pg)
    - [pg (with a connection pool)](query-runners/recommended-query-runners.md#pg-with-a-connection-pool)
    - [pg (with a connection)](query-runners/recommended-query-runners.md#pg-with-a-connection)
  - [sqlite3](query-runners/recommended-query-runners.md#sqlite3)
- [Additional query runners](query-runners/additional-query-runners.md#additional-query-runners)
  - [any-db](query-runners/additional-query-runners.md#any-db)
    - [any-db (with connection pool)](query-runners/additional-query-runners.md#any-db-with-connection-pool)
    - [any-db (with connection)](query-runners/additional-query-runners.md#any-db-with-connection)
  - [LoopBack DataSource](query-runners/additional-query-runners.md#loopback-datasource)
  - [msnodesqlv8](query-runners/additional-query-runners.md#msnodesqlv8)
  - [mysql](query-runners/additional-query-runners.md#mysql)
    - [mysql (with a connection pool)](query-runners/additional-query-runners.md#mysql-with-a-connection-pool)
    - [mysql (with a connection)](query-runners/additional-query-runners.md#mysql-with-a-connection)
  - [prisma](query-runners/additional-query-runners.md#prisma)
  - [sqlite](query-runners/additional-query-runners.md#sqlite)
  - [tedious](query-runners/additional-query-runners.md#tedious)
    - [tedious (with a connection poll)](query-runners/additional-query-runners.md#tedious-with-a-connection-poll)
    - [tedious (with a connection)](query-runners/additional-query-runners.md#tedious-with-a-connection)
- [General purpose query runners](query-runners/general-purpose-query-runners.md#general-purpose-query-runners)
  - [ConsoleLogNoopQueryRunner](query-runners/general-purpose-query-runners.md#consolelognoopqueryrunner)
  - [ConsoleLogQueryRunner](query-runners/general-purpose-query-runners.md#consolelogqueryrunner)
  - [LoggingQueryRunner](query-runners/general-purpose-query-runners.md#loggingqueryrunner)
  - [MockQueryRunner](query-runners/general-purpose-query-runners.md#mockqueryrunner)
  - [NoopQueryRunner](query-runners/general-purpose-query-runners.md#noopqueryrunner)
- [Advanced usage](advanced-usage.md#advanced-usage)
  - [Custom booleans values](advanced-usage.md#custom-booleans-values)
  - [Synchronous query runners](advanced-usage.md#synchronous-query-runners)
  - [Encrypted ID](advanced-usage.md#encrypted-id)
  - [Globally Encrypted ID](advanced-usage.md#globally-encrypted-id)
- [Change Log](CHANGELOG.md#change-log)

<!-- 
Generated table of content of the file created using npm run create-single-doc-file

- [index.md](#indexmd)
- [ts-sql-query](#ts-sql-query)
  - [What is ts-sql-query?](#what-is-ts-sql-query)
  - [Why?](#why)
  - [Install](#install)
  - [Examples](#examples)
  - [License](#license)
- [queries/basic-query-structure.md](#queriesbasic-query-structuremd)
- [Basic query structure](#basic-query-structure)
  - [Select one row](#select-one-row)
  - [Other options](#other-options)
- [queries/dynamic-queries.md](#queriesdynamic-queriesmd)
- [Dynamic queries](#dynamic-queries)
- [queries/select.md](#queriesselectmd)
- [Select](#select)
  - [Select with joins and order by](#select-with-joins-and-order-by)
  - [Select with subquery and dynamic order by](#select-with-subquery-and-dynamic-order-by)
  - [Select with aggregate functions and group by](#select-with-aggregate-functions-and-group-by)
  - [Select with left join](#select-with-left-join)
  - [Select with a compound operator (union, intersect, except)](#select-with-a-compound-operator-union-intersect-except)
  - [Using a select as a view in another select query (SQL with clause)](#using-a-select-as-a-view-in-another-select-query-sql-with-clause)
- [queries/select-page.md](#queriesselect-pagemd)
- [Select page](#select-page)
- [queries/recursive-select.md](#queriesrecursive-selectmd)
- [Recursive select](#recursive-select)
  - [Recursive select looking for parents](#recursive-select-looking-for-parents)
  - [Recursive select looking for children](#recursive-select-looking-for-children)
- [queries/select-using-a-dynamic-filter.md](#queriesselect-using-a-dynamic-filtermd)
- [Select using a dynamic filter](#select-using-a-dynamic-filter)
- [queries/select-picking-columns.md](#queriesselect-picking-columnsmd)
- [Select picking columns](#select-picking-columns)
  - [Dynamically picking columns](#dynamically-picking-columns)
  - [Optional joins](#optional-joins)
- [queries/sql-fragments.md](#queriessql-fragmentsmd)
- [SQL fragments](#sql-fragments)
  - [Select with custom SQL fragment](#select-with-custom-sql-fragment)
  - [Select with custom reusable SQL fragment](#select-with-custom-reusable-sql-fragment)
  - [Select with custom reusable SQL fragment if value](#select-with-custom-reusable-sql-fragment-if-value)
  - [Raw SQL](#raw-sql)
  - [Table or view customization](#table-or-view-customization)
  - [Customizing a select](#customizing-a-select)
  - [Customizing an insert](#customizing-an-insert)
  - [Customizing an update](#customizing-an-update)
  - [Customizing a delete](#customizing-a-delete)
- [queries/insert.md](#queriesinsertmd)
- [Insert](#insert)
  - [Insert one row](#insert-one-row)
  - [Insert multiple values](#insert-multiple-values)
  - [Insert from select](#insert-from-select)
- [queries/update.md](#queriesupdatemd)
- [Update](#update)
- [queries/delete.md](#queriesdeletemd)
- [Delete](#delete)
- [queries/transaction.md](#queriestransactionmd)
- [Transaction](#transaction)
  - [Hight-level transaction management](#hight-level-transaction-management)
  - [Low-level transaction management](#low-level-transaction-management)
- [connection-tables-views.md](#connection-tables-viewsmd)
- [Connection, tables & views](#connection-tables--views)
  - [Defining the connection object](#defining-the-connection-object)
  - [Allowing empty string](#allowing-empty-string)
  - [Insensitive strategies](#insensitive-strategies)
  - [Instantiating the connection with the database connection](#instantiating-the-connection-with-the-database-connection)
  - [Instantiating the connection with a mock database connection](#instantiating-the-connection-with-a-mock-database-connection)
  - [Mapping the tables](#mapping-the-tables)
  - [Mapping the views](#mapping-the-views)
  - [Creating methods that allows to call a procedure](#creating-methods-that-allows-to-call-a-procedure)
  - [Creating methods that allows to call a function](#creating-methods-that-allows-to-call-a-function)
- [column-types.md](#column-typesmd)
- [Column types](#column-types)
  - [Typing](#typing)
  - [Type adapters](#type-adapters)
  - [Globally type adapter](#globally-type-adapter)
- [composing-and-splitting-results.md](#composing-and-splitting-resultsmd)
- [Composing and splitting results](#composing-and-splitting-results)
  - [Composing results](#composing-results)
  - [Composing many items in the result](#composing-many-items-in-the-result)
  - [Composing one item in the result](#composing-one-item-in-the-result)
  - [Splitting results](#splitting-results)
  - [Splitting the result of one query](#splitting-the-result-of-one-query)
  - [Splitting results and dynamic queries](#splitting-results-and-dynamic-queries)
- [supported-operations.md](#supported-operationsmd)
- [Supported operations](#supported-operations)
  - [Operations definitions](#operations-definitions)
  - [Connection definition](#connection-definition)
  - [Table definition](#table-definition)
  - [View definition](#view-definition)
  - [Insert definition](#insert-definition)
  - [Update definition](#update-definition)
  - [Delete definition](#delete-definition)
  - [Select definition](#select-definition)
  - [Type adpaters](#type-adpaters)
  - [Dynamic conditions](#dynamic-conditions)
- [supported-databases.md](#supported-databasesmd)
- [Supported databases](#supported-databases)
  - [MariaDB](#mariadb)
  - [MySql](#mysql)
  - [Oracle](#oracle)
  - [PostgreSql](#postgresql)
  - [Sqlite](#sqlite)
  - [SqlServer](#sqlserver)
- [supported-databases-with-extended-types.md](#supported-databases-with-extended-typesmd)
- [Supported databases with extended types](#supported-databases-with-extended-types)
  - [MariaDB](#mariadb-1)
  - [MySql](#mysql-1)
  - [Oracle](#oracle-1)
  - [PostgreSql](#postgresql-1)
  - [Sqlite](#sqlite-1)
  - [SqlServer](#sqlserver-1)
- [query-runners/recommended-query-runners.md](#query-runnersrecommended-query-runnersmd)
- [Recommended query runners](#recommended-query-runners)
  - [better-sqlite3](#better-sqlite3)
  - [mariadb](#mariadb-2)
    - [mariadb (with a connection pool)](#mariadb-with-a-connection-pool)
    - [mariadb (with a connection)](#mariadb-with-a-connection)
  - [mssql](#mssql)
    - [mssql (with a connection pool promise)](#mssql-with-a-connection-pool-promise)
    - [mssql (with a connection pool)](#mssql-with-a-connection-pool)
  - [mysql2](#mysql2)
    - [mysql2 (with a connection pool)](#mysql2-with-a-connection-pool)
    - [mysql2 (with a connection)](#mysql2-with-a-connection)
  - [oracledb](#oracledb)
    - [oracledb (with a connection pool promise)](#oracledb-with-a-connection-pool-promise)
    - [oracledb (with a connection pool)](#oracledb-with-a-connection-pool)
    - [oracledb (with a connection)](#oracledb-with-a-connection)
  - [pg](#pg)
    - [pg (with a connection pool)](#pg-with-a-connection-pool)
    - [pg (with a connection)](#pg-with-a-connection)
  - [sqlite3](#sqlite3)
- [query-runners/additional-query-runners.md](#query-runnersadditional-query-runnersmd)
- [Additional query runners](#additional-query-runners)
  - [any-db](#any-db)
    - [any-db (with connection pool)](#any-db-with-connection-pool)
    - [any-db (with connection)](#any-db-with-connection)
  - [LoopBack DataSource](#loopback-datasource)
  - [msnodesqlv8](#msnodesqlv8)
  - [mysql](#mysql-2)
    - [mysql (with a connection pool)](#mysql-with-a-connection-pool)
    - [mysql (with a connection)](#mysql-with-a-connection)
  - [prisma](#prisma)
  - [sqlite](#sqlite-2)
  - [tedious](#tedious)
    - [tedious (with a connection poll)](#tedious-with-a-connection-poll)
    - [tedious (with a connection)](#tedious-with-a-connection)
- [query-runners/general-purpose-query-runners.md](#query-runnersgeneral-purpose-query-runnersmd)
- [General purpose query runners](#general-purpose-query-runners)
  - [ConsoleLogNoopQueryRunner](#consolelognoopqueryrunner)
  - [ConsoleLogQueryRunner](#consolelogqueryrunner)
  - [LoggingQueryRunner](#loggingqueryrunner)
  - [MockQueryRunner](#mockqueryrunner)
  - [NoopQueryRunner](#noopqueryrunner)
- [advanced-usage.md](#advanced-usagemd)
- [Advanced usage](#advanced-usage)
  - [Custom booleans values](#custom-booleans-values)
  - [Synchronous query runners](#synchronous-query-runners)
  - [Encrypted ID](#encrypted-id)
  - [Globally Encrypted ID](#globally-encrypted-id)
- [CHANGELOG.md](#changelogmd)
- [Change Log](#change-log)

-->