# Canonical cell review — sub-agent prompt

This file is the **literal prompt** an agent passes to an `Explore`
sub-agent when it has finished baking the canonical cell of a coverage
wave and wants the canonical reviewed against the project's design rules
before propagation to the other cells of the matrix.

For how this fits in the round, see
[`../QUALITY_GATE.md`](../QUALITY_GATE.md) (when to invoke, what to do
with the verdict) and
[`../COVERAGE_RUNBOOK.md`](../COVERAGE_RUNBOOK.md) (the round itself).

Pass the text inside the fenced block below verbatim as the `prompt`
argument, with the two placeholders filled in:

- `<canonical-path>` — the test file the wave produced
  (e.g. `test/db/postgres/newest/pg/select.foo.test.ts`).
- `<intent>` — one sentence describing which uncov branches in `src/` the
  wave targets.

```
Review this freshly-baked canonical test file against the project's
DESIGN.md and the rest of the test/ docs before it propagates to the
rest of the matrix. This is a quality gate: the user reads every diff
at the end of the session, and DESIGN-violating tests that ship to
every cell of the matrix cost the next session disproportionately to
clean up.

Path: <canonical-path>
Intent of the wave: <intent>

Read these in full before reviewing:
  - test/DESIGN.md — every section (the normative core)
  - test/WRITING_TESTS.md § "Testing a runtime guard that is also typed
    at compile time", § "When the canonical cell can't compile the body",
    § "Imports used only from commented-out blocks", § "Extending the
    shared domain", § "When a test surfaces a bug in src/"
  - test/BUGS.md (every entry — the test may be wrapped against an
    existing bug, or may have surfaced a new one)
  - test/LIMITATIONS.md (every entry — the test may be assuming
    behaviour the lib has explicitly chosen not to support, e.g.
    pre-emptive enforcement of GROUP BY column requirements or
    engine-version feature gating)
  - test/EXTERNAL_CAVEATS.md (every "Dialect-specific notes" subsection
    — the canonical's snapshot or test body may need to be re-wrapped
    on certain cells when propagated)
  - test/ANTIPATTERNS.md (the catalogue — every past failure mode the
    suite has shipped before)
  - test/TESTS_AUDIT.md (the rule list with fix hints — needed to
    understand which checks below are already enforced mechanically
    by tests:audit at round close, so you can focus your time where it
    matters)

Division of work with tests:audit. The mechanical anti-cheat audit
(tests:audit) will block round close on `mirror-image`,
`one-sided-guard`, `mock-only`, `skip-real-db`, `as-any`, `any-type`,
`ts-ignore`, `ts-expect-error`, `commented-test-reason` (and ~15
others), across the whole matrix. Your highest-value work is what the
audit cannot do: cross-doc context (BUGS, LIMITATIONS,
EXTERNAL_CAVEATS), judgement calls (stub body even when the reason
header is present, realistic vs synthetic queries, achievable values
across all cells), and the EXTERNAL_CAVEATS sweep for propagation. For
checks marked [also caught by tests:audit] below, scan the canonical
quickly and flag obvious instances as feedback to the author so the
re-bake happens before propagation — do not produce exhaustive
detail-counts; the audit will list every instance at round close.

Then read the file. For every test() block in it, check:

  1. [also caught by tests:audit: mirror-image, one-sided-guard,
     mock-only, skip-real-db] DESIGN § Real-DB validation + § Principles 1.
     Quick scan only — flag the canonical fast so the author re-bakes
     before propagation, then move on. Patterns to watch for:
     - "if (!ctx.realDbEnabled) { exact } else { shape }" — the
       MIRROR-IMAGE SMELL (DESIGN § Mock-only is a smell —
       Mirror-image form). The fix is JS sorting +
       toEqual OR UPDATE-in-withRollback.
     - "if (ctx.realDbEnabled) return" without a documented constraint
       (mock-only).
     The audit will enumerate every instance across the matrix at
     round close; you only need to surface that the canonical has a
     problem so it gets fixed before the 17-cell re-bake.

  2. [also caught by tests:audit: as-any, any-type, ts-ignore,
     ts-expect-error] DESIGN § The "as any" runtime-guard exception
     + WRITING_TESTS § "Testing a runtime guard". The audit blocks
     stray `as any` / `any` types / `@ts-ignore` / `@ts-expect-error`
     outside `types.negative/`. Your unique value here is **context the
     audit cannot read**:
     - When a cast IS present and the audit's runtime-guard carve-out
       allows it, verify the test is genuinely dedicated to reaching a
       runtime guard the typer blocks on purpose, not silencing a TS
       overload rejection on a feature that should be supported. The
       latter usually means a BUGS.md entry should be opened and the
       test block-commented with the canonical bare-literal body.
     - When a cast is suppressed with `tests-audit-disable-next-line
       as-any`, check the mandatory reason is genuine (not "had to").

  3. TEST_LIB § Mutation safety contract:
     - Side-effecting tests (UPDATEs / INSERTs / DELETEs outside
       a transaction the test body itself manages) must be inside
       ctx.withRollback / ctx.withCommit / ctx.withReseed. Flag
       raw mutations without a wrapper.

  4. DESIGN § Symmetry rule + § Full-canonical-body discipline.
     The audit (commented-test-reason rule) blocks any /* */ block
     without a `// TODO[LIMITATION]: …` or `// TODO[BUG]: …` header
     above it, so the **missing-reason path is mechanical**. Your
     unique value here is the call the audit cannot make:
     - **Is the body inside /* */ the FULL canonical, or a stub?**
       (The audit cannot tell — a 3-line legitimate one-liner and a
       3-line "// stub" both look short.) Flag stub-style bodies
       even when the reason header IS present. See
       ANTIPATTERNS § stub-as-commented-test.
     - **Is the reason header genuine?** "Not applicable on <DB>:"
       must identify the dialect / engine / driver / BUGS.md
       entry — generic "Not applicable" passes the audit but should
       be tightened.

  5. DESIGN § Principles 10 (Realistic, shared domain):
     - Test scenarios should read like real product code on the
       shared project-management domain. Flag synthetic queries
       (select a, b from T-style; throwaway values like 'x', 1,
       2, 3 outside seed-aware contexts).

  6. BUGS.md cross-check:
     - If any test() uses an API that has a BUGS.md entry, the
       test must follow that entry's prescribed shape (block-
       commented with TODO[BUG] for the typing-rejected case;
       mock-only with a documented constraint for the
       engine-rejected case). Flag deviations.
     - If the file appears to have surfaced a NEW bug, flag it
       — the test author should open the BUGS.md entry and wrap
       the test before propagation.

  7. LIMITATIONS.md cross-check:
     - Flag any assertion that assumes the library will
       pre-emptively detect / enforce / throw for something
       LIMITATIONS.md says it does not. Most common shape:
       "the lib should throw before the engine does" — the
       engine throws, the lib propagates verbatim, and that's
       intentional. The test's expected error must be the
       engine's error (which only appears under real DB), not
       a lib-side guard reason.
     - When a test deliberately depends on a documented
       limitation (e.g. the GROUP-BY laxness), the assertion
       gets `// TODO[LIMITATION]` and links the entry.

  8. EXTERNAL_CAVEATS.md sweep — list which propagation targets
     will need post-copy re-wrapping. Concretely:
     - new Date(...) params → bun_sql_postgres newest/oldest
       (Bun#29010).
     - bigint values in UPDATE / mockNext / set({...:Nn}) →
       sqlite3 cell (NOT NULL violation).
     - customUuid columns projected / aggregated → sqlite3 and
       sqlite-wasm-OO1 (no uuid_str function).
     - .returning(...) / .returningOneColumn(...) → mysql cell.
     - onConflict family → oracle / sqlserver cells.
     - isolationLevel(level, accessMode) → oracle / sqlserver
       cells.
     - tTable.oldValues() / deleteFrom(...).using(...) /
       connection.isolationLevel(...) on sqlite cells.
     Report a (test_name, target_cells) list the propagation
     script can re-wrap mechanically.

  9. Connector-default symmetry:
     - The canonical's value assertion uses the form
       expect(rows).toEqual([...]) with concrete expected values.
       Per-cell propagation MUST keep the same shape; the
       reviewer should sanity-check the expected values are
       achievable across every active cell after the per-
       connector wraps in (8) — i.e. the cells that remain
       active actually return the asserted value, not a
       dialect-truncated subset.

 10. ANTIPATTERNS.md cross-check:
     - Every flagged finding should map to a numbered antipattern
       (#1 mirror-image smell, #2 stub-as-commented-test, #3
       blind-copy-to-bun_sql_postgres, #4 as-any bypass, #5
       hallucinated API). Tags #1 / #4 / part of #2 are already
       mechanical in tests:audit (see "Division of work" above);
       your job is the cross-doc context (BUGS / LIMITATIONS /
       EXTERNAL_CAVEATS) and the stub-body / connector-symmetry
       calls that the audit cannot make. If a flagged finding
       doesn't fit any existing antipattern, propose it as a
       candidate new entry.

Report format — please use this exact shape:

  Verdict: { GREEN | YELLOW: minor | RED: blockers }
  Critical issues (must fix before propagation):
    - <test_name>: <one-line description>
      [Rule: DESIGN § <anchor> | WRITING_TESTS § <anchor> | ANTIPATTERNS #N]
  Minor issues (worth addressing if cheap):
    - <test_name>: <one-line description>
  EXTERNAL_CAVEATS sweep — re-wrap on propagation:
    - <test_name> on <cell>: <reason from EXTERNAL_CAVEATS>
  BUGS.md cross-references:
    - <test_name> uses <api>; existing entry "<title>" applies / new entry needed for <symptom>.
  ANTIPATTERNS — new candidate (if any):
    - <one-line; if all findings already fit existing entries say "none">

Keep the report under 400 words. The point is to catch failures,
not produce a treatise.
```

## Maintenance contract for this file

Any change to the doc layout the prompt deep-links into (renaming a
heading in DESIGN/WRITING_TESTS/ANTIPATTERNS, adding a new normative
section, deleting an EXTERNAL_CAVEATS subsection that was called out
explicitly) requires a paired update here. The prompt is versionable so
the sub-agent reads the rules from the current state of the project, not
a frozen snapshot.

Specifically:

- If [`../DESIGN.md`](../DESIGN.md) or [`../WRITING_TESTS.md`](../WRITING_TESTS.md) get new section anchors that the
  reviewer should follow, add them under the "Read these in full" list.
- If [`../ANTIPATTERNS.md`](../ANTIPATTERNS.md) adds a new numbered entry, add it to check #10's
  enumeration.
- If [`../EXTERNAL_CAVEATS.md`](`../EXTERNAL_CAVEATS.md`) gains a new dialect note (Bun bug, driver
  limitation), add it to the bullet list in check #8 so the sweep is
  mechanical.
- **If [`../TESTS_AUDIT.md`](../TESTS_AUDIT.md) absorbs a check that the sub-agent was doing
  by hand** (a new rule lands, an existing one gets promoted to `error`),
  add the rule name to the "Division of work with tests:audit" paragraph
  and tag the matching check above with `[also caught by tests:audit:
  <rule>]`. The sub-agent's time is the scarce resource — every check
  the audit absorbs should free a paragraph of focus here, not pile up
  as redundant reading.

Other content changes (rules getting stricter, new failure modes documented)
get reflected naturally because the sub-agent reads the source docs
themselves, not a frozen copy of the rules.
