// Compile-time negative tests for the public helpers that do not belong to a query:
// the type adapters, the deep utilities, the column extractors, sync and the public
// entries. These never execute any SQL: `validate:tests` (tsc) rejects each
// `@ts-expect-error` line.

import { test, expect } from '../../../lib/testRunner.js'
import * as root from '../../../../src/index.js'
import * as compat from '../../../../src/dynamicCondition.js'
import { deepOmit, deepPick, type DeepPick, type DeepOmit } from '../../../../src/extras/deepUtilities.js'
import { sync } from '../../../../src/extras/sync.js'
import { extractColumnNamesFrom, extractColumnsFrom } from '../../../../src/extras/utils.js'
import { CustomBooleanTypeAdapter } from '../../../../src/TypeAdapter.js'
import { tCountry } from '../domain/connection.js'

function _typeNegatives() {
    // Rule: both values of a custom boolean have the same data type.
    new CustomBooleanTypeAdapter(1, 0)
    new CustomBooleanTypeAdapter('yes', 'no')
    // @ts-expect-error a number and a string cannot be mixed
    new CustomBooleanTypeAdapter(1, 'no')

    // Rule: the paths of deepPick and deepOmit are the paths of the object.
    const model = { id: 1, company: { name: 'a' } }
    deepPick(model, ['company.name'])
    deepOmit(model, ['company.name'])
    // @ts-expect-error `company.id` is not a path of the object
    deepPick(model, ['company.id'])
    // @ts-expect-error `company.id` is not a path of the object
    deepOmit(model, ['company.id'])

    // Rule: deepPick, deepOmit and the column extractors take an object, never null.
    // @ts-expect-error null is not an object
    deepPick(null, [])
    // @ts-expect-error null is not an object
    deepOmit(null, [])
    // @ts-expect-error null is not an object
    extractColumnsFrom(null)
    // @ts-expect-error null is not an object
    extractColumnNamesFrom(null)

    // Rule: only a column of the object can be excluded.
    extractColumnsFrom(tCountry, ['name'])
    // @ts-expect-error `id` is not a column of the table
    extractColumnsFrom(tCountry, ['id'])

    // Rule: the paths of the deep types are not validated, an unknown path selects nothing.
    const noKeys: keyof DeepPick<typeof model, 'unknown'> extends never ? true : false = true
    const allKeys: keyof DeepOmit<typeof model, 'unknown'> extends 'id' | 'company' ? true : false = true
    void noKeys
    void allKeys

    // Rule: sync takes a promise.
    // @ts-expect-error 1 is not a promise
    sync(1)

    // Rule: IDEncrypter stays out of the root entry, it is only at its subpath.
    // @ts-expect-error not exported by the root entry
    void root.IDEncrypter
    // Rule: the compatibility entry only keeps the surface it had; the model helpers are at the new subpaths.
    // @ts-expect-error not exported by the compatibility entry
    void compat.deepPick
}

test('public-surface-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
