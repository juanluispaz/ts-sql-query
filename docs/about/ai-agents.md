---
search:
  boost: 0.13
---
# For AI agents

The documentation is also published for AI coding agents, split so an agent reads only what its task needs.

## In your project

The package includes the documentation of the version you installed, so an agent doesn't need the network and can't read about another version:

- `node_modules/ts-sql-query/AGENTS.md`: how to work with the library, and which page to read for each task. To use it, tell your agent to read it, from your own `AGENTS.md`, `CLAUDE.md` or equivalent:

    ```text
    Before writing queries with ts-sql-query, read node_modules/ts-sql-query/AGENTS.md
    ```

- `node_modules/ts-sql-query/llms/`: the files below.
- `node_modules/ts-sql-query/docs/`: each page of this documentation.

## On the web

[`llms.txt`](https://ts-sql-query.readthedocs.io/llms.txt) is the index, following the [llms.txt proposal](https://llmstxt.org/), and each page of this site is also available in Markdown, by replacing the end of its address with `.md`.

The files below are at `https://ts-sql-query.readthedocs.io/en/latest/<file>`:

| File | For |
|---|---|
| **Set up the project** | |
| `llms-connect.txt` | Connecting each driver, and using the library next to another one. The index also links the page of each driver |
| `llms-configuration-<database>.txt` | The connection, mapping the tables and views, the types of the columns, time zones, collations and each database |
| `llms-api-mapping.txt` | The methods to declare tables, views and constant values as a view |
| **Write queries** | |
| `llms-queries-<database>.txt` | Reading data: select, joins, pages, projections and dynamic queries. Start here |
| `llms-dynamic-<database>.txt` | The detail of dynamic queries: the order and the page from a request, optional joins, booleans and null, and conditions built with your own `if`s |
| `llms-queries-advanced-<database>.txt` | Common table expressions and subqueries, compound selects and recursive selects |
| `llms-aggregates-<database>.txt` | Aggregate functions, group by and having |
| `llms-mutations-<database>.txt` | Writing data: insert, insert on conflict, update and delete |
| `llms-transactions.txt` | Transactions, what happens on an error, isolation levels and work deferred to the end of a transaction |
| `llms-api-queries.txt` | The methods of the connection, the select, the values and the dynamic conditions |
| `llms-api-mutations.txt` | The methods of insert, update and delete |
| **Beyond dynamic queries** | |
| `llms-extreme-dynamic-<database>.txt` | Queries whose columns, filters and order come from the caller, a table or a query API driven by a request, values the user can't see, and writing values with a shape |
| `llms-dynamic-functions-<database>.txt` | A function of your own that returns a dynamic select, typed from the database or a business model, and the helper types |
| `llms-types.txt` | The types of a row of a table, and extracting columns from an object |
| **When the library does not write your SQL** | |
| `llms-own-sql-<database>.txt` | Fragments of SQL of your own, customizing a query, and the functions and extensions of SQLite |
| **Extend the library** | |
| `llms-data-types-<database>.txt` | A data type of your own: branded and opaque types, its methods, its type in the database, its conversions with type adapters and the context of a conversion |
| `llms-api-data-types.txt` | The families, the statics of a class of a data type, the type adapters and the SQL data types |
| `llms-execution.txt` | Wrapping, logging or writing a query runner, running queries without promises, and what a query runner can read of each query |
| **Test your code** | |
| `llms-testing.txt` | The query runners that answer without a database |
| **Look up** | |
| `llms-api.txt` | Every method, to look up |
| `llms-errors.txt` | The errors the library raises and their reasons |
| `llms-keywords.txt` | A quick index: each SQL keyword, and what writes it in the library |
| `llms-general.txt` | What the library is, its philosophy, how it is tested, frequent questions and limitations |
| `llms-changelog-v2.txt`, `llms-changelog-v1.txt` | What changed in each version |
| `llms-migrating-from-v1.txt` | What to change in an application on v1, and what changes by itself |

`<database>` is `mariadb`, `mysql`, `oracle`, `postgresql`, `sqlite` or `sqlserver`: a query is shown only for that database, which makes the file about a third smaller. With `all` instead of a database, like `llms-queries-all.txt`, the file shows all of them: for an agent that compares databases, or moves code from one to another.

The index links the rest one by one, because they are rarely read ahead, like how the native errors of each database map to a reason.
