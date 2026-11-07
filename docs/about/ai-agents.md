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
| `llms-general.txt` | What the library is, its philosophy, how it is tested, frequent questions and limitations |
| `llms-queries-<database>.txt` | Reading data: select, joins, pages, projections and dynamic queries. Start here |
| `llms-queries-advanced-<database>.txt` | Common table expressions and subqueries, compound selects and recursive selects |
| `llms-aggregates-<database>.txt` | Aggregate functions, group by and having |
| `llms-mutations-<database>.txt` | Writing data: insert, insert on conflict, update and delete |
| `llms-transactions.txt` | Transactions, what happens on an error, isolation levels and work deferred to the end of a transaction |
| `llms-extending-<database>.txt` | Going beyond what the library offers: your own SQL with fragments, and your own column types |
| `llms-dynamic-<database>.txt` | The detail of dynamic queries: the order and the page from a request, optional joins, booleans and null, and conditions built with your own `if`s |
| `llms-extreme-dynamic-<database>.txt` | Queries whose columns, filters and order come from the caller, a table or a query API driven by a request, values the user can't see, and writing values with a shape |
| `llms-dynamic-functions-<database>.txt` | A function of your own that returns a dynamic select, typed from the database or a business model, and the helper types |
| `llms-types.txt` | The types of a row of a table, and extracting columns from an object |
| `llms-configuration-<database>.txt` | The connection, mapping, column types, time zones, collations and each database |
| `llms-query-runners.txt` | Connecting each driver, and wrapping the query runner. The index also links the page of each driver |
| `llms-api.txt` | Every method, to look up |
| `llms-errors.txt` | The errors the library raises and their reasons |
| `llms-keywords.txt` | A quick index: each SQL keyword, and what writes it in the library |
| `llms-changelog-v2.txt`, `llms-changelog-v1.txt` | What changed in each version |
| `llms-migrating-from-v1.txt` | What to change in an application on v1 |

`<database>` is `mariadb`, `mysql`, `oracle`, `postgresql`, `sqlite` or `sqlserver`: a query is shown only for that database, which makes the file about a third smaller. With `all` instead of a database, like `llms-queries-all.txt`, the file shows all of them: for an agent that compares databases, or moves code from one to another.

The index links the rest one by one, because they are rarely read ahead, like how the native errors of each database map to a reason.
