// Type-system edges: the non-`ITable` else arm of the `InsertableRow` /
// `UpdatableRow` / `UpdatableOnInsertConflictRow` / `SelectedRow` aliases (fed
// an `extractColumnsFrom(...)` column-bag, which resolves through the
// `InferSourceFrom<...>` branch), and `DynamicDefinitionForModel`'s
// `boolean -> 'boolean'` and non-filterable `-> never` (array/binary/RegExp/Map)
// mappings.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type {
    InsertableRow, UpdatableRow, UpdatableOnInsertConflictRow, SelectedRow,
} from '../../../../../src/extras/types.js'
import type { DynamicDefinitionForModel } from '../../../../../src/dynamic/condition.js'
import { extractColumnsFrom } from '../../../../../src/extras/utils.js'
import { tCountry } from '../../domain/connection.js'
import { ctx } from './setup.js'

// `extractColumnsFrom(tCountry)` is a plain column-BAG (a record of value
// sources), NOT an `ITable`, so the Row aliases below resolve through their
// `: InferSourceFrom<TABLE>` else arm rather than the `extends ITable<any> ?` arm.
const countryCols = extractColumnsFrom(tCountry)
type CountryBag = typeof countryCols

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('write-side-row-aliases-else-arm-accept-a-column-bag', () => {
        // The non-`ITable` else arm of the write-side Row aliases produces a
        // usable insert/update shape from a column-bag. A plain-value row is
        // assignable to `InsertableRow` (all required: tCountry has no defaults);
        // a partial row to the optional `UpdatableRow` / `UpdatableOnInsertConflictRow`.
        const insertable: InsertableRow<CountryBag> = { code: 'US', name: 'United States', region: 'Americas' }
        const updatable: UpdatableRow<CountryBag> = { name: 'Renamed' }
        const onConflict: UpdatableOnInsertConflictRow<CountryBag> = { region: 'Europe' }

        expect(insertable).toEqual({ code: 'US', name: 'United States', region: 'Americas' })
        expect(updatable).toEqual({ name: 'Renamed' })
        expect(onConflict).toEqual({ region: 'Europe' })
    })

    test('selected-row-else-arm-resolves-the-plain-result-shape', () => {
        // `SelectedRow` over the same column-bag resolves to the plain result
        // object (all required leaves).
        assertType<Exact<SelectedRow<CountryBag>, { code: string; name: string; region: string }>>()
        // runtime witness: the bag projects the three columns.
        expect(Object.keys(countryCols).sort()).toEqual(['code', 'name', 'region'])
    })

    test('dynamic-definition-for-model-maps-boolean-to-the-boolean-descriptor', () => {
        // `DynamicDefinitionForModel` maps a `boolean` field to the `'boolean'`
        // descriptor.
        interface BillingModel {
            id:       number
            billable: boolean
        }
        assertType<Exact<
            DynamicDefinitionForModel<BillingModel>,
            { id: 'int'; billable: 'boolean' }
        >>()
    })

    test('dynamic-definition-for-model-maps-non-filterable-fields-to-never', () => {
        // Non-filterable fields (arrays, binary, RegExp, Map) map to `never`.
        interface MixedModel {
            tags:   string[]
            blob:   Uint8Array
            pat:    RegExp
            lookup: Map<string, number>
        }
        assertType<Exact<
            DynamicDefinitionForModel<MixedModel>,
            { tags: never; blob: never; pat: never; lookup: never }
        >>()
    })
})
