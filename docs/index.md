# ts-sql-query

[![npm](https://img.shields.io/npm/v/ts-sql-query.svg)](http://npm.im/ts-sql-query)

## What is ts-sql-query?

ts-sql-query is a type-safe SQL query builder like QueryDSL or JOOQ in Java for TypeScript with MariaDB, MySql, Oracle, PostgreSql, Sqlite and SqlServer support.

ts-sql-query provides a way to build dynamic SQL queries in a type-safe way, that means, the TypeScript compiler verifies the queries. Note: this is not an ORM, and the most probably is you don't need one.

Type-safe SQL means the mistakes writting a query will be detected during the compilation time. With ts-sql-query you don't need to be affraid of change the database, the problems caused by the change will be detected during compilation time.

## Why?

There are many libraries available in JavaScript/TypeScript that allows querying a SQL database, but they are typically:

- ORM doesn't allow to take advantage of the full potential of the database.
- String concatenation utilities in the way of query builders.
- Utilities designed without have type-safe criteria.
- Utilities not designed to write dynamic queries in an easy way.

ts-sql-query addresses these inconveniences, providing you with a library that allows you to query the database in a type-safe way, with SQL in mind, and with many helpers to create dynamic queries.

## Install

Install with [npm](https://www.npmjs.com/):

```sh
$ npm install --save ts-sql-query
```

ts-sql-query doesn't expose a global export; instead, you need import specific files refered in this documentation according to the functionality you need. Only the files included in this documentation are considered public; then, don't reference explicitly files outside of the following:

- `ts-sql-query/Connection`
- `ts-sql-query/Table`
- `ts-sql-query/TypeAdapter`
- `ts-sql-query/View`
- `ts-sql-query/connections/*`
- `ts-sql-query/extras/*`
- `ts-sql-query/queryRunners/*`
- `ts-sql-query/dynamicCondition`

Any reference to a file outside of the previous list can change at any moment.

## Examples

You can find a complete example using ts-sql-query with PostgreSQL in the file [PgExample.ts](https://github.com/juanluispaz/ts-sql-query/blob/master/src/examples/PgExample.ts). You can browse the [examples folder](https://github.com/juanluispaz/ts-sql-query/tree/master/src/examples) to see an example for each supported database using different ways to connect to it.

## License

MIT