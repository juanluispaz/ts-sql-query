# Connector-specialised mock runners

Each file here mirrors the behaviour of one real `QueryRunner` from
`src/queryRunners/`, narrowed to the slice that observably differs from
the generic [`MockQueryRunner`](../../../src/queryRunners/MockQueryRunner.ts).
Specifically: the `addParam` value transformation each real connector
applies before sending values to the underlying driver. Using these
specialised mocks in `test/db/*/runners.ts` keeps the captured params
identical between mock and real modes, so the per-cell test bodies do
not need to branch on `ctx.realDbEnabled` just to satisfy a snapshot
that depends on the runner's internal massage.

There is exactly one file per `src/queryRunners/*QueryRunner.ts` that
the test matrix actually exercises. Some are intentionally thin (just
re-export `MockQueryRunner` when no divergence exists) — they are kept
on disk so adding a future connector-specific quirk is a single-file
change rather than a refactor across the test infrastructure.
