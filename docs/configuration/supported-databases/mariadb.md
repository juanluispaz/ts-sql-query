---
search:
  boost: 0.59
---
# MariaDB

The way to define which database to use is by specifying it when defining the connection, by extending the appropriate database connection class. You must choose the correct database type to ensure that the generated SQL queries follow the dialect expected by that database.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

```ts
import { MariaDBConnection } from "ts-sql-query/connections/MariaDBConnection";

class DBConnection extends MariaDBConnection<'DBConnection'> { }
```

## Last inserted id strategies

MariaBD 10.5 added support to the returning clause when insert or delete. If you set this flag to true, the insert returning last inserted id will generate the returning clause instead of use the last inserted id provided by the connector after the execution of the query.

```ts
import { MariaDBConnection } from "ts-sql-query/connections/MariaDBConnection";

class DBConnection extends MariaDBConnection<'DBConnection'> { 
    protected alwaysUseReturningClauseWhenInsert = true
}
```

## UUID strategies

ts-sql-query offers you different strategies to handle UUIDs in MariaDB:

- `uuid`: *(default strategy)* In this case, the UUID is represented as string and stored in a column with `uuid` data type. This requires MariaDB 10.7 or higher.
- `string`: In this case, the UUID is represented as string and stored in a column with `char`/`varchar`/`text` data type and length 36 characters.

To change the UUID strategy, you must set the `uuidStrategy` field in the connection object:

```ts
import { MariaDBConnection } from "ts-sql-query/connections/MariaDBConnection";

class DBConnection extends MariaDBConnection<'DBConnection'> {
    protected uuidStrategy = 'string' as const
}
```
