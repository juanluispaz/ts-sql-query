---
search:
  boost: 0.4
---
# Metadata of a query and its parameters

A type adapter knows things about the values it converts that the query runner can't tell from the SQL and the parameters: that a value is personal data and must not be logged, that a parameter must be bound with a type of the driver, that a query reads a table your monitoring wants to count. The **metadata** is how the type adapter tells it: it keeps a value under a key of its own, for one parameter or for the whole query, and the query runner reads it in the [context of the query](query-execution-metadata.md). The metadata is never sent to the database.

It is for a [type adapter](type-adapters.md), or the transformations of the connection, and a query runner of your own, typically an [`InterceptorQueryRunner`](../configuration/query-runners/general-purpose/InterceptorQueryRunner.md), or the function of a [`MockQueryRunner`](../configuration/query-runners/general-purpose/MockQueryRunner.md). Don't confuse it with the data you give a query with `customizeQuery({ queryExecutionMetadata })`, which your code writes, not a type adapter (see [Retrieve additional execution metadata](query-execution-metadata.md#retrieve-additional-execution-metadata)).

## Where it is written and read

| Metadata of | Written with | In | Read with |
|---|---|---|---|
| A parameter | `context.setMetadata(key, value)` | `transformValueToDB`, `transformPlaceholder` | `getQueryContext(query, params).getParam(index)?.getMetadata(key)` |
| The query | `context.setQueryMetadata(key, value)` | `transformValueToDB`, `transformPlaceholder`, `transformProjection` | `getQueryContext(query, params).getMetadata(key)` |

- The key is a `symbol` the type adapter creates, like `Symbol('personalData')`, so it can't collide with the metadata of another adapter or of the library.
- The context of each transformation reads back what was kept: `context.getMetadata(key)` of the parameter, `context.getQueryMetadata(key)` of the query, so an adapter can add to what an earlier call kept.
- It is written while the query is built: each execution of the query reads the same.
- The library calls `transformValueToDB` to look at a value that isn't sent, and `transformProjection` with an empty `sql` to learn what it says; what those calls keep is discarded. A value written as the literal `null` isn't a parameter, so its metadata of a parameter is discarded too.
- The query runners of the library read their own: the mark of `OracleDateAsTimestampTypeAdapter`, which binds its parameters as a `DATE` on Oracle.

## An example: personal data out of the logs

A column whose values are personal data: its type adapter marks each of its parameters, and the query, and a logger hides the marked values.

```ts
import { InterceptorQueryRunner, getQueryContext } from "ts-sql-query";
import type { QueryType, TypeAdapter } from "ts-sql-query";

// The key of this adapter: a symbol of its own
const personalData = Symbol('personalData')

// Marks each parameter of the column, and the query
const personalDataAdapter: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        return next.transformValueFromDB(value, context)
    },
    transformValueToDB(value, context, next) {
        context.setMetadata(personalData, true)
        context.setQueryMetadata(personalData, true)
        return next.transformValueToDB(value, context)
    },
}

// Logs each query, without the values marked as personal data
class HidingLoggingQueryRunner extends InterceptorQueryRunner<void> {
    onQuery(queryType: QueryType, query: string, params: any[]): void {
        const context = getQueryContext(query, params)
        const shown = params.map((value, index) => context.getParam(index)?.getMetadata(personalData) ? '***' : value)
        const note = context.getMetadata(personalData) ? '(with personal data)' : ''
        console.log(queryType, query, shown, note)
    }
    onQueryResult(): void {
        // Your HidingLoggingQueryRunner's onQueryResult implementation ...
    }
    onQueryError(): void {
        // Your HidingLoggingQueryRunner's onQueryError implementation ...
    }
}

const tCustomerPersonal = new class TCustomerPersonal extends Table<DBConnection, 'TCustomerPersonal'> {
    id = this.primaryKey('id', 'int')
    firstName = this.column('first_name', 'string', personalDataAdapter)
    constructor() {
        super('customer')
    }
}()

const customers = connection.selectFrom(tCustomerPersonal)
    .where(tCustomerPersonal.firstName.equals('John'))
    .select({
        id: tCustomerPersonal.id
    })
    .executeSelectMany()
```

```postgresql
select id as id 
from customer 
where first_name = $1
```

The parameters are: `[ 'John' ]`

The result type is:
```tsx
const customers: Promise<{
    id: number;
}[]>
```

With the connection created on a `HidingLoggingQueryRunner` that wraps the query runner of your driver, the query is logged as `selectManyRows select id as id from customer where first_name = $1 [ '***' ] (with personal data)`.
