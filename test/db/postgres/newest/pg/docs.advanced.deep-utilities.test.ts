// Documentation snippets for the Deep utilities page
// (docs/advanced/deep-utilities.md). Exercises the deep (nested,
// dotted-path) analogues of Pick/Omit/keyof: the DeepPickPaths /
// DeepPick / DeepOmit types and their runtime companions deepPick /
// deepOmit over plain objects.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact, type Extends } from '../../../../lib/assertType.js'
import { deepPick, deepOmit, type DeepPick, type DeepOmit, type DeepPickPaths } from '../../../../../src/extras/deepUtilities.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    interface CustomerWithCompany {
        id:        number
        firstName: string
        lastName:  string
        company?:  { id: number; name: string }
    }

    test('docs-extra:deep-utilities/deep-pick-paths-type', () => {
        // DeepPickPaths<Model> is the deep analogue of keyof: every legal dotted path.
        type Paths = DeepPickPaths<CustomerWithCompany>
        assertType<Exact<Paths, 'id' | 'firstName' | 'lastName' | 'company' | 'company.id' | 'company.name'>>()
    })

    test('docs-extra:deep-utilities/deep-pick-type', () => {
        // DeepPick<Model, Paths> keeps only the selected paths, narrowing nested
        // objects; top-level optionality of the model is preserved.
        type Picked = DeepPick<CustomerWithCompany, 'firstName' | 'company.name'>
        assertType<Exact<Picked, { firstName: string; company?: { name: string } }>>()
        // Selecting a whole inner object keeps it intact.
        type WholeCompany = DeepPick<CustomerWithCompany, 'id' | 'company'>
        assertType<Exact<WholeCompany, { id: number; company?: { id: number; name: string } }>>()
    })

    test('docs-extra:deep-utilities/deep-pick-paths-terminal-objects', () => {
        // Terminal object values must be treated as leaves (no recursion into
        // their members): Date, arrays, binary buffers, Map/Set, Promise. Only
        // plain nested objects are descended into.
        interface WithTerminals {
            id:       number
            birthday: Date
            tags:     string[]
            blob:     Uint8Array
            buffer:   ArrayBuffer
            roles:    Set<string>
            meta:     Map<string, number>
            nested:   { a: number; b: string }
        }
        type Paths = DeepPickPaths<WithTerminals>
        assertType<Exact<Paths,
            'id' | 'birthday' | 'tags' | 'blob' | 'buffer' | 'roles' | 'meta' | 'nested' | 'nested.a' | 'nested.b'
        >>()
        // Picked as a whole, a terminal object keeps its full type.
        type Picked = DeepPick<WithTerminals, 'birthday' | 'blob'>
        assertType<Exact<Picked, { birthday: Date; blob: Uint8Array }>>()
    })

    test('docs:deep-utilities/deep-pick-runtime', () => {
        // Section "Runtime functions — deepPick" — deepPick is the runtime
        // companion of the DeepPick type, picking deep paths out of any plain
        // object.
        // doc-start
        const customer = {
            id: 1,
            firstName: 'John',
            lastName: 'Doe',
            company: { id: 7, name: 'Acme', plan: 'pro' },
        }

        const picked = deepPick(customer, ['id', 'firstName', 'company.name'])
        // doc-end
        expect(picked).toEqual({ id: 1, firstName: 'John', company: { name: 'Acme' } })
        assertType<Extends<typeof picked, { id: number; firstName: string; company: { name: string } }>>()
    })

    test('docs-extra:deep-utilities/deep-pick-runtime-absent-inner', () => {
        // When an intermediate value is null/undefined the path is skipped, so
        // the nested key is simply absent (matching the optional model shape).
        const customer: { id: number; firstName: string; lastName: string; company: null | { id: number; name: string } } = { id: 1, firstName: 'John', lastName: 'Doe', company: null }
        const picked = deepPick(customer, ['id', 'company.name'])
        expect(picked).toEqual({ id: 1 })
    })

    test('docs-extra:deep-utilities/deep-omit-type', () => {
        // DeepOmit<Model, Paths>: omit a top-level leaf, a nested leaf, or a
        // whole nested object; top-level optionality is preserved.
        assertType<Exact<DeepOmit<CustomerWithCompany, 'lastName'>,
            { id: number; firstName: string; company?: { id: number; name: string } }>>()
        assertType<Exact<DeepOmit<CustomerWithCompany, 'company.id'>,
            { id: number; firstName: string; lastName: string; company?: { name: string } }>>()
        assertType<Exact<DeepOmit<CustomerWithCompany, 'company'>,
            { id: number; firstName: string; lastName: string }>>()
        assertType<Exact<DeepOmit<CustomerWithCompany, 'id' | 'company.name'>,
            { firstName: string; lastName: string; company?: { id: number } }>>()
    })

    test('docs:deep-utilities/deep-omit-runtime', () => {
        // Section "Runtime functions — deepOmit".
        // doc-start
        const customer = {
            id: 1,
            firstName: 'John',
            lastName: 'Doe',
            company: { id: 7, name: 'Acme', plan: 'pro' },
        }

        const trimmed = deepOmit(customer, ['lastName', 'company.id'])
        // trimmed: { id: number; firstName: string; company: { name: string; plan: string } }
        // doc-end
        expect(trimmed).toEqual({ id: 1, firstName: 'John', company: { name: 'Acme', plan: 'pro' } })
        assertType<Extends<typeof trimmed, { id: number; firstName: string; company: { name: string; plan: string } }>>()
        // The input object is not mutated.
        expect(customer.company.id).toBe(7)
        expect(customer.lastName).toBe('Doe')
    })

    test('docs-extra:deep-utilities/deep-omit-runtime-absent-inner', () => {
        // A dotted omit whose intermediate value is null is a no-op for that path.
        const customer: { id: number; firstName: string; lastName: string; company: null | { id: number; name: string } } = { id: 1, firstName: 'John', lastName: 'Doe', company: null }
        const trimmed = deepOmit(customer, ['company.id'])
        expect(trimmed).toEqual({ id: 1, firstName: 'John', lastName: 'Doe', company: null })
    })

    test('docs-extra:deep-utilities/deep-pick-required-intermediate-object', () => {
        // The other models carry an optional `company?`; this pins the
        // required-intermediate case — a non-optional nested object stays
        // non-optional through a deep pick and a deep omit.
        interface Account {
            id:  number
            org: { id: number; name: string }
        }
        assertType<Exact<DeepPick<Account, 'org.name'>, { org: { name: string } }>>()
        assertType<Exact<DeepOmit<Account, 'org.id'>, { id: number; org: { name: string } }>>()
    })

    test('docs-extra:deep-utilities/deep-pick-depth-3-path', () => {
        // The other models are at most 2 levels deep; this pins a 3-level
        // dotted path through DeepPickPaths and DeepPick.
        interface Deep3 {
            a: { b: { c: number; d: string } }
        }
        type Paths = DeepPickPaths<Deep3>
        assertType<Exact<Paths, 'a' | 'a.b' | 'a.b.c' | 'a.b.d'>>()
        assertType<Exact<DeepPick<Deep3, 'a.b.c'>, { a: { b: { c: number } } }>>()
    })

    test('docs-extra:deep-utilities/deep-pick-two-leaves-of-one-nested-object', () => {
        // Two leaves of the same nested object merge into a single nested
        // object carrying both; the optional `company?` is preserved.
        assertType<Exact<DeepPick<CustomerWithCompany, 'company.id' | 'company.name'>,
            { company?: { id: number; name: string } }>>()
    })

    test('docs-extra:deep-utilities/deep-pick-runtime-whole-nested-object-by-bare-key', () => {
        // A bare (undotted) key that names a whole nested object copies that
        // object intact — the single-segment branch of deepPick, with no
        // intermediate descent. Every other runtime deepPick test selects
        // leaf / dotted paths, so the whole-object-key branch was unreached.
        const customer = {
            id: 1,
            firstName: 'John',
            lastName: 'Doe',
            company: { id: 7, name: 'Acme', plan: 'pro' },
        }
        const picked = deepPick(customer, ['id', 'company'])
        expect(picked).toEqual({ id: 1, company: { id: 7, name: 'Acme', plan: 'pro' } })
    })

    test('docs-extra:deep-utilities/deep-pick-runtime-leaf-absent-in-source-is-skipped', () => {
        // A dotted path whose intermediate object IS reachable (not null) but
        // whose leaf key is absent from the runtime value is skipped (the
        // `leaf in src` guard), while a present sibling leaf is still copied.
        // `plan` is declared optional on the type but omitted at runtime, so
        // `company.plan` resolves to a reachable intermediate with no leaf.
        const customer: { id: number; company?: { id: number; name: string; plan?: string } } =
            { id: 1, company: { id: 7, name: 'Acme' } }
        const picked = deepPick(customer, ['company.name', 'company.plan'])
        expect(picked).toEqual({ company: { name: 'Acme' } })
    })
})
