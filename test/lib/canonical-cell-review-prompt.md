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

Then read the file. For every test() block in it, check:

  1. DESIGN § Real-DB validation + § Principles 1: Is every
     expect(result).toEqual(...) unconditional?
     - Flag any "if (!ctx.realDbEnabled) { ... } else { ... }"
       patterns, especially the form where the mock branch is
       expect.toEqual(exact) and the real-DB branch is
       expect.length.toBe(N) / .toBeGreaterThan(0) /
       Array.isArray(...). That is the MIRROR-IMAGE SMELL — see
       DESIGN § Mock-only is a smell — Mirror-image form. Should
       have been fixed by JS sorting or UPDATE-in-withRollback.
     - Flag any "if (ctx.realDbEnabled) return" without a
       documented constraint.

  2. DESIGN § The "as any" runtime-guard exception + WRITING_TESTS §
     "Testing a runtime guard":
     - Flag every "as any" cast in the file. Verify each one is at
       the narrowest possible spot of a fluent chain AND that the
       test is dedicated to reaching a runtime guard the typer
       blocks on purpose. Whole-chain casts, casts to satisfy
       generic inference, or casts to silence a TS overload
       rejection on a feature that should be supported — all
       fail this check. The latter category usually means a
       BUGS.md entry should be opened and the test block-
       commented with the canonical bare-literal body.

  3. TEST_LIB § Mutation safety contract:
     - Side-effecting tests (UPDATEs / INSERTs / DELETEs outside
       a transaction the test body itself manages) must be inside
       ctx.withRollback / ctx.withCommit / ctx.withReseed. Flag
       raw mutations without a wrapper.

  4. DESIGN § Symmetry rule + § Full-canonical-body discipline:
     - If the test body is inside a /* */ block (canonical
       can't host it OR the test is non-applicable on this cell),
       the body must be the FULL canonical the supporting dialect
       would run — not a stub like "// Not supported on this
       dialect: X is not typed". Flag stub-style bodies. See
       ANTIPATTERNS § stub-as-commented-test.
     - The line above /* */ must name a specific reason.
       Generic "Not applicable" without identifying the dialect,
       the engine, the driver or the BUGS.md entry is not enough.

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
       hallucinated API). If a flagged finding doesn't fit any of
       them, propose it as a candidate new entry.

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

Other content changes (rules getting stricter, new failure modes documented)
get reflected naturally because the sub-agent reads the source docs
themselves, not a frozen copy of the rules.
