---
search:
  boost: 0.55
---
# Collations & case sensitivity

Two databases running the *same* SQL can disagree on whether `'ADA'` equals `'ada'` or `'café'` equals `'cafe'`. The reason is the **collation** — the rule each engine uses to compare and sort text — and each database ships with a different default one. This page explains what that means, why it makes a portable query behave differently per engine, and the levers ts-sql-query gives you to take control.

Unlike [time zones](time-zones.md), collation has **no single correct target**. Case-sensitive, case-insensitive, accent-insensitive and language-specific rules are all *valid* — a search box wants case-insensitive, a token or hash wants byte-exact, a person-name dedup might want accent-insensitive, a Spanish-language sort wants a Spanish collation. So this page does **not** prescribe one behaviour; it explains the model and lays out the options so you can pick per situation.

## What is a collation?

When a database compares or sorts text — `WHERE name = 'ada'`, `ORDER BY name`, `GROUP BY name`, `DISTINCT`, `LIKE` — it does **not** compare raw bytes. It applies a **collation**: a named set of rules that decides whether two strings count as *equal* and how they *sort*. A collation answers questions like:

- Is `'ADA'` equal to `'ada'`? → **case** sensitivity.
- Is `'café'` equal to `'cafe'`? → **accent** sensitivity.
- Does `'ñ'` sort after `'n'` or after `'z'`? → **language** rules.

Every text column has a collation. You usually never chose it: it was inherited from a default when the column — or the whole database — was created. That inherited default is exactly what makes the same query behave differently on two engines.

!!! note "Two axes: CI and AI"

    A collation combines two independent choices:

    - **Case-Insensitive (CI)** — `'ABC'` and `'abc'` compare *equal*.
    - **Accent-Insensitive (AI)** — `'café'`, `'cafe'` and `'CAFÉ'` compare *equal*.

    Any mix is valid. SQL Server's default is **CI + accent-sensitive**; MySQL's is **CI + AI**; a *binary* (code-point) collation is **case- and accent-sensitive**, comparing raw code points. JavaScript's `===` on strings is case- and accent-sensitive — which is *not necessarily* what you want for data a person searches.

### Where a collation is set (in SQL)

A collation can be chosen at three levels. **These are plain SQL, not ts-sql-query** — but knowing they exist tells you which lever to reach for.

**On the database or a column** — a `CREATE DATABASE` chooses a default that every text column inherits, and a `CREATE TABLE` can override it per column:

=== "MariaDB"
    ```sql
    CREATE DATABASE app CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci;
    CREATE TABLE app_user (name varchar(100) COLLATE utf8mb4_bin); -- a case-sensitive column
    ```

=== "MySQL"
    ```sql
    CREATE DATABASE app CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
    CREATE TABLE app_user (name varchar(100) COLLATE utf8mb4_bin); -- a case-sensitive column
    ```

=== "Oracle"
    ```sql
    -- database default (needs MAX_STRING_SIZE = EXTENDED)
    ALTER DATABASE ... DEFAULT COLLATION binary_ci;
    CREATE TABLE app_user (name varchar2(100) COLLATE binary); -- a case-sensitive column
    ```

===+ "PostgreSQL"
    ```sql
    CREATE DATABASE app LC_COLLATE 'en_US.utf8' TEMPLATE template0;
    CREATE TABLE app_user (name text COLLATE "C"); -- a code-point (case-sensitive) column
    ```

=== "SQLite"
    ```sql
    -- SQLite has no database-level default collation
    CREATE TABLE app_user (name text COLLATE NOCASE); -- a case-insensitive (ASCII) column
    ```

=== "SQL Server"
    ```sql
    CREATE DATABASE app COLLATE Latin1_General_CI_AS;
    CREATE TABLE app_user (name varchar(100) COLLATE Latin1_General_CS_AS); -- a case-sensitive column
    ```

