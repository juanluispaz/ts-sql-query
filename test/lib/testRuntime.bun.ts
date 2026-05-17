// Picked by Node's / Bun's `imports` map (`#test-runtime`) when the `bun`
// condition is active. Static re-exports — no top-level await — so under
// `bun test --parallel=N` the importing test file sees a fully-initialised
// binding even when worker isolation evaluates dependencies eagerly.

export {
    describe,
    test,
    it,
    expect,
    beforeAll,
    afterAll,
    beforeEach,
    afterEach,
} from 'bun:test'
