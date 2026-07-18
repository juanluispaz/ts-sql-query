---
search:
  boost: 0.55
---
# Time zones

A JavaScript `Date` is an **instant** — a single number, milliseconds since the epoch. It is not "half past twelve"; it is a fixed point on the world's timeline that *happens to be* half past twelve if you look at it from a particular place.

Many temporal columns are not instants. `TIMESTAMP` / `DATETIME` stores a **wall clock**: the characters `2024-01-14 12:30:00`, and nothing else — it does not record whether that is half past twelve in Madrid or in Tokyo, two different instants apart. So turning that column into a `Date` needs a zone, and the column does not supply one. Somebody else does.

**None of this makes those column types wrong.** A wall clock stored as a wall clock is a perfectly good design, and it is what most schemas use. The problem appears only in one situation, which this page is about:

!!! danger "The one thing that causes the bug"

    **The application and the database resolve the wall clock in different time zones.** When they agree — and they usually do in production — nothing on this page can bite you. When they disagree, every wall-clock value silently shifts by the difference, with no error.

Where you meet it in practice is rarely production: it is **your laptop against a database in Docker or on a server**. The container runs in UTC, your machine runs in `Europe/Madrid`, and the same query gives you a different answer than it gives CI.

## The two zones

**The application's zone.** A wall clock with no zone (`'2024-01-14 12:30:00'`) is parsed in the **host process's** zone — whatever `TZ` or the operating system says where your code runs. This holds both for the drivers that hand back a `Date` themselves and for ts-sql-query when it receives a string. (This page says "JavaScript" because that is where you are, but the rule is not specific to it: any client resolving a zone-less wall clock uses its own zone.)

**The database's zone.** When a connection is opened, it is given a **session time zone** — usually inherited from the server's configuration or its operating system — and the engine uses it to interpret and render values, and to resolve any SQL that treats a column as an instant. **It is a property of the session, and on most engines you can change it.** Which is what makes this fixable without touching your schema.

Here is the whole problem, in one query:

```typescriptreact
const row = await connection.selectFrom(tRelease)
    .where(tRelease.id.equals(1))
    .select({
        value: tRelease.signedOffAt,             // a Date, built by the application
        epoch: tRelease.signedOffAt.getTime(),   // milliseconds, computed by the database
    })
    .executeSelectOne()
```

On a wall-clock column holding `2024-01-14 12:30:00`, with the database session in UTC:

```
TZ=UTC             value.getTime() = 1705235400000   epoch = 1705235400000   agree
TZ=Europe/Madrid   value.getTime() = 1705231800000   epoch = 1705235400000   DISAGREE by 1h
```

Nothing in that query is wrong and no error is raised — the `Date` is simply not the instant the database meant. **No SQL can reconcile it**: the engine cannot know the host's zone.

### Writing has the same problem, and it lasts longer

Everything above is about reading, but a `Date` you send — in an `INSERT`, an `UPDATE`, or as the value of a `WHERE` comparison — crosses the same boundary in the other direction. The same instant, written by the same code from two machines, lands as two different rows:

```
new Date('2024-01-14T12:30:00Z')       written from      stored in a wall-clock column

                                       TZ=UTC             2024-01-14 12:30:00
                                       TZ=Europe/Madrid   2024-01-14 13:30:00
```

This one deserves its own alarm for two reasons.

**It hides better.** An application that reads and writes in one zone is *self-consistent*: it stores `13:30`, reads `13:30` back, parses it in the same zone, and gets its original instant. Nothing looks wrong, and nothing is — until a second party appears with a different zone. Your laptop seeds a fixture the CI server then reads; a batch job runs in another region; a colleague reproduces a bug and gets different numbers.

**It outlives the fix.** A drifting read is recovered the moment you align the zones. A drifting *write* has already put the wrong wall clock on disk, and no configuration change repairs the rows you already have — you are left having to work out which of them were written from where.

A column of kind 3 or 4 is unaffected here too: the value goes out identifying its own instant, so where it was written from does not matter.

!!! tip "Put everything in UTC"

    The current good practice is to run **servers in UTC** and convert to a local zone only at the edges, when displaying to a user. It is what every major cloud provider gives you by default, regardless of where the region physically is, and it is why this bug so rarely reaches production.

    Your development machine is the exception: it runs in your own zone. Pin your application's zone explicitly (below) instead of relying on the host — that is what makes local, CI and production behave the same.

