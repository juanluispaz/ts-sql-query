// Picked by Node's / Bun's `imports` map (`#test-runtime`) when the `bun`
// condition is NOT active (i.e. under Node + vitest). Static re-exports —
// no top-level await — for symmetry with `testRuntime.bun.ts`.

export {
    describe,
    test,
    it,
    expect,
    beforeAll,
    afterAll,
    beforeEach,
    afterEach,
} from 'vitest'
