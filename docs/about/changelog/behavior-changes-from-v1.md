---
search:
  boost: 0.13
---
# Behavior changes from v1

An application that moves from v1 to v2 gets other results in some places without changing a line: v2 corrects what v1 emitted wrong, rejects what v1 lost without telling, refuses to compile queries that never worked, and changes the SQL text it writes. There is nothing to do about these unless your code relied on the old result: if it compensated for a wrong value, remove the compensation; if it needs the old value back, some have a property of the connection for it. What you do have to change is in [Migrating from v1](migrating-from-v1.md).

The sections go from what changes the rows to what only changes the text:

1. [Queries that read or write other rows](#queries-that-read-or-write-other-rows): conditions, inserts and updates that v1 emitted wrong.
2. [Transactions the database had already lost](#transactions-the-database-had-already-lost): they now reject, where v1 resolved and nothing was saved.
3. [Values, with a way back](#values-with-a-way-back): `NULL` in `minValue`, `maxValue` and Oracle's `concat`, `replaceAll`, `length` and `round`.
4. [Values, corrected](#values-corrected): functions that gave a wrong value.
5. [Queries that never worked no longer compile](#queries-that-never-worked-no-longer-compile): the database rejected them; now the compiler does.
6. [What only changes the SQL text](#what-only-changes-the-sql-text): logs, test snapshots, mocks and interceptors.

## Queries that read or write other rows

v1 emitted these wrong, or did what wasn't asked. Check any code that relied on the old result.

**Conditions:**

- **A comparison of an `int` with a value that isn't an integer no longer throws.** `.equals(1.5)`, `.in([1.5])`, `.greaterThan(NaN)` and the same in a dynamic condition threw `Invalid int value to send to the db` in v1. Now the value is sent, and `.equals(1.5)` finds no row, as the same SQL does, where your code used to get an error. Writing such a value (`set`, and `const`) still throws.
- `.on(a).or(b)` in the join of a multi-table update or delete emitted `and` (seen on MySQL, MariaDB, PostgreSQL and SQL Server). It now emits `or`, so **it affects more rows**.
- `.notEndsWith(...)` on MySQL and MariaDB was emitted as `like`, selecting the rows it should exclude.
- `contains`, `startsWith`, `endsWith` and their variants escaped special characters of the search text wrongly: `\` on MySQL and MariaDB, `_` on SQL Server, and `\`, `%`, `_` and `[` on Oracle.
- `subSelectDistinctUsing(...)` emitted no `distinct`.
- MySQL, MariaDB: a column of a table in `having` is written with the name of the table. These databases took it as the column of the select with the same name, and filtered by that value. **If that column isn't in the group by, the database rejects the query** ([docs](../../queries/aggregate-and-group-by.md#a-column-that-isnt-in-the-group-by-in-the-having)).
- MySQL, MariaDB: `groupBy('alias')` of an expression with parameters is written with its position, `group by 1`. Don't add columns through `afterSelectKeyword` or `beforeColumns` in [`customizeQuery`](../../queries/sql-fragments.md#customizing-a-select) in those queries.

**Writes:**

- `ignoreIfHasNoValueWhen(true, 'column')` did the opposite in v1: it wrote the column without a value (as `NULL`), and left out the one with a value.
- `.onConflictOn(column).doUpdateSet({})`, with nothing to set, was a plain insert that failed on the conflict. It is now `on conflict do nothing`; `insert ignore` on MySQL and MariaDB.
- `executeInsert(min, max)` counts the real rows. v1 counted any plain insert as one row, so `executeInsert(5)` failed after inserting 7, and `executeInsert(0, 2)` passed.
- `returningLastInsertedId()` after an `onConflictDoNothing()` that skips the row is `null`. It was `0` on MySQL and MariaDB, and an older id on `BetterSqlite3QueryRunner` when `compatibilityVersion` is below SQLite 3.35.
- Oracle: a multi-row insert was emitted as a malformed `insert allinto ...`. It is now a `begin ... end;` block.

**Ordering and limits:**

- `orderBy`, `limit` and `offset` of a recursive select applied to its first part, before the recursion. They now apply to the whole result.
- `orderBy('alias', mode)`, with a mode that wraps the column like `'insensitive'`, could order by another column: `lower("n")` means the column `n` of the table, if there is one, on PostgreSQL. It is now `lower(first_name)`, the expression of the select. On Oracle, it doesn't change.
- MySQL, MariaDB: `'asc nulls last insensitive'` and `'desc nulls first insensitive'` lost the case insensitivity.
- Oracle: an `orderBy` in a subquery gets `offset 0 rows`, which makes Oracle honour it.

## Transactions the database had already lost

**PostgreSQL: catching the error of a statement doesn't save the transaction.** PostgreSQL answers the commit of a failed transaction with a rollback. v1 didn't look at that answer, so `connection.transaction(...)` resolved, and nothing was saved. v2 reads it and rejects with `TRANSACTION_ERROR`, `transactionErrorType: 'transaction rolled back'`, running the after-rollback functions ([docs](../../configuration/supported-databases/postgresql/index.md#a-statement-that-fails-inside-a-transaction)).

**MariaDB, MySQL, SQL Server, SQLite: a transaction the database rolled back by itself is over.** A deadlock, for example, can do this. v1 had no check for it and went on sending statements, which the database runs on their own, committed one by one. When the query runner can tell from the error, v2 rejects those statements with the same `TRANSACTION_ERROR`, without sending them. `Sqlite3WasmOO1QueryRunner` can't tell ([docs](../../queries/transaction.md#when-the-database-rolls-back-the-transaction)).

## Values, with a way back

These give other results on purpose. A property of the connection brings back the old SQL.

| Database | What changes | To go back |
|---|---|---|
| PostgreSQL | `.minValue(...)` and `.maxValue(...)` are `NULL` when an operand is `NULL`; v1 ignored the `NULL` | [`ignoreNullInMinAndMaxValue = true`](../../configuration/supported-databases/postgresql/index.md#minvalue-maxvalue-and-null) |
| SQL Server | `.minValue(...)` and `.maxValue(...)` are `NULL` when an operand is `NULL`. v1's `iif(a > b, a, b)` gave `b` when `a` was `NULL`, and `NULL` when `b` was | [`ignoreNullInMinAndMaxValue = true`](../../configuration/supported-databases/sqlserver/index.md#minvalue-maxvalue-and-null). This isn't quite v1: it emits `greatest(a, b)`, which ignores a `NULL` on either side. v1's `iif` only comes back with a `compatibilityVersion` below 2022 |
| Oracle | `.concat(...)` is `NULL` when an operand is `NULL`. `startsWith`, `endsWith`, `contains` and their `Insensitive` variants with a `NULL` search term match no row; v1 matched them all | [`ignoreNullInConcat = true`](../../configuration/supported-databases/oracle/index.md#concatenation-and-null), or [`.concatIgnoringNull(...)`](../../configuration/supported-databases/oracle/index.md#concatenation-and-null) for one concatenation |
| SQL Server, Oracle | `.replaceAll(...)` is case-sensitive even in a case-insensitive database | [`replaceCollation = ''`](../../configuration/collations.md#replacecollation-sql-server-and-oracle) |
| SQL Server | `.length()` counts trailing blanks | [`excludeTrailingBlanksInLength = true`](../../configuration/supported-databases/sqlserver/index.md#length-and-trailing-blanks) |
| PostgreSQL, MySQL, MariaDB | `.round()` over a floating-point value breaks ties away from zero | `usePlatformDependentRound = true` ([PostgreSQL](../../configuration/supported-databases/postgresql/index.md#rounding-behavior), [MySQL](../../configuration/supported-databases/mysql/index.md#rounding-behavior), [MariaDB](../../configuration/supported-databases/mariadb/index.md#rounding-behavior)) |

<!-- doc-code-snippet-template: sqlserver -->
```ts
class DBConnection extends SqlServerConnection<'DBConnection'> {
    protected override ignoreNullInMinAndMaxValue = true
    protected override excludeTrailingBlanksInLength = true
    protected override replaceCollation = ''
}
```

## Values, corrected

These returned a wrong value in v1, or depended on something they shouldn't. If your code compensates for one, remove the compensation; there is no way back.

**Logarithms and roots:**

- `.logn(n)` on PostgreSQL, Oracle and SQLite had its arguments reversed: `log(value, n)`, now `log(n, value)`.
- `.log10()` on Oracle was the logarithm of 10 in base `x`. `.ln()` on SQLite was emitted as `log(x)`, base 10.
- `cbrt()` computes the cube root; except on PostgreSQL, it computed the cube.

**Numbers:**

- `average(...)` is computed in floating point. On SQL Server, the average of an `int` column was truncated to an integer; on MySQL and MariaDB, it was cut to 4 decimals.
- `asInt()` and `asBigint()` over a double produce an integer type in SQL, so what follows is integer arithmetic.
- MySQL, MariaDB: `.divide(...)` always divides in floating point, `1 / 3` was cut to 4 decimals, and `.asDouble()` really is a double.
- PostgreSQL: `const(7, 'int').lessThan(10)` was `false`, compared as text; the constant now has its type.
- SQL Server: `.power(...)` over an integer keeps the fraction: `intColumn.power(0.5)` was `1`. `double` values are sent as `float`, not the less precise `real`.
- SQLite: `connection.random()` returns a `double` in `[0, 1)`, not a 64-bit integer.

**Strings:**

- `substr`, `substring`, `substrToEnd` and `substringToEnd` follow JavaScript when the index is a number: a negative index counts from the end in `substr` and is 0 in `substring`, and `substring` swaps its arguments when `start > end`. An index that is a value source is not affected.
- MySQL, MariaDB: `.length()` counts characters, not bytes: `'café'` is 4, not 5.
- SQL Server: `.valueWhenNull(...)` doesn't cut the fallback to the type of the column.

**Dates:**

- `getTime()` on MySQL and MariaDB is right outside 1970 to 2038, where `unix_timestamp` doesn't work. Its SQL also changes on Oracle and SQLite.
- `getMilliseconds()` truncates on MySQL, MariaDB and PostgreSQL, where rounding could reach 1000 or wrap to 0. On SQLite, it rounds the fraction before taking the remainder.
- PostgreSQL: `getSeconds()` doesn't reach 60.
- SQL Server: `getDay()` doesn't depend on `SET DATEFIRST`: 0 is always Sunday.

**Other:**

- SQL Server, Oracle: a projected `between` whose upper bound is optional is `NULL` when that bound is `NULL`. It was `false`.
- [`dynamicPickPaths`](../../dynamic/helper-types/picks.md) with a path of 3 or more levels dropped it.

## Queries that never worked no longer compile

v2 refuses, when your code compiles, queries that the database rejects or that always failed. v1 compiled them and they failed when they ran, so your application never ran them successfully: if the compiler points at one of them, that query was failing. Write it as each item says.

**Aggregates, where SQL doesn't allow them:**

- An aggregate function in `where`, `and`, `or`, `groupBy` or the `on` of a join. It stays allowed in `select`, `having` and `orderBy`. A custom fragment that is an aggregate has its [own builders](../../queries/sql-fragments.md#aggregate-fragments), to get the same check.
- An aggregate of an aggregate (`connection.max(connection.count(tCustomer.id))`), except on Oracle. Aggregate over a subquery that aggregates.
- `groupBy('name')` with a column of the select that is an aggregate.

**Insert and on conflict:**

- `.onConflictOnConstraint(...)` only takes a raw fragment ([docs](../../queries/insert-on-conflict.md#a-conflict-on-a-named-constraint)). The name as a string or an expression didn't work, and it has been deprecated since v1.68.0 (14 Jun 2026):

    ```ts
    const inserted = await connection.insertInto(tCustomer)
        .set({ firstName: 'John', lastName: 'Smith', companyId: 1 })
        .onConflictOnConstraint(connection.rawFragment`customer_name_key`)
        .doNothing()
        .executeInsert()
    ```

- PostgreSQL: `.onConflictDoUpdateSet(...)`, `.onConflictDoUpdateSetIfValue(...)` and `.onConflictDoUpdateDynamicSet()` without a target are gone (deprecated in v1.69.0; PostgreSQL requires a target for `do update`). Use [`.onConflictOn(column).doUpdateSet(...)`](../../queries/insert-on-conflict.md#update-the-existing-row-upsert).
- `insertInto(table).from(select)` with a column the table doesn't have.

**Per database.** v1.69.0 deprecates them on those databases:

| Database | No longer available | Use |
|---|---|---|
| Oracle, SQL Server | `recursiveUnion`, `recursiveUnionOn` | `recursiveUnionAll`, `recursiveUnionAllOn` |
| MySQL, Oracle, SQL Server | `aggregateAsArrayDistinct`, `aggregateAsArrayOfOneColumnDistinct` | |
| SQL Server | `stringConcatDistinct` | |
| SQLite | `stringConcatDistinct(value, separator)`; `connection.default()` | `stringConcatDistinct(value)`; omit the column |
| Oracle | `.orderingSiblingsOnly()` after the `.orderBy(...)` of a compound query | |

## What only changes the SQL text

These affect logs, test snapshots, mocks and interceptors that read the SQL. They mean the same; where a change of SQL also changes the result, it is in the sections above. The parameters can change too, in number and in order.

| Database | v1 | v2 |
|---|---|---|
| SQLite | `where id = ?` | `where id = ?1`, also with `MockQueryRunner` and `NoopQueryRunner` |
| SQLite | `insert into ...` | `insert into ... returning id`, to read the last inserted id |
| SQLite | `order by ln is null, ln asc` | `order by ln asc nulls last` |
| SQLite | `where id in ()` | `where 0` |
| MariaDB | `insert into ...` | `insert into ... returning id`, to read the last inserted id |
| MariaDB | `on duplicate key update x = values(x)` | `on duplicate key update x = value(x)` |
| MySQL | `values (?) on duplicate key update x = values(x)` | `values (?) as _new_ on duplicate key update customer.x = _new_.x` |
| MySQL, MariaDB | `order by ln is null, ln asc` | `order by last_name is null, ln asc`, with the column |
| MySQL, MariaDB | `json_arrayagg(...)` | `cast(json_arrayagg(...) as char)` |
| PostgreSQL | `json_agg(...)` | `(json_agg(...))::text` |
| PostgreSQL | `update customer as _new_ ... from (select _old_.* ...)` for `oldValues()` | `update customer ... returning old.x` |
| SQL Server | `getdate()` for `currentDate()` | `current_date`, or `cast(getdate() as date)` below 2025 |
| SQL Server | `isnull(x, @0)` | `coalesce(x, @0)` |
| SQL Server | `substring(x, @0, len(x) - @1)` for `substrToEnd` and `substringToEnd` | `substring(x, @0)` |
| SQL Server | `string_agg(...)` for the aggregated arrays | `json_arrayagg(...)` |
| SQL Server | `iif([ln] is null, 1, 0)` in `order by` | `iif(customer.last_name is null, 1, 0)`, with the column |
| All but SQLite | The parameter of a `localTime`, the string `'05:06:07'` | A `Date` on 1970-01-01 whose UTC getters are the time |
| All but MySQL and MariaDB | `group by first_name + @1`, with the parameter twice | `group by first_name + @0`, with the parameter once |
| All | `with w as (...)` not used in the query | Left out |
| All | A column in `beforeOrderByItems` and `afterOrderByItems`, bare | With the name of the table |
| All | `avg(x)` | `avg(cast(x as float))`, with the floating-point type of each database |
