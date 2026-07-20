# Semantic audit — round 1

Per [`SEMANTIC_AUDIT_RUNBOOK.md`](./SEMANTIC_AUDIT_RUNBOOK.md). Transient — not kept in the repo.

**Method**: 3 discovery agents (drift lens over date/time; drift lens over string/uuid;
lenses 3+4 over the whole of `src/sqlBuilders/`), every candidate probed by the coordinator
against a real engine. Engines: MySQL 9.7.1 · MariaDB 12.3.2 · PostgreSQL 18.4 ·
SQL Server 2025 CU6 · Oracle 26ai (23.26.2) · SQLite (better-sqlite3).

**Result**: **12 defects confirmed by probe**, 1 base-dialect rot confirmed by reading,
5 refutations (**one of them the coordinator's own proposal**), 1 probe artifact caught.
Baseline before and after: 65 364 mocked tests green. **No `src/` was touched** — this round
is analysis + rulings only.

**Status**: all forks ruled by the maintainer. See [Decisions](#decisions-maintainer-ruled)
first — it is the actionable part; the findings below are the evidence behind each ruling.

---

## Decisions (maintainer-ruled)

| # | Item | Ruling |
|---|---|---|
| 1 | `.length()` returns bytes on MySQL/MariaDB | **Fix** → `char_length`. "It should be like the other dialects and close to JS, so measuring in bytes is not what we are after." |
| 2 | `lower()` dropped in 2 of 4 insensitive `ORDER BY` modes | **Fix** (not a fork — a plain defect) |
| 3 | Negative `substr` index | **Fix — Option A**: faithful to JS, per dialect, resolved at build time |
| 4 | Oracle `\|\|` treats NULL as `''` | **Opt-in, default off, covering BOTH `_concat` AND the affix family** — never one without the other. As the project already does elsewhere: **ship the user the function so they create it themselves**, with **overloads per data type where Oracle allows it**, so it behaves as close as possible to the other databases' concat. The string aggregate is out of scope (probed: unaffected). The null-guard alternative is **rejected** — see the rationale below |
| 5 | `getTime()` and the session time zone | **No code change for the timezone itself** — environment-configuration chapter → docs. The **date-range** half is a separate plain bug and gets fixed. See [§ The coordinator was wrong](#the-coordinator-was-wrong-about-timezones) |
| 6 | SQLite `lower()` / SQL Server `replace()` | **`LIMITATIONS.md` + the per-database documentation page** — "they are very relevant to the user" |
| 7 | `group_concat` 1024-byte truncation | **`LIMITATIONS.md` + docs** — no library-side fix exists |
| 8 | Base `_getMonth` / `_getDay` | **Fix, and delete an override so a real dialect reaches the base.** "Some dialect has to use the base implementation, so we delete some case. The base dialect was created on top of SQLite and extended with PostgreSQL, and aims to be coherent in itself." This family is written in **PostgreSQL's** form, so the override to delete here is PostgreSQL's |
| 9 | SQL Server `len()` + the value-changing compat gate | **Fix** |
| 10 | Oracle `substrToEnd(-n)` out of range returns `''` where JS returns the whole string | **Pay the cost** (`greatest(-n, -length(x))`) — "let's pay to avoid the surprise to the developer" |
| 11 | Fixtures cannot express several of these defects | **Extend or change the seeds where needed**, "even if that involves adjusting other tests". A prerequisite, not a follow-up |
| 12 | Where the reasoning lives | **In code comments.** "Neither the entries in the bugs file nor the audit document are permanent, so the relevant elements must be documented in the code" |

### Rationale for #4 — why the null-guard is rejected

A probe showed the affix family *can* be fixed without a user function, via
`term is not null and x like (term || '%')` (verified: no rows for NULL, `[Alpha]` for `'Al'`).
**The maintainer ruled against it**, and the reasoning belongs in the code so nobody re-proposes it:

> *"I don't like the `like` solution, because it penalises the SQL queries for something extreme,
> and an Oracle developer is used to this behaviour — so it would introduce an inconsistency in how
> things work. I prefer the clean opt-in for both cases, keeping consistency that way."*

Three reasons, each independently sufficient:
1. It taxes **every** affix predicate to cover an extreme case.
2. An Oracle developer **expects** Oracle's `||` semantics; silently changing them in one place is
   its own surprise.
3. Fixing the affix family but not `concat` would leave the library **internally inconsistent** —
   two `||` consumers behaving differently.

So: **one opt-in, covering both consumers, or nothing.** Default off; when on, the library emits
the user's pre-created function in place of `||` in `_concat` **and** in the affix pattern
construction.

---

## The coordinator was wrong about timezones

Recorded prominently because the runbook's rule is *"refuting your own finding is a result"* — and
this one was the coordinator's own, argued confidently, with real probes behind it.

**The claim**: `getTime()` is session-TZ-dependent on MySQL/MariaDB/Oracle and stable on
PostgreSQL/SQL Server/SQLite; therefore emit `timestampdiff` / a pure-interval formula and make the
three "drifting" dialects match the three "correct" ones.

**The probes behind the claim were all true.** MySQL's answer really does move 2 h between session
zones; PostgreSQL's really doesn't. The claim was still wrong, because **it never probed the other
half of the round trip.**

The maintainer's correction — *"review `transformValueFromDB` and `transformValueToDB`, in case you
are missing information about it"* — pointed at `AbstractConnection.ts:1321`:

```ts
case 'localDateTime': {
    if (value instanceof Date) { result = value }
    else if (typeof value === 'string') { result = new Date(value) }
```

`new Date('2024-01-14 12:30:00')` — a wall clock with no zone — is parsed **in the host's local
zone**, and the drivers that hand back a `Date` (mysql2, pg) build it the same way. So the
marshalled side is host-TZ-relative, and the SQL side is engine-TZ-relative.

**The decisive probe** — the same column, through the library, both paths, two host zones:

```
PostgreSQL, TZ=UTC             column->Date .getTime()=1705235400000  SQL=1705235400000  AGREE
PostgreSQL, TZ=Europe/Madrid   column->Date .getTime()=1705231800000  SQL=1705235400000  DISAGREE 1h
MySQL (session=SYSTEM=UTC), TZ=UTC             Date=1705235400000  SQL=1705235400000  AGREE
MySQL (session=SYSTEM=UTC), TZ=Europe/Madrid   Date=1705231800000  SQL=1705235400000  DISAGREE 1h
```

**PostgreSQL and MySQL fail identically.** The dominant drift is not the engine's spelling at all —
it is *host zone ≠ engine zone*, it affects all six dialects equally, and **no SQL can fix it**,
because the engine cannot know the host's zone. That is the environment-configuration chapter the
maintainer named, and the "fix" would have papered over one knob while leaving the dominant one.

**What survives the correction** — a plain bug with no timezone in it:

```
unix_timestamp('1969-12-30 12:00:00')  ->  0     <- at ANY session zone; the documented range
```

That is §3a/3b below. It is fixed as a **date-range** defect, not as a timezone feature, and the
session-TZ independence comes along for free at no SQL cost:

| | today | proposed |
|---|---|---|
| Oracle | 132 chars, 2 column refs | **85 chars, 2 column refs** — *shorter* |
| MySQL | `round(unix_timestamp(ts)*1000)` | `round(timestampdiff(microsecond,'1970-01-01 00:00:00',ts)/1000)` — 1 ref, 1 function |

No opt-out is needed: there is nothing to opt out of. The lesson for the next round is in the
runbook already — *probe the interaction, not just the fix* — and it now has a second scalp.

**Lesson to fold back into the runbook**: when the finding is about a **value crossing the
library's boundary**, probing the SQL alone is half a probe. The round trip is
`transformValueToDB` → engine → `transformValueFromDB`, and a claim about "what the user sees" is
not established until all three are in the transcript.

---

## Findings

Ranked by user impact. Each carries the promise, the request, the engine transcript, the blast
radius, and why the suite can't see it.

### 1. `.length()` returns BYTES on MySQL / MariaDB — the docs name the right function, the code emits the wrong one

**Promise**: `docs/keywords/functions-oprators.md:50` maps **`CHAR_LENGTH(value)` → `.length()`**.
`docs/api/value-expressions.md:223` declares `length(): NumberValueSource` in a block mirroring the
JS `String` API. JS `'café'.length === 4`.

**Request**: `AbstractSqlBuilder.ts:2974` — `length(x)`, no MySQL/MariaDB override. `char_length`
appears **nowhere** in `src/` (only a reserved-word list at `SqlServerSqlBuilder.ts:1529`).

```
mysql   utf8mb4  LENGTH('café')=5  CHAR_LENGTH('café')=4  LENGTH('日本')=6  CHAR_LENGTH('日本')=2
mariadb utf8mb4  LENGTH('café')=5  CHAR_LENGTH('café')=4  LENGTH('日本')=6  CHAR_LENGTH('日本')=2
pg               length('café')=4                          length('日本')=2
mssql            len(N'café')=4                            len(N'日本')=2
```

**Blast radius**: MySQL + MariaDB.
**Why the suite can't see it**: **every seeded string in all six `test/db/*/domain/seed.sql` is
pure ASCII** — the only non-ASCII bytes in any seed file are em-dashes inside SQL comments.
`select.string-ops.test.ts:172` asserts `len: 12` for `'Ada Lovelace'` — 12 bytes *and* 12
characters. A value-degenerate fixture at the seed level.

**Ruling: FIX** → `_length` override on `AbstractMySqlMariaBDSqlBuilder` emitting `char_length(x)`.

### 2. MySQL / MariaDB drop case-insensitivity in 2 of 4 insensitive ORDER BY modes — and the suite's snapshot bakes it in

**Request**: `AbstractMySqlMariaBDSqlBuilder.ts:103-107` uses `_appendOrderByColumnAlias` (plain)
for the **sort term** instead of `_appendOrderByColumnAliasInsensitive`.

**Three proofs it is an omission, not a dialect necessity — all inside the repo:**

1. **Within the same `switch`**: `desc nulls last insensitive` (:101) *does* call the Insensitive
   variant. Two of four modes honour `lower()`, two don't.
2. **Same file, 80 lines down**: `_buildAggregateArrayOrderBy` (:189-193) spells the identical two
   cases correctly — plain operand for the `is null` check, Insensitive for the sort term.
3. **SQLite is the signpost**: `SqliteSqlBuilder.ts:176-179` uses the same
   `<x> is null, <x> asc` emulation and pairs it correctly.

```
utf8mb4_bin, rows: 'apple','Banana',NULL
  lib today (no lower):  Banana,apple     <- case-SENSITIVE: wrong
  correct   (lower):     apple,Banana
```

**Why the suite can't see it**: **the wrong SQL is the assertion**.
`test/db/mysql/newest/mysql2/select.order-by.variants.test.ts:113` —
`"select id as id, title as title from issue order by title is null, title asc"` — and `:345` for
the value-source form; same in mariadb. The real-DB cells miss it because MySQL's default
`utf8mb4_0900_ai_ci` is *already* case-insensitive, so `lower()` is redundant there — the "less
visible, so nobody looked" shape of the `AVG` story.

**Ruling: FIX** — at :104 and :107 swap the *second* `_appendOrderByColumnAlias` for
`_appendOrderByColumnAliasInsensitive`, leaving the `is null` operand plain. Rebakes 2 snapshots ×
mysql/mariadb cells — **and the rebake is the lock**.

### 3. `getTime()` — the date-range half (the timezone half is ruled out; see above)

Six dialects, six unrelated primitives. SQLite is the reference implementation: TZ-independent
*and* correct pre-1970 — it proves the contract is knowable, the role Oracle's `trunc` played for
`_getSeconds`.

#### 3a. Oracle is off by exactly one day pre-1970, and flips sign

`OracleSqlBuilder.ts:1042` adds a **signed** day count to an **always-positive** time-of-day.

```
LABEL                   LIB_VALUE    JS_VALUE
A 1969-12-30 12:00      -43200000   -129600000    <- +86400000 (one day)
B 1969-12-31 12:00      +43200000    -43200000    <- SIGN FLIPPED
C 2024-01-14 12:30     1.7052E+12   1.7052E+12    <- correct post-1970
```

Origin: `da302f41` *"Several date/time part bugfixes"* — an incomplete hand-rolled fix.

**The proposed replacement, probed, and *shorter* than what it replaces:**

```sql
(cast("ts" as date) - date '1970-01-01') * 86400000 + to_number(to_char("ts", 'FF3'))
```

| case | result | JS |
|---|---|---|
| `1969-12-30 12:00` | `-129600000` | ✓ |
| `1969-12-31 12:00` | `-43200000` | ✓ (sign fixed) |
| `2024-01-14 12:30` @ session `+02:00` | `1705235400000` | ✓ (doesn't move) |
| `1969-12-30 12:00:00.500` | `-129599500` | ✓ (sub-second correct while negative) |

Date subtraction yields a **signed fractional day count**, so the sign problem disappears by
construction; the sub-second term always adds forward in time, which is correct on both sides of the
epoch.

#### 3b. MySQL returns 0 pre-1970; MariaDB returns NULL

`AbstractMySqlMariaBDSqlBuilder.ts:539`. `UNIX_TIMESTAMP()`'s documented range starts at
1970-01-01; out of range returns 0, no error. **The two dialects diverge from each other** — which
no agent predicted:

```
mysql    pre1970 raw=0     lib=0      js=-129600000
mysql    3002    raw=0     lib=0      js=32566752000000   <- the upper bound clamps too
mariadb  pre1970 raw=NULL  lib=NULL   js=-129600000
```

Origin: `558e1e7b` **"Initial release", no comment** — per the runbook's origin test, an accident.

Proposed: `round(timestampdiff(microsecond, '1970-01-01 00:00:00', ts) / 1000)` — probed
TZ-independent, exact pre-1970, no clamp at either end.

**Why the suite can't see 3a/3b**: **no fixture anywhere is pre-1970.**

**Ruling: FIX**, framed as a date-range defect. The timezone independence is a free side effect,
not the goal.

### 4. Negative `substr` index — and `substr`/`substring` are the same method today

**Promise**: `CHANGELOG:862` — *"Fix `substrToEnd`, `substringToEnd`, `substr` and `substring`: now
the index is according to JavaScript definition (**the count start in 0**)"*. That fix **is** the
`+ 1` at `AbstractSqlBuilder.ts:3225-3231` (and :3232, :3337, :3344; mirrored at
`SqlServerSqlBuilder.ts:1135-1180`). It handled positive indices and never considered negative ones
— **a local fix, incomplete**, which is why this belongs to lens #3.

**Request**: `value + 1`. For a negative index the conversion is simply wrong: JS `substr(-2)` and
SQL `SUBSTR(x,-2)` **already agree**, so `+1` shifts it. **Four of six engines would be correct if
the library left them alone.**

**The structural finding**: `_substrToEnd` (:3225) and `_substringToEnd` (:3232) are **byte-for-byte
identical**. In JS those two methods differ *only* on negatives. **So the one thing that
distinguishes `substr` from `substring` in JavaScript is the one thing the library doesn't
implement** — `substringToEnd` is an alias of `substrToEnd` today.

```
JS ground truth        'abcdef'.substr(-2)='ef'   .substr(-2,1)='e'   .substr(-10)='abcdef'
                       'abcdef'.substring(-2)='abcdef'   .substring(2,0)='ab'   .substr(100)=''

engines, SUBSTR(x, -2):   sqlite 'ef' ✓   mysql 'ef' ✓   oracle 'ef' ✓   pg 'abcdef' ✗   mssql 'abcdef' ✗
engines, SUBSTR(x,-10):   sqlite 'abcdef' ✓   mysql '' ✗   oracle '' ✗   pg 'abcdef' ✓
right(x, n):              mysql right('abcdef',10)='abcdef', right('abcdef',2)='ef'   (pg, mssql identical)
```

**A third defect in the same family, found while pricing the fix**: `'abcdef'.substring(2,0)` is
legal JS → `'ab'` (JS **swaps** the arguments). The library emits `substr(x, 3, -2)`:

```
pg      ERROR: negative substring length not allowed      <- a CRASH on a legal JS call
mysql   ''
sqlite  'ab'   (correct by accident)
```

**Why the suite can't see any of it**: **zero** occurrences of a negative index in the whole tree —
`grep -rn "substrToEnd(-\|substr(-\|substring(-" test/db/ src/examples/ docs/` returns nothing
across ~4.1k files.

**Ruling: FIX — Option A.** Faithful to JS, per dialect, resolved at **build time** (the sign of a
literal is known while building, so no `case when` is needed and the SQL stays clean):

- `substringToEnd(-n)` / `substring(-n, e)`: JS clamps to 0 → substitute `s = 0` at build time.
  **Free, SQL identical to today's, correct on all six.** The `substring(2,0)` swap resolves the
  same way — **which also removes the PostgreSQL crash.**
- `substrToEnd(-n)`, each dialect in its native idiom:
  - MySQL / MariaDB / PostgreSQL / SQL Server → `right(x, n)`. Probed: *exactly* JS, including the
    out-of-range clamp.
  - SQLite → `substr(x, -n)`. Probed exact, including the clamp.
  - Oracle → `substr(x, -n)`. Correct in range; out of range returns `''` where JS returns the whole
    string. **The one edge that stays open** — closing it costs `greatest(-n, -length(x))`.
- **Value-source index**: the sign is unknown at build time. Emitting
  `case when n < 0 then n else n + 1 end` would tax every query — including the majority that never
  passes a negative — to cover an exotic case. **Document as a limitation** rather than dirty the
  common path.

### 5. Oracle's `||` treats NULL as `''` — a present string where the declared type says `undefined`

**Promise**: `tIssue.body.concat('!')` where `body IS NULL` types the result **optional**
(`string | undefined`) — the library *declares* NULL is the answer.

```
oracle  '[' || NULL || 'x' || ']'  =  [x]        (NULL || 'x') IS NULL -> NOT NULL
pg      '[' || NULL || 'x' || ']'  =  NULL
```

**The worse manifestation, and the reason this is not cosmetic** — the affix predicates build their
LIKE pattern with the same `||` (base :2808-2885):

```
rows: 'Alpha','Beta';  .startsWith(<null term>)
  oracle:  s like (NULL || '%')  ->  s like '%'  ->  [Alpha,Beta]   <- returns the WHOLE TABLE
  pg:      s like (NULL || '%')  ->  s like NULL ->  <no rows>
```

A filter that silently disables itself. This — not the `concat` string — is what makes it worth an
opt-in: it *"breaks the ability to move between dialects without surprises."*

**Scope, established by probe:**

| consumer of `||` | affected? |
|---|---|
| `_concat` | **yes** |
| affix family (`_startsWith` / `_endsWith` / `_contains` / …) | **yes** — and worse |
| **the string aggregate** (`listagg` / `string_agg` / `group_concat`) | **NO** — probed: all three skip NULLs identically → `[a,c]` |

**Not the `'' IS NULL` question** — that one is neutralised by `allowEmptyString: false` (the
default), which maps `''`↔`null` in both directions. Different mechanism; see the refutations.

**Why the suite can't see it**: `issue` row 1 has `body = NULL` (`seed.sql:28`) and **it is never
used**. Every optional-receiver string test pins `id = 2`;
`test/db/oracle/newest/oracledb/select.string-ops.test.ts:544` says so out loud — *"the leaves stay
optional because the receiver is, **even though the value is present**"*. A comment describing the
exact hole.

**Ruling: OPT-IN, covering `_concat` AND the affix family.** Connection-level flag, default off;
the user pre-creates a null-propagating function and the builder emits it in place of `||` in both
consumers. The aggregate is out of scope. See [the rationale](#rationale-for-4--why-the-null-guard-is-rejected).

### 6. SQLite's `lower()` / `upper()` fold ASCII only — the whole Insensitive family rides on them

`AbstractSqlBuilder.ts:2968-2973` — one spelling, **zero overrides, all six dialects**. SQLite's
built-ins understand ASCII only; every driver in this matrix is a non-ICU build.

```
sqlite  lower('CAFÉ')='cafÉ'   upper('café')='CAFé'   ('CAFÉ' LIKE 'café') = 0   <- no match
pg      lower('CAFÉ')='café'   upper('café')='CAFÉ'
```

It **cascades**: with `insensitiveCollation` unset (the default), the whole `*Insensitive` family
falls through to `lower(a) like lower(b)` (`AbstractSqlBuilder.ts:2795, 2827, 2847, 2873, 2883` +
`_equalsInsensitive` :2735). On SQLite `.containsInsensitive('é')` **will not match `'É'`** — a
fully-typed call silently returning fewer rows.

**Important for the docs — `insensitiveCollation = 'NOCASE'` does NOT rescue this.** SQLite's
`NOCASE` collation is *also* ASCII-only. Without ICU there is no escape via `lower()` **or** via
collation. The documentation must not imply the user can configure their way out.

**Why the suite can't see it**: `upper-lower` asserts `'Ada Lovelace' → 'ADA LOVELACE'` — ASCII, in
every cell.

**Ruling: `LIMITATIONS.md` + `docs/configuration/supported-databases/sqlite.md`.**

### 7. SQL Server: `len()` drops trailing spaces, and the `< 17_000_000` branch changes the VALUE

`SqlServerSqlBuilder.ts:1010` — `len(x)`; T-SQL's `LEN()` excludes trailing blanks. `len()` is then
reused as the *length argument* of the legacy substr branch (:1144, :1146, :1158, :1160).

```
mssql  len('Draft  ')=5   datalength('Draft  ')=7
       legacy (<17M):  substring('Draft  ', 1, len(..)-0)  ->  [Draft]      <- amputated
       modern (>=17M): substring('Draft  ', 1)             ->  [Draft  ]
```

**The same call returns different values on either side of a compatibility gate.**
`LIMITATIONS.md:20-24` states compat branches *"only switch between **valid forms of the same
emitted SQL**"* — this branch violates that stated invariant, and it is the branch every user on
SQL Server ≤2022 must pin to. The gate is documented (`sqlserver.md:47`, `CHANGELOG:164`) as a
*shorter form*, not as a value change.

Second defect, same lines: `.substrToEnd(100)` on a 5-char string → `substring(x, 101, -95)` →
`Msg 536 Invalid length parameter`, where every other dialect returns `''`.

**Why the suite can't see it**: no seeded string has a trailing space, and there is no
`sqlserver/oldest` cell — the `<17M` branch is reached only by a docs-rendering test.

**Ruling: FIX.**

### 8. `stringConcat` on MySQL / MariaDB silently truncates at 1024 bytes

```
mysql  @@group_concat_max_len = 1024
       LENGTH(GROUP_CONCAT(6 x 200 chars)) = 1024      (expected 1205)
       SHOW WARNINGS -> Warning 1260 "Row 6 was cut by GROUP_CONCAT()"
```

A **warning, never an error**. Declared type is `StringValueSource` → `string`; the user gets a
truncated string with no signal. Oracle (`ORA-01489`) and SQL Server error loudly; PG/SQLite are
unlimited. MySQL has no `STRING_AGG`, so `GROUP_CONCAT` is the only vehicle and the limit is
inherent — **there is no library-side fix.**

**But the policy already exists.** `LIMITATIONS.md` says of the bigint case: *"Reading an integer
beyond 2^53 exactly is **the driver's configuration, not the library's**"*. `group_concat_max_len`
is the same shape — session config the application owns, with the same shape of recipe as the
documented `safeIntegers` opt-in:

```js
pool.on('connection', c => c.query('SET SESSION group_concat_max_len = 1000000'))
```

**Why the suite can't see it**: the aggregate test concatenates 3 names, ~40 bytes.

**Ruling: `LIMITATIONS.md` + a note on `mysql.md` / `mariadb.md`** — it fits an existing policy
rather than creating an exception.

### 9. SQL Server's `replaceAll()` is collation-sensitive; the other five are not

```
mssql  replace('ABCabc','abc','X')                             = XX      <- replaced BOTH
       replace('ABCabc' collate Latin1_General_CS_AS,'abc','X') = ABCX
pg     replace('ABCabc','abc','X')                             = ABCX
mysql  REPLACE('ABCabc','abc','X')                             = ABCX
```

JS `'ABCabc'.replaceAll('abc','X') === 'ABCX'`. `AbstractSqlBuilder.ts:3355`, one spelling, zero
overrides. SQL Server is the sole outlier — "correctness depends on a collation".

**Why the suite can't see it**: the test replaces `'@'` — a character with no case.

**Ruling: `LIMITATIONS.md` + `docs/configuration/supported-databases/sqlserver.md`.**

### 10. Base dialect: `_getMonth` is missing the `- 1`, `_getDay` is PostgreSQL-only syntax

The zero-reach bucket of `AbstractSqlBuilder` is **exactly the date-part family** (`:3099-3128`).

```ts
_getMonth(...) { return 'extract(month from ' + ... + ')' }   // :3110 — 1-based
_getDay(...)   { return 'extract(dow from '   + ... + ')' }   // :3113 — PG-only field
```

All six dialects override `_getMonth` with `- 1` (PG :454, MySQL/MariaDB :551, Oracle :1045,
SQL Server :1063, SQLite :355). `docs/keywords/functions-oprators.md:71` — *"`.getMonth()` … Extract
month (**0-based like JavaScript**)"*.

**Lens #3 in its purest form.** `CHANGELOG:709`: *"Fix `getMonth` method returning wrong value (The
returning value must follow JS's Date definition) in **PostgreSQL, Sqlite, MariaDB, MySQL, Oracle
and SqlServer**"* — six leaves patched **by name**, the base left behind.

**And the previous round walked past it.** `CHANGELOG:99` records that same round fixing base
`_getTime` / `_getSeconds` / `_getMilliseconds` on exactly this reasoning — *"a base dialect no
dialect reaches is not dead code, it is untested code"* — while leaving `_getMonth` and `_getDay`
broken **in the same block**.

**Coupled — do not fix the `- 1` alone**: every dialect emitting `- 1` also registers
`_operationsThatNeedParenthesis._getMonth = true`. The base constructor (:34-53) registers neither
`_getMonth` nor `_getMilliseconds`. Adding `- 1` without the registration introduces a precedence
bug.

**Severity: low** (no user reaches it — `NoopDBConnection` is not in the `exports` map).
**Value: it is the template the seventh dialect gets copied from.**

**Ruling: FIX**, per the maintainer's own base-dialect rule.

### 11. SQL Server `currentTimestamp()` is quantised to ~3.33 ms

`_currentTimestamp` is not overridden on SQL Server → base emits bare `current_timestamp`, typed
**`datetime`** (1/300 s), not `datetime2`.

```
mssql  CURRENT_TIMESTAMP basetype=datetime   ms=806
       SYSDATETIME()     basetype=datetime2  ms=809
```

Note the asymmetry: `_currentDate` (:965) *is* overridden with a `>= 17_000_000` gate, so the file
already knows SQL Server's `current_*` keywords need care. Quantised, not wrong.
**Ruling: low-severity drift; no action this round.**

---

## Refutations — results, not failures

Recorded so the next round doesn't re-derive them. Per the runbook, **each reason should end up as a
comment in the code**, which is what stops the re-filing. None of these have that comment yet — the
implementer should add it.

- **The coordinator's own timezone proposal** — REFUTED by probing the marshaller. See
  [§ The coordinator was wrong](#the-coordinator-was-wrong-about-timezones). This is the round's
  most valuable refutation: the proposal was well-argued, probe-backed, and wrong.
- **The affix null-guard** — technically sound (probed: correct in both directions), **ruled out**
  on design grounds. See [the rationale](#rationale-for-4--why-the-null-guard-is-rejected).
- **Oracle `_getMilliseconds` rounding** — REFUTED. Suspected `to_char(X,'FF3')` rounds (it is the
  only ms spelling of six with no explicit truncation intent). It **truncates**: `FF3` of `.999600`
  → `999`, of `.123500` → `123`. It agrees with all five others. **The millisecond family really is
  closed.**
- **Oracle `'' IS NULL` breaking `length`/`trim`/`concat`** — REFUTED. `allowEmptyString: false` is
  the default (`AbstractConnection.ts:38`) and maps `''`↔`null` in both directions (`:1154`,
  `:1350`), *harmonising* Oracle's quirk rather than exposing it. Finding 5 is a different
  mechanism — a NULL *column* through `||`, which `allowEmptyString` never touches.
- **The string aggregate sharing Oracle's `||` problem** — REFUTED by probe. `listagg`,
  `string_agg` and `group_concat` all skip NULLs identically → `[a,c]`. Out of the opt-in's scope.
- **`_trim` / `_escapeLikeWildcard` / `_valueWhenNull` / uuid↔string** — lined up, genuinely agree.
  Notably the uuid seam: SQL Server defers conversion via the `__uuidString` flag rather than an
  eager cast, and all six routes convert correctly. Not a lens-3 local fix.
- **The `_logn` / `_random` / `_getSeconds` claim-comments** ("unlike every other backend", …) — all
  **TRUE** on vendor docs. The runbook says to grep these because they were false twice in one
  round; this round they check out. Worth recording: **the fingerprint is not self-fulfilling.**

## One probe artifact caught — the reason the evidence bar exists

The first `length` probe returned `CHAR_LENGTH('café') = 5` on MySQL and `4` on MariaDB, reading as
a MySQL-vs-MariaDB divergence. It is not: the **client connection charset** was latin1, so the
server counted bytes as characters. Pinning `--default-character-set=utf8mb4` made the two agree.
Same family as the round's `console.log('%f')` trap: **a broken probe looks exactly like a finding.**
Always pin the charset when probing string length.

Second, operational: a timed-out probe left `SET GLOBAL time_zone='+02:00'` on the MySQL container
and a stray `tz_probe` table. Both were restored (`SYSTEM`/UTC, table dropped) — but **a probe that
mutates server state must restore it in the same command**, not in a later one that may never run.

## Coverage holes this round exposes (the "missing tests" half)

Not defects — the fixtures that make the defects invisible. Each is *why* a green matrix means less
than it looks. **A fix without one of these is a fix nothing holds down.**

1. **Every seed string is pure ASCII, in all six databases.** Blocks findings 1, 6, 9 from ever
   being expressible. A fixture change (`seed.sql` × 6), not a test change.
2. **No fixture has a trailing space.** Blocks finding 7.
3. **No fixture is pre-1970.** Blocks finding 3a/3b.
4. **`issue.body = NULL` exists in the seed and is never selected.** Blocks finding 5 — the data is
   *already there*.
5. **No negative index anywhere in ~4.1k files.** Blocks finding 4.
6. **The harness pins host AND engines to UTC** (`test/lib/setupTimezone.ts`, whose own comment
   names the coincidence: *"matches the docker database engines (which run in UTC)"*). Right and
   wrong coincide by construction.
7. **CI collations are case/accent-insensitive** (MySQL `utf8mb4_0900_ai_ci`, SQL Server
   `SQL_Latin1_General_CP1_CI_AS`), so `.like()` behaves insensitively on 4 of 6 engines and the
   matrix never distinguishes `.contains` from `.containsInsensitive` anywhere.

Carried over from the previous round and still open — see `BUGS.md` § *Coverage gaps carried over*:
the microsecond gap, and `sqrt(4)`/`cbrt(8)` asserted with `toBeCloseTo` where `toBe` is available.

## What must end up in the code (not in a document)

Author's ruling #12: *"Neither the entries in the bugs file nor the audit document are permanent, so
the relevant elements must be documented in the code."* This report and the `BUGS.md` entries are
both deleted once the work lands — so anything below that a future reader must not re-litigate has
to be a **comment next to the code it explains**. Listed here because it is the part most likely to
be skipped:

| Next to | Record |
|---|---|
| `AbstractMySqlMariaBDSqlBuilder._length` | `LENGTH` is bytes on this family; `CHAR_LENGTH` is the character one — or the override gets "simplified" away |
| `AbstractMySqlMariaBDSqlBuilder._getTime` / `OracleSqlBuilder._getTime` | **the most important one.** That the new form is a *date-range* fix; that its session-TZ independence is a **side effect, not a timezone fix**; and that the dominant TZ drift is host↔engine, affects all six dialects, and cannot be fixed in SQL. Without it, `timestampdiff` reads as "the timezone fix" and a settled question re-opens |
| the affix pattern builder (Oracle path) | that the null-guard was probed correct and **ruled out**, with the reasons — it is cheap, correct-looking, and will be re-proposed |
| `AbstractSqlBuilder._substr*` | why `+ 1` is right for a non-negative index and wrong for a negative one (JS and SQL already agree there) — `CHANGELOG:862` shows the original fix fell into exactly this |
| any base method deliberately shaped like one dialect | **which dialect reaches it** — that is what stops the next reader seeing an unreachable base as dead code |
| PostgreSQL `_round`'s `::numeric` | (already present) — the precedent for all of the above |

## Work order (implementation — not done in this round)

**Step 0 — the fixtures, first.** Author's ruling #11: extend or change the seeds where needed,
*"even if that involves adjusting other tests"*. Verified: **zero non-ASCII data values across all
six `test/db/*/domain/seed.sql`** (the only non-ASCII bytes are em-dashes in comments). So items 1,
4 and 6 below have **no possible lock** until the seeds carry: a non-ASCII string, a string with a
trailing space, and a pre-1970 datetime. Do this first or those fixes ship unlocked — which is the
exact hole this round documents.

Then, cheapest and least contentious first; every item is already ruled.

1. **`length` → `char_length`** (MySQL/MariaDB). One override — **but needs the non-ASCII seed to be
   lockable at all.**
2. **`lower()` in the 2 insensitive `ORDER BY` modes** (MySQL/MariaDB). The only item that locks
   with today's fixtures: the snapshot rebake *is* the lock.
3. **`substr`, Option A** — all four methods, resolved at build time, incl. Oracle's
   `greatest(-n, -length(x))` (ruling #10). Removes the PostgreSQL `substring(2,0)` crash and
   finally separates `substrToEnd` from `substringToEnd`. Locks with a literal; no fixture needed.
4. **Date range** — `getTime()` pre-1970 / upper bound on MySQL/MariaDB/Oracle. Framed as a range
   defect; the Oracle replacement is *shorter* than what it replaces. Needs the pre-1970 seed.
5. **Base `_getMonth` / `_getDay`** — with the `_operationsThatNeedParenthesis` registration, and
   **delete PostgreSQL's overrides** so PostgreSQL reaches the base (ruling #8). That is also what
   turns an unlockable fix into a locked one.
6. **SQL Server `len()`** and the value-changing compat gate. Needs the trailing-space seed.
7. **`LIMITATIONS.md` + per-database docs**: SQLite `lower()` (including that `NOCASE` does *not*
   rescue non-ASCII), SQL Server `replace()`, `group_concat_max_len`, the value-source negative
   index, and the host↔engine timezone chapter.
8. **Oracle `||` opt-in** — default off, covering `_concat` **and** the affix family, with the
   user-created function and its per-type overloads (ruling #4).

For each: prove the lock (`git stash push -- src/`, the test **must** fail), then widen with lens 2
before propagating — **every single-dialect finding in the last two rounds turned out to be
multi-dialect.**
