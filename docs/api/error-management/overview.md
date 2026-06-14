---
search:
  boost: 0.25
---
# Error Management Overview

`ts-sql-query` wraps execution and processing failures in typed errors. The most important field for callers is `errorReason`, whose `reason` value identifies the semantic category of the failure.

Database and driver failures are represented with `TsSqlQueryExecutionError`. When the source error exposes native metadata, the mapped reason can include:

| <span class="min-width-7rem">Field</span> | Meaning |
| --- | --- |
| `databaseErrorCode` | The symbolic driver/database code, such as `ER_DUP_ENTRY`, `unique_violation`, `SQLITE_CONSTRAINT_UNIQUE`, `ORA-00001`, or `EREQUEST`. Some drivers use wrapper codes for engine errors; for example, SQL Server through `mssql` commonly reports `EREQUEST`, while the native SQL Server error number used by the mapper is in `databaseErrorNumber`. |
| `databaseErrorNumber` | The numeric or SQLSTATE value when the driver exposes one, such as `1062`, `23505`, `2067`, `1`, or `2627`. |
| `databaseErrorMessage` | The original database or driver message when available. |

The native mapping pages are organized for lookup: search for the code, number, SQLSTATE, or connector message you received, then read the corresponding `reason`, subtype, and filled fields.

| Native mapping | Page |
| --- | --- |
| MariaDB | [MariaDB](native-mappings/mariadb.md) |
| MySQL | [MySQL](native-mappings/mysql.md) |
| Oracle | [Oracle](native-mappings/oracle.md) |
| PostgreSQL | [PostgreSQL](native-mappings/postgresql.md) |
| SQLite | [SQLite](native-mappings/sqlite.md) |
| SQL Server | [SQL Server](native-mappings/sql-server.md) |

A `-` in a native table means that semantic row is not implemented for that database family. The rows are intentionally identical across native pages, and `SQL_UNKNOWN` is always last.

MySQL and MariaDB reuse numeric ranges with different meanings. Their native mapping pages interpret a bare error number only against the active database family. If a number belongs only to the other family, it is treated as an unmapped numeric error and is not listed as a native mapping for the current page. When a driver provides an explicit symbolic code, that code is preserved in `databaseErrorCode` even if the number is otherwise ambiguous.

Prisma is not folded into the native tables because Prisma exposes its own `Pxxxx` error space before the underlying database error reaches the library. Prisma mappings are handled by the Prisma query runner and should be read separately from these native database pages.

For non-database failures raised by the library itself, see [Library-raised errors](library-raised-errors.md). For the current reason type catalog, see [Error types](error-types.md). For TypeScript declarations useful in application code, see [TypeScript types](typescript-types.md).

<!--
## Mapping table conventions

Internal maintenance note. Keep this section commented so maintainers and future agents have enough information to rebuild the error documentation from the current code and structure.

Documentation purpose:

- The primary reader is a developer who has just received a `TsSqlError` or a wrapped `TsSqlQueryExecutionError` and needs to understand what happened.
- Optimize every page for lookup from a real error object, not for compactness.
- A reader should be able to search for:
  - `errorReason.reason`
  - a subtype value such as `unique`, `invalid json`, or `deadlock`
  - `databaseErrorCode`
  - `databaseErrorNumber`
  - an exact or summarized driver message
  - a filled field such as `constraintName`, `transactionErrorType`, or `queryType`
- The native mapping pages answer: "I got this database or driver signal; what `TsSqlErrorReason` does the library expose?"
- `library-raised-errors.md` answers: "The library itself raised this reason; what should I inspect first?"
- `error-types.md` answers: "What reasons, subtype values, and fields currently exist?"
- `typescript-types.md` answers: "What TypeScript shapes can application code narrow on?"
- Prefer a longer table that preserves searchable rows and concrete values over a compact table that requires the reader to infer grouped cases.

Documentation layout:

- The rendered error docs live under `docs/api/error-management/`.
- Do not create `docs/api/error-management/index.md`; navigation points to named pages.
- General pages:
  - `overview.md`: public overview plus this hidden maintenance note.
  - `error-types.md`: reason and subtype catalog from `src/TsSqlError.ts`.
  - `typescript-types.md`: TypeScript-facing declarations copied from `src/TsSqlError.ts`.
  - `library-raised-errors.md`: errors raised by the library outside native database mapper tables.
