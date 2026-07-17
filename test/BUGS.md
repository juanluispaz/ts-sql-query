# Test-suite-discovered bugs

Bugs the new `test/` suite has surfaced while running. Each entry is a
single, reproducible issue; once fixed in `src/`, remove the TODO[BUG]
comment in the corresponding test and delete the entry here.

Per project policy ([`CLAUDE.md`](../CLAUDE.md)), the agent does NOT
touch `src/` when finding bugs — only documents them and marks the
test so the suite stays green. Division of labor (test author vs
fixing agent) is detailed in
[`WRITING_TESTS.md` § When a test surfaces a bug in `src/`](./WRITING_TESTS.md#when-a-test-surfaces-a-bug-in-src).

## Read this file in full — this section is the one to internalise

Whether you're **documenting** a new bug or **picking up an entry to
fix**, read every section of this file (every open entry below, the
"How to write an entry" recipe, the bug-shape presets at the bottom).
None is optional. This section in particular is the one prior sessions
skipped — internalise it before any `grep` or `Read` over `src/`:

1. **Read [`CODE_SEARCH.md`](./CODE_SEARCH.md) in full** once at session
   start (the doors, the sections, the presets, the cross-cutting reading
   conventions — all of it is operational). Pay special attention to
   [§ "This tool vs. textual search"](./CODE_SEARCH.md#this-tool-vs-textual-search):
   it defines when `tests:where-is` answers the question (symbol
   declarations, overload sites, type-arg blast radius, call-chain,
   neg-types, cell caveats) and when `grep` / the compiler still win
   (literal prose, byte-anchored edits, assignability decisions).
2. **Refresh the index**: `npm run tests:index` (gitignored).
3. **Treat the entry's `Where:` / `Reproduction:` lines as starting
   points, not ground truth.** The test author wrote them from what
   they saw; the searcher gives you every declaration site, every
   implementing class, every test that exercises the API, every
   first-class reason marker that names the symbol (`// TODO[BUG]`,
   `// TODO[LIMITATION]`, `// NOT-APPLICABLE`), and the wrap shape
   across cells — in one report.

   Recent miss: an entry on `virtualColumnFromFragment` named
   `View.ts` and `Values.ts`; the symbol also lives in `Table.ts`.
   A fix that grepped only the two listed files would have left
   `Table.ts` regressed. `--declared full` lists all three.

The presets for the two main bug shapes live in
[§ "Common bug shapes"](#common-bug-shapes-for-the-fixing-agent) below
(read them, even if your bug is "obvious"); the searcher-first triage
flow for test authors lives in
[`WRITING_TESTS.md` § When a test surfaces a bug in `src/`](./WRITING_TESTS.md#when-a-test-surfaces-a-bug-in-src).

## How to write an entry (test author)

Keep it short — enough to reproduce, no deeper. The fixing agent
takes it from there. Recommended structure:

```markdown
## <One-line title naming the symptom>

**Where**: file + line, or class/method, or docs page reference.
**Reproduction**: the test that surfaces it, the SQL the lib emits
(if applicable), the runtime/type error observed.
**Current workaround in the suite**: which tests are wrapped /
marked, and with what reason line.
```

That's the contract. Do **not** spend time diagnosing the root cause,
choosing a category, or proposing a fix — the fixing agent owns all
of that. Two minutes of triage and one paragraph is the bar.

## Open Bugs

Most defects this suite surfaces are a **silently wrong value** rather than a
rejection, and are invisible to the matrix until a test reaches them — so each
entry says under *Current workaround in the suite* why the matrix can't see it.
A `none` there is not "nothing to do": it means no test would notice a
regression either.

**Every entry below was confirmed against a real engine**, and the transcript is
included so you can re-run it rather than trust it. Each carries a **Decided**
line: the fix approach is already ruled by the project author — implement that
ruling, do not re-open it. Everything else (how, where, the propagation) is
yours.

**Two standing rules for this batch**, from the author:

1. **Extend or change the seed fixtures where needed**, even when that means
   adjusting other tests. Several of these defects **cannot be locked by any
   test with today's fixtures** (see each entry) — the fixture change is a
   prerequisite, not a follow-up. A fix shipped without a failing-before test
   locks nothing.
2. **This file is not permanent** — an entry is deleted the moment its bug is
   fixed, and so is any report it came from. So anything a future reader must not
   re-litigate belongs **in a code comment**, next to the code it explains. Each
   entry names what must be recorded that way under *Record in the code*.

---

### `.length()` returns bytes on MySQL / MariaDB instead of characters

**Where**: `src/sqlBuilders/AbstractSqlBuilder.ts:2974` (`_length` → `length(x)`),
with no override on `AbstractMySqlMariaBDSqlBuilder`. `char_length` appears
nowhere in `src/` (the only textual hit is a reserved-word list at
`SqlServerSqlBuilder.ts:1529`).

**Reproduction**: MySQL/MariaDB `LENGTH()` counts **bytes**; `CHAR_LENGTH()`
counts characters. `docs/keywords/functions-oprators.md:50` already maps
**`CHAR_LENGTH(value)` → `.length()`** — the docs name the right function and the
code emits the other one. `docs/api/value-expressions.md:223` declares
`length(): NumberValueSource` in a block mirroring the JS `String` API, and JS
`'café'.length === 4`.

```
mysql   utf8mb4  LENGTH('café')=5  CHAR_LENGTH('café')=4  LENGTH('日本')=6  CHAR_LENGTH('日本')=2
mariadb utf8mb4  LENGTH('café')=5  CHAR_LENGTH('café')=4  LENGTH('日本')=6  CHAR_LENGTH('日本')=2
pg               length('café')=4                          length('日本')=2
mssql            len(N'café')=4                            len(N'日本')=2
```

Pin the client charset when re-probing (`--default-character-set=utf8mb4`): with
a latin1 connection the server counts bytes as characters and `CHAR_LENGTH`
*looks* broken on MySQL too. That is a probe artifact, not a finding.

**Current workaround in the suite**: none, and **none is possible today**. Every
seeded string in all six `test/db/*/domain/seed.sql` is pure ASCII — the only
non-ASCII bytes in any seed file are em-dashes inside SQL comments.
`test/db/mysql/newest/mysql2/select.string-ops.test.ts:172` asserts `len: 12` for
`full_name = 'Ada Lovelace'`, which is 12 bytes **and** 12 characters. The
fixture cannot separate the two, so no test would notice a regression.

**Decided**: fix — `_length` override on `AbstractMySqlMariaBDSqlBuilder` emitting
`char_length(x)`. Requires a non-ASCII seed value first (standing rule 1).

**Record in the code**: that `LENGTH` is bytes on this dialect family and
`CHAR_LENGTH` is the character-counting one — otherwise the next reader
"simplifies" the override away.

---

### MySQL / MariaDB silently drop `lower()` in 2 of the 4 insensitive ORDER BY modes

**Where**: `src/sqlBuilders/AbstractMySqlMariaBDSqlBuilder.ts:103-107`
(`_buildSelectOrderBy`). The `asc nulls last insensitive` and
`desc nulls first insensitive` cases call `_appendOrderByColumnAlias` (plain) for
the **sort term**, where they should call `_appendOrderByColumnAliasInsensitive`.
The `is null` operand correctly stays plain.

**Reproduction**: `orderBy('title', 'asc nulls last insensitive')` emits
`order by title is null, title asc` — no `lower()`. Live in the default
configuration: `insensitiveCollation` defaults to `undefined`
(`AbstractConnection.ts:39`), so the base emits `lower(...)` for every other mode.

```
mysql, column COLLATE utf8mb4_bin, rows 'apple','Banana',NULL
  order by title is null, title asc          ->  Banana,apple   <- case-SENSITIVE: the bug
  order by title is null, lower(title) asc   ->  apple,Banana   <- correct
```

Three proofs it is an omission and not a dialect necessity, all inside the repo:

1. **Same `switch`**: `desc nulls last insensitive` (:101) *does* call the
   Insensitive variant. Two of four modes honour `lower()`, two don't.
2. **Same file, 80 lines down**: `_buildAggregateArrayOrderBy` (:189-193) spells
   the identical two cases correctly.
3. **SQLite is the signpost**: `SqliteSqlBuilder.ts:176-179` uses the same
   `<x> is null, <x> asc` emulation and pairs it correctly.

**Current workaround in the suite**: none — **the wrong SQL is the assertion**.
`test/db/mysql/newest/mysql2/select.order-by.variants.test.ts:113` bakes
`` `"select id as id, title as title from issue order by title is null, title asc"` ``
and `:345` the value-source form; same in the mariadb cells. The real-DB cells
don't catch it either, because MySQL's default `utf8mb4_0900_ai_ci` is *already*
case-insensitive, so `lower()` is redundant there.

**Decided**: fix — swap the *second* `_appendOrderByColumnAlias` for
`_appendOrderByColumnAliasInsensitive` at :104 and :107. The snapshot rebake
(2 per cell × mysql/mariadb) **is** the lock; it needs no fixture change.

---

### A negative index is off by one on 4 dialects and ignored on 2; `substrToEnd` and `substringToEnd` are the same method

**Where**: `src/sqlBuilders/AbstractSqlBuilder.ts:3225` (`_substrToEnd`), `:3232`
(`_substringToEnd`), `:3337` (`_substr`), `:3344` (`_substring`); mirrored at
`src/sqlBuilders/SqlServerSqlBuilder.ts:1135-1180`.

**Reproduction**: all four add `value + 1` to convert JS's 0-based index to SQL's
1-based one. For a **negative** index that conversion is wrong, because JS and
SQL already agree: `'abcdef'.substr(-2)` and `SUBSTR('abcdef',-2)` are both
`'ef'`. **Four of six engines would be correct if the library left them alone.**
`.substrToEnd(-2)` emits `substr(x, -1)` → `'f'`.

```
JS      'abcdef'.substr(-2)='ef'  .substr(-2,1)='e'  .substr(-10)='abcdef'  .substr(100)=''
        'abcdef'.substring(-2)='abcdef'   .substring(2,0)='ab'   <- substring SWAPS its args

SUBSTR(x,-2):    sqlite 'ef' ✓  mysql 'ef' ✓  oracle 'ef' ✓  pg 'abcdef' ✗  mssql 'abcdef' ✗
SUBSTR(x,-10):   sqlite 'abcdef' ✓  mysql '' ✗  oracle '' ✗  pg 'abcdef' ✓
right(x,n):      mysql right('abcdef',10)='abcdef', right('abcdef',2)='ef'   (pg, mssql identical)
```

Two further defects in the same family:

- **`_substrToEnd` (:3225) and `_substringToEnd` (:3232) are byte-for-byte
  identical.** In JS those two methods differ *only* on negatives — so the one
  thing that distinguishes `substr` from `substring` in JavaScript is the one
  thing the library does not implement. `substringToEnd` is an alias today.
- **`substring(2, 0)` — legal JS, `'ab'` — crashes PostgreSQL.** The library
  emits `substr(x, 3, -2)`: pg → `ERROR: negative substring length not allowed`;
  mysql → `''`; sqlite → `'ab'` (correct by accident).

**Current workaround in the suite**: none. There is **zero** occurrence of a
negative index in the whole tree — `grep -rn "substrToEnd(-\|substr(-\|substring(-"
test/db/ src/examples/ docs/` returns nothing across ~4.1k files. No fixture
change is needed to lock this one; a literal in a test reaches it.

**Decided**: fix, faithful to JS, **per dialect, resolved at build time**. The
sign of a literal is known while building, so no `case when` is needed and the
SQL stays clean:

- `substringToEnd(-n)` / `substring(-n, e)`: JS clamps to 0 → substitute `s = 0`
  at build time. Free, SQL identical to today's, correct on all six. Resolve the
  `substring(2,0)` argument swap the same way — **that also removes the
  PostgreSQL crash**.
- `substrToEnd(-n)`, each dialect in its native idiom: `right(x, n)` on
  MySQL / MariaDB / PostgreSQL / SQL Server (probed: *exactly* JS, including the
  out-of-range clamp); `substr(x, -n)` on SQLite (probed exact, including the
  clamp); `substr(x, -n)` on Oracle **plus** `greatest(-n, -length(x))` — Oracle
  returns `''` out of range where JS returns the whole string, and the author
  ruled: pay the cost rather than surprise the developer.
- **Value-source index**: the sign is unknown at build time, and emitting
  `case when n < 0 then n else n + 1 end` would tax every query — including the
  majority that never passes a negative. Document as a limitation instead.

**Record in the code**: why `+ 1` is correct for a non-negative index and wrong
for a negative one (JS and SQL already agree there) — this is the trap, and
`CHANGELOG:862` shows the original 0-based fix fell into it.

---

### `getTime()` returns 0 / NULL before 1970 on MySQL / MariaDB, and is a day out with the wrong sign on Oracle

**Where**: `src/sqlBuilders/AbstractMySqlMariaBDSqlBuilder.ts:539`
(`round(unix_timestamp(x) * 1000)`) and `src/sqlBuilders/OracleSqlBuilder.ts:1042`.

**Reproduction**: `UNIX_TIMESTAMP()`'s documented argument range starts at
1970-01-01; out of range it returns 0 — **no error**. The two dialects diverge
from each other. Oracle's formula adds a **signed** day count to an
**always-positive** time-of-day, so the two disagree in sign below the epoch.

```
mysql    1969-12-30 12:00 -> raw 0     lib 0      JS -129600000
mysql    3002-01-01 00:00 -> raw 0     lib 0      JS 32566752000000     <- the upper bound clamps too
mariadb  1969-12-30 12:00 -> raw NULL  lib NULL   JS -129600000

oracle   1969-12-30 12:00 -> lib -43200000   JS -129600000    <- +86400000 (one day)
oracle   1969-12-31 12:00 -> lib +43200000   JS  -43200000    <- SIGN FLIPPED
oracle   2024-01-14 12:30 -> correct
```

SQLite is the reference implementation here — correct pre-1970 — so the contract
is knowable, not a matter of taste.

Probed replacements, both TZ-independent as a side effect:

```sql
-- MySQL / MariaDB
round(timestampdiff(microsecond, '1970-01-01 00:00:00', ts) / 1000)
-- Oracle: 85 chars against today's 132, same 2 column references
(cast("ts" as date) - date '1970-01-01') * 86400000 + to_number(to_char("ts", 'FF3'))
```

The Oracle form works because date subtraction yields a **signed fractional day
count**, so the sign problem disappears by construction, and the sub-second term
always adds forward in time. Verified: `-129600000`, `-43200000`,
`-129599500` for `…12:00:00.500`, and `1705235400000` for 2024.

**Current workaround in the suite**: none, and **none is possible today** — no
fixture anywhere is pre-1970.

**Decided**: fix, framed as a **date-range** defect.

**Record in the code — this one matters most.** The replacement also removes a
session-time-zone dependency (`unix_timestamp` / `sys_extract_utc` resolve their
argument against the session zone; the new forms don't). **That is a side effect,
not the goal, and it does not make `getTime()` timezone-safe.** The dominant
timezone drift is elsewhere and unfixable in SQL: `transformValueFromDB`
(`AbstractConnection.ts:1321`) parses a wall clock in the **host's** zone
(`new Date('2024-01-14 12:30:00')`, and the drivers that return a `Date` build it
the same way), while the SQL side resolves it in the **engine's** zone. Probed
end-to-end through the library:

```
PostgreSQL, TZ=UTC             column->Date 1705235400000   SQL 1705235400000   agree
PostgreSQL, TZ=Europe/Madrid   column->Date 1705231800000   SQL 1705235400000   DISAGREE 1h
MySQL (session=UTC), TZ=UTC             Date 1705235400000  SQL 1705235400000   agree
MySQL (session=UTC), TZ=Europe/Madrid   Date 1705231800000  SQL 1705235400000   DISAGREE 1h
```

**PostgreSQL and MySQL fail identically** — it is not a dialect problem, it
affects all six equally, the engine cannot know the host's zone, and it is
therefore a deployment-configuration matter for the documentation, not a code
fix. Without that comment next to `_getTime`, someone will read `timestampdiff`
as "the timezone fix" and re-open a settled question. (The suite hides all of it:
`test/lib/setupTimezone.ts` pins the host to UTC and its own comment notes the
engines run in UTC too — both sides pinned, so right and wrong coincide.)

---

### Oracle's `||` treats NULL as the empty string, so `concat` and every affix predicate diverge from the other five dialects

**Where**: `src/sqlBuilders/AbstractSqlBuilder.ts:3222` (`_concat` → `a || b`,
used by PostgreSQL, Oracle and SQLite) and the affix predicate family at
`:2808-2885`, which builds its LIKE pattern with the same `||`.

**Reproduction**: `tIssue.body.concat('!')` where `body IS NULL` types the result
**optional** (`string | undefined`) — the library *declares* NULL is the answer.
Oracle returns a present string instead.

```
oracle  '[' || NULL || 'x' || ']'  =  [x]       and  (NULL || 'x') IS NULL -> NOT NULL
pg      '[' || NULL || 'x' || ']'  =  NULL
```

The affix family is the worse half — a filter that silently disables itself:

```
rows 'Alpha','Beta';  .startsWith(<null term>)
  oracle:  s like (NULL || '%')  ->  s like '%'  ->  [Alpha,Beta]   <- the WHOLE TABLE
  pg:      s like (NULL || '%')  ->  s like NULL ->  <no rows>
```

**The string aggregate is NOT affected** — probed: `listagg`, `string_agg` and
`group_concat` all skip NULLs identically (`[a,c]`). Keep it out of scope.

This is **not** the `'' IS NULL` question: that one is already neutralised by
`allowEmptyString: false` (the default), which maps `''`↔`null` in both
directions (`AbstractConnection.ts:1154`, `:1350`). This is a NULL *column*
flowing through `||`, which `allowEmptyString` never touches.

**Current workaround in the suite**: none. `issue` row 1 has `body = NULL`
(`seed.sql:28`) and **it is never selected** — every optional-receiver string
test pins `id = 2`, and
`test/db/oracle/newest/oracledb/select.string-ops.test.ts:544` says so out loud:
*"the leaves stay optional because the receiver is, even though the value is
present"*. The data is already there; only the test has to reach it.

**Decided**: an **opt-in**, default off, covering **`_concat` and the affix
family together** — never one without the other. Following what the project
already does elsewhere: **ship the user the function so they create it
themselves**, and give it **overloads for the different data types where Oracle
allows it**, so it behaves as close as possible to the other databases' concat.

The author ruled explicitly **against** the cheaper alternative of a null guard
(`term is not null and x like (term || '%')`), even though it is probed correct:

> *"I don't like the `like` solution, because it penalises the SQL queries for
> something extreme, and an Oracle developer is used to this behaviour — so it
> would introduce an inconsistency in how things work. I prefer the clean opt-in
> for both cases, keeping consistency that way."*

**Record in the code**: that rejection and its reasons, next to the affix
builder. It is a cheap, correct-looking idea that will be re-proposed otherwise.

---

### SQL Server `.length()` drops trailing spaces, and the `< 17_000_000` branch changes the VALUE

**Where**: `src/sqlBuilders/SqlServerSqlBuilder.ts:1010` (`_length` → `len(x)`),
and `len()` reused as the *length argument* of the legacy substr branch at
`:1144`, `:1146`, `:1158`, `:1160`.

**Reproduction**: T-SQL's `LEN()` excludes trailing blanks (`DATALENGTH` does
not).

```
mssql  len('Draft  ')=5   datalength('Draft  ')=7
       legacy  (<17M):  substring('Draft  ', 1, len(..)-0)  ->  [Draft]     <- amputated
       modern (>=17M):  substring('Draft  ', 1)             ->  [Draft  ]
```

So `.substrToEnd(0)` on `'Draft  '` returns **different values on either side of
a compatibility gate**. `LIMITATIONS.md:20-24` states that compatibility branches
*"only switch between valid forms of the same emitted SQL"* — this branch breaks
that stated invariant, and it is the branch every user on SQL Server ≤2022 must
pin to. The gate is documented (`docs/configuration/supported-databases/sqlserver.md:47`,
`CHANGELOG:164`) as a *shorter form*, not as a value change.

Second defect on the same lines: `.substrToEnd(100)` on a 5-char string emits
`substring(x, 101, -95)` → `Msg 536 Invalid length parameter passed to the LEFT
or SUBSTRING function`, where JS and every other dialect return `''`.

**Current workaround in the suite**: none, and **none is possible today** — no
seeded string has a trailing space, and there is no `sqlserver/oldest` cell, so
the `<17M` branch is reached only by
`sqlserver/newest/documentation/doc-code.generated.test.ts:320`, which renders
docs rather than asserting values.

**Decided**: fix. Needs a trailing-space seed value (standing rule 1).

---

### The base dialect's `_getMonth` is 1-based and its `_getDay` is PostgreSQL-only syntax

**Where**: `src/sqlBuilders/AbstractSqlBuilder.ts:3110` (`_getMonth` →
`extract(month from x)`, **no `- 1`**) and `:3113` (`_getDay` →
`extract(dow from x)`, a field only PostgreSQL has).

**Reproduction**: all six dialects override `_getMonth` **with** the `- 1`
(PostgreSQL :454, MySQL/MariaDB :551, Oracle :1045, SQL Server :1063,
SQLite :355), and `docs/keywords/functions-oprators.md:71` documents *"`.getMonth()`
… Extract month (**0-based like JavaScript**)"*. The base contradicts all six and
the docs.

`CHANGELOG:709` records the original fix: *"Fix `getMonth` method returning wrong
value (The returning value must follow JS's Date definition) in **PostgreSQL,
Sqlite, MariaDB, MySQL, Oracle and SqlServer**"* — six leaves patched by name,
the base left behind. The whole zero-reach bucket of `AbstractSqlBuilder` is this
date-part family (`:3099-3128`), and `CHANGELOG:99` shows a later round fixing
base `_getTime` / `_getSeconds` / `_getMilliseconds` while leaving `_getMonth`
and `_getDay` broken in the same block.

**Coupled — do not add the `- 1` alone**: every dialect emitting `- 1` also
registers `_operationsThatNeedParenthesis._getMonth = true` in its constructor
(PostgreSQL :17, SQL Server :19, Oracle :20, MySQL/MariaDB :20, SQLite :18). The
base constructor (:34-53) registers neither `_getMonth` nor `_getMilliseconds`.
Adding the `- 1` without the registration introduces a precedence bug.

**Current workaround in the suite**: none, and none is possible **while the base
stays unreachable** — `NoopDBConnection` is the only class that would reach it
and it is exported neither in `package.json`'s `exports` map nor in
`src/index.ts`.

**Decided**: fix, and make a real dialect reach it — a base no dialect uses is
untested code and will rot again. The base dialect is built on SQLite and
extended with PostgreSQL, and is meant to be coherent in itself; this family is
written in PostgreSQL's form, so align the base with PostgreSQL's behaviour
(the `- 1`, `_appendSqlForDatePartArgument`, the `::integer` cast) and **delete
PostgreSQL's overrides** so PostgreSQL exercises the base. That also turns an
unlockable fix into a locked one.

**Record in the code**: which dialect reaches each base method, wherever the base
is deliberately shaped like one dialect — that is what stops the next reader
reading an unreachable base as dead code.

## Coverage gaps carried over (not bugs — no entry to fix)

These are **not** defects and there is nothing in `src/` to change. They are the
places where a fix that landed has **no test holding it down**, so a regression
would be silent. Kept here because the loudest lesson of the round that fixed
them was that a defect survives exactly as long as no fixture can express it.

### `sqrt(4)` and `cbrt(8)` are exact — assert them with `toBe`

`Math.sqrt(4) === 2` and `Math.cbrt(8) === 2` are both **exactly** true in
IEEE-754, yet the matrix pins them with `toBeCloseTo(2, 10)`. `toBeCloseTo` on a
value the engine can only return exactly asserts less than it could: it says
"near 2" where "is 2" is available and true.

Not urgent — `n=10` already catches every defect this suite has seen (the
tightening round proved every engine sustains it). Worth doing when someone is
in these files anyway: `select.numeric-ops.test.ts` and
`select.value-source.custom-numeric.test.ts`, all 17 cells. Check each candidate
against the engine first — `cbrt(4)` is *not* exact (`4.999999999999999` for
`cbrt(125)` on MySQL / SQLite), so only the values that round-trip exactly may
become `toBe`.

### The microsecond coverage gap

The date-part truncation defects fixed in this round are only **half covered**.
`const-localdatetime-subsecond-getters-truncate`
(`select.value-source.const-temporal-getters.test.ts`, all 17 cells) locks the
sub-second contract with `:59.999` and `:01.001` — plain millisecond instants,
which a JavaScript `Date` expresses exactly — and it does catch the two worst:
PostgreSQL reporting a 60th second, and SQLite losing the millisecond of
`:01.001`.

But **a JS `Date` has millisecond precision, so no test written through the
public API can reach the sub-millisecond cases**: PostgreSQL's
`getMilliseconds()` rounding `.9996` up to `0`, and MySQL / MariaDB's returning
`1000` for `999600 µs`. Both are fixed, neither is locked. Those instants can
only enter through a **column** holding microseconds — which is exactly how they
arise in the wild, since `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP` stores
microseconds on PostgreSQL and Oracle.

Closing it needs a fixture change, not a test-only one: `TIMESTAMP` /
`DATETIME(6)` columns seeded with sub-millisecond values. Note the column types
differ — MySQL / MariaDB `DATETIME` holds **whole seconds** and SQL Server
`DATETIME` ~3.33 ms, so the schemas would need `DATETIME(6)` / `DATETIME2(7)`
before any such fixture can hold the value.

## Common bug shapes (for the fixing agent)

Reference for the agent picking up entries above. The test author
does NOT need to classify entries against these shapes when writing
them — pattern-matching the symptom to a shape is the fixing agent's
first move, not the detector's.

**First, locate every declaration site of the symbol** —
`npm run tests:where-is -- --search <symbol> --declared full` lists ALL
declaration sites. Trust the index over the entry: the files named in
the open entry are the ones known when it was filed, and they can be
**incomplete**. (Past miss: an entry on `virtualColumnFromFragment`
named `View.ts` and `Values.ts`; the symbol also lives in `Table.ts`
and a fix that grepped only the two listed files would have left
`Table.ts` regressed.)

Then gather the context appropriate to the bug's shape:

- **SQL-emission bug** (the lib emits SQL the engine rejects, or the
  emitted SQL is wrong) — `npm run tests:where-is -- --search <symbol> --for emission-bug`
  bundles `emitted-sql full · implemented-by full (non-overriders) ·
  version-gates · bugs full · limitation · not-applicable · chain
  none`: the SQL the symbol emits across tests and docs, every
  implementing class, the compatibility-version branches that gate
  the method, sibling `// TODO[BUG]` markers and any declared
  `// TODO[LIMITATION]` / `// NOT-APPLICABLE` that names the symbol.
  `chain` is off on purpose — emission happens after the call-chain,
  so the chain never reaches the emission site; use
  `--emits-keyword <sql-fragment>` to walk back from the SQL token
  to the builder code instead.
- **Type-system bug** (overload selection, variance, assignability —
  the symbol's typing rejects or accepts something it shouldn't) —
  `npm run tests:where-is -- --search <symbol> --for type-bug` bundles
  `declared full · signature full · ref-type-arg full · neg-types
  full · bugs summary · limitation summary · not-applicable summary ·
  chain none`: every declaration + signature, every place the type is
  **used as a type argument** (the blast radius of an alias), the
  existing `@ts-expect-error` locks and sibling markers. The route
  for a type
  bug is the signature, not the call-chain — `chain` is off for the
  same reason as `emission-bug`. Before inventing a new helper or
  type alias, run `--search-pattern-summary '<shared-token>'` to
  check whether the shape already exists under a different name
  (past near-miss: nearly re-introduced `AllowsNoTableOrViewRequired`
  by hand).

Each entry above usually falls into one of these:

- **TS accepts something runtime rejects** — a method typed on a
  connection class whose dialect refuses the SQL it emits. Mock
  cells silently pass (the SQL is never executed); only the real-DB
  cell surfaces the rejection. Treat as a typing gap: the type
  should narrow. The fix is two-step: tighten the connection's typed
  surface in `src/connections/<DB>Connection.ts` (or wherever the
  method is exposed), then add a `@ts-expect-error` rule under
  `test/db/<db>/types.negative/` that locks the new narrower
  contract. Example shipped: commit `9b5ab1c` on
  `PostgreSqlConnection.onConflictDoUpdateSet`.
- **TS rejects something the docs page describes** — the docs show a
  call that doesn't typecheck on the connection that snippet is
  supposed to demonstrate. Either the docs page is stale or the lib
  types are too tight. The fix is either to widen the type or to
  update the docs page; check both before assuming one.
- **Two equivalent forms documented but only one is typed** — the
  docs describe two interchangeable forms per dialect (e.g.
  "MariaDB/MySQL use bare `.onConflictDoUpdateSet({...})`;
  PostgreSQL/SQLite use `.onConflictOn(col).doUpdateSet({...})`")
  and the lib types let you use the wrong form on a given dialect.
  The fix narrows the typed surface for the dialect that should not
  accept that form.
- **A snippet references a public symbol that no longer exists** in
  the current `exports` map of [`package.json`](../package.json) —
  the page is stale or the symbol was removed. The fix is to update
  the docs page or restore the export.

When the fix lands:

1. Patch `src/` and add the negative-type test (where applicable).
2. Remove the corresponding entry from the open list above.
3. **Walk every place that reflected the old behaviour**:
   `npm run tests:where-is -- --search <symbol> --for post-fix-sync` bundles
   `emitted-sql full · docs full · examples full · tests detail · bugs
   · chain none` — every asserted SQL across tests and docs, the doc
   pages that explain it, the legacy `src/examples/` occurrences,
   per-test references, and any remaining `// TODO[BUG]` markers that
   still mention the symbol (typically the entry you're closing here).
   Anything still naming the old behaviour needs refreshing.
4. Walk `grep -rn "TODO\[BUG\]" test/db/` and either uncomment the
   wrapped tests (if the fix re-enables the snippet) or **switch the
   marker to its final category**. If the fix establishes that the
   feature simply doesn't exist on this dialect, the right marker is
   `// NOT-APPLICABLE: <reason>; see test/db/<db>/types.negative/<file>.ts
   for the compile-time negative` — a permanent dialect boundary, not
   pending work. If the bug exposed an unsolved library gap, use
   `// TODO[LIMITATION]: see LIMITATIONS.md — <one-line>` instead.
5. Push the changelog entry under
   [`docs/CHANGELOG.md`](../docs/CHANGELOG.md) describing the
   user-visible change.
