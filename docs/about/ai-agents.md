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
| `llms-queries-<database>.txt` | Writing queries: select, insert, update, delete, transactions, projections, fragments and dynamic queries. Start here |
| `llms-extreme-dynamic-<database>.txt` | Queries whose columns, filters and order come from the caller |
| `llms-types.txt` | The types of a row of a table, and extracting columns from an object |
| `llms-configuration.txt` | The connection, mapping, column types, time zones, collations and each database |
| `llms-query-runners.txt` | Connecting each driver, and wrapping the query runner |
| `llms-api.txt` | Every method, to look up |
| `llms-errors.txt` | The errors the library raises and their reasons |

`<database>` is `mariadb`, `mysql`, `oracle`, `postgresql`, `sqlite` or `sqlserver`: a query is shown only for that database, which makes the file about a third smaller.

The index links the rest one by one, because they are rarely read ahead: the changelog, and how the native errors of each database map to a reason.
