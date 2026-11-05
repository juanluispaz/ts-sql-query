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

    test('docs:deep-utilities/deep-pick-paths-type', () => {
        // DeepPickPaths<Model> is the deep analogue of keyof: every legal dotted path.
        type Paths = DeepPickPaths<CustomerWithCompany>
        assertType<Exact<Paths, 'id' | 'firstName' | 'lastName' | 'company' | 'company.id' | 'company.name'>>()
    })

    test('docs:deep-utilities/deep-pick-type', () => {
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
        // An intermediate value that is null is kept.
        const customer: { id: number; firstName: string; lastName: string; company: null | { id: number; name: string } } = { id: 1, firstName: 'John', lastName: 'Doe', company: null }
        const picked = deepPick(customer, ['id', 'company.name'])
        expect(picked).toEqual({ id: 1, company: null })
    })

    test('docs:deep-utilities/deep-omit-type', () => {
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

    test('docs-extra:deep-utilities/deep-omit-two-leaves-of-one-nested-object', () => {
        // Two dotted omit paths sharing one head (`company.id` + `company.name`):
        // the second path finds the head's tail-list already collected and appends
        // to it rather than starting a fresh one, so BOTH leaves are omitted.
        // Every other deepOmit test omits at most one leaf per nested object, so
        // the append-to-existing-head branch was unreached.
        const customer = {
            id: 1,
            firstName: 'John',
            lastName: 'Doe',
            company: { id: 7, name: 'Acme', plan: 'pro' },
        }
        const trimmed = deepOmit(customer, ['company.id', 'company.name'])
        expect(trimmed).toEqual({ id: 1, firstName: 'John', lastName: 'Doe', company: { plan: 'pro' } })
        assertType<Extends<typeof trimmed, { id: number; firstName: string; lastName: string; company: { plan: string } }>>()
        // The input object is not mutated.
        expect(customer.company.id).toBe(7)
        expect(customer.company.name).toBe('Acme')
    })

    test('docs-extra:deep-utilities/deep-omit-the-pages-union-of-paths', () => {
        assertType<Exact<DeepOmit<CustomerWithCompany, 'lastName' | 'company.id'>, {
            id:        number
            firstName: string
            company?:  { name: string }
        }>>()
    })

    test('docs-extra:deep-utilities/deep-omit-runtime-whole-nested-object-by-bare-key', () => {
        const customer = { id: 1, firstName: 'John', company: { id: 7, name: 'Acme' } }
        const trimmed = deepOmit(customer, ['company'])
        assertType<Exact<typeof trimmed, { id: number; firstName: string }>>()
        expect(trimmed).toEqual({ id: 1, firstName: 'John' })
    })

    test('docs-extra:deep-utilities/deep-omit-untouched-values-copied-by-reference', () => {
        const contact = { phone: '555' }
        const company = { id: 7, name: 'Acme', contact }
        const customer = { id: 1, company, contact }
        const trimmed = deepOmit(customer, ['company.id'])

        // A value no path touches is the same object; an intermediate of a path is a new one.
        expect(trimmed.contact).toBe(contact)
        expect(trimmed.company.contact).toBe(contact)
        expect(trimmed.company).not.toBe(company)
        expect(company).toEqual({ id: 7, name: 'Acme', contact })
    })

    test('docs-extra:deep-utilities/deep-pick-paths-regexp-and-function-are-terminal', () => {
        interface WithTerminals {
            pattern:  RegExp
            callback: () => void
            pending:  Promise<number>
            lookup:   WeakMap<object, string>
            seen:     WeakSet<object>
            optional?: RegExp | null
            nested:   { pattern: RegExp; id: number }
        }
        assertType<Exact<DeepPickPaths<WithTerminals>,
            'pattern' | 'callback' | 'pending' | 'lookup' | 'seen' | 'optional' | 'nested' | 'nested.pattern' | 'nested.id'>>()
    })

    test('docs-extra:deep-utilities/deep-omit-terminal-values', () => {
        interface WithTerminals {
            id:       number
            bornOn:   Date
            tags:     string[]
            pattern:  RegExp
        }
        assertType<Exact<DeepOmit<WithTerminals, 'bornOn' | 'tags'>, { id: number; pattern: RegExp }>>()

        const bornOn = new Date('2024-01-02T03:04:05Z')
        const tags = ['a']
        const pattern = /a/
        const source: WithTerminals = { id: 1, bornOn, tags, pattern }
        const kept = deepOmit(source, ['id'])
        assertType<Exact<typeof kept, { bornOn: Date; tags: string[]; pattern: RegExp }>>()
        expect(kept.bornOn).toBe(bornOn)
        expect(kept.tags).toBe(tags)
        expect(kept.pattern).toBe(pattern)
        expect(deepOmit(source, ['bornOn', 'tags'])).toEqual({ id: 1, pattern })
        expect(deepPick(source, ['bornOn', 'pattern'])).toEqual({ bornOn, pattern })
    })

    test('docs-extra:deep-utilities/deep-pick-runtime-undefined-intermediate', () => {
        const customer: { id: number; company?: { name: string } | undefined } = { id: 1, company: undefined }
        const picked = deepPick(customer, ['id', 'company.name'])
        assertType<Exact<typeof picked, { id: number; company?: { name: string } }>>()
        expect(picked).toEqual({ id: 1 })
        expect('company' in picked).toBe(false)
    })

    test('docs-extra:deep-utilities/deep-pick-forced-paths-by-spread', () => {
        const customer = { id: 1, firstName: 'John', lastName: 'Doe', company: { id: 7, name: 'Acme' } }
        const fields: ('firstName' | 'company.name')[] = ['company.name']
        const picked = deepPick(customer, ['id', ...fields])
        assertType<Exact<typeof picked, { id: number; firstName: string; company: { name: string } }>>()
        expect(picked).toEqual({ id: 1, company: { name: 'Acme' } })
    })

    test('docs-extra:deep-utilities/empty-selection-picks-nothing-and-omits-nothing', () => {
        const customer = { id: 1, company: { id: 7 } }
        const picked = deepPick(customer, [])
        const trimmed = deepOmit(customer, [])
        assertType<Exact<typeof picked, {}>>()
        assertType<Exact<typeof trimmed, { id: number; company: { id: number } }>>()
        expect(picked).toEqual({})
        expect(trimmed).toEqual(customer)
        expect(trimmed).not.toBe(customer)
    })

    test('docs-extra:deep-utilities/every-leaf-of-the-object-omitted-keeps-it-empty', () => {
        const customer = { id: 1, company: { id: 7, name: 'Acme' } }
        const trimmed = deepOmit(customer, ['company.id', 'company.name'])
        assertType<Exact<typeof trimmed, { id: number; company: {} }>>()
        expect(trimmed).toEqual({ id: 1, company: {} })
    })

    test('docs-extra:deep-utilities/whole-object-omitted-wins-over-its-inner-path', () => {
        const customer = { id: 1, company: { id: 7, name: 'Acme' } }
        const trimmed = deepOmit(customer, ['company', 'company.id'])
        assertType<Exact<typeof trimmed, { id: number }>>()
        expect(trimmed).toEqual({ id: 1 })
    })

    test('docs-extra:deep-utilities/type-and-function-agree-at-depth-5', () => {
        const source = { id: 1, a: { b: { c: { d: { e: 'leaf', other: 2 }, q: 3 }, q: 4 }, q: 5 } }
        assertType<Extends<'a.b.c.d.e', DeepPickPaths<typeof source>>>()

        const picked = deepPick(source, ['id', 'a.b.c.d.e'])
        assertType<Exact<typeof picked, { id: number; a: { b: { c: { d: { e: string } } } } }>>()
        expect(picked).toEqual({ id: 1, a: { b: { c: { d: { e: 'leaf' } } } } })

        const trimmed = deepOmit(source, ['a.b.c.d.e', 'a.q'])
        assertType<Exact<typeof trimmed, { id: number; a: { b: { c: { d: { other: number }; q: number }; q: number } } }>>()
        expect(trimmed).toEqual({ id: 1, a: { b: { c: { d: { other: 2 }, q: 3 }, q: 4 } } })
    })

    test('docs-extra:deep-utilities/optional-intermediates-at-depth-3', () => {
        interface Model { id: number; a?: { b?: { c: number } } }
        assertType<Exact<DeepPick<Model, 'a.b.c'>, { a?: { b?: { c: number } } }>>()
        assertType<Exact<DeepOmit<Model, 'a.b.c'>, { id: number; a?: { b?: {} } }>>()

        const present: Model = { id: 1, a: {} }
        const picked = deepPick(present, ['a.b.c'])
        assertType<Exact<typeof picked, { a?: { b?: { c: number } } }>>()
        expect(picked).toEqual({ a: {} })
        const absent: Model = { id: 1 }
        expect(deepPick(absent, ['a.b.c'])).toEqual({})
        expect(deepOmit(absent, ['a.b.c'])).toEqual({ id: 1 })
    })

    test('docs-extra:deep-utilities/deep-pick-path-into-a-nullable-required-object', () => {
        const customer: { id: number; company: { name: string; plan: string } | null } = { id: 1, company: null }
        const picked = deepPick(customer, ['id', 'company.name'])
        assertType<Exact<typeof picked, { id: number; company: { name: string } | null }>>()
        expect(picked).toEqual({ id: 1, company: null })
    })

    test('docs-extra:deep-utilities/deep-omit-path-into-a-nullable-object', () => {
        const customer: { id: number; company: { id: number; name: string } | null } = { id: 1, company: null }
        const trimmed = deepOmit(customer, ['company.id'])
        assertType<Exact<typeof trimmed, { id: number; company: { name: string } | null }>>()
        expect(trimmed).toEqual({ id: 1, company: null })
    })

    test('docs-extra:deep-utilities/deep-omit-keeps-a-key-named-like-an-object-member', () => {
        const source: { id: number; toString: string; valueOf: string } = { id: 1, toString: 'a', valueOf: 'b' }
        const trimmed = deepOmit(source, ['id'])
        assertType<Exact<typeof trimmed, { toString: string; valueOf: string }>>()
        expect(Object.keys(trimmed).sort()).toEqual(['toString', 'valueOf'])
    })

    test('docs-extra:deep-utilities/deep-pick-leaves-out-keys-that-are-not-strings', () => {
        const mark = Symbol('mark')
        const source: { a: number; 1: string; [mark]: number } = { a: 1, 1: 'x', [mark]: 2 }
        const picked = deepPick(source, ['a'])
        assertType<Exact<typeof picked, { a: number }>>()
        expect(Reflect.ownKeys(picked)).toEqual(['a'])
    })

    test('docs-extra:deep-utilities/deep-pick-whole-object-and-inner-path', () => {
        const customer = { id: 1, company: { id: 7, name: 'Acme' } }
        const picked = deepPick(customer, ['company', 'company.id'])
        assertType<Exact<typeof picked, { company: { id: number; name: string } }>>()
        expect(picked).toEqual({ company: { id: 7, name: 'Acme' } })
        expect(deepPick(customer, ['company.id', 'company'])).toEqual({ company: { id: 7, name: 'Acme' } })
    })

})
