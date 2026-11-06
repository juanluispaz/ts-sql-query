// A name of one letter is a plain name, so it isn't written between quotes.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { Table } from '../../../../../src/Table.js'
import { type DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

class TOneLetter extends Table<DBConnection, 'TOneLetter'> {
    x = this.primaryKey('x', 'int')
    yy = this.column('yy', 'int')
    constructor() {
        super('one_letter')
    }
}
const tOneLetter = new TOneLetter()

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('a-column-with-one-letter', () => {
        const query = ctx.conn.selectFrom(tOneLetter).select({ value: tOneLetter.x, other: tOneLetter.yy }).query()

        expect(query).toMatchInlineSnapshot(`"select x as \`value\`, yy as other from one_letter"`)
    })
})
