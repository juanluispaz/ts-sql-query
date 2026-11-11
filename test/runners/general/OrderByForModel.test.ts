// OrderByForModel<Model>: the clauses of an order by a model, its scalar leaves addressed by their dotted path,
// optionally followed by an ordering mode. A nested object contributes its leaves, not itself; an array is not
// orderable; the paths go up to 5 levels deep, the deepest nesting of a complex projection.

import { describe, expect, test } from '../../lib/testRunner.js'
import { assertType, type Exact } from '../../lib/assertType.js'
import type { OrderByForModel, OrderByMode } from '../../../src/dynamic/orderBy.js'

interface Model {
    id: number
    name: string
    birthday?: Date | null
    tags: string[]
    company: { name: string, address?: { city: string } | null }
}

type Paths = 'id' | 'name' | 'birthday' | 'company.name' | 'company.address.city'

interface Deep {
    a: { b: { c: { d: { e: number, f: { g: number } } } } }
}

describe('OrderByForModel', () => {
    test('the-clauses-are-the-scalar-leaves-by-their-dotted-path-with-an-optional-mode', () => {
        assertType<Exact<OrderByForModel<Model>, Paths | `${Paths} ${OrderByMode}`>>()
        const orderBy: OrderByForModel<Model>[] = ['name asc', 'birthday desc nulls last', 'company.address.city insensitive', 'id']
        expect(orderBy.join(', ')).toBe('name asc, birthday desc nulls last, company.address.city insensitive, id')
    })

    test('an-object-an-array-or-two-clauses-are-not-a-clause', () => {
        // @ts-expect-error a nested object isn't orderable, only its leaves
        const object: OrderByForModel<Model> = 'company'
        // @ts-expect-error an array isn't orderable
        const array: OrderByForModel<Model> = 'tags'
        // @ts-expect-error one clause per element
        const two: OrderByForModel<Model> = 'name asc, id desc'
        // @ts-expect-error not an ordering mode
        const mode: OrderByForModel<Model> = 'name sideways'
        expect([object, array, two, mode].length).toBe(4)
    })

    test('the-paths-go-up-to-5-levels-deep', () => {
        const five: OrderByForModel<Deep> = 'a.b.c.d.e desc'
        // @ts-expect-error a leaf deeper than 5 levels isn't offered
        const six: OrderByForModel<Deep> = 'a.b.c.d.f.g'
        assertType<Exact<OrderByForModel<Deep>, 'a.b.c.d.e' | `a.b.c.d.e ${OrderByMode}`>>()
        expect([five, six].length).toBe(2)
    })
})
