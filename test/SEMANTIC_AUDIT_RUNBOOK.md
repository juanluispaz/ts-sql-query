# Semantic audit — where the library and the engine quietly disagree

A multi-agent audit for **one defect family**: the places where the library
promises the user one thing and asks the database for another, and **nothing
fails**. No error, no red test — just a wrong value handed back with a straight
face.

This runbook exists because a single round of it found **13 defects across 5
dialects**, every one of them years old, every one of them sitting under a green
matrix. It is written so the next round doesn't have to rediscover the method.

- [Why this audit exists](#why-this-audit-exists)
- [Mandatory reading](#mandatory-reading)
- [The unit: a promise the engine doesn't keep](#the-unit-a-promise-the-engine-doesnt-keep)
- [The evidence bar: PROBE, never reason](#the-evidence-bar-probe-never-reason)
- [The four lenses](#the-four-lenses)
- [Fingerprints that have paid off](#fingerprints-that-have-paid-off)
- [Where the round before you was wrong](#where-the-round-before-you-was-wrong)
- [The loop, end to end](#the-loop-end-to-end)
- [Wave 1 — discovery agents](#wave-1--discovery-agents)
- [Coordinator verification](#coordinator-verification)
- [The report](#the-report)
- [Operational rules](#operational-rules)

## Why this audit exists

Every defect this method finds shares one shape:

> **The declared type is a promise. The emitted SQL is the request. When they
> disagree, the engine answers the request — and the user reads the promise.**

`asBigint()` declares `bigint` and emits `round(<float>)`. The engine computes in
floating point. The result is integral, so the marshaller coerces it without
complaint and the caller gets a **clean, wrong `bigint`**. Nothing errors. The
test asserting `4n` passes, because `2 + 2` is exact in a double.

The suite cannot see this class by construction:

- **Mock cells** never execute SQL, so the engine never gets to disagree.
- **Real-DB cells** execute it, but the seeded data is chosen to be *readable*,
  which usually means *exact*: `priority = 2`, `avg = 1.5`, `.123` milliseconds.
  Values where right and wrong coincide.
- **The assertion** is often written to pass: `toBeCloseTo(2, 4)` has a 5e-5
  threshold; the defect it was hiding erred by 1.4e-6.

So the audit is not "run the tests harder". It is: **derive what the engine will
actually do, then go ask it.**

## Mandatory reading

Before launching anything:

1. **[`CODE_SEARCH.md`](./CODE_SEARCH.md)** in full — the searcher is how you
   enumerate every spelling of a concept across dialects, which is lens #2 and
   the highest-yield one. Refresh the index: `npm run tests:index` — the **full**
   index here, NOT the lighter `tests:index:newest`: this audit enumerates every
   spelling of a concept across all dialect/version cells, so it needs the older
   tiers indexed too.
2. **[`BUGS.md`](./BUGS.md)** — every open entry, and the *Coverage gaps carried
   over* section. An entry's `Where:` / `Reproduction:` lines are **starting
   points, not ground truth** — see [below](#where-the-round-before-you-was-wrong).
3. **[`LIMITATIONS.md`](./LIMITATIONS.md)** — what the library has *decided* not
   to do. Filing one of these as a bug is the most expensive mistake this audit
   can make, and it has been made.
4. **[`TYPE_AUDIT_RUNBOOK.md` § The degeneracy bar](./TYPE_AUDIT_RUNBOOK.md#the-degeneracy-bar)**
   — the sibling audit's bar for "this test can't tell right from wrong". Same
   idea, different axis.

## The unit: a promise the engine doesn't keep

One finding = **one place where the declared type, the documented contract, or
the JavaScript semantics the API mirrors diverges from what the engine does with
the emitted SQL** — plus the engine transcript proving it.

Three kinds of promise, all equally binding:

| Promise | Broken when | Real example found |
|---|---|---|
| **The declared type** (`__valueType`) | the SQL emits a different one | `asBigint()` → `bigint` declared, `float` emitted → wrong beyond 2^53 |
| **The JavaScript semantics the method mirrors** | the engine's own rule differs | `getSeconds()` returned **60**; `getMilliseconds()` returned **1000**; `getDay()` shifted by `SET DATEFIRST` |
| **The documented contract** | the code drifted from the page | `executeSelectPage` docs say the count runs "without pagination"; the code kept the `ORDER BY` |

If you can't name which promise is broken, you don't have a finding — you have a
preference about SQL style. Say so and move on.

## The evidence bar: PROBE, never reason

**A finding is not real until an engine says so.** This is not pedantry; it is
the single rule that separates this method's hits from its misses:

- A static sweep **cleared the aggregates as sound**, with a well-argued case
  about the marshaller turning overflow into a loud error. It was right about
  overflow and blind to precision: `avg(<int>)` on MySQL / MariaDB returns
  `decimal(14,4)`, so `avg(1,2,2)` is `1.6667`, not `1.6666666666666667`. **The
  probe found it in one query.**
- The reverse also bites. A sweep *predicted* `_asDouble`'s `* 1.0` was DECIMAL
  from MySQL's documented literal rules. Correct — but only `DESCRIBE` turned it
  into a fact (`decimal(3,1)`), and only the probe revealed that fixing it would
  **regress** `round()` and `asBigint()` on the same dialect.

Probe recipes that paid for themselves:

```bash
# The type an expression really has — not the value, the TYPE
docker exec <mysql> mysql -u… -e "CREATE TABLE t AS SELECT <expr> AS c; DESCRIBE t;"
docker exec <pg>    psql -U… -c "SELECT pg_typeof(<expr>);"
npx tsx -e "…"      # SQLite: typeof(<expr>) and better-sqlite3 defaultSafeIntegers(true)

# The cost, when the fix has one
docker exec <oracle> … "set autotrace traceonly explain; <query>;"
docker exec <mssql>  … "SET SHOWPLAN_TEXT ON; GO; <query>; GO;"
```

**Two traps this bar exists to catch, both of which caught the last round:**

1. **`console.log('%f', …)` in Node eats the format specifier.** A probe printed
   `strftime('45.123', …)` and looked broken when the value was right. Use
   `console.table`, or avoid `%` in the format string.
2. **I/O counters are not a plan.** SQL Server's logical reads were *identical*
   with and without a pointless `ORDER BY`, so the round concluded its optimizer
   dropped it. `SET SHOWPLAN_TEXT ON` showed a `Sort` operator: the reads matched
   only because the sort fit in memory. **Ask for the plan.**

## The four lenses

Ordered by yield. Lens #2 alone found the whole date-part family.

### 1. Declared vs emitted

Walk `src/internal/ValueSourceImpl.ts` for every `new SqlOperation*ValueSource('_op', this, <declaredType>, …)` and ask: **does `_op`'s SQL actually produce `<declaredType>` on every dialect?** Then walk every guard in `src/sqlBuilders/` that keys on a declared type (`columnType === 'double'`, `__valueType`, `_getMathArgumentType`) and ask: **can a declared-vs-emitted divergence route around it?**

Found: `asInt`/`asBigint`, and the `_modulo` guard that a declared-bigint receiver walks straight past.

### 2. The drift lens — the highest-yield question in this runbook

> **Which dialects hand-spell the same concept, and do they agree?**

Not "is this method right" — **line the 6 spellings up next to each other**. The
disagreement *is* the finding. Every time:

- `_getSeconds` is spelled six ways. Oracle writes `trunc(extract(second …))`;
  PostgreSQL writes `extract(second …)::integer`. **Oracle's `trunc` is the proof
  that truncation was intended, and PostgreSQL drifted** — straight to
  `getSeconds()` returning 60.
- `_divide` is literally `_asDouble(x) / _asDouble(y)` **re-spelled by hand** in
  three dialects. That's how MySQL came to be wrong in both places
  independently, and how SQL Server's `_cbrt` kept a private copy of the
  defective `1.0 / 3.0` exponent the bug report had blamed on MySQL alone.
- `_unixEpochMilliseconds` writes `cast(… as integer)` where `_getTime` writes
  `round(…)` **of the same expression**. One truncates. 29 818 of 60 000
  millisecond values came back one early.

```bash
npm run tests:where-is -- --search _getSeconds --for emission-bug
for f in AbstractSqlBuilder PostgreSqlSqlBuilder AbstractMySqlMariaBDSqlBuilder \
         OracleSqlBuilder SqlServerSqlBuilder SqliteSqlBuilder; do
  echo "── $f"; awk '/_theMethod\(params/,/^    }$/' src/sqlBuilders/$f.ts
done
```

### 3. The local fix

**A dialect that fixed a bug only for itself is a signpost, not a solution.**
SQL Server had a `private _averageOperandSql` casting integer operands to float,
with a comment stating T-SQL's `AVG` truncation "diverges from every other
supported dialect". That claim was **false** — MySQL / MariaDB diverge too, just
less visibly (`1.6667` instead of `2`), which is exactly why nobody looked.

So: **grep for a comment that claims other dialects are fine, and go check.** It
was false twice in one round (this one, and PostgreSQL's `round` note).

### 4. The unreachable base

A base-dialect method every subclass overrides is **not dead code — it is
untested code**. Two shipped for the library's entire life:

- `_divide` emitted `cast(… as double presition)` — a typo, i.e. invalid SQL.
- `_stringConcat` emitted `string_concat(…)` — **a function no supported engine
  has**.

Both had been seen by earlier audits and dismissed as "cosmetic / dormant / OUT".
When the base is wrong, fix it — and prefer making a real dialect reach it (the
base is SQLite's implementation now, so SQLite exercises it).

## Fingerprints that have paid off

Ranked by hit rate in the round that produced this runbook.

| Fingerprint | Why it works | What it found |
|---|---|---|
| **A hardcoded literal in emitted SQL** (`1.0`, `/ 1000`, `* 1.0`, `0.5`) | exactness is a *type*, and engines disagree about it: `1.0` is DECIMAL on MySQL, `numeric` on SQL Server, REAL on SQLite | `cbrt` (2 dialects), `asDouble`, `divide` |
| **A test whose `expected` is a STRING for a numeric leaf** (`toBe('4.0000')`, `'7'`, `'8.00'`) | the string *is* the defect's fingerprint — an exact type leaking through | `divide` returning DECIMAL; and the fixture gap behind all of them |
| **A comment that rationalises a wrong value** | it is a **wrong diagnosis** written by someone who saw the symptom and stopped | *"power() is lower-precision than JS Math.cbrt"* — false; the literal `1.5873937166347238` is bit-for-bit `Math.pow(4, 0.33333)`, i.e. the truncated divisor |
| **`Number(...)` / `BigInt(...)` around a result before asserting** | it *defeats the assertion*: `Number('1')` passes for a string a type regression produced | 965 assertions that asserted nothing |
| **`toBeCloseTo(x, n)` with n ≤ 5** | price the defect: a DECIMAL-truncated divisor errs ~1.4e-6, which `n=5` (5e-6) **masks** | SQL Server's `cbrt` passing with the wrong value |
| **Value-degenerate fixtures** | `avg = 1.5` is exact in 4 decimals; `.123` ms makes `round ≡ trunc`; `priority = 2` is exact in a double | every date-part bug; `average` |
| **A knob nothing reads** | either it should do something, or its docs lie | MariaDB `uuidStrategy` (ruled: an intentional seam — see below) |
| **A `private` helper on one dialect doing a general job** | see [lens #3](#3-the-local-fix) | `_averageOperandSql` |

## Where the round before you was wrong

Read this section twice. **Every one of these was a confident, well-argued
mistake**, and each cost real time.

### Inheriting a verdict is where the bugs live

The round's own worst misses, and its predecessors':

- **"v2 already decided this."** `bigint` precision beyond 2^53 was filed as a
  `src/` bug and a fix was drafted for five query runners. It would have
  **reverted a deliberate v2 decision** — `BetterSqlite3QueryRunner` *stopped*
  forcing `safeIntegers(true)` on purpose, and every SQLite runner's page
  documents the opt-in. The maintainer caught it. **Before filing: grep the
  docs and the CHANGELOG for the symbol.**
- **"R45/R46 closed it."** The base `_asDouble` typo was filed and dismissed
  twice as cosmetic before someone re-derived it.
- **"The changelog says `* 1.0` is the MySQL spelling."** It said so, and it was
  wrong — ratified without noticing it yields DECIMAL.

> **Inherit no verdict. Re-derive it, or leave it alone.** A verdict you inherit
> is a probe you didn't run.

### The filed premise is usually wrong

**All three** entries the round picked up had a false or incomplete premise:

| Filed | Actually |
|---|---|
| "MySQL loses precision; MariaDB masks it" | **SQL Server is broken too** (never mentioned), and MariaDB **doesn't mask** anything — it doesn't truncate inside `power()` |
| "Oracle forbids `ORDER BY` in a scalar subquery, **period**" | Oracle forbids a **bare** one; with `offset`/`fetch` it is fine — **a live green test in the repo proved it**. The suggested derived-table wrap was a red herring |
| "SQL Server rejects `float % bigint`" | true, and the *smaller* half: `add`/`subtract` **silently return wrong values** on the same path |

### A "fix" can be load-bearing

PostgreSQL's `round((x)::numeric)` looked like the same excess cast the
maintainer had just (correctly) called out in `divide`. Narrowing it broke a
test — and the test's own comment explained why: the cast **also types the
operand**, so `round($1) % $2` resolves. Without it, `double precision % unknown`
— an operator PostgreSQL does not have. **Reverted, and the reason is now a
comment in the code.**

### The rule that comes out of it

> **Refuting your own finding is a result, not a failure.** Two of the round's
> best outcomes were a refutation (PostgreSQL `round`) and a reclassification
> (`bigint` runners). Both took less time than the fix would have, and both are
> now anchored in the code so nobody re-files them.

## The loop, end to end

1. **Read** the mandatory list. Refresh the index.
2. **Fan out** discovery agents (wave 1) — read-only, one lens or one surface each.
3. **Coordinator probes every candidate.** Agents cannot run docker. The
   coordinator's probe is the only thing that turns a candidate into a finding.
4. **Write the report** to `SEMANTIC_AUDIT_<N>.md`, ranked by user impact.
5. **Bring the design forks to the maintainer** — not the whole list, the forks.
6. Fix, propagate, gate.

## Wave 1 — discovery agents

**Cap at ~2–3 concurrent** ([memory: delegation OOM discipline](./TYPE_AUDIT_RUNBOOK.md#operational-rules)).
Agents **never** run `tsgo`, the whole matrix, `tests:audit`, `--docker`, or
`tests:index` — the coordinator owns all of those, serially.

Give each agent **one lens or one surface**, never "find bugs":

| Agent | Scope |
|---|---|
| A | Lens 2 over the **date/time** surface — every `_getX` / `_asX` spelled per dialect; do they agree? |
| B | Lens 2 over the **string** surface — `_concat`, `_length`, `_substr*`, `_like*`, `_asString`, uuid↔string |
| C | Lens 1 over `ValueSourceImpl` — every declared type vs its operation's SQL |
| D | Lens 3+4 — every `private` helper on one dialect doing a general job; every base method all dialects override |
| E | The **test** surface — fingerprints: string `expected` for numeric leaves, rationalising comments, `Number(...)`/`BigInt(...)`, loose `toBeCloseTo`, degenerate fixtures |
| F | The **fixture** surface — every custom typeName used vs registered in each `domain/connection.ts`; per-db symmetry |

The prompt template that worked:

> Repo: … Read CLAUDE.md and test/SEMANTIC_AUDIT_RUNBOOK.md first.
> READ-ONLY. Do NOT edit. Do NOT run tsgo / the matrix / tests:audit / docker /
> tests:index — the coordinator owns those. You MAY read, grep, and run
> `npm run tests:where-is -- …`.
> CONTEXT: <the lens, with 2 concrete examples of what it found before>
> YOUR TASK: <the one surface>. For each candidate report file:line, the emitted
> SQL, which engines it would hurt, and the concrete user-visible consequence.
> State for each whether it is CONFIRMED by reading + vendor docs, or a SUSPICION
> needing a real-DB probe (the coordinator can probe — say exactly what to run).
> **Flag explicitly anything that would return a silently WRONG VALUE** — that is
> the highest-value output.
> Do NOT propose a fix for anything you have not located precisely.

## Coordinator verification

For every candidate, in this order:

1. **Probe it.** Type first (`DESCRIBE` / `pg_typeof` / `typeof()`), then value,
   then — if the fix has a cost — the plan.
2. **Check it isn't already ruled.** `grep` the docs, `git log -S <symbol>`,
   `LIMITATIONS.md`. The origin matters: `git log -S` showed the `1.0/3.0`
   literal came from the **initial release with no comment**, while
   `delete data.__limit` came from a fix with an issue number. One is an
   accident; the other is a decision.
3. **Check the docs for the intended contract.** `select-page.md` had described
   the correct count query all along — the *code* had drifted. The docs are an
   oracle, not decoration.
4. **Prove the lock.** After fixing, `git stash push -- src/` and re-run: **the
   test must fail**. A test that passes both ways locks nothing. This caught two
   would-be-useless tests in one round.
5. **Widen before propagating.** Every single-dialect finding in the last round
   was multi-dialect. Ask lens 2 before writing the fix.

## The report

`SEMANTIC_AUDIT_<N>.md`. **Never delete a report — not this one, and not an
earlier round's.** They are the durable record of what was probed and why, they
cost real re-validation to reproduce, and an untracked one is easily lost for
good (not in git, only in a snapshot). Removing them is the maintainer's call,
never the agent's — even when a closed item's `BUGS.md` entry is deleted, leave
the report that entry came from in place. Per finding:

- **The promise** — declared type / JS semantics / documented contract, quoted.
- **The request** — the emitted SQL, verbatim.
- **The engine transcript** — the probe, copy-pasteable, with its output.
- **The blast radius** — which dialects, from lens 2. Never assume one.
- **Why the suite can't see it** — mock-only? degenerate fixture? laundered
  assertion? loose tolerance? If you can't answer, you haven't found the hole.
- **Verdict**: defect / documented limitation / intentional seam / refuted.

Refutations get an entry too, and their reason goes **into the code** as a
comment — that is what stops the next round re-filing it.

## Operational rules

- **Probe before you write.** Every design decision in the last round that was
  made from reasoning alone had to be revisited; every one made from a probe held.
- **Two fixes can be coupled.** Fixing `asDouble` alone would have turned
  MySQL from accidentally-correct into silently-wrong on `asBigint`, because its
  correctness rested on the very DECIMAL accident being removed. **Probe the
  interaction, not just the fix.**
- **The maintainer owns the forks.** Behaviour changes, public-surface changes,
  and "clean SQL vs fewer casts" are theirs. Bring the fork with the measurement
  attached, not a survey.
- **Don't touch `src/examples/`** beyond keeping it green — the legacy suite is
  being replaced and does not get expanded.
- **Snapshot churn is the tell, not the goal.** A fix that rebakes 585 snapshots
  and changes zero values is fine. A fix that changes one value is the one to
  stare at.
- **Mechanical edits over test files: use Python on whole files, and verify.**
  A regex with `[^.]*?` ate the dots out of `mod(...)`; a naive line-drop left
  half-sentences; an over-broad re-wrap touched 220 unrelated files. All three
  were reverted. Prefer literal replacement, then `grep` for the wreckage.