## The four kinds of temporal column

Which of these you are using decides whether you have anything to do at all. They differ along two axes: what the **engine** does with the value, and what reaches **your process** — and it is the second one that decides whether the mismatch can touch you.

### 1. No time-zone handling at all

The value is a wall clock, stored and returned verbatim. The engine never converts it, the session zone does not touch it, and **the meaning is entirely a convention between you and your data**. This is the most common kind, and the one the mismatch above applies to.

Verified on PostgreSQL — the session zone has no effect on a `timestamp` column:

```
session UTC      2024-01-14 12:30:00
session Madrid   2024-01-14 12:30:00
session Tokyo    2024-01-14 12:30:00
```

### 2. Pinned to a zone, delivered without it

The column stores a normalized instant (UTC, or the database's own zone) and the engine converts on the way in and out **using the session's zone** — but what it hands the client is a bare wall clock, with the zone stripped back off. The session zone is a participant your process cannot see.

`TIMESTAMP` on MySQL and MariaDB works this way, and so does Oracle's `TIMESTAMP WITH LOCAL TIME ZONE`. Because the offset is gone by the time the value reaches the driver, **this kind drifts** — the normalization bought you nothing at the boundary.

!!! warning "Which side breaks depends on where the session zone comes from"

    This is the subtlest case on the page, and it does not fail the same way twice:

    - **MySQL / MariaDB** default the session zone to the **server's** (`time_zone = SYSTEM`). The engine renders the value in the server's zone, your process parses it in its own, and the `Date` you get is wrong.
    - **Oracle**'s driver sets the session zone from **your process's** zone. The engine renders in your zone and your process parses in your zone — the two cancel out, so the `Date` is *right* — but the `getTime()` the database computes runs on the session-rendered value and comes out wrong.

    So on Oracle the value you look at first is correct and the one you trust the database for is not. Same kind, opposite symptom.

### 3. Pinned to a zone, delivered with it

Same storage behaviour as kind 2 — one normalized instant, no per-value zone — but the value reaches the client **qualified**, so it identifies its own instant and nothing has to be assumed.

PostgreSQL's `timestamptz` is the only type among the supported databases that does this. It is worth seeing the difference on the wire, because it is the whole reason kinds 2 and 3 are separate — the same session, the same instant, two columns:

```
timestamptz  ->  2024-01-14 12:30:00+00
timestamp    ->  2024-01-14 12:30:00
```

The offset is part of the protocol, not something the driver adds. **This is why `timestamptz` is immune and MySQL's `TIMESTAMP` is not**, even though both store a normalized instant.

The name still surprises people: insert `12:30+05` and the `+05` is *gone*, because the value is normalized on the way in and re-rendered through the session zone on the way out:

```
insert  2024-01-14 12:30:00+05

session UTC      2024-01-14 07:30:00+00
session Madrid   2024-01-14 08:30:00+01
session Tokyo    2024-01-14 16:30:00+09
```

All three lines are the **same instant**. Map it with `localDateTime` and it round-trips correctly with **no custom type and no configuration**.

### 4. The zone stored with each value

The column keeps the zone (or offset) each value was written with, so **rows can carry different zones at once**. Verified on Oracle — two rows, two zones, each preserved:

```
2024-01-14 12:30 +05:00
2024-01-14 12:30 -08:00
```

!!! warning "This is not the safest option — it buys a different set of problems"

    Storing the zone costs more than space. Once values from several zones coexist in one column you inherit questions the other kinds never raise: comparisons and `ORDER BY` need a normalization the engine does for you but that is easy to reason about wrongly; a `GROUP BY` per day depends on *whose* day; two values can be equal as instants yet not identical as values; and every consumer has to decide whether it wants the stored zone or its own.

    Reach for it when **the original zone is part of the fact you are recording** — an airline schedule, a user-entered appointment whose local time matters even after a zone rule changes. If you only need to know *when* something happened, kind 3 records exactly that, with none of the above.

## Which combinations actually drift

The kinds tell you what to expect: **kinds 3 and 4 are immune** — the value reaches your process identifying its own instant — while **kinds 1 and 2 drift**. The table below is the measurement behind that claim, and it carries the one exception.

Every row below was measured the same way: **the database in UTC** (which is how the official images ship), the same stored instant, and the application process moved from UTC to `Europe/Madrid`. `agree` means the `Date` you read and the `getTime()` the database computes are the same instant — which is also the right one.

| engine · type | kind | TZ=UTC | TZ=Europe/Madrid |
|---|---|---|---|
| PostgreSQL `timestamp` | 1 | agree | **drifts** — the `Date` is wrong |
| PostgreSQL `timestamptz` | 3 | agree | **agree** |
| MySQL `DATETIME` / `TIMESTAMP` | 1 / 2 | agree | **drifts** — the `Date` is wrong |
| MariaDB `DATETIME` / `TIMESTAMP` | 1 / 2 | agree | **drifts** — the `Date` is wrong |
| Oracle `TIMESTAMP` | 1 | agree | **drifts** — the `Date` is wrong |
| Oracle `TIMESTAMP WITH LOCAL TIME ZONE` | 2 | agree | **drifts** — the *SQL* is wrong |
| Oracle `TIMESTAMP WITH TIME ZONE` | 4 | agree | **agree** |
| SQL Server `datetime2` | 1 | agree | **agree** — see below |
| SQL Server `datetimeoffset` | 4 | agree | **agree** |
| SQLite (any format) | — | agree | **agree** — there is only one zone |

Two rows deserve a second look:

- **Oracle's `TIMESTAMP WITH LOCAL TIME ZONE` drifts on the other side.** It is kind 2, so the drift is expected — but it lands on the `getTime()` the database computes rather than on the `Date` you read, which makes it much harder to spot: the value you look at first is correct.
- **SQL Server's `datetime2` agrees, and it is the one exception to the kinds.** Its driver pins the interpretation to UTC, which lines up with a server in UTC. That is immunity by coincidence of configuration rather than by design — point it at a server in another zone and it drifts like every other kind 1.

## Per database

Which column types fall in which kind, and what the session zone does:

=== "MariaDB"
    | kind | types |
    |---|---|
    | 1 — no handling | `DATE`, `TIME`, `DATETIME` |
    | 2 — pinned, delivered without the zone | `TIMESTAMP` (stored as UTC, converted with the session zone) |
    | 3 — pinned, delivered with the zone | *none* |
    | 4 — zone stored per value | *none* |

    The session zone is `time_zone`, which defaults to `SYSTEM` — the server's operating-system zone:

    ```sql
    SELECT @@session.time_zone;
    SET SESSION time_zone = '+00:00';
    ```

    !!! warning "`TIMESTAMP` is not this engine's `timestamptz`"

        "Stored as UTC" reads like "safe", and it is the assumption that costs people an hour. It is kind 2, not kind 3: the conversion targets the **session's** zone and what reaches the driver is a bare wall clock, so it drifts exactly like `DATETIME`:

        ```
        TZ=Europe/Madrid   DATETIME    value.getTime() = 1705231800000   epoch = 1705235400000   drifts
        TZ=Europe/Madrid   TIMESTAMP   value.getTime() = 1705231800000   epoch = 1705235400000   drifts
        ```

        There is no kind 3 here. Align the zones as you would for `DATETIME`.

=== "MySQL"
    | kind | types |
    |---|---|
    | 1 — no handling | `DATE`, `TIME`, `DATETIME` |
    | 2 — pinned, delivered without the zone | `TIMESTAMP` (stored as UTC, converted with the session zone) |
    | 3 — pinned, delivered with the zone | *none* |
    | 4 — zone stored per value | *none* |

    The session zone is `time_zone`, which defaults to `SYSTEM` — the server's operating-system zone:

    ```sql
    SELECT @@session.time_zone;
    SET SESSION time_zone = '+00:00';
    ```

    !!! warning "`TIMESTAMP` is not this engine's `timestamptz`"

        "Stored as UTC" reads like "safe", and it is the assumption that costs people an hour. It is kind 2, not kind 3: the conversion targets the **session's** zone and what reaches the driver is a bare wall clock, so it drifts exactly like `DATETIME`:

        ```
        TZ=Europe/Madrid   DATETIME    value.getTime() = 1705231800000   epoch = 1705235400000   drifts
        TZ=Europe/Madrid   TIMESTAMP   value.getTime() = 1705231800000   epoch = 1705235400000   drifts
        ```

        There is no kind 3 here. Align the zones as you would for `DATETIME`.

=== "Oracle"
    | kind | types |
    |---|---|
    | 1 — no handling | `DATE`, `TIMESTAMP` |
    | 2 — pinned, delivered without the zone | `TIMESTAMP WITH LOCAL TIME ZONE` (normalized to the database zone, converted with the session zone) |
    | 3 — pinned, delivered with the zone | *none* |
    | 4 — zone stored per value | `TIMESTAMP WITH TIME ZONE` |

    Oracle is the only supported database offering both a pinned and a zone-storing type. The session zone:

    ```sql
    SELECT sessiontimezone FROM dual;
    ALTER SESSION SET TIME_ZONE = 'UTC';
    ```

    !!! warning "`TIMESTAMP WITH LOCAL TIME ZONE` drifts on the side you do not check"

        Being kind 2, it drifts — but not where you would look. The driver sets the session zone from **your process's** zone, so the `Date` you read comes out right and the `getTime()` the database computes comes out wrong:

        ```
        TZ=Europe/Madrid   value.getTime() = 1705235400000   epoch = 1705242600000   drifts
        ```

        `TIMESTAMP WITH TIME ZONE` (kind 4) carries its own zone and is unaffected.

===+ "PostgreSQL"
    | kind | types |
    |---|---|
    | 1 — no handling | `date`, `time`, `timestamp` (`timestamp without time zone`) |
    | 2 — pinned, delivered without the zone | *none* |
    | 3 — pinned, delivered with the zone | `timestamptz` (`timestamp with time zone`) |
    | 4 — zone stored per value | *none* — despite the name, `timestamptz` stores no zone |

    The session zone is `TimeZone`, defaulting to the server's `timezone` setting:

    ```sql
    SHOW TimeZone;
    SET TIME ZONE 'UTC';
    ```

=== "SQLite"
    SQLite has **no temporal types at all** — a date is text, a number, or an integer, and *you* choose which. In ts-sql-query that choice is `getDateTimeFormat()`; see [SQLite → Working with Date and Time](supported-databases/sqlite.md#working-with-date-and-time). The `UTC as text` strategies pin every value to UTC by convention; the `localdate as text` ones are kind 1. Either way the two zones cannot disagree — see below.

    !!! tip "SQLite cannot have the mismatch"

        There is no server and no session: SQLite runs **inside your process**, so its zone *is* your process's zone, always. `datetime('now', 'localtime')` follows your `TZ`:

        ```
        TZ=UTC             localtime = 12:37:58   utc = 12:37:58
        TZ=Europe/Madrid   localtime = 14:37:58   utc = 12:37:58
        ```

        The two zones cannot disagree, because there is only one. Pin your application's zone anyway — it is what keeps the *stored* text consistent across the machines that write it.

=== "SQL Server"
    | kind | types |
    |---|---|
    | 1 — no handling | `date`, `time`, `datetime`, `datetime2`, `smalldatetime` |
    | 2 — pinned, delivered without the zone | *none* |
    | 3 — pinned, delivered with the zone | *none* |
    | 4 — zone stored per value | `datetimeoffset` |

    !!! warning "SQL Server has no session time zone"

        There is nothing to `SET`: the engine uses the **server's operating-system zone**, and every session sees the same one.

        ```sql
        SELECT CURRENT_TIMEZONE();   -- the server's OS zone
        ```

        So the database side is fixed by how the server is deployed. Either run the server in UTC, or convert explicitly per query with `AT TIME ZONE`.

## Aligning the two zones

The rule is short: **the application process and the database must agree on their zone, and that zone should be UTC.** Matching is the important half — but matching on a zone that observes daylight saving is not enough on its own, which is the next section.

### Daylight saving is why it must be UTC, not just the same

If the zone the two sides agree on observes daylight saving, a wall-clock column (kind 1 or 2) loses information that no configuration can give back — because twice a year the mapping between wall clocks and instants stops being one-to-one.

**The hour that happens twice.** When the clocks go back, one wall clock covers two different instants:

```
2024-10-27T00:30:00Z  ->  wall clock 2024-10-27 02:30:00   (Europe/Madrid, +02)
2024-10-27T01:30:00Z  ->  wall clock 2024-10-27 02:30:00   (Europe/Madrid, +01)
```

Two distinct instants, the same characters in the column: stored identically, read back identically, **the difference gone** — with both sides perfectly aligned the whole time.

**The hour that never happens.** When the clocks go forward, some wall clocks do not exist, and JavaScript quietly moves them somewhere else:

```
TZ=Europe/Madrid
new Date('2024-03-31 02:30:00')  ->  2024-03-31T01:30:00Z  ->  reads back as 03:30 local
```

02:30 did not exist that day — the clock jumped from 02:00 to 03:00 — so the value you stored is not the value you get.

**UTC has no daylight saving**, so neither case can arise: every wall clock exists, exactly once. That is the real reason the advice is UTC rather than "any zone, as long as both sides use it" — agreeing on a DST zone still corrupts an hour of data twice a year, silently. (A fixed-offset zone such as `+01:00` — never `Europe/Madrid` — avoids it too, but there is no reason to prefer it to UTC.)

Columns of kind 3 and 4 are unaffected by this as well: they record the instant, so the ambiguity never arises.

### The application's zone

Either of these works; the environment variable is not required.

**From the environment:**

```bash
TZ=UTC node app.js
```

**From JavaScript**, useful when you do not control how the process is launched — a serverless entry point, a test runner, a bundled CLI:

```ts
process.env.TZ = 'UTC'
```

!!! warning "It has to run first"

    Node caches the zone the first time it is needed, so this must be set **before any `Date` is created**, including by an imported module. Put it at the very top of your entry point, above the other imports, or in a tiny module you import first:

    ```ts
    // timezone.ts — imported before anything else
    process.env.TZ = 'UTC'
    ```

    ts-sql-query's own test suite does exactly this, for exactly this reason.

### The database's zone

Prefer a server that already runs in UTC. Where the engine has a session zone (every one except SQL Server and SQLite), you can also set it per connection — run the statement from the **Per database** tabs above when the connection is opened, so every connection in the pool gets it. The hook is driver-specific: see [oracledb](query-runners/recommended/oracledb.md#running-a-statement-on-each-new-connection) (`sessionCallback`) and [pg](query-runners/recommended/pg.md#running-a-statement-on-each-new-connection) (`pool.on('connect', …)`) for the concrete code — the same hook where you would set a [session collation](collations.md#on-the-connection-the-session-collation).

### The database's zone in Docker

**The official images already run in UTC.** This is worth stating plainly, because it is where the confusion starts: people assume a container inherits the machine's zone, spend an afternoon on it, and the container was in UTC all along. These are the images ts-sql-query is tested against, and every one of them reports UTC out of the box:

| image | container zone |
|---|---|
| `postgres:18-alpine` | `UTC +0000` |
| `mysql:9` | `UTC +0000` |
| `mariadb:latest` | `UTC +0000` |
| `mcr.microsoft.com/mssql/server:2025-latest` | `UTC +0000` |
| `gvenzl/oracle-free:23-slim-faststart` | `UTC +0000` (and `DBTIMEZONE` / `SESSIONTIMEZONE` both `+00:00`) |

So a stock container is already aligned with an application you pinned to UTC, and **there is usually nothing to do on the database side** — the zone you have to go and fix is almost always your own machine's.

Pin it explicitly when you build on a base image you do not control, when you want the setting visible rather than inherited, or when you are chasing a difference between two machines. **One environment variable covers every engine** — it sets the container's operating-system zone, which each engine then picks up:

```bash
docker run -e TZ=UTC postgres:18
```

```yaml
services:
  db:
    image: postgres:18
    environment:
      TZ: UTC
```

That it reaches the engine, and not just the container's shell, is worth seeing — the same variable, on three engines whose zone you can ask for:

```
docker run -e TZ=Europe/Madrid …

PostgreSQL   SHOW TimeZone         ->  Europe/Madrid
MySQL        @@system_time_zone    ->  CEST          (now() 14:54 while utc_timestamp() 12:54)
SQL Server   CURRENT_TIMEZONE()    ->  (UTC+01:00) Brussels, Copenhagen, Madrid, Paris
```

!!! tip "For SQL Server this is the only lever"

    SQL Server has no session time zone, so the container's `TZ` is the only way to choose the zone it resolves values in. There is nothing to `SET` from the connection.

### Testcontainers

If your integration tests start the database themselves, the same variable goes through the environment the container is built with:

```typescriptreact
const container = await new PostgreSqlContainer('postgres:18')
    .withEnvironment({ TZ: 'UTC' })
    .start()
```

Pin the **test process** too, with `process.env.TZ` as shown above — a test run is exactly the situation where the two zones drift apart, because the container is UTC and the developer's machine is not. That combination is why a test can pass in CI and fail on a laptop, or the reverse, with nobody having changed a line.

!!! warning "A green suite is not evidence that you got this right"

    The trap is specific and worth naming, because it is easy to walk into with the best intentions:

    - **You pin your process to UTC, and the image happens to be UTC too.** Everything passes — but you have not verified that the two zones agree, you have arranged for them to *coincide*. The day one of them moves (a colleague's base image, a self-hosted server, a managed instance in a regional zone), the tests keep passing while the values quietly shift, because your suite never had a case that could tell the difference.
    - **Both zones are configured, but only one of them deliberately.** Inheriting UTC from an image default is not the same as choosing it. Pin it explicitly — `TZ: 'UTC'` next to the password you already pass — so it is a decision someone can find and change, rather than a property of a base image nobody read.
    - **Your tests never leave UTC.** If every value you assert is stored, read and compared under the same zone, right and wrong look identical. If your application will run where the zones can differ, at least one test should say what happens then.

    None of this argues against UTC everywhere — it is still the right default. It argues for making it explicit on **both** sides.

## You already have a database

Most of the time you did not design the schema, it has data in it, and a migration is not on the table. That is fine: **for the common case the fix is configuration, not a migration, and not a change of column type.**

1. **Find out which kind your temporal columns are.** This costs nothing and often ends the discussion: if they are kind 3 or kind 4, the mismatch cannot reach you.
2. **If they are kind 1, compare the two zones** — your process's and the database session's. If they already match, you are correct today; pin both anyway, so a future deployment does not silently break it.
3. **If they do not match, align them.** This is the real fix for almost every existing database: no schema change, no data change, no query change. Most projects need nothing else.
4. **Only then consider the column type.** Moving kind 1 → kind 3 removes the ambiguity for good, but it is a data migration: the existing values must be interpreted in *some* zone to be converted, which is exactly the information the column never had. Do it on new columns first, never as a reflex — and do not reach for kind 4 unless the original zone is genuinely part of what you are recording.

!!! tip "What if the stored values were written in a zone you cannot change?"

    It happens: a legacy writer stored wall clocks in a fixed zone that is neither the server's nor yours. Aligning the two zones does not help, because the *data* agrees with neither. Here the value's zone is application knowledge, so put it where application knowledge belongs — a [type adapter](column-types.md#type-adapters) on a `customLocalDateTime` column, converting in `transformValueFromDB` / `transformValueToDB`. Keep that conversion in one place; spreading it through the queries is how the original problem was made.

## `localDate` and `localTime` are not affected

A birthday, a shop's opening time, a public holiday: the wall clock **is** the fact, and attaching a zone to it would be a mistake rather than a fix. ts-sql-query keeps these stable for you — a `localDate` is anchored so its calendar date reads the same in every host zone from `-10` to `+13`, with no configuration.

!!! warning "Read them as wall clocks, not as instants"

    The value is still a `Date`, so JavaScript will happily give you an instant-flavoured answer that means nothing:

    ```typescriptreact
    row.birthday.getDate()      // 14  — correct: a local getter, reads the wall clock
    row.birthday.toISOString()  // may report the 13th — an instant-flavoured read of a value that has no instant
    row.birthday.getTime()      // likewise meaningless for a date with no time
    ```

    Use the local getters (`getFullYear` / `getMonth` / `getDate`, `getHours` / `getMinutes` / `getSeconds`) and format with a library that takes an explicit zone. This is a JavaScript trap rather than a ts-sql-query one, but it is the one people hit with `localDate`.

## What `getTime()` does and does not promise

`getTime()` mirrors `Date.prototype.getTime()`: milliseconds since the epoch, computed **by the database**, exact across the whole range a JavaScript `Date` can hold, including instants before 1970.

What it cannot do is escape any of the above. On a kind 1 column it reads the value in the **database session's** zone, so if that zone and your process's disagree, `getTime()` disagrees with the `Date` you would get by selecting the same column — by the same amount, for the same reason. There is nothing to switch on in the library: align the zones, or use a column that carries its own.