- Native mapping pages:
  - `native-mappings/mariadb.md`
  - `native-mappings/mysql.md`
  - `native-mappings/oracle.md`
  - `native-mappings/postgresql.md`
  - `native-mappings/sqlite.md`
  - `native-mappings/sql-server.md`

Source of truth:

- Use production code in `src`, not tests, examples, or generated site output.
- Start with `src/TsSqlError.ts`; it defines all valid `reason` names, subtype fields, and filled-field shapes.
- Rebuild native database mappings from:
  - `src/queryRunners/databaseErrorMappers/*`
  - query runners that add driver-specific or connector-specific reasons outside mapper files
  - transaction/concurrency guards in query runners and connection abstractions
  - direct driver signals such as pool errors, `tarn.TimeoutError`, and connector messages
- Rebuild library-raised errors from `src/TsSqlError.ts`, then use searches in `src` only to improve diagnosis and typical-source wording.

Connector link inventory:

- [@electric-sql/pglite](https://www.npmjs.com/package/@electric-sql/pglite)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [Bun SQL](https://bun.sh/docs/api/sql)
- [bun:sqlite](https://bun.sh/docs/api/sqlite)
- [mariadb](https://www.npmjs.com/package/mariadb)
- [mssql](https://github.com/tediousjs/node-mssql)
- [mysql2](https://www.npmjs.com/package/mysql2)
- [node:sqlite](https://nodejs.org/api/sqlite.html)
- [oracledb](https://www.npmjs.com/package/oracledb)
- [pg](https://github.com/brianc/node-postgres)
- [postgres.js](https://github.com/porsager/postgres)
- [sqlite-wasm](https://sqlite.org/wasm/doc/trunk/index.md)
- [sqlite3](https://www.npmjs.com/package/sqlite3)
- [tarn](https://www.npmjs.com/package/tarn)

Prisma:

- Do not fold Prisma into the six native mapping pages.
- Prisma exposes its own `Pxxxx` error space before many underlying database errors reach this library.
- Prisma mapping belongs to the Prisma query runner and, if documented later, should get separate Prisma-specific documentation.

Native mapping page rules:

- Each native page contains exactly one mapping table.
- Each native page starts with:
  - `# MariaDB Error Mapping`, `# MySQL Error Mapping`, `# Oracle Error Mapping`, `# PostgreSQL Error Mapping`, `# SQLite Error Mapping`, or `# SQL Server Error Mapping`
  - a paragraph saying the page lists how native database or driver errors are represented as `TsSqlErrorReason` values
  - a paragraph saying the table uses the same row catalog and order as the other native pages
  - a paragraph explaining the `Database error` column and that `SQL_UNKNOWN` is last
  - database-specific notes when required, especially for MySQL/MariaDB ambiguity and SQL Server number-first behavior
- The native table header is fixed:
  - `| Category | <span class="min-width-9rem">Reason</span> | Database error | Filled fields |`
  - followed by the standard four-column Markdown separator row
- The row catalog must be identical in MariaDB, MySQL, Oracle, PostgreSQL, SQLite, and SQL Server.
- The row order must be identical in those six pages.
- A row represents the semantic pair `reason + subtype value` when a subtype exists.
- Reasons without a subtype get one row for the reason itself.
- If the implementation can return the same reason both with and without a subtype, include the subtype rows plus the no-subtype row.
- Use `-` in `Database error` and `Filled fields` when that semantic row is not implemented for a database family.
- Keep `SQL_UNKNOWN` as the final row in every native table, using category `Fallback`.
- The current catalog has 145 rows; treat that as a useful sanity check, not as a permanent contract if `TsSqlError.ts` changes.
- Do not replace the six native pages with tabs. The current structure is one page per native database family.

Canonical row catalog construction:

- Build rows from the current `TsSqlErrorReason` union, not from existing table text alone.
- Include SQL reasons and `TRANSACTION_ERROR` in the native catalog when they can be produced by database or query runner mapping.
- Include each subtype value declared in `TsSqlError.ts`, for example:
  - `constraintType`
  - `errorType`
  - `objectType`
  - `parameterErrorType`
  - `identifierErrorType`
  - `statementErrorType`
  - `transactionErrorType`
  - `timeoutType`
  - `ioErrorType`
  - `objectStateErrorType`
  - `configurationErrorType`
  - `resourceType`
  - `corruptionType`
- Do not include library-only reasons such as `INVALID_MOCKED_VALUE` in native mapping tables.
- Put library-only reasons in `library-raised-errors.md`.

Reason cell format:

- Put the reason name in monospace.
- If the row has a subtype, use three visual lines:
  - reason in monospace
  - subtype field name in bold
  - subtype value in monospace
- Example: `SQL_INVALID_VALUE` followed by `errorType` and `invalid json`.
- If the row has no subtype, the cell contains only the reason.
- Header width helpers may use the CSS utility classes in `docs/extra.css`, such as `min-width-9rem`.
- Do not combine different subtype values in one native row. Each subtype value gets its own row.
- Do not collapse `TRANSACTION_ERROR` subtypes into one native row.
- Do not collapse `SQL_INVALID_SQL_STATEMENT` subtypes into one native row.
- Do not collapse `SQL_INVALID_VALUE` subtypes into one native row.

Database error cell format:

- Use one line per implemented native signal, separated with `<br>`.
- Prefer the actual thrown values over explanatory prose.
- If both code and number are populated, use:
  - `` `databaseErrorCode` / `databaseErrorNumber`: short meaning ``
- If only a code is populated, use:
  - `` `databaseErrorCode`: short meaning ``
- If only a number is populated, use:
  - `` `databaseErrorNumber`: short meaning ``
- Example with code and number:
  - `` `ER_DUP_ENTRY` / `1062`: unique constraint violation ``
- Example with SQLSTATE:
  - `` `unique_violation` / `23505`: unique constraint violation ``
- Example with connector-only code:
  - `` `ETIMEOUT` ([pg](https://github.com/brianc/node-postgres)): connector timeout ``
- Example with textual driver message:
  - `Pool is closed. ([mysql2](https://www.npmjs.com/package/mysql2)): pool already closed`
- Connector-origin signals include the connector link inline in parentheses on the same line.
- Textual message patterns are normal text, not monospace, unless they are exact stable codes.
- Broad class, range, registry, or message-pattern fallbacks are allowed only when the mapper intentionally handles an open-ended family.
- If the same native code can map to different rows depending on message inspection, say that in the short meaning.
- Do not document possible database errors that are not mapped by the current implementation.
- If several signals map to the same semantic row, keep each signal on its own line in the same `Database error` cell.
- If a signal is implemented only for a specific connector, include only that connector link on that signal line.

Database-specific notes:

- MySQL and MariaDB share names and numeric ranges but not always semantics.
- In MySQL and MariaDB docs, do not list bare numeric errors from the other database family.
- If a number exists in the active database catalog, document `databaseErrorCode` and `databaseErrorNumber`.
- If a number only exists in the other family, do not document it as a native mapping for the current family.
- If the driver supplies an explicit code, the mapper preserves it even when the number is ambiguous.
- SQLite rows should show textual and numeric codes together, for example `SQLITE_CONSTRAINT_UNIQUE` slash `2067`.
- SQLite should include both textual and numeric SQLite codes when the implementation can expose both.
- SQLite connector-specific textual messages should keep connector links inline.
- SQL Server is number-first for engine errors. Through `mssql`, engine errors commonly have `databaseErrorCode` equal to `EREQUEST`; the native SQL Server discriminator is `databaseErrorNumber`.
- SQL Server driver-only signals such as `ETIMEOUT`, `ELOGIN`, `EARGS`, `EPARAM`, `EINJECT`, or `EDUPEPARAM` should still be documented as textual driver codes.
- Oracle `ORA-xxxxx` codes should be shown with their numeric value when the implementation fills both.
- PostgreSQL SQLSTATE values are represented as `databaseErrorCode` and `databaseErrorNumber` when the mapper fills both.

Filled fields rules:

- `Filled fields` is row-specific and database-specific.
- List only fields populated by that implementation path.
- Use qualifiers such as `when available`, `when inferred`, `for coded cases`, or `for direct checks` when a field is conditional.
- If no field is populated for the row, use `-`.
- Do not add fields just to make pages symmetrical.
- Keep common metadata wording consistent:
  - `databaseErrorCode` when available
  - `databaseErrorNumber` when available
  - `databaseErrorMessage`
  - field-specific wording such as `constraintName` when inferred
- For direct library checks inside a native page, state that direct checks fill no extra fields when that is true.

Library-raised errors page rules:

- The page starts with `# Library-Raised Errors`.
- The introduction explains that the page covers errors raised directly by `ts-sql-query` outside the native database mapping tables.
- The introduction also says that some reasons can be produced by query runners, while driver code, number, and message details live in native mapping pages.
- Keep two sections:
  - `Library-raised errors`
  - `Internal invariant errors`
- The non-internal table header is fixed:
  - `| Category | Reason | Diagnosis | <span class="min-width-11rem">Filled fields</span> |`
  - followed by the standard four-column Markdown separator row
- The internal table header is fixed:
  - `| Category | Reason | Diagnosis | Filled fields |`
  - followed by the standard four-column Markdown separator row
- `Diagnosis` uses in-cell labels such as `Meaning` and `Typical source`.
- `Diagnosis` should use the pattern:
  - `**Meaning**<br>...<br><br>**Typical source**<br>...`
- Keep `UNKNOWN` in the non-internal table; it is the fallback for caught values that are not recognized as SQL or library errors.
- Keep `INTERNAL` only in the internal invariant section.
- Add one internal row per `internalErrorType` declared in `TsSqlInternalErrorReason`.
- Add one row per subtype or subcase when useful for diagnosis, especially:
  - `DISALLOWED` by `functionName`
  - `ERROR_EXECUTING_DEFERRED_IN_TRANSACTION` by `deferredType`
  - `INVALID_MOCKED_VALUE` by query type group, with each concrete `queryType` listed on its own line
- `TRANSACTION_ERROR` can appear in this page as a library-facing reason, but database-specific signals remain in the native mapping pages.
- Internal invariant descriptions should not sound recoverable. They normally indicate a library bug, impossible state, unexpected internal data, or an advanced integration implemented incorrectly.

Error types page rules:

- Keep `error-types.md` focused on the reason catalog, subtype values, and common fields.
- Keep these sections:
  - `Common Database Metadata`
  - `SQL Reasons With Subtypes`
  - `SQL Reasons Without Subtypes`
  - `Library And Processing Reasons`
  - `Internal Error Subtypes`
- Do not add driver codes or database numbers to this page; those belong to native mapping pages.
- Do not add long diagnosis text here; use `library-raised-errors.md` for library diagnosis and native mapping pages for database lookup.

TypeScript types page rules:

- Keep `typescript-types.md` focused on TypeScript declarations and narrowing examples.
- It may copy declarations from `src/TsSqlError.ts`, but the semantic explanation belongs in `error-types.md`.
- Keep the narrowing example short and oriented around `error.errorReason`.

Validation checklist:

1. Confirm all documented reasons exist in `src/TsSqlError.ts`.
2. Confirm no obsolete reason names remain in visible pages.
3. Confirm all six native tables have the same row count.
4. Confirm all six native tables have the same `Category + Reason` order.
5. Confirm `SQL_UNKNOWN` is the last row in each native table.
6. Confirm each documented `Database error` signal is implemented in production code.
7. Confirm no important implemented mapper signal is missing.
8. Confirm MySQL and MariaDB do not inherit bare numeric meanings from the other family.
9. Confirm SQLite textual and numeric codes match the mapper.
10. Confirm SQL Server engine rows are explained as number-first and driver-only rows as code-first.
11. Confirm connector-origin signals include inline connector links.
12. Confirm `Filled fields` matches the exact returned object shape.
13. Confirm `library-raised-errors.md` covers all non-SQL reasons from `TsSqlError.ts`.
14. Confirm each `internalErrorType` has its own row.
15. Confirm `INTERNAL` does not appear in the non-internal library table.
16. Run Git whitespace diff checking.
17. Run `./.venv/bin/mkdocs build`.
18. Remove generated `site/` output after building if it is present.
-->
