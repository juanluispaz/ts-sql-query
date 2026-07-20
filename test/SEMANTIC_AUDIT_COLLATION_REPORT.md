# Semantic audit — collation & case-sensitivity (report, rev. 2 — coherence & tooling optic)

Analysis + proposal, per [`SEMANTIC_AUDIT_COLLATION.md`](./SEMANTIC_AUDIT_COLLATION.md) and
[`SEMANTIC_AUDIT_RUNBOOK.md`](./SEMANTIC_AUDIT_RUNBOOK.md). **No `src/` was changed.** Every engine claim
carries a real-engine transcript (the runbook's *PROBE, never reason* bar).

> **The north star: fewer dialect surprises — not forced uniformity.** The library aims for a query written
> once to behave the same on every engine, and collation is where that *silently* breaks — not because the
> library's SQL differs (it is symmetric), but because each engine's **configured default collation** differs
> and the library assumes nothing about it. **The goal is not to pretend all databases are equal** (some
> differences are irreducible), but to **warn the user, equip them with tools, and smooth things where it
> makes sense** — e.g. warn about the collation differences and offer options like **configuring the
> connection's collation on the pool** to deal with them. This report inventories **every** place in the
> string surface where a dialect switch changes behaviour (see
> [Is there anything more?](#is-there-anything-more--the-complete-collation-inventory) for the exhaustive
> sweep and the *negative* results), separates the one genuine bug from the by-design differences, and lays
> out the levers. Collation is **one family** of dialect asymmetry; others (numeric, temporal, null-handling)
> are separate audits.
>
> **The design model (corrects an earlier misframing).** Earlier revisions of this report called the plain
> ops "the sensitive family" and measured them against a **JS-faithful** yardstick. That is wrong on both
> counts. The library **forces** insensitive matching only through the `*Insensitive` operations (via
> `lower()` or `insensitiveCollation`). The **plain** ops (`equals`, `contains`, `like`, `in`, `min`/`max`,
> ORDER BY, …) are **not "case-sensitive"** — they are **collation-dependent**: they do whatever the
> column/database collation is *configured* to do, and the library deliberately forces nothing on them. That
> is intentional and **has worked well**: the plain ops honour the user's schema, and `*Insensitive`
> overrides it toward insensitivity where needed. So `.contains` == `.containsInsensitive` on a CI-configured
> column is **correct, not a bug** — both are CI because the column is CI (the plain one *follows* the
> collation, the Insensitive one would *force* CI even on a CS column). JS-faithfulness was never the promise
> for the plain ops; *"whatever your collation says"* is.
>
> **The one place this bites is `replace()` on the engines whose `REPLACE` honours collation — SQL Server and
> Oracle.** It is a *value transform* whose matching turns out to be governed by collation — **unforeseen**,
> because `replace()` was not expected to be collation-affected — so on a CI-configured column it silently
> replaces both cases and **corrupts the value**. **SQL Server corrupts by default** (its default collation is
> CI); **Oracle corrupts only when configured CI**. The other four (MySQL/MariaDB/PostgreSQL/SQLite) ignore
> collation in `REPLACE`, so they never corrupt. That is the genuine finding of this audit.
>
> **So the goals are:** (1) **fix the one real problem** — SQL Server `replace()`; and (2) **expand the
> user's control** — add a lever to force a *specific* collation (a chosen one, or a case-sensitive/binary
> one) on the plain ops and per value, **symmetric to how `insensitiveCollation` already forces insensitive**
> — **without assuming the user can fix a defective schema**. Everything except (1) is capability
> *expansion*, not a defect to repair; the cross-engine differences in the plain ops are just the different
> *configured* default collations, which is the user's domain and works as designed.
>
> **No single correct target — but recommendations are still welcome.** This is the key difference from the
> Time zones page: time zones has one right answer ("UTC everywhere"); collation does **not**. Case-sensitive,
> case-insensitive, accent-insensitive, and language-specific rules are all *valid* depending on what the
> data is for — a search box wants CI, a token/hash wants CS, a person-name dedup might want AI, a
> Spanish-language sort wants a Spanish collation. So the docs should **not force** one behaviour — but, just
> as the Time zones page *recommends* UTC while still handling the cases where UTC isn't possible, the
> Collations page **may make recommendations** (e.g. "pin the collation of your data's language") as long as
> it **keeps the door open** for the situations they don't cover: multi-language columns, data you can't
> re-collate, mixed CS/CI needs. The deliverable is a set of **possibilities** with their trade-offs (plus
> sensible recommendations), that the user chooses among per their situation.
>
> **And the choice is genuinely hard, because case-folding is *locale-dependent* — this is the trap to be
> careful with.** "Case-insensitive" is not one behaviour: German **ß**, Turkish **dotted/dotless I**, and
> CJK each fold differently, and even the *same* comparison can flip between two languages' collations (and
> between two engines' implementation of the "same" rule). A generic collation applied to the wrong language
> silently mismatches. See [Case folding is locale-dependent](#case-folding-is-locale-dependent--the-linguistic-traps-probed).

- [The behaviour — collation-dependent by design, and the one exception](#the-behaviour--collation-dependent-by-design-and-the-one-exception)
- [The engines, probed](#the-engines-probed--default-collation-of-each-container)
- [The master matrix (lens 2, six dialects lined up)](#the-master-matrix-lens-2-six-dialects-lined-up)
- [Is there anything more? — the complete collation inventory](#is-there-anything-more--the-complete-collation-inventory)
- [Case folding is locale-dependent — the linguistic traps](#case-folding-is-locale-dependent--the-linguistic-traps-probed)
- [The toolkit — what exists, what's missing](#the-toolkit--what-exists-what-is-missing)
- [`.collate()` reach per engine (probed)](#collate-reach-per-engine-probed--how-far-the-per-value-lever-goes)
- [Case-insensitive `replaceAll` — feasibility per engine](#case-insensitive-replaceall--feasibility-per-engine-probed)
- [Findings, ranked by user impact](#findings-ranked-by-user-impact)
- [Refutations (record so the next round doesn't re-derive)](#refutations-record-so-the-next-round-doesnt-re-derive)
- [The resolution hierarchy — normalize the default, else guide](#the-resolution-hierarchy--normalize-the-default-where-we-can-guide-where-we-cant)
- [Consolidated proposal](#consolidated-proposal)
- [Implementation readiness — is the solution complete?](#implementation-readiness--is-the-solution-complete-and-coherent)

## The behaviour — collation-dependent by design, and the one exception

The plain string ops (`.equals`, `.contains`, `.like`, `.in`, `.min`/`.max`, ORDER BY, GROUP BY, DISTINCT,
`.replaceAll`) emit **no collation directive** (confirmed by the lens-2 emission survey — templates in the
[master matrix](#the-master-matrix-lens-2-six-dialects-lined-up)). That is **by design**: they follow the
engine's *configured* collation (the column/database default). Those configured defaults differ per engine:

- PostgreSQL, Oracle, SQLite `=` — **case-sensitive** (byte/code-point).
- SQL Server — **case-insensitive** (accent-sensitive).
- MySQL, MariaDB — **case- and accent-insensitive**.
- SQLite `LIKE` — **ASCII-case-insensitive** (the `LIKE` operator, regardless of the column collation — an
  engine quirk, not a configured choice).

So `.contains('abc')` does something different on each engine — but that is the *configured collation*
talking, which is the user's domain, and it works as intended. `.contains` == `.containsInsensitive` on a
CI-configured column is **correct** (both are CI because the column is CI). None of this is a defect. Two
things, however, are worth the maintainer's attention:

1. **The genuine problem — SQL Server `replace()`.** A *value transform* whose match is silently governed by
   the collation, so on a CI column `'ABCabc'.replaceAll('abc','X')` returns `'XX'` and **corrupts the
   value**. Unforeseen (replace was not expected to be collation-affected) and the one real finding here.
2. **A capability gap (not a defect).** The library can *force* the **insensitive** direction
   (`*Insensitive` + `insensitiveCollation`), but has **no** symmetric way to force a **specific** collation
   — a case-sensitive/binary one, or any chosen collation — on the plain ops, and **none per value**. A user
   whose configured collation isn't what a particular query needs, and who **can't change the schema**, has
   no lever. Closing that gap is *expansion*, symmetric to the insensitive knob that already exists.

## The engines, probed — default collation of each container

Resolved live (`docker ps`; ports rotate). **The container's collation is the test matrix's collation** —
each probe was confirmed against the real `tssqlquery_w1` test DB's own column collations, which match the
server default.

| engine | container image | default collation (probed) | case | accent | `=` fold? |
|---|---|---|---|---|---|
| PostgreSQL 18.4 | `postgres:18-alpine` | `en_US.utf8` (libc, deterministic) | sensitive | sensitive | no |
| Oracle 23 | `gvenzl/oracle-free:23-slim-faststart` | `NLS_COMP=NLS_SORT=BINARY`, `AL32UTF8` | sensitive | sensitive | no |
| SQLite 3.53.1 | better-sqlite3 (non-ICU) | `BINARY` (`=`); `LIKE` **ASCII-CI** | sensitive `=`, **ASCII-insensitive `LIKE`** | sensitive | no (`=`) |
| **SQL Server 2025** | `mcr.microsoft.com/mssql/server:2025-latest` | `SQL_Latin1_General_CP1_CI_AS` | **INSENSITIVE** | sensitive | **yes** |
| **MySQL 9.7.1** | `mysql:9` | `utf8mb4_0900_ai_ci` | **INSENSITIVE** | **INSENSITIVE** | **yes** |
| **MariaDB 12.3.2** | `mariadb:latest` | `utf8mb4_uca1400_ai_ci` | **INSENSITIVE** | **INSENSITIVE** | **yes** |

**What CI / AI mean** (for the docs page): **Case-Insensitive (CI)** — `'ABC'` and `'abc'` compare *equal*.
**Accent-Insensitive (AI)** — `'café'` and `'cafe'` (and `'CAFÉ'`) compare *equal*. A collation can be any
combination; e.g. SQL Server's default is CI + **A**ccent-**S**ensitive, MySQL's is CI + AI, a *binary*
collation is CS + AS (compares raw code points).

## The master matrix (lens 2, six dialects lined up)

The cells show **what each plain op does under the engine's *default configured* collation** — `✓` =
case-sensitive, `folds` = CI (`+acc` also accent-insensitive). **`folds` is not a defect** — it is the
configured collation doing its job (the user's domain, intended behaviour). The **one genuinely wrong cell**
is `replaceAll` on SQL Server (`✗ corrupts`): a *value transform* that mangles the value, not a filter that
merely follows the collation. Every op emits bare SQL, no collation directive (`AbstractSqlBuilder`
templates; per-dialect overrides change only the pattern glue).

| operation (plain, collation-dependent) | PG | Oracle | SQLite | SQL Server | MySQL | MariaDB | emission (base) |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| `replaceAll` | ✓ | ✓ | ✓ | **✗ corrupts** | ✓ | ✓ | `replace(<src>,<from>,<to>)` `:3605` |
| `equals`/`notEquals` | ✓ | ✓ | ✓ | folds | folds+acc | folds+acc | `<x> = <v>` / `<x> <> <v>` `:2752` |
| `like`/`notLike` | ✓ | ✓ | folds ASCII | folds | folds+acc | folds+acc | `<x> like <v>`+`_likeEscape` `:2835` |
| `contains`/`startsWith`/`endsWith` | ✓ | ✓ | folds ASCII | folds | folds+acc | folds+acc | `<x> like <pattern>` `:2904` |
| `in`/`notIn` | ✓ | ✓ | ✓ | folds | folds+acc | folds+acc | `<x> in <spread>` `:2808` |
| `lessThan`/`greaterThan`/`lessOrEqual`/`greaterOrEqual`/`between` | ✓ | ✓ | ✓ | coll-order | coll-order | coll-order | `<x> < <v>` / `between` `:2796` |
| `DISTINCT`/`GROUP BY` | ✓ | ✓ | ✓ | collapses | collapses | collapses | bare col `:794`/`:945` |
| `min`/`max` | ✓ | ✓ | ✓ | arb. rep | arb. rep | arb. rep | `min/max(<x>)` `:3681` |
| default `ORDER BY` (sequence) | ✓* | ✓ | ✓ | tie-order | tie-order | tie-order | bare alias `:1164` |

`✓` here means "case-sensitive because the *configured* default is CS", not "the library forces CS". `folds`
means "the configured default is CI" — expected, and overridable only toward *insensitive* today (the
capability gap). `*` PostgreSQL sequence is deployment-dependent (see
[F5](#f5--order-by-sequence-mild-deployment-dependent)). The **only** ops that ever attach a collation are
the `*Insensitive` family + the `insensitive` ORDER BY modifier, via `insensitiveCollation`.

## Is there anything more? — the complete collation inventory

You asked whether there is more beyond the default-collation asymmetry and SQL Server `replace()`. This is
the **exhaustive** sweep of the string surface (via the code searcher), classifying every op — and, as
important, recording the **negative** results so the boundary is provable, not a hunch.

**Collation-affected — a dialect switch can change behaviour:**

1. **Matching predicates** — `equals`/`notEquals`, `like`/`notLike`, `contains`/`startsWith`/`endsWith`
   (+`not…`), `in`/`notIn`. → [F2](#f2--the-plain-matching-ops-are-collation-dependent-by-design--a-capability-gap-not-a-defect). By-design collation-dependent.
2. **Ordering predicates** — `lessThan`/`greaterThan`/`lessOrEqual`/`greaterOrEqual`, `between`/`notBetween`
   on strings. **Not previously named**; same root as ORDER BY. `x.between('a','z')` or `x.lessThan('m')`
   returns different rows under a CI/AI or linguistic collation than under a binary one. Collation-dependent.
3. **Set / aggregate** — `DISTINCT`, `GROUP BY`, `min`/`max`, `orderBy`, `count(distinct)`. → [F4](#f4--distinct--group-by--min--max-follow-the-collation-on-the-ci-engines-by-design) / [F5](#f5--order-by-sequence-mild-deployment-dependent).
4. **`replaceAll`** — value transform whose *match* is collation-governed. → [F1](#f1--replaceall-silently-corrupts-the-value-on-sql-server-the-one-genuine-problem) (the one genuine bug — SQL Server).
5. **`toLowerCase`/`toUpperCase`** — value transform whose *output* is locale/case-mapping dependent.
   **Newly surfaced.** → [F6](#f6--tolowercasetouppercase-return-a-different-value-across-dialects).

**NOT collation-affected — verified, no dialect surprise from collation (negative results):**

- **No substring-search op exists.** There is **no** `indexOf`/`position`/`locate`/`charIndex` on the string
  surface (the `position` hits in the search are unrelated error-mapper properties). So there is **no second
  `replace`-shaped collation-sensitive value op** hiding — a genuine negative worth recording.
- `substr`/`substring`/`substrToEnd`/`substringToEnd` — index-based; collation-independent (their only
  cross-dialect quirk is code-point-vs-UTF16 counting, already out of scope).
- `trim`/`trimLeft`/`trimRight` — emit `trim(x)`/`ltrim(x)`/`rtrim(x)`, **whitespace-only, no custom trim
  character**, so no collation-governed match.
- `length`, `reverse`, `concat`/append — byte/code-point ops, collation-independent.

**Schema-level, but a real dialect-switch surprise (boundary, not a query op):**

- **Unique constraints / `onConflict` upsert matching** resolve uniqueness under the *column's* collation, so
  the **same insert** can succeed on a CS engine and hit a duplicate on a CI one (`'Ada'` vs `'ADA'`). The
  library can't own the index collation — a warn-and-document item.

**Scope boundary.** Collation/case-sensitivity is **one family** of dialect asymmetry. The broader goal
("fewer surprises on a dialect switch") spans families this report does *not* cover — numeric precision/type,
temporal/time-zone, GROUP BY strictness, null handling — tracked by the other `SEMANTIC_AUDIT_*` rounds and
`LIMITATIONS.md`. **Within the collation family, the five groups above are the complete set** — the answer to
"is there anything more?" is: two items I had not explicitly named (ordering predicates, `toLowerCase`/
`toUpperCase`), and nothing else on the string surface.

## Case folding is locale-dependent — the linguistic traps (probed)

Before any tool, one caution that shapes all of them: **"case-insensitive" is not a single, universal
behaviour.** Case folding depends on the *language*, the "same" comparison can flip between two locales'
collations, and even two engines' implementations of the "same" rule disagree. The library therefore cannot
offer "the case-insensitive mode" — it can only let the user pick a collation, and the docs must warn the
pick is language-sensitive.

**Turkish dotted/dotless I** (`I` U+0049, `i` U+0069, `ı` U+0131 dotless):

```
                                 I = i     I = ı (dotless)
SQL Server  Latin1_General_CI_AS   1           0        <- English/Latin: I folds to i
SQL Server  Turkish_CI_AS          0           1        <- Turkish: I folds to ı, NOT to i  (opposite verdict!)
PostgreSQL  ICU und  (level 2)     —           f
PostgreSQL  ICU tr   (level 2)     —           t        <- same two chars, flipped by locale
```

A Latin CI collation on Turkish data (or the reverse) silently mismatches: `'I'` = `'i'` is *true* in
English and *false* in Turkish. The classic Turkish-I problem — a collation choice, not a bug.

**German ß** (U+00DF) — even the *same question* differs across engines:

```
ß = ss    SQL Server Latin1_General_CI_AS -> 1 ,  German_PhoneBook_CI_AS -> 1
          PostgreSQL ICU und / de (level 2) -> f   (ß is its own letter at this strength)
```

So "does ß equal ss under case-insensitive matching?" has no universal answer — it depends on the collation
and its strength.

**CJK / Mandarin** — no case at all, but its own hazards to name: Unicode normalization (NFC/NFD), Han
variant folding, and sort order (pinyin vs stroke vs code point) — none handled by `lower()` or a generic
collation.

**Why this shapes the proposal.** (1) It is the strongest argument *for* collation injection over the
library's `lower()` fallback — `lower()` is ASCII-only and locale-blind (it mishandles ß, ı, İ), while a
language-specific collation encodes the right rules, which is why `insensitiveCollation` already tells users
to pick "a collation specific to the language used by the user". (2) It argues for per-value `.collate()`:
one column may hold several languages, and only a per-value lever applies the right collation per query.
(3) It is why the docs must offer possibilities with recommendations, never a single prescribed behaviour —
the correct collation is a property of the data's language, which only the user knows.

## The toolkit — what exists, what is missing

The whole audit fits on one axis: **the user needs to be able to pick the collation, both directions, at
the right granularity.** Here is the lever set, current and proposed:

| lever | direction | granularity | status |
|---|---|---|---|
| `insensitiveCollation = '<name>'` | insensitive | per-connection | **exists** — injects `… collate <name>` on the `*Insensitive` ops |
| `insensitiveCollation = ''` | insensitive (nullify) | per-connection | **exists** — emits bare op, *trusts the column collation* |
| `insensitiveCollation` unset | insensitive (fallback) | per-connection | **exists** — `lower(a) … lower(b)` |
| **column / DB collation** | either | schema | user's schema — **but we must not assume the user can change it** |
| **connection collation on the pool** | either | per-connection (engine session) | **exists on the engine** (user wires it) — Oracle `NLS_*` full, SQLite pragma (`LIKE`), MySQL/MariaDB partial (not columns), SQL Server none; library could *facilitate* on connect |
| ~~`sensitiveCollation`~~ | — | per-connection | **REFUTED** — no real use case; `.collate()` + schema + pool cover it ([R5](#refutations-record-so-the-next-round-doesnt-re-derive)) |
| **`.collate('<name>')`** | **either** | **per-value** | **MISSING** — the general lever the maintainer wants (Fork A) |
| **`replaceCollation` (SQL Server + Oracle)** | code-point default (+opt-out) | per-connection | **MISSING** — fixes `replace` corruption where `REPLACE` honours collation (Fork C) |
| **`replaceAllInsensitive(...)`** | insensitive | method | **MISSING** — the insensitive twin `replaceAll` never got (Fork D) |

The current `insensitiveCollation` already models the pattern to copy: a **name** to inject a collation, an
**empty string** to nullify and trust the column, and an **unset** fallback. `replaceCollation` (Fork C)
follows the same name/`''` shape; `.collate()` (Fork A) adds the per-value escape hatch. (A *general*
`sensitiveCollation` was considered and **refuted** — see [R5](#refutations-record-so-the-next-round-doesnt-re-derive).)

### Connection / session-level configuration — the time-zone parallel

Collation belongs to the same family of concerns as **time zone**: something the *session/connection*
carries, that the application often needs to pin without owning the schema. The
[Time zones page](../docs/configuration/time-zones.md) is the model — it explains a per-connection *session
zone* the user aligns instead of migrating data, and it notes that **SQL Server has no session time zone**.
Collation has the *exact same shape*, and it is worth stating on the dedicated page because it is the
schema-free fix for a database the caller can't re-collate:

| engine | engine-native session/connection collation lever | reach (probed) | time-zone parallel |
|---|---|---|---|
| **Oracle** | `ALTER SESSION SET NLS_COMP=LINGUISTIC; NLS_SORT=<coll>` | **full** — flips `equals`/`like`/`distinct`/`order` session-wide | direct analog of `ALTER SESSION SET TIME_ZONE` |
| **MySQL / MariaDB** | `SET collation_connection = <coll>` | **partial** — literals/coercible only; **a column keeps its own collation** | like `SET SESSION time_zone`, but weaker reach |
| **SQLite** | `PRAGMA case_sensitive_like = ON` | `LIKE` only (connection-global) | a connection pragma |
| **SQL Server** | **none** | — | **exactly like "SQL Server has no session time zone"** |
| **PostgreSQL** | none — per-column/DB collation or per-expression `COLLATE` | — | (has a session *zone*, but no session *collation*) |

Probed:

```
oracle  'ABC'='abc'  before -> 0 ;  ALTER SESSION SET NLS_COMP=LINGUISTIC, NLS_SORT=BINARY_CI ;  after -> 1
        after: 'ABCDEF' LIKE '%abc%' -> 1 ,  DISTINCT('ABC','abc','aBc') -> 1  (whole session folds)
mysql   SET collation_connection = utf8mb4_bin :  literal 'ABC'='abc' -> 0 (CS)  BUT  column s='abc' -> 1 (column keeps ai_ci!)
mssql   SET COLLATION …  -> not a statement; SQL Server has no session collation (as it has no session zone)
```

**Two layers of "connection-level", both worth documenting:**

1. **The library's own levers that emit `collate` into the SQL** — `insensitiveCollation` (connection-wide,
   for the insensitive direction) and the per-value **`.collate()`** (Fork A, any collation, any op). These are
   portable across engines because the `collate` rides in the emitted SQL, reaching column comparisons even
   where the pool variable can't (MySQL/MariaDB) or doesn't exist (SQL Server).
2. **Setting the connection collation on the pool** (the maintainer's example) — the engine session lever
   from the table, run when the **pool opens each connection**, exactly as the Time zones page aligns the
   session zone on connect. This is the schema-free way to "deal with the differences" without touching the
   query or the schema. Its reach is honest and per-engine: **full on Oracle** (`NLS_COMP`/`NLS_SORT`),
   **`LIKE`-only on SQLite** (the pragma), **partial on MySQL/MariaDB** (`collation_connection` reaches
   literals but **not** column comparisons — the column keeps its own collation), and **unavailable on SQL
   Server** (no session collation). Today the user wires this themselves in the pool's connection-init hook;
   the library could **facilitate** it by offering to run the statement on connect (a natural future
   connection-level feature — worth noting, not necessarily building now).

Because layer 2 is partial or absent on three engines, the two layers are complementary: **layer 1 (the
library emitting `collate` into the SQL — `insensitiveCollation` and per-value `.collate()`) is the portable,
always-available lever** — it reaches column comparisons on every engine, including MySQL/MariaDB (where the
pool variable can't) and SQL Server (which has no pool collation at all). The pool lever is the
right tool where it reaches fully (Oracle); elsewhere it complements, and the query-level levers fill the
gap. This is the "warn + equip + facilitate where it makes sense" spread, not a single prescribed fix.

## `.collate()` reach per engine (probed) — how far the per-value lever goes

`.collate('<name>')` would emit `(<expr> collate <name>)`. Probed how far it reaches in **both** directions
(force CS *and* force CI/AI), because a general tool must serve the "useful for data" (insensitive)
direction, not only CS:

```
                 force CS (equals)        force CI/AI (equals)                 force CI on LIKE
SQL Server   Latin1_General_BIN2 ✓    Latin1_General_CI_AS / CI_AI ✓        collate CI on operand ✓
MySQL/Maria  utf8mb4_bin ✓            utf8mb4_0900_ai_ci / as_ci ✓          collate CI on operand ✓
Oracle       collate BINARY ✓         collate BINARY_CI / BINARY_AI ✓       collate on operand ✓
PostgreSQL   collate "C"/ucs_basic ✓  ⚠ needs a NON-DETERMINISTIC coll.     native ILIKE (already used)
SQLite       BINARY (default) ✓       collate NOCASE (ASCII only) ✓         ⚠ NOT via collate — pragma/GLOB
```

Transcript highlights (`1`=folded/matched):

```
mssql   'ABC' collate Latin1_General_CI_AS = 'abc'            -> 1   (force CI)
        N'cafe' collate Latin1_General_CI_AI = N'café'        -> 1   (force CI+AI)
mysql   'ABC' collate utf8mb4_0900_ai_ci = 'abc'              -> 1   (force CI)
        'cafe' collate utf8mb4_0900_as_ci = 'café'            -> 0   (as_ci = accent-SENSITIVE + CI: granular!)
oracle  'ABC' collate BINARY_CI = 'abc'                       -> 1   ; collate BINARY_AI 'cafe'='café' -> 1
pg      'ABC' = 'abc' collate <nondeterministic icu>          -> t   (built-in *-CI-x-icu are DETERMINISTIC → do NOT fold equality)
        'ABCDEF' ILIKE '%abc%'                                -> t   (native, no collation needed)
sqlite  'ABC' = 'abc' collate NOCASE                          -> 1
        ('ABCDEF' collate BINARY) LIKE '%abc%'                -> 1   (LIKE ignores operand collation!)
```

**Two honest caveats the docs page must state** (they don't block `.collate()`, they scope it):

1. **PostgreSQL — per-value CI *equality/distinct/group by* needs a non-deterministic collation object.**
   Built-in `*-CI-x-icu` collations are deterministic (byte-tiebreak on equality), so `.collate('fr-CI-x-icu')`
   changes *ordering* but not *equality* folding. To fold equality the user creates a collation once
   (`CREATE COLLATION … (deterministic = false)` — the library docs *already* show this for
   `insensitiveCollation`) and passes its name. For the LIKE direction PG has native `ILIKE` (which the
   library already emits for `_likeInsensitive` on PG).
2. **SQLite — `.collate()` governs `=`/`DISTINCT`/`ORDER BY`/`min`/`max` (via `NOCASE`/`BINARY`) but NOT
   `LIKE`.** SQLite's `LIKE` ignores operand collation; its case behaviour is the connection-global
   `PRAGMA case_sensitive_like` (or `GLOB`, which uses different wildcards). So `.collate()` cannot make
   `.contains`/`.startsWith` case-sensitive on SQLite.

Everywhere else `.collate()` is a clean, bidirectional lever. Because it is **surgical** (one expression at
a time) it sidesteps the blanket index-defeat cost that makes a connection-wide sensitive force dangerous
(next section) — the user pays the index cost only on the specific predicate they collate.

## Case-insensitive `replaceAll` — feasibility per engine (probed)

Today the library has only `replaceAll` (+ `replaceAllIfValue`) — **no insensitive twin**, unlike every
other matching op (`contains`/`containsInsensitive`, …). Adding `replaceAllInsensitive` completes the pair:
`replaceAll` = case-sensitive (coherent via Fork C on SQL Server), `replaceAllInsensitive` = the forced-CI
transform — two cleanly-distinguished operations where today there is one collation-dependent `replace()`.

CI replace splits **three ways** across the engines — probed (this corrects an earlier revision that wrongly
put Oracle in the regex/case-only camp):

```
             mechanism that yields CI replace                          accent-insens?   honors insensitiveCollation?
SQL Server   REPLACE(src collate <CI>, from collate <CI>, to)           yes (CI_AI)      yes   — collation-driven
Oracle       REPLACE(src collate <CI>, from collate <CI>, to)           yes (BINARY_AI)  yes   — collation-driven (CORRECTED)
MySQL/Maria  REGEXP_REPLACE(src, <regex-escaped from>, to)              yes (ai)         yes (collation of operands)
PostgreSQL   regexp_replace(src, <regex-escaped from>, to, 'gi')        NO (case only)   no (a flag, not a collation)
SQLite       a registered UDF where the connector allows it — else none  UDF-defined    —
```

```
mssql   REPLACE('ABCabc' collate Latin1_General_CI_AS,'abc' collate …,'X')      = XX
oracle  REPLACE('ABCabc' collate BINARY_CI,'abc' collate BINARY_CI,'X')         = XX     <- Oracle REPLACE HONORS collate
        REPLACE('caféCAFE' collate BINARY_AI,'cafe' collate BINARY_AI,'X')      = XX     <- and does accent too
        REPLACE('ABCabc','abc','X')                                             = ABCX   (bare = CS)
mysql   REPLACE('ABCabc' collate utf8mb4_0900_ai_ci,'abc' collate …,'X')        = ABCX   <- MySQL REPLACE IGNORES collate -> regexp
        REGEXP_REPLACE('ABCabc','abc','X') = XX ; REGEXP_REPLACE('a.cZZZ','a.c','X') = XZZZ  (MUST regex-escape the search)
pg      regexp_replace('ABCabc','abc','X','gi') = XX ; regexp_replace('caféCAFE','cafe','X','gi') = caféX  (case only, no accent)
sqlite  replace('ABCabc','abc' collate NOCASE,'X') = ABCX ; regexp_replace(...) -> "no such function"  (no builtin)
```

**Implications for the fork (Fork D):**

- **Three mechanisms, per dialect.** **Collation-driven** — SQL Server *and Oracle* (`REPLACE(... collate
  <CI>)`, reuse `insensitiveCollation` if set, full accent support, same result-leak → `collate
  DATABASE_DEFAULT`-style reset). **Regex-driven** — MySQL/MariaDB (regexp honours the operands' collation →
  accent via `ai`) and PostgreSQL (`regexp_replace … 'gi'` — **case only**, cannot honour a language collation
  or accents). **UDF-or-nothing** — SQLite. The library already overrides per dialect, so mixed emission is
  routine.
- **A regex-escape seam is required** for the regex-driven engines. The search term must be escaped for regex
  metacharacters (`. * + ? ( ) [ ] { } ^ $ | \`) — parallel to the existing `_escapeLikeWildcard` seam.
  Without it, `.replaceAllInsensitive('a.c', …)` over-matches (probed: `a.cZZZ` → `XZZZ`).
- **PostgreSQL is the only real *behavioural* gap** — its regex `'gi'` folds case only, so
  `replaceAllInsensitive` on PG can't be accent-insensitive or honour a language `insensitiveCollation`
  (SQL Server/Oracle/MySQL/MariaDB all can). Document that per-engine reach; don't promise uniformity.
- **SQLite — leverage the connector's UDF, don't call it a flat limitation.** `REPLACE` ignores collation and
  there is no `regexp_replace` builtin, **but three of the six connectors let you register a scalar function**
  (probed: `better-sqlite3` `db.function()`, `node:sqlite` `db.function()`, `sqlite-wasm` `db.createFunction()`
  — a registered `ci_replace` returns `XX`). `sqlite3` (no UDF API) and `bun:sqlite`/`bun:sql` (`loadExtension`
  only, no JS UDF) can't, so there it stays a limitation. This is *using what the bundled build already
  exposes* — no build replacement — so `replaceAllInsensitive` is feasible on the UDF-capable SQLite
  connectors and documented-limitation on the other two. (Custom *collations* are not exposed by any node
  driver's public API, so the built-ins `BINARY`/`NOCASE`/`RTRIM` are the only SQLite collations `.collate()`
  can name.)
- **Version floors** — `REGEXP_REPLACE` needs MySQL 8.0+, MariaDB 10.0.5+ (PostgreSQL/Oracle always). All
  within the matrix's supported ranges except old MySQL.

## Findings, ranked by user impact

### F1 — `replaceAll` silently corrupts the value on SQL Server (the one genuine problem)

**The behaviour.** `.replaceAll('abc','X')` on `'ABCabc'` returns **`XX`** on SQL Server (its CI default
collation matches both cases), vs `'ABCX'` on the other five. Unlike the plain *matching* ops (F2, where
following the collation is correct-by-design), this is a **value transform**: following the collation
**corrupts the returned value**, by default, in ordinary use — and it was unforeseen that `replace()` would
be collation-affected at all.

**The request.** `replace(<src>,<from>,<to>)` — `AbstractSqlBuilder.ts:3605`, **no per-dialect override**.

**The native, code-point-exact form** (probed on `mssql/server:2025`, default `…CP1_CI_AS`):

```sql
replace(<src> collate Latin1_General_BIN2, <from> collate Latin1_General_BIN2, <to>) collate DATABASE_DEFAULT
```
```
replace('ABCabc','abc','X')                                    = XX     <- today
replace('ABCabc' collate …_BIN2,'abc' collate …_BIN2,'X')      = ABCX   <- fixed match
… same, then collate DATABASE_DEFAULT, compared '=' 'abcx'     -> 1     <- downstream CI restored (leak reset verified)
replace(N'eéEÉ' collate …_BIN2, N'é' collate …_BIN2, N'X')     = eXEÉ   <- accents code-point exact
replace(N'日本日本' collate …_BIN2, N'日本' collate …_BIN2,'X')   = XX     <- Unicode/CJK OK
```

`Latin1_General_BIN2` is code-point comparison regardless of the culture prefix (works for
nvarchar/Unicode; the name misleads). `DATABASE_DEFAULT` on the result neutralises the collation leak so a
chained `.equals(...)` behaves as before.

**Blast radius.** `REPLACE` honours collation on **SQL Server *and* Oracle** — so both corrupt on a CI
configuration. **SQL Server corrupts by *default*** (its default collation is CI); **Oracle corrupts only if
the DB is deliberately configured CI** (`NLS_COMP=LINGUISTIC` + a CI sort — probed: bare `REPLACE` → `XX`
there). The other four (MySQL, MariaDB, PostgreSQL, SQLite) **ignore collation in `REPLACE`** (byte-wise CS
always — [R1](#refutations-record-so-the-next-round-doesnt-re-derive)), so they never corrupt. This is why
[Fork C](#fork-c--coherent-replaceall-on-sql-server-default--opt-out)'s `replaceCollation` is offered
**generally** (effective on SQL Server + Oracle, inert on the rest) rather than as a single-dialect override.

**Why the suite can't see it.** The matrix replaces `'@'` (no case) so all six agree
([`LIMITATIONS.md` § "SQL Server's `replace()`"](./LIMITATIONS.md)).

**Verdict (rev. 2).** **Fix it coherently by default, with an opt-out to native** — the maintainer's
established pattern (`excludeTrailingBlanksInLength`, `ignoreNullInConcat` both restore native behaviour).
"We can't assume the user can fix a defective model" applies squarely: a value corruption on a CI column
the caller can't re-collate is exactly what the library should absorb. This re-opens the current
`LIMITATIONS.md` "leave it alone" verdict — the tax is one pair of `collate` clauses on a value transform
(no index seek to lose), and the reset removes the "override a deliberate choice" objection downstream.
See [Fork C](#fork-c--coherent-replaceall-on-sql-server-default--opt-out).

### F2 — the plain matching ops are collation-dependent (by design) — a capability gap, not a defect

**The behaviour, and why it is not a bug.** `.equals`, `.like`, `.contains`, `.startsWith`, `.endsWith`,
`.in` (+ `not…`) **follow the configured collation** — they fold on a CI column (SQL Server, MySQL, MariaDB
defaults) and don't on a CS one (PG/Oracle/SQLite `=`). That is the intended design: the plain ops honour
the schema, `*Insensitive` forces CI over it. `.contains` == `.containsInsensitive` on a CI column is
**correct** (both CI because the column is CI), not a collapsed distinction. **The gap** is one-sided: the
library can force the *insensitive* direction but offers **no lever to force a specific collation** (a
CS/binary one, or any chosen one) on the plain ops when the configured collation isn't what a query needs
and the schema can't be changed. That is a missing capability, symmetric to the one that exists — not a
defect in what ships.

**Transcript** (`1`=folded; PG/Oracle/SQLite-`=` all `0`):

```
                       SQLServer  MySQL  MariaDB
eq  'ABC'='abc'            1        1       1        (COLLATE bin -> 0 on all: force restores CS)
contains 'ABCDEF' '%abc%'  1        1       1
accent 'cafe'='café'       0        1       1        (MySQL/MariaDB fold accents too)
in  'ABC' in ('abc')       1        1       1
```

**The cost of a blanket force — why it can't be a silent default.** Forcing a collation on a predicate
**defeats the column's index** (probed, two engines):

```
SQL Server  WHERE s = 'v100'                        -> Index Seek
            WHERE s COLLATE Latin1_General_BIN2='v100' -> Table Scan
MySQL       WHERE s = 'v100'                        -> index lookup (cost 0.35, rows 1)
            WHERE s COLLATE utf8mb4_bin = 'v100'    -> index SCAN + filter (cost 289, rows 2879)  ~800x
```

**Verdict.** **Expand control with a *per-value* lever; do not change the default** (the default — follow the
configured collation — is correct and stays). A uniform forced default would be wrong anyway: all-CS defeats
indexes everywhere and overrides the user's schema; all-CI is impossible on PostgreSQL without
non-deterministic collation objects. The user reaches the behaviour they need through:
- **`.collate('<name>')`** ([Fork A](#fork-a--per-value-collate-the-general-lever)) — the primary answer:
  surgical, force CS *or* CI/a-language-collation on the specific comparison, paying the index cost only
  there. Where the query genuinely needs a specific collation, this is it.
- **the schema/column collation** when the user *can* change it (zero index cost), or **the pool session
  collation** where the engine has one (Oracle fully).
- **Not** a connection-wide `sensitiveCollation` — see the [refutation](#refutations-record-so-the-next-round-doesnt-re-derive):
  forcing a collation on *every* plain op connection-wide defeats every index and has no use case the three
  levers above don't cover better.

### F3 — SQLite `LIKE` folds ASCII case while `=` does not (internal inconsistency)

**The behaviour.** On SQLite, `.equals`/`.in` are case-sensitive (`BINARY`) but `.like`/`.contains`/
`.startsWith`/`.endsWith` fold **ASCII** case (`'ABCDEF' LIKE '%abc%'` → 1; non-ASCII not folded). The
matching family is internally inconsistent on a single engine.

**"SQLite" here means the builds the library's connectors ship — not SQLite in general.** These behaviours
are *compile-time* properties (the ICU extension, `SQLITE_CASE_SENSITIVE_LIKE`, a bundled `regexp_replace`),
so they must be stated against the actual supported connectors, whose builds could in principle differ.
Probed across **all six** (each imports its own bundled SQLite):

| connector | SQLite version | ICU | `CASE_SENSITIVE_LIKE` compile opt | default `LIKE` | `lower('CAFÉ')` | `regexp_replace` |
|---|---|---|---|---|---|---|
| better-sqlite3 | 3.53.1 | no | no | ASCII-CI | `cafÉ` (ASCII-only) | absent |
| sqlite3 | 3.52.0 | no | no | ASCII-CI | `cafÉ` | absent |
| node:sqlite | 3.53.0 | no | no | ASCII-CI | `cafÉ` | absent |
| bun:sqlite | 3.51.0 | no | no | ASCII-CI | `cafÉ` | absent |
| bun:sql (sqlite) | 3.51.0 (Bun's build) | no | no | ASCII-CI | `cafÉ` | absent |
| sqlite-wasm-OO1 | 3.53.0 | no | no | ASCII-CI | `cafÉ` | absent |

So the finding is **uniform across the supported set** — reassuringly, not build-specific — but note the
**versions already differ (3.51–3.53)**, and a *custom/system* SQLite compiled with ICU (Unicode `lower()`
and ICU collations) or `SQLITE_CASE_SENSITIVE_LIKE` (a case-sensitive `LIKE` default) would behave
differently. The docs should scope the SQLite guidance to "the SQLite these connectors bundle", exactly as
[`LIMITATIONS.md`](./LIMITATIONS.md) already frames the `lower()` limitation ("Every SQLite driver in this
matrix is a non-ICU build, which is also what a user gets from the stock npm packages").

**Can any SQLite connector use more complex collations than `BINARY`/`NOCASE`/`RTRIM`?** (a fair question —
probed each connector's API.) Within what a build *itself* ships: **no** — all six expose only the three
built-ins, none is ICU. Beyond the built-ins there are two routes, and their availability is uneven:

- **Register a custom collation** (a JS comparator attached as a `COLLATE` name — e.g. a real Unicode/locale
  comparison): **only `sqlite-wasm` can**, via the exposed C-API (`sqlite3.capi.sqlite3_create_collation_v2`),
  and even there the convenient OO1 `DB` wrapper surfaces only `createFunction`, not a collation helper — so
  it is low-level. **`better-sqlite3`, `node:sqlite`, `sqlite3`, `bun:sqlite` expose *no* collation-registration
  API at all** (verified by walking each driver's methods).
- **`loadExtension`** — available on the native drivers — could load a compiled ICU/collation extension, but
  **this is explicitly out of scope**: an extension is a compiled binary, a non-JS chapter the library
  doesn't enter (the maintainer's call). Named only for completeness, not proposed.

So, staying inside the JS world: complex collations are *possible* only on `sqlite-wasm` (register one via the
C-API), and there is **no built-in and no high-level driver API** for them on the other connectors — which is
why the SQLite guidance stays scoped to `BINARY`/`NOCASE`/`RTRIM` for `.collate()`. (And none of them fixes
`LIKE`, which ignores collation regardless.)

**The `LIKE` levers.** `PRAGMA case_sensitive_like = ON` (probed → makes `LIKE` case-sensitive) or `GLOB`
(case-sensitive, different wildcards). Both are connection-global / operator-level — **not** reachable via
operand `.collate()` (F3 caveat above). The pragma is a connection setup concern the library doesn't own
(same stance as `safeIntegers`).

**Verdict.** **Document it on the dedicated page and the SQLite page**, and state clearly that `.collate()`
does **not** rescue SQLite `LIKE` (only the pragma does). Parallels the accepted SQLite `lower()`/`NOCASE`
ASCII-only limitation. Keeping this boundary crisp is itself part of "coherent, well-documented tools."

### F4 — DISTINCT / GROUP BY / MIN / MAX follow the collation on the CI engines (by design)

**The behaviour.** `('ABC'),('abc'),('aBc')` collapse to **one** row under `DISTINCT`/`GROUP BY` on SQL
Server / MySQL / MariaDB; `min`/`max` return an arbitrary representative (all three compare equal). PG /
Oracle / SQLite keep all three. Like F2, this is the *configured* collation working — correct by design,
just occasionally not what a query wants, with no override lever today.

**Verdict.** Same shape as F2 — **a per-value lever, not a default change.** `.collate()` on the projected/
grouped/ordered column gives the wanted behaviour surgically (`SELECT DISTINCT s COLLATE bin` kept all three
in the probe), paying the index cost only there. Document prominently — a dedup that silently merges
`'Ada'`/`'ADA'` is a real data surprise.

### F5 — ORDER BY sequence (mild, deployment-dependent)

Softest item. CI engines order case-variants adjacently (fold in the tie-break). PostgreSQL's sequence is
**deployment-dependent**: this Alpine/musl container sorts `en_US.utf8` like `C` (code-point), but a
**glibc** PostgreSQL sorts it in dictionary order (`a,A,b,B…`). **Equality stays case-sensitive on glibc
too** (deterministic collation), so F2/F4 never appear on PostgreSQL — only the sort sequence shifts.
**Verdict:** a one-line deployment note on the collations page; the `insensitive` ORDER BY modifier already
covers the CI direction, and `.collate("C")` covers code-point order.

### F6 — `toLowerCase`/`toUpperCase` return a different value across dialects (newly surfaced)

**The behaviour.** `.toLowerCase()`/`.toUpperCase()` emit `lower(x)`/`upper(x)` (`AbstractSqlBuilder.ts:3064`)
— case mapping, which is **locale- and engine-dependent**, so the *returned value* differs across dialects
for non-ASCII input. Probed on `upper('ß')` (U+00DF) and `lower('İ')` (U+0130 dotted capital I):

```
              upper('ß')                    lower('İ')
PostgreSQL    ẞ  (U+1E9E capital eszett)     i
SQL Server    ß  (unchanged)                 i
MySQL         ß  (unchanged)                 i
SQLite        ß  (ASCII-only, unchanged)     İ  (ASCII-only, unchanged)
```

So the *same* `.toUpperCase()` yields `ẞ` on PostgreSQL and `ß` on the other three; the *same*
`.toLowerCase()` yields `İ` on SQLite and `i` elsewhere. And under a Turkish collation `lower('I')` becomes
`ı` (dotless). Same **shape** as F1 (a value transform diverging by dialect), but it is a *different value*,
not a corrupted match — so lower severity.

**Why the suite can't see it.** Case-folding tests use ASCII data (`'Ada Lovelace'` → `'ADA LOVELACE'`),
where all six agree; the SQLite `lower()` ASCII-only gap is already an accepted `LIMITATIONS.md` entry.

**Verdict.** Primarily a **documentation** item on the collations page (case mapping is locale-dependent;
SQLite folds ASCII only). Where the engine supports it, `.collate()` on the operand can pin the mapping
locale (a Turkish collation for Turkish data). **Not a default change** — there is no universally-correct
case mapping (the [linguistic traps](#case-folding-is-locale-dependent--the-linguistic-traps-probed) are
exactly why), so forcing one would trade one surprise for another.

## Refutations (record so the next round doesn't re-derive)

- **R1 — `REPLACE` splits into "honours collation" vs "ignores it".** **Honours: SQL Server *and* Oracle** —
  both fold on a CI configuration (`REPLACE(x collate <ci>, …)` → `XX`; Oracle bare `REPLACE` also folds under
  a CI session — probed). **Ignores: MySQL, MariaDB, PostgreSQL, SQLite** — byte-wise CS regardless of the
  column collation (MySQL/MariaDB stay `'ABCX'` *despite* their CI default). So by **default** only SQL Server
  corrupts (its default *is* CI); Oracle corrupts only if deliberately configured CI. (Corrects an earlier
  draft that said "only SQL Server" — Oracle shares the mechanism, just not the default.)
- **R2 — PostgreSQL and Oracle need nothing by default** (CS + AS + code-point everywhere). Oracle only
  changes if a user sets a linguistic `NLS_SORT`/`NLS_COMP`; `.collate(BINARY_CI/BINARY_AI)` was confirmed to
  work there for the insensitive direction.
- **R3 — SQLite is coherent everywhere except `LIKE`** (`=`/`IN`/`DISTINCT`/`GROUP BY`/`min`/`max`/`ORDER BY`
  all `BINARY`). Narrower than "SQLite is case-insensitive".
- **R4 — the existing `insensitiveCollation` path is sound and orthogonal** — it writes disjoint templates
  from any per-value `.collate()`; adding `.collate()` won't disturb it.
- **R5 — a general `sensitiveCollation` config is REFUTED (no real use case).** It looked like the tidy
  symmetric mirror of `insensitiveCollation`, but the symmetry is false: `insensitiveCollation` earns its keep
  because *"make my searches case/accent-insensitive with a proper language collation, everywhere"* is a
  common, real need. The mirror — *"force one specific collation on **every** plain op, connection-wide"* —
  is not: (a) if you want a specific collation on a query, `.collate()` does it **surgically** (index cost
  only there); (b) if you want it for the whole connection, the **schema/column collation** (no index cost)
  or the **pool session collation** (Oracle) is the right layer; (c) a library-emitted `collate` on every
  plain predicate **defeats every index** (measured seek→scan) for no benefit those two don't provide. So it
  is not a general element — it would be a narrow opt for a case that `.collate()` + schema + pool already
  cover, and it is **not recommended**. (Recorded so it isn't re-proposed as "the symmetric knob".)

## The resolution hierarchy — normalize the default where we can, guide where we can't

The library already has a preferred way to handle a dialect that behaves differently, and it is a *ladder*:

1. **Normalize the default, with an opt-out to native** — the best outcome: make the emitted behaviour as
   cross-dialect-similar as possible by default, and let a flag restore the engine's native behaviour for the
   extreme cases the normalization can't cover. Established precedents in the library:
   - **Oracle `concat`** — normalized to the other dialects' null handling, opt-out **`ignoreNullInConcat`**
     (`src/utils/ConnectionConfiguration.ts:13`).
   - **SQL Server `len`** — bridged to count trailing blanks like JS `String.length`, opt-out
     **`excludeTrailingBlanksInLength`** (`src/utils/ConnectionConfiguration.ts:9`); one extreme case (a value
     exactly at the column's max length) still breaks it — which is *why* it has an opt-out.

   **The one collation case that fits this tier is `replaceAll` on SQL Server *and Oracle* (`replaceCollation`,
   [F1](#f1--replaceall-silently-corrupts-the-value-on-sql-server-the-one-genuine-problem) / [Fork C](#fork-c--coherent-replaceall-on-sql-server-default--opt-out)).**
   Same shape as `concat`/`len`: a value transform whose native behaviour diverges, normalizable by default
   (a code-point collation + the per-engine reset) with an opt-out to native. It belongs on this rung next to
   them.

2. **Guide the user (docs + tools) where the default *can't* be normalized.** For everything else a normalized
   default is not viable — forcing a collation on every matching/ordering/grouping op defeats indexes and
   overrides the user's schema (F2, F4, ordering predicates); there is no universally-correct case mapping to
   normalize *to* (F6 + the linguistic traps); SQLite `LIKE` is an engine property (F3). So the library
   **equips** (`.collate()` per value, the pool/schema collation, `replaceAllInsensitive`) and **warns** (the
   dedicated page), and leaves the choice to the user.

3. **The type system catches what truly can't be ported** — non-portable constructs stop compiling, the
   existing safety net for dialect transitions. **But collation divergence is invisible to it**: it is a
   *runtime* behaviour — identical SQL the engine executes differently — so the compiler can't flag it. That
   is exactly why collation leans on tiers 1 and 2: the default and the docs must carry what the type system
   cannot.

**Two audiences — and the second is the bigger one.** Transitioning *between* dialects is already relatively
safe (the type system stops what can't port; this report closes the runtime-collation blind spot). The more
common situation is a user **facing a legacy database** — an existing, often miscollated schema they *can't*
change. That user is the primary consumer of the tools: giving them control of the collation *inside*
(`.collate()`, `insensitiveCollation`) and *outside* the library (the schema/column collation, the pool
session collation) makes both living with a legacy DB and transitioning simpler. The aim is not a total
guarantee — it is **fewer surprises and a complete toolbox**.

## Consolidated proposal

Ranked for the maintainer to rule on before any `src/` change. The through-line follows the
[resolution hierarchy](#the-resolution-hierarchy--normalize-the-default-where-we-can-guide-where-we-cant):
**normalize the one default we can (`replace` on SQL Server + Oracle via `replaceCollation`, like
`concat`/`len`), guide + equip for the rest** — not JS mimicry, and not "fix your schema".

### 1. A dedicated **Collations** documentation page (first-class deliverable, like `time-zones.md`)

Model it on [`docs/configuration/time-zones.md`](../docs/configuration/time-zones.md) **for structure, not
for tone** — the Time zones page converges on one recommendation ("UTC everywhere"); the Collations page
must not. It presents **possibilities** and their trade-offs and lets the reader pick what fits their
situation (there is no universally-right collation). It should teach enough to *understand and choose*:

- **The model** — the plain ops **follow the *configured* collation** (by design); `*Insensitive` **forces**
  insensitive. Since the configured default differs per engine (the
  [engines table](#the-engines-probed--default-collation-of-each-container) and
  [master matrix](#the-master-matrix-lens-2-six-dialects-lined-up)), the same call behaves differently across
  engines — expected, and the reason a portable app may want to pin a collation. Call out the **one genuine
  surprise** separately: SQL Server `replace()` (a value transform, not a filter) corrupts on a CI column.
- **The concepts** — what Case-Insensitive and Accent-Insensitive mean, that binary/CS collations compare
  code points, and that JS is case+accent-sensitive but that is *not necessarily what you want* for data.
- **The linguistic traps** — case folding is **locale-dependent**: German ß, the Turkish dotted/dotless I
  (with the probed "opposite verdict by locale" example), CJK normalization/variants/sort — and even two
  engines can answer the *same* question differently. This is the section that keeps a reader from picking a
  generic collation for language-specific data; it also motivates why the library injects a *language*
  collation instead of `lower()`.
- **The default of each supported database** (the table above).
- **PostgreSQL is case-sensitive by default** — document it plainly, and *how to go insensitive*: native
  `ILIKE` (the library already emits it for `*Insensitive` LIKE on PG), an `insensitiveCollation` naming a
  **non-deterministic** ICU collation for equality/`DISTINCT`, and `.collate()` per value. PG is the "already
  the JS-sensible default, and configurable the other way" case.
- **On a case-insensitive database (or any already-CI schema): configure the connection to generate better
  SQL.** Set **`insensitiveCollation = ''`** — the `*Insensitive` ops then drop the redundant
  `lower(a) = lower(b)` (which *also* defeats indexes) and emit the bare op the already-CI column folds
  correctly. Fewer `lower()` calls, index-usable SQL, same result. This is the concrete "configure better /
  avoid unnecessary `lower()`" guidance for CI-default engines (SQL Server, MySQL, MariaDB) and any CI-configured DB.
- **The two complicated engines, named** — **SQL Server** (no session/general collation lever *and* the
  `replace` corruption → needs `.collate()` per value or `replaceCollation`) and **SQLite** (ASCII-only
  `lower`/`NOCASE`, `LIKE` ignores collation, no built-in complex collations) — so the reader knows where the
  sharp edges are. PostgreSQL and Oracle are the easy ones (CS by default; configurable both ways).
- **Which operations are affected** (the [complete inventory](#is-there-anything-more--the-complete-collation-inventory)) —
  matching (`equals`/`like`/`contains`/`in`), ordering (`lessThan`/`between`), `DISTINCT`/`GROUP BY`/`min`/`max`,
  `replaceAll`, `toLowerCase`/`toUpperCase`; and the ones that are **not** (`substr`, `trim`, `length`), plus
  the **unique-constraint / upsert** gotcha (a duplicate on a CI engine, not on a CS one). So the reader knows
  the full reach, not just `.contains`.
- **SQLite is the connectors' builds, not SQLite-in-general** — scope the SQLite guidance to the six
  supported connectors (the per-connector table: all non-ICU, `LIKE` ASCII-CI, no `regexp_replace`; versions
  3.51–3.53), and note a custom/ICU/`CASE_SENSITIVE_LIKE` build would differ.
- **The tools**, in one place: `insensitiveCollation` (name / `''` nullify / unset), the new `.collate()`,
  `replaceAllInsensitive`, the pool session collation, and the schema-level column collation — *when* to reach
  for each, with the per-engine collation names (absorb/expand the current `connection.md#insensitive-strategies`
  list, which already has the PG non-deterministic-collation recipe and the per-db CI/AI names) and the two
  `.collate()` caveats (PG non-deterministic equality; SQLite `LIKE` = pragma).
- **Connection / session-level configuration** — a section mirroring the Time zones page's *"The database's
  zone"*: the library's `insensitiveCollation` and per-value `.collate()` (portable — the `collate` rides in
  the SQL), plus the engine session levers (Oracle `NLS_COMP`/`NLS_SORT`, MySQL `collation_connection` with its
  column caveat, SQLite `PRAGMA case_sensitive_like`) — and the same **"SQL Server has no session
  collation"** note the timezone page makes about its session zone.
- **The pragmatic path — "you already have a database you can't re-collate"** (mirror the Time zones page's
  *"You already have a database"*): the fix is configuration, not a migration — apply the pool session
  collation where the engine has one, or `.collate()` where it matters, without changing the schema. This is
  the core of the maintainer's "we can't assume the user can fix a defective model".
- **The trade-offs of each possibility** (so the reader weighs, not follows a ranking) — a forced collation
  can defeat an index (the measured seek→scan): a surgical `.collate()` pays that cost only where applied, a
  schema/column collation avoids it entirely but may be unavailable to the caller, and the engine session /
  pool lever (Oracle/SQLite) is schema-free but partial or engine-specific. Each fits a different situation.

Cross-link it from `connection.md`, each `supported-databases/*.md`, and the string-ops reference. This page
is the backbone of "dotar al usuario de herramientas"; ship it regardless of which forks land.

### 2. Add **`.collate('<name>')`** — the general per-value lever (Fork A)

> <a id="fork-a--per-value-collate-the-general-lever"></a>**Fork A.** A `.collate('<name>')` on string value
> sources, emitting `(<expr> collate <name>)`, returning the same value-source type. Works on either operand
> of a comparison, on a projected/grouped/ordered column, and on `replaceAll` arguments. Serves **both**
> directions (force CS or CI/AI) per the [reach table](#collate-reach-per-engine-probed--how-far-the-per-value-lever-goes).

The most flexible answer to F2/F4 and the one the maintainer endorsed. **Surgical**, so it avoids the
blanket index-defeat of a connection-wide force. Consistent with the existing `insensitiveCollation`
philosophy (the user supplies a raw dialect collation name). **Trade-off to document:** the name is
per-dialect, so `.collate('utf8mb4_bin')` is not portable to SQL Server — for cross-dialect code the
connection-level knobs (below) are cleaner. (A possible later refinement — `.collate()` accepting an
*abstract intent* the library maps per dialect — is out of scope here; the raw-name form matches today's
`insensitiveCollation` and is the right first step.)

### 3. Considered and set aside — a general `sensitiveCollation` config (refuted)

It is tempting to add `sensitiveCollation` as the tidy mirror of `insensitiveCollation` (a name that pins a
collation across all the plain ops). **On inspection it has no real use case** — see
[R5](#refutations-record-so-the-next-round-doesnt-re-derive). The apparent symmetry is false: `insensitiveCollation`
serves a common, concrete need (make searches case/accent-insensitive with a proper language collation,
everywhere), whereas "force one specific collation on *every* plain op, connection-wide" is served **better**
by the surgical `.collate()` (per query, index cost only there), by the **schema/column collation** (no index
cost, when changeable), or by the **pool session collation** (Oracle). A library-emitted `collate` on every
plain predicate would **defeat every index** for no benefit those three don't already provide.

So there is **no `sensitiveCollation` fork.** The "take control of the collation" need — including the
legacy-DB case — is met by **`.collate()`** (per value) plus the **connection-level levers that already exist**
(schema, pool). Recorded here so it isn't re-proposed as "the missing symmetric knob".

### 4. A **`replaceCollation`** config (SQL Server + Oracle only) — default set, opt-out (Fork C)

> <a id="fork-c--coherent-replaceall-on-sql-server-default--opt-out"></a>**Fork C (the maintainer's shape).**
> A connection config **`replaceCollation?: string`** on **`SqlServerConnection` and `OracleConnection`
> only** — the two engines whose `REPLACE` honours collation. It names the collation forced on `replaceAll`'s
> **match** operands, **defaulting to a binary/code-point collation** (SQL Server `Latin1_General_BIN2`,
> Oracle `BINARY`), emitted as `replace(src collate <replaceCollation>, from collate <replaceCollation>, to)`
> followed by a **result-collation reset** so the forced collation doesn't leak downstream —
> `collate DATABASE_DEFAULT` on SQL Server, **`collate USING_NLS_COMP` on Oracle** (both probed: on a CI
> config, a chained `= 'abcx'` on the result stays CI *with* the reset, flips to CS *without* it). **Opt-out:**
> `replaceCollation = ''` → bare native `replace(...)`.

A named config beats a boolean flag: the default pins a **code-point** collation so `replaceAll` is
case-sensitive whether the DB is CS, CI, or any other variant — the mechanism to take a
**case-insensitive database to case-sensitive in `replace`**, which is the critical case. Same shape as
`insensitiveCollation` (a collation *name*): default = coherent, `''` = native, a special need can name a
third collation.

**Why only SQL Server and Oracle** — the affectation splits by whether the engine's `REPLACE` honours
collation, and on the four that ignore it the config would be a meaningless no-op, so it is **not offered
there**:

| engine | `REPLACE` honours collation? | `replaceAll` on a **CI-configured** DB | `replaceCollation` |
|---|---|---|---|
| **SQL Server** | **yes** | **CI — corrupts** (its default collation *is* CI) | **offered**, default `Latin1_General_BIN2` |
| **Oracle** | **yes** | **CI — corrupts**, *if* configured CI (`NLS_COMP=LINGUISTIC` + a CI sort) | **offered**, default `BINARY` |
| MySQL / MariaDB | no (ignores) | CS always (byte-wise, regardless of the CI default) | **not offered** — would be inert |
| PostgreSQL | no (ignores) | CS always | **not offered** — would be inert |
| SQLite | no (ignores) | CS always | **not offered** — would be inert |

Probed: Oracle under `NLS_COMP=LINGUISTIC, NLS_SORT=BINARY_CI` → bare `REPLACE('ABCabc','abc','X')` = **`XX`**
(corrupts, like SQL Server); `… collate BINARY` → `ABCX` (fixed). On PostgreSQL / MySQL / SQLite,
`replace(x collate <bin>, …)` returned `ABCX` with **no error** but **no effect** — confirming it is inert
there, hence not worth exposing.

- **Default on by design** (with `''` opt-out to native) — code-point out of the box on both engines, so a
  CI configuration doesn't silently corrupt.
- **This is tier 1 of the [resolution hierarchy](#the-resolution-hierarchy--normalize-the-default-where-we-can-guide-where-we-cant)** — the same
  normalize-default-with-opt-out pattern as Oracle `concat` (**`ignoreNullInConcat`**,
  `ConnectionConfiguration.ts:13`) and SQL Server `len` (**`excludeTrailingBlanksInLength`**,
  `ConnectionConfiguration.ts:9`). Emitting a `collate` the user didn't ask for is not unprecedented — the
  library already does it on SQLite (`SqliteSqlBuilder._supportCollateInCompoundOrderBy = true`,
  `SqliteSqlBuilder.ts:104`) and throughout the `insensitiveCollation` path.

### 5. Add **`replaceAllInsensitive(...)`** — the insensitive twin `replaceAll` never got (Fork D)

> <a id="fork-d--replaceallinsensitive-the-insensitive-twin"></a>**Fork D.** A `replaceAllInsensitive`
> (+ `replaceAllInsensitiveIfValue`) method completing the sensitive/insensitive pair the rest of the API has.
> Per-dialect emission (from the [feasibility probe](#case-insensitive-replaceall--feasibility-per-engine-probed),
> three mechanisms): **collation-driven** — SQL Server *and Oracle* (`REPLACE(src collate <CI>, from collate
> <CI>, to)` + reset, honouring `insensitiveCollation`, accent-capable); **regex-driven** — MySQL/MariaDB
> (`REGEXP_REPLACE`, honours the collation → accent) and PostgreSQL (`regexp_replace … 'gi'`, case-only);
> **UDF-or-limitation** — SQLite.

**How it is implemented per engine — which use the insensitive collation, which can't, and the mechanism**
(the maintainer's question, answered from the probes):

| engine | mechanism | uses `insensitiveCollation`? | if `insensitiveCollation` unset |
|---|---|---|---|
| **SQL Server** | `REPLACE(src collate <C>, from collate <C>, to) collate DATABASE_DEFAULT` | **YES** — `C` = `insensitiveCollation` | **bare `replace(...)`** → the DB default collation (CI on a standard SQL Server — decided) |
| **Oracle** | `REPLACE(src collate <C>, from collate <C>, to) collate USING_NLS_COMP` | **YES** | force `BINARY_CI` (Oracle's neutral CI collation) + `USING_NLS_COMP` reset |
| **MySQL / MariaDB** | `REGEXP_REPLACE(src collate <C>, <esc from> collate <C>, to)` | **YES** — `C` on the regex operands (probed: `utf8mb4_bin`→CS, `ai_ci`→CI) | the default collation (already CI) |
| **PostgreSQL** | `regexp_replace(src, <esc from>, to, 'gi')` | **NO** — `'gi'` is a fixed *case-only* flag; no collation/accent/language lever exists | `'gi'` (case only) always |
| **SQLite** (UDF conns) | a registered `ci_replace` UDF | **NO** — JS-defined, can't read the DB collation | UDF-defined |
| **SQLite** (no UDF) | — | — | limitation |

So: **the insensitive collation carries over on SQL Server, Oracle (both collation-driven), and MySQL/MariaDB
(collation on the regex operands)** — full case+accent+language. It **does not** on **PostgreSQL** (`'gi'` is
case-only, cannot honour `insensitiveCollation`) or **SQLite** (the UDF folds in JS, not by DB collation).

**Implementation notes (per the maintainer's guidance):**

- **The regex-escape follows the library's existing "escape the known value at build time" pattern** — no new
  concept. It is the same shape as **`_escapeLikeWildcard`** (`AbstractSqlBuilder.ts:3037`), which already
  branches exactly this way: when the term is a **known string literal** it escapes it in **JS at build time**
  (`value.replace(/\\/g,'\\\\')…`) and binds the escaped literal; when it is a **value source** (unknown at
  build time) it emits a **SQL-level** escape (nested `replace(...)`). For `replaceAllInsensitive` the metachar
  set is the regex one (`from.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')` for a literal; nested `replace(...)` for a
  value source). So "build the best query with the data we know" applies verbatim — the literal path is clean,
  the value-source path reuses the SQL-level construction the library already uses for LIKE.
- **SQLite — a *configurable UDF name*, with fallback to plain `replace`.** Add a `SqliteConnection` config
  naming the function to call for insensitive replace. If **set**, emit `<name>(src, from, to)`; if **unset**
  (or the connector can't register a UDF), **fall back to plain `replace(src, from, to)`** — degrade to
  case-sensitive replace, **documented, never an error**. Then the docs, *per connector*: **how to register
  it, with the JS implementation provided** (`better-sqlite3` / `node:sqlite` `db.function(name, (s,f,t)=>…)`,
  `sqlite-wasm` `db.createFunction`), or **"this connector has no UDF API → `replaceAllInsensitive` behaves as
  `replace` (case-sensitive)"** (`sqlite3`, `bun:sqlite`, `bun:sql`). **SQLite `loadExtension` is out of
  scope** — it opens a non-JS chapter (compiled binaries) the library doesn't enter; the JS UDF is the only
  route.
- **No `lower()` fallback** (it would lowercase the *whole* returned string). So when `insensitiveCollation`
  is unset, the insensitivity comes from the per-engine mechanism above — and the two collation-driven engines
  differ (decided):
  - **SQL Server — the library provides nothing extra**: emit **bare `replace(...)`** and lean on the DB
    default collation, which is CI on a standard SQL Server (the common case). On the unusual CS SQL Server the
    user sets `insensitiveCollation`. (SQL Server has no neutral general CI collation to hardcode — its CI
    collations are culture-specific — which is why it leans on the default here.)
  - **Oracle — the library must provide the CI collation**: Oracle's default is CS (`BINARY`), so bare
    `replace` would *not* be insensitive; the library forces Oracle's neutral **`BINARY_CI`** (+ `USING_NLS_COMP`
    reset). This is the one place the library supplies a default CI collation itself.

### 6. Documented boundaries (no `src/` change)

- **SQLite `LIKE`** (F3) — `PRAGMA case_sensitive_like`/`GLOB`; state that `.collate()` does not reach it
  (LIKE ignores operand collation).
- **SQLite `replaceAllInsensitive`** (Fork D) — a **configurable UDF-name** config; when set, emit
  `<name>(src,from,to)` (register the function via `db.function()` on `better-sqlite3`/`node:sqlite` or
  `db.createFunction` on `sqlite-wasm`, JS implementation shown in the docs); when unset or on a no-UDF
  connector (`sqlite3`, `bun:sqlite`, `bun:sql`), **fall back to plain `replace` — case-sensitive, documented,
  not an error**. Extensions out of scope (non-JS).
- **F4 folding** and **ordering predicates** (`lessThan`/`greaterThan`/`between` on strings) — covered by
  `.collate()`/schema; documented as a data surprise (same collation root).
- **F6 `toLowerCase`/`toUpperCase`** — case mapping is locale-dependent; `.collate()` pins the locale where
  supported; SQLite folds ASCII only (already a `LIMITATIONS.md` entry).
- **Unique constraints / `onConflict` upsert matching** — resolve uniqueness under the column's collation, so
  the same insert can conflict on a CI engine and not a CS one; the library can't own the index collation —
  warn-and-document.
- **PostgreSQL glibc ORDER BY sequence** (F5) — one-line deployment note.
- **PostgreSQL per-value CI equality** — needs a non-deterministic collation object (the docs already show
  the recipe for `insensitiveCollation`); reuse that note for `.collate()`.
- **The engine session levers / pool collation** (Oracle `NLS_*` full, MySQL `collation_connection` partial,
  SQLite pragma) and the **"SQL Server has no session collation"** note — the connection-level configuration
  story, mirroring the Time zones page.

---

**Net for `src/` if forks A, C, D land** (Fork B — `sensitiveCollation` — is **refuted**, see R5): one new
per-value method (`.collate()`, Fork A — public surface, in the expression tree + `exports`/barrel); one new
config `replaceCollation` read by the **SQL Server and Oracle** builders only, default = a code-point
collation, `''` opt-out (Fork C); and one new method family `replaceAllInsensitive` with per-dialect emission
+ a regex-escape seam (Fork D — collation-driven on SQL Server & Oracle [honours `insensitiveCollation`],
regex on MySQL/MariaDB [honours it via operands] & PostgreSQL [`'gi'`, case-only, cannot], UDF-or-limitation
on SQLite). Plus the dedicated docs page (#1) and the boundary notes (#6). The four engines whose `REPLACE`
ignores collation (MySQL/MariaDB/PG/SQLite) need nothing for `replaceAll` (R1). Every fork is a lever or a
normalize-default-with-opt-out move, **not** JS-mimicry and **not** a prescribed behaviour — the user chooses
per their situation, and the one thing the library stops doing on its own is silently corrupting `replace`
values on a CI-configured SQL Server / Oracle.

## Implementation readiness — is the solution complete and coherent?

**Verdict: yes — coherent across the usage situations, and implementation-ready, with a short list of named
open *policy* choices (not technical gaps).** The user-facing story closes cleanly:

| situation | the answer |
|---|---|
| **Plain ops behave differently per engine** | *by design* — they follow the configured collation; **document** it (the dedicated page). Not a bug. |
| **I want case/accent-insensitive matching** | `*Insensitive` methods + `insensitiveCollation` (already exist); on a CI DB set `insensitiveCollation = ''` for leaner, index-usable SQL |
| **I want a specific collation on *this* query** | **`.collate('<name>')`** (Fork A) — per value, both directions |
| **I want it connection-wide (legacy DB I can't re-collate)** | schema/column collation, or the **pool session collation** (Oracle full, SQLite `LIKE`, MySQL/MariaDB partial) |
| **`replace` corrupts on my CI SQL Server / Oracle** | **`replaceCollation`** (Fork C) — code-point by default, `''` opts out |
| **I want a case-insensitive replace** | **`replaceAllInsensitive`** (Fork D) — collation-driven where it can be, per-engine |
| **PostgreSQL / Oracle** | already the JS-sensible CS default; configurable the other way |
| **SQLite / SQL Server** | the two harder engines — named and their limits documented |

Each fork's emission is **fully specified and probed**. The three policy calls have now been **decided by the
maintainer** (recorded here):

- **Fork A — `.collate('<name>')`**: a method on the string value sources emitting `(<expr> collate <name>)`.
  Fully settled. Doc caveats (PG non-deterministic equality; SQLite `LIKE`) — not blockers.
- **Fork C — `replaceCollation`** (SQL Server + Oracle): emission and resets probed
  (`… collate DATABASE_DEFAULT` / `… collate USING_NLS_COMP`), default = code-point, `''` opt-out.
  **DECIDED: default ON**, with a **changelog notice** so an upgrader can exercise the `''` opt-out. (Snapshot
  churn: rebakes the SQL Server + Oracle `replace` snapshots; *values* change only on CI-configured cells —
  expected.)
- **Fork D — `replaceAllInsensitive`**: per-engine mechanism fixed; regex-escape reuses the `_escapeLikeWildcard`
  build-time/SQL-level pattern; SQLite = a configurable UDF name with a documented `replace` fallback.
  **DECIDED:**
  1. **Fallback when `insensitiveCollation` is unset** — **SQL Server → bare `replace(...)`** (its default
     collation, which is CI on a standard SQL Server — the common case; on the unusual CS SQL Server the user
     sets `insensitiveCollation`). **Oracle → force `BINARY_CI`** (Oracle's default is CS, but it *has* a
     neutral CI collation, so use it) + `USING_NLS_COMP` reset. MySQL/MariaDB → default collation (already CI);
     PostgreSQL → `'gi'`.
  2. **SQLite UDF bodies** — shipped **in the documentation** (per connector), as the library already does for
     other connector-specific setup.
  3. PostgreSQL stays case-only (`'gi'`) — a documented limitation, no code path.
- **Docs (#1)** — a writing deliverable; outlined section by section, no technical unknowns.

**Out of scope (so the boundary is explicit):** the other dialect-asymmetry families (numeric, temporal,
null-handling) are separate audits; SQLite `loadExtension` is ruled out (a non-JS chapter); a general
`sensitiveCollation` is refuted (R5). Nothing in the plan requires re-deriving a probe — every engine claim
here has a transcript above.

**Bottom line.** The report is **complete and the decisions are made** — implement three `src/` changes
(`.collate()`, `replaceCollation` default-on with a changelog note, `replaceAllInsensitive` with the per-engine
fallbacks above) plus the dedicated docs page. No open blockers remain.