**In a single expression** — a `COLLATE` clause on one comparison overrides both, just there. This is what ts-sql-query emits for [`.collate('<name>')`](#collate-force-a-collation-per-value).

!!! tip "If you own the schema, prefer the column or database collation"

    Setting the collation on the column or the database is the cleanest fix: no query changes and no per-query cost. The query- and connection-level levers on this page are for when you **can't** change the schema — a legacy database you inherited, or a single query that needs a different collation than the column has.

## The default collation of each database

Because the inherited default differs per engine, the *same* portable query behaves differently across them:

| engine | default collation | `=` case | `=` accent |
|---|---|---|---|
| **PostgreSQL** | `en_US.utf8` / libc, deterministic | **sensitive** | sensitive |
| **Oracle** | `BINARY` (`NLS_COMP` = `NLS_SORT` = `BINARY`) | **sensitive** | sensitive |
| **SQLite** | `BINARY` (for `=`); `LIKE` is ASCII-CI | **sensitive** (`=`) | sensitive |
| **SQL Server** | `SQL_Latin1_General_CP1_CI_AS` | **insensitive** | sensitive |
| **MySQL** | `utf8mb4_0900_ai_ci` | **insensitive** | **insensitive** |
| **MariaDB** | `utf8mb4_uca1400_ai_ci` | **insensitive** | **insensitive** |

So `contains('abc')` matches only lowercase on PostgreSQL / Oracle / SQLite, folds case on SQL Server / MySQL / MariaDB, and additionally folds accents on MySQL / MariaDB.

!!! note "This is by design — the plain operations follow your schema"

    ts-sql-query does **not** force a collation on the ordinary string operations (`equals`, `contains`, `like`, `in`, `min`/`max`, `ORDER BY`, `GROUP BY`, `DISTINCT`, `replaceAll`). They honour whatever collation your column/database is configured with. So `contains` behaving like `containsInsensitive` on a case-insensitive database is *correct*, not a collapsed distinction — both are case-insensitive because the column is. The **`*Insensitive`** operations (`equalsInsensitive`, `containsInsensitive`, …) are the ones that deliberately **force** case-insensitive matching over the configured collation.

!!! warning "The one genuine surprise: `replaceAll` on SQL Server (and case-insensitive Oracle)"

    Matching *filters* following the collation is intended. But `replaceAll` is a **value transform**, and on the two engines whose `REPLACE` honours collation it silently corrupts the value on a case-insensitive configuration:

    ```
    'ABCabc'.replaceAll('abc', 'X')

    SQL Server (default is CI)  ->  'XX'    <- corrupts: both cases matched
    the other five              ->  'ABCX'  <- only the lowercase 'abc'
    ```

    `REPLACE` honours collation on **SQL Server and Oracle only**. SQL Server corrupts *by default* (its default collation is CI); Oracle corrupts only if configured CI. ts-sql-query fixes this by default with [`replaceCollation`](#replacecollation-sql-server-and-oracle).

## Case folding is language-dependent

Before reaching for a lever, one caution that shapes every choice below: **"case-insensitive" is not one behaviour.** The *same* comparison can flip between two languages, and even two engines disagree on the "same" rule:

- **Turkish dotted/dotless I.** `'I' = 'i'` is **true** under a Latin collation and **false** under a Turkish one (Turkish's uppercase of `i` is `İ`, and `I` lowercases to `ı`). A Latin case-insensitive collation on Turkish data silently mismatches.
- **German ß** (sharp s). `'ß' = 'ss'` is **true** under SQL Server's `Latin1_General_CI_AS` but **false** under a PostgreSQL ICU collation at primary strength (there ß is its own letter). Same question, opposite answer, by engine.
- **CJK** (Chinese, Japanese and Korean scripts). No upper/lower case at all, but its own hazards: Unicode normalization (the same character encoded two ways — NFC vs NFD), Han character-variant folding, and sort order (pinyin vs stroke vs code point) — none handled by `lower()` or a generic collation.

This is why ts-sql-query injects a **language-specific collation** rather than leaning on `lower()` (which is ASCII-only and locale-blind), and why the right collation is a property of *your data's language* — which only you know.

## Which operations are affected

**Collation-dependent** (a dialect switch can change the result):

- **Matching** — `equals` / `notEquals`, `like` / `notLike`, `contains` / `startsWith` / `endsWith` (+ `not…`), `in` / `notIn`.
- **Ordering** — `lessThan` / `greaterThan` / `lessOrEqual` / `greaterOrEqual`, `between` / `notBetween` on strings.
- **Set / aggregate** — `DISTINCT`, `GROUP BY`, `min` / `max`, `orderBy`, `count(distinct)`.
- **`replaceAll`** — the value transform in the warning above.
- **`toLowerCase` / `toUpperCase`** — case mapping is locale-dependent, so the *returned value* differs across dialects for non-ASCII input (`upper('ß')` is `ẞ` on PostgreSQL, `ß` on the others).

**Not affected** — `substr` / `substring`, `trim`, `length`, `reverse`, `concat` are index- or byte-based, so no collation-governed match.

!!! warning "Unique constraints and `onConflict` upserts resolve under the column's collation"

    The **same insert** can succeed on a case-sensitive engine and hit a duplicate on a case-insensitive one — `'Ada'` and `'ADA'` are one key on a CI column, two on a CS one. The library cannot own the index collation; keep it in mind when a schema moves between engines.

## The tools

You can pick the collation at **three conceptually different levels**. This table is the whole picture; the sections below go into each. The **query** levers are the library's API (detailed right after); the **schema** and **connection** levers are plain SQL and a driver hook, covered under [Beyond the query](#beyond-the-query-the-schema-and-the-session).

| level | lever | set on / called on | direction |
|---|---|---|---|
| **query** | `.collate('<name>')` | method on a string value source | **either** — force case-sensitive or case-insensitive |
| **query** | `.replaceAllInsensitive(...)` | method on a string value source | insensitive — the twin of `replaceAll` |
| **query** | `insensitiveCollation` | property on **any `Connection`** | insensitive (`'<name>'` forces it; `''` trusts the column) |
| **query** | `replaceCollation` | property on **`SqlServerConnection` / `OracleConnection`** | case-sensitive by default; `''` opts out |
| **query** | `replaceInsensitiveCollation` | property on **`OracleConnection`** | insensitive — Oracle's forced collation for `replaceAllInsensitive`; `''` opts out |
| **query** | `replaceAllInsensitiveFunction` | property on **`SqliteConnection`** | insensitive — names the SQLite user-defined function (UDF) |
| **schema** | column / database collation | plain SQL (`CREATE TABLE` / `CREATE DATABASE … COLLATE`) | either — the cleanest, if you own the schema |
| **connection** | session collation | the engine's session statement, on connect | either — Oracle full, SQLite `LIKE`, MySQL/MariaDB partial, SQL Server & PostgreSQL none |

The **query** levers are the library's API. Two of them are **methods on a string value source** (a column, a `const`, any string expression); the rest are **properties you set by subclassing your `Connection`**, exactly like every other connection option:

```typescriptreact
import { SqlServerConnection } from "ts-sql-query/connections/SqlServerConnection";

class DBConnection extends SqlServerConnection<'DBConnection'> {
    override insensitiveCollation = 'Latin1_General_CI_AI'
}
```

### `insensitiveCollation` — force the insensitive direction connection-wide

By default a `*Insensitive` operation (`startsWithInsensitive`, `equalsInsensitive`, …) is emitted by calling `lower(...)` on both sides. Setting **`insensitiveCollation`** on the connection replaces that with a `… collate <name>` clause instead, which lets you do more than ASCII case folding — accent-insensitive, or language-specific rules — by naming a collation the engine ships. The [Per database](#per-database) tabs list the case- and accent-insensitive collation names for each engine (and, for PostgreSQL, the collation you must create first).

Three states:

- **a name** (`'Latin1_General_CI_AI'`, a PostgreSQL non-deterministic collation, …) → emit `… collate <name>`.
- **`''`** (empty string) → emit the bare operation with no `lower()` and no collate. Use this when your **column/database is already case-insensitive**: it produces leaner, index-usable SQL (fewer `lower()` calls) with the same result.
- **unset** (the default) → the `lower(a) … lower(b)` fallback.

### `.collate()` — force a collation per value

`.collate('<name>')` is a **method on any string value source** — a column, a `const`, or any string expression. It emits `<expr> collate <name>` (parenthesised automatically when embedded in a larger expression) and returns a string value source of the same type, so you can chain it into either operand of a comparison, a projected / grouped / ordered column, or a `replaceAll` argument. It forces a specific collation on **that one expression** — case-sensitive, case-insensitive, or a language-specific one — paying the index cost (below) only there. The name is a static collation identifier (SQL requires it — a collation is not a runtime value), so it is passed as a string.

```typescriptreact
// Force a binary, case-sensitive comparison on a case-insensitive database (SQL Server):
connection.selectFrom(tUser)
    .where(tUser.name.collate('Latin1_General_BIN2').equals(name))
    .select({ id: tUser.id })
    .executeSelectMany()

// Force case-insensitive matching on a single query (MySQL):
tUser.name.collate('utf8mb4_0900_ai_ci').equals(name)
```

The name is a **raw dialect collation name** (like `insensitiveCollation`), so `.collate('utf8mb4_bin')` is not portable to SQL Server — for cross-dialect code, prefer the connection-level knobs or the schema collation. The [Per database](#per-database) tabs list the names to use.

!!! warning "Two engine caveats for `.collate()`"

    - **PostgreSQL** — forcing case-insensitive **equality** (or `DISTINCT` / `GROUP BY`) needs a **non-deterministic** collation object. The built-in `*-CI-x-icu` collations are deterministic and byte-tiebreak on equality, so `.collate('fr-CI-x-icu')` changes *ordering* but not equality folding. Create one once (the [PostgreSQL tab](#per-database) shows the `CREATE COLLATION … (deterministic = false)` recipe) and pass its name. For the `LIKE` direction PostgreSQL has native `ILIKE`, which the library already emits for the `*Insensitive` LIKE operations.
    - **SQLite** — `.collate()` governs `=`, `DISTINCT`, `ORDER BY`, `min` / `max` (via `NOCASE` / `BINARY`) but **not** `LIKE`. SQLite's `LIKE` ignores the operand collation; its case behaviour is the connection-global `PRAGMA case_sensitive_like` (or `GLOB`, with different wildcards). So `.collate()` cannot make `.contains` / `.startsWith` case-sensitive on SQLite.

### `replaceCollation` (SQL Server and Oracle)

On SQL Server and Oracle — the two engines whose `REPLACE` honours collation — `replaceAll` corrupts the value on a case-insensitive configuration (see the warning above). ts-sql-query fixes this **by default**: it pins a binary / code-point collation on the match operands and resets the result collation so the forced collation does not leak into a chained comparison.

```
SQL Server:  replace(<src> collate Latin1_General_BIN2, <from> collate Latin1_General_BIN2, <to>) collate DATABASE_DEFAULT
Oracle:      replace(<src> collate BINARY,              <from> collate BINARY,              <to>) collate USING_NLS_COMP
```

**`replaceCollation`** is a property on `SqlServerConnection` / `OracleConnection`. It defaults to `Latin1_General_BIN2` (SQL Server) / `BINARY` (Oracle), so `replaceAll` is code-point exact whatever the database collation. Set it to another collation name to force a different one, or to the **empty string** `''` to opt out entirely and emit the bare native `replace(...)`:

```typescriptreact
import { SqlServerConnection } from "ts-sql-query/connections/SqlServerConnection";

class DBConnection extends SqlServerConnection<'DBConnection'> {
    override replaceCollation = '' // opt out — follow the database collation (case-insensitive by default)
}
```

For the per-database detail see the [SQL Server](supported-databases/sqlserver.md#replaceall-and-collation) and [Oracle](supported-databases/oracle.md#replaceall-and-collation) pages.

!!! danger "Upgrading from a version before `replaceCollation`"

    This changed `replaceAll`'s default emission on SQL Server and Oracle. If your application **relied** on the old case-insensitive `replaceAll` on a CI SQL Server, set `replaceCollation = ''` to restore it. On the other four engines nothing changed — their `REPLACE` ignores collation, so the config is not offered there.

### `replaceAllInsensitive(...)` — the insensitive twin

`.replaceAllInsensitive(...)` (and `.replaceAllInsensitiveIfValue(...)`) is a **method on a string value source**, completing the pair the rest of the API has (`contains` / `containsInsensitive`, …): `replaceAll` is case-sensitive (coherent via `replaceCollation`), `replaceAllInsensitive` forces the case-insensitive transform. Its reach is honest and per-engine:

| engine | mechanism | uses `insensitiveCollation`? | accent-insensitive? |
|---|---|---|---|
| **SQL Server** | `REPLACE(src collate <C>, from collate <C>, to) collate DATABASE_DEFAULT` | **yes** (else the CI database default) | yes, with a `_CI_AI` name |
| **Oracle** | `REPLACE(src collate <C>, from collate <C>, to) collate USING_NLS_COMP` | **yes** (else the configurable `replaceInsensitiveCollation`, default `BINARY_CI`) | yes, with a `_AI` name |
| **MySQL / MariaDB** | `REGEXP_REPLACE(src collate <C>, <esc from> collate <C>, to)` | **yes** (else the default collation) | yes |
| **PostgreSQL** | `regexp_replace(src, <esc from>, to, 'gi')` | **no** — `'gi'` is a fixed *case-only* flag | **no** |
| **SQLite** | `<udf>(src, from, to)`, else a plain `replace` | no (JS-defined / byte-wise) | UDF-defined |

So the insensitive collation carries over on **SQL Server, Oracle and MySQL / MariaDB** (full case + accent + language). It **does not** on **PostgreSQL** (`'gi'` is case-only) or **SQLite**. The search term is regex-escaped on the regex-driven engines, so `replaceAllInsensitive('a.c', …)` matches a literal `a.c`, not `a<any>c`.

On **Oracle** the forced collation is fully configurable: `insensitiveCollation` wins when it names one, otherwise **`replaceInsensitiveCollation`** (a property on `OracleConnection`, defaulting to `BINARY_CI`). Set either to `''` to opt out to the bare native `replace` (trusting the session collation). On **SQL Server** an unset `insensitiveCollation` leans on the database default (case-insensitive on a standard install), so no extra config is needed there.

!!! note "`REGEXP_REPLACE` version floor"

    The MySQL / MariaDB path needs MySQL 8.0+ / MariaDB 10.0.5+. PostgreSQL and Oracle have their functions on every supported version.

#### SQLite: register a UDF, or accept the case-sensitive fallback

SQLite has no case-insensitive `REPLACE` and no built-in `regexp_replace`. Set **`replaceAllInsensitiveFunction`** on `SqliteConnection` to the name of a scalar function you register, and the builder emits `<name>(src, from, to)`; leave it unset and `replaceAllInsensitive` falls back to a plain, **case-sensitive** `replace(src, from, to)` — documented, never an error.

```typescriptreact
import { SqliteConnection } from "ts-sql-query/connections/SqliteConnection";

class DBConnection extends SqliteConnection<'DBConnection'> {
    override replaceAllInsensitiveFunction = 'ci_replace'
}
```

Register `ci_replace` on the driver. The JS body is the same everywhere; only the registration call differs, and only some connectors expose one.

On **`better-sqlite3`** and **`node:sqlite`**, both expose `db.function(name, fn)`:

```typescriptreact
// `db` is the better-sqlite3 / node:sqlite Database the query runner wraps
db.function('ci_replace', (s, f, t) => {
    if (s == null || f == null || t == null) return s
    // case-insensitive replace of every occurrence of `f` in `s` with `t`
    const escaped = String(f).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return String(s).replace(new RegExp(escaped, 'gi'), String(t))
})
```

On **`sqlite-wasm-OO1`**, the OO1 wrapper exposes `db.createFunction(name, fn)` (the callback receives a leading context pointer):

```typescriptreact
db.createFunction('ci_replace', (_ctxPtr, s, f, t) => {
    if (s == null || f == null || t == null) return s
    const escaped = String(f).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return String(s).replace(new RegExp(escaped, 'gi'), String(t))
})
```

The **`sqlite3`**, **`bun:sqlite`** and **`bun:sql`** connectors have **no user-defined-function API** (only `loadExtension`), so `replaceAllInsensitiveFunction` cannot be used — leave it unset and `replaceAllInsensitive` behaves as `replace` (case-sensitive). Registering a compiled extension is out of scope: it opens a non-JS chapter the library does not enter.

## Per database

The default collation, the collation names to use with `insensitiveCollation` / `.collate()`, how to set a collation on the schema, and the session lever — one tab per engine.

=== "MariaDB"
    **Default:** case- **and accent-insensitive** (`utf8mb4_uca1400_ai_ci`). So `equals` / `contains` / `like` fold both case and accents out of the box.

    **Collation names** (for `insensitiveCollation` / `.collate()`):

    - `utf8mb4_uca1400_ai_ci` / `utf8mb4_general_ci` — case- and accent-insensitive.
    - `utf8mb4_bin` — binary / code-point, for forcing the case-sensitive direction.
    - `utf8mb4_spanish_ci` — case- and accent-insensitive with Spanish rules.
    - Run `SHOW COLLATION` to list them; names ending `_ci` are case-insensitive.

    **Set on the schema:** `CREATE TABLE t (name varchar(100) COLLATE utf8mb4_bin)`, or `CREATE DATABASE app CHARACTER SET utf8mb4 COLLATE …`.

    **Session lever — partial:** `SET collation_connection = <coll>` reaches literals / coercible values only; **a column keeps its own collation**, so it cannot retarget a column comparison — use `.collate()` or the column collation for that. Run it [on each new connection](#beyond-the-query-the-schema-and-the-session).

    !!! tip "On a case-insensitive database, set `insensitiveCollation = ''`"

        The default is already case-insensitive, so the `*Insensitive` operations don't need `lower()`. Setting `insensitiveCollation = ''` drops it for leaner, index-usable SQL.

=== "MySQL"
    **Default:** case- **and accent-insensitive** (`utf8mb4_0900_ai_ci`). So `equals` / `contains` / `like` fold both case and accents out of the box.

    **Collation names** (for `insensitiveCollation` / `.collate()`):

    - `utf8mb4_0900_ai_ci` / `utf8mb4_general_ci` — case- and accent-insensitive.
    - `utf8mb4_bin` — binary / code-point, for forcing the case-sensitive direction.
    - `utf8mb4_es_0900_ai_ci` — case- and accent-insensitive with Spanish rules.
    - Run `SHOW COLLATION` to list them; names ending `_ci` are case-insensitive.

    **Set on the schema:** `CREATE TABLE t (name varchar(100) COLLATE utf8mb4_bin)`, or `CREATE DATABASE app CHARACTER SET utf8mb4 COLLATE …`.

    **Session lever — partial:** `SET collation_connection = <coll>` reaches literals / coercible values only; **a column keeps its own collation**, so it cannot retarget a column comparison — use `.collate()` or the column collation for that. Run it [on each new connection](#beyond-the-query-the-schema-and-the-session).

    !!! tip "On a case-insensitive database, set `insensitiveCollation = ''`"

        The default is already case-insensitive, so the `*Insensitive` operations don't need `lower()`. Setting `insensitiveCollation = ''` drops it for leaner, index-usable SQL.

=== "Oracle"
    **Default:** case- and accent-**sensitive** (`BINARY`). A JavaScript-sensible default — no configuration needed unless you *want* the insensitive direction.

    **Case-insensitive collation names** (for `insensitiveCollation` / `.collate()`):

    - `binary_ai` — general, case- and accent-insensitive for Latin-alphabet languages.
    - `binary_ci` — general, case-insensitive (accent-sensitive).
    - `spanish_m_ai` — case- and accent-insensitive extended with Spanish rules.
    - Collation lists: [Oracle 11g](https://docs.oracle.com/cd/B28359_01/server.111/b28298/applocaledata.htm#i637232) / [Oracle 19](https://docs.oracle.com/en/database/oracle/oracle-database/19/nlspg/appendix-A-locale-data.html#GUID-CC85A33C-81FC-4E93-BAAB-1B3DB9036060).

    **Set on the schema:** `CREATE TABLE t (name varchar2(100) COLLATE binary_ci)` (needs `MAX_STRING_SIZE = EXTENDED`, and a database-level `DEFAULT_COLLATION`).

    **Session lever — full:** `ALTER SESSION SET NLS_COMP = LINGUISTIC; NLS_SORT = <coll>` flips `equals` / `like` / `distinct` / `order` session-wide. Run it [on each new connection](#beyond-the-query-the-schema-and-the-session).

    **`replaceAll`:** honours the session collation, so it corrupts on a case-insensitive configuration — fixed by default via [`replaceCollation`](#replacecollation-sql-server-and-oracle). See the [Oracle page](supported-databases/oracle.md#replaceall-and-collation).

===+ "PostgreSQL"
    **Default:** case- and accent-**sensitive** (deterministic). This is the JavaScript-sensible default — no configuration needed unless you *want* the insensitive direction.

    **Go insensitive:**

    - **`LIKE`** — native `ILIKE`, which the library already emits for `likeInsensitive` / `containsInsensitive` etc.
    - **Equality / `DISTINCT` / `GROUP BY`** — needs a **non-deterministic** ICU collation, which you create once and then name in `insensitiveCollation` (or `.collate()`):

        ```sql
        -- general, case- and accent-insensitive
        CREATE COLLATION insensitive (
            provider = 'icu',
            locale = 'und@colStrength=primary', -- or 'und-u-ks-level1'
            deterministic = false
        );
        -- language-specific (here: Spanish), case- and accent-insensitive
        CREATE COLLATION es_insensitive (
            provider = 'icu',
            locale = 'es@colStrength=primary', -- or 'es-u-ks-level1'
            deterministic = false
        );
        ```

        Then `override insensitiveCollation = 'insensitive'`. Run `SELECT * FROM pg_collation` to list the collations already created. More detail in [this blog post](https://postgresql.verite.pro/blog/2019/10/14/nondeterministic-collations.html).

    **Set on the schema:** `CREATE TABLE t (name text COLLATE "insensitive")`, or `CREATE DATABASE app LC_COLLATE '…' TEMPLATE template0`.

    **Session lever:** none — PostgreSQL has no session collation; use the per-column / database collation, or a per-expression `COLLATE` (`.collate()`).

    !!! note "`ORDER BY` sequence is deployment-dependent"

        Equality stays case-sensitive everywhere (deterministic collation), but the default locale's *sort sequence* differs between a musl/Alpine build (sorts like `C`, code-point) and a glibc build (dictionary order `a, A, b, B…`). Only the sequence shifts. Pin `.collate("C")` for code-point order, or the `insensitive` ORDER BY modifier for the case-insensitive direction.

=== "SQLite"
    **Default:** case- and accent-**sensitive** for `=` (`BINARY`) — but `LIKE` folds **ASCII** case regardless of the column collation (an engine quirk).

    **Built-in collations** (for `.collate()` / `insensitiveCollation`): only `BINARY` (code-point), `NOCASE` (ASCII case-insensitive) and `RTRIM`. The npm SQLite builds are **non-ICU**, so there are no language collations, and `NOCASE` / `lower()` fold **ASCII only** (`lower('CAFÉ')` is `cafÉ`).

    **Set on the schema:** `CREATE TABLE t (name text COLLATE NOCASE)`. SQLite has no database-level default collation.

    **Session lever:** `PRAGMA case_sensitive_like = ON` makes `LIKE` case-sensitive (connection-global) — the only way to reach `LIKE`'s case behaviour, since `.collate()` doesn't. `GLOB` is case-sensitive with different wildcards.

    See the [SQLite page](supported-databases/sqlite.md#case-insensitive-operations-fold-ascii-only) for the ASCII-only limitation, and [`replaceAllInsensitive` on SQLite](#sqlite-register-a-udf-or-accept-the-case-sensitive-fallback) for the UDF.

=== "SQL Server"
    **Default:** case-**insensitive**, accent-sensitive (`SQL_Latin1_General_CP1_CI_AS`). So `equals` / `contains` fold case out of the box.

    **Case-insensitive collation names** (for `insensitiveCollation` / `.collate()`):

    - `Latin1_General_CI_AI` — general, case- and accent-insensitive for Latin-alphabet languages.
    - `Latin1_General_BIN2` — binary / code-point (case- and accent-**sensitive**), for forcing the *other* direction.
    - `Modern_Spanish_CI_AI` — case- and accent-insensitive with Spanish rules.
    - Run `SELECT * FROM sys.fn_helpcollations()` to list them.

    **Set on the schema:** `CREATE TABLE t (name varchar(100) COLLATE Latin1_General_CS_AS)`, or `CREATE DATABASE app COLLATE Latin1_General_CI_AS`.

    **Session lever:** **none** — SQL Server has no session collation, exactly as it has [no session time zone](time-zones.md#per-database). Reach for `.collate()` per value, `insensitiveCollation` connection-wide, `replaceCollation` for `replaceAll`, or the column / database collation.

    **`replaceAll`:** honours the collation, so it corrupts on the case-insensitive default — fixed by default via [`replaceCollation`](#replacecollation-sql-server-and-oracle). See the [SQL Server page](supported-databases/sqlserver.md#replaceall-and-collation).

## Beyond the query: the schema and the session

The library's levers (above) act *in the query*. There are two more places to pick a collation, at different levels — kept separate here because they are conceptually different:

### In the schema — the column or database collation

If you own the schema this is the **cleanest** fix: no query changes, no per-query cost, and it never defeats an index. It is plain SQL — the [Where a collation is set](#where-a-collation-is-set-in-sql) section shows the `CREATE TABLE … COLLATE` / `CREATE DATABASE … COLLATE` DDL, and the [Per database](#per-database) tabs list the collation names for each engine. Reach for this whenever you can change the schema.

### On the connection — the session collation

Some engines carry a **session collation** that a connection sets on connect and that retargets comparisons *without touching the schema* — the collation analogue of a [session time zone](time-zones.md). Its reach is honest and per-engine:

| engine | session lever | reach |
|---|---|---|
| **Oracle** | `ALTER SESSION SET NLS_COMP = LINGUISTIC; NLS_SORT = <coll>` | **full** — flips `equals` / `like` / `distinct` / `order` session-wide |
| **MySQL / MariaDB** | `SET collation_connection = <coll>` | **partial** — literals only; a column keeps its own collation |
| **SQLite** | `PRAGMA case_sensitive_like = ON` | `LIKE` only (connection-global) |
| **SQL Server** | — | **none**, exactly as it has [no session time zone](time-zones.md#per-database) |
| **PostgreSQL** | — | **none** — use the column / database collation, or `.collate()` |

You run the statement in the **pool's connection-init hook**, so every connection gets it — the same hook where you would set the session time zone. The mechanism is driver-specific: see [oracledb → Running a statement on each new connection](query-runners/recommended/oracledb.md#running-a-statement-on-each-new-connection) for the concrete code (Oracle is where a session collation reaches fully).

!!! note "The query-level levers are the always-available ones"

    The session collation is **partial or absent on four of the six engines**, and the schema collation needs a schema you control. The query-level levers (`.collate()`, `insensitiveCollation`) work everywhere, because the `collate` rides in the emitted SQL — reaching column comparisons even where the pool variable can't (MySQL / MariaDB) or doesn't exist (SQL Server). Use the session collation where it reaches fully (Oracle), and the query levers to fill the gaps.

## You already have a database you can't re-collate

The common case: a legacy, often mis-collated schema, and a migration is not on the table. The fix is **configuration, not a migration**:

1. **Find out what your columns' collation is** — it decides everything below (`SELECT * FROM sys.fn_helpcollations()`, `SHOW COLLATION`, `pg_collation`, …).
2. **If a specific query needs a different collation**, reach for **`.collate('<name>')`** — surgical, index cost only there.
3. **If the whole connection needs the insensitive direction**, set `insensitiveCollation` (a language collation), or `''` if the schema is already CI.
4. **If `replaceAll` corrupts on your CI SQL Server / Oracle**, it is fixed by default — `replaceCollation = ''` opts out.
5. **Where the engine has a [session collation](#on-the-connection-the-session-collation)** (Oracle fully, SQLite `LIKE`, MySQL / MariaDB partially), apply it on the pool on connect.

!!! warning "A forced collation can defeat an index"

    Forcing a collation on a predicate stops the engine using the column's index (measured: SQL Server `Index Seek` → `Table Scan`; MySQL index lookup → scan, ~800× cost). This is why there is **no** connection-wide "force this collation on every operation" knob — it would defeat every index for no benefit. A surgical `.collate()` pays that cost only where you apply it; the schema / column collation avoids it entirely but may be out of your control; the pool session collation (Oracle / SQLite) is schema-free but partial. Each fits a different situation — weigh them, don't follow a ranking.
