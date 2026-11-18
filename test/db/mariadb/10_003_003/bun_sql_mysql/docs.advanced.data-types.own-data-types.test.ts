// Documentation snippets for the Data types of your own page (docs/advanced/data-types/own-data-types.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { ctx } from './setup.js'
import { EqualableType, IntegersType } from '../../../../../src/exports/v2/index.js'

// The data types of the values of the user, each one a class of the family of its values
abstract class UnitsType extends IntegersType<Units, 'Units'> { static override readonly type = 'Units' }
abstract class TagType extends EqualableType<string, 'Tag'> { static override readonly type = 'Tag' }

type Units = number & { readonly __brand: 'Units' }

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:own-data-types/own-type-converted-as-its-family', async () => {
        // The SQL gives both values as text: the IntegersType is converted as an int, the custom arrives as it comes
        ctx.mockNext({ units: '42', tag: '42' })
        const row = await ctx.conn.selectFromNoTable()
            .select({
                units: ctx.conn.fragmentWithType(UnitsType, 'required').sql`'42'`,
                tag: ctx.conn.fragmentWithType(TagType, 'required').sql`'42'`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select '42' as units, '42' as tag"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { units: Units; tag: string }>>()
        expect(row).toEqual({ units: 42, tag: '42' })
    })
})
