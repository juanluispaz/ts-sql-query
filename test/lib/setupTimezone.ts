// Force every test process into UTC so localDateTime / localDate /
// localTime marshalling is deterministic across developer machines and CI,
// and matches the docker database engines (which run in UTC). Without this
// a value like `new Date('2020-01-01T00:00:00.000Z')` marshals to a
// machine-local wall-clock string on the connectors that store dates as
// text (sqlite), so the emitted param — and therefore the snapshot —
// would shift with the host timezone.
//
// Mirrors the per-file `process.env.TZ = 'UTC'` the legacy
// src/examples/* scripts set for the same reason. Wired as a bun
// `preload` (bunfig.toml) and a vitest `setupFiles` (vitest.config.ts) so
// it applies under both runners, including direct `bun test` /
// `npx vitest run` invocations on a single file.
process.env.TZ = 'UTC'
